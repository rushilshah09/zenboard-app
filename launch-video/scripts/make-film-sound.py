"""Score and sound design for the launch film, synthesised from scratch
(numpy only; original, royalty-free). DIRECTION_V3.md §6, cue by cue, placed on
the frames the picture uses. The voice-over is separate (public/audio/vo, placed
by src/timeline/film.ts); this bus ducks under it.

    python3 scripts/make-film-sound.py
Writes public/audio/film-score.wav (48 kHz stereo). Loudness is set on the master.

Sections (seconds):
  0-10     Noise: pulse only, accelerating; a tick per decode; pings stacking
           under the pills; keyboard clatter under the wall; riser into the slam
  10-16    Collapse: hard cut to silence; a reversed swell sucking inward; a
           deep warm tone and the chime on the orb; the chime tail on the mark
  16-24    Reveal: one amplified click; a long rising air tone; music enters
           on the tilt (20.5)
  24-54    Arc, Graph, Orbit: warm building groove; a soft tick per dial step,
           a rising tone per node, the chime on Paid, a low impact on
           "Everything connects"; the three-note motif on Work/Life/Business
  54-61    Flow: tight and percussive, a crisp click on every morph
  61-65.5  One: thins to a held chord; a soft inhale as the rows converge
  65.5-    the construction sheet: pencil, mallets, taps, riser, the chime
           resolving on the lockup, the held final chord
"""
import json
import os
import re
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = open(os.path.join(ROOT, "src/timeline/film.ts")).read()
DUR = float(re.search(r"FILM_FRAMES = sec\(([\d.]+)\)", FILM).group(1))
N = int(DUR * SR)
BEAT = 0.5
rng = np.random.default_rng(21)

VO = [(k, float(t)) for k, t in re.findall(r'\["([\w-]+)", ([\d.]+)\]', FILM)]
VO_DUR = {k: v["dur"] for k, v in json.load(open(os.path.join(ROOT, "public/audio/vo/lines.json"))).items()}
vo_t = dict(VO)


def scene(name):
    m = re.search(name + r": \{ from: ([\d.]+), to: ([\d.]+) \}", FILM)
    return float(m.group(1)), float(m.group(2))


def fr(scene_name, frame):
    return scene(scene_name)[0] + frame / 60


# ── DSP ───────────────────────────────────────────────────────────────────
def t_(sec):
    return np.arange(max(1, int(sec * SR))) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def spec_filter(x, fn):
    n = len(x)
    k = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, k)
    f = np.fft.rfftfreq(k, 1 / SR)
    return np.fft.irfft(X * fn(f), k)[:n]


def lp(x, fc, order=4):
    return spec_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** order))


def hp(x, fc, order=4):
    return spec_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** order))


def bp(x, lo, hi):
    return hp(lp(x, hi), lo)


def sweep_lp(x, c0, c1):
    """One-pole lowpass with a cutoff sweeping from c0 to c1 (per-sample loop; use on short signals)."""
    c = np.geomspace(c0, c1, len(x))
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def env(n, a=0.005, r=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))


def plus(*sigs):
    """Sum signals of different lengths (zero-padded)."""
    n = max(len(x) for x in sigs)
    out = np.zeros(n)
    for x in sigs:
        out[: len(x)] += x
    return out


def noise(sec):
    return rng.standard_normal(max(1, int(sec * SR)))


class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= N or i < 0:
            return
        sig = sig[: N - i]
        p = np.asarray(pan, dtype=float)
        p = np.full(len(sig), float(p)) if p.ndim == 0 else p[: len(sig)]
        th = (p + 1) * np.pi / 4
        self.L[i : i + len(sig)] += sig * np.cos(th) * gain
        self.R[i : i + len(sig)] += sig * np.sin(th) * gain


def reverb(x, secs=2.6, seed=3):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-6.0 * np.arange(n) / n)
    ir = lp(ir, 5200)
    ir[: int(0.015 * SR)] = 0
    ir /= np.sqrt(np.sum(ir**2))
    m = len(x) + n
    k = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, k) * np.fft.rfft(ir, k), k)[: len(x)]


# ── Voices ────────────────────────────────────────────────────────────────
def pad(notes, sec, bright=1400, detune=(-0.07, 0, 0.06)):
    t = t_(sec)
    s = np.zeros_like(t)
    for m in notes:
        for d in detune:
            ff = midi(m) * 2 ** (d / 12)
            ph = rng.uniform(0, 2 * np.pi)
            for h in range(1, 6):
                s += np.sin(2 * np.pi * ff * h * t + ph * h) / h**1.5
    s = lp(s, bright)
    return s / (len(notes) * 6)


def mallet(f, sec=1.4, bright=0.3):
    t = t_(sec)
    s = np.sin(2 * np.pi * f * t) + bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-9 * t) + 0.12 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-14 * t)
    return s * env(len(t), 0.003, 0.45)


def bell(f, sec=4.0):
    t = t_(sec)
    parts = [(1, 1.0, 0.9), (2.0, 0.5, 1.4), (2.76, 0.35, 2.2), (5.4, 0.18, 3.5), (8.9, 0.08, 5.0)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-d * t) for r, a, d in parts) * np.minimum(1, t / 0.002)


def chime(sec=4.0):
    """The Zenboard chime: a rising major second on a glass tone (D6 → E6)."""
    s = np.zeros(int(sec * SR))
    a = bell(midi(86), sec)
    b = bell(midi(88), sec - 0.16)
    s += a
    s[int(0.16 * SR) :] += 0.9 * b
    return s


def kick(sec=0.5, f0=55, bend=60):
    t = t_(sec)
    return np.sin(2 * np.pi * (f0 * t + bend * (1 - np.exp(-30 * t)) / 30)) * np.exp(-7 * t)


def snap(sec=0.25):
    n = bp(noise(sec), 1500, 6000)
    return n * env(len(n), 0.001, 0.05)


def hat(sec=0.08):
    n = hp(noise(sec), 7000)
    return n * env(len(n), 0.001, 0.018)


def tick(freq=2600, sec=0.09):
    t = t_(sec)
    return (np.sin(2 * np.pi * freq * t) * 0.6 + hp(noise(sec), 4000) * 0.4) * np.exp(-70 * t)


def ping(freq, sec=0.5):
    t = t_(sec)
    return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)) * env(len(t), 0.002, 0.12)


def whoosh(sec=0.8, lo=300, hi=4000):
    n = noise(sec)
    s = sweep_lp(n, lo, hi) * np.sin(np.pi * np.linspace(0, 1, len(n))) ** 2
    return s


def riser(sec, lo=200, hi=7000):
    n = noise(sec)
    ramp = np.linspace(0, 1, len(n)) ** 2.2
    return sweep_lp(n, lo, hi) * ramp


def thump(sec=1.4, f=44):
    t = t_(sec)
    return np.sin(2 * np.pi * (f * t + 30 * (1 - np.exp(-18 * t)) / 18)) * np.exp(-3.2 * t)


# Harmony: D major world. Each chord lasts 2 bars (4 s).
PROG = [
    [50, 57, 61, 64, 66],  # Dmaj9
    [47, 54, 57, 61, 62],  # Bm11
    [43, 50, 54, 57, 62],  # Gmaj7(9)
    [45, 52, 57, 59, 64],  # A6sus
]
BASS = [38, 35, 31, 33]


def build():
    music = Bus()
    sfx = Bus()
    wet = Bus()

    # ── 1 · Noise (0-10): pulse only, accelerating ──────────────────────
    n0, n1 = scene("noise")
    t = 0.0
    while t < n1 - 0.05:
        step = BEAT if t < 4 else BEAT / 2 if t < 7 else BEAT / 4
        g = 0.3 + 0.5 * (t / 10)
        music.add(kick(min(0.4, step * 1.6), 48, 40), t, g * (step / BEAT) ** 0.6)
        if t >= 2:
            music.add(hat(), t + step / 2, 0.08 + 0.06 * t / 10, pan=0.3)
        t += step
    for fr_ in [8, 58, 98, 130, 156, 176, 192]:  # decode ticks
        sfx.add(tick(2600 + fr_ * 4), fr("noise", fr_), 0.22)
        for k in range(6):
            sfx.add(tick(3400, 0.03), fr("noise", fr_) + 0.02 * k, 0.05, pan=rng.uniform(-0.5, 0.5))
    # Pings stacking under the pills (3.6-7): density rises.
    for k in range(70):
        at = 3.6 + 3.3 * (k / 70) ** 0.7
        sfx.add(ping(midi(rng.choice([79, 83, 86, 88, 90, 91]))), at, 0.05, pan=rng.uniform(-0.8, 0.8))
    for at in [3.7, 4.6, 5.3, 5.9, 6.4]:
        sfx.add(whoosh(0.7, 400, 5000), at, 0.12, pan=rng.uniform(-0.6, 0.6))
    # Keyboard clatter under the switch wall (7-9).
    t = 7.0
    while t < 9.0:
        sfx.add(hp(noise(0.03), 2500) * env(int(0.03 * SR), 0.001, 0.008), t, 0.16, pan=rng.uniform(-0.6, 0.6))
        t += rng.uniform(0.025, 0.07) * (1.2 - (t - 7) / 2.5)
    music.add(pad([62, 63], 2.0, 900) * np.linspace(0, 1, int(2.0 * SR)), 7.0, 0.35)  # tension cluster
    # Riser into the slam (9.0), the impact, and the fly-through.
    sfx.add(riser(1.5, 200, 8000), 7.5, 0.35)
    sfx.add(thump(1.2, 40), 9.0, 0.9)
    sfx.add(bp(noise(0.5), 200, 3000) * env(int(0.5 * SR), 0.002, 0.12), 9.0, 0.35)
    sfx.add(whoosh(0.7, 800, 9000), 9.45, 0.35)

    # ── 2 · Collapse (10-16): silence, the pull inward, the orb ─────────
    c0, _ = scene("collapse")
    sw = riser(fr("collapse", 190) - fr("collapse", 70), 150, 3000)
    rb = bell(midi(74), len(sw) / SR)[::-1] * np.linspace(0, 1, len(sw)) ** 2
    sfx.add(sw, fr("collapse", 70), 0.25)
    wet.add(rb, fr("collapse", 70), 0.12)
    tone = pad([38, 45, 50], 5.0, 700) * env(int(5 * SR), 0.4, 2.2)
    music.add(tone, fr("collapse", 170), 0.9)
    sfx.add(thump(2.0, 36), fr("collapse", 170), 0.45)
    wet.add(chime(), fr("collapse", 172), 0.35)
    sfx.add(chime(), fr("collapse", 172), 0.18)
    wet.add(mallet(midi(74), 3.0), fr("collapse", 250), 0.18)

    # ── 3 · Reveal (16-24) ────────────────────────────────────────────
    click = plus(hp(noise(0.05), 1200) * env(int(0.05 * SR), 0.0005, 0.008), thump(0.3, 90) * 0.6)
    sfx.add(click, fr("reveal", 46), 0.7)
    wet.add(click, fr("reveal", 46), 0.3)
    air = bp(noise(4.2), 600, 5000) * np.linspace(0, 1, int(4.2 * SR)) ** 1.5
    sfx.add(air, fr("reveal", 80), 0.05)

    # ── Groove (20.5-61): the film's music, building ─────────────────
    g0 = 20.5
    g1 = scene("flow")[1]
    bars = int(np.ceil((g1 - g0) / 2))
    for b in range(bars):
        tb = g0 + b * 2.0
        ch = (b // 2) % 4
        intensity = min(1.0, 0.45 + 0.55 * (tb - g0) / (scene("orbit")[0] - g0))
        if tb >= scene("flow")[0]:
            intensity = 1.0
        # Pad chord across the bar.
        if b % 2 == 0:
            music.add(pad(PROG[ch], 4.0, 1300 + 900 * intensity) * env(int(4.0 * SR), 0.25, 3.0), tb, 0.55)
        for k in range(4):
            tt = tb + k * BEAT
            if tt >= g1:
                break
            if k in (0, 2):
                music.add(kick(0.45, 52, 50), tt, 0.5 * intensity)
            if k in (1, 3) and tb >= 24:
                music.add(snap(), tt, 0.16 * intensity, pan=0.1)
            for h in (0, 1):
                music.add(hat(), tt + h * BEAT / 2, 0.05 + 0.04 * intensity, pan=-0.3 if h else 0.3)
            # Bass on the beat, octave bounce on the offbeat.
            m = BASS[ch]
            bl = t_(0.42)
            bass = (np.sin(2 * np.pi * midi(m) * bl) + 0.3 * np.sin(2 * np.pi * midi(m) * 2 * bl)) * env(len(bl), 0.004, 0.2)
            music.add(bass, tt, 0.32 * intensity)
        # Pluck arpeggio from the Graph onward.
        if tb >= scene("graph")[0]:
            arp = PROG[ch][2:] + [PROG[ch][2] + 12]
            for k in range(8):
                tt = tb + k * BEAT / 2
                if tt < g1:
                    wet.add(mallet(midi(arp[k % len(arp)] + 12), 0.8, 0.25), tt, 0.05 * intensity, pan=0.4 * np.sin(k))
        # Orbit opens up: a high sustained layer.
        if scene("orbit")[0] <= tb < scene("orbit")[1]:
            wet.add(pad([m + 24 for m in PROG[ch][2:]], 2.2, 3500) * env(int(2.2 * SR), 0.5, 1.5), tb, 0.25)

    # ── Arc: a soft tick per dial step ───────────────────────────────
    for k in ["arc-calendar", "arc-docs", "arc-clients", "arc-money"]:
        sfx.add(tick(1800, 0.12), vo_t[k] - 8 / 60, 0.25)
        sfx.add(whoosh(0.35, 800, 5000), vo_t[k] - 0.2, 0.06)
    # ── Graph: a line hum while drawing, a rising tone per node ──────
    notes = [74, 76, 78, 81, 83, 86]
    for i, k in enumerate(["g-task", "g-project", "g-calendar", "g-doc", "g-client", "g-paid"]):
        at = vo_t[k]
        if i:
            hum = np.sin(2 * np.pi * 110 * t_(0.35)) * np.sin(np.pi * np.linspace(0, 1, int(0.35 * SR))) + 0.2 * bp(noise(0.35), 2000, 6000)
            sfx.add(hum, at - 22 / 60, 0.05)
        wet.add(mallet(midi(notes[i]), 1.4, 0.35), at, 0.14, pan=-0.3 + 0.12 * i)
    paid = vo_t["g-paid"] + 24 / 60
    wet.add(chime(3.5), paid, 0.3)
    sfx.add(chime(3.5), paid, 0.14)
    sfx.add(whoosh(0.5, 1200, 8000)[::-1], paid + 0.1, 0.12)
    con = vo_t["connects"]
    sfx.add(riser(1.4, 150, 5000), con - 1.4, 0.2)
    sfx.add(thump(1.6, 38), con - 4 / 60, 0.8)
    # ── Orbit: airy transition, the three-note motif, the spin ──────
    o0, _ = scene("orbit")
    sfx.add(bp(noise(1.2), 1500, 9000) * np.sin(np.pi * np.linspace(0, 1, int(1.2 * SR))) ** 2, o0 - 0.2, 0.12)
    for k, m in [("work", 74), ("life", 78), ("business", 81)]:
        wet.add(bell(midi(m), 3.0), vo_t[k], 0.16)
        sfx.add(mallet(midi(m), 1.5, 0.35), vo_t[k], 0.1)
    sfx.add(whoosh(0.9, 500, 7000), fr("orbit", 420), 0.28)
    # ── Flow: a crisp click on every morph, on the beat ─────────────
    for m_at in [36, 96, 156, 216, 276]:
        land = fr("flow", m_at + 24)
        c = plus(hp(noise(0.04), 3000) * env(int(0.04 * SR), 0.0005, 0.006), tick(3200, 0.05) * 0.5)
        sfx.add(c, land, 0.55, pan=0.15)
        sfx.add(whoosh(0.3, 1500, 9000), fr("flow", m_at), 0.08)
    sfx.add(plus(thump(0.8, 60) * 0.5, mallet(midi(86), 1.2) * 0.4), fr("flow", 326), 0.45)

    # ── 7 · One (61-65.5): held chord, a soft inhale ─────────────────
    h0, h1 = scene("one")
    held = pad(PROG[0], (h1 - h0) + 0.8, 1000) * env(int(((h1 - h0) + 0.8) * SR), 0.6, 3.2)
    music.add(held, h0, 0.55)
    inhale = bp(noise(1.4), 400, 3000) * np.linspace(0, 1, int(1.4 * SR)) ** 2
    sfx.add(inhale, fr("one", 110), 0.08)
    sfx.add(thump(1.2, 34) * 0.6, fr("one", 222), 0.4)

    # ── Outro (65.5-75.5): the construction sheet ────────────────────
    u0, u1 = scene("outro")
    ot = lambda frame: u0 + frame / 60  # noqa: E731
    final = pad([38, 45, 54, 61, 64], (u1 - u0), 1100)
    shape = np.clip(t_(u1 - u0) / 1.4, 0, 1) ** 2 * np.clip(((u1 - u0) - t_(u1 - u0)) / 1.6, 0, 1)
    music.add(final * shape, u0, 0.6)
    for f0, pan in [(10, -0.5), (18, 0.5), (26, -0.2), (34, 0.3)]:  # pencil
        nn = bp(noise(0.9), 2500, 7000) * np.sin(np.pi * np.linspace(0, 1, int(0.9 * SR))) ** 1.5
        sfx.add(nn, ot(f0), 0.035, pan=pan)
    for i, m in enumerate([74, 78, 81, 85]):  # lobe circles
        s = mallet(midi(m))
        sfx.add(s, ot(30 + i * 8), 0.09, pan=[-0.4, 0.4, -0.4, 0.4][i])
        wet.add(s, ot(30 + i * 8), 0.09)
    for f0, m, pan in [(120, 93, -0.6), (132, 97, 0.6), (150, 90, -0.6)]:  # diagrams and notes arriving
        tl = t_(0.5)
        s = np.sin(2 * np.pi * midi(m) * tl) * np.exp(-18 * tl)
        sfx.add(s, ot(f0), 0.06, pan=pan)
        wet.add(s, ot(f0), 0.05, pan=pan)
    sfx.add(riser(40 / 60, 300, 6000), ot(200), 0.14)
    wet.add(chime(4.5), ot(240), 0.34)
    sfx.add(chime(4.5), ot(240), 0.16)
    sfx.add(thump(1.2, 48), ot(240), 0.35)
    for i in range(4):  # handle snaps
        sfx.add(hp(noise(0.05), 5000) * env(int(0.05 * SR), 0.0005, 0.004), ot(240) + 0.018 * i, 0.05, pan=[-0.6, 0.6, -0.6, 0.6][i])
    wet.add(mallet(midi(81), 2.5, 0.2) + mallet(midi(86), 2.5, 0.2) * 0.6, ot(505), 0.1)  # Available today

    # ── Mix ─────────────────────────────────────────────────────────
    # Duck the music under the voice (−7 dB, 80 ms attack, 350 ms release).
    duck = np.ones(N)
    for k, at in VO:
        a = int((at - 0.08) * SR)
        b = int((at + VO_DUR.get(k, 1.0) + 0.1) * SR)
        duck[max(0, a) : min(N, b)] = 0.45
    kern = np.hanning(int(0.35 * SR))
    kern /= kern.sum()
    duck = np.convolve(duck, kern, mode="same")
    # Hard silence at the freeze (10.0 → the orb).
    gate = np.ones(N)
    gate[int(c0 * SR) : int((c0 + 1.15) * SR)] = 0.0
    ramp = int(0.01 * SR)
    gate[int(c0 * SR) - ramp : int(c0 * SR)] = np.linspace(1, 0, ramp)
    L = (music.L * duck + sfx.L) * gate + reverb(wet.L + 0.2 * music.L, seed=3) * 0.8
    R = (music.R * duck + sfx.R) * gate + reverb(wet.R + 0.2 * music.R, seed=4) * 0.8
    L, R = hp(L, 30), hp(R, 30)
    out = np.stack([L, R], 1)
    fade = np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)
    out *= fade[:, None]
    out /= np.max(np.abs(out)) / 0.7  # headroom for the VO on top
    return out


def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    write(os.path.join(ROOT, "public/audio/film-score.wav"), build())
    print(f"wrote public/audio/film-score.wav ({DUR}s)")
