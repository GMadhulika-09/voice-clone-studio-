import sys
import traceback
import torch
import soundfile as sf
from pathlib import Path
from qwen_tts import Qwen3TTSModel


def main():
    if len(sys.argv) < 4:
        print(
            "Usage: python generate_clone.py "
            "<reference_audio> <text> <output_audio>"
        )
        sys.exit(1)

    reference_audio = Path(sys.argv[1])
    text = sys.argv[2]
    output_audio = Path(sys.argv[3])

    print("=================================")
    print("QWEN3-TTS VOICE CLONE")
    print("=================================")

    print("Reference audio:", reference_audio)
    print("Output audio:", output_audio)
    print("Text:", text)

    if not reference_audio.exists():
        raise FileNotFoundError(
            f"Reference audio not found: {reference_audio}"
        )

    print("Loading Qwen3-TTS 0.6B Base...")

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU is not available. "
            "Qwen3-TTS requires a CUDA-capable GPU for this setup."
        )

    print(
        "GPU:",
        torch.cuda.get_device_name(0)
    )

    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        device_map="cuda:0",
        dtype=torch.bfloat16,
    )

    print("Model loaded successfully!")

    ref_text = (
        "Hello, my name is Madhulika. "
        "This is a demonstration of my AI voice clone. "
        "Today I am testing how artificial intelligence "
        "can learn the characteristics of a voice and "
        "generate natural speech."
    )

    print("Generating cloned speech...")

    wavs, sr = model.generate_voice_clone(
        text=text,
        language="English",
        ref_audio=str(reference_audio),
        ref_text=ref_text,
    )

    output_audio.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    sf.write(
        str(output_audio),
        wavs[0],
        sr
    )

    print("DONE!")
    print("Saved:", output_audio)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n========== ACTUAL QWEN ERROR ==========", file=sys.stderr)
        traceback.print_exc()
        print("========================================", file=sys.stderr)
        sys.exit(1)