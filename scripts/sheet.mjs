// Capa 5 · Crítico — hoja de contactos con 3 instantes por escena (entrada, mitad, final).
// Uso: npm run sheet -- <video>
import fs from "node:fs";
import path from "node:path";
import { slugArg, loadVideo, openPlayer } from "./lib/common.mjs";

const slug = slugArg();
const { outDir, timeline, style } = loadVideo(slug);
const player = await openPlayer(timeline, style);
const shots = [];
let acc = 0;
const out = style?.motion?.sceneOut ?? 0.3;
timeline.scenes.forEach((s, i) => {
  const d = s.duration;
  [["entrada", 0.12 * d], ["mitad", 0.5 * d], ["final", Math.max(0.05, d - out - 0.05)]].forEach(([n, lt]) =>
    shots.push({ t: acc + lt, label: `#${i + 1} ${s.type} · ${n} (${(acc + lt).toFixed(1)}s)` }));
  acc += d;
});
const data = await player.page.evaluate(([s]) => window.studioSheet(s, 3, 300), [shots]);
const file = path.join(outDir, "contact-sheet.png");
fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));

// Fotogramas clave sueltos a tamaño completo (final de cada escena), útiles para revisar texto.
const keyDir = path.join(outDir, "keyframes");
fs.mkdirSync(keyDir, { recursive: true });
for (const f of fs.readdirSync(keyDir)) fs.unlinkSync(path.join(keyDir, f));
let a2 = 0;
for (const [i, s] of timeline.scenes.entries()) {
  const t = a2 + Math.max(0.05, s.duration - out - 0.05);
  const png = await player.page.evaluate((tt) => { window.studio.renderAt(tt); return window.studioCanvas.toDataURL("image/png"); }, t);
  fs.writeFileSync(path.join(keyDir, `${String(i + 1).padStart(2, "0")}-${s.type}.png`), Buffer.from(png.split(",")[1], "base64"));
  a2 += s.duration;
}
await player.close();
console.log(`✔ ${path.relative(process.cwd(), file)}`);
console.log(`✔ ${path.relative(process.cwd(), keyDir)}/ (${timeline.scenes.length} fotogramas clave)`);
