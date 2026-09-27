"""Zenboard brand gradients: soft mesh gradients from the palette, rendered as
4K PNGs (3840 x 2160) plus a contact sheet.

    python3 scripts/make-gradients.py

Colours mix in linear light so blends stay clean (no muddy midpoints), the
domain is gently warped so edges flow, and a triangular dither keeps 8-bit
output free of banding. Writes illustrations/gradients/.
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "illustrations/gradients")
W, H = 3840, 2160

# The Zenboard palette (src/brand/tokens.ts, app/tokens.generated.css).
INK = "#280417"
INK_EDGE = "#120109"
PLUM = "#3A0A32"
BERRY_700 = "#8A0F51"
BERRY = "#C41C72"
PINK_300 = "#E38CB2"
ROSE = "#E8A8C5"
BLUSH = "#EFB9D0"
APRICOT = "#E8B88A"
LAVENDER = "#AAA0D4"
IVORY = "#F7F1E8"
PAPER = "#FBFAF6"


def lin(hex_):
    c = np.array([int(hex_[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def mesh(base, points, warp=0.08, seed=1, vignette=0.0):
    """points: (x, y, radius, hex, strength) in 0..1 frame units (x across, y down)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = x / W, y / H
    a = W / H
    # Gentle flowing warp: a few low-frequency waves.
    for _ in range(3):
        f = rng.uniform(1.2, 2.6)
        ph = rng.uniform(0, 6.28)
        u, v = u + warp * np.sin(v * f * 3.1 + ph) / 3, v + warp * np.cos(u * f * 2.7 + ph * 1.3) / 3
    col = np.broadcast_to(lin(base), (H, W, 3)).copy()
    for px, py, r, hx, s in points:
        d2 = ((u - px) * a) ** 2 + (v - py) ** 2
        w = s * np.exp(-d2 / (r * r))
        col = col * (1 - w[..., None]) + lin(hx) * w[..., None]
    if vignette:
        d = np.sqrt(((x / W - 0.5) * a) ** 2 + (y / H - 0.5) ** 2)
        col *= (1 - vignette * np.clip((d - 0.35) / 0.75, 0, 1) ** 1.5)[..., None]
    out = srgb(col) * 255
    out += (rng.random(out.shape) + rng.random(out.shape) - 1)  # ±1 LSB triangular dither
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))


GRADIENTS = {
    # Dark: berry light pooling through the Ink stage.
    "01-berry-night": mesh(
        INK_EDGE,
        [(0.25, 0.3, 0.55, INK, 1.0), (0.2, 0.75, 0.42, BERRY_700, 0.85), (0.72, 0.62, 0.5, BERRY, 0.75), (0.95, 0.15, 0.4, PLUM, 0.9), (0.58, 0.92, 0.3, BERRY, 0.55)],
        seed=3,
        vignette=0.35,
    ),
    # Dark, calmer: mostly Ink with a single soft berry glow.
    "02-ink-glow": mesh(
        INK_EDGE,
        [(0.5, 0.5, 0.75, INK, 1.0), (0.5, 0.62, 0.42, BERRY_700, 0.6), (0.52, 0.68, 0.22, BERRY, 0.45)],
        seed=5,
        vignette=0.4,
    ),
    # The energy gradient: Zenboard Pink -> Rose -> Apricot with a lavender edge.
    "03-energy": mesh(
        ROSE,
        [(0.05, 0.1, 0.55, LAVENDER, 0.9), (0.35, 0.55, 0.55, BERRY, 0.85), (0.7, 0.35, 0.45, ROSE, 0.8), (0.95, 0.85, 0.55, APRICOT, 0.95), (0.55, 0.05, 0.3, PINK_300, 0.6)],
        seed=7,
    ),
    # Berry to Apricot, diagonal sweep: bold, for covers and social.
    "04-berry-apricot": mesh(
        BERRY,
        [(0.0, 0.0, 0.6, BERRY_700, 0.9), (0.55, 0.5, 0.5, BERRY, 0.7), (0.8, 0.7, 0.5, PINK_300, 0.75), (1.05, 1.05, 0.6, APRICOT, 1.0)],
        seed=9,
        warp=0.12,
    ),
    # Light: Ivory with blush, rose and apricot, very soft (UI and document backdrops).
    "05-ivory-blush": mesh(
        IVORY,
        [(0.15, 0.2, 0.45, BLUSH, 0.55), (0.85, 0.3, 0.45, APRICOT, 0.35), (0.6, 0.9, 0.5, ROSE, 0.4), (0.4, 0.5, 0.6, PAPER, 0.6), (0.95, 0.95, 0.35, LAVENDER, 0.25)],
        seed=11,
    ),
    # Light, lavender to rose: cool and airy.
    "06-lavender-rose": mesh(
        PAPER,
        [(0.1, 0.8, 0.55, LAVENDER, 0.7), (0.5, 0.3, 0.5, BLUSH, 0.6), (0.9, 0.6, 0.5, ROSE, 0.7), (0.7, 1.0, 0.35, APRICOT, 0.35)],
        seed=13,
    ),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    thumbs = []
    for name, img in GRADIENTS.items():
        img.save(os.path.join(OUT, f"zenboard-gradient-{name}.png"), optimize=True)
        thumbs.append(img.resize((960, 540), Image.LANCZOS))
        print("wrote", name)
    sheet = Image.new("RGB", (960 * 3 + 40 * 4, 540 * 2 + 40 * 3), (251, 250, 246))
    for i, t in enumerate(thumbs):
        sheet.paste(t, (40 + (i % 3) * 1000, 40 + (i // 3) * 580))
    sheet.save(os.path.join(OUT, "contact-sheet.png"), optimize=True)
