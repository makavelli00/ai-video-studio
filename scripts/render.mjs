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
// Pistas de audio: "audio" = música/ambiente, "voice" = voz en off (opcionales).
const tracks = [];
for (const [key, vol] of [["audio", timeline.audioVolume ?? 1], ["voice", timeline.voiceVolume ?? 1]]) {
  if (!timeline[key]) continue;
  const f = path.join(dir, timeline[key]);
  if (fs.existsSync(f)) tracks.push({ f, vol, key });
  else console.warn(`⚠ No encuentro ${timeline[key]}; exporto sin esa pista.`);
}
tracks.forEach((tr) => args.push("-i", tr.f));
if (tracks.length) {
  const fade = `afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=1`;
  // Con voz, la música baja sola mientras se habla (ducking).
  const music = tracks.find((tr) => tr.key === "audio"), voice = tracks.find((tr) => tr.key === "voice");
  const idx = (tr) => 1 + tracks.indexOf(tr);
  let fc;
  if (music && voice) {
    fc = `[${idx(music)}:a]volume=${music.vol}[m];[${idx(voice)}:a]volume=${voice.vol},asplit[v1][v2];` +
      `[m][v1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[md];[md][v2]amix=inputs=2:duration=longest:normalize=0,${fade}[a]`;
  } else {
    const tr = music || voice;
    fc = `[${idx(tr)}:a]volume=${tr.vol},${fade}[a]`;
  }
  args.push("-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-t", total.toFixed(3));
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
// Copia versionable en renders/ para descargarla desde GitHub (Claude Code en la nube).
const rendersDir = path.join(path.dirname(dir), "..", "renders");
fs.mkdirSync(rendersDir, { recursive: true });
fs.copyFileSync(outFile, path.join(rendersDir, `${slug}.mp4`));
console.log(`\n✔ ${path.relative(process.cwd(), outFile)} (${total.toFixed(1)} s, ${((Date.now() - t0) / 1000).toFixed(0)} s de render) · copia en renders/`);
