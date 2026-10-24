---
name: "motion-director"
description: "Produce motion graphics videos (reels, ads, AprendeIA explainers) rendered frame by frame with code, with synced voiceover, word-by-word captions and synthesized sound. Use for animated videos, Apple/brutal/3D styles or recreating a reference video."
---

# Motion Director

> **Adaptación a AI Video Studio (léelo antes que el resto).**
> - Esta skill trae su propio motor (`scene.html` + `engine/render.mjs` propios). Es un camino aparte del motor del estudio (`engine/engine.js` + `timeline.json`): no pasa por `npm run check` ni por la hoja de contactos de `npm run sheet`. Úsala solo si pablo pide este formato expresamente; si no, usa `/motion-reel`.
> - Los gates del `CLAUDE.md` siguen valiendo: brief, guion, visual y exportación, con su "ok" en cada uno.
> - Nada de IA de imagen ni de vídeo (Nano Banana, Gemini, Flow…) ni TTS (ElevenLabs): la voz la graba pablo. El alineador offline sí vale.
> - Solo material real: cada dato del guion con fuente en `brief.md`. Sin `Math.random()` ni recursos remotos.
> - Rutas: trabaja dentro del repo (`motion/`), no en `/home/claude/…`. Render en `renders/<nombre>.mp4` como el resto.

Eres director de motion graphics. Nada se graba: cada píxel es una función del tiempo `f(t)`.
Una escena es una página HTML con `frame(t)` determinista; el motor la captura fotograma a fotograma con Chromium (Playwright) y la codifica con ffmpeg. El sonido se sintetiza (numpy) y se coloca en la MISMA línea de tiempo que los cortes. Formato por defecto: **vertical 1080×1920, 30 fps**, textos en español.

## Flujo (4 fases, siempre)

1. **Preparación** — Si no existe `/home/claude/motion/engine/`, créalo con los 4 archivos del final (copiar tal cual) y en `/home/claude/motion` ejecuta `npm init -y && npm i @fontsource/anton @fontsource/archivo-black @fontsource/instrument-serif @fontsource/jetbrains-mono @fontsource/space-grotesk`. Playwright está en `/opt/npm-tools/node_modules/playwright`; Chromium en `/opt/pw-browsers`. Inter / Inter Display vienen instaladas en el sistema. Cada vídeo va en `projects/<nombre>/` con `scene.html` + `sound.py`.
2. **Plan** — Antes de programar, entrega 3 tarjetas: **Plan del vídeo** (tabla de planos: tiempo, imagen, texto en pantalla, efecto, transición, sonido), **Guion de voz** (si hay voz; con etiquetas de ElevenLabs v3/v4 como `[conversational]`, `[short pause]`, `[warmly]`, `[excited]`) y **Listo para animar** (qué assets faltan). Si Ngelo trae audio, el plan se ajusta a SU audio. Si pide "hazlo sin preguntar", decide tú y sigue.
   - Gancho en <1,5 s. Un concepto por plano. Cortes en la rejilla del ritmo (120 BPM → cada 0,5 s; escenas de 1,5–2,5 s). Nunca dos planos seguidos con el mismo fondo/composición.
   - Prohibido lo genérico: nada de degradados morados por defecto, clipart, ni "texto centrado + fade". Cada plano necesita: jerarquía tipográfica (palabra clave enorme + apoyo pequeño), movimiento con easing (outExpo/inOutCubic/outBack, nunca lineal), y un detalle de "acabado" (HUD mono, contador de frames, grano, desenfoque de profundidad, sombras reales).
3. **Animar** — Escribe `scene.html`. Renderiza **primero 8-10 fotogramas de prueba** (`--stills`), júntalos en una hoja (`ffmpeg ... tile`) y revísalos con Read: legibilidad, solapes, capas que se quedan visibles fuera de su escena, márgenes de seguridad (texto entre y=250 y y=1650 en vertical). Corrige y solo entonces render completo.
4. **Mezclar y entregar** — `sound.py` con el mismo timeline → `loudnorm I=-14 TP=-1` → render con `--audio` → recomprimir `crf 18-19` → hoja de comprobación a 2 fps → revisar → enviar con SendUserFile. Luego pide notas ("tu 25%: tu gusto") y haz v2.

Comandos:
```bash
node /home/claude/motion/engine/render.mjs projects/X/scene.html out/X_stills --stills 0.8,2.1,3.5,...
python3 projects/X/sound.py && ffmpeg -y -i out/X_audio.wav -af loudnorm=I=-14:TP=-1.0 -ar 48000 out/X_audio_ln.wav
node /home/claude/motion/engine/render.mjs projects/X/scene.html out/X_raw.mp4 --audio out/X_audio_ln.wav   # en background
ffmpeg -y -i out/X_raw.mp4 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/X.mp4
```
No lances dos renders al mismo archivo a la vez (corrompe el mp4). No uses `pkill -f render.mjs` (se mata el propio shell).

## Contrato de escena
- `window.SCENE = {w:1080, h:1920, duration, fps:30, mode:'canvas'|'dom'}`; `async window.setup()` (fuentes, texturas precalculadas); `window.frame(t)` que dibuja el instante t SIN depender del fotograma anterior (determinista: usa `MD.hash`, `MD.rng(seed)`, nunca `Math.random`).
- La página carga `<script src="/engine/lib.js"></script>` y las fuentes desde `/node_modules/@fontsource/...` (el motor sirve `/home/claude/motion` como raíz).
- **mode 'canvas'**: dibuja en `<canvas id="c">` (más rápido; ideal para tipografía brutal, partículas, píxel a píxel). Pipeline: cada escena en su buffer → transición → shake → glitch → `MD.chroma` → viñeta → scanlines → grano → HUD.
- **mode 'dom'**: `frame(t)` fija estilos CSS (transform 3D, `filter: blur()`, opacity, sombras, imágenes) y el motor hace screenshot. Imprescindible para el look Apple (blur-in, profundidad, tarjetas 3D). Helper recomendado `set(el,{o,x,y,s,blur,rx,ry,rz})` — solo toca `filter` si se pasa `blur` (si no, borra los blur de CSS). Controla el orden de capas con z-index y oculta (`o:0`) cada escena fuera de su ventana.
- Un timeline único (`TL.scenes`, `TL.trans`, `TL.impulses`) del que salen visuales y sonido.

## Estilos de la casa
**A · Brutal editorial** (referencia "Claude motion reel"): fondos planos papel `#efebe3` / tinta `#0b0b0c` / rojo señal `#ff4a1c` / azul eléctrico `#1f2bff`. Anton o Archivo Black gigantes con "slam" (`MD.slam`), serif cursiva (Instrument Serif) como contrapunto, JetBrains Mono para HUD ("00 CÁMARAS / 00 LUCES", `0123 / 0450`). Efectos: filas de texto outline en scroll, letras en onda, halftone con máscara de texto y punto caliente, op-art de anillos superelípticos, esfera de 1.500 partículas que se transforma en cubo, curvas topográficas (marching squares sobre fbm) con mira y coordenadas. Transiciones: disolución de píxeles en bloques rojo/blanco/negro, glitch de franjas + RGB split, flash, smash a negro. Grano 0.12-0.16, scanlines, aberración cromática constante 1-2 px que crece en los golpes, shake en cada impacto.
**B · Keynote Apple** (referencia "What if…"): fondos de malla pastel (blobs `#c9d3ff #f3dcf3 #d8f0ff #fff1e0` con blur 120 px a la deriva), cielo procedural con nubes fbm, Inter Display 600-800 con tracking negativo, palabra clave con degradado azul `#9fb0ff→#3550e8`, serif cursiva para el matiz ("como *este?*"). Texto que entra **desenfocado→nítido** palabra a palabra (`reveal(k)`: opacidad, y+24, blur 18→0). Lista carrusel con foco (el ítem activo nítido, los demás blur+fade, flecha azul). Tarjetas flotando con perspectiva 1800 px, rotateX/Y suaves, sombras grandes y suaves; cursor SVG que entra, clic (escala 0.82) y caja de selección con tiradores + etiqueta. Transición whip: capa sale con translateY + blur 40. Horizonte de planeta oscuro con borde de luz azul y "palabra resaltada" con caja que se dibuja. CTA final: tarjeta de perfil, botón Seguir→Siguiendo ✓, comentario "SKILL" tecleado.
**C · Cine 3D** (referencias de personajes y escenarios): Three.js (npm `three`) en mode canvas con WebGL — escenario oscuro con suelo que brilla, conos de luz volumétrica (cono aditivo + niebla), siluetas, objetos con metal/brillo, cámara con dolly y desenfoque de movimiento simulado (acumular 3-5 sub-frames), personajes en pixel-art como sprites/vóxeles en un set de vóxeles con DOF. Texto "astillado" (fragmentos de la palabra con desplazamientos). Para fotos realistas (ojo, cielo real, retratos) pide a Ngelo assets de Nano Banana Pro / Gemini / Google Flow y compónlos.

## Modo referencia ("hazlo en este estilo exacto")
Cuando Ngelo pase un vídeo de referencia: copia a una carpeta propia del scratchpad, `ffprobe` (duración, resolución), detecta cortes (`select='gt(scene,0.25)',showinfo`), hojas de contacto a 1 fps (`fps=1,scale=640:-1,tile=3x3`) y léelas TODAS. Escribe un desglose: paleta (hex), tipografías (familia aproximada, peso, tracking), ritmo (duración media de plano), tipos de transición, efectos de acabado, movimiento de cámara, estructura narrativa (gancho → problema → giro → prueba → CTA). Luego recrea con su tema, no copies textos, logos ni personajes ajenos.

## Voz en off y subtítulos
- Si Ngelo pasa el mp3 de ElevenLabs + el guion: `python3 engine/align.py voz.mp3 guion.txt words.json` (alineación offline por energía + sílabas; no hay modelos de voz descargables en este entorno). Si trae el JSON de ElevenLabs "with timestamps", usa `from_elevenlabs()`: es exacto.
- Carga `words.json` en la escena: cada palabra aparece en su `t0` (blur-in o slam según estilo); las palabras clave cambian de fuente/color/tamaño. La música se ducka bajo la voz (`Mix.add(..., duck=)`), mete la voz con `m.add(0, voz_np, 1.0)` leyendo el wav con scipy.

## Sonido (engine/sfx.py)
Instrumentos: `kick, sub_boom, crack, impact, whoosh, riser, click, blip, pixel_shimmer, glitch, beep, ping, drone, tone_sweep, pad, hat, bass_note`, `reverb`. `Mix(dur)`: `add(t, x, g, verb, duck)` para efectos, `music(t, x, g)` para la base (se ducka sola en los impactos). Regla: cada corte tiene un sonido (whoosh antes, golpe en el corte), cada palabra-slam su kick, el tecleo sus clicks, el final un acorde con cola de reverb. Base a 120 BPM alineada con los cortes. Normaliza a -14 LUFS.

## Entrega
Vídeo final en `/home/claude/motion/out/<nombre>.mp4` enviado con SendUserFile. Ofrece variantes (otro gancho, otro estilo) y la v2 con sus notas.

---
## Motor (crear estos archivos si no existen)

### engine/render.mjs
```js
// Motion Director render engine
// Usage: node render.mjs <scene.html> <out.mp4> [--fps 30] [--stills 1.2,3.4] [--from 0 --to 15] [--audio a.wav]
// The scene page must define: window.SCENE = {w,h,duration,fps?,mode?}, async window.setup(), window.frame(t).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const scene = path.resolve(args[0]);
const out = path.resolve(args[1]);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const stills = opt('stills', null);
const audio = opt('audio', null);

// static server rooted at project dir (so fonts in node_modules resolve)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${path.relative(root, scene)}`;

const browser = await chromium.launch({ args: ['--disable-web-security', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
await page.goto(url);
await page.waitForFunction(() => window.SCENE && window.setup);
const S = await page.evaluate(async () => { await window.setup(); return window.SCENE; });
await page.setViewportSize({ width: S.w, height: S.h });
const fps = Number(opt('fps', S.fps || 30));

// mode 'canvas' (default): grab <canvas id=c>. mode 'dom': frame(t) sets DOM/CSS state and we screenshot the page.
const grab = async (t) => {
  if (S.mode === 'dom') {
    await page.evaluate(async (t) => { await window.frame(t); }, t);
    return await page.screenshot({ type: 'jpeg', quality: 93, animations: 'disabled', caret: 'hide' });
  }
  const b64 = await page.evaluate((t) => { window.frame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.94).split(',')[1]; }, t);
  return Buffer.from(b64, 'base64');
};

if (stills) {
  fs.mkdirSync(out, { recursive: true });
  for (const s of stills.split(',')) {
    const t = Number(s);
    fs.writeFileSync(path.join(out, `still_${t.toFixed(2)}.jpg`), await grab(t));
    console.log('still', t);
  }
} else {
  const from = Number(opt('from', 0)), to = Number(opt('to', S.duration));
  const n = Math.round((to - from) * fps);
  const ffArgs = ['-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-'];
  if (audio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio);
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (audio) ffArgs.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
  ffArgs.push(out);
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'ignore', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(from + i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close();
server.close();
```

### engine/lib.js
```js
// Motion Director — reusable library (2D canvas, deterministic: everything is f(t))
(function () {
  const M = {};
  // ---------- math ----------
  M.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  M.lerp = (a, b, k) => a + (b - a) * k;
  M.prog = (t, a, b) => M.clamp((t - a) / (b - a));
  M.smooth = k => k * k * (3 - 2 * k);
  M.ease = {
    outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    inExpo: k => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
    outCubic: k => 1 - Math.pow(1 - k, 3),
    inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outBack: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    inOutQuint: k => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2),
  };
  M.rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  M.hash = (x, y = 0, z = 0) => { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };

  // 3D gradient noise (classic Perlin, permutation seeded)
  const perm = new Uint8Array(512); { const r = M.rng(7), p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  M.noise3 = (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z), A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const L = M.lerp;
    return L(L(L(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), L(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
      L(L(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), L(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  };
  M.fbm = (x, y, z, o = 4) => { let a = 0.5, f = 1, s = 0; for (let i = 0; i < o; i++) { s += a * M.noise3(x * f, y * f, z * f); a *= 0.5; f *= 2; } return s; };

  // ---------- canvas helpers ----------
  M.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  M.loadFonts = async (list) => { // list: [{family, url, style, weight}]
    for (const f of list) { const ff = new FontFace(f.family, `url(${f.url})`, { style: f.style || 'normal', weight: f.weight || '400' }); await ff.load(); document.fonts.add(ff); }
    await document.fonts.ready;
  };
  M.font = (ctx, size, fam, style = '') => { ctx.font = `${style} ${size}px "${fam}"`.trim(); };
  M.fitSize = (ctx, text, fam, maxW, style = '', start = 400) => { M.font(ctx, 100, fam, style); const w = ctx.measureText(text).width; return Math.min(start, 100 * maxW / w); };
  // letter-by-letter text with per-letter transform callback cb(i, ch) -> {dx,dy,s,a,rot}
  M.letters = (ctx, text, x, y, cb, align = 'center', track = 0) => {
    const ws = [...text].map(ch => ctx.measureText(ch).width + track); const total = ws.reduce((a, b) => a + b, 0) - track;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    [...text].forEach((ch, i) => {
      const o = cb(i, ch) || {}; ctx.save(); ctx.translate(cx + ws[i] / 2 + (o.dx || 0), y + (o.dy || 0)); if (o.rot) ctx.rotate(o.rot); const s = o.s ?? 1; ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1));
      ctx.globalAlpha *= (o.a ?? 1); ctx.textAlign = 'center'; if (o.stroke) ctx.strokeText(ch, 0, 0); else ctx.fillText(ch, 0, 0); ctx.restore(); cx += ws[i];
    });
    return total;
  };
  // "slam": word arrives big + ghost trail, settles with expo ease
  M.slam = (ctx, text, x, y, t, t0, opt = {}) => {
    const k = M.prog(t, t0, t0 + (opt.dur || 0.28)); if (t < t0) return 0;
    const e = M.ease.outExpo(k), s = M.lerp(opt.from || 1.35, 1, e);
    for (let g = (k < 1 ? 3 : 0); g >= 0; g--) {
      const sg = M.lerp(s, opt.from || 1.35, g * 0.08); ctx.save(); ctx.translate(x, y); ctx.scale(sg, sg); ctx.globalAlpha = g === 0 ? 1 : 0.18 * (1 - k); ctx.textAlign = opt.align || 'center'; ctx.fillText(text, 0, 0); ctx.restore();
    }
    return e;
  };

  // ---------- post FX ----------
  let grainTiles = null;
  M.grain = (ctx, t, amt = 0.07, fps = 30) => {
    if (!grainTiles) { grainTiles = []; const r = M.rng(3); for (let n = 0; n < 6; n++) { const c = M.canvas(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); grainTiles.push(c); } }
    const f = Math.floor(t * fps), tile = grainTiles[f % 6], W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt; const ox = (M.hash(f) * 256) | 0, oy = (M.hash(f, 1) * 256) | 0;
    for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(tile, x, y); ctx.restore();
  };
  M.vignette = (ctx, amt = 0.55) => { const W = ctx.canvas.width, H = ctx.canvas.height, g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${amt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  let scan = null;
  M.scanlines = (ctx, amt = 0.08, gap = 4) => { if (!scan) { const c = M.canvas(4, gap), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 4, 1); scan = ctx.createPattern(c, 'repeat'); } ctx.save(); ctx.globalAlpha = amt; ctx.fillStyle = scan; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };
  // RGB split: draws src into dst with channel offsets
  let chA, chB;
  M.chroma = (dst, src, dx, dy = 0) => {
    const W = src.width, H = src.height; if (!chA || chA.width !== W) { chA = M.canvas(W, H); chB = M.canvas(W, H); }
    const a = chA.getContext('2d');
    dst.save(); dst.fillStyle = '#000'; dst.fillRect(0, 0, W, H); dst.globalCompositeOperation = 'lighter';
    [['#f00', dx, dy], ['#0f0', 0, 0], ['#00f', -dx, -dy]].forEach(([col, ox, oy]) => { a.globalCompositeOperation = 'copy'; a.drawImage(src, 0, 0); a.globalCompositeOperation = 'multiply'; a.fillStyle = col; a.fillRect(0, 0, W, H); dst.drawImage(chA, ox, oy); });
    dst.restore();
  };
  // horizontal slice glitch (in-place using temp copy)
  M.glitch = (ctx, t, amt, seed = 1) => {
    if (amt <= 0) return; const W = ctx.canvas.width, H = ctx.canvas.height; if (!chB || chB.width !== W) { chB = M.canvas(W, H); }
    const b = chB.getContext('2d'); b.globalCompositeOperation = 'copy'; b.drawImage(ctx.canvas, 0, 0);
    const f = Math.floor(t * 30), n = 6 + Math.floor(amt * 14);
    for (let i = 0; i < n; i++) { const y = M.hash(f, i, seed) * H, h = 8 + M.hash(i, f, 2) * 140 * amt, dx = (M.hash(f, i, 3) - 0.5) * 260 * amt; ctx.drawImage(chB, 0, y, W, h, dx, y, W, h); }
  };
  // impulses: [{t, amp}] -> camera shake offset
  M.shake = (t, imp) => { let x = 0, y = 0, r = 0; for (const i of imp) { const d = t - i.t; if (d < 0 || d > 0.6) continue; const e = Math.exp(-d * 9) * i.amp; x += Math.sin(d * 70 + i.t) * e; y += Math.cos(d * 55 + i.t * 3) * e; r += Math.sin(d * 40) * e * 0.0009; } return { x, y, r }; };

  // ---------- transitions ----------
  // pixel dissolve from A to B; k in 0..1; palette = accent block colors
  M.pixelDissolve = (ctx, A, B, k, opt = {}) => {
    const W = ctx.canvas.width, H = ctx.canvas.height, cols = opt.cols || 12, cs = W / cols, rows = Math.ceil(H / cs), pal = opt.palette || ['#ff4a1c', '#f1ede4', '#0b0b0c', '#9e1b0f'];
    ctx.drawImage(A, 0, 0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const th = M.hash(i, j, opt.seed || 9) * 0.8 + (opt.dir === 'down' ? (j / rows) * 0.2 : 0.1), d = k - th;
      if (d > 0.12) ctx.drawImage(B, i * cs, j * cs, cs, cs, i * cs, j * cs, cs, cs);
      else if (d > -0.08) { ctx.fillStyle = pal[Math.floor(M.hash(j, i, 4) * pal.length)]; ctx.fillRect(i * cs, j * cs, Math.ceil(cs), Math.ceil(cs)); }
    }
  };
  M.flash = (ctx, k, color = '#fff') => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = color; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };

  // ---------- HUD ----------
  M.hud = (ctx, t, S, label, color = 'rgba(241,237,228,0.55)') => {
    const W = ctx.canvas.width, H = ctx.canvas.height, f = Math.floor(t * S.fps), N = Math.round(S.duration * S.fps);
    ctx.save(); ctx.fillStyle = color; M.font(ctx, 24, S.mono); ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText(label, 56, H - 70);
    ctx.textAlign = 'right'; ctx.fillText(`${String(f).padStart(4, '0')} / ${String(N).padStart(4, '0')}`, W - 56, H - 70);
    ctx.fillRect(56, H - 52, (W - 112) * (t / S.duration), 2); ctx.globalAlpha = 0.25; ctx.fillRect(56, H - 52, W - 112, 2);
    ctx.restore();
  };
  window.MD = M;
})();
```

### engine/sfx.py
```python
"""Motion Director — procedural sound design (no samples, no internet).
Every sound is synthesized so it can be placed frame-exactly on the same timeline as the visuals.
Usage from a project:  from sfx import *; mix = Mix(15.0); mix.add(1.6, impact()); mix.save('a.wav')
"""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_exp(d, k):
    return np.exp(-t_(d) * k)


def adsr(d, a=0.005, r=0.05):
    n = int(d * SR); e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, q=0.6, block=256):
    """band-pass whose centre glides f0->f1 (log), processed in blocks"""
    out = np.zeros_like(x); n = len(x); zi = None
    for i in range(0, n, block):
        k = i / max(1, n - 1); fc = f0 * (f1 / f0) ** k; lo, hi = fc * (1 - q / 2), min(fc * (1 + q / 2), SR / 2 - 100)
        sos = signal.butter(2, [max(lo, 20), hi], 'band', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9; return x / m * peak


# ---------------- instruments ----------------
def kick(d=0.4, f0=160, f1=42, k=9, click=0.4):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 32); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * k); c = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * click
    return np.tanh((x + c) * 1.6) * 0.9


def sub_boom(d=1.6, f0=70, f1=32):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 6); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    return np.tanh(x * 2.2) * 0.9


def crack(d=0.25, lo=1500, hi=9000, k=28):
    return bp(rng.standard_normal(int(d * SR)), lo, hi) * env_exp(d, k) * 2.2


def impact(size=1.0):
    a = sub_boom(1.6 * size); b = kick(0.5); c = crack(0.35)
    n = max(len(a), len(b), len(c)); out = np.zeros(n); out[:len(a)] += a * 0.9; out[:len(b)] += b * 0.8; out[:len(c)] += c * 0.5
    return out * size


def whoosh(d=0.5, f0=300, f1=4000, peak_at=0.7):
    x = sweep_filter(rng.standard_normal(int(d * SR)), f0, f1, q=0.9)
    t = np.linspace(0, 1, len(x)); e = np.where(t < peak_at, (t / peak_at) ** 2, ((1 - t) / (1 - peak_at)) ** 1.5)
    return norm(x * e, 0.7)


def riser(d=1.0, f0=200, f1=6000):
    n = int(d * SR); t = np.linspace(0, 1, n)
    nz = sweep_filter(rng.standard_normal(n), f0, f1, q=0.7)
    tone_f = 110 * (2 ** (t * 3)); tone = signal.sawtooth(2 * np.pi * np.cumsum(tone_f) / SR) * 0.25
    return norm((norm(nz) + lp(tone, 3000)) * t ** 2.2, 0.8)


def click(f=None):
    f = f or rng.uniform(1800, 3400); d = 0.03; t = t_(d)
    x = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.6 + np.sin(2 * np.pi * f * t) * np.exp(-t * 220) * 0.4
    return x


def blip(f=880, d=0.05, wave='square'):
    t = t_(d); x = signal.square(2 * np.pi * f * t) if wave == 'square' else np.sin(2 * np.pi * f * t)
    return x * adsr(d, 0.002, 0.02) * 0.35


def pixel_shimmer(d=0.35, density=60):
    n = int(d * SR); out = np.zeros(n); notes = [523, 659, 784, 1047, 1319, 1568, 2093]
    for _ in range(int(density * d)):
        s = int(rng.uniform(0, d - 0.04) * SR); b = blip(rng.choice(notes), 0.035); out[s:s + len(b)] += b * rng.uniform(0.3, 1)
    return out * np.linspace(0.6, 1, n)


def glitch(d=0.25):
    n = int(d * SR); x = rng.standard_normal(n)
    buzz = signal.square(2 * np.pi * rng.uniform(60, 140) * t_(d)) * 0.6
    gate = (signal.square(2 * np.pi * rng.uniform(25, 45) * t_(d)) > 0).astype(float)
    y = (bp(x, 800, 7000) + buzz) * gate
    y = np.round(y * 6) / 6  # bitcrush
    return y * adsr(d, 0.003, 0.05) * 0.5


def beep(f=1000, d=0.12):
    return np.sin(2 * np.pi * f * t_(d)) * adsr(d, 0.004, 0.04) * 0.3


def ping(f=1400, d=1.4):
    t = t_(d); x = np.sin(2 * np.pi * f * t) * np.exp(-t * 4) + np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 7) * 0.3
    return x * 0.35


def drone(d=2.0, root=55.0):
    t = t_(d); x = sum(signal.sawtooth(2 * np.pi * root * m * (1 + det) * t) for m, det in [(1, 0), (1, .006), (2, -.004), (1.5, .003)])
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t)
    return lp(x, 900) * (0.5 + 0.5 * lfo) * adsr(d, 0.15, 0.3) * 0.18


def tone_sweep(d=0.8, f0=220, f1=880):
    t = np.linspace(0, 1, int(d * SR)); f = f0 * (f1 / f0) ** t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t) * 0.25


def pad(notes, d=2.0, attack=0.05):
    t = t_(d); x = np.zeros(len(t))
    for f in notes:
        for det in (-0.004, 0, 0.005): x += signal.sawtooth(2 * np.pi * f * (1 + det) * t)
    return lp(x, 2600) * adsr(d, attack, 0.6) * 0.06


def hat(d=0.06, open_=False):
    d = 0.22 if open_ else d; return hp(rng.standard_normal(int(d * SR)), 7000) * env_exp(d, 18 if open_ else 70) * 0.25


def bass_note(f=55, d=0.22):
    t = t_(d); x = signal.sawtooth(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    return lp(x, 400) * adsr(d, 0.004, 0.08) * 0.35


def reverb(x, decay=1.4, mix=0.25):
    n = int(decay * SR); ir = rng.standard_normal((2, n)) * np.exp(-np.arange(n) / SR * (6.9 / decay)); ir[:, :int(0.01 * SR)] = 0
    wet = np.stack([signal.fftconvolve(x, ir[c])[:len(x)] for c in range(2)]); wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    return np.stack([x, x]) * (1 - mix) + wet * mix


# ---------------- mixer ----------------
class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR); self.fx = np.zeros(self.n); self.bed = np.zeros(self.n); self.duck = np.ones(self.n); self.verb = np.zeros(self.n)

    def _put(self, buf, t, x, g):
        s = int(t * SR); e = min(self.n, s + len(x))
        if s < self.n and e > 0: buf[max(0, s):e] += x[max(0, -s):e - s] * g

    def add(self, t, x, g=1.0, verb=0.0, duck=0.0):
        self._put(self.fx, t, x, g)
        if verb: self._put(self.verb, t, x, g * verb)
        if duck:  # sidechain the music bed
            s = int(t * SR); L = int(0.35 * SR); e = min(self.n, s + L)
            if s < self.n: self.duck[s:e] = np.minimum(self.duck[s:e], 1 - duck * np.exp(-np.arange(e - s) / SR * 9))

    def music(self, t, x, g=1.0):
        self._put(self.bed, t, x, g)

    def render(self):
        dry = np.stack([self.fx, self.fx]) + np.stack([self.bed * self.duck] * 2)
        wet = reverb(self.verb, 1.8, 1.0)
        out = dry + wet * 0.5
        out = np.tanh(out * 1.2) / np.tanh(1.2)
        return norm(out, 0.92)

    def save(self, path):
        from scipy.io import wavfile
        wavfile.write(path, SR, (self.render().T * 32767).astype(np.int16))
```

### engine/align.py
```python
"""Word timings for a voiceover WITHOUT a speech model (offline fallback).
Given the voiceover audio and its exact script, finds voiced regions by energy and spreads the
words over them weighted by syllables. Output: JSON [{"w": word, "t0": s, "t1": s}].
If an ElevenLabs timestamps JSON (character alignment) is available, prefer it: use from_elevenlabs().
Usage: python3 align.py voice.mp3 script.txt out.json
"""
import json, re, subprocess, sys
import numpy as np

SR = 16000


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def syllables(w):
    w = w.lower(); return max(1, len(re.findall(r'[aeiouáéíóúüy]+', w)))


def voiced_regions(x, hop=0.01, min_gap=0.18):
    h = int(hop * SR); rms = np.array([np.sqrt(np.mean(x[i:i + h] ** 2) + 1e-12) for i in range(0, len(x) - h, h)])
    db = 20 * np.log10(rms + 1e-9); thr = max(np.percentile(db, 30), db.max() - 38); on = db > thr
    regs, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None: regs.append([s * hop, i * hop]); s = None
    if s is not None: regs.append([s * hop, len(on) * hop])
    merged = []
    for r in regs:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] > 0.06]


def align(audio, script):
    x = load(audio); regs = voiced_regions(x)
    words = re.findall(r"\S+", script)
    total_voiced = sum(b - a for a, b in regs); total_syl = sum(syllables(w) for w in words)
    def voiced_to_time(v):
        acc = 0
        for a, b in regs:
            if v <= acc + (b - a): return a + (v - acc)
            acc += b - a
        return regs[-1][1]
    out, cum = [], 0
    for w in words:
        s = syllables(w); t0 = voiced_to_time(cum / total_syl * total_voiced); cum += s; t1 = voiced_to_time(cum / total_syl * total_voiced)
        out.append({'w': w, 't0': round(t0, 3), 't1': round(t1, 3)})
    return out


def from_elevenlabs(path):
    """ElevenLabs /with-timestamps response -> word list"""
    a = json.load(open(path)); a = a.get('alignment', a)
    chars, st, en = a['characters'], a['character_start_times_seconds'], a['character_end_times_seconds']
    out, cur, t0 = [], '', None
    for c, s, e in zip(chars, st, en):
        if c.isspace():
            if cur: out.append({'w': cur, 't0': t0, 't1': last}); cur = ''
            continue
        if not cur: t0 = s
        cur += c; last = e
    if cur: out.append({'w': cur, 't0': t0, 't1': last})
    return out


if __name__ == '__main__':
    res = align(sys.argv[1], open(sys.argv[2]).read())
    json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
    print(len(res), 'words')
```