"""Renders the film at quarter size with the DebugZones overlay and lists
every frame where two moving elements collide or the 8-object budget breaks.

    python3 scripts/scan-collisions.py [path/to/chromium-headless-shell]
"""
import re
import subprocess
import sys

import numpy as np

args = ["npx", "remotion", "render", "Film16x9", "out/debug.mp4", "--scale=0.25", "--gl=angle", '--props={"debug":true}', "--muted"]
if len(sys.argv) > 1:
    args.append(f"--browser-executable={sys.argv[1]}")
subprocess.run(args, check=True, capture_output=True)

src = open("src/brand/timeline.ts").read()
starts, t = {}, 0
for sid, beats in re.findall(r'id: "(S\d+)", act: \d, beats: ([\d.]+)', src):
    starts[sid] = t
    t += round(float(beats) * 40)


def scene(f):
    k = [s for s, v in starts.items() if v <= f][-1]
    return f"{k}+{f - starts[k]}"


w, h = 480, 270
p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", "out/debug.mp4", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
i, clash, over = 0, [], []
while True:
    buf = p.stdout.read(w * h * 3)
    if len(buf) < w * h * 3:
        break
    a = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(int)
    r, b = a[4:20, 4:20], a[4:20, 28:44]
    if (r[:, :, 0] > 200).all() and (r[:, :, 1] < 80).all():
        clash.append(i)
    if (b[:, :, 2] > 200).all() and (b[:, :, 0] < 80).all():
        over.append(i)
    i += 1


def ranges(frames):
    out = []
    for f in frames:
        if out and f - out[-1][1] <= 2:
            out[-1][1] = f
        else:
            out.append([f, f])
    return [(scene(a), scene(b)) for a, b in out]


print(f"scanned {i} frames")
print("collisions:", ranges(clash) or "none")
print("over budget:", ranges(over) or "none")
