from pathlib import Path
from difflib import SequenceMatcher
import asyncio
import shutil
import subprocess
import uuid

import soundfile as sf
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from faster_whisper import WhisperModel
from qwen_tts import Qwen3TTSModel

# Project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_DIR / "server" / "uploads" / "voice_references"
OUTPUT_DIR = PROJECT_DIR / "python" / "generated"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Voice Clone Studio API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".aac", ".opus",
    ".wma", ".aiff", ".aif", ".amr", ".mp4", ".mpeg", ".mpga", ".mov", ".mkv",
}
# Qwen3-TTS-12Hz-0.6B-Base supports these languages. Hindi/Telugu are not officially
# supported by this checkpoint, so the API rejects them rather than silently mislabeling output.
SUPPORTED_LANGUAGES = {
    "English", "Chinese", "Japanese", "Korean", "German", "French",
    "Russian", "Portuguese", "Spanish", "Italian",
}
voice_data = {}
generation_lock = asyncio.Lock()

class ActivateVoiceRequest(BaseModel):
    file_path: str = ""
    transcript: str
    original_filename: str = "saved-voice.wav"

class CloneRequest(BaseModel):
    voice_id: str
    text: str
    language: str = "English"

if not torch.cuda.is_available():
    raise RuntimeError(
        "CUDA GPU was not detected. This backend is configured for your NVIDIA GPU. "
        "Check the NVIDIA driver and the installed CUDA-enabled PyTorch build."
    )
GPU_NAME = torch.cuda.get_device_name(0)
print("Loading Qwen3-TTS-12Hz-0.6B-Base on", GPU_NAME)
tts_model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-0.6B-Base", device_map="cuda:0", dtype=torch.bfloat16
)
print("Qwen3-TTS loaded.")
print("Loading faster-whisper small on CPU...")
whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
print("Whisper loaded.")


def transcribe_audio(audio_path: Path) -> str:
    segments, _info = whisper_model.transcribe(str(audio_path), beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()


def normalize_to_wav(source: Path, destination: Path) -> None:
    """Convert supported audio/video uploads to mono 24 kHz PCM WAV using FFmpeg."""
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-vn", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(destination),
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=180)
    except FileNotFoundError as exc:
        raise RuntimeError("FFmpeg was not found. Install FFmpeg and reopen the terminal.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Audio conversion timed out. Try a shorter recording.") from exc
    if completed.returncode != 0 or not destination.exists() or destination.stat().st_size == 0:
        details = (completed.stderr or "").strip()[-1200:]
        raise RuntimeError("FFmpeg could not read this file. " + details)


def safe_reference_path(raw_path: str) -> Path:
    if not raw_path or not raw_path.strip():
        raise HTTPException(status_code=400, detail="Saved recording path is missing.")
    path = Path(raw_path).resolve()
    try:
        path.relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid saved voice path.")
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The saved recording cannot be found on this computer. Trying recovery may help; otherwise upload it again.",
        )
    return path


@app.get("/")
def home():
    return {
        "status": "Voice Clone Studio API is running",
        "model": "Qwen3-TTS-12Hz-0.6B-Base",
        "transcription": "faster-whisper small CPU",
        "gpu": GPU_NAME,
        "supported_languages": sorted(SUPPORTED_LANGUAGES),
    }


@app.post("/upload-voice")
async def upload_voice(voice: UploadFile = File(...)):
    if not voice.filename:
        raise HTTPException(status_code=400, detail="No file selected.")
    original_name = Path(voice.filename).name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{extension}'. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    voice_id = uuid.uuid4().hex
    source_path = UPLOAD_DIR / f"{voice_id}_original{extension}"
    wav_path = UPLOAD_DIR / f"{voice_id}.wav"
    try:
        with source_path.open("wb") as buffer:
            shutil.copyfileobj(voice.file, buffer)
        normalize_to_wav(source_path, wav_path)
        transcript = await asyncio.to_thread(transcribe_audio, wav_path)
        if not transcript.strip():
            raise HTTPException(status_code=400, detail="No clear speech was detected in this recording.")
        voice_data[voice_id] = {
            "path": wav_path,
            "transcript": transcript,
            "original_name": original_name,
        }
        return {
            "success": True,
            "voice_id": voice_id,
            "filename": original_name,
            "transcript": transcript,
            "file_path": str(wav_path.resolve()),
        }
    except HTTPException:
        if wav_path.exists(): wav_path.unlink()
        if source_path.exists(): source_path.unlink()
        raise
    except Exception as error:
        if wav_path.exists(): wav_path.unlink()
        if source_path.exists(): source_path.unlink()
        raise HTTPException(status_code=500, detail=f"Voice upload/processing failed: {error}")
    finally:
        await voice.close()


@app.post("/activate-voice")
async def activate_voice(request: ActivateVoiceRequest):
    path = safe_reference_path(request.file_path)
    transcript = request.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="The saved voice transcript is missing.")
    voice_id = path.stem
    voice_data[voice_id] = {
        "path": path,
        "transcript": transcript,
        "original_name": request.original_filename,
    }
    return {"success": True, "voice_id": voice_id, "file_path": str(path), "message": "Saved voice activated."}


@app.post("/recover-voice")
async def recover_voice(request: ActivateVoiceRequest):
    expected = " ".join(request.transcript.lower().split())
    if len(expected) < 8:
        raise HTTPException(status_code=400, detail="Saved transcript is too short to search reliably.")

    candidates = []
    # First prefer files whose names match the original filename (legacy uploads).
    original_name = Path(request.original_filename).name.lower().strip()
    all_files = [p for p in UPLOAD_DIR.iterdir() if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS]
    # Prefer normalized WAV references. Newly uploaded videos/audio also have an original
    # source copy; scanning both would produce tied transcript scores for the same recording.
    wav_files = [p for p in all_files if p.suffix.lower() == ".wav"]
    files = wav_files if wav_files else all_files
    files.sort(key=lambda p: (0 if p.name.lower() == original_name else 1, p.name.lower()))

    for audio_path in files:
        try:
            # Transcribe files as-is; FFmpeg-backed Whisper supports common formats.
            actual_raw = await asyncio.to_thread(transcribe_audio, audio_path)
            actual = " ".join(actual_raw.lower().split())
            if not actual:
                continue
            score = SequenceMatcher(None, expected, actual).ratio()
            candidates.append({
                "file_path": str(audio_path.resolve()),
                "filename": audio_path.name,
                "score": round(score, 3),
                "transcript": actual_raw,
            })
        except Exception as error:
            print(f"Skipping recovery candidate {audio_path.name}: {error}")

    candidates.sort(key=lambda item: item["score"], reverse=True)
    return {"success": True, "matches": candidates[:5]}


@app.post("/clone")
async def clone_voice(request: CloneRequest):
    text = request.text.strip()
    language = request.language.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please enter some text.")
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=(f"'{language}' is not supported by the currently loaded Qwen3-TTS 0.6B Base checkpoint. "
                    "Supported languages are English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish and Italian."),
        )
    voice_info = voice_data.get(request.voice_id)
    if not voice_info:
        raise HTTPException(status_code=404, detail="This voice is not active in the current backend session. Reactivate the saved voice or recover its recording.")
    reference_audio = Path(voice_info["path"]).resolve()
    if not reference_audio.is_file():
        raise HTTPException(status_code=404, detail="Reference audio file no longer exists. Recover or upload the recording again.")

    async with generation_lock:
        try:
            wavs, sample_rate = await asyncio.to_thread(
                tts_model.generate_voice_clone,
                text=text,
                language=language,
                ref_audio=str(reference_audio),
                ref_text=voice_info["transcript"],
            )
        except Exception as error:
            print("Qwen generation failed:", repr(error))
            raise HTTPException(status_code=500, detail=f"Voice generation failed: {error}")

    output_path = OUTPUT_DIR / f"{request.voice_id}_{uuid.uuid4().hex}.wav"
    try:
        sf.write(str(output_path), wavs[0], sample_rate)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Could not save generated audio: {error}")
    return FileResponse(path=str(output_path), media_type="audio/wav", filename="cloned-voice.wav")


if __name__ == "__main__":
    import uvicorn
    print(f"Starting Voice Clone Studio API on http://localhost:8000 (GPU: {GPU_NAME})")
    uvicorn.run(app, host="0.0.0.0", port=8000)
