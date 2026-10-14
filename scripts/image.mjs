// Imagen con IA (Gemini) para un vídeo: la guarda en videos/<v>/assets/ en 1080×1920.
// Uso: npm run image -- <video> "descripción de la imagen" [--name nombre-archivo]
//   → videos/<v>/assets/<nombre>.jpg y una línea en brief.md con el prompt (marcada como IA).
// La clave va en un archivo .env en la raíz del repo (no se sube a git): GEMINI_API_KEY=...
// Opcional: GEMINI_IMAGE_MODEL para cambiar de modelo.
// La imagen es material, no un vídeo terminado: pasa por check, sheet y el gate visual como cualquier escena `panel`.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, ffmpegPath } from "./lib/common.mjs";

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const nameArg = flag("--name");
const [video, prompt] = args;
if (!video || !prompt) { console.error('Uso: npm run image -- <video> "descripción de la imagen" [--name nombre-archivo]'); process.exit(1); }
const dir = path.join(ROOT, "videos", video);
if (!fs.existsSync(dir)) { console.error(`No existe videos/${video}/. Créalo antes con npm run new -- ${video}`); process.exit(1); }

// .env sencillo (CLAVE=valor por línea), sin dependencias.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("Falta GEMINI_API_KEY. Crea un archivo .env en la raíz del repo con la línea GEMINI_API_KEY=tu_clave"); process.exit(1); }
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({
    contents: [{ parts: [{ text: `${prompt}\n\nVertical 9:16 composition, no text, no letters, no logos, no watermarks.` }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
  }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`Gemini respondió ${res.status}: ${data.error?.message || "sin detalle"}`); process.exit(1); }
const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
if (!part) { console.error("Gemini no devolvió imagen (puede haberla bloqueado por contenido). Prueba otra descripción."); process.exit(1); }

const assets = path.join(dir, "assets");
fs.mkdirSync(assets, { recursive: true });
const n = fs.readdirSync(assets).filter((f) => /\.(jpe?g|png)$/i.test(f)).length + 1;
const slug = (nameArg || prompt).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const file = `${String(n).padStart(2, "0")}-${slug}.jpg`;
const tmp = path.join(assets, `.tmp-${Date.now()}.png`);
fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, "base64"));
const ff = await ffmpegPath();
const r = spawnSync(ff, ["-v", "error", "-y", "-i", tmp, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-q:v", "2", path.join(assets, file)]);
fs.rmSync(tmp, { force: true });
if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); }

const brief = path.join(dir, "brief.md");
const note = `- Imagen IA (${model}): assets/${file} · prompt: "${prompt.replace(/\s+/g, " ")}"\n`;
let text = fs.existsSync(brief) ? fs.readFileSync(brief, "utf8") : "";
if (!text.includes("## Imágenes generadas con IA")) text += `${text.endsWith("\n") || !text ? "" : "\n"}\n## Imágenes generadas con IA\n`;
fs.writeFileSync(brief, text + note);

console.log(`✔ videos/${video}/assets/${file} (1080×1920)`);
console.log(`Úsala en el timeline: { "type": "panel", "image": "assets/${file}", "text": "…" }`);
