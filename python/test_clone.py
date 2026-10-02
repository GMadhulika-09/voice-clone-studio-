
import torch
import soundfile as sf
from pathlib import Path
from qwen_tts import Qwen3TTSModel

print("Loading Qwen3-TTS 0.6B Base...")
print("GPU:", torch.cuda.get_device_name(0))

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

print("Model loaded successfully!")

project_dir = Path(__file__).resolve().parent.parent
ref_audio = project_dir / "server" / "uploads" / "reference.wav"
output_audio = project_dir / "python" / "output.wav"

if not ref_audio.exists():
    raise FileNotFoundError(f"Reference audio not found: {ref_audio}")

text = "Hello, this is a test of my local voice cloning system."

wavs, sr = model.generate_voice_clone(
    text=text,
    language="English",
    ref_audio=str(ref_audio),
    ref_text="Hello, my name is Madhulika. This is a demonstration of my AI voice clone. Today I am testing how artificial intelligence can learn the characteristics of a voice and generate natural speech.",
)

sf.write(str(output_audio), wavs[0], sr)

print("DONE!")
print("Saved:", output_audio)