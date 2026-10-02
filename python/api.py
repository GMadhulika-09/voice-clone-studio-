from pathlib import Path
import shutil
import uuid

import torch
import soundfile as sf

from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from faster_whisper import WhisperModel
from qwen_tts import Qwen3TTSModel


PROJECT_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = PROJECT_DIR / "server" / "uploads" / "voice_references"
OUTPUT_DIR = PROJECT_DIR / "python" / "generated"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


app = FastAPI(title="Voice Clone Studio API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


print("========================================")
print("Loading Qwen3-TTS Voice Clone Model...")
print("========================================")

print("GPU:", torch.cuda.get_device_name(0))

tts_model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

print("Qwen3-TTS model loaded successfully!")


print("========================================")
print("Loading Whisper transcription model...")
print("========================================")

whisper_model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8",
)

print("Whisper model loaded successfully!")


ALLOWED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".ogg",
    ".flac",
    ".webm",
}


def transcribe_audio(audio_path: Path) -> str:
    print()
    print("Transcribing:", audio_path)

    segments, info = whisper_model.transcribe(
        str(audio_path),
        beam_size=5,
    )

    transcript = " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()

    print("Transcript:")
    print(transcript)

    return transcript


@app.get("/")
def home():
    return {
        "status": "Voice Clone Studio API is running",
        "model": "Qwen3-TTS 0.6B Base",
        "transcription": "faster-whisper small CPU",
        "gpu": torch.cuda.get_device_name(0),
    }


@app.post("/upload-voice")
async def upload_voice(
    voice: UploadFile = File(...)
):
    print()
    print("========================================")
    print("VOICE UPLOAD")
    print("========================================")

    if not voice.filename:
        raise HTTPException(
            status_code=400,
            detail="No voice file was provided.",
        )

    original_name = voice.filename
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format.",
        )

    voice_id = uuid.uuid4().hex
    saved_filename = f"{voice_id}{extension}"
    saved_path = UPLOAD_DIR / saved_filename

    print("Original file:", original_name)
    print("Saving:", saved_path)

    with saved_path.open("wb") as buffer:
        shutil.copyfileobj(voice.file, buffer)

    print("Voice file saved.")

    try:
        transcript = transcribe_audio(saved_path)

    except Exception as error:
        print("Transcription error:", error)

        saved_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail=f"Voice transcription failed: {error}",
        )

    if not transcript:
        saved_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400,
            detail="No speech could be detected.",
        )

    print()
    print("Voice upload successful!")
    print("Voice ID:", voice_id)
    print("Transcript:", transcript)

    return {
        "success": True,
        "voice_id": voice_id,
        "filename": original_name,
        "transcript": transcript,
    }


@app.post("/clone")
async def clone_voice(
    voice_id: str = Form(...),
    text: str = Form(...),
):
    print()
    print("========================================")
    print("VOICE GENERATION")
    print("========================================")

    if not voice_id:
        raise HTTPException(
            status_code=400,
            detail="Voice ID is required.",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text is required.",
        )

    matching_files = list(
        UPLOAD_DIR.glob(f"{voice_id}.*")
    )

    if not matching_files:
        raise HTTPException(
            status_code=404,
            detail="Voice reference was not found.",
        )

    reference_audio = matching_files[0]

    print("Reference voice:", reference_audio)
    print("Text:", text)

    try:
        reference_text = transcribe_audio(reference_audio)

        wavs, sample_rate = tts_model.generate_voice_clone(
            text=text.strip(),
            language="English",
            ref_audio=str(reference_audio),
            ref_text=reference_text,
        )

    except Exception as error:
        print("Generation error:", error)

        raise HTTPException(
            status_code=500,
            detail=f"Voice generation failed: {error}",
        )

    output_filename = f"{voice_id}_{uuid.uuid4().hex}.wav"
    output_path = OUTPUT_DIR / output_filename

    sf.write(
        str(output_path),
        wavs[0],
        sample_rate,
    )

    print("Generation complete!")
    print("Output:", output_path)

    return FileResponse(
        path=str(output_path),
        media_type="audio/wav",
        filename="cloned-voice.wav",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
