"""Synthesises the film's ambient score (public/music.wav).

Original, royalty-free: warm pad chords + soft plucked arpeggio + a low
pulse, at 96 BPM. Run: python3 scripts/make-music.py (needs numpy).
"""
import wave
import numpy as np

SR = 44100
DUR = 40.5
BPM = 96
BEAT = 60 / BPM
t = np.arange(int(SR * DUR)) / SR
out = np.zeros((len(t), 2))

def midi(n):
    return 440 * 2 ** ((n - 69) / 12)

# Fmaj9 → Am7 → Dm9 → Bbmaj7(#11), two bars each
CHORDS = [
    [41, 53, 57, 60, 64, 67],
    [45, 52, 55, 60, 64, 67],
    [38, 53, 57, 60, 64, 69],
    [46, 53, 57, 62, 65, 69],
]
BAR = BEAT * 4
CHORD_LEN = BAR * 2

def env(n, a, r):
    e = np.ones(n)
    a, r = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e

# Pad
pos, i = 0.0, 0
while pos < DUR:
    notes = CHORDS[i % 4]
    s, n = int(pos * SR), int(min(CHORD_LEN + 1.2, DUR - pos) * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for k, m in enumerate(notes):
        f = midi(m)
        for det in (-0.08, 0.08):
            ph = np.random.rand() * 6.28
            sig += np.sin(2 * np.pi * f * (1 + det / 100) * tt + ph) * (0.5 if k == 0 else 0.22)
            sig += 0.06 * np.sin(2 * np.pi * 2 * f * tt + ph)
    sig *= env(n, 1.4, 1.4) * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * tt))
    e = min(len(out), s + n)
    out[s:e, 0] += sig[: e - s] * 0.055
    out[s:e, 1] += sig[: e - s] * 0.055
    pos += CHORD_LEN
    i += 1

# Plucked arpeggio (8ths), enters after the logo (~8s)
step = BEAT / 2
k = 0
pos = 8.0
while pos < DUR - 2:
    ci = int(pos // CHORD_LEN) % 4
    notes = CHORDS[ci][2:] + [CHORDS[ci][3] + 12]
    m = notes[[0, 2, 1, 3, 2, 1, 3, 0][k % 8]] + 12
    f = midi(m)
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 5)
    s = int(pos * SR)
    e = min(len(out), s + n)
    pan = 0.5 + 0.3 * np.sin(k * 0.9)
    out[s:e, 0] += sig[: e - s] * 0.05 * (1 - pan)
    out[s:e, 1] += sig[: e - s] * 0.05 * pan
    pos += step
    k += 1

# Soft low pulse on beats 1 and 3, from the Today scene (~11s)
pos = 11.0
while pos < DUR - 3:
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    f = 55 * np.exp(-tt * 8) + 42
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    s = int(pos * SR)
    e = min(len(out), s + n)
    out[s:e] += (sig[: e - s] * 0.16)[:, None]
    pos += BEAT * 2

# Gentle stereo room: short feedback delay
d = int(0.23 * SR)
for _ in range(3):
    out[d:, 0] += out[:-d, 1] * 0.18
    out[d:, 1] += out[:-d, 0] * 0.18

fade = int(2.5 * SR)
out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= np.max(np.abs(out)) / 0.85
data = (out * 32767).astype(np.int16)
with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("wrote public/music.wav")
