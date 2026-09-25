// Renders film.html by seeking its GSAP timeline (window.film) frame by frame in headless Chromium.
//   node tools/render.cjs stills 1.2,3.6,...        → out/stills/*.png + out/contact.jpg
//   node tools/render.cjs probe <t> x,y ...          → elements under points at time t
//   node tools/render.cjs video [fps] [scale]        → out/film.mp4 (with the mixed audio)
const { chromium } = require("/home/user/zenboard-app/node_modules/playwright-core");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "out");
const FF = process.env.FFMPEG || execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
const CHROME = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

async function open(scale = 1) {
  const b = await chromium.launch({ executablePath: CHROME, args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto("file://" + path.join(ROOT, "film.html"), { waitUntil: "load" });
  await p.waitForFunction(() => window.filmReady === true, null, { timeout: 20000 });
  await p.evaluate(() => document.querySelectorAll("img").forEach((i) => i.decode && i.decode()));
  return { b, p };
}
const seek = (p, t) => p.evaluate((t) => { window.film.seek(t, false); return new Promise((r) => requestAnimationFrame(() => r())); }, t);

async function stills(times) {
  const { b, p } = await open();
  const dir = path.join(OUT, process.env.STILLS_DIR || "stills"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of times.entries()) {
    await seek(p, t);
    await p.screenshot({ path: path.join(dir, `${String(i).padStart(2, "0")}-${t.toFixed(1)}s.png`) });
  }
  await b.close();
  const cols = 4, rows = Math.ceil(times.length / cols);
  execFileSync(FF, ["-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(dir, "*.png"),
    "-vf", `scale=480:-1,tile=${cols}x${rows}:padding=4:color=white`, "-frames:v", "1", path.join(OUT, "contact.jpg")], { stdio: "inherit" });
  console.log("stills:", times.length, "→ out/contact.jpg");
}

async function probe(t, pts) {
  const { b, p } = await open();
  await seek(p, t);
  for (const xy of pts) {
    const [x, y] = xy.split(",").map(Number);
    console.log(xy, (await p.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 8).map((e) => `${e.tagName.toLowerCase()}#${e.id}.${String(e.className.baseVal ?? e.className).slice(0, 30)}`), [x, y])).join("  |  "));
  }
  await b.close();
}

function mixAudio(file) {
  const { total, cues } = JSON.parse(fs.readFileSync(path.join(ROOT, "build/audio-cues.json")));
  const args = ["-y", "-loglevel", "error"], parts = [];
  cues.forEach((c) => args.push("-i", path.join(ROOT, c.src)));
  cues.forEach((c, i) => {
    let f = `[${i}:a]aresample=48000,aformat=channel_layouts=stereo`;
    if (c.dur) f += `,atrim=0:${c.dur}`;
    if (c.fadeIn) f += `,afade=t=in:d=${c.fadeIn}`;
    if (c.fadeOut) f += `,afade=t=out:st=${c.dur - c.fadeOut}:d=${c.fadeOut}`;
    f += `,volume=${c.vol},adelay=${Math.round(c.t * 1000)}:all=1[a${i}]`;
    parts.push(f);
  });
  parts.push(`${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,atrim=0:${total},alimiter=limit=0.95[out]`);
  fs.writeFileSync(path.join(OUT, "mix.txt"), parts.join(";\n"));
  execFileSync(FF, [...args, "-filter_complex_script", path.join(OUT, "mix.txt"), "-map", "[out]", "-c:a", "pcm_s16le", file], { stdio: "inherit" });
}

async function video(fps = 30, scale = 1) {
  fs.mkdirSync(OUT, { recursive: true });
  const { total } = JSON.parse(fs.readFileSync(path.join(ROOT, "build/audio-cues.json")));
  const wav = path.join(OUT, "mix.wav"); mixAudio(wav);
  const { b, p } = await open();
  const w = Math.round(1920 * scale), h = Math.round(1080 * scale);
  const mp4 = path.join(OUT, `zenboard-launch-${h}p${fps}.mp4`);
  const ff = spawn(FF, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-i", wav,
    "-vf", `scale=${w}:${h}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], { stdio: ["pipe", "inherit", "inherit"] });
  const n = Math.round(total * fps), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await seek(p, i / fps);
    const buf = await p.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % (fps * 5) === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await b.close();
  console.log("wrote", mp4);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "stills") stills(rest[0].split(",").map(Number));
else if (mode === "probe") probe(+rest[0], rest.slice(1));
else if (mode === "video") video(+(rest[0] || 30), +(rest[1] || 1));
else console.log("usage: stills <t,t,...> | probe <t> x,y ... | video [fps] [scale]");
