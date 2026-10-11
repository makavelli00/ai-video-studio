// Ambiente sonoro de suspense generado por código (sin música con derechos).
// Dron grave + viento + un golpe en cada cambio de escena. Siempre sale igual.
// Uso: npm run ambient -- <video>   → videos/<video>/ambient.wav (y lo pone en timeline.audio)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { slugArg, loadVideo, ffmpegPath } from "./lib/common.mjs";

const slug = slugArg();
const { dir, timeline } = loadVideo(slug);
const total = timeline.scenes.reduce((a, s) => a + s.duration, 0);
const starts = [];
let acc = 0;
for (const s of timeline.scenes) { if (acc > 0 && s.hit !== false) starts.push(acc); acc += s.duration; }

const drone = [
  "0.16*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.13*t))",
  "0.08*sin(2*PI*77.78*t+0.8*sin(2*PI*0.07*t))*(0.5+0.5*sin(2*PI*0.09*t+1))",
  "0.04*sin(2*PI*110.4*t)*(0.5+0.5*sin(2*PI*0.21*t))",
];
const hits = starts.map((T) =>
  `0.55*sin(2*PI*(38+40*exp(-9*(t-${T.toFixed(3)})))*(t-${T.toFixed(3)}))*exp(-3*(t-${T.toFixed(3)}))*gte(t,${T.toFixed(3)})`);
const expr = [...drone, ...hits].join("+");
const out = path.join(dir, "ambient.wav");
const d = total.toFixed(3);
const fc =
  `aevalsrc=exprs='${expr}':s=44100:d=${d},aecho=0.8:0.6:180|420:0.35|0.2[tone];` +
  `anoisesrc=color=brown:amplitude=0.5:d=${d}:seed=7,lowpass=f=260,highpass=f=40,volume=0.5,` +
  `tremolo=f=0.15:d=0.6[wind];` +
  `[tone][wind]amix=inputs=2:normalize=0,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5,` +
  `alimiter=limit=0.8,aformat=channel_layouts=stereo[a]`;
const r = spawnSync(await ffmpegPath(), ["-y", "-loglevel", "error", "-filter_complex", fc, "-map", "[a]", out], { stdio: "inherit" });
if (r.status !== 0) { console.error("✖ ffmpeg no pudo generar el ambiente"); process.exit(1); }

const tlFile = path.join(dir, "timeline.json");
const tl = JSON.parse(fs.readFileSync(tlFile, "utf8"));
if (tl.audio !== "ambient.wav") { tl.audio = "ambient.wav"; tl.audioVolume ??= 0.9; fs.writeFileSync(tlFile, JSON.stringify(tl, null, 2) + "\n"); }
console.log(`✔ videos/${slug}/ambient.wav (${total.toFixed(1)} s, ${starts.length} golpes)`);
