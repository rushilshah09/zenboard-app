"""Cuts the single ElevenLabs take (audio-src/voiceover-take.mp3) into the
per-line clips the film plays (public/vo/<scene>.mp3), then lifts them +9 dB
with a peak limiter so the voice sits ~7 dB over the ducked music.

Cut points come from silence detection plus word timings. Multi-phrase lines
(S04, S17) have their pauses tightened so the voice keeps pace with the
on-screen phrases.

    python3 scripts/cut-voiceover.py
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "audio-src/voiceover-take.mp3")

# scene: ([(start, end), ...] in seconds of the take, gap between pieces)
CUTS = {
    "S01": ([(0.00, 1.95)], 0),
    "S02": ([(2.19, 3.41)], 0),
    "S04": ([(3.83, 4.64), (5.05, 6.08), (6.48, 7.56)], 0.22),
    "S08": ([(8.01, 10.51)], 0),
    "S09": ([(10.84, 11.52), (12.40, 16.12)], 0.35),
    "S11": ([(16.55, 18.35)], 0),
    "S12": ([(18.78, 20.12)], 0),
    "S13": ([(20.18, 21.50)], 0),
    "S14": ([(21.50, 22.62)], 0),
    "S15": ([(22.95, 24.34)], 0),
    "S16": ([(24.47, 26.55)], 0),
    "S17": ([(26.76, 27.75), (28.33, 29.30), (29.90, 30.80)], 0.35),
    "S18": ([(31.33, 33.93)], 0),
}

os.makedirs(os.path.join(ROOT, "public/vo"), exist_ok=True)
for scene, (parts, gap) in CUTS.items():
    filt, labels = [], []
    for i, (a, b) in enumerate(parts):
        d = b - a
        filt.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={max(0, d - 0.04):.3f}:d=0.04[p{i}]")
        labels.append(f"[p{i}]")
        if i < len(parts) - 1:
            filt.append(f"anullsrc=r=44100:cl=mono,atrim=0:{gap}[g{i}]")
            labels.append(f"[g{i}]")
    filt.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1,volume=9dB,alimiter=limit=0.89:level=false[out]")
    out = os.path.join(ROOT, f"public/vo/{scene}.mp3")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", SRC, "-filter_complex", ";".join(filt),
                    "-map", "[out]", "-ac", "1", "-ar", "44100", "-b:a", "160k", out], check=True)
    print("wrote", os.path.relpath(out, ROOT))
