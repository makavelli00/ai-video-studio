// Capa 4 · Renderer — exporta el MP4 final (1080x1920).
// Uso: npm run render -- <video>
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { slugArg, loadVideo, openPlayer, ffmpegPath } from "./lib/common.mjs";

const slug = slugArg();
const { dir, outDir, timeline, style } = loadVideo(slug);
const outFile = path.join(outDir, `${slug}.mp4`);

const player = await openPlayer(timeline, style);
const { totalFrames, fps, total } = player.info;
const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-"];
let audioFile = null;
if (timeline.audio) {
  audioFile = path.join(dir, timeline.audio);
  if (!fs.existsSync(audioFile)) { console.warn(`⚠ No encuentro el audio ${timeline.audio}; exporto sin sonido.`); audioFile = null; }
}
if (audioFile) {
  const vol = timeline.audioVolume ?? 1;
  args.push("-i", audioFile, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k",
    "-af", `volume=${vol},afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=1`, "-shortest");
}
args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", outFile);

const ff = spawn(await ffmpegPath(), args, { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res, rej) => { ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg terminó con código " + c)))); ff.on("error", rej); });

const t0 = Date.now();
const BATCH = 10;
for (let f = 0; f < totalFrames; f += BATCH) {
  const frames = await player.page.evaluate(([a, b]) => window.studioFrames(a, b), [f, Math.min(totalFrames, f + BATCH)]);
  for (const d of frames) {
    if (!ff.stdin.write(Buffer.from(d.split(",")[1], "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  const done = Math.min(totalFrames, f + BATCH);
  if (process.stdout.isTTY) process.stdout.write(`\rRenderizando ${done}/${totalFrames} fotogramas`);
  else if (done % 300 < BATCH || done === totalFrames) console.log(`Renderizando ${done}/${totalFrames} fotogramas`);
}
ff.stdin.end();
await ffDone;
await player.close();
console.log(`\n✔ ${path.relative(process.cwd(), outFile)} (${total.toFixed(1)} s, ${((Date.now() - t0) / 1000).toFixed(0)} s de render)`);
