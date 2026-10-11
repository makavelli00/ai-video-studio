// Sensores — comprobaciones automáticas antes de enseñar o exportar nada.
// Uso: npm run check -- <video>     (sale con código 1 si hay errores)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, slugArg, loadVideo, openPlayer } from "./lib/common.mjs";

const { SCENE_TYPES, parseRich } = await import(pathToFileURL(path.join(ROOT, "engine", "engine.js")).href);
const slug = slugArg();
const errors = [], warnings = [];
let v;
try { v = loadVideo(slug); } catch (e) { console.error("✖ " + e.message); process.exit(1); }
const { dir, outDir, timeline: tl } = v;

const words = (s) => parseRich(s || "").length;
const stars = (s) => ((s || "").match(/\*/g) || []).length % 2 !== 0;

// ---- estructura ----
if (!Array.isArray(tl.scenes) || !tl.scenes.length) errors.push("timeline.scenes está vacío");
if ((tl.width && tl.width !== 1080) || (tl.height && tl.height !== 1920)) warnings.push("El formato estándar de Reels es 1080x1920");
if (tl.fps && tl.fps !== 30) warnings.push(`fps=${tl.fps}; el estudio trabaja a 30`);
if (tl.audio && !fs.existsSync(path.join(dir, tl.audio))) errors.push(`No existe el audio ${tl.audio}`);

const READ_WPS = 3.3; // palabras por segundo que se pueden leer cómodamente en pantalla
let total = 0;
(tl.scenes || []).forEach((s, i) => {
  const id = `Escena ${i + 1} (${s.type})`;
  if (!SCENE_TYPES.includes(s.type)) { errors.push(`${id}: tipo desconocido. Usa: ${SCENE_TYPES.join(", ")}`); return; }
  if (!(s.duration > 0)) errors.push(`${id}: falta duration (segundos)`);
  total += s.duration || 0;
  const texts = [];
  const need = (k) => { if (!s[k]) errors.push(`${id}: falta "${k}"`); };
  switch (s.type) {
    case "hook": need("text"); texts.push(s.text, s.sub); if (words(s.text) > 12) warnings.push(`${id}: el gancho tiene ${words(s.text)} palabras; mejor ≤ 12`); break;
    case "statement": need("text"); texts.push(s.kicker, s.text, s.note); break;
    case "list": need("items"); texts.push(s.title, ...(s.items || []));
      if (s.items && (s.items.length < 2 || s.items.length > 5)) warnings.push(`${id}: ${s.items.length} puntos; lo ideal es 2–5`); break;
    case "number": if (s.value === undefined) errors.push(`${id}: falta "value"`); texts.push(s.label);
      if (!s.source) warnings.push(`${id}: cifra sin "source". No publiques datos sin fuente verificable.`); break;
    case "compare": for (const k of ["left", "right"]) { if (!s[k]?.label || !s[k]?.text) errors.push(`${id}: "${k}" necesita label y text`); }
      texts.push(s.title, s.left?.text, s.right?.text); break;
    case "cta": need("text"); texts.push(s.text, s.button, s.sub); break;
  }
  texts.filter(Boolean).forEach((t) => { if (stars(t)) errors.push(`${id}: asteriscos sin cerrar en "${t}"`); });
  const n = texts.filter(Boolean).reduce((a, t) => a + words(t), 0);
  const min = n / READ_WPS + 0.8;
  if (s.duration && s.duration + 0.05 < min) warnings.push(`${id}: ${n} palabras en ${s.duration}s; necesita ~${min.toFixed(1)}s para leerse`);
});
if (tl.scenes?.[0]?.type !== "hook") warnings.push("La primera escena debería ser un hook");
if (tl.scenes?.[0]?.duration > 3.5) warnings.push("El hook dura más de 3.5 s; el gancho tiene que llegar antes");
if (tl.scenes?.at(-1)?.type !== "cta") warnings.push("La última escena debería ser un cta (llamada al ebook)");
if (total && (total < 15 || total > 60)) warnings.push(`Duración total ${total.toFixed(1)}s, fuera del rango del estudio (15–60 s)`);

// ---- sensores visuales (zonas seguras) ----
if (!errors.length) {
  try {
    const p = await openPlayer(v.timeline, v.style);
    const rep = await p.page.evaluate(() => window.studio.layoutReport());
    const S = rep.safe, tol = 2;
    for (const sc of rep.scenes) for (const b of sc.boxes) {
      const where = `Escena ${sc.scene} (${sc.type}) · ${b.label}`;
      if (b.y < S.top - tol) errors.push(`${where}: invade la zona superior (${Math.round(S.top - b.y)}px)`);
      if (b.y + b.h > S.bottom + tol) errors.push(`${where}: invade la zona inferior de la interfaz (${Math.round(b.y + b.h - S.bottom)}px). Recorta texto o baja "size".`);
      if (b.x < S.left - tol || b.x + b.w > S.right + tol) errors.push(`${where}: se sale por los lados. ¿Una palabra demasiado larga?`);
      if (b.maxWidth && b.w > b.maxWidth + tol) errors.push(`${where}: una palabra no cabe en el ancho disponible`);
    }
    if (p.errors.length) errors.push(...p.errors.map((e) => "Error del motor: " + e));
    await p.close();
  } catch (e) { errors.push(e.message); }
}

fs.writeFileSync(path.join(outDir, "check.json"), JSON.stringify({ slug, total, errors, warnings, at: new Date().toISOString() }, null, 2));
console.log(`\nCheck · ${slug} · ${tl.scenes?.length || 0} escenas · ${total.toFixed(1)} s`);
warnings.forEach((w) => console.log("  ⚠ " + w));
errors.forEach((e) => console.log("  ✖ " + e));
if (errors.length) { console.log(`\n✖ ${errors.length} error(es). Corrige antes de seguir.`); process.exit(1); }
console.log(`\n✔ Sin errores${warnings.length ? ` (${warnings.length} aviso(s))` : ""}.`);
