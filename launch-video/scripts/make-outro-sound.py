"""Sound design for the outro (src/scenes/Outro.tsx), synthesised from scratch.

Original and royalty-free; numpy only. Every cue is placed on the frame the
picture uses (60 fps, 120 BPM: 1 beat = 30 frames), so the sound and the
drawing move together:

  0-80    the mesh fades up        -> warm Dmaj9 pad, sub air
  10-70   guides draw              -> pencil strokes (filtered noise)
  30-54   lobe circles             -> four soft mallets, D F# A C#
  70-150  orbits draw and run      -> airy shimmer circling left <-> right
  130-154 task / event / client    -> three glass taps (L, R, L)
  190     links to the mark        -> three small ticks
  200-240 the lockup rises         -> filtered riser
  240     handles snap             -> the brand chime + a soft low hit
  255     tagline                  -> a breath of air, pad opens, long tail

    python3 scripts/make-outro-sound.py
Writes public/audio/outro.wav (48 kHz stereo). Loudness is set on the mux.
"""
import os
import wave

import numpy as np

SR = 48000
FPS = 60
DUR = 420 / FPS
N = int(DUR * SR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)


def fr(frame):
    return frame / FPS


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def onepole(x, cutoff):
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
    return hp(lp(x, hi), lo)


def env(n, a=0.005, r=0.3, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    return e * np.exp(-curve * np.maximum(0, t - a) / max(r, 1e-4))


class Mix:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, sig, at, gain=1.0, pan=0.0):
        """pan -1..1, or an array the length of sig for moving pans."""
        i = int(at * SR)
        if i >= N:
            return
        sig = sig[: N - i]
        p = np.broadcast_to(np.asarray(pan, dtype=float), (len(sig),)) if np.ndim(pan) else np.full(len(sig), pan)
        p = p[: len(sig)]
        th = (p + 1) * np.pi / 4
        self.L[i : i + len(sig)] += sig * np.cos(th) * gain
        self.R[i : i + len(sig)] += sig * np.sin(th) * gain


def reverb(x, secs=2.8, damp=5000, seed=3):
    """Convolution with a synthetic decaying-noise room (FFT)."""
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = r.standard_normal(n) * np.exp(-6.0 * np.arange(n) / n)
    ir = lp(ir, damp)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    ir /= np.sqrt(np.sum(ir**2))
    m = len(x) + n
    k = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, k) * np.fft.rfft(ir, k), k)[: len(x)]
    return y


# ── Voices ─────────────────────────────────────────────────────────────────
def pad_voice(f, sec, bright=1200):
    t = t_(sec)
    s = np.zeros_like(t)
    for d in (-0.07, 0.0, 0.06):  # three slightly detuned voices
        ff = f * 2 ** (d / 12)
        ph = rng.uniform(0, 2 * np.pi)
        for h in range(1, 7):
            s += np.sin(2 * np.pi * ff * h * t + ph * h) / h**1.4
    return lp(s, bright) / 6


def mallet(f, sec=1.6, bright=0.3):
    t = t_(sec)
    s = np.sin(2 * np.pi * f * t) + bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-9 * t) + 0.12 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-14 * t)
    return s * env(len(t), 0.003, 0.45)


def bell(f, sec=4.5):
    """Inharmonic bell partials (the brand chime)."""
    t = t_(sec)
    parts = [(1, 1.0, 0.9), (2.0, 0.5, 1.4), (2.76, 0.35, 2.2), (5.4, 0.18, 3.5), (8.9, 0.08, 5.0)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-d * t) for r, a, d in parts)
    return s * np.minimum(1, t / 0.002)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


# ── Score ──────────────────────────────────────────────────────────────────
def build():
    mx = Mix()
    wet = Mix()  # everything sent to the room

    # Pad: Dmaj9 (D2 A2 F#3 C#4 E4), then opens to add A4 at the logo.
    notes = [38, 45, 54, 61, 64]
    pad_len = DUR
    tp = t_(pad_len)
    shape = np.clip(tp / 1.4, 0, 1) ** 2
    shape *= 0.75 + 0.25 * np.clip((tp - fr(230)) / 0.6, 0, 1)  # swell into the logo
    shape *= np.clip((DUR - tp) / 1.2, 0, 1)  # tail out
    for i, m in enumerate(notes):
        v = pad_voice(midi(m), pad_len, bright=900 + 250 * i)
        mx.add(v * shape, 0, 0.16, pan=(-0.35 if i % 2 else 0.35))
    top = pad_voice(midi(69), DUR - fr(240), bright=2200)
    tt = t_(DUR - fr(240))
    wet.add(top * np.clip(tt / 0.8, 0, 1) * np.clip((DUR - fr(240) - tt) / 1.2, 0, 1), fr(240), 0.07, pan=0.2)

    # Sub air under the fade-up.
    sub = np.sin(2 * np.pi * midi(26) * tp) * np.clip(tp / 2, 0, 1) * np.clip((DUR - tp) / 1.5, 0, 1)
    mx.add(sub, 0, 0.045)

    # Pencil strokes as the guides draw (frames 10-70).
    for k, (f0, dur, pan) in enumerate([(10, 0.9, -0.5), (18, 0.8, 0.5), (26, 1.0, -0.2), (34, 0.9, 0.3)]):
        n = bp(noise(dur), 2500, 7000)
        e = np.sin(np.pi * np.linspace(0, 1, len(n))) ** 1.5
        grain = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 23 * t_(dur)))  # paper tooth
        mx.add(n * e * grain, fr(f0), 0.035, pan=pan)

    # Lobe circles: four soft mallets on the beat grid (D5 F#5 A5 C#6).
    for i, m in enumerate([74, 78, 81, 85]):
        s = mallet(midi(m))
        mx.add(s, fr(30 + i * 8), 0.10, pan=[-0.4, 0.4, -0.4, 0.4][i])
        wet.add(s, fr(30 + i * 8), 0.10)

    # Orbit shimmer: high cluster that circles L <-> R (frames 70-150, lingers).
    sd = DUR - fr(70)
    ts = t_(sd)
    sh = sum(np.sin(2 * np.pi * midi(m) * ts + i) for i, m in enumerate([86, 90, 93, 97]))
    sh *= 0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * ts)  # glitter
    sh *= np.clip(ts / 1.3, 0, 1) * np.clip((sd - ts) / 1.5, 0, 1) * (1 - 0.5 * np.clip((ts - 2.5) / 1, 0, 1))
    wet.add(sh, fr(70), 0.012, pan=0.7 * np.sin(2 * np.pi * 0.35 * ts))

    # Glass taps as the product cards arrive (task L, event R, client L).
    for f0, m, pan in [(130, 93, -0.6), (142, 97, 0.6), (154, 90, -0.6)]:
        tl = t_(0.5)
        s = np.sin(2 * np.pi * midi(m) * tl) * np.exp(-18 * tl) + 0.5 * np.sin(2 * np.pi * midi(m) * 2.3 * tl) * np.exp(-30 * tl)
        click = hp(noise(0.5), 4000) * np.exp(-400 * tl)
        mx.add(s + 0.3 * click, fr(f0), 0.07, pan=pan)
        wet.add(s, fr(f0), 0.06, pan=pan)

    # Links drawn to the mark: three small ticks.
    for i, pan in enumerate([-0.5, 0.5, -0.3]):
        tl = t_(0.12)
        s = hp(noise(0.12), 3000) * np.exp(-120 * tl) + np.sin(2 * np.pi * 2400 * tl) * np.exp(-80 * tl) * 0.4
        mx.add(s, fr(190 + i * 10), 0.05, pan=pan)

    # Riser into the lockup (200 -> 240): noise that opens up, plus a reversed bell.
    rd = fr(240) - fr(200)
    tr = t_(rd)
    ramp = (tr / rd) ** 2.2
    rise = onepole(noise(rd), 300 + 5200 * ramp) * ramp
    mx.add(rise, fr(200), 0.10)
    rb = bell(midi(74), rd)[::-1] * ramp
    wet.add(rb, fr(200), 0.05)

    # The hit (frame 240): brand chime D6 + A6 over a soft low thump.
    chime = bell(midi(86)) + 0.6 * bell(midi(93)) + 0.35 * bell(midi(78))
    mx.add(chime, fr(240), 0.11, pan=-0.1)
    wet.add(chime, fr(240), 0.16)
    th = t_(1.2)
    thump = np.sin(2 * np.pi * (48 + 30 * np.exp(-20 * th)) * th) * np.exp(-4.5 * th)
    mx.add(thump, fr(240), 0.22)
    # Handle snaps: four tiny, bright clicks.
    for i in range(4):
        tl = t_(0.06)
        mx.add(hp(noise(0.06), 5000) * np.exp(-250 * tl), fr(240) + 0.018 * i, 0.03, pan=[-0.6, 0.6, -0.6, 0.6][i])

    # Tagline: a breath of air.
    bd = 1.8
    tb = t_(bd)
    breath = bp(noise(bd), 700, 3500) * np.sin(np.pi * tb / bd) ** 2
    mx.add(breath, fr(255), 0.03, pan=0.0)

    # Room.
    L = mx.L + reverb(wet.L + 0.25 * mx.L, seed=3) * 0.9
    R = mx.R + reverb(wet.R + 0.25 * mx.R, seed=4) * 0.9
    L, R = hp(L, 35), hp(R, 35)  # keep the low end clean
    out = np.stack([L, R], 1)
    fade = np.clip((DUR - np.arange(N) / SR) / 0.4, 0, 1)
    out *= fade[:, None]
    out /= np.max(np.abs(out)) / 0.89
    return out


def write(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    write(os.path.join(ROOT, "public/audio/outro.wav"), build())
    print("wrote public/audio/outro.wav")
