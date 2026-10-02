"""Generates the film's voice-over locally with Kokoro (open-source neural TTS,
Apache-2.0). No external service. One line at a time, with exact silences
between lines, so the timing follows DIRECTION_V2.md §5.

    python3 scripts/make-voiceover.py [voice] [speed]
    e.g. python3 scripts/make-voiceover.py af_heart 0.95

Female voices: af_heart (default), af_bella, af_sarah, af_nicole, bf_emma (British).
Male voices:   am_michael, am_fenrir, bm_george.
Writes audio-src/voiceover-v2.wav and audio-src/voiceover-v2-lines.json (where each line starts).
"""
import json
import os
import sys
import urllib.request

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.95
CACHE = os.path.expanduser("~/.cache/zenboard-tts")
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"

# (line, silence after it in seconds). Pauses follow the shot lengths in DIRECTION_V2.md §5.
SCRIPT = [
    ("You started a business to do the work you love.", 0.45),
    ("Instead, you're running it across eight different apps.", 0.35),
    ("Re-typing the same client.", 0.25),
    ("Chasing the same invoice.", 0.25),
    ("Switching.", 0.35),
    ("Again.", 1.9),  # the freeze
    ("What if it all connected?", 0.9),
    ("Meet, Zenboard.", 0.55),
    ("One connected workspace for your work, your business, and your life.", 0.7),
    ("It starts with a task.", 1.0),
    ("That becomes part of a project.", 1.0),
    ("It finds its place on your calendar.", 1.0),
    ("Your docs live right next to the work.", 1.0),
    ("Your clients see progress.", 1.0),
    ("And the hours become an invoice.", 0.3),
    ("In one click.", 0.7),
    ("Create.", 1.25),
    ("Plan.", 1.25),
    ("Write.", 1.25),
    ("Send.", 1.25),
    ("Done.", 0.9),
    ("Everything you run,", 0.55),
    ("connected.", 0.8),
    ("In one place.", 3.0),  # the settle: "All done for today"
    ("Zenboard.", 0.6),
    ("The single platform to manage work, life, and business.", 0.8),
]


def model_files():
    os.makedirs(CACHE, exist_ok=True)
    out = []
    for name in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        path = os.path.join(CACHE, name)
        if not os.path.exists(path):
            print("downloading", name)
            urllib.request.urlretrieve(BASE + name, path)
        out.append(path)
    return out


def trim(x, sr, thresh=0.004):
    """Trim the model's own leading/trailing silence so our pauses are exact."""
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    pad = int(0.06 * sr)
    return x[max(0, idx[0] - pad) : idx[-1] + pad]


k = Kokoro(*model_files())
lang = "en-gb" if VOICE.startswith("b") else "en-us"
parts, lines, t, sr = [], [], 0.35, 24000
parts.append(np.zeros(int(sr * t), dtype=np.float32))
for text, pause in SCRIPT:
    audio, sr = k.create(text, voice=VOICE, speed=SPEED, lang=lang)
    audio = trim(audio.astype(np.float32), sr)
    lines.append({"text": text, "start": round(t, 3), "end": round(t + len(audio) / sr, 3)})
    parts += [audio, np.zeros(int(sr * pause), dtype=np.float32)]
    t += len(audio) / sr + pause
out = np.concatenate(parts)
out = out / max(1e-6, np.abs(out).max()) * 0.89  # peak ~ -1 dBFS; loudness is set at mastering
os.makedirs("audio-src", exist_ok=True)
sf.write("audio-src/voiceover-v2.wav", out, sr)
json.dump({"voice": VOICE, "speed": SPEED, "lines": lines}, open("audio-src/voiceover-v2-lines.json", "w"), indent=1)
print(f"wrote audio-src/voiceover-v2.wav ({len(out) / sr:.1f}s, voice {VOICE})")
