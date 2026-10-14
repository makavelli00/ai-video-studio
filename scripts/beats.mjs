// Mide el audio antes de animar: tempo, pulsos, golpes y pausas de la voz → beats.json.
// Uso: npm run beats -- <video> [--file pista.wav] [--snap]
//   Sin --file usa "voice" (pausas entre frases) y "audio" (pulsos y golpes) del timeline.
//   --snap mueve cada corte de escena al punto bueno más cercano (±0.4 s):
//   con voz, al centro de la pausa entre frases; si no, al compás fuerte o al pulso.
// Todo con ffmpeg + JavaScript, sin librerías de Python.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { slugArg, loadVideo, ffmpegPath, flagArg, hasFlag } from "./lib/common.mjs";

const slug = slugArg();
const { dir, timeline } = loadVideo(slug);
const SR = 22050, HOP = 512, FR = SR / HOP; // ~43 ventanas por segundo
const ff = await ffmpegPath();

function decode(file) {
  const r = spawnSync(ff, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`No pude leer ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
}

function analyze(file) {
  const x = decode(file);
  const n = Math.floor(x.length / HOP);
  const rms = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < HOP; j++) { const v = x[i * HOP + j]; s += v * v; } rms[i] = Math.sqrt(s / HOP); }
  const db = Array.from(rms, (v) => 20 * Math.log10(v + 1e-9));
  // fuerza de ataque: subida de energía (en dB) respecto a la ventana anterior
  const on = db.map((v, i) => (i ? Math.max(0, v - db[i - 1]) : 0));
  const mean = on.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(on.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const peaks = [];
  for (let i = 3; i < n - 3; i++) {
    if (on[i] < mean + 1.5 * sd || db[i] < -45) continue;
    let max = true;
    for (let k = -3; k <= 3; k++) if (on[i + k] > on[i]) max = false;
    if (max && (!peaks.length || i - peaks.at(-1).i > FR * 0.1)) peaks.push({ i, s: on[i] });
  }
  // tempo: autocorrelación de la envolvente de ataques entre 60 y 180 BPM
  let best = { lag: 0, v: -1 };
  for (let lag = Math.round((FR * 60) / 180); lag <= Math.round((FR * 60) / 60); lag++) {
    let v = 0; for (let i = lag; i < n; i++) v += on[i] * on[i - lag];
    v /= n - lag;
    if (v > best.v) best = { lag, v };
  }
  const period = best.lag / FR, bpm = 60 / period;
  // fase de la rejilla: la que más ataques recoge
  let phase = { p: 0, v: -1 };
  for (let p = 0; p < best.lag; p++) { let v = 0; for (let i = p; i < n; i += best.lag) v += on[i]; if (v > phase.v) phase = { p, v }; }
  const beats = [];
  for (let i = phase.p; i < n; i += best.lag) beats.push(+(i / FR).toFixed(3));
  // compás de 4: el pulso fuerte es el de la posición con más energía
  let down = { k: 0, v: -1 };
  for (let k = 0; k < 4; k++) { let v = 0; for (let b = k; b < beats.length; b += 4) v += rms[Math.round(beats[b] * FR)] || 0; if (v > down.v) down = { k, v }; }
  const downbeats = beats.filter((_, b) => b % 4 === down.k);
  const sorted = [...peaks].sort((a, b) => b.s - a.s);
  const hits = sorted.slice(0, Math.max(1, Math.ceil(peaks.length * 0.15))).map((p) => +(p.i / FR).toFixed(3)).sort((a, b) => a - b);
  // pausas: tramos de al menos 0.25 s por debajo de -35 dB respecto al máximo
  const top = Math.max(...db), pauses = [];
  let st = -1;
  for (let i = 0; i <= n; i++) {
    const quiet = i < n && db[i] < top - 35;
    if (quiet && st < 0) st = i;
    if (!quiet && st >= 0) { if ((i - st) / FR >= 0.25) pauses.push({ start: +(st / FR).toFixed(3), end: +(i / FR).toFixed(3) }); st = -1; }
  }
  return { file: path.relative(dir, file), duration: +(n / FR).toFixed(3), bpm: +bpm.toFixed(1), beats, downbeats, hits, onsets: peaks.map((p) => +(p.i / FR).toFixed(3)), pauses };
}

const sources = {};
const fileArg = flagArg("--file");
if (fileArg) sources.track = path.resolve(dir, fileArg);
else {
  if (timeline.audio) sources.audio = path.join(dir, timeline.audio);
  if (timeline.voice) sources.voice = path.join(dir, timeline.voice);
}
const found = Object.entries(sources).filter(([, f]) => fs.existsSync(f));
if (!found.length) { console.error("✖ No hay audio que medir. Pon \"audio\" o \"voice\" en el timeline, o usa --file pista.wav"); process.exit(1); }
const result = {};
for (const [k, f] of found) result[k] = analyze(f);
fs.writeFileSync(path.join(dir, "beats.json"), JSON.stringify(result, null, 2));
for (const [k, r] of Object.entries(result))
  console.log(`✔ ${k}: ${r.file} · ${r.duration}s · ${r.bpm} BPM · ${r.beats.length} pulsos · ${r.hits.length} golpes · ${r.pauses.length} pausas`);
console.log(`✔ videos/${slug}/beats.json`);

if (hasFlag("--snap")) {
  const r = result.voice || result.track || result.audio;
  const targets = result.voice ? r.pauses.map((p) => (p.start + p.end) / 2) : [...r.downbeats, ...r.beats];
  const cuts = [];
  let acc = 0;
  for (const s of timeline.scenes) { acc += s.duration; cuts.push(acc); }
  const MIN = 1.2, WIN = 0.4;
  let prev = 0, moved = 0;
  const newCuts = cuts.map((c, i) => {
    if (i === cuts.length - 1) return c; // el final no se mueve
    // los compases fuertes van primero en la lista: ganan si están igual de cerca
    let best = c, bd = WIN;
    for (const t of targets) { const d = Math.abs(t - c); if (d < bd - 0.02 && t - prev >= MIN) { best = t; bd = d; } }
    if (best !== c) moved++;
    prev = best;
    return best;
  });
  newCuts.forEach((c, i) => { timeline.scenes[i].duration = +(c - (i ? newCuts[i - 1] : 0)).toFixed(2); });
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "timeline.json"), "utf8"));
  raw.scenes.forEach((s, i) => { s.duration = timeline.scenes[i].duration; });
  fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(raw, null, 2) + "\n");
  console.log(`✔ --snap: ${moved} de ${cuts.length - 1} cortes movidos a ${result.voice ? "pausas de la voz" : "pulsos"}. Repite npm run check.`);
}
