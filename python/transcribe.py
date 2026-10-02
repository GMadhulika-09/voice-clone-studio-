from faster_whisper import WhisperModel
from pathlib import Path

project_dir = Path(__file__).resolve().parent.parent
audio_file = project_dir / "server" / "uploads" / "reference.wav"

print("Loading Whisper...")
print("Audio:", audio_file)

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

print("Transcribing...")

segments, info = model.transcribe(
    str(audio_file),
    language="en"
)

transcript = []

for segment in segments:
    transcript.append(segment.text.strip())

final_text = " ".join(transcript)

print("\n================ TRANSCRIPT ================\n")
print(final_text)
print("\n=============================================")

output_file = project_dir / "python" / "reference_transcript.txt"
output_file.write_text(final_text, encoding="utf-8")

print("\nSaved transcript to:")
print(output_file)