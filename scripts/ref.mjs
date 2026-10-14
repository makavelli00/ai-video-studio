// Referencia visual: saca un fotograma cada 0.5 s de un vídeo que te guste y una hoja con todos.
// Uso: npm run ref -- <video-de-referencia.mp4> [nombre]
//   → studio/02-reference/refs/<nombre>/frame-001.jpg … y sheet.jpg
// Luego Claude estudia la hoja y escribe refs/<nombre>/NOTES.md: paleta en hex, tipografía,
// duración de planos, transiciones, cámara y grano. Se copia la gramática, nunca el contenido.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, ffmpegPath } from "./lib/common.mjs";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error("Uso: npm run ref -- <video-de-referencia.mp4> [nombre]"); process.exit(1); }
const name = (process.argv[3] || path.basename(src, path.extname(src))).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const out = path.join(ROOT, "studio", "02-reference", "refs", name);
fs.mkdirSync(out, { recursive: true });
const ff = await ffmpegPath();
const run = (args) => { const r = spawnSync(ff, ["-v", "error", "-y", ...args]); if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); } };
run(["-i", src, "-vf", "fps=2,scale=360:-2", "-frames:v", "120", path.join(out, "frame-%03d.jpg")]);
const n = fs.readdirSync(out).filter((f) => f.startsWith("frame-")).length;
run(["-framerate", "1", "-i", path.join(out, "frame-%03d.jpg"), "-vf", `tile=6x${Math.ceil(n / 6)}:padding=6:color=0x222222`, "-frames:v", "1", path.join(out, "sheet.jpg")]);
console.log(`✔ ${path.relative(process.cwd(), out)}/ (${n} fotogramas, uno cada 0.5 s) + sheet.jpg`);
console.log("Siguiente paso: que Claude mire sheet.jpg y escriba NOTES.md (paleta, tipo, ritmo, transiciones).");
