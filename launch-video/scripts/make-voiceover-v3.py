"""Voice-over for the v3 film, generated locally with Kokoro (open-source TTS,
Apache-2.0; no external service). It says only the on-screen lines
(DIRECTION_V3.md §6). Each line is its own clip, placed on its frame by
src/timeline/vo.ts, so the edit and the voice stay locked.

    python3 scripts/make-voiceover-v3.py [voice] [speed]

Writes public/audio/vo/<id>.wav and public/audio/vo/lines.json (durations).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.92
CACHE = os.path.expanduser("~/.cache/zenboard-tts")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/audio/vo")

# Keep in sync with src/timeline/vo.ts (ids and text).
LINES = {
    "noise": "Your work lives in a dozen places.",
    "meet": "Meet, Zenboard.",
    "whole": "Your whole business.",
    "one": "One workspace.",
    "arc-tasks": "Tasks.",
    "arc-calendar": "Calendar.",
    "arc-docs": "Docs.",
    "arc-clients": "Clients.",
    "arc-money": "Money.",
    "g-task": "A task",
    "g-project": "becomes a project.",
    "g-calendar": "lands on your calendar.",
    "g-doc": "opens a doc.",
    "g-client": "updates your client.",
    "g-paid": "and gets paid.",
    "connects": "Everything connects.",
    "work": "Work.",
    "life": "Life.",
    "business": "Business.",
    "zenboard": "Zenboard.",
    "tagline": "The single platform to manage work, life, and business.",
    "today": "Available today.",
}


def trim(x, sr, thresh=0.004):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    pad = int(0.04 * sr)
    return x[max(0, idx[0] - pad) : idx[-1] + int(0.12 * sr)]


k = Kokoro(os.path.join(CACHE, "kokoro-v1.0.onnx"), os.path.join(CACHE, "voices-v1.0.bin"))
os.makedirs(OUT, exist_ok=True)
meta = {}
for key, text in LINES.items():
    x, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    x = trim(np.asarray(x, dtype=np.float32), sr)
    # 20 ms fades so clips never click.
    f = int(0.02 * sr)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    sf.write(os.path.join(OUT, f"{key}.wav"), x, sr)
    meta[key] = {"text": text, "dur": round(len(x) / sr, 3)}
    print(f"{key:14s} {len(x) / sr:5.2f}s  {text}")
json.dump(meta, open(os.path.join(OUT, "lines.json"), "w"), indent=2)
