---
name: "explainer-3d-reels"
description: "Crea reels verticales explicativos en 3D estilo \"resulta que\" (objeto cotidiano en fondo negro, subtítulos palabra a palabra, anotaciones neón, final de compartir) renderizados fotograma a fotograma con Three.js + ffmpeg."
---

# Explainer 3D Reels (formato "resulta que…")

> **Adaptación a AI Video Studio (léelo antes que el resto).**
> - Esta skill trae su propio motor (Three.js en `explainer3d/`). Es un camino aparte del motor del estudio (`engine/engine.js` + `timeline.json`): no pasa por `npm run check` ni por la hoja de contactos de `npm run sheet`. Úsala solo si pablo pide este formato expresamente; si no, usa `/motion-reel`.
> - Los gates del `CLAUDE.md` siguen valiendo: brief, guion, visual y exportación, con su "ok" en cada uno.
> - Nada de IA de imagen ni de vídeo (Nano Banana, Gemini, Flow…) ni TTS (ElevenLabs): la voz la graba pablo. El alineador offline sí vale.
> - Solo material real: cada dato del guion con fuente en `brief.md`. Sin `Math.random()` ni recursos remotos.
> - Rutas: trabaja dentro del repo (`explainer3d/`), no en `/home/claude/…`. Render en `renders/<nombre>.mp4` como el resto.

Genera vídeos 9:16 de ~20–35 s que explican **por qué un objeto cotidiano es como es**, con un objeto 3D limpio sobre fondo negro, subtítulos karaoke arriba y anotaciones (anillos, corchetes, planos neón "0", flechas, rojo = error). Todo se dibuja con código: Three.js en Chromium headless, captura de cada fotograma y montaje con ffmpeg. Claude hace todo menos (opcionalmente) el guion y la voz.

Referencia analizada: reel "¿Por qué el gancho del metro está suelto?" (30,7 s, 1080×1920, 30 fps, ~95 palabras ≈ 3,3 palabras/s, +7 M views).

## 1. Anatomía del formato (lo que hay que replicar)

**Guion (fórmula)** — frases cortas, ritmo rápido, tono de colega que te cuenta algo:
1. **Hook-pregunta (0–2 s)** sobre un detalle que todos han visto y nadie entiende: "¿Por qué el gancho del metro está *suelto?*"
2. **Romper la creencia**: "No, no está *roto.*"
3. **Mecanismo en 1 frase**: "Se mueve justo lo que mide de *grosor*, ni un pelo más."
4. **Demostración A** ("Si lo enganchas en… y tiras, sale, y el *cero* queda justo donde toca la tabla.")
5. **Demostración B, el caso contrario** ("Pero si lo empujas contra una *pared*, entra…")
6. **Conclusión** ("Así, midas como midas, su *grosor* nunca se cuela en la medida.")
7. **Qué pasa si lo "arreglas" mal** → objeto en **rojo** ("Si lo *aprietas*, una de las dos medidas te saldrá siempre *mal.*")
8. **Giro de cierre**: "Así que sí, está suelto… pero a *propósito.*"
9. **CTA de compartir con callback**: "*Envíaselo* a ese *amigo* que le ha *apretado* el gancho al metro pensando que estaba *roto.*"

Reglas: 70–110 palabras; nada de intro ni "hola"; 1 palabra clave marcada con `*asteriscos*` cada 1–2 frases (sustantivo o verbo que carga la idea); repetir palabras clave (cero, grosor) para que el espectador ancle; el CTA siempre nombra a "ese amigo que…" con algo que el espectador sí ha hecho.

**Visual**
- Fondo `#0d0d0e` con rejilla muy sutil (54 px), halo radial cálido detrás del objeto, motas de polvo que suben.
- Objeto 3D estilizado y limpio (formas simples biseladas, PBR sencillo: metal gris satinado, remaches dorados, madera clara, hormigón con motas). Cámara de producto (fov 30), objeto centrado algo por debajo del centro (los subtítulos ocupan la franja superior).
- **Un plano por frase** (1–3 s). Corte con **focus-pull**: desenfoque + micro-zoom al salir y entrar (lo hace el motor).
- Lenguaje de anotaciones (siempre el mismo código de color):
  - anillo **dorado** = "mira esto" (hook); anillo **cian** = solución (cierre)
  - **corchetes dorados** = hueco/medida/grosor
  - **plano de cristal cian con "0"** = el cero / la referencia
  - **flechas blancas** = dirección de la fuerza (tirar/empujar)
  - objeto en **rojo** y "0" en **rojo** = error / lo que sale mal
- **Subtítulos** arriba (~y=300 px de 1920): aparecen palabra a palabra; palabra actual blanca bold, anteriores gris; palabras clave dentro de una **caja de selección azul estilo Figma** con tiradores (aporta el look "editor", muy reconocible). 1–6 palabras por línea-frase.
- **Outro**: el vídeo se encoge dentro de un móvil, un dedo pulsa compartir, elige un contacto (✓), pulsa *Enviar* → *✓ Enviado*. UI genérica (no copies logos ni nombres de usuario de ninguna app).

## 2. Flujo de trabajo

### Paso 0 — Preparar el motor (una vez por máquina/sesión)
1. Si ya existe una carpeta `explainer3d/` con `engine/engine.js`, `render.mjs` y `timeline.py`, úsala.
2. Si no, crea `explainer3d/` y escribe **exactamente** los 4 archivos del apartado 5 (`engine/index.html`, `engine/engine.js`, `render.mjs`, `timeline.py`).
3. `cd explainer3d && npm init -y && npm i three@0.170.0`
4. Playwright: si `node -e "require('playwright')"` falla y no hay uno global, `npm i playwright@1.56.0 && npx playwright install chromium`. Requisitos: Node ≥18, Python 3, ffmpeg.
5. Fuentes: usa `Inter Display`/`Inter`. Si no están instaladas, instálalas (macOS: `brew install --cask font-inter`) o cambia `font-family` en `engine/index.html`.

### Paso 1 — Guion
- Si el usuario trae guion, úsalo tal cual (solo añade `*clave*` y, si hace falta, `/` para forzar corte de subtítulo).
- Si no, escríbelo con la fórmula de arriba sobre el objeto que pida (o propón 3 objetos con "por qué" sorprendente y verificable). Comprueba el dato antes de escribirlo; si no estás seguro, búscalo.
- Guarda en `projects/<slug>/script.txt`.

### Paso 2 — Storyboard (tabla breve antes de modelar)
Para cada frase: plano · objetos · acción sincronizada con qué palabra · anotación · cámara. Normalmente 6–10 planos. Reutiliza el mismo objeto héroe en el primer y último plano (cierre circular).

### Paso 3 — Voz y tiempos
`timeline.json` contiene las palabras con tiempos; la escena se sincroniza con `at('palabra')`, así que **si cambia la voz basta con regenerar el timeline: la animación se re-sincroniza sola**.
- Con voz (`voice.mp3` de ElevenLabs, grabación propia…), de mejor a peor:
  - `python3 timeline.py projects/<slug> --audio voice.mp3 --words words.json` (timestamps por palabra de cualquier alineador; formato `[{"word","start","end"}]`)
  - `--whisper` (requiere `pip install faster-whisper` y descarga del modelo)
  - `--srt subs.srt` (p. ej. subtítulos auto de CapCut exportados)
  - solo `--audio voice.mp3` → reparte por sílabas y pausas en la duración del audio (aproximado)
- Sin voz todavía: `python3 timeline.py projects/<slug>` estima a 6,3 sílabas/s → sirve para el borrador; cuando llegue la voz, re-ejecuta con `--audio`.
- Música opcional: añade `"music": "music.mp3", "musicVolume": 0.12` en `timeline.json`.
- Outro: añade `"outro": {"startWord": "Envíaselo", "contacts": ["Lucía","Javi","Marta"], "target": 1}` **antes** de ejecutar `timeline.py` (calcula el inicio y alarga la duración).

### Paso 4 — Escena (`projects/<slug>/scene.js`)
Escribe la escena con la API del apartado 4. Pautas:
- Modela con primitivas: `geo.rbox` (cajas redondeadas), `geo.lPlate` (chapas en L), `THREE.ExtrudeGeometry` desde un `Shape` (siluetas), `LatheGeometry` (objetos de revolución: tapones, botellas, bombillas), `TubeGeometry` (cables), `CylinderGeometry`. Pocas piezas, biseles pequeños, proporciones reales. Si el usuario da un `.glb`, cárgalo con `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`) desde `/project/…`.
- Una fábrica `makeX()` por objeto héroe; cada plano crea su instancia en su propio `group`.
- Encuadra con `fit(objeto, {dir, fill, screenY})` en vez de posicionar la cámara a mano; un ligero empuje (`fill` 0.62→0.7 durante el plano) da vida.
- Toda animación = función pura del tiempo (`prog`, `kf`, `at`). Nada de `Math.random()` ni estado acumulado entre frames (se renderiza en paralelo y en cualquier orden).
- Sincroniza cada acción con la palabra que la nombra: `prog(t, at('tiras') - .05, at('tiras') + .35)`.
- Las anotaciones 2D se anclan a puntos 3D con `project([x,y,z])`.

### Paso 5 — Previsualizar
`node render.mjs projects/<slug> --stills 0.8,2.5,4.0,…` (un still por plano, en el momento de la palabra clave). Une los PNG en una hoja (`ffmpeg -i a.png -i b.png … -filter_complex hstack=N`) y **míralos con Read**. Revisa: objeto entero y centrado, subtítulo legible sobre zona oscura, anotaciones visibles y en su sitio, proporciones creíbles. Itera hasta que estén bien; enseña la hoja al usuario si quiere aprobar el look.

### Paso 6 — Render final
`node render.mjs projects/<slug> --out projects/<slug>/<slug>.mp4 [--workers N]`
- CPU (SwiftShader): ~1 fps por núcleo → 30 s ≈ 15 min con 1 núcleo; usa `--workers` = núcleos-1. En un ordenador con gráfica: `GPU=1 node render.mjs …` (mucho más rápido).
- Prueba rangos sueltos con `--from 9 --to 12`.
- Comprueba el resultado con una hoja de contactos (`ffmpeg -i out.mp4 -vf "fps=2,scale=270:-1,tile=8x4" check.png`) y entrega el MP4 con SendUserFile.

## 3. Checklist de calidad
- Hook visual en el frame 0 (objeto ya en pantalla, sin fundido desde negro; el primer plano usa `in: 'cut'`).
- Cambio visual cada ≤2,5 s (plano nuevo, color, anotación o movimiento de cámara).
- Cada palabra `*clave*` coincide con algo que pasa en pantalla en ese instante.
- Rojo solo para el error; cian/dorado para lo correcto.
- Subtítulos nunca tapados por el objeto (deja la franja y=200–450 oscura o usa `captions.top`).
- Outro de compartir en los últimos ~3 s.

## 4. API de `scene.js`

```js
export default function (api) {
  const { THREE, mat, geo, tex, neonPlane, contactShadow, prog, kf, ease, lerp, clamp, at, cam, fit, project } = api;
  const shots = [];
  // cada plano: { start, end?, in?: 'blur'|'cut', out?: 'blur'|'cut', group?, background?, update(lt, {t, ov, dur}) }
  return { shots };
}
```
- `start` en segundos (normalmente `at('palabra')`); `end` por defecto = inicio del siguiente. Solo el `group` del plano activo es visible.
- `update(lt, ctx)`: `lt` tiempo local del plano, `ctx.t` tiempo global, `ctx.ov` capa 2D, `ctx.dur` duración del plano.
- `at(palabra, n=1)` → segundo en que se dice la n-ésima aparición (ignora tildes, mayúsculas y puntuación).
- `prog(t, a, b, easeFn)` → 0..1 suavizado; `kf(t, [[t0,v0],[t1,v1],…])` keyframes (números o arrays); `ease.inOut|out|in|outBack|outExpo|linear`.
- Cámara: `cam([x,y,z], [tx,ty,tz], fov)` o `fit(obj, {dir:[-1,.75,1.3], fill:.78, screenY:.56, fov:30, offset:[0,0,0]})`.
- `project(punto | Vector3 | Object3D)` → `[x, y]` en píxeles del lienzo 1080×1920.
- Materiales: `mat.metal(color)`, `mat.gold()`, `mat.plastic(color, rough)`, `mat.wood([rx,ry])`, `mat.concrete([rx,ry])`, `mat.tape(cm, start)`, `mat.glass(color, opacity)`, `mat.neon(color)`.
- Geometría: `geo.rbox(w,h,d,r)`, `geo.lPlate(a,b,w,th,r)` (pata horizontal a lo largo de +x arriba, pata vertical colgando en x=0), `geo.rivet(r)`.
- `neonPlane(w,h,color)` → grupo con `userData.set(opacidad)`; `contactShadow(w,d,fuerza)` sombra suave en el suelo.
- Capa 2D `ov`: `ov.ring(x,y,r,{color,progress,alpha})`, `ov.label('0',x,y,{color,size,alpha})`, `ov.arrow(x1,y1,x2,y2,{alpha})`, `ov.rect(x,y,w,h,{color})`, `ov.line([[x,y],…],{progress})`, `ov.text(str,x,y,{size})`, `ov.ctx` (Canvas2D crudo).
- Colores del formato: dorado `#e9b44c`, cian `#6ff5df`, rojo `#f06a6a`/`#ff5a5a`, gris metal `#b9bdc4`.
- `timeline.json`: `fps`, `duration`, `audio`, `music`, `musicVolume`, `words[{w,s,e,hl,br}]`, `captions.top`, `background{grid,particles,glow:{x,y,r,color:'255,170,70',a}}` (también por plano), `outro{startWord|start, contacts, target}`.

**Ejemplo mínimo de plano** (hook con anillo dorado y el objeto que se pone rojo con "roto"):
```js
const hook = makeHook(); const group = new THREE.Group(); group.add(hook);
shots.push({ start: 0, in: 'cut', group, update(lt, { t, ov }) {
  fit(hook.userData.plate, { dir: [-1, .7, 1.5], fill: lerp(.62, .7, prog(lt, 0, 4)) });
  hook.userData.setColor(prog(t, at('roto') - .05, at('roto') + .1));
  const [x, y] = project([0.35, -0.2, 0]);
  ov.ring(x, y, 360, { progress: prog(lt, .25, .9, ease.out), alpha: 1 - prog(t, at('no') - .2, at('no')) });
}});
```

## 5. Archivos del motor (escríbelos tal cual)

### `explainer3d/engine/index.html`
```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#0b0b0c;overflow:hidden}
  #root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#0b0b0c}
  #frame{position:absolute;inset:0;transform-origin:50% 50%;overflow:hidden;background:#0d0d0e}
  #bg,#gl,#ov{position:absolute;inset:0;width:1080px;height:1920px}
  #cap{position:absolute;left:90px;right:90px;top:300px;text-align:center;
       font-family:'Inter Display','Inter',sans-serif;font-size:50px;line-height:1.22;letter-spacing:-0.3px;text-shadow:0 2px 18px rgba(0,0,0,.55)}
  #cap .w{display:inline-block;margin:0 .13em;color:#8d8d92;font-weight:400;position:relative}
  #cap .w.on{color:#fff;font-weight:700}
  #cap .w.hl{color:#fff;font-weight:700;padding:0 6px;background:rgba(28,56,110,.55);outline:2.5px solid #3d7bff;outline-offset:0}
  #cap .w.hl::before,#cap .w.hl::after{content:'';position:absolute;width:11px;height:11px;border-radius:50%;
       background:#0d0d0e;border:2.5px solid #3d7bff;box-sizing:border-box}
  #cap .w.hl::before{left:-7px;top:-7px}
  #cap .w.hl::after{right:-7px;bottom:-7px}
  #phone{position:absolute;inset:0;pointer-events:none}
</style>
<script type="importmap">
{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}
</script>
</head>
<body>
<div id="root">
  <div id="frame">
    <canvas id="bg" width="1080" height="1920"></canvas>
    <canvas id="gl"></canvas>
    <canvas id="ov" width="1080" height="1920"></canvas>
    <div id="cap"></div>
  </div>
  <div id="phone"></div>
</div>
<script type="module">
  import { boot } from '/engine/engine.js';
  const p = new URLSearchParams(location.search);
  boot(p.get('project') || 'examples/demo').then(info => { window.__info = info; window.__ready = true; })
    .catch(e => { window.__error = String(e && e.stack || e); console.error(e); });
</script>
</body>
</html>
```

### `explainer3d/engine/engine.js`
```js
// Explainer 3D engine — deterministic, frame-by-frame renderer.
// Everything visible is a pure function of time t, so any frame can be rendered in any order.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const W = 1080, H = 1920;

// ---------- math / easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  linear: t => t,
  inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
// progress of t between a and b, eased
export const prog = (t, a, b, fn = ease.inOut) => fn(clamp((t - a) / (b - a)));
// keyframes: kf(t, [[0, v0], [1.2, v1], ...], easeFn) -> number | array
export function kf(t, keys, fn = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const p = fn(clamp((t - t0) / (t1 - t0)));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : lerp(v0, v1, p);
    }
  }
  return keys[keys.length - 1][1];
}
export function rng(seed = 1) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
export const tex = {
  wood: (repeat = [1, 1], base = '#dcae6c') => canvasTex(1024, 1024, (g, w, h) => {
    const r = rng(7); g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y0 = r() * h, amp = 4 + r() * 14, f = 0.002 + r() * 0.006, ph = r() * 6;
      g.strokeStyle = `rgba(${140 + r() * 40},${80 + r() * 30},${30 + r() * 20},${0.18 + r() * 0.4})`;
      g.lineWidth = 0.6 + r() * 2.4; g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
      g.stroke();
    }
  }, repeat),
  concrete: (repeat = [1, 1], base = '#aeb3ba') => canvasTex(512, 512, (g, w, h) => {
    const r = rng(3); g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const d = r() < .5; g.fillStyle = d ? `rgba(60,64,70,${r() * .35})` : `rgba(255,255,255,${r() * .25})`;
      const s = r() * 2.6 + .4; g.fillRect(r() * w, r() * h, s, s);
    }
  }, repeat),
  // measuring tape: one texture unit = `units` cm, numbers every cm starting at `start`
  tape: (units = 10, start = 0, base = '#f3d65a') => canvasTex(2048, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const px = w / (units * 10);
    g.fillStyle = '#1b1b1b';
    for (let i = 0; i <= units * 10; i++) {
      const x = i * px, L = i % 10 === 0 ? 50 : i % 5 === 0 ? 34 : 20;
      g.fillRect(x, 0, 3, L); g.fillRect(x, h - L, 3, L);
    }
    g.font = 'bold 44px Inter, sans-serif'; g.textAlign = 'center';
    for (let i = 1; i <= units; i++) g.fillText(String(start + i), i * 10 * px - px * 5, h / 2 + 15);
  }),
  radial: (inner = 'rgba(0,0,0,.55)', outer = 'rgba(0,0,0,0)') => canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }),
};

// ---------- materials ----------
export const mat = {
  metal: (color = '#b9bdc4') => new THREE.MeshStandardMaterial({ color, metalness: .55, roughness: .38 }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#e7ad3c', metalness: 1, roughness: .22 }),
  plastic: (color = '#ef5f5f', rough = .45) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rough }),
  wood: (repeat) => new THREE.MeshStandardMaterial({ map: tex.wood(repeat), roughness: .8, metalness: 0 }),
  concrete: (repeat) => new THREE.MeshStandardMaterial({ map: tex.concrete(repeat), roughness: .95 }),
  tape: (units, start) => new THREE.MeshStandardMaterial({ map: tex.tape(units, start), roughness: .55, side: THREE.DoubleSide }),
  glass: (color = '#7ff3df', opacity = .16) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
  neon: (color = '#6ff5df') => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true }),
};

// ---------- geometry helpers ----------
export const geo = {
  rbox: (w, h, d, r = .04, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-3)),
  // L-shaped bent plate (like a tape hook / bracket): horizontal leg length a, vertical leg length b, width w, thickness th
  lPlate(a, b, w, th, r = .02) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(a, 0); s.lineTo(a, th); s.lineTo(th, th); s.lineTo(th, b); s.lineTo(0, b); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -w / 2); g.rotateX(Math.PI); g.translate(0, th, 0); // horizontal leg on top, vertical leg hangs down
    return mergeVertices(g);
  },
  rivet: (r = .05) => { const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, .45, 1); return g; },
};

// neon outlined glass plane (the "zero line" plane). Returns Group; group.userData.set(opacity)
export function neonPlane(w, h, color = '#6ff5df', tube = .012) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat.glass(color));
  g.add(fill);
  const em = mat.neon(color);
  const edges = [[0, h / 2, w, tube], [0, -h / 2, w, tube], [w / 2, 0, tube, h], [-w / 2, 0, tube, h]];
  for (const [x, y, ew, eh] of edges) { const m = new THREE.Mesh(new THREE.BoxGeometry(ew + tube, eh + tube, tube), em); m.position.set(x, y, 0); g.add(m); }
  g.userData.set = (o) => { fill.material.opacity = .16 * o; em.opacity = o; g.visible = o > .001; };
  return g;
}
export function contactShadow(w, d, strength = .55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex.radial(`rgba(0,0,0,${strength})`), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

// ---------- 2D overlay (immediate mode, redrawn each frame) ----------
function makeOverlay(ctx) {
  const glow = (c, b) => { ctx.shadowColor = c; ctx.shadowBlur = b; };
  const reset = () => { ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.setLineDash([]); };
  return {
    ctx,
    arrow(x1, y1, x2, y2, { color = '#fff', width = 7, alpha = 1, head = 26 } = {}) {
      if (alpha <= 0) return; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - head * Math.cos(a - .5), y2 - head * Math.sin(a - .5)); ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(a + .5), y2 - head * Math.sin(a + .5)); ctx.stroke(); reset();
    },
    ring(x, y, r, { color = '#e9b44c', width = 4, alpha = 1, progress = 1, glowBlur = 18, start = -Math.PI / 2 } = {}) {
      if (alpha <= 0 || progress <= 0) return; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; glow(color, glowBlur);
      ctx.beginPath(); ctx.arc(x, y, r, start, start + Math.PI * 2 * progress); ctx.stroke(); reset();
    },
    label(text, x, y, { color = '#6ff5df', size = 72, weight = 600, alpha = 1, glowBlur = 22, font = 'Inter Display' } = {}) {
      if (alpha <= 0) return; ctx.globalAlpha = alpha; ctx.fillStyle = color; glow(color, glowBlur);
      ctx.font = `${weight} ${size}px '${font}'`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); reset();
    },
    rect(x, y, w, h, { color = '#e9b44c', width = 4, alpha = 1, glowBlur = 10, radius = 0 } = {}) {
      if (alpha <= 0) return; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; glow(color, glowBlur);
      ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.stroke(); reset();
    },
    line(pts, { color = '#6ff5df', width = 5, alpha = 1, glowBlur = 16, progress = 1, dash = null } = {}) {
      if (alpha <= 0 || progress <= 0) return; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; glow(color, glowBlur);
      if (dash) ctx.setLineDash(dash);
      // draw a prefix of the polyline according to progress
      let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let left = total * progress; ctx.beginPath(); ctx.moveTo(...pts[0]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), f = Math.min(1, left / L);
        ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f); left -= L;
      }
      ctx.stroke(); reset();
    },
    text(str, x, y, { color = '#fff', size = 44, weight = 700, alpha = 1, align = 'center' } = {}) {
      if (alpha <= 0) return; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.font = `${weight} ${size}px 'Inter Display'`;
      ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); reset();
    },
  };
}

// ---------- captions ----------
function buildPhrases(words) {
  const phrases = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(i);
    const end = /[.?!…]$/.test(w.w) || w.br || (/[,;:]$/.test(w.w) && cur.length >= 3) || cur.length >= 6;
    if (end) { phrases.push(cur); cur = []; }
  });
  if (cur.length) phrases.push(cur);
  return phrases;
}
function renderCaptions(el, words, phrases, t, style) {
  let pi = -1;
  for (let i = 0; i < phrases.length; i++) if (words[phrases[i][0]].s <= t + 1e-4) pi = i;
  if (pi < 0) { el.innerHTML = ''; return; }
  const ph = phrases[pi]; const last = words[ph[ph.length - 1]];
  const nextStart = pi + 1 < phrases.length ? words[phrases[pi + 1][0]].s : last.e + (style.tail ?? .6);
  if (t > nextStart) { el.innerHTML = ''; return; }
  let html = '';
  let current = -1; for (const i of ph) if (words[i].s <= t + 1e-4) current = i;
  for (const i of ph) {
    const w = words[i]; if (w.s > t + 1e-4) break;
    const age = t - w.s, a = clamp(age / .09), blur = (1 - a) * 8;
    const cls = w.hl ? 'w hl' : (i === current ? 'w on' : 'w');
    html += `<span class="${cls}" style="opacity:${a};filter:blur(${blur.toFixed(2)}px)">${w.w.replace(/</g, '&lt;')}</span>`;
    if (w.nl) html += '<br>';
  }
  el.innerHTML = html;
}

// ---------- background ----------
function drawBg(g, t, cfg) {
  g.fillStyle = cfg.bg || '#0d0d0e'; g.fillRect(0, 0, W, H);
  if (cfg.grid !== false) {
    g.strokeStyle = 'rgba(255,255,255,0.032)'; g.lineWidth = 1.5;
    const s = 54; g.beginPath();
    for (let x = 0; x <= W; x += s) { g.moveTo(x + .5, 0); g.lineTo(x + .5, H); }
    for (let y = 0; y <= H; y += s) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); }
    g.stroke();
  }
  const gl = cfg.glow || { x: 540, y: 980, r: 620, color: '255,170,70', a: .14 };
  if (gl.a > 0) {
    const gr = g.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
    gr.addColorStop(0, `rgba(${gl.color},${gl.a})`); gr.addColorStop(1, `rgba(${gl.color},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  if (cfg.particles !== false) {
    const r = rng(42);
    for (let i = 0; i < 70; i++) {
      const x = (r() * W + Math.sin(t * .3 + i) * 10) % W, y = (r() * H - t * (6 + r() * 10) + H) % H;
      g.fillStyle = `rgba(255,255,255,${.12 + r() * .35})`; const s = 1 + r() * 2.2;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------- phone share outro ----------
const AV_COLORS = [['#f3a25b', '#7a3e1d'], ['#3b5bdb', '#1f2a55'], ['#3fb68b', '#8a3b1f'], ['#f5c04a', '#5b3a22'], ['#e88aa8', '#3a2a2a'], ['#8fa3b8', '#3b4a5a']];
function avatarSVG(i) {
  const [bg, hair] = AV_COLORS[i % AV_COLORS.length];
  return `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="50" fill="${bg}"/>
  <clipPath id="c${i}"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#c${i})">
  <ellipse cx="50" cy="102" rx="34" ry="26" fill="#2c2f36"/><rect x="43" y="62" width="14" height="14" fill="#e9b48f"/>
  <circle cx="50" cy="46" r="20" fill="#f1c19c"/><path d="M29 44 Q31 22 50 22 Q69 22 71 44 Q63 34 50 34 Q37 34 29 44Z" fill="${hair}"/>
  <circle cx="43" cy="48" r="2.4" fill="#2a2a2a"/><circle cx="57" cy="48" r="2.4" fill="#2a2a2a"/><path d="M44 56 Q50 61 56 56" stroke="#8a4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>`;
}
const ICON = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  comment: '<path d="M20 11.5a8 8 0 0 1-11.6 7.2L4 20l1.3-4.2A8 8 0 1 1 20 11.5z"/>',
  repost: '<path d="M7 7h11l-3-3M17 17H6l3 3M18 7v4M6 17v-4"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  add: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6"/>',
};
const icon = (k, s = 46) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#e8e8ea" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const FINGER = `<svg width="190" height="900" viewBox="0 0 190 900"><defs>
 <linearGradient id="sk" x1="0" x2="1"><stop offset="0" stop-color="#d9967a"/><stop offset=".45" stop-color="#f0bea2"/><stop offset="1" stop-color="#c98468"/></linearGradient>
 <linearGradient id="nl" x1="0" x2="1"><stop offset="0" stop-color="#f2c9b8"/><stop offset=".5" stop-color="#fbe3d8"/><stop offset="1" stop-color="#e8b7a3"/></linearGradient></defs>
 <rect x="10" y="0" width="170" height="900" rx="85" fill="url(#sk)"/>
 <rect x="45" y="22" width="100" height="120" rx="48" fill="url(#nl)" opacity=".9"/>
 <path d="M50 300 Q95 290 140 300 M56 318 Q95 308 134 318 M60 520 Q95 512 130 520" stroke="#b97a62" stroke-width="3" fill="none" opacity=".6"/></svg>`;

function buildOutro(root, cfg) {
  const contacts = cfg.contacts || ['Lucía', 'Javi', 'Marta'];
  root.innerHTML = `
  <div id="bezel" style="position:absolute;border:16px solid #1c1c1f;border-radius:96px;box-shadow:0 0 0 3px #2b2b30,0 40px 120px rgba(0,0,0,.6);box-sizing:content-box"></div>
  <div id="side" style="position:absolute;display:flex;flex-direction:column;gap:46px;align-items:center">${['heart', 'comment', 'repost', 'send'].map(k => `<div data-k="${k}">${icon(k)}</div>`).join('')}</div>
  <div id="sheet" style="position:absolute;background:#232326;border-radius:44px 44px 0 0;overflow:hidden;font-family:'Inter Display',Inter,sans-serif;color:#fff">
    <div style="width:70px;height:7px;border-radius:4px;background:#5a5a60;margin:16px auto 22px"></div>
    <div style="display:flex;gap:18px;padding:0 30px;align-items:center">
      <div style="flex:1;height:70px;border-radius:18px;background:#36363b;display:flex;align-items:center;gap:12px;padding:0 20px;color:#a1a1a8;font-size:30px">${icon('search', 30)}Buscar</div>
      <div style="width:70px;height:70px;border-radius:50%;background:#36363b;display:flex;align-items:center;justify-content:center">${icon('add', 34)}</div>
    </div>
    <div style="display:flex;justify-content:space-around;padding:30px 20px 10px">
      ${contacts.map((n, i) => `<div style="text-align:center;width:180px"><div class="av" data-i="${i}" style="position:relative;width:126px;height:126px;margin:0 auto;border-radius:50%;padding:5px;box-sizing:border-box">${avatarSVG(i)}<div class="ck" style="position:absolute;right:-2px;bottom:-2px;width:40px;height:40px;border-radius:50%;background:#2f8bff;border:4px solid #232326;display:none;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:800">✓</div></div><div class="nm" style="margin-top:12px;font-size:28px">${n}</div></div>`).join('')}
    </div>
    <div id="btn" style="margin:28px 30px 0;height:92px;border-radius:20px;background:#2f8bff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:700">Enviar</div>
  </div>
  <div id="ripple" style="position:absolute;width:90px;height:90px;border-radius:50%;border:4px solid rgba(255,255,255,.8);opacity:0"></div>
  <div id="finger" style="position:absolute;transform-origin:95px 60px">${FINGER}</div>`;
}
function updateOutro(root, frame, t, cfg) {
  if (!cfg || t < cfg.start) { frame.style.transform = ''; frame.style.borderRadius = '0'; root.style.display = 'none'; return; }
  root.style.display = 'block';
  const lt = t - cfg.start, S = .74, ty = -120;
  const p = prog(lt, 0, .55, ease.inOut), s = lerp(1, S, p), y = lerp(0, ty, p);
  frame.style.transform = `translateY(${y}px) scale(${s})`; frame.style.borderRadius = `${lerp(0, 110, p)}px`;
  const sw = W * s, sh = H * s, sx = (W - sw) / 2, sy = (H - sh) / 2 + y;
  const bez = root.querySelector('#bezel'); Object.assign(bez.style, { left: `${sx - 16}px`, top: `${sy - 16}px`, width: `${sw}px`, height: `${sh}px`, opacity: p });
  const side = root.querySelector('#side'); Object.assign(side.style, { left: `${sx + sw - 90}px`, top: `${sy + sh * .52}px`, opacity: prog(lt, .4, .7) });
  const target = cfg.target ?? 1, contacts = cfg.contacts || ['Lucía', 'Javi', 'Marta'];
  // timeline (seconds from outro start)
  const T_SHARE = .95, T_SHEET = 1.1, T_PICK = 1.75, T_SEND = 2.45;
  const sheet = root.querySelector('#sheet'); const shH = sh * .44, shP = prog(lt, T_SHEET, T_SHEET + .35, ease.out);
  Object.assign(sheet.style, { left: `${sx}px`, width: `${sw}px`, height: `${shH}px`, top: `${sy + sh - shH * shP}px`, opacity: shP > 0 ? 1 : 0 });
  const picked = lt >= T_PICK, sent = lt >= T_SEND + .12;
  root.querySelectorAll('.av').forEach((a, i) => { const on = picked && i === target; a.style.background = on ? '#2f8bff' : 'transparent'; a.querySelector('.ck').style.display = on ? 'flex' : 'none'; });
  root.querySelectorAll('.nm').forEach((n, i) => n.style.fontWeight = picked && i === target ? 800 : 400);
  const btn = root.querySelector('#btn'); btn.style.background = sent ? '#3a3a3f' : '#2f8bff'; btn.innerHTML = sent ? '✓ Enviado' : 'Enviar';
  // finger tip positions
  const shareIcon = [sx + sw - 67, sy + sh * .52 + 3 * 92 + 23];
  const sheetTop = sy + sh - shH;
  const avatarPos = [sx + sw * ((target + .5) / contacts.length), sheetTop + 245];
  const btnPos = [sx + sw / 2 + 60, sheetTop + shH * 0 + 420];
  const off = [W + 200, H + 300];
  const keys = [[.45, off], [T_SHARE - .05, shareIcon], [T_SHEET + .25, shareIcon], [T_PICK - .05, avatarPos], [T_SEND - .3, avatarPos], [T_SEND - .05, btnPos]];
  const [fx, fy] = kf(lt, keys, ease.inOut);
  const tapAt = [T_SHARE, T_PICK, T_SEND]; let press = 0, ripple = null;
  for (const ta of tapAt) { const d = lt - ta; if (d > -.06 && d < .1) press = 1 - Math.abs(d - .02) / .08; if (d >= 0 && d < .35) ripple = { d, pos: ta === T_SHARE ? shareIcon : ta === T_PICK ? avatarPos : btnPos }; }
  const f = root.querySelector('#finger');
  f.style.left = `${fx - 95}px`; f.style.top = `${fy - 30}px`;
  f.style.transform = `rotate(-28deg) scale(${1 - .05 * clamp(press)})`;
  const rp = root.querySelector('#ripple');
  if (ripple) { const k = ripple.d / .35; Object.assign(rp.style, { left: `${ripple.pos[0] - 45}px`, top: `${ripple.pos[1] - 45}px`, opacity: 1 - k, transform: `scale(${.6 + k})` }); } else rp.style.opacity = 0;
}

// ---------- boot ----------
export async function boot(project) {
  await document.fonts.load("700 50px 'Inter Display'"); await document.fonts.load("400 50px 'Inter Display'");
  const timeline = await (await fetch(`/${project}/timeline.json`)).json();
  const fps = timeline.fps || 30;
  const words = (timeline.words || []).map(w => ({ ...w }));
  const phrases = buildPhrases(words);

  const glCanvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const camera = new THREE.PerspectiveCamera(30, W / H, .01, 200);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2420, .7); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc98a, .9); rim.position.set(-4, 3, -5); scene.add(rim);

  const bg = document.getElementById('bg').getContext('2d');
  const ovCtx = document.getElementById('ov').getContext('2d');
  const ov = makeOverlay(ovCtx);
  const cap = document.getElementById('cap');
  const frame = document.getElementById('frame');
  const phone = document.getElementById('phone');
  if (timeline.outro) buildOutro(phone, timeline.outro);

  const api = {
    THREE, scene, camera, renderer, W, H, lights: { hemi, key, rim },
    ease, prog, kf, lerp, clamp, rng, tex, mat, geo, neonPlane, contactShadow,
    cam(pos, target, fov) { camera.position.set(...pos); if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); } camera.lookAt(...target); camera.updateMatrixWorld(); },
    // Frame an object: camera looks along `dir` (from object towards camera) so the object's bounding sphere fills `fill` of the screen width.
    // screenY (0 top .. 1 bottom) = where the object's centre lands vertically (default .56 keeps the caption zone clear).
    fit(obj, { dir = [-1, .75, 1.3], fill = .78, screenY = .56, fov = 30, offset = [0, 0, 0] } = {}) {
      obj.updateMatrixWorld(true);
      const sph = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      const c = sph.center.add(new THREE.Vector3(...offset));
      const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2)), tanH = tanV * W / H;
      const d = sph.radius / (fill * tanH);
      const n = new THREE.Vector3(...dir).normalize();
      const pos = c.clone().addScaledVector(n, d);
      const tgt = c.clone(); tgt.y += (screenY - .5) * 2 * d * tanV;
      api.cam(pos.toArray(), tgt.toArray(), fov); return { pos: pos.toArray(), target: tgt.toArray(), d };
    },
    // world point ([x,y,z], Vector3 or Object3D) -> screen pixels in the 1080x1920 frame
    project(v) {
      camera.updateMatrixWorld();
      let p; if (v.isObject3D) { v.updateWorldMatrix(true, false); p = v.getWorldPosition(new THREE.Vector3()); } else p = v.isVector3 ? v.clone() : new THREE.Vector3(...v);
      p.project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
    },
    timeline, words,
    // time of the n-th occurrence of a word (case/punct-insensitive), handy to sync actions to the voice
    at(word, n = 1) { const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, ''); let k = 0; for (const w of words) if (norm(w.w) === norm(word) && ++k === n) return w.s; throw new Error(`word not found: ${word} #${n}`); },
    bgConfig: { ...(timeline.background || {}) },
  };

  const mod = await import(`/${project}/scene.js`);
  const def = await mod.default(api);
  const shots = def.shots.slice().sort((a, b) => a.start - b.start);
  shots.forEach((s, i) => { if (s.end == null) s.end = i + 1 < shots.length ? shots[i + 1].start : (timeline.duration ?? s.start + 3); if (s.group) { s.group.visible = false; scene.add(s.group); } });
  const duration = timeline.duration ?? shots[shots.length - 1].end;

  window.__renderFrame = async (i) => {
    const t = i / fps;
    let shot = shots[0]; for (const s of shots) if (s.start <= t + 1e-6) shot = s;
    for (const s of shots) if (s.group) s.group.visible = s === shot;
    Object.assign(api.bgConfig, timeline.background || {}, shot.background || {});
    drawBg(bg, t, api.bgConfig);
    ovCtx.clearRect(0, 0, W, H);
    const lt = t - shot.start;
    shot.update?.(lt, { t, shot, ov, dur: shot.end - shot.start });
    // focus-pull transitions at cuts
    const tin = shot.in ?? 'blur', tout = shot.out ?? 'blur';
    let blur = 0, sc = 1;
    if (tin === 'blur') { const k = 1 - prog(lt, 0, .22, ease.out); blur = Math.max(blur, k * 16); sc *= 1 + k * .05; }
    if (tout === 'blur') { const k = prog(lt, shot.end - shot.start - .16, shot.end - shot.start, ease.in); blur = Math.max(blur, k * 16); sc *= 1 + k * .04; }
    const f = `blur(${blur.toFixed(2)}px)`, tr = `scale(${sc.toFixed(4)})`;
    for (const el of [glCanvas, ovCtx.canvas]) { el.style.filter = blur > .05 ? f : 'none'; el.style.transform = tr; }
    renderer.render(scene, camera);
    renderCaptions(cap, words, phrases, t, timeline.captions || {});
    cap.style.top = `${(timeline.captions && timeline.captions.top) || 300}px`;
    updateOutro(phone, frame, t, timeline.outro);
    await new Promise(r => requestAnimationFrame(() => r()));
  };
  return { fps, duration, frames: Math.round(duration * fps) };
}
```

### `explainer3d/render.mjs`
```js
#!/usr/bin/env node
// Frame-by-frame renderer: headless Chromium (WebGL via SwiftShader) -> JPEG frames -> ffmpeg (H.264 1080x1920) + audio.
// Usage:
//   node render.mjs <projectDir> [--out video.mp4] [--from 0] [--to 30] [--stills 1.2,4.5,9] [--fps 30] [--workers N]
// <projectDir> must contain timeline.json and scene.js (see SKILL.md).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const projectDir = path.resolve(args[0] || '.');
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(opt('out', path.join(projectDir, 'out.mp4')));
const stills = opt('stills', null);

// locate three.js
const cands = [process.env.THREE_DIR, path.join(projectDir, 'node_modules'), path.join(process.cwd(), 'node_modules'), path.join(HERE, 'node_modules')].filter(Boolean);
const modulesDir = cands.find(d => fs.existsSync(path.join(d, 'three/build/three.module.js')));
if (!modulesDir) { console.error('three.js not found. Run: npm i three@0.170.0  (in the project or current folder)'); process.exit(1); }

// locate playwright (local or global)
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = createRequire(path.join(g, 'x.js'))('playwright'));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f;
  if (u === '/' || u === '/index.html') f = path.join(HERE, 'engine/index.html');
  else if (u.startsWith('/engine/')) f = path.join(HERE, u);
  else if (u.startsWith('/node_modules/')) f = path.join(modulesDir, u.slice('/node_modules/'.length));
  else if (u.startsWith('/project/')) f = path.join(projectDir, u.slice('/project/'.length));
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + u); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// GPU=1 uses the real GPU (much faster on a Mac/PC with a graphics card); default is SwiftShader (CPU, works everywhere)
const glArgs = process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: glArgs, headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/?project=project`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
const info = await page.evaluate(() => window.__info);
const fps = Number(opt('fps', info.fps));
const timeline = JSON.parse(fs.readFileSync(path.join(projectDir, 'timeline.json'), 'utf8'));
const root = await page.$('#root');

if (stills) {
  const dir = path.join(projectDir, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    await page.evaluate(i => window.__renderFrame(i), Math.round(s * info.fps));
    const f = path.join(dir, `still_${s.toFixed(2)}.png`); await root.screenshot({ path: f }); console.log(f);
  }
  await browser.close(); server.close(); process.exit(0);
}

const from = Math.round(Number(opt('from', 0)) * fps);
const to = Math.min(info.frames, Math.round(Number(opt('to', info.duration)) * fps));
const silent = path.join(projectDir, '.video_noaudio.mp4');
// parallel workers: each renders a contiguous chunk in its own page (own renderer process) -> segment, then concat
const workers = Math.max(1, Number(opt('workers', Math.max(1, Math.min(6, (await import('node:os')).cpus().length - 1)))));
const t0 = Date.now(); let done = 0;
async function renderChunk(pg, a, b, file) {
  const rt = await pg.$('#root');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    await pg.evaluate(n => window.__renderFrame(n), Math.round(i * info.fps / fps));
    const buf = await rt.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 15 === 0) { const el = (Date.now() - t0) / 1000; process.stdout.write(`\r${done}/${to - from} frames  ${(done / el).toFixed(1)} fps  eta ${Math.round((to - from - done) / (done / el))}s   `); }
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
const pages = [page];
for (let k = 1; k < workers; k++) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${port}/?project=project`);
  await p.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
  pages.push(p);
}
const n = to - from, size = Math.ceil(n / workers), segs = [];
await Promise.all(pages.map((p, k) => {
  const a = from + k * size, b = Math.min(to, a + size); if (a >= b) return null;
  const f = path.join(projectDir, `.seg_${k}.mp4`); segs[k] = f; return renderChunk(p, a, b, f);
}));
const list = path.join(projectDir, '.segs.txt');
fs.writeFileSync(list, segs.filter(Boolean).map(f => `file '${f}'`).join('\n'));
spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent], { stdio: 'inherit' });
segs.filter(Boolean).forEach(f => fs.unlinkSync(f)); fs.unlinkSync(list);
await browser.close(); server.close();

// mux audio: voice (timeline.audio) + optional music bed (timeline.music, timeline.musicVolume)
const voice = timeline.audio && path.join(projectDir, timeline.audio);
const music = timeline.music && path.join(projectDir, timeline.music);
const ss = (from / fps).toFixed(3), dur = ((to - from) / fps).toFixed(3);
const inputs = ['-i', silent]; let filter = null, maps = ['-map', '0:v'];
if (voice && fs.existsSync(voice)) inputs.push('-ss', ss, '-t', dur, '-i', voice);
if (music && fs.existsSync(music)) inputs.push('-ss', ss, '-t', dur, '-i', music);
const nA = (inputs.filter(x => x === '-i').length) - 1;
if (nA === 1) maps.push('-map', '1:a');
if (nA === 2) { filter = `[2:a]volume=${timeline.musicVolume ?? 0.12}[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]`; maps.push('-map', '[a]'); }
if (nA === 0) fs.renameSync(silent, out);
else {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, ...(filter ? ['-filter_complex', filter] : []), ...maps, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg mux failed'); process.exit(1); }
  fs.unlinkSync(silent);
}
console.log(`\nDone -> ${out}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
```

### `explainer3d/timeline.py`
```python
#!/usr/bin/env python3
"""Build/refresh the `words` track of timeline.json from a script (+ optional voice-over).

Script syntax (script.txt):
  *palabra*   -> keyword highlighted with the blue "selection box"
  /           -> force a caption break after the previous word
  Normal punctuation (. ? ! ,) also ends caption phrases.

Timing sources (best first):
  --words words.json  : [{"word":..,"start":..,"end":..}] from any aligner (ElevenLabs "with timestamps", WhisperX, CapCut export...)
  --whisper           : run faster-whisper locally on --audio (needs `pip install faster-whisper` + model download)
  --srt subs.srt      : segment timings; words spread inside each segment by syllables
  --audio voice.mp3   : no aligner -> spread words over the audio duration by syllables + punctuation pauses
  (nothing)           : estimate at --rate syllables/second (default 6.3, a fast Spanish narrator)

Usage: python3 timeline.py <projectDir> [--audio voice.mp3] [--whisper | --srt f | --words f] [--rate 6.3] [--lead 0.15]
"""
import json, re, sys, os, subprocess, unicodedata, difflib, argparse

ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--audio'); ap.add_argument('--srt'); ap.add_argument('--words')
ap.add_argument('--whisper', action='store_true'); ap.add_argument('--rate', type=float, default=6.3)
ap.add_argument('--lead', type=float, default=0.15, help='silence before first word when estimating')
ap.add_argument('--lang', default='es')
a = ap.parse_args()
P = a.project
script = open(os.path.join(P, 'script.txt'), encoding='utf8').read()

# ---- tokenize script ----
toks = []
for raw in script.replace('\n', ' ').split():
    if raw == '/':
        if toks: toks[-1]['br'] = True
        continue
    hl = '*' in raw
    w = raw.replace('*', '')
    if w.endswith('/'):
        w = w[:-1]; toks.append({'w': w, 'hl': hl, 'br': True}); continue
    toks.append({'w': w, 'hl': hl})

def norm(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)
def syl(w):
    n = len(re.findall(r'[aeiouáéíóúü]+', w.lower()))
    return max(1, n)
def pause_after(w):
    if re.search(r'[.?!…]$', w): return 1.6
    if re.search(r'[,;:]$', w): return 0.8
    return 0.0

def audio_dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())

def spread(tokens, t0, t1):
    """distribute tokens between t0 and t1 by syllable weight + punctuation pauses (pause unit = 1 syllable)."""
    weights = [syl(t['w']) for t in tokens]; pauses = [pause_after(t['w']) for t in tokens]
    total = sum(weights) + sum(pauses[:-1])
    k = (t1 - t0) / total if total else 0; t = t0
    for i, tk in enumerate(tokens):
        tk['s'] = round(t, 3); t += weights[i] * k; tk['e'] = round(t, 3)
        if i < len(tokens) - 1: t += pauses[i] * k

def apply_aligned(tokens, aligned):
    """aligned: list of (word, start, end) from an ASR. Map onto script tokens via sequence matching."""
    A = [norm(w) for w, _, _ in aligned]; B = [norm(t['w']) for t in tokens]
    sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    for blk in sm.get_matching_blocks():
        for j in range(blk.size):
            w, s, e = aligned[blk.a + j]; tokens[blk.b + j]['s'] = round(s, 3); tokens[blk.b + j]['e'] = round(e, 3)
    # fill gaps by interpolation
    i = 0
    while i < len(tokens):
        if 's' in tokens[i]: i += 1; continue
        j = i
        while j < len(tokens) and 's' not in tokens[j]: j += 1
        t0 = tokens[i - 1]['e'] if i > 0 else 0.0
        t1 = tokens[j]['s'] if j < len(tokens) else t0 + 0.3 * (j - i)
        spread(tokens[i:j], t0, max(t1, t0 + 0.05 * (j - i)))
        i = j

duration = None
if a.words:
    data = json.load(open(a.words)); apply_aligned(toks, [(d.get('word') or d.get('text'), d['start'], d['end']) for d in data])
elif a.whisper:
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get('WHISPER_MODEL', 'small'), device='cpu', compute_type='int8')
    segs, _ = m.transcribe(os.path.join(P, a.audio) if not os.path.isabs(a.audio) else a.audio, language=a.lang, word_timestamps=True)
    aligned = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    apply_aligned(toks, aligned)
elif a.srt:
    txt = open(a.srt, encoding='utf8').read()
    segs = []
    for m in re.finditer(r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\s*\n(.+?)(?:\n\n|\Z)', txt, re.S):
        g = m.groups(); s = int(g[0]) * 3600 + int(g[1]) * 60 + int(g[2]) + int(g[3]) / 1000; e = int(g[4]) * 3600 + int(g[5]) * 60 + int(g[6]) + int(g[7]) / 1000
        segs.append((s, e, g[8].split()))
    aligned = []
    for s, e, ws in segs:
        tmp = [{'w': w} for w in ws]; spread(tmp, s, e); aligned += [(t['w'], t['s'], t['e']) for t in tmp]
    apply_aligned(toks, aligned)
elif a.audio:
    duration = audio_dur(os.path.join(P, a.audio))
    spread(toks, a.lead, duration - 0.35)
else:
    total = sum(syl(t['w']) for t in toks) + sum(pause_after(t['w']) for t in toks[:-1])
    spread(toks, a.lead, a.lead + total / a.rate)

tl_path = os.path.join(P, 'timeline.json')
tl = json.load(open(tl_path)) if os.path.exists(tl_path) else {}
tl.setdefault('fps', 30)
if a.audio: tl['audio'] = a.audio
if duration is None and a.audio: duration = audio_dur(os.path.join(P, a.audio))
end_words = toks[-1]['e']
outro = tl.get('outro')
if outro and outro.get('startWord'):
    sw = norm(outro['startWord'])
    hit = next((t for t in toks if norm(t['w']) == sw), None)
    if hit: outro['start'] = round(hit['s'] - 0.1, 3)
tl['words'] = [{k: v for k, v in t.items() if v is not False} for t in toks]
tl['duration'] = round(max(duration or 0, end_words + 0.8, (outro or {}).get('start', 0) + 3.4), 2)
json.dump(tl, open(tl_path, 'w'), ensure_ascii=False, indent=1)
print(f"{len(toks)} words, {tl['duration']}s -> {tl_path}")
for t in toks: print(f"{t['s']:6.2f} {t['e']:6.2f}  {'*' if t.get('hl') else ' '} {t['w']}")
```