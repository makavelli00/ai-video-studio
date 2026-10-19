// Sensores — comprobaciones automáticas antes de enseñar o exportar nada.
// Uso: npm run check -- <video>     (sale con código 1 si hay errores)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, slugArg, loadVideo, openPlayer } from "./lib/common.mjs";

const { SCENE_TYPES, parseRich } = await import(pathToFileURL(path.join(ROOT, "engine", "engine.js")).href);
const slug = slugArg();
const errors = [], warnings = [];
// Los 6 contadores del smoke test: todos deben quedar en 0.
const counters = { runtimeErrors: 0, outOfBounds: 0, overlaps: 0, invalidColors: 0, nonDeterministic: 0, seam: 0 };
let v;
try { v = loadVideo(slug); } catch (e) { console.error("✖ " + e.message); process.exit(1); }
const { dir, outDir, timeline: tl } = v;

const words = (s) => parseRich(s || "").length;
const stars = (s) => ((s || "").match(/\*/g) || []).length % 2 !== 0;

// ---- estructura ----
if (!Array.isArray(tl.scenes) || !tl.scenes.length) errors.push("timeline.scenes está vacío");
if (v.fmt === "9x16" && ((tl.width && tl.width !== 1080) || (tl.height && tl.height !== 1920))) warnings.push("El formato estándar de Reels es 1080x1920");
if (tl.fps && tl.fps !== 30) warnings.push(`fps=${tl.fps}; el estudio trabaja a 30`);
if (tl.audio && !fs.existsSync(path.join(dir, tl.audio))) errors.push(`No existe el audio ${tl.audio}`);
for (const [i, s] of (tl.scenes || []).entries()) if (s.image && !fs.existsSync(path.join(dir, s.image))) errors.push(`Escena ${i + 1}: no existe la imagen ${s.image}`);

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
    case "folding":
    case "doubling": texts.push(s.countLabel, s.sizeLabel, ...(s.marks || []).map((m) => m.label));
      if (!s.source) warnings.push(`${id}: marcas sin "source". Cada altura o distancia tiene que tener fuente.`); break;
    case "cta": need("text"); texts.push(s.text, s.button, s.sub); break;
    case "casefile": if (!s.rows?.length) errors.push(`${id}: necesita "rows" [{k, v}]`);
      texts.push(s.title, s.stamp, ...(s.rows || []).flatMap((r) => [r.k, r.v]));
      if (!s.source) warnings.push(`${id}: expediente sin "source". En misterios, cada dato tiene que poder comprobarse.`); break;
    case "panel": need("text"); need("image"); texts.push(s.kicker, s.text, s.note); break;
    case "theories": need("items"); texts.push(s.title, ...(s.items || []).map((it) => (typeof it === "string" ? it : it.text))); break;
  }
  texts.filter(Boolean).forEach((t) => { if (stars(t)) errors.push(`${id}: asteriscos sin cerrar en "${t}"`); });
  const n = texts.filter(Boolean).reduce((a, t) => a + words(t), 0);
  const min = n / READ_WPS + 0.8;
  if (s.duration && s.duration + 0.05 < min) warnings.push(`${id}: ${n} palabras en ${s.duration}s; necesita ~${min.toFixed(1)}s para leerse`);
});
if (tl.scenes?.[0]?.type !== "hook") warnings.push("La primera escena debería ser un hook");
if (tl.scenes?.[0]?.duration > 3.5) warnings.push("El hook dura más de 3.5 s; el gancho tiene que llegar antes");
if (tl.scenes?.at(-1)?.type !== "cta") warnings.push("La última escena debería ser un cta (llamada al ebook)");
if (tl.voice && !fs.existsSync(path.join(dir, tl.voice))) warnings.push(`No existe la voz ${tl.voice}; se exportará sin voz en off`);
if (total && (total < 15 || total > 60)) warnings.push(`Duración total ${total.toFixed(1)}s, fuera del rango del estudio (15–60 s)`);

// ---- sensores visuales (zonas seguras) ----
if (!errors.length) {
  try {
    const p = await openPlayer(v.timeline, v.style, slug);
    const rep = await p.page.evaluate(() => window.studio.layoutReport());
    const S = rep.safe, tol = 2;
    // textos que se pisan dentro de la misma escena
    for (const sc of rep.scenes) {
      const bx = sc.boxes;
      for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) {
        const a = bx[i], b = bx[j];
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const inside = (p, q) => p.x >= q.x - tol && p.y >= q.y - tol && p.x + p.w <= q.x + q.w + tol && p.y + p.h <= q.y + q.h + tol;
        if (ix > 4 && iy > 4 && !inside(a, b) && !inside(b, a)) {
          counters.overlaps++;
          errors.push(`Escena ${sc.scene} (${sc.type}): "${a.label}" y "${b.label}" se solapan (${Math.round(ix)}×${Math.round(iy)}px)`);
        }
      }
    }
    // determinismo: el mismo fotograma, pedido directamente y después de otros, tiene que salir idéntico
    const det = await p.page.evaluate(() => {
      const st = window.studio, cv = window.studioCanvas, n = st.totalFrames;
      const shot = (f) => { st.renderFrame(f); return cv.toDataURL("image/png"); };
      const probes = [Math.floor(n * 0.37), Math.floor(n * 0.81)];
      const first = probes.map(shot);
      shot(0); shot(n - 1);
      const bad = probes.filter((f, i) => shot(f) !== first[i]);
      return { bad, seam: shot(0) === shot(n - 1) };
    });
    for (const f of det.bad) { counters.nonDeterministic++; errors.push(`El fotograma ${f} no sale igual dos veces: hay algo no determinista (Math.random, Date.now, timers…)`); }
    if (v.timeline.loop && !det.seam) { counters.seam++; errors.push("Bucle: el primer y el último fotograma no coinciden píxel a píxel"); }
    for (const sc of rep.scenes) for (const b of sc.boxes) {
      const where = `Escena ${sc.scene} (${sc.type}) · ${b.label}`;
      const before = errors.length;
      if (b.y < S.top - tol) errors.push(`${where}: invade la zona superior (${Math.round(S.top - b.y)}px)`);
      if (b.y + b.h > S.bottom + tol) errors.push(`${where}: invade la zona inferior de la interfaz (${Math.round(b.y + b.h - S.bottom)}px). Recorta texto o baja "size".`);
      if (b.x < S.left - tol || b.x + b.w > S.right + tol) errors.push(`${where}: se sale por los lados. ¿Una palabra demasiado larga?`);
      if (b.maxWidth && b.w > b.maxWidth + tol) errors.push(`${where}: una palabra no cabe en el ancho disponible`);
      if (errors.length > before) counters.outOfBounds++;
    }
    if (p.errors.length) { counters.runtimeErrors += p.errors.length; errors.push(...p.errors.map((e) => "Error del motor: " + e)); }
    await p.close();
  } catch (e) { counters.runtimeErrors++; errors.push(e.message); }
}

// ---- colores válidos ----
for (const [k, c] of Object.entries(v.style.colors || {})) {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c))) { counters.invalidColors++; errors.push(`Color no válido en style.colors.${k}: "${c}" (usa #RRGGBB)`); }
}
fs.writeFileSync(path.join(outDir, `check${v.suffix}.json`), JSON.stringify({ slug, total, counters, errors, warnings, at: new Date().toISOString() }, null, 2));
console.log(`\nCheck · ${slug} · ${v.fmt} · ${tl.scenes?.length || 0} escenas · ${total.toFixed(1)} s`);
const names = { runtimeErrors: "errores de ejecución", outOfBounds: "fuera de la zona segura", overlaps: "textos solapados", invalidColors: "colores no válidos", nonDeterministic: "no determinista", seam: tl.loop ? "costura del bucle" : "costura (solo con loop: true)" };
console.log("  Smoke test: " + Object.entries(counters).map(([k, n]) => `${n === 0 ? "✓" : "✖"} ${names[k]} ${n}`).join(" · "));
warnings.forEach((w) => console.log("  ⚠ " + w));
errors.forEach((e) => console.log("  ✖ " + e));
if (errors.length) { console.log(`\n✖ ${errors.length} error(es). Corrige antes de seguir.`); process.exit(1); }
console.log(`\n✔ Sin errores${warnings.length ? ` (${warnings.length} aviso(s))` : ""}.`);
