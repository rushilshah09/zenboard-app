"""Synthesises the film's score and SFX kit (creative direction §6).

Original and royalty-free. Timing is read from src/brand/timeline.ts (in
beats), so re-timing a scene re-times the sound.

    python3 scripts/make-audio.py      # needs numpy

Writes public/audio/score.wav and public/audio/sfx/*.wav. Final loudness
(-14 LUFS, -1 dBTP) is set on the rendered master: scripts/master.sh.
"""
import os
import re
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(11)

# ── Timeline (beats) ────────────────────────────────────────────────────────
src = open(os.path.join(ROOT, "src/brand/timeline.ts")).read()
BPM = float(re.search(r"export const BPM = (\d+)", src).group(1))
BEAT = 60.0 / BPM
scenes = re.findall(r'id: "(S\d+)", act: (\d), beats: ([\d.]+)', src)
START, t = {}, 0.0
for sid, _act, beats in scenes:
    START[sid] = t
    t += float(beats) * BEAT
TOTAL = t
FRAME = 1 / 60


def at(sid, frames=0):
    return START[sid] + frames * FRAME


# ── DSP helpers ─────────────────────────────────────────────────────────────
def tt(sec):
    return np.arange(int(sec * SR)) / SR


def onepole(x, cutoff):
    """One-pole lowpass; `cutoff` may be a per-sample array (a sweep)."""
    a = np.broadcast_to(np.exp(-2 * np.pi * np.asarray(cutoff, dtype=float) / SR), x.shape)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def lp(x, c):
    return onepole(onepole(x, c), c)


def hp(x, c):
    return x - lp(x, c)


def bp(x, lo, hi):
    return lp(hp(x, lo), hi)


def env(n, a=0.005, r=0.1):
    e = np.ones(n)
    a, r = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if a:
        e[:a] = np.linspace(0, 1, a) ** 2
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def write(path, sig, peak=0.89):
    if sig.ndim == 1:
        sig = np.stack([sig, sig], axis=1)
    m = np.max(np.abs(sig)) or 1
    data = (sig / m * peak * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def mallet(f, length=1.2, bright=0.35):
    """Soft glass/mallet tone: the Zenboard chime family."""
    t = tt(length)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2)
    s += bright * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 6)
    s += 0.12 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 10)
    return s * env(len(t), 0.004, 0.2)


# ── SFX kit ─────────────────────────────────────────────────────────────────
def sfx():
    out = os.path.join(ROOT, "public/audio/sfx")
    os.makedirs(out, exist_ok=True)
    kit = {}

    t = tt(0.12)
    kit["pen-tap"] = (np.sin(2 * np.pi * 950 * t) * np.exp(-t * 90) + 0.5 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 140)
                      + 0.3 * hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400))

    t = tt(0.6)
    kit["paper-slide"] = bp(rng.standard_normal(len(t)), 900, 4200) * np.sin(np.pi * t / 0.6) ** 1.5

    t = tt(0.7)
    kit["lift"] = lp(rng.standard_normal(len(t)), 500 + 1800 * t / 0.7) * np.sin(np.pi * t / 0.7) ** 2

    # Eight notification ticks, each slightly out of tune (§6).
    detune = [-38, 22, -14, 33, -27, 9, -44, 18]
    for i, c in enumerate(detune):
        f = 1318.5 * 2 ** (c / 1200)
        t = tt(0.3)
        kit[f"notify-{i}"] = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.02 * t)) * np.exp(-t * 16) * env(len(t), 0.002, 0.05)

    for i in range(3):
        t = tt(0.06)
        kit[f"click-{i}"] = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 220) + 0.4 * np.sin(2 * np.pi * (140 + 30 * i) * t) * np.exp(-t * 120)

    t = tt(0.45)
    grains = (rng.random(len(t)) > 0.985).astype(float) * rng.standard_normal(len(t))
    kit["paper-tear"] = bp(grains * 6 + rng.standard_normal(len(t)) * 0.3, 1800, 6500) * np.exp(-t * 5)

    for i in range(4):
        t = tt(0.07)
        r = np.random.default_rng(40 + i)
        kit[f"key-{i}"] = hp(r.standard_normal(len(t)), 1800) * np.exp(-t * 240) * 0.8 + np.sin(2 * np.pi * (170 + 25 * i) * t) * np.exp(-t * 90) * 0.5
        a = kit[f"key-{i}"]
        cmd = np.zeros(int(0.12 * SR))
        cmd[: len(a)] += a
        cmd[int(0.035 * SR): int(0.035 * SR) + len(a)] += a * 0.8
        kit[f"cmd-tab-{i}"] = lp(cmd, 5000)

    t = tt(1.4)
    kit["breath"] = bp(rng.standard_normal(len(t)), 300, 1400) * np.sin(np.pi * t / 1.4) ** 2

    # Zenboard signature: a rising major second, E5 → F#5 (key of D).
    ch = np.zeros(int(1.8 * SR))
    for f, d in [(midi(76), 0.0), (midi(78), 0.16)]:
        m = mallet(f, 1.5)
        k = int(d * SR)
        ch[k: k + len(m)] += m
    kit["chime"] = ch
    kit["chime-single"] = mallet(midi(78), 1.4)
    cr = np.zeros(int(2.6 * SR))
    for f, d, g in [(midi(76), 0.0, 1), (midi(78), 0.16, 1), (midi(81), 0.5, 0.7), (midi(74), 0.5, 0.5)]:
        m = mallet(f, 2.0) * g
        k = int(d * SR)
        cr[k: k + len(m)] += m
    kit["chime-resolved"] = cr

    # The same eight ticks, now in tune: a rising D-major chord (S10, S16).
    for i, m in enumerate([74, 76, 78, 81, 83, 86, 88, 90]):
        kit[f"tick-tuned-{i}"] = mallet(midi(m), 0.6, 0.2) * 0.8

    t = tt(0.05)
    kit["ui-click"] = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.6 + np.sin(2 * np.pi * 600 * t) * np.exp(-t * 200) * 0.4

    t = tt(0.14)
    kit["snap"] = np.sin(2 * np.pi * (1200 * np.exp(-t * 20) + 400) * t) * np.exp(-t * 40) + 0.3 * hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 200)

    t = tt(0.45)
    kit["thread"] = bp(rng.standard_normal(len(t)), 1500, 6000) * np.sin(np.pi * t / 0.45) ** 2

    t = tt(0.6)
    kit["whoosh-soft"] = bp(rng.standard_normal(len(t)), 400, 2600) * np.sin(np.pi * t / 0.6) ** 2

    for name, sig in kit.items():
        write(os.path.join(out, f"{name}.wav"), sig)
    print(f"wrote {len(kit)} sfx")


# ── Score ───────────────────────────────────────────────────────────────────
def score():
    n = int(TOTAL * SR) + SR
    L, R = np.zeros(n), np.zeros(n)

    def add(sig, t0, gain=1.0, pan=0.5):
        s = int(t0 * SR)
        e = min(n, s + len(sig))
        if e > s:
            L[s:e] += sig[: e - s] * gain * np.sqrt(1 - pan)
            R[s:e] += sig[: e - s] * gain * np.sqrt(pan)

    def piano(m, t0, length, gain, pan=0.5):
        """Felt piano: soft attack, fast-decaying upper harmonics."""
        t = tt(length)
        f = midi(m)
        s = np.zeros(len(t))
        for k in range(1, 8):
            s += (1 / k ** 1.7) * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (0.9 + 0.9 * k))
        add(s * env(len(t), 0.012, 0.4), t0, gain, pan)

    def rhodes(m, t0, gain, pan=0.5):
        t = tt(1.6)
        f = midi(m)
        s = np.sin(2 * np.pi * f * t + 1.4 * np.exp(-t * 5) * np.sin(2 * np.pi * f * t)) * np.exp(-t * 2.2)
        add(s * env(len(t), 0.004, 0.3), t0, gain, pan)

    def pad(notes, t0, length, gain):
        t = tt(length)
        s = np.zeros(len(t))
        for m in notes:
            f = midi(m)
            for det in (-0.12, 0.12):
                s += np.sin(2 * np.pi * f * (1 + det / 100) * t + rng.random() * 6.28)
        s *= env(len(t), min(1.6, length / 3), min(2.0, length / 3)) * (1 + 0.1 * np.sin(2 * np.pi * 0.2 * t))
        add(s / len(notes), t0, gain, 0.4)
        add(s / len(notes), t0 + 0.013, gain, 0.6)

    def brush(t0, gain):
        t = tt(0.3)
        add(hp(rng.standard_normal(len(t)), 2500) * np.sin(np.pi * t / 0.3) ** 3, t0, gain, 0.55)

    # Acts 1–2: room tone only.
    s08 = START["S08"]
    t = tt(START["S05"] + 0.5)
    add(lp(rng.standard_normal(len(t)), 380) * 0.5, 0, 0.05)

    # Act 3: low drone and riser under the switching, cut to silence at S08.
    d0 = START["S05"]
    t = tt(s08 - d0)
    ramp = (t / t[-1]) ** 1.6
    drone = (np.sin(2 * np.pi * 73.42 * t) + 0.7 * np.sin(2 * np.pi * 77.8 * t) + 0.3 * np.sin(2 * np.pi * 146.8 * t))
    drone += 0.6 * lp(rng.standard_normal(len(t)), 220)
    riser = hp(rng.standard_normal(len(t)), 900 + 3000 * ramp) * ramp ** 3 * 0.8
    sweep = np.sin(2 * np.pi * np.cumsum(180 + 700 * ramp ** 2) / SR) * ramp ** 3 * 0.35
    act3 = (drone * (0.06 + 0.5 * ramp) + riser + sweep) * env(len(t), 1.0, 0.004)
    add(act3, d0, 0.14)

    # Act 4: 16 frames of true silence, then one sustained low note as the tiles merge.
    note_at = s08 + 104 * FRAME
    t = tt(START["S09"] - note_at + 0.6)
    low = (np.sin(2 * np.pi * midi(38) * t) + 0.4 * np.sin(2 * np.pi * midi(50) * t)) * env(len(t), 1.2, 0.5)
    add(low, note_at, 0.18)
    t = tt(START["S09"] - s08 - 0.3)
    add(lp(rng.standard_normal(len(t)), 300) * env(len(t), 0.8, 0.3), s08 + 16 * FRAME, 0.02)

    # Acts 5–6: warm, minimal, 90 BPM, in D. Enters on the S09 chime.
    enter = at("S09", 6)
    bar = BEAT * 4
    chords = [
        [50, 62, 66, 69, 76],  # D(add9)
        [47, 59, 62, 66, 69],  # Bm7
        [43, 59, 62, 66, 69],  # Gmaj7(9)
        [45, 57, 62, 64, 69],  # A sus
    ]
    end_s16 = START["S17"]
    k, t0 = 0, enter
    while t0 < end_s16 - 0.1:
        c = chords[k % 4]
        piano(c[0] - 12, t0, bar * 1.3, 0.16, 0.45)
        for j, m in enumerate(c[1:]):
            piano(m, t0 + j * 0.018, bar * 1.2, 0.07, 0.35 + 0.1 * j)
        pad([m + 12 for m in c[1:4]], t0, bar + 1.2, 0.035 if t0 < START["S15"] else 0.06)
        k += 1
        t0 += bar
    # Rhodes 8th-note figure from S10.
    step, i, t0 = BEAT / 2, 0, START["S10"]
    while t0 < end_s16 - 0.2:
        c = chords[int((t0 - enter) // bar) % 4]
        seq = [c[2], c[3], c[4], c[3] + 12, c[4], c[3]]
        rhodes(seq[i % len(seq)] + 12, t0, 0.045, 0.5 + 0.3 * np.sin(i * 0.7))
        t0 += step
        i += 1
    # Light brushed percussion from S13, on beats 2 and 4.
    t0, b = START["S13"], 0
    while t0 < end_s16:
        if b % 2 == 1:
            brush(t0, 0.05)
        t0 += BEAT
        b += 1
    # S16: a rising arpeggio following the thread.
    for j, m in enumerate([62, 66, 69, 74, 78, 81, 86, 90]):
        rhodes(m, START["S16"] + 16 * FRAME + j * 0.2, 0.05, 0.3 + 0.05 * j)
    # Act 6: resolve. G → A → D, then hold D for the end card.
    for c, off in [([43, 59, 62, 67, 71], 0), ([45, 57, 61, 64, 69], bar)]:
        piano(c[0] - 12, START["S17"] + off, bar * 1.3, 0.2)
        for j, m in enumerate(c[1:]):
            piano(m, START["S17"] + off + j * 0.02, bar * 1.2, 0.09, 0.4 + 0.05 * j)
    final = START["S18"] + 8 * FRAME
    for j, m in enumerate([38, 50, 57, 62, 66, 69, 74]):
        piano(m, final + j * 0.03, TOTAL - final + 1.0, 0.13 if j else 0.22, 0.35 + 0.05 * j)
    pad([62, 66, 69, 76], START["S17"], TOTAL - START["S17"], 0.09)
    t = tt(TOTAL - START["S17"])
    add(lp(rng.standard_normal(len(t)), 300) * env(len(t), 1.0, 1.0), START["S17"], 0.02)

    # Duck the music 3dB under the three chimes.
    duck = np.ones(n)
    for t0 in [at("S09", 6), at("S14", 10 + 172), at("S18", 8)]:
        s = int(t0 * SR)
        w = int(1.4 * SR)
        shape = np.concatenate([np.linspace(1, 0.71, int(0.05 * SR)), np.full(w, 0.71), np.linspace(0.71, 1, int(0.5 * SR))])
        e = min(n, s + len(shape))
        duck[s:e] = np.minimum(duck[s:e], shape[: e - s])
    L *= duck
    R *= duck

    # Room: a short cross-feedback delay for the melodic acts only.
    d = int(0.19 * SR)
    m0 = int(START["S09"] * SR)
    for _ in range(3):
        L[m0 + d:] += R[m0: -d] * 0.14
        R[m0 + d:] += L[m0: -d] * 0.14

    # Hard silence at the S08 cut (anything ringing from act 3 stops dead).
    a, b = int(s08 * SR), int((s08 + 16 * FRAME) * SR)
    L[a:b] = 0
    R[a:b] = 0

    mix = np.stack([L, R], axis=1)[: int(TOTAL * SR)]
    tail = int(1.5 * SR)
    mix[-tail:] *= np.linspace(1, 0, tail)[:, None]
    write(os.path.join(ROOT, "public/audio/score.wav"), mix, peak=0.7)
    print(f"wrote score.wav ({TOTAL:.2f}s)")


if __name__ == "__main__":
    sfx()
    score()
