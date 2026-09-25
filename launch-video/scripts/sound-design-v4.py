#!/usr/bin/env python3
"""
v4 sound design: an original, energetic 120 BPM score and motion-matched SFX, synthesised deterministically,
plus the voice-over stem and the final mix.

Every cue comes from the film's motion: scene start + frame / 60 (see the scene files in src/v4). Slides and
whooshes last exactly as long as the move they belong to and pan with it on screen (-1 left … +1 right).

Writes public/audio/v4/{music,sfx,vo,mix}.wav (48 kHz, 24-bit). The stems sum to the mix before the master
limiter, so an editor can rebalance them.

    python3 scripts/sound-design-v4.py
"""
import math
import pathlib
import re

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/v4"
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000
DUR = 73.5
N = int(SR * DUR)
rng = np.random.default_rng(20260925)


# ---------------------------------------------------------------- basics
def T(n):
    return np.arange(n) / SR


def noise(d):
    return rng.standard_normal(max(1, int(d * SR)))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype=kind, fs=SR, output="sos"), x, axis=0)


def smooth(u):  # ease in-out on 0..1
    return u * u * (3 - 2 * u)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, y, t, gain=1.0, pan=0.0):
        """y: mono (n,) or stereo (n, 2). pan: -1..1, a number or an array per sample (equal power)."""
        i0 = int(round(t * SR))
        if i0 >= N or len(y) == 0:
            return
        if y.ndim == 1:
            p = np.clip(np.broadcast_to(np.asarray(pan, float), y.shape), -1, 1)
            th = (p + 1) * np.pi / 4
            y = np.stack([y * np.cos(th), y * np.sin(th)], 1) * math.sqrt(2)
        if i0 < 0:
            y, i0 = y[-i0:], 0
        n = min(len(y), N - i0)
        self.x[i0:i0 + n] += gain * y[:n]


def saw(freq, n, phase=0.0):
    """PolyBLEP band-limited saw; freq may be an array (glides)."""
    f = np.full(n, float(freq)) if np.ndim(freq) == 0 else np.asarray(freq, float)
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    tt = ph[m] / dt[m]
    y[m] -= tt + tt - tt * tt - 1
    m = ph > 1 - dt
    tt = (ph[m] - 1) / dt[m]
    y[m] -= tt * tt + tt + tt + 1
    return y


def svf(x, fc, q=1.4):
    """Chamberlin state-variable band-pass with a per-sample cutoff (for sweeps)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    F = 2 * np.sin(np.pi * np.minimum(fc, SR / 6.5) / SR)
    Q = 1.0 / q
    low = band = 0.0
    out = np.empty_like(x)
    for i in range(len(x)):
        high = x[i] - low - Q * band
        band += F[i] * high
        low += F[i] * band
        out[i] = band
    return out


# ---------------------------------------------------------------- instruments
def kick(g=1.0):
    d = 0.5
    t = T(int(d * SR))
    f = 44 + 120 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) * (1 - np.exp(-t * 3000))
    click = filt(noise(d), "highpass", 2500) * np.exp(-t * 350) * 0.25
    return np.tanh(1.6 * (body + click)) * 0.9 * g


def clap(g=1.0):
    d = 0.5
    n = int(d * SR)
    t = T(n)
    nz = filt(noise(d), "bandpass", [900, 4200])
    x = np.zeros(n)
    for k, o in enumerate((0, 0.011, 0.023)):
        i = int(o * SR)
        x[i:] += nz[i:] * np.exp(-t[: n - i] / (0.008 if k < 2 else 0.17)) * (0.8 if k < 2 else 1)
    return x * 0.5 * g


def snare(g=1.0):
    d = 0.3
    t = T(int(d * SR))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    nz = filt(noise(d), "bandpass", [1500, 7000]) * np.exp(-t * 18)
    return (tone + nz) * 0.45 * g


def hat(open_=False, g=1.0):
    d = 0.4 if open_ else 0.07
    t = T(int(d * SR))
    return filt(noise(d), "highpass", 7500, 4) * np.exp(-t * (8 if open_ else 55)) * 0.32 * g


def crash(g=1.0):
    d = 2.4
    t = T(int(d * SR))
    x = filt(noise(d), "highpass", 4500, 2) * np.exp(-t * 1.9) * (1 - np.exp(-t * 400))
    return np.stack([x, filt(noise(d), "highpass", 4500, 2) * np.exp(-t * 1.9)], 1) * 0.22 * g


def bass(m, d, cut=520, g=1.0):
    n = int((d + 0.04) * SR)
    t = T(n)
    f = mtof(m)
    y = 0.6 * saw(f, n) + 0.8 * np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / 0.004) * np.where(t < d, np.exp(-t * 2.2), np.exp(-d * 2.2) * np.exp(-(t - d) / 0.012))
    return np.tanh(1.3 * filt(y, "lowpass", cut) * env) * 0.5 * g


def pluck(m, d=0.3, bright=1.0, g=1.0):
    n = int((d + 0.35) * SR)
    t = T(n)
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 2 * t) * 2.2 * bright * np.exp(-t * 14)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 7) * np.minimum(1, t / 0.002) * 0.3 * g


def bell(m, d=3.0, g=1.0):
    n = int(d * SR)
    t = T(n)
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 3.0 * np.exp(-t * 3)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.5) * np.minimum(1, t / 0.003) * 0.28 * g


def pad(notes, d, cutoff=1500, a=0.35, r=0.9, g=1.0):
    n = int((d + r) * SR)
    t = T(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        for cents, pn in ((-9, -0.75), (0, 0.0), (9, 0.75)):
            y = saw(mtof(m) * 2 ** (cents / 1200), n, rng.random())
            th = (pn + 1) * np.pi / 4
            L += y * np.cos(th)
            R += y * np.sin(th)
    env = np.minimum(1, t / a) * np.where(t < d, 1.0, np.exp(-(t - d) / (r / 3)))
    x = np.stack([L, R], 1) * env[:, None] / (len(notes) * 2.2)
    return filt(x, "lowpass", cutoff, 2) * g


# ---------------------------------------------------------------- sfx
def whoosh(d, f0, f1, pan0=0.0, pan1=0.0, peak=0.6, q=1.3, g=1.0):
    """A noise swish whose band sweeps f0→f1 over exactly the move's duration and pans with it."""
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** smooth(u)
    x = svf(noise(d), fc, q) * 0.6 + filt(noise(d), "highpass", 5000) * 0.08
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.28  # same loudness whatever the band
    x = np.tanh(x * 1.5) / 1.5
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.6)
    pan = pan0 + (pan1 - pan0) * smooth(u)
    return x * env * g, pan


def riser(d, m0=48, g=1.0):
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    nz = svf(noise(d), 300 * (8000 / 300) ** u, 1.8)
    tone = saw(mtof(m0) * 2 ** (u * 1.0), n) * 0.25
    tone = filt(tone, "lowpass", 3000)
    env = (u ** 2.2) * (1 - np.exp(-(1 - u) * 400))  # swells, then stops exactly on the hit
    return (nz * 0.8 + tone) * env * 0.5 * g


def swell(d, g=1.0):
    """Reverse-cymbal swell that lands on its end time."""
    n = int(d * SR)
    t = T(n)
    x = filt(noise(d), "highpass", 2500) * np.exp((t - d) / (d * 0.35))
    return x * (1 - np.exp(-(d - t) * 500)) * 0.35 * g


def impact(g=1.0, sub=True):
    d = 1.8
    t = T(int(d * SR))
    f = 30 + 35 * np.exp(-t * 3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * (1.0 if sub else 0.4)
    body = filt(noise(d), "lowpass", 1800) * np.exp(-t * 9) * 0.6
    return np.tanh((s + body) * 1.4) * 0.7 * g


def tink(f=2600, g=1.0):
    d = 0.6
    t = T(int(d * SR))
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 8)) * np.exp(-t * 7) * 0.22 * g


def pop(f0=380, f1=900, g=1.0):
    d = 0.12
    t = T(int(d * SR))
    f = f0 + (f1 - f0) * (1 - np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * np.minimum(1, t / 0.002) * 0.35 * g


def tick(f=1900, g=1.0):
    d = 0.06
    t = T(int(d * SR))
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 90) + filt(noise(d), "highpass", 4000) * np.exp(-t * 400) * 0.3) * 0.3 * g


def click(g=1.0):
    d = 0.08
    t = T(int(d * SR))
    body = np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 110)
    snap = filt(noise(d), "bandpass", [2500, 9000]) * np.exp(-t * 700)
    thump = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 60) * 0.6
    return (body * 0.5 + snap + thump) * 0.4 * g


def key(g=1.0):
    d = 0.025
    t = T(int(d * SR))
    return filt(noise(d), "bandpass", [1800, 6500]) * np.exp(-t * 260) * 0.35 * g * (0.7 + 0.6 * rng.random())


def whirr(d, rate0, rate1, f0, f1, g=1.0):
    """Rotation flutter: the band of air pulses once per passing element, rate eased rate0→rate1."""
    n = int(d * SR)
    u = np.linspace(0, 1, n)
    rate = rate0 + (rate1 - rate0) * smooth(u)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    x = svf(noise(d), f0 * (f1 / f0) ** u, 2.0) * am
    env = np.minimum(1, u / 0.15) * np.minimum(1, (1 - u) / 0.12)
    return x * env * 0.5 * g


def chime(notes=(84, 88), g=1.0):
    out = np.zeros(int(1.6 * SR))
    for k, m in enumerate(notes):
        b = bell(m, 1.6 - k * 0.08, 0.6)
        i = int(k * 0.08 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out * g


# ---------------------------------------------------------------- reverb
def reverb(x, secs=2.0, lp=6500):
    n = int(secs * SR)
    t = T(n)
    irs = []
    for _ in range(2):
        ir = filt(rng.standard_normal(n) * np.exp(-t * 5.0 / secs), "lowpass", lp)
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack([signal.fftconvolve(x[:, c], irs[c])[: len(x)] for c in range(2)], 1)


# ================================================================ the score (120 BPM, Ab major / F minor)
PROG = [([53, 56, 60], 41), ([49, 53, 56], 37), ([51, 56, 60], 44), ([51, 55, 58], 39)]  # Fm · Db · Ab/Eb · Eb


def chord_at(t):
    return PROG[int(t // 2) % 4]


def grid(a, b, step, off=0.0):
    k = math.ceil((a - off) / step - 1e-9)
    out = []
    t = k * step + off
    while t < b - 1e-9:
        out.append(round(t, 4))
        t += step
    return out


drums = Bus()
synth = Bus()
hits = Bus()  # risers, impacts, crashes (not sidechained)
kicks = []


def lvl(t, pts):
    """Piecewise-linear level over time from [(t, v), ...]."""
    xs, vs = zip(*pts)
    return float(np.interp(t, xs, vs))


# -- kick: four on the floor where the film drives
for a, b, g0, g1 in [(2.0, 9.5, 0.45, 0.85), (16.5, 22.5, 0.95, 0.95), (23.5, 41.5, 0.95, 0.95),
                     (44.83, 51.0, 1.0, 1.0), (60.0, 64.3, 0.55, 0.7), (64.9, 67.3, 0.8, 1.0)]:
    for t in grid(a, b, 0.5):
        g = g0 + (g1 - g0) * (t - a) / max(0.01, b - a)
        drums.add(kick(g), t)
        kicks.append(t)
for t in (14.7, 16.5, 23.5, 29.5, 44.83, 47.5, 52.5, 53.83, 55.33, 56.83, 67.3, 68.97):
    if t not in kicks:
        drums.add(kick(1.0), t)
        kicks.append(t)

# -- claps on 2 and 4 (and big half-time claps on the carousel steps)
for a, b in [(16.5, 22.5), (23.5, 41.5), (44.83, 51.0), (64.9, 67.3)]:
    for t in grid(a, b, 1.0, 0.5):
        drums.add(clap(0.85), t)
for t in (14.7, 53.83, 55.33, 56.83, 67.3):
    drums.add(clap(1.1), t)

# -- hats: 8ths, then 16ths where the energy peaks; open hats on the off-beats
for a, b, step, g in [(4.0, 9.6, 0.25, 0.7), (11.0, 12.35, 0.125, 0.55), (14.7, 16.5, 0.25, 0.45), (16.5, 29.5, 0.25, 0.8),
                      (29.5, 41.5, 0.125, 0.7), (41.6, 44.2, 0.25, 0.35), (44.83, 51.0, 0.125, 0.8), (59.5, 64.3, 0.25, 0.5),
                      (64.9, 67.3, 0.125, 0.75)]:
    for k, t in enumerate(grid(a, b, step)):
        drums.add(hat(False, g * (1.0 if k % 2 == 0 else 0.62)), t, pan=0.25 if k % 2 else -0.1)
for a, b in [(16.5, 22.5), (29.5, 41.5), (47.5, 51.0)]:
    for t in grid(a, b, 0.5, 0.25):
        drums.add(hat(True, 0.55), t, pan=0.3)

# -- snare rolls that accelerate into the big moments
for a, b in [(9.75, 10.8), (22.5, 23.5), (46.9, 47.5), (66.3, 67.3)]:
    t = a
    while t < b - 0.02:
        u = (t - a) / (b - a)
        drums.add(snare(0.25 + 0.9 * u ** 1.5), t, pan=-0.15)
        t += 0.25 * (1 - u) + 0.045

# -- bass: 8ths, root of the chord, pumping under the kick
for a, b, step, cut in [(4.4, 9.5, 0.25, 420), (16.5, 22.5, 0.25, 600), (23.5, 41.5, 0.25, 650), (44.83, 51.0, 0.25, 700),
                        (59.5, 64.3, 0.5, 450), (64.9, 67.3, 0.25, 650)]:
    for k, t in enumerate(grid(a, b, step)):
        _, root = chord_at(t)
        oct_ = 12 if (k % 4 == 3 and a >= 44) else 0
        synth.add(bass(root + oct_, step * 0.85, cut), t)
synth.add(bass(41, 1.8, 380, 1.2), 14.7)
synth.add(bass(44, 3.5, 380, 1.1), 68.97)

# -- arps: 16th plucks on the chord tones, brighter as the film builds
for a, b, step, g0, g1, br in [(6.0, 9.8, 0.125, 0.25, 0.7, 0.8), (11.0, 12.35, 0.0625, 0.25, 0.6, 1.3), (16.5, 23.5, 0.125, 0.45, 0.55, 1.0),
                               (41.6, 44.3, 0.25, 0.3, 0.45, 0.6), (59.5, 64.3, 0.125, 0.3, 0.45, 0.9), (64.9, 67.3, 0.0625, 0.35, 0.75, 1.3)]:
    for k, t in enumerate(grid(a, b, step)):
        notes, _ = chord_at(t)
        seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24]
        g = g0 + (g1 - g0) * (t - a) / (b - a)
        synth.add(pluck(seq[k % 4], step * 1.6, br, g), t, pan=[-0.4, 0.4, -0.2, 0.2][k % 4])

# -- features: a lead motif lands on every step of the list (1.5s = three beats)
MOTIF = [72, 75, 77, 80, 79, 77, 75, 84]
for k in range(8):
    t = 29.5 + 1.5 * k
    synth.add(pluck(MOTIF[k], 0.6, 1.4, 0.75), t, pan=0.15)
    synth.add(pluck(MOTIF[k] + 7, 0.5, 1.0, 0.35), t + 0.25, pan=-0.2)
    for tt in (t + 0.75,):
        synth.add(pluck(MOTIF[k] - 5, 0.4, 0.8, 0.3), tt, pan=0.35)

# -- pads, section by section (level, brightness)
PADS = [(0.0, 10.8, 0.5, 900), (12.35, 16.5, 0.75, 2400), (16.5, 29.5, 0.45, 1500), (29.5, 41.5, 0.42, 1700),
        (41.5, 44.4, 0.6, 1100), (44.83, 52.4, 0.45, 1700), (52.5, 59.5, 0.8, 900), (59.5, 68.97, 0.55, 2000)]
for a, b, g, cut in PADS:
    t = a
    while t < b - 0.05:
        seg_end = min(b, (math.floor(t / 2) + 1) * 2)
        notes, _ = chord_at(t)
        voicing = notes + [notes[0] + 12] if cut > 1500 else notes
        synth.add(pad(voicing, seg_end - t + 0.05, cut, 0.25 if t > a else 0.6, 0.5, g), t)
        t = seg_end
# the final chord: Ab major add9, held to the end
synth.add(pad([44 + 12, 48 + 12, 51 + 12, 58 + 12, 56 + 12], DUR - 68.97, 2600, 0.08, 1.2, 0.9), 68.97)

# -- musical hits: stabs and bells on the reveals
for t, notes, g in [(12.35, [68, 72, 75, 82], 0.9), (14.7, [65, 68, 72, 77], 0.9), (68.97, [68, 72, 75, 80, 87], 1.0), (67.3, [65, 68, 72], 0.7)]:
    for k, m in enumerate(notes):
        synth.add(bell(m, 3.5, g * 0.8), t + k * 0.012, pan=(k - len(notes) / 2) * 0.2)
for t in (53.83, 55.33, 56.83):
    notes, _ = chord_at(t)
    synth.add(pad([n + 12 for n in notes], 1.3, 2600, 0.01, 0.5, 0.7), t)

# -- risers, swells, impacts, crashes (the film's structure)
for a, b, m0, g in [(8.0, 10.8, 43, 1.0), (11.0, 12.35, 55, 0.7), (15.8, 16.5, 50, 0.6), (22.8, 23.5, 50, 0.55), (29.0, 29.5, 52, 0.45),
                    (43.6, 44.37, 48, 0.9), (49.5, 51.07, 46, 0.8), (58.2, 59.5, 50, 0.7), (63.8, 64.87, 48, 0.7), (65.9, 67.3, 43, 1.0)]:
    hits.add(riser(b - a, m0, g), a)
for a, b in [(14.05, 14.7), (29.0, 29.5), (47.0, 47.5), (52.0, 52.5), (68.4, 68.97)]:
    hits.add(swell(b - a), a)
for t, g, sub in [(10.8, 0.9, True), (44.37, 0.6, False), (52.5, 0.8, True), (64.87, 0.6, True), (67.3, 0.8, True), (68.97, 0.75, True), (71.95, 0.55, True)]:
    hits.add(impact(g, sub), t)
for t, g in [(10.8, 1.0), (14.7, 0.7), (16.5, 0.9), (23.5, 0.8), (29.5, 0.7), (44.83, 0.8), (47.5, 0.9), (52.5, 0.8), (59.5, 0.5), (67.3, 1.0), (68.97, 0.8)]:
    hits.add(crash(g), t)

# -- sidechain: pads, bass and arps duck on every kick (the pump)
side = np.ones(N)
tt = np.arange(int(0.35 * SR)) / SR
shape = 1 - 0.55 * np.exp(-tt / 0.09) * (1 - np.exp(-tt / 0.004))
for t in kicks:
    i = int(t * SR)
    n = min(len(shape), N - i)
    side[i:i + n] = np.minimum(side[i:i + n], shape[:n])
music = drums.x + synth.x * side[:, None] + hits.x
music = music + 0.22 * reverb(synth.x * side[:, None] + hits.x * 0.6 + drums.x * 0.15, 2.2)

# ================================================================ motion-matched SFX
sfx = Bus()


def W(t, d, f0, f1, p0=0.0, p1=0.0, g=1.0, peak=0.6):
    x, pan = whoosh(d, f0, f1, p0, p1, peak, 1.3, g)
    sfx.add(x, t, 1.0, pan)


# ---- opening (screen time; the 7–9s acceleration plays 1.75x at its peak)
sfx.add(pop(220, 520, 0.9), 0.2)                         # the portrait lands
W(0.0, 0.6, 400, 1800, 0, 0, 0.35)
for i in range(6):                                        # apps arrive on the beat, around the orbit
    a = math.radians(-90 + 45 * i)
    sfx.add(pop(420 + 60 * i, 1100 + 80 * i, 0.8), 1.5 + 0.5 * i, pan=0.7 * math.cos(a))
    sfx.add(tick(2400 + 120 * i, 0.5), 1.5 + 0.5 * i, pan=0.7 * math.cos(a))
for i, t in ((6, 4.6), (7, 4.93)):
    a = math.radians(-70 + 45 * i)
    sfx.add(pop(500, 1300, 0.7), t, pan=0.7 * math.cos(a))
for t, p in ((5.0, -0.55), (5.4, 0.55), (5.8, 0.5), (6.2, -0.6), (6.3, 0.55)):   # the feed piles up
    sfx.add(chime((86, 91), 0.45), t, pan=p)
    W(t - 0.05, 0.35, 1500, 5000, p * 1.2, p, 0.25)
sfx.add(whirr(2.3, 1.5, 17, 700, 2200, 0.55), 6.9)       # the orbit gathers momentum
W(8.4, 0.8, 900, 3800, -0.4, 0.4, 0.8)                   # apps streak into arcs
W(9.2, 0.7, 3200, 800, 0.3, 0, 0.5)                      # the ring tightens
W(10.0, 0.8, 1200, 6500, 0.9, 0.15, 1.0, 0.92)           # the line enters from the top right, fast into the ring
sfx.add(tink(2900, 1.0), 10.8, pan=0.2)                  # contact
sfx.add(click(0.9), 10.8, pan=0.2)
sfx.add(whirr(0.45, 16, 45, 1500, 3800, 0.75), 10.9)     # the spin kicks up
sfx.add(whirr(1.3, 45, 1, 3500, 600, 0.6), 11.3)         # and decelerates into the lobes
sfx.add(pop(300, 700, 0.6), 12.35)                       # the mark forms (+ bells in the score)
for i, (u, v) in enumerate([(-1, -1), (0, -1), (1, -1), (1, -0.35), (1, 0.35), (1, 1), (0, 1), (-1, 1), (-1, 0.35), (-1, -0.35)]):
    sfx.add(pop(500 + 40 * i, 1500 + 60 * i, 0.55), 12.8 + i * 0.05, pan=0.55 * u)
W(14.05, 0.4, 3000, 600, 0, 0, 0.6, 0.85)                # the modules gather into the mark
sfx.add(pop(180, 360, 0.8), 14.45)
W(14.45, 0.75, 1200, 700, 0, -0.35, 0.45)               # the mark glides left
for i in range(8):                                        # the wordmark writes itself
    sfx.add(key(1.0), 14.75 + i * 0.05, pan=-0.3 + 0.08 * i)
sfx.add(pop(600, 1400, 0.5), 15.35, pan=0.0)             # with Ask

# ---- 3 All in one (16.5 + f/60)
S = 16.5
W(S, 0.4, 2500, 900, 0, 0, 0.4)                          # letters depart
W(S + 8 / 60, 50 / 60, 800, 1600, -0.3, 0.65, 0.6)       # the mark travels to the hub
for i in range(6):
    sfx.add(pop(450 + 50 * i, 1200, 0.5), S + (30 + 7 * i) / 60, pan=-0.75)
W(S + 70 / 60, 115 / 60, 600, 5200, -0.6, 0.2, 0.55, 0.8)   # the fans draw in
sfx.add(tink(3400, 0.8), S + 168 / 60, pan=0.15)         # the spark
for k in range(3):
    sfx.add(tick(2200 + 300 * k, 0.6), S + (175 + 6 * k) / 60, pan=0.25 + 0.1 * k)
W(S + 222 / 60, 68 / 60, 700, 2600, 0.8, -0.8, 1.0, 0.5)   # the camera trucks along the line
W(S + 300 / 60, 50 / 60, 1400, 3200, -0.2, 0.6, 0.6)     # the panel wipes open
for k in range(5):
    sfx.add(tick(1700 + 90 * k, 0.35), S + (320 + 6 * k) / 60, pan=0.5)
W(S + 362 / 60, 57 / 60, 500, 4200, 0, 0, 0.9, 0.85)     # push into the desktop

# ---- 4 Dashboard (23.5)
S = 23.5
W(S + 8 / 60, 2.6, 300, 900, 0, 0, 0.3, 0.5)             # the window tilts in
sfx.add(pop(400, 1000, 0.6), S + 70 / 60, pan=0.5)       # highlight card
W(S + 200 / 60, 75 / 60, 600, 3000, 0, -0.2, 0.7, 0.8)   # close push along the rows
W(S + 232 / 60, 50 / 60, 2000, 1400, 0.9, 0.35, 0.25)    # the cursor glides in
sfx.add(click(1.0), S + 290 / 60, pan=0.35)              # Mark done
sfx.add(chime((84, 91), 0.5), S + 294 / 60, pan=0.35)
W(S + 318 / 60, 42 / 60, 2800, 700, 0.3, -0.5, 0.7, 0.4) # the field shrinks into the panel, Done flies left

# ---- 5 Features (29.5): each clock tick = a snap of the list + the card sliding through
S = 29.5
for k in range(8):
    t = S + 1.5 * k
    if k > 0:
        sfx.add(tick(1600 + 110 * k, 0.9), t - 0.02, pan=-0.6)
        W(t - 0.12, 0.3, 1800, 3400, -0.55, -0.6, 0.35, 0.4)
    W(t - 0.05, 0.45, 900, 2400, 0.4, 0.4, 0.4, 0.45)      # the tinted card rises through
    sfx.add(pop(520, 1250, 0.55), t + 0.13, pan=0.7)       # the white card lands
W(S + 664 / 60, 56 / 60, 700, 3400, 0.4, 0, 0.6, 0.8)    # the panel opens to the frame

# ---- 6 Automation (41.5)
S = 41.5
W(S, 34 / 60, 3200, 700, 0.2, 0, 0.6, 0.85)              # the Focus panel collapses into the badge
sfx.add(pop(300, 800, 0.8), S + 22 / 60)
sfx.add(chime((88, 92), 0.35), S + 26 / 60)
for i, (t, p) in enumerate(((40, -0.5), (48, 0.5), (56, -0.5), (64, 0.5))):
    W(S + t / 60, 0.4, 800, 2400, p * 1.3, p, 0.22)
for k in range(16):
    sfx.add(key(0.8), S + (60 + k * 4.4) / 60, pan=-0.45)
W(S + 126 / 60, 38 / 60, 500, 6500, -0.2, 0, 1.0, 0.95) # the camera dives into Create
W(S + 146 / 60, 26 / 60, 1800, 1200, 0.8, 0.2, 0.25)    # cursor
sfx.add(click(1.2), S + 172 / 60)                         # press
sfx.add(pop(900, 400, 0.6), S + 176 / 60)
W(S + 200 / 60, 52 / 60, 5000, 600, 0, 0, 0.9, 0.3)      # pull back out
for k, f in enumerate((262, 292, 312)):
    sfx.add(tick(1800 + 350 * k, 0.9), S + f / 60, pan=0.45)
    sfx.add(pop(700 + 150 * k, 1700 + 200 * k, 0.4), S + f / 60, pan=0.45)
W(S + 262 / 60, 0.4, 900, 2000, -0.2, -0.1, 0.25)        # mail draft
sfx.add(chime((86, 93), 0.8), S + 312 / 60, pan=0.6)     # reminder sent
W(S + 334 / 60, 26 / 60, 1200, 3600, 0.6, 0, 0.55)       # toast flies to centre

# ---- 7 Pill wall (47.5)
S = 47.5
W(S, 40 / 60, 600, 4500, 0, 0, 0.8, 0.5)                 # the field opens from the toast
for r in range(6):                                        # rows slide in from alternating sides
    p0 = -0.9 if r % 2 == 0 else 0.9
    W(S + (4 + 5 * r) / 60, 0.55, 900, 2600, p0, 0, 0.35)
t, k = S + 0.6, 0                                         # pills passing faster and faster
while t < S + 214 / 60:
    u = (t - S) / (214 / 60)
    sfx.add(tick(2100 + (k % 5) * 180, 0.18 + 0.25 * u), t, pan=0.8 * math.sin(k * 1.7))
    t += 0.24 * (1 - 0.7 * u)
    k += 1
W(S + 214 / 60, 72 / 60, 1200, 3800, 0, 0, 0.7, 0.7)     # the Tasks pill becomes the tile
W(S + 230 / 60, 60 / 60, 1400, 300, 0, 0, 0.45, 0.3)     # the stage sinks to ink

# ---- 8 Carousel (52.5)
S = 52.5
for k in range(4):
    W(S + (8 + 6 * k) / 60, 0.45, 800, 2200, (-1) ** k * 0.8, (-1) ** k * 0.4, 0.3)
for f in (80, 170, 260):                                  # the row steps left with a spring snap
    W(S + f / 60 - 0.05, 0.42, 1100, 2800, 0.6, -0.5, 0.65, 0.45)
    sfx.add(pop(260, 520, 0.7), S + f / 60 + 0.22)
    sfx.add(tick(1500, 0.4), S + f / 60 + 0.3)
W(S + 340 / 60, 65 / 60, 700, 5000, 0, 0, 0.8, 0.8)      # tiles scatter, the glow blooms to paper

# ---- 9 The one (59.5)
S = 59.5
for i in range(9):                                        # the ring of cards arrives
    sfx.add(pop(380 + 30 * i, 900 + 60 * i, 0.35), S + (4 + 4 * i) / 60, pan=math.cos(i * 0.9) * 0.7)
    W(S + (2 + 4 * i) / 60, 0.3, 1500, 3500, math.cos(i * 0.9) * 0.9, math.cos(i * 0.9) * 0.7, 0.18)
W(S + 290 / 60, 60 / 60, 800, 4200, 0, 0, 0.9, 0.9)      # the cards gather into the centre
W(S + 322 / 60, 62 / 60, 4200, 500, 0, 0, 0.6, 0.25)     # the blueprint field opens
for k in range(14):                                       # the blueprint draws itself
    sfx.add(key(0.7), S + (384 + k * 6) / 60, pan=math.sin(k * 1.3) * 0.6)
    if k % 3 == 0:
        sfx.add(tick(2600 + 100 * k, 0.3), S + (386 + k * 6) / 60, pan=math.sin(k * 1.3) * 0.6)
W(S + 508 / 60, 60 / 60, 1400, 800, 0, -0.35, 0.45)      # the mark moves into the lockup
for i in range(8):
    sfx.add(key(0.9), S + (520 + 4 * i) / 60, pan=-0.2 + 0.07 * i)
W(S + 688 / 60, 28 / 60, 2600, 900, 0, 0, 0.45)          # words step away
W(S + 700 / 60, 52 / 60, 500, 2600, 0, 0, 0.5, 0.8)      # the mark becomes the app icon
sfx.add(tink(3100, 0.6), S + 752 / 60 + 0.05)
sfx_x = sfx.x + 0.18 * reverb(sfx.x, 1.4, 7000)

# ================================================================ voice-over
vo = Bus()
VO = re.findall(r'\["(\w+)", ([\d.]+)\]', (ROOT / "src/v4/vo.ts").read_text())
for vid, t in VO:
    y, sr = sf.read(ROOT / f"public/audio/vo4/{vid}.wav", always_2d=False)
    if y.ndim > 1:
        y = y.mean(1)
    if sr != SR:
        y = signal.resample_poly(y, SR, sr)
    vo.add(y * 1.1, float(t))

def compress(x, thr_db=-24, ratio=3.0, att=0.004, rel=0.12):
    """Feed-forward compressor on the stereo level (for the voice)."""
    lvl = np.sqrt(signal.lfilter([1 - math.exp(-1 / (0.01 * SR))], [1, -math.exp(-1 / (0.01 * SR))], (x ** 2).mean(1)))
    db = 20 * np.log10(lvl + 1e-9)
    red = np.maximum(0, db - thr_db) * (1 - 1 / ratio)
    g = 10 ** (-red / 20)
    g = minimum_filter1d(g, int(att * SR))
    g = signal.lfilter([1 - math.exp(-1 / (rel * SR))], [1, -math.exp(-1 / (rel * SR))], g - 1) + 1
    return x * np.minimum(g, 1)[:, None]


vo.x = compress(vo.x)

# ================================================================ mix + master
vo_env = maximum_filter1d(np.abs(vo.x).max(1), int(0.05 * SR))
vo_env = signal.lfilter([1 - 0.9996], [1, -0.9996], (vo_env > 0.01).astype(float))  # ~50ms release shape
duck = 1 - 0.5 * np.clip(vo_env * 1.2, 0, 1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


music_n = music / (np.sqrt(np.mean(music ** 2)) + 1e-9) * 10 ** (-19 / 20)   # stems at a sensible level
sfx_n = sfx_x / (np.sqrt(np.mean(sfx_x ** 2)) + 1e-9) * 10 ** (-26 / 20)
vo_n = vo.x / (np.sqrt(np.mean(vo.x[np.abs(vo.x).max(1) > 1e-4] ** 2)) + 1e-9) * 10 ** (-17 / 20)
mix = music_n * duck[:, None] + sfx_n + vo_n

fade = np.ones(N)
fade[: int(0.02 * SR)] = np.linspace(0, 1, int(0.02 * SR))
fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR)) ** 1.5
mix *= fade[:, None]


def limiter(x, ceiling=0.89, look=0.005, release=0.09):
    """Look-ahead peak limiter: gain falls before a peak, recovers smoothly after it."""
    w = int(look * SR)
    peak = maximum_filter1d(np.abs(x).max(1), 2 * w + 1)
    target = np.minimum(1.0, ceiling / (peak + 1e-9))
    a = math.exp(-1 / (release * SR))
    g = np.empty_like(target)
    cur = 1.0
    for i, v in enumerate(target):  # instant attack (already looked ahead), exponential release
        cur = v if v < cur else v + (cur - v) * a
        g[i] = cur
    return np.clip(x * g[:, None], -ceiling, ceiling)


gain = 10 ** (-14.5 / 20) / (np.sqrt(np.mean(mix ** 2)) + 1e-9)    # ~-14.5 dBFS RMS: streaming loudness
# bus processing: each bus gets its own peak control, then one gentle master limiter
buses = {
    "music": limiter(music_n * duck[:, None] * fade[:, None] * gain, 0.80),
    "sfx": limiter(sfx_n * fade[:, None] * gain, 0.70),
    "vo": limiter(vo_n * fade[:, None] * gain, 0.63),
}
mix = limiter(buses["music"] + buses["sfx"] + buses["vo"], 0.89)
buses["mix"] = mix
for name, x in buses.items():
    sf.write(OUT / f"{name}.wav", x.astype(np.float32), SR, subtype="PCM_24")
    print(f"{name:6s} rms {rms_db(x):6.1f} dBFS  peak {20 * np.log10(np.abs(x).max()):5.1f} dBFS")
print("wrote", OUT)
