import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function slugArg() {
  const slug = process.argv[2];
  if (!slug) {
    const vids = fs.existsSync(path.join(ROOT, "videos")) ? fs.readdirSync(path.join(ROOT, "videos")).filter((d) => !d.startsWith(".")) : [];
    console.error("Indica el vídeo. Ejemplo: npm run render -- ejemplo-errores-ia");
    if (vids.length) console.error("Vídeos disponibles: " + vids.join(", "));
    process.exit(1);
  }
  return slug;
}

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { throw new Error(`JSON inválido en ${path.relative(ROOT, file)}: ${e.message}`); }
}

export const FORMATS = { "9x16": [1080, 1920], "4x5": [1080, 1350], "1x1": [1080, 1080], "16x9": [1920, 1080] };

// Valor de una opción de la línea de comandos: --format 1x1 o --format=1x1.
export function flagArg(name) {
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return argv[i + 1];
    if (argv[i].startsWith(name + "=")) return argv[i].slice(name.length + 1);
  }
  return undefined;
}
export const hasFlag = (name) => process.argv.slice(3).includes(name);

export function loadVideo(slug) {
  const dir = path.join(ROOT, "videos", slug);
  if (!fs.existsSync(dir)) throw new Error(`No existe videos/${slug}. Créalo con: npm run new -- ${slug}`);
  const timeline = readJSON(path.join(dir, "timeline.json"));
  if (!timeline) throw new Error(`Falta videos/${slug}/timeline.json`);
  const style = readJSON(path.join(ROOT, "studio", "02-reference", "style.json"), {});
  const over = readJSON(path.join(dir, "style.json"), {});
  for (const k of Object.keys(over)) style[k] = typeof over[k] === "object" ? { ...(style[k] || {}), ...over[k] } : over[k];
  const outDir = path.join(dir, "out");
  fs.mkdirSync(outDir, { recursive: true });
  // --format 1x1 | 4x5 | 16x9 | 9x16: mismo timeline, otro lienzo (el motor reajusta la composición).
  const fmt = flagArg("--format");
  let suffix = "";
  if (fmt && fmt !== "9x16") {
    if (!FORMATS[fmt]) throw new Error(`Formato desconocido "${fmt}". Usa: ${Object.keys(FORMATS).join(", ")}`);
    [timeline.width, timeline.height] = FORMATS[fmt];
    suffix = `-${fmt}`;
  }
  return { slug, dir, outDir, timeline, style, fmt: fmt || "9x16", suffix };
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".otf": "font/otf", ".ttf": "font/ttf", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4" };

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }));
  });
}

export async function openPlayer(timeline, style, slug) {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error("Falta Playwright. Ejecuta: npm install && npm run setup"); }
  const srv = await startServer();
  const browser = await chromium.launch(chromiumOptions());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${srv.url}/engine/player.html`);
  await page.waitForFunction(() => window.studioReady === true);
  const info = await page.evaluate(([t, s, b]) => window.studioInit(t, s, b), [timeline, style, slug ? `/videos/${slug}` : ""]);
  if (errors.length) throw new Error("Error en el motor: " + errors.join(" | "));
  return {
    page, info, errors,
    close: async () => { await browser.close(); srv.close(); },
  };
}

// Chromium: CHROMIUM_PATH > el que trae Claude Code en la nube > el de `npm run setup`.
const CLOUD_CHROMIUM = "/opt/pw-browsers/chromium";
function chromiumOptions() {
  if (process.env.CHROMIUM_PATH) return { executablePath: process.env.CHROMIUM_PATH };
  if (fs.existsSync(CLOUD_CHROMIUM)) return { executablePath: CLOUD_CHROMIUM };
  return {};
}

export async function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const m = await import("ffmpeg-static"); if (m.default && fs.existsSync(m.default)) return m.default; } catch {}
  return "ffmpeg";
}
