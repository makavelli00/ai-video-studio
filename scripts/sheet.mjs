// Capa 5 · Crítico — pruebas visuales para revisar sin ver el vídeo diez veces.
// Uso: npm run sheet -- <video> [--format 1x1|4x5|16x9]
//   contact-sheet.png  3 instantes por escena (entrada, mitad, final)
//   phone-test.png     el final de cada escena a 360 px de ancho, como se ve en un móvil
//   strip.png          12 fotogramas seguidos alrededor del movimiento más rápido
//   keyframes/         el final de cada escena a tamaño completo
import fs from "node:fs";
import path from "node:path";
import { slugArg, loadVideo, openPlayer } from "./lib/common.mjs";

const slug = slugArg();
const { outDir, timeline, style, suffix } = loadVideo(slug);
const player = await openPlayer(timeline, style, slug);
const { page } = player;
const out = style?.motion?.sceneOut ?? 0.3;
const save = (name, data) => { const f = path.join(outDir, name); fs.writeFileSync(f, Buffer.from(data.split(",")[1], "base64")); return f; };
const ts = (t) => `${t.toFixed(1)}s`;

// hoja de contactos
const shots = [], finals = [];
let acc = 0;
timeline.scenes.forEach((s, i) => {
  const d = s.duration;
  [["entrada", 0.12 * d], ["mitad", 0.5 * d], ["final", Math.max(0.05, d - out - 0.05)]].forEach(([n, lt]) =>
    shots.push({ t: acc + lt, label: `#${i + 1} ${s.type} · ${n} (${ts(acc + lt)})` }));
  finals.push({ t: acc + Math.max(0.05, d - out - 0.05), label: `#${i + 1} ${s.type} (${ts(acc + d - out - 0.05)})` });
  acc += d;
});
const files = [save(`contact-sheet${suffix}.png`, await page.evaluate(([s]) => window.studioSheet(s, 3, 300), [shots]))];

// prueba del móvil: si algo no se lee aquí, no se lee en el feed
files.push(save(`phone-test${suffix}.png`, await page.evaluate(([s]) => window.studioSheet(s, 4, 360), [finals])));

// tira de 12 fotogramas alrededor del cambio más brusco (tirones, saltos, cosas que deslizan)
const motion = await page.evaluate(() => window.studioMotion(3));
const fps = player.info.fps;
const peak = motion.reduce((a, b) => (b.v > a.v ? b : a), { f: 0, v: 0 });
const f0 = Math.max(0, Math.min(player.info.totalFrames - 12, peak.f - 5));
const strip = Array.from({ length: 12 }, (_, i) => ({ t: (f0 + i) / fps, label: `f${f0 + i} (${ts((f0 + i) / fps)})` }));
files.push(save(`strip${suffix}.png`, await page.evaluate(([s]) => window.studioSheet(s, 6, 220), [strip])));

// fotogramas clave a tamaño completo
const keyDir = path.join(outDir, `keyframes${suffix}`);
fs.mkdirSync(keyDir, { recursive: true });
for (const f of fs.readdirSync(keyDir)) fs.unlinkSync(path.join(keyDir, f));
for (const [i, s] of timeline.scenes.entries()) {
  const png = await page.evaluate((tt) => { window.studio.renderAt(tt); return window.studioCanvas.toDataURL("image/png"); }, finals[i].t);
  fs.writeFileSync(path.join(keyDir, `${String(i + 1).padStart(2, "0")}-${s.type}.png`), Buffer.from(png.split(",")[1], "base64"));
}
await player.close();
for (const f of files) console.log(`✔ ${path.relative(process.cwd(), f)}`);
console.log(`  (movimiento más rápido hacia ${ts(peak.f / fps)}, fotograma ${peak.f})`);
console.log(`✔ ${path.relative(process.cwd(), keyDir)}/ (${timeline.scenes.length} fotogramas clave)`);
