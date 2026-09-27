"""Voice-over for the v4 film, generated locally with Kokoro (open-source TTS, Apache-2.0).
It says the on-screen lines plus the feature names on the dial. Each line is its own clip,
placed at its second in src/v4/vo.ts, so picture and voice stay locked.

    python3 scripts/make-voiceover-v4.py [voice] [speed]

Writes public/audio/vo4/<id>.wav and public/audio/vo4/lines.json (durations in seconds).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.95
CACHE = os.path.expanduser("~/.cache/zenboard-tts")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/audio/vo4")

# Keep in sync with src/v4/vo.ts.
LINES = {
    "apps": "Your work lives in eight apps.",
    "all": "And you live in all of them.",
    "meet": "Meet, Zenboard.",
    "juggle": "Everything you juggle.",
    "place": "In one place.",
    "day": "Your whole day. One view.",
    "tasks": "Tasks.", "projects": "Projects.", "docs": "Docs.", "calendar": "Calendar.",
    "clients": "Clients.", "money": "Money.", "habits": "Habits.", "focus": "Focus.",
    "auto": "Effortless automation.",
    "work": "Describe it once. Zenboard does the work.",
    "need": "Everything you need.",
    "made": "Beautifully made.",
    "one": "Work, life, and business. One workspace.",
    "zenboard": "Zenboard.",
    "tagline": "The single platform to manage work, life, and business.",
    "today": "Available today.",
}


def trim(x, sr, thresh=0.004):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    pad = int(0.04 * sr)
    return x[max(0, idx[0] - pad): idx[-1] + int(0.12 * sr)]


k = Kokoro(os.path.join(CACHE, "kokoro-v1.0.onnx"), os.path.join(CACHE, "voices-v1.0.bin"))
os.makedirs(OUT, exist_ok=True)
dur = {}
for key, text in LINES.items():
    samples, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    x = trim(samples, sr)
    fade = int(0.015 * sr)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    sf.write(os.path.join(OUT, f"{key}.wav"), x, sr)
    dur[key] = round(len(x) / sr, 3)
    print(f"{key:10s} {dur[key]:5.2f}s  {text}")
json.dump(dur, open(os.path.join(OUT, "lines.json"), "w"), indent=1)
