"""Synthesises every sound in the film: the score and the SFX kit.

Original and royalty-free. Section boundaries are read from src/timeline.ts,
so re-timing a scene re-times the music too.

    python3 scripts/make-audio.py      # needs numpy

Writes public/music.wav and public/sfx/*.wav.
"""
import os
import re
import wave

import numpy as np

SR = 44100
FPS = 30
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)

# ── Timeline ────────────────────────────────────────────────────────────────
src = open(os.path.join(ROOT, "src/timeline.ts")).read()
scenes = re.findall(r'id: "([a-z-]+)", act: "\w+", frames: (\d+)', src)
START, t = {}, 0
for sid, frames in scenes:
    START[sid] = t / FPS
    t += int(frames)
TOTAL = t / FPS


# ── Helpers ─────────────────────────────────────────────────────────────────
def write(path, sig):
    sig = np.atleast_2d(sig.T).T if sig.ndim == 1 else sig
    if sig.ndim == 1 or sig.shape[1] == 1:
        sig = np.repeat(sig.reshape(-1, 1), 2, axis=1)
    peak = np.max(np.abs(sig)) or 1
    data = (sig / peak * 0.89 * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def adsr(n, a=0.01, r=0.2):
    e = np.ones(n)
    a, r = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


# ── SFX kit ─────────────────────────────────────────────────────────────────
def sfx_pop():
    t = tt(0.14)
    f = 520 + 700 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32)


def sfx_tick():
    t = tt(0.05)
    return highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 180) + 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120)


def sfx_key(seed):
    r = np.random.default_rng(seed)
    t = tt(0.06)
    body = np.sin(2 * np.pi * (180 + 40 * seed) * t) * np.exp(-t * 90)
    click = highpass(r.standard_normal(len(t)), 1800) * np.exp(-t * 260)
    return click * 0.7 + body * 0.5


def sfx_thud():
    t = tt(0.35)
    f = 50 + 120 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) + 0.25 * highpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 60)


def sfx_snap():
    t = tt(0.3)
    crack = highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 70)
    f = 900 * np.exp(-t * 9) + 120
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
    return crack + 0.5 * tone


def sfx_whoosh(length=0.7):
    t = tt(length)
    n = rng.standard_normal(len(t))
    env = np.sin(np.pi * t / length) ** 2
    lo = lowpass(n, 700)
    hi = highpass(lowpass(n, 5000), 1500)
    mix = lo * (1 - t / length) + hi * (t / length)
    return mix * env


def sfx_swipe():
    return sfx_whoosh(0.28)


def sfx_riser(length=2.4):
    t = tt(length)
    n = highpass(rng.standard_normal(len(t)), 1200) * (t / length) ** 2
    f = 180 + 900 * (t / length) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / length) ** 1.5 * 0.35
    return (n * 0.6 + tone) * adsr(len(t), 0.05, 0.03)


def sfx_impact():
    t = tt(2.4)
    f = 32 + 60 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    air = lowpass(rng.standard_normal(len(t)), 2200) * np.exp(-t * 5) * 0.4
    return sub + air


def sfx_shimmer():
    t = tt(2.6)
    out = np.zeros(len(t))
    for i, m in enumerate([84, 88, 91, 96, 100]):
        d = int(i * 0.07 * SR)
        seg = t[: len(t) - d]
        out[d:] += np.sin(2 * np.pi * midi(m) * seg) * np.exp(-seg * 2.4) * 0.3
    return out


def sfx_chime():
    t = tt(2.2)
    out = np.zeros(len(t))
    for m, d in [(84, 0), (91, 0.09)]:
        k = int(d * SR)
        seg = t[: len(t) - k]
        f = midi(m)
        tone = sum(np.sin(2 * np.pi * f * p * seg) * a for p, a in [(1, 1), (2.76, 0.35), (5.4, 0.12)])
        out[k:] += tone * np.exp(-seg * 3)
    return out


def sfx_glitch():
    t = tt(0.25)
    sq = np.sign(np.sin(2 * np.pi * 110 * t * (1 + 3 * t)))
    gate = (np.floor(t * 60) % 2)
    return sq * gate * np.exp(-t * 10) * 0.6 + highpass(rng.standard_normal(len(t)), 4000) * 0.2 * gate


def build_sfx():
    out = os.path.join(ROOT, "public/sfx")
    os.makedirs(out, exist_ok=True)
    kit = {
        "pop": sfx_pop(),
        "tick": sfx_tick(),
        "key-1": sfx_key(1),
        "key-2": sfx_key(2),
        "key-3": sfx_key(3),
        "thud": sfx_thud(),
        "snap": sfx_snap(),
        "whoosh": sfx_whoosh(),
        "swipe": sfx_swipe(),
        "riser": sfx_riser(),
        "impact": sfx_impact(),
        "shimmer": sfx_shimmer(),
        "chime": sfx_chime(),
        "glitch": sfx_glitch(),
    }
    for name, sig in kit.items():
        write(os.path.join(out, f"{name}.wav"), sig)
    print("wrote", len(kit), "sfx")


# ── Score ───────────────────────────────────────────────────────────────────
def build_music():
    n = int(TOTAL * SR) + SR
    L = np.zeros(n)
    R = np.zeros(n)

    def add(sig, at, gain=1.0, pan=0.5):
        s = int(at * SR)
        e = min(n, s + len(sig))
        if e <= s:
            return
        L[s:e] += sig[: e - s] * gain * (1 - pan)
        R[s:e] += sig[: e - s] * gain * pan

    def pad(notes, at, length, gain, bright=0.06):
        t = tt(length)
        sig = np.zeros(len(t))
        for k, m in enumerate(notes):
            f = midi(m)
            for det in (-0.1, 0.1):
                ph = rng.random() * 6.28
                sig += np.sin(2 * np.pi * f * (1 + det / 100) * t + ph) * (0.45 if k == 0 else 0.2)
                sig += bright * np.sin(2 * np.pi * 2 * f * t + ph)
        sig *= adsr(len(t), min(1.5, length / 3), min(1.8, length / 3))
        add(sig, at, gain, 0.45)
        add(sig, at + 0.011, gain, 0.55)

    def pluck(m, at, gain, pan=0.5, decay=4.5):
        t = tt(1.4)
        f = midi(m)
        sig = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.1 * np.sin(6 * np.pi * f * t)) * np.exp(-t * decay)
        add(sig * adsr(len(t), 0.003, 0.2), at, gain, pan)

    def kick(at, gain):
        t = tt(0.45)
        f = 48 + 70 * np.exp(-t * 25)
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9), at, gain)

    def hat(at, gain, pan=0.6):
        t = tt(0.06)
        add(highpass(rng.standard_normal(len(t)), 6000) * np.exp(-t * 90), at, gain, pan)

    FMAJ = [[41, 57, 60, 64, 67], [45, 57, 60, 64, 67], [38, 57, 60, 65, 69], [46, 58, 62, 65, 69]]

    # Act I — origin: hopeful, sparse.
    a0, a1 = START["origin"], START["tool-pile"]
    pad([53, 60, 64, 69], a0, a1 - a0 + 1.5, 0.05)
    for i, m in enumerate([72, 76, 79, 81, 79, 76, 72, 74, 77, 81]):
        pluck(m, a0 + 0.6 + i * 1.0, 0.07, 0.35 + 0.3 * (i % 2))

    # Act II — the problem: minor drone, a clock that speeds up, a riser.
    p0, p1 = START["tool-pile"], START["pause"]
    pad([38, 50, 53, 57, 58], p0, p1 - p0, 0.045, bright=0.02)
    at, bpm = p0, 100.0
    beat = 0
    while at < p1 - 0.4:
        prog = (at - p0) / (p1 - p0)
        bpm = 100 + 60 * prog ** 1.6
        step = 60 / bpm / 2
        hat(at, 0.05 + 0.05 * prog, 0.3 + 0.4 * (beat % 2))
        if beat % 4 == 0:
            kick(at, 0.18 + 0.1 * prog)
        if beat % 2 == 0:
            notes = [62, 65, 69, 70, 69, 65]
            pluck(notes[(beat // 2) % len(notes)], at, 0.045 + 0.03 * prog, 0.5 + 0.3 * np.sin(beat), decay=7)
        at += step
        beat += 1
    add(sfx_riser(2.6), p1 - 2.6, 0.12)

    # Turn — silence, a single held tone.
    q0 = START["pause"]
    t = tt(4.5)
    add(np.sin(2 * np.pi * midi(69) * t) * adsr(len(t), 1.5, 2.0) * 0.5, q0 + 0.3, 0.05)

    # Act III — reveal and product: warm, open, in time.
    r0 = START["reveal"]
    merge = r0 + 2.0
    c0 = START["calm"]
    bar = 60 / 96 * 4
    k = 0
    at = r0
    while at < c0:
        pad(FMAJ[k % 4], at, bar * 2 + 1.5, 0.06 if at > merge else 0.03)
        at += bar * 2
        k += 1
    step = 60 / 96 / 2
    at, i = merge, 0
    while at < c0 - 0.2:
        ci = int((at - r0) // (bar * 2)) % 4
        chord = FMAJ[ci]
        seq = [chord[2], chord[3], chord[4], chord[3] + 12, chord[4], chord[3]]
        pluck(seq[i % len(seq)] + 12, at, 0.05, 0.5 + 0.35 * np.sin(i * 0.8))
        if at > START["tour-today"] and i % 4 == 0:
            kick(at, 0.16)
        if at > START["tour-today"] and i % 4 == 2:
            hat(at, 0.035)
        at += step
        i += 1

    # Close — resolve and ring out.
    pad([41, 53, 57, 60, 64, 67, 72], c0, TOTAL - c0 + 0.5, 0.07)
    for j, m in enumerate([72, 76, 79, 84]):
        pluck(m, START["outro"] + 0.6 + j * 0.25, 0.06, 0.3 + j * 0.15, decay=2)

    # Room: a short cross-feedback delay.
    d = int(0.21 * SR)
    for _ in range(3):
        L[d:] += R[:-d] * 0.16
        R[d:] += L[:-d] * 0.16

    mix = np.stack([L, R], axis=1)[: int(TOTAL * SR)]
    fade = int(2.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    write(os.path.join(ROOT, "public/music.wav"), mix)
    print(f"wrote music.wav ({TOTAL:.1f}s)")


if __name__ == "__main__":
    build_sfx()
    build_music()
