// AI Video Studio — motor de render
// Principio: cada fotograma es una función pura del tiempo -> renderAt(t).
// Nada de timers, Math.random ni recursos externos: el mismo t siempre da el mismo fotograma.

export const DEFAULT_STYLE = {
  brand: { handle: "@tu_usuario" },
  ebook: { title: "Tu ebook", author: "Tu nombre", tag: "EBOOK" },
  look: "clean", // "clean" (explicativo) | "mystery" (niebla, viñeta, grano) | "anime" (trama manga, líneas de impacto, kanji) | "editorial" (ficha científica)
  fonts: { family: "Inter", mono: "Liberation Mono" },
  colors: {
    bg: "#0E0F13", surface: "#1A1C23", text: "#F5F5F7", muted: "#9BA0AE",
    accent: "#FFD23F", onAccent: "#111111", accent2: "#6C5CE7",
    bad: "#FF5C5C", good: "#2ED47A",
    paper: "#E9E1CC", ink: "#1B1A17",
  },
  motion: { wordStagger: 0.06, sceneIn: 0.45, sceneOut: 0.3 },
  overlay: { progress: true, handle: true },
};

export const SAFE = { top: 310, bottom: 1500, left: 90, right: 990 };

// Formatos: todos salen del mismo timeline, nunca de un recorte.
// El motor dibuja en un "espacio de diseño" (VW×VH) y lo escala al lienzo real:
// en 9:16 es 1080×1920 (k = 1); en 1:1, 4:5 o 16:9 la letra queda proporcionalmente más pequeña
// y la zona segura se adapta al formato.
export function designSpace(w, h) {
  const k = Math.min(w / 1080, h / 1600, 1);
  const VW = w / k, VH = h / k;
  const tall = VH / VW >= 1.7;
  const side = Math.max(90, (VW - 1500) / 2); // en 16:9 el texto va en una columna central
  const safe = tall
    ? { top: Math.round(VH * 0.1615), bottom: Math.round(VH * 0.78), left: 90, right: Math.round(VW - 90) }
    : { top: Math.round(VH * 0.14), bottom: Math.round(VH * 0.9), left: Math.round(side), right: Math.round(VW - side) };
  return { k, VW, VH, safe };
}

// Muelle en forma cerrada (masa-muelle amortiguado): va de 0 a 1 y depende solo de t,
// así que cualquier fotograma se puede pedir suelto. Con overshoot si damping es bajo.
export function spring(t, { stiffness = 170, damping = 26, mass = 1 } = {}) {
  if (!(t > 0)) return 0;
  if (t > 12) return 1;
  const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
// Una regla por clase de objeto: si todo rebota, nada parece preciso.
export const SPRINGS = {
  snap: { stiffness: 420, damping: 34 },   // etiquetas y UI pequeña: casi sin rebote
  settle: { stiffness: 170, damping: 20 }, // tarjetas y paneles: se asientan
  glide: { stiffness: 60, damping: 16 },   // cámara: sin rebote
  land: { stiffness: 300, damping: 18 },   // titulares: caen con peso
  bounce: { stiffness: 220, damping: 10 }, // botón del CTA: rebote a propósito
};
// Valor que cambia de objetivo varias veces: un muelle por cambio, sumados (sin simular).
// keys: [{t, v}] ordenadas; el primer v es el valor inicial.
export function track(t, keys, cfg = SPRINGS.settle) {
  if (!keys.length) return 0;
  let v = keys[0].v;
  for (let i = 1; i < keys.length; i++) v += (keys[i].v - keys[i - 1].v) * spring(t - keys[i].t, cfg);
  return v;
}

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Pseudoaleatorio determinista: mismo n -> mismo valor (nada de Math.random).
const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

function mergeStyle(style = {}) {
  const out = {};
  for (const k of Object.keys(DEFAULT_STYLE)) {
    out[k] = typeof DEFAULT_STYLE[k] === "object" ? { ...DEFAULT_STYLE[k], ...(style[k] || {}) } : style[k] ?? DEFAULT_STYLE[k];
  }
  for (const k of Object.keys(style)) if (!(k in out)) out[k] = style[k];
  return out;
}

// "Texto con *palabras destacadas*," -> [{w, hl, segs:[{t, hl}]}]
// Una "palabra" puede mezclar tramos destacados y no destacados (p. ej. "*café*,").
export function parseRich(text = "") {
  const words = [];
  let hl = false;
  for (const raw of String(text).split(/\s+/)) {
    if (!raw) continue;
    const segs = [];
    for (const part of raw.split(/(\*)/)) {
      if (part === "*") { hl = !hl; continue; }
      if (part) segs.push({ t: part, hl });
    }
    if (segs.length) words.push({ w: segs.map((s) => s.t).join(""), hl: segs.some((s) => s.hl), segs });
  }
  return words;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- estudio ----------
// Carga las imágenes que usa el timeline (campo "image" de cada escena) desde base.
// Se hace una sola vez antes de crear el estudio, así renderAt(t) sigue siendo puro.
export async function loadImages(timeline, base = "") {
  const srcs = [...new Set((timeline.scenes || []).map((s) => s.image).filter(Boolean))];
  const out = {};
  await Promise.all(srcs.map((src) => new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => { out[src] = img; ok(); };
    img.onerror = () => ko(new Error(`No se pudo cargar la imagen ${src}`));
    img.src = `${base}/${src}`;
  })));
  return out;
}

export function createStudio(canvas, timeline, styleIn, images = {}) {
  const CANVAS_W = timeline.width || 1080;
  const CANVAS_H = timeline.height || 1920;
  const DS = designSpace(CANVAS_W, CANVAS_H);
  const W = DS.VW, H = DS.VH, SAFE = DS.safe;
  const fps = timeline.fps || 30;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  const S = mergeStyle(styleIn);
  const C = S.colors;
  const FAMILY = S.fonts.family || "Inter";
  const font = (weight, size) => `${weight} ${size}px ${FAMILY}, Inter, Arial, sans-serif`;
  const mono = (weight, size) => `${weight} ${size}px "${S.fonts.mono || "Liberation Mono"}", "Courier New", monospace`;
  const MYSTERY = S.look === "mystery";
  const ANIME = S.look === "anime";
  const EDITORIAL = S.look === "editorial";
  const serif = (weight, size) => `${weight} ${size}px "${S.fonts.serif || "Source Serif 4"}", Georgia, IPAGothic, serif`;
  const kanjiFont = (size) => `400 ${size}px IPAGothic, "IPAゴシック", sans-serif`;

  // Grano de película: textura generada una vez con semilla fija.
  let grain = null;
  if ((MYSTERY || ANIME) && typeof document !== "undefined") {
    grain = document.createElement("canvas");
    grain.width = 512; grain.height = 512;
    const g = grain.getContext("2d");
    const img = g.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) {
      const v = Math.floor(hash(i * 7 + 13) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  // Trama de manga (puntos de semitono): se genera una vez y se reutiliza.
  let tone = null;
  if (ANIME && typeof document !== "undefined") {
    tone = document.createElement("canvas");
    tone.width = Math.ceil(W); tone.height = Math.ceil(H);
    const g = tone.getContext("2d");
    const step = 18;
    g.fillStyle = C.tone || "#3A0A10";
    for (let y = 0; y < H + step; y += step) {
      for (let x = (y / step) % 2 ? step / 2 : 0; x < W + step; x += step) {
        // más trama arriba (luz roja) y en las esquinas de abajo
        const top = clamp(1 - y / (H * 0.55));
        const corner = clamp((Math.hypot(x - W / 2, y - H) - H * 0.45) / (H * 0.4));
        const r = (step / 2) * Math.max(top * 0.9, corner * 0.7);
        if (r > 0.6) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      }
    }
  }

  let acc = 0;
  const sched = timeline.scenes.map((s, i) => {
    const start = acc;
    acc += s.duration;
    return { s, i, start, end: acc };
  });
  const total = acc;
  const totalFrames = Math.round(total * fps);

  let collect = null; // cuando es un array, se registran las cajas de texto (para el control de zonas seguras)
  let currentLabel = "";

  // ---- texto enriquecido ----
  function layoutRich({ text, maxWidth, size, weight = 800, lh = 1.12, hlMode = "marker", face }) {
    const fontFn = face === "serif" ? serif : font;
    ctx.font = fontFn(weight, size);
    const padX = hlMode === "marker" ? size * 0.14 : 0; // margen interior del rotulador
    const words = parseRich(text).map((o) => ({
      ...o,
      segs: o.segs.map((s) => ({ ...s, width: ctx.measureText(s.t).width })),
      width: ctx.measureText(o.w).width,
    }));
    const space = ctx.measureText(" ").width;
    const lines = [];
    let line = [], lw = 0;
    for (const wd of words) {
      const ww = wd.width + (wd.hl ? padX * 2 : 0); // estimación conservadora para cortar líneas
      const add = line.length ? space + ww : ww;
      if (line.length && lw + add > maxWidth) { lines.push(line); line = [wd]; lw = ww; }
      else { line.push(wd); lw += add; }
    }
    if (line.length) lines.push(line);
    // posiciones exactas: el rotulador ocupa padX a cada lado de cada tramo destacado
    const out = lines.map((ws) => {
      let x = 0, prevHl = false;
      const placed = [];
      ws.forEach((wd, wi) => {
        if (wi > 0) x += space;
        const segs = wd.segs.map((s, si) => {
          const nextHl = si < wd.segs.length - 1 ? wd.segs[si + 1].hl : (ws[wi + 1]?.segs[0].hl ?? false);
          const startRun = s.hl && !prevHl;
          const endRun = s.hl && !nextHl;
          if (startRun) x += padX;
          const seg = { ...s, x, startRun, endRun };
          x += s.width;
          if (endRun) x += padX;
          prevHl = s.hl;
          return seg;
        });
        // si el siguiente tramo sigue destacado tras un espacio, el rotulador cubre el espacio
        placed.push({ ...wd, segs, joinNext: wd.segs.at(-1).hl && (ws[wi + 1]?.segs[0].hl ?? false) });
      });
      return { words: placed, width: x };
    });
    const lineH = size * lh;
    const widest = Math.max(0, ...out.map((l) => l.width));
    return { lines: out, space, padX, lineH, h: out.length * lineH, w: widest, size, weight, hlMode, count: words.length, fontFn };
  }

  // Dibuja texto con revelado palabra a palabra. y = borde superior del bloque.
  function drawRich(opts) {
    const {
      x, y, align = "center", color = C.text,
      t = Infinity, delay = 0, stagger = S.motion.wordStagger, label = "texto", hlColor = C.accent,
    } = opts;
    const L = opts.layout || layoutRich(opts);
    const marker = L.hlMode === "marker";
    ctx.font = (L.fontFn || font)(L.weight, L.size);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let idx = 0;
    L.lines.forEach((ln, li) => {
      const mid = y + li * L.lineH + L.lineH / 2;
      const x0 = align === "center" ? x - ln.width / 2 : align === "right" ? x - ln.width : x;
      ln.words.forEach((wd) => {
        const tt = t - delay - idx * stagger;
        const wt = clamp(tt / 0.4);
        idx++;
        if (wt <= 0) return;
        const e = easeOutCubic(wt);
        const dy = (1 - spring(tt, SPRINGS.land)) * L.size * 0.35;
        const me = easeOutCubic(clamp((wt - 0.25) / 0.6));
        ctx.save();
        ctx.globalAlpha *= e;
        wd.segs.forEach((s, si) => {
          const sx = x0 + s.x;
          if (s.hl && marker) {
            const left = sx - (s.startRun ? L.padX : 0);
            const right = sx + s.width + (s.endRun ? L.padX : 0) + (si === wd.segs.length - 1 && wd.joinNext ? L.space : 0);
            ctx.fillStyle = C.accent;
            roundRect(ctx, left, mid - L.size * 0.56 + dy, Math.max(0, (right - left) * me), L.size * 1.12, L.size * 0.14);
            ctx.fill();
            ctx.fillStyle = me > 0.35 ? C.onAccent : color;
          } else {
            ctx.fillStyle = s.hl ? hlColor : color;
          }
          ctx.fillText(s.t, sx, mid + dy);
        });
        ctx.restore();
      });
    });
    if (collect) {
      const left = align === "center" ? x - L.w / 2 : align === "right" ? x - L.w : x;
      collect.push({ scene: currentLabel, label, x: left, y, w: L.w, h: L.h, maxWidth: opts.maxWidth });
    }
    return L;
  }

  function pill(text, x, y, { size = 40, bg = C.accent, fg = C.onAccent, weight = 800, align = "left", label = "pill" } = {}) {
    ctx.font = font(weight, size);
    const tw = ctx.measureText(text).width;
    const padX = size * 0.7, h = size * 1.7, w = tw + padX * 2;
    const left = align === "center" ? x - w / 2 : x;
    ctx.fillStyle = bg;
    roundRect(ctx, left, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(text, left + padX, y + h / 2 + size * 0.03);
    if (collect) collect.push({ scene: currentLabel, label, x: left, y, w, h });
    return { w, h };
  }

  const CW = SAFE.right - SAFE.left; // ancho útil
  const CENTER_Y = (SAFE.top + SAFE.bottom) / 2;

  // ---------- imágenes (fondo de escena) ----------
  const MOVES = ["in", "left", "out", "right", "up"];
  // Imagen a pantalla completa con movimiento lento de cámara (Ken Burns).
  function drawImageBg(sc, i, lt, d) {
    const img = images[sc.image];
    if (!img) return false;
    const p = easeInOut(clamp(lt / d));
    const mv = sc.move || MOVES[i % MOVES.length];
    let k = 1.08, dx = 0, dy = 0;
    if (mv === "in") k = 1.04 + 0.1 * p;
    else if (mv === "out") k = 1.14 - 0.1 * p;
    else if (mv === "left") dx = 40 - 80 * p;
    else if (mv === "right") dx = -40 + 80 * p;
    else if (mv === "up") dy = 50 - 100 * p;
    const cover = Math.max(W / img.width, H / img.height);
    const contain = Math.min(W / img.width, H / img.height);
    // Si la imagen no encaja en el formato (p. ej. un storyboard 9:16 en 16:9), no se recorta:
    // va entera, sobre una copia ampliada y desenfocada de sí misma.
    const fits = contain / cover > 0.8;
    if (!fits) {
      ctx.save();
      ctx.filter = "blur(40px) brightness(0.45)";
      const bw = img.width * cover * 1.1, bh = img.height * cover * 1.1;
      ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
      ctx.restore();
    }
    const base = (fits ? cover : contain) * k;
    const iw = img.width * base, ih = img.height * base;
    ctx.drawImage(img, (W - iw) / 2 + dx, (H - ih) / 2 + dy, iw, ih);
    return true;
  }

  // ---------- escenas ----------
  const SCENES = {
    // Gancho: frase grande centrada, se revela palabra a palabra y hace un leve zoom.
    hook(sc, lt, d) {
      const main = layoutRich({ text: sc.text, maxWidth: CW, size: sc.size || 118, weight: 900, lh: 1.1 });
      const sub = sc.sub ? layoutRich({ text: sc.sub, maxWidth: CW - 40, size: 54, weight: 600, lh: 1.25, hlMode: "color" }) : null;
      const gap = 56;
      const blockH = main.h + (sub ? gap + sub.h : 0);
      const top = CENTER_Y - blockH / 2;
      const zoom = 1 + 0.04 * easeInOut(clamp(lt / d));
      ctx.save();
      ctx.translate(W / 2, CENTER_Y);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -CENTER_Y);
      drawRich({ layout: main, x: W / 2, y: top, t: lt, stagger: 0.075, label: "hook.text", maxWidth: CW });
      if (sub) drawRich({ layout: sub, x: W / 2, y: top + main.h + gap, t: lt, delay: 0.25 + main.count * 0.075, color: C.muted, label: "hook.sub", maxWidth: CW });
      ctx.restore();
    },

    // Afirmación: etiqueta (pill) + frase + nota.
    statement(sc, lt) {
      const main = layoutRich({ text: sc.text, maxWidth: CW, size: sc.size || 100, weight: 900, lh: 1.1 });
      const note = sc.note ? layoutRich({ text: sc.note, maxWidth: CW - 50, size: sc.noteSize || 56, weight: 600, lh: 1.28, hlMode: "color" }) : null;
      const pillH = sc.kicker ? 40 * 1.7 : 0;
      const g1 = sc.kicker ? 44 : 0, g2 = 60;
      const blockH = pillH + g1 + main.h + (note ? g2 + note.h : 0);
      let y = CENTER_Y - blockH / 2;
      if (sc.kicker) {
        const e = spring(lt, SPRINGS.snap);
        ctx.save();
        ctx.globalAlpha *= clamp(lt / 0.25);
        ctx.translate(-80 * (1 - e), 0);
        pill(sc.kicker.toUpperCase(), SAFE.left, y, { size: 40, label: "statement.kicker" });
        ctx.restore();
        y += pillH + g1;
      }
      drawRich({ layout: main, x: SAFE.left, y, align: "left", t: lt, delay: 0.2, label: "statement.text", maxWidth: CW });
      y += main.h + g2;
      if (note) {
        const nd = 0.4 + main.count * S.motion.wordStagger;
        const ne = easeOutCubic(clamp((lt - nd) / 0.5));
        ctx.save();
        ctx.globalAlpha *= ne;
        ctx.fillStyle = C.accent;
        roundRect(ctx, SAFE.left, y + 4, 8, note.h - 8, 4);
        ctx.fill();
        ctx.restore();
        drawRich({ layout: note, x: SAFE.left + 40, y, align: "left", t: lt, delay: nd, stagger: 0.03, color: C.muted, label: "statement.note", maxWidth: CW - 50 });
      }
    },

    // Lista numerada: los puntos aparecen uno a uno.
    list(sc, lt) {
      const title = sc.title ? layoutRich({ text: sc.title, maxWidth: CW, size: sc.size || 104, weight: 900, lh: 1.1 }) : null;
      const itemSize = sc.itemSize || 78;
      const R = itemSize * 0.72;
      const items = (sc.items || []).map((it) => layoutRich({ text: it, maxWidth: CW - R * 2 - 36, size: itemSize, weight: 800, lh: 1.15, hlMode: "color" }));
      const gT = title ? 80 : 0, gI = 44;
      const itemsH = items.reduce((a, L) => a + Math.max(L.h, R * 2), 0) + gI * Math.max(0, items.length - 1);
      let y = CENTER_Y - ((title ? title.h : 0) + gT + itemsH) / 2;
      if (title) { drawRich({ layout: title, x: SAFE.left, y, align: "left", t: lt, label: "list.title", maxWidth: CW }); y += title.h + gT; }
      const base = 0.35 + (title ? title.count * S.motion.wordStagger : 0);
      const step = sc.itemDelay || 0.5;
      items.forEach((L, i) => {
        const rowH = Math.max(L.h, R * 2);
        const d0 = base + i * step;
        const e = spring(lt - d0, SPRINGS.snap);
        const a = clamp((lt - d0) / 0.2);
        ctx.save();
        ctx.globalAlpha *= a;
        const cx = SAFE.left + R, cy = y + (rowH - L.h) / 2 + L.lineH / 2;
        ctx.translate(cx, cy);
        ctx.scale(e, e);
        ctx.fillStyle = C.accent;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.onAccent;
        ctx.font = font(900, itemSize * 0.8);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), 0, itemSize * 0.03);
        ctx.restore();
        drawRich({ layout: L, x: SAFE.left + R * 2 + 36, y: y + (rowH - L.h) / 2, align: "left", t: lt, delay: d0 + 0.1, stagger: 0.035, label: `list.item${i + 1}`, maxWidth: CW - R * 2 - 36 });
        y += rowH + gI;
      });
    },

    // Número grande que cuenta hasta su valor.
    number(sc, lt) {
      const v = Number(sc.value) || 0;
      const p = easeOutCubic(clamp((lt - 0.1) / (sc.countDuration || 1.1)));
      const dec = sc.decimals || 0;
      const shown = `${sc.prefix || ""}${(v * p).toFixed(dec)}${sc.suffix || ""}`;
      const final = `${sc.prefix || ""}${v.toFixed(dec)}${sc.suffix || ""}`;
      let size = sc.size || 340;
      ctx.font = font(900, size);
      while (ctx.measureText(final).width > CW && size > 80) { size -= 10; ctx.font = font(900, size); }
      const label = sc.label ? layoutRich({ text: sc.label, maxWidth: CW, size: 64, weight: 800, lh: 1.15 }) : null;
      const gap = 40;
      const numH = size * 1.0;
      const top = CENTER_Y - (numH + (label ? gap + label.h : 0)) / 2;
      const pop = spring(lt, SPRINGS.land);
      ctx.save();
      ctx.translate(W / 2, top + numH / 2);
      ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
      ctx.globalAlpha *= clamp(lt / 0.2);
      ctx.fillStyle = C.accent;
      ctx.font = font(900, size);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(shown, 0, 0);
      ctx.restore();
      if (collect) { ctx.font = font(900, size); const fw = ctx.measureText(final).width; collect.push({ scene: currentLabel, label: "number.value", x: W / 2 - fw / 2, y: top, w: fw, h: numH }); }
      if (label) drawRich({ layout: label, x: W / 2, y: top + numH + gap, t: lt, delay: 0.6, label: "number.label", maxWidth: CW });
    },

    // Comparación: tarjeta ANTES / DESPUÉS.
    compare(sc, lt) {
      const pad = 44;
      const inner = CW - pad * 2;
      const mk = (side) => layoutRich({ text: side.text, maxWidth: inner, size: sc.size || 64, weight: 800, lh: 1.22, hlMode: "color" });
      const A = mk(sc.left), B = mk(sc.right);
      const pillH = 38 * 1.7, gIn = 30;
      const hA = pad + pillH + gIn + A.h + pad, hB = pad + pillH + gIn + B.h + pad;
      const title = sc.title ? layoutRich({ text: sc.title, maxWidth: CW, size: 88, weight: 900, lh: 1.1 }) : null;
      const gT = title ? 50 : 0, gap = 40;
      let y = CENTER_Y - ((title ? title.h + gT : 0) + hA + gap + hB) / 2;
      if (title) { drawRich({ layout: title, x: SAFE.left, y, align: "left", t: lt, label: "compare.title", maxWidth: CW }); y += title.h + gT; }
      const card = (side, L, h, y0, d0, col, dim, key) => {
        const e = easeOutCubic(clamp((lt - d0) / 0.5));
        if (e <= 0) return;
        ctx.save();
        ctx.globalAlpha *= e * dim;
        ctx.translate((1 - e) * -120, 0);
        ctx.fillStyle = C.surface;
        roundRect(ctx, SAFE.left, y0, CW, h, 36); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 4;
        roundRect(ctx, SAFE.left, y0, CW, h, 36); ctx.stroke();
        pill(side.label.toUpperCase(), SAFE.left + pad, y0 + pad, { size: 38, bg: col, fg: "#111", label: `${key}.label` });
        drawRich({ layout: L, x: SAFE.left + pad, y: y0 + pad + pillH + gIn, align: "left", t: lt, delay: d0 + 0.2, stagger: 0.025, label: `${key}.text`, maxWidth: inner });
        ctx.restore();
      };
      const d1 = 0.15, d2 = sc.secondDelay || 1.3;
      const dimA = 1 - 0.45 * easeOutCubic(clamp((lt - d2 - 0.4) / 0.5));
      card(sc.left, A, hA, y, d1, C.bad, dimA, "compare.left");
      card(sc.right, B, hB, y + hA + gap, d2, C.good, 1, "compare.right");
    },

    // Expediente: ficha de papel con datos a máquina y sello final.
    // rows: [{k, v}] · title · stamp · cps (caracteres por segundo)
    casefile(sc, lt, d) {
      const pad = 56, cardW = CW, innerW = cardW - pad * 2;
      const rows = sc.rows || [];
      const titleSize = 46, kSize = 34, vSize = sc.valueSize || 50, rowGap = 34;
      const vLines = rows.map((r) => wrapMono(String(r.v), innerW, vSize, 700));
      const rowsH = vLines.reduce((a, ls) => a + kSize * 1.3 + 8 + ls.length * vSize * 1.2, 0) + rowGap * Math.max(0, rows.length - 1);
      const headH = titleSize * 1.4 + 40;
      const cardH = pad + headH + rowsH + pad + (sc.stamp ? 40 : 0);
      const x0 = SAFE.left, y0 = CENTER_Y - cardH / 2;
      const e = easeOutCubic(clamp(lt / 0.5));
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(W / 2, y0 + cardH / 2);
      ctx.rotate(((-1.5 + 1.5 * e) * Math.PI) / 180);
      ctx.translate(-W / 2, -(y0 + cardH / 2) + (1 - e) * 60);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x0 + 14, y0 + 18, cardW, cardH);
      ctx.fillStyle = C.paper;
      ctx.fillRect(x0, y0, cardW, cardH);
      // manchas y bordes gastados (deterministas)
      for (let i = 0; i < 18; i++) {
        const gx = x0 + hash(i * 3 + 1) * cardW, gy = y0 + hash(i * 3 + 2) * cardH, gr = 30 + hash(i * 3 + 3) * 120;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        rg.addColorStop(0, "rgba(120,90,40,0.10)"); rg.addColorStop(1, "rgba(120,90,40,0)");
        ctx.fillStyle = rg; ctx.fillRect(x0, y0, cardW, cardH);
      }
      ctx.fillStyle = C.ink;
      ctx.font = mono(700, titleSize);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(String(sc.title || "EXPEDIENTE").toUpperCase(), x0 + pad, y0 + pad);
      ctx.fillRect(x0 + pad, y0 + pad + titleSize * 1.4 + 10, innerW, 4);
      if (collect) collect.push({ scene: currentLabel, label: "casefile.card", x: x0, y: y0, w: cardW, h: cardH });
      // filas a máquina
      const cps = sc.cps || 26;
      let chars = Math.max(0, (lt - 0.45) * cps);
      let y = y0 + pad + headH;
      rows.forEach((r, i) => {
        ctx.font = mono(400, kSize);
        ctx.fillStyle = "rgba(27,26,23,0.6)";
        ctx.fillText(String(r.k).toUpperCase(), x0 + pad, y);
        y += kSize * 1.3 + 8;
        ctx.fillStyle = r.hl ? (C.stamp || C.accent) : C.ink;
        ctx.font = mono(700, vSize);
        for (const ln of vLines[i]) {
          const n = Math.floor(clamp(chars, 0, ln.length));
          chars -= ln.length;
          if (n > 0) ctx.fillText(ln.slice(0, n), x0 + pad, y);
          if (n > 0 && n < ln.length && Math.floor(lt * 4) % 2 === 0) {
            ctx.fillRect(x0 + pad + ctx.measureText(ln.slice(0, n)).width + 4, y + 4, vSize * 0.5, vSize * 0.95);
          }
          y += vSize * 1.2;
        }
        chars -= 6; // pausa entre filas
        y += rowGap;
      });
      ctx.restore();
      // sello
      if (sc.stamp) {
        const totalChars = vLines.flat().reduce((a, l) => a + l.length, 0) + rows.length * 6;
        const sd = sc.stampAt ?? Math.min(d - 1.2, 0.45 + totalChars / cps + 0.3);
        const p = clamp((lt - sd) / 0.22);
        if (p > 0) {
          const k = 1.9 - 0.9 * easeOutCubic(p);
          ctx.save();
          ctx.globalAlpha *= clamp(p * 1.5) * 0.92;
          ctx.translate(x0 + cardW - pad - 150, y0 + cardH - pad - 60);
          ctx.rotate((-12 * Math.PI) / 180);
          ctx.scale(k, k);
          ctx.font = mono(700, 58);
          const tw = ctx.measureText(sc.stamp.toUpperCase()).width;
          ctx.strokeStyle = C.stamp || C.accent; ctx.lineWidth = 7;
          ctx.strokeRect(-tw / 2 - 26, -48, tw + 52, 96);
          ctx.fillStyle = C.stamp || C.accent;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(sc.stamp.toUpperCase(), 0, 4);
          ctx.restore();
        }
      }
    },

    // Viñeta con imagen: el texto va como subtítulo abajo (o arriba con pos: "top").
    // image · text · kicker? · note? · pos? · size?
    panel(sc, lt) {
      const top = sc.pos === "top";
      const main = layoutRich({ text: sc.text, maxWidth: CW, size: sc.size || 78, weight: 900, lh: 1.12 });
      const note = sc.note ? layoutRich({ text: sc.note, maxWidth: CW - 40, size: sc.noteSize || 50, weight: 600, lh: 1.25, hlMode: "color" }) : null;
      const pillH = sc.kicker ? 38 * 1.7 : 0;
      const g1 = sc.kicker ? 30 : 0, g2 = 30;
      const blockH = pillH + g1 + main.h + (note ? g2 + note.h : 0);
      // sombra para que el texto se lea sobre cualquier imagen
      const sh = ctx.createLinearGradient(0, top ? 0 : H, 0, top ? SAFE.top + blockH + 260 : SAFE.bottom - blockH - 300);
      sh.addColorStop(0, "rgba(0,0,0,0.92)"); sh.addColorStop(0.55, "rgba(0,0,0,0.65)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, W, H);
      let y = top ? SAFE.top + 30 : SAFE.bottom - 20 - blockH;
      if (sc.kicker) {
        const e = spring(lt, SPRINGS.snap);
        ctx.save();
        ctx.globalAlpha *= clamp(lt / 0.25);
        ctx.translate(-80 * (1 - e), 0);
        pill(sc.kicker.toUpperCase(), SAFE.left, y, { size: 38, label: "panel.kicker" });
        ctx.restore();
        y += pillH + g1;
      }
      drawRich({ layout: main, x: SAFE.left, y, align: "left", t: lt, delay: 0.15, label: "panel.text", maxWidth: CW });
      y += main.h + g2;
      if (note) drawRich({ layout: note, x: SAFE.left, y, align: "left", t: lt, delay: 0.35 + main.count * S.motion.wordStagger, stagger: 0.03, color: C.muted, label: "panel.note", maxWidth: CW - 40 });
    },

    // Teorías: aparecen una a una; las descartadas se tachan después.
    // items: [{text, ruled?}] · title · ruleAt (segundos)
    theories(sc, lt, d) {
      const title = sc.title ? layoutRich({ text: sc.title, maxWidth: CW, size: sc.size || 96, weight: 900, lh: 1.1 }) : null;
      const itemSize = sc.itemSize || 70;
      const items = (sc.items || []).map((it) => ({ it: typeof it === "string" ? { text: it } : it }))
        .map(({ it }) => ({ it, L: layoutRich({ text: it.text, maxWidth: CW - 70, size: itemSize, weight: 800, lh: 1.15, hlMode: "color" }) }));
      const gT = title ? 70 : 0, gI = 46;
      const itemsH = items.reduce((a, o) => a + o.L.h, 0) + gI * Math.max(0, items.length - 1);
      let y = CENTER_Y - ((title ? title.h : 0) + gT + itemsH) / 2;
      if (title) { drawRich({ layout: title, x: SAFE.left, y, align: "left", t: lt, label: "theories.title", maxWidth: CW }); y += title.h + gT; }
      const base = 0.3 + (title ? title.count * S.motion.wordStagger : 0);
      const step = sc.itemDelay || 0.55;
      const ruleAt = sc.ruleAt ?? base + items.length * step + 0.5;
      items.forEach(({ it, L }, i) => {
        const d0 = base + i * step;
        const ruled = it.ruled && lt > ruleAt;
        ctx.save();
        if (ruled) ctx.globalAlpha *= 1 - 0.55 * easeOutCubic(clamp((lt - ruleAt - 0.3) / 0.4));
        ctx.globalAlpha *= clamp((lt - d0) / 0.2);
        ctx.fillStyle = it.ruled === false || (!it.ruled && sc.keepColor) ? C.accent : C.muted;
        ctx.font = mono(700, itemSize * 0.8);
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("?", SAFE.left, y + L.lineH / 2);
        ctx.restore();
        ctx.save();
        if (ruled) ctx.globalAlpha *= 1 - 0.55 * easeOutCubic(clamp((lt - ruleAt - 0.3) / 0.4));
        drawRich({ layout: L, x: SAFE.left + 70, y, align: "left", t: lt, delay: d0, stagger: 0.03, label: `theories.item${i + 1}`, maxWidth: CW - 70 });
        ctx.restore();
        if (it.ruled) {
          const p = easeInOut(clamp((lt - ruleAt - i * 0.12) / 0.35));
          if (p > 0) {
            ctx.fillStyle = C.stamp || C.accent;
            L.lines.forEach((ln, li) => {
              ctx.fillRect(SAFE.left + 60, y + li * L.lineH + L.lineH * 0.5 - 4, (ln.width + 20) * p, 8);
            });
          }
        }
        y += L.h + gI;
      });
    },

    // Llamada a la acción con portada del ebook.
    cta(sc, lt) {
      if (sc.book === false) return SCENES.follow(sc, lt);
      const bookW = 380, bookH = 520;
      const text = layoutRich({ text: sc.text, maxWidth: CW, size: sc.size || 92, weight: 900, lh: 1.12 });
      const sub = sc.sub ? layoutRich({ text: sc.sub, maxWidth: CW, size: 50, weight: 600, lh: 1.25, hlMode: "color" }) : null;
      const btnH = 56 * 1.7;
      const g1 = 70, g2 = 46, g3 = 34;
      const blockH = bookH + g1 + text.h + (sc.button ? g2 + btnH : 0) + (sub ? g3 + sub.h : 0);
      let y = CENTER_Y - blockH / 2;
      // portada
      const be = spring(lt, SPRINGS.settle);
      const float = Math.sin(lt * 2.2) * 10;
      ctx.save();
      ctx.globalAlpha *= clamp(lt / 0.25);
      ctx.translate(W / 2, y + bookH / 2 + float);
      ctx.rotate((-6 * Math.PI) / 180);
      ctx.scale(0.7 + 0.3 * be, 0.7 + 0.3 * be);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, -bookW / 2 + 22, -bookH / 2 + 28, bookW, bookH, 18); ctx.fill();
      const g = ctx.createLinearGradient(-bookW / 2, -bookH / 2, bookW / 2, bookH / 2);
      g.addColorStop(0, C.accent2); g.addColorStop(1, C.accent);
      ctx.fillStyle = g;
      roundRect(ctx, -bookW / 2, -bookH / 2, bookW, bookH, 18); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(-bookW / 2, -bookH / 2, 22, bookH);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = font(800, 26); ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(String(S.ebook.tag || "EBOOK").toUpperCase(), -bookW / 2 + 52, -bookH / 2 + 46);
      const tl = layoutRich({ text: S.ebook.title, maxWidth: bookW - 90, size: 48, weight: 900, lh: 1.08, hlMode: "color" });
      const savedCollect = collect; collect = null;
      drawRich({ layout: tl, x: -bookW / 2 + 52, y: -bookH / 2 + 100, align: "left", color: "#FFFFFF" });
      collect = savedCollect;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = font(600, 26); ctx.textBaseline = "bottom";
      ctx.fillText(S.ebook.author || "", -bookW / 2 + 52, bookH / 2 - 40);
      ctx.restore();
      if (collect) collect.push({ scene: currentLabel, label: "cta.book", x: W / 2 - bookW * 0.62, y: y - 30, w: bookW * 1.24, h: bookH + 70 });
      y += bookH + g1;
      drawRich({ layout: text, x: W / 2, y, t: lt, delay: 0.35, label: "cta.text", maxWidth: CW });
      y += text.h;
      if (sc.button) {
        y += g2;
        const bd = 0.6 + text.count * S.motion.wordStagger;
        const e = spring(lt - bd, SPRINGS.bounce);
        const pulse = lt > bd + 0.5 ? 1 + 0.035 * Math.sin((lt - bd) * 6) : 1;
        ctx.save();
        ctx.globalAlpha *= clamp((lt - bd) / 0.2);
        ctx.translate(W / 2, y + btnH / 2);
        ctx.scale(e * pulse, e * pulse);
        ctx.translate(-W / 2, -(y + btnH / 2));
        pill(sc.button, W / 2, y, { size: 56, align: "center", weight: 900, label: "cta.button" });
        ctx.restore();
        y += btnH;
        if (sub) { y += g3; drawRich({ layout: sub, x: W / 2, y, t: lt, delay: bd + 0.4, stagger: 0.03, color: C.muted, label: "cta.sub", maxWidth: CW }); }
      } else if (sub) {
        y += g3; drawRich({ layout: sub, x: W / 2, y, t: lt, delay: 0.8, color: C.muted, label: "cta.sub", maxWidth: CW });
      }
    },
  };

  SCENES.follow = (sc, lt) => {
    const text = layoutRich({ text: sc.text, maxWidth: CW, size: sc.size || 104, weight: 900, lh: 1.1 });
    const sub = sc.sub ? layoutRich({ text: sc.sub, maxWidth: CW, size: 52, weight: 600, lh: 1.25, hlMode: "color" }) : null;
    const btnH = 56 * 1.7, g2 = 70, g3 = 40;
    let y = CENTER_Y - (text.h + (sc.button ? g2 + btnH : 0) + (sub ? g3 + sub.h : 0)) / 2;
    drawRich({ layout: text, x: W / 2, y, t: lt, delay: 0.1, stagger: 0.09, label: "cta.text", maxWidth: CW });
    y += text.h;
    const bd = 0.4 + text.count * 0.09;
    if (sc.button) {
      y += g2;
      const e = spring(lt - bd, SPRINGS.bounce);
      const pulse = lt > bd + 0.5 ? 1 + 0.03 * Math.sin((lt - bd) * 5) : 1;
      ctx.save();
      ctx.globalAlpha *= clamp((lt - bd) / 0.2);
      ctx.translate(W / 2, y + btnH / 2); ctx.scale(e * pulse, e * pulse); ctx.translate(-W / 2, -(y + btnH / 2));
      pill(sc.button, W / 2, y, { size: 56, align: "center", weight: 900, label: "cta.button" });
      ctx.restore();
      y += btnH;
    }
    if (sub) { y += g3; drawRich({ layout: sub, x: W / 2, y, t: lt, delay: bd + 0.4, stagger: 0.03, color: C.muted, label: "cta.sub", maxWidth: CW }); }
  };

  function wrapMono(text, maxWidth, size, weight) {
    ctx.font = mono(weight, size);
    const out = [];
    let line = "";
    for (const w of text.split(/\s+/)) {
      const tryL = line ? line + " " + w : w;
      if (line && ctx.measureText(tryL).width > maxWidth) { out.push(line); line = w; } else line = tryL;
    }
    if (line) out.push(line);
    return out;
  }

  // ---------- fondo y capa fija ----------
  function background(t) {
    if (MYSTERY) return mysteryBackground(t);
    if (ANIME) return animeBackground(t);
    if (EDITORIAL) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); return; }
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const blob = (x, y, r, col, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };
    blob(W * (0.2 + 0.12 * Math.sin(t * 0.45)), H * (0.25 + 0.05 * Math.cos(t * 0.3)), 760, C.accent2, 0.30);
    blob(W * (0.85 + 0.08 * Math.cos(t * 0.38)), H * (0.78 + 0.05 * Math.sin(t * 0.33)), 820, C.accent, 0.12);
  }

  // Niebla que se desplaza despacio + un haz de luz frío.
  function mysteryBackground(t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const blob = (x, y, r, col, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };
    for (let i = 0; i < 6; i++) {
      const sp = 0.025 + hash(i + 50) * 0.03;
      const x = ((hash(i + 10) + t * sp) % 1.4 - 0.2) * W;
      const y = H * (0.15 + 0.75 * hash(i + 20)) + Math.sin(t * 0.3 + i) * 40;
      blob(x, y, 520 + hash(i + 30) * 420, C.fog || "#8A94A6", 0.07 + 0.05 * hash(i + 40));
    }
    blob(W * 0.5, H * 0.42, 900, C.accent2, 0.10 + 0.02 * Math.sin(t * 0.7));
  }

  function mysteryFinish(t) {
    const f = Math.round(t * fps);
    // viñeta
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // parpadeo leve de proyector
    const fl = hash(f * 31 + 7);
    if (fl > 0.9) { ctx.fillStyle = `rgba(0,0,0,${0.06 + 0.08 * (fl - 0.9) * 10})`; ctx.fillRect(0, 0, W, H); }
    // grano
    if (grain) {
      ctx.save();
      ctx.globalAlpha = S.grain ?? 0.07;
      ctx.globalCompositeOperation = "overlay";
      const ox = Math.floor(hash(f * 2 + 1) * 512), oy = Math.floor(hash(f * 2 + 2) * 512);
      ctx.translate(-ox, -oy);
      ctx.fillStyle = ctx.createPattern(grain, "repeat");
      ctx.fillRect(ox, oy, W, H);
      ctx.restore();
    }
  }

  // ---- look anime ----
  // Negro, luna roja difusa y trama de puntos que respira despacio.
  function animeBackground(t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const mx = W * 0.72, my = H * 0.2 + Math.sin(t * 0.25) * 20;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 900);
    g.addColorStop(0, hexA(C.accent, 0.28)); g.addColorStop(0.35, hexA(C.accent, 0.10)); g.addColorStop(1, hexA(C.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (tone) {
      const k = 1.03 + 0.02 * Math.sin(t * 0.4);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(tone, 0, 0);
      ctx.restore();
    }
  }

  // Viñeta de tinta, grano y marco de viñeta de cómic.
  function animeFinish(t) {
    const f = Math.round(t * fps);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (grain) {
      ctx.save();
      ctx.globalAlpha = S.grain ?? 0.07;
      ctx.globalCompositeOperation = "overlay";
      const ox = Math.floor(hash(f * 2 + 1) * 512), oy = Math.floor(hash(f * 2 + 2) * 512);
      ctx.translate(-ox, -oy);
      ctx.fillStyle = ctx.createPattern(grain, "repeat");
      ctx.fillRect(ox, oy, W, H);
      ctx.restore();
    }
    ctx.strokeStyle = hexA(C.text, 0.85);
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, W - 60, H - 60);
  }

  // Líneas de impacto (集中線) que apuntan al centro; cambian cada 2 fotogramas.
  function speedLines(t, lt, alpha) {
    const seed = Math.floor(t * fps / 2);
    const cx = W / 2, cy = CENTER_Y;
    const a0 = clamp(lt / 0.25) * alpha;
    if (a0 <= 0) return;
    ctx.save();
    for (let i = 0; i < 110; i++) {
      const h1 = hash(seed * 131 + i * 7), h2 = hash(seed * 17 + i * 13 + 5);
      const ang = (i / 110) * Math.PI * 2 + h1 * 0.05;
      const r0 = 560 + h2 * 260, r1 = 1500;
      const wd = 3 + h1 * 14;
      const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa * wd, py = ca * wd;
      ctx.globalAlpha = a0 * (0.25 + 0.45 * h2);
      ctx.fillStyle = i % 9 === 0 ? C.accent : C.text;
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * r1 + px, cy + sa * r1 + py);
      ctx.lineTo(cx + ca * r1 - px, cy + sa * r1 - py);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Kanji vertical enorme detrás del texto (decorado, no se lee).
  function kanjiDecor(text, lt) {
    const chars = [...String(text)];
    const size = chars.length > 2 ? 300 : 380;
    const e = easeOutCubic(clamp(lt / 0.8));
    ctx.save();
    ctx.globalAlpha *= 0.2 * e;
    ctx.fillStyle = C.accent;
    ctx.font = kanjiFont(size);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const x = W - 60 - size / 2, y0 = 330 - (1 - e) * 80;
    chars.forEach((ch, i) => ctx.fillText(ch, x, y0 + i * size * 1.02));
    ctx.restore();
  }

  // Corte de viñeta: una franja roja y otra blanca cruzan en diagonal al cambiar de escena.
  function slashCut(lt) {
    const dur = 0.32;
    if (lt >= dur) return;
    const p = easeInOut(lt / dur);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.42);
    const D = Math.hypot(W, H) / 2 + 200;
    const x = -D + p * 2 * D;
    ctx.globalAlpha = 0.9 * (1 - p * 0.3);
    ctx.fillStyle = C.accent;
    ctx.fillRect(x - 160, -D, 200, 2 * D);
    ctx.fillStyle = C.text;
    ctx.fillRect(x + 60, -D, 26, 2 * D);
    ctx.restore();
  }

  function overlay(t) {
    if (MYSTERY) mysteryFinish(t);
    if (ANIME) animeFinish(t);
    if (S.overlay.progress) {
      const x = SAFE.left, y = SAFE.top - 110, w = CW, h = 8;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = C.accent;
      roundRect(ctx, x, y, Math.max(h, w * clamp(t / total)), h, 4); ctx.fill();
    }
    if (S.overlay.handle && S.brand.handle) {
      ctx.fillStyle = C.muted;
      ctx.font = font(600, 34);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(S.brand.handle, SAFE.left, SAFE.top - 74);
    }
  }

  // ---------- look editorial (ficha científica) ----------
  // Una ficha fija que no corta nunca: categoría y titular quietos todo el vídeo; por beat cambian
  // la barra de color (la frase), la etiqueta, el dibujo (viz) y la línea DATA con la fuente.
  const fmtNum = (v, dec = 0) => {
    const [i, f] = Math.abs(v).toFixed(dec).split(".");
    const int = i.length > 3 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : i;
    return (v < 0 ? "−" : "") + int + (f ? "," + f : "");
  };
  const barText = (s) => (s.type === "cta" ? s.text : s.bar) || "";
  const ED = (() => {
    if (!EDITORIAL) return null;
    const head = layoutRich({ text: timeline.headline || "", maxWidth: CW, size: timeline.headlineSize || 84, weight: 900, lh: 1.04, hlMode: "color", face: "serif" });
    const catY = SAFE.top, headY = catY + 56;
    const barY = headY + head.h + 24;
    const bar = { padX: 26, padY: 18, size: 40 };
    const barLayout = (s) => (barText(s) ? layoutRich({ text: barText(s), maxWidth: CW - bar.padX * 2, size: bar.size, weight: 700, lh: 1.24, hlMode: "color" }) : null);
    const barH = (L) => (L ? L.h + bar.padY * 2 : 0);
    const layouts = sched.map((e) => barLayout(e.s));
    const maxBar = Math.max(0, ...layouts.map(barH));
    const labelY = barY + maxBar + 28;
    const handleY = SAFE.bottom - 36;
    const dataY = handleY - 24 - 2 * 28 * 1.3;
    const vizTop = labelY + 34 + 26, vizBottom = dataY - 36;
    return { head, catY, headY, barY, bar, layouts, barH, labelY, dataY, handleY, area: { x: SAFE.left, y: vizTop, w: CW, h: vizBottom - vizTop } };
  })();

  const reg = (label, x, y, w, h) => { if (collect) collect.push({ scene: currentLabel, label, x, y, w, h }); };
  const monoText = (text, x, y, { size = 28, weight = 500, color = C.text, align = "left", label = "mono", spacing = 0 } = {}) => {
    ctx.font = mono(weight, size);
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = "0px";
    reg(label, align === "center" ? x - w / 2 : align === "right" ? x - w : x, y, w, size * 1.15);
    return w;
  };
  const tagPill = (text, x, y, { size = 28, bg = "#111111", fg = "#FFFFFF", align = "center", label = "tag" } = {}) => {
    ctx.font = mono(500, size);
    const w = ctx.measureText(text).width + size * 0.9, h = size * 1.55;
    const left = align === "center" ? x - w / 2 : x;
    ctx.fillStyle = bg; ctx.fillRect(left, y, w, h);
    ctx.fillStyle = fg; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, left + size * 0.45, y + h / 2 + 1);
    reg(label, left, y, w, h);
    return { w, h };
  };
  // Opacidad de una capa que cambia por beat: si el beat anterior/siguiente tiene lo mismo, no parpadea.
  const layerAlpha = (same, sameNext, lt, d, isLast, delay = 0) =>
    (same ? 1 : clamp((lt - delay) / 0.25)) * (sameNext || isLast ? 1 : 1 - clamp((lt - (d - 0.2)) / 0.2));

  const VIZ = {
    // Cifra grande que cuenta. value · from? · prefix? · suffix? · decimals? · caption? · sub?
    counter(v, lt, A, cont) {
      const dec = v.decimals || 0;
      const from = v.from ?? 0;
      const p = cont && v.from === undefined ? 1 : easeOutCubic(clamp((lt - 0.15) / (v.countDuration || 1.2)));
      const final = `${v.prefix || ""}${fmtNum(v.value, dec)}${v.suffix || ""}`;
      const shown = `${v.prefix || ""}${fmtNum(from + (v.value - from) * p, dec)}${v.suffix || ""}`;
      let size = v.size || 230;
      ctx.font = serif(900, size);
      while (ctx.measureText(final).width > A.w && size > 80) { size -= 10; ctx.font = serif(900, size); }
      const cap = v.caption ? 34 * 1.15 + 26 : 0;
      const sub = v.sub ? layoutRich({ text: v.sub, maxWidth: A.w - 80, size: 36, weight: 500, lh: 1.25, hlMode: "color" }) : null;
      const blockH = size * 0.82 + cap + (sub ? 22 + sub.h : 0);
      let y = A.y + (A.h - blockH) / 2;
      ctx.fillStyle = v.dim ? C.muted : C.accent;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(shown, W / 2, y + size * 0.78);
      const fw = ctx.measureText(final).width;
      reg("viz.counter", W / 2 - fw / 2, y, fw, size * 0.82);
      y += size * 0.82 + Math.max(26, size * 0.18); // deja sitio a comas y descendentes
      if (v.caption) { monoText(v.caption.toUpperCase(), W / 2, y, { size: 34, align: "center", label: "viz.caption", spacing: 2 }); y += 34 * 1.15; }
      if (sub) drawRich({ layout: sub, x: W / 2, y: y + 22, t: lt, delay: 0.5, stagger: 0.02, color: C.muted, label: "viz.sub", maxWidth: A.w - 80 });
    },

    // Barras verticales. items[{label, value, text?, sub?, hl?}] · max? · caption?
    bars(v, lt, A, cont) {
      const items = v.items || [];
      const max = v.max || Math.max(...items.map((it) => it.value));
      const top = A.y + (v.caption ? 60 : 0) + 74, base = A.y + A.h - 92;
      const colW = A.w / items.length, bw = Math.min(150, colW * 0.56);
      if (v.caption) monoText(v.caption.toUpperCase(), A.x, A.y, { size: 26, color: C.muted, label: "viz.caption", spacing: 1 });
      ctx.fillStyle = C.text; ctx.fillRect(A.x, base, A.w, 3);
      items.forEach((it, i) => {
        const cx = A.x + colW * (i + 0.5);
        const g = cont ? 1 : spring(lt - 0.2 - i * 0.22, SPRINGS.settle);
        const h = (base - top) * (it.value / max) * g;
        ctx.fillStyle = it.hl ? C.accent : C.soft || "#E6E4DC";
        ctx.fillRect(cx - bw / 2, base - h, bw, h);
        const a = cont ? 1 : clamp((lt - 0.45 - i * 0.22) / 0.25);
        ctx.save(); ctx.globalAlpha *= a;
        const txt = it.text ?? fmtNum(it.value);
        ctx.font = serif(900, 56);
        ctx.fillStyle = it.hl ? C.accent : C.text;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(txt, cx, base - (base - top) * (it.value / max) - 18);
        const tw = ctx.measureText(txt).width;
        reg(`viz.bar${i + 1}.value`, cx - tw / 2, base - (base - top) * (it.value / max) - 66, tw, 52);
        monoText(String(it.label), cx, base + 16, { size: 28, align: "center", label: `viz.bar${i + 1}.label` });
        if (it.sub) monoText(String(it.sub), cx, base + 52, { size: 22, color: C.muted, align: "center", label: `viz.bar${i + 1}.sub` });
        ctx.restore();
      });
    },

    // Curva que se dibuja. points[[x,y]] · x[min,max] · y[min,max] · xTicks[] · xLabel? · yLabel?
    // band{from,to,label}? · note? (aviso tipo "curva dibujada para ilustrar")
    curve(v, lt, A, cont) {
      const [x0, x1] = v.x, [y0, y1] = v.y;
      const P = { l: A.x + 10, r: A.x + A.w - 10, t: A.y + 56, b: A.y + A.h - 70 };
      const X = (x) => P.l + ((x - x0) / (x1 - x0)) * (P.r - P.l);
      const Y = (y) => P.b - ((y - y0) / (y1 - y0)) * (P.b - P.t);
      if (v.yLabel) monoText(v.yLabel.toUpperCase(), A.x, A.y, { size: 26, color: C.muted, label: "viz.ylabel", spacing: 1 });
      ctx.fillStyle = C.text; ctx.fillRect(P.l, P.b, P.r - P.l, 3);
      (v.xTicks || []).forEach((x, i) => {
        ctx.fillRect(Math.min(P.r - 3, Math.max(P.l, X(x) - 1.5)), P.b, 3, 12);
        monoText(fmtNum(x), X(x), P.b + 20, { size: 24, align: i === 0 ? "left" : i === v.xTicks.length - 1 ? "right" : "center", label: `viz.tick${i + 1}` });
      });
      // banda (zona donde se estanca)
      if (v.band) {
        const ba = clamp((lt - (cont ? 0.15 : v.bandAt ?? 1.4)) / 0.35);
        if (ba > 0) {
          ctx.save(); ctx.globalAlpha *= ba;
          ctx.fillStyle = hexA(C.accent, 0.12);
          ctx.fillRect(X(v.band.from), P.t, X(v.band.to) - X(v.band.from), P.b - P.t);
          ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
          for (const bx of [v.band.from, v.band.to]) { ctx.beginPath(); ctx.moveTo(X(bx), P.t); ctx.lineTo(X(bx), P.b); ctx.stroke(); }
          ctx.setLineDash([]);
          if (v.band.label) tagPill(v.band.label.toUpperCase(), (X(v.band.from) + X(v.band.to)) / 2, P.t + 8, { size: 24, bg: C.accent, label: "viz.band" });
          ctx.restore();
        }
      }
      // curva
      const pts = v.points || [];
      const p = cont ? 1 : easeInOut(clamp((lt - 0.2) / (v.drawDuration || 1.4)));
      const xEnd = x0 + (x1 - x0) * p;
      ctx.beginPath();
      let last = null;
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i];
        if (px <= xEnd) { i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)); last = [px, py]; continue; }
        if (i > 0) { const [qx, qy] = pts[i - 1]; const k = (xEnd - qx) / (px - qx); last = [xEnd, qy + (py - qy) * k]; ctx.lineTo(X(last[0]), Y(last[1])); }
        break;
      }
      ctx.strokeStyle = C.accent; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
      if (last) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 11, 0, Math.PI * 2); ctx.fill(); }
      if (v.xLabel) monoText(v.xLabel.toUpperCase(), P.r, P.b - 40, { size: 24, color: C.muted, align: "right", label: "viz.xlabel", spacing: 1 });
    },

    // Columnas enfrentadas. items[{label, value, caption?, dim?}]
    compare(v, lt, A, cont) {
      const items = v.items || [];
      const colW = A.w / items.length;
      // un solo tamaño para todas las columnas (el de la que menos cabe), para que se lean como pareja
      let size = v.size || 150;
      ctx.font = serif(900, size);
      while (items.some((it) => ctx.measureText(it.value).width > colW - 30) && size > 60) { size -= 6; ctx.font = serif(900, size); }
      items.forEach((it, i) => {
        const cx = A.x + colW * (i + 0.5);
        const a = cont ? 1 : clamp((lt - 0.15 - i * 0.35) / 0.3);
        const e = cont ? 1 : spring(lt - 0.15 - i * 0.35, SPRINGS.land);
        ctx.save(); ctx.globalAlpha *= a;
        const cy = A.y + A.h * 0.5;
        tagPill(String(it.label).toUpperCase(), cx, cy - 170, { size: 28, label: `viz.col${i + 1}.label` });
        ctx.font = serif(900, size);
        ctx.fillStyle = it.dim ? C.muted : C.accent;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(it.value, cx, cy + size * 0.35 + (1 - e) * 30);
        const vw = ctx.measureText(it.value).width;
        reg(`viz.col${i + 1}.value`, cx - vw / 2, cy - size * 0.45, vw, size * 0.82);
        if (it.caption) wrapMono(it.caption.toUpperCase(), colW - 40, 24, 500).forEach((ln, k) =>
          monoText(ln, cx, cy + size * 0.35 + 30 + k * 30, { size: 24, color: C.muted, align: "center", label: `viz.col${i + 1}.cap${k}` }));
        ctx.restore();
      });
    },

    // Cierre: botón grande. button · sub?
    follow(v, lt, A) {
      if (!v.button) return;
      const e = spring(lt - 0.35, SPRINGS.bounce);
      const size = 68;
      ctx.font = font(800, size);
      const w = ctx.measureText(v.button).width + 100, h = size * 1.9;
      const cy = A.y + A.h * 0.42;
      ctx.save();
      ctx.globalAlpha *= clamp((lt - 0.35) / 0.2);
      ctx.translate(W / 2, cy); ctx.scale(e, e);
      ctx.fillStyle = C.accent; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = C.onAccent; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(v.button, 0, 3);
      ctx.restore();
      reg("viz.button", W / 2 - w / 2, cy - h / 2, w, h);
      if (v.sub) drawRich({ text: v.sub, x: W / 2, y: cy + h / 2 + 40, maxWidth: A.w - 80, size: 38, weight: 500, lh: 1.25, hlMode: "color", t: lt, delay: 0.8, stagger: 0.03, color: C.muted, label: "viz.sub" });
    },
  };

  function editorialRender(t) {
    const e = sceneAt(t);
    const s = e.s, lt = t - e.start, d = s.duration;
    const prev = sched[e.i - 1]?.s, next = sched[e.i + 1]?.s;
    const isLast = e.i === sched.length - 1;
    currentLabel = `#${e.i + 1} ${s.type}`;
    const intro = e.i === 0 ? ED.head.count * 0.05 + 0.45 : 0; // el titular entra primero
    // categoría y titular: fijos
    if (timeline.category) monoText(timeline.category.toUpperCase(), SAFE.left, ED.catY, { size: 28, color: C.muted, label: "categoria", spacing: 3 });
    drawRich({ layout: ED.head, x: SAFE.left, y: ED.headY, align: "left", t, delay: 0.05, stagger: 0.05, color: C.text, label: "titular", maxWidth: CW });
    // barra: cambia de alto con un muelle y la frase se funde
    const L = ED.layouts[e.i], Lp = ED.layouts[e.i - 1];
    const hNow = ED.barH(L), hPrev = e.i === 0 ? 0 : ED.barH(Lp);
    const bh = hPrev + (hNow - hPrev) * spring(lt - intro, SPRINGS.snap);
    if (bh > 1) { ctx.fillStyle = C.accent; ctx.fillRect(SAFE.left, ED.barY, CW, bh); }
    if (L) {
      const same = prev && barText(prev) === barText(s), sameNext = next && barText(next) === barText(s);
      ctx.save();
      ctx.globalAlpha *= layerAlpha(same, sameNext, lt, d, isLast, intro + 0.08);
      drawRich({ layout: L, x: SAFE.left + ED.bar.padX, y: ED.barY + ED.bar.padY, align: "left", t: same ? Infinity : lt, delay: intro + 0.08, stagger: 0.012, color: C.onAccent, hlColor: C.barHl || C.onAccent, label: "barra", maxWidth: CW - ED.bar.padX * 2 });
      ctx.restore();
    }
    // etiqueta del beat
    if (s.label) {
      ctx.save();
      ctx.globalAlpha *= layerAlpha(prev?.label === s.label, next?.label === s.label, lt, d, isLast, intro + 0.2);
      monoText(s.label, SAFE.left, ED.labelY, { size: 30, color: C.text, label: "etiqueta" });
      ctx.restore();
    }
    // dibujo
    const v = s.type === "cta" ? { kind: "follow", button: s.button, sub: s.sub } : s.viz;
    if (v && VIZ[v.kind]) {
      const cont = !!(v.id && prev?.viz?.id === v.id);
      const contNext = !!(v.id && next?.viz?.id === v.id);
      ctx.save();
      ctx.globalAlpha *= layerAlpha(cont, contNext, lt, d, isLast, intro);
      VIZ[v.kind](v, lt - intro, ED.area, cont);
      ctx.restore();
    }
    // línea DATA
    if (s.data) {
      ctx.save();
      ctx.globalAlpha *= layerAlpha(prev?.data === s.data, next?.data === s.data, lt, d, isLast, intro);
      const w = monoText("DATA", SAFE.left, ED.dataY + 4, { size: 26, weight: 700, label: "data.k" });
      drawRich({ text: s.data, x: SAFE.left + w + 18, y: ED.dataY, align: "left", maxWidth: CW - w - 18, size: 28, weight: 500, lh: 1.3, hlMode: "color", color: C.muted, label: "data" });
      ctx.restore();
    }
    if (S.brand.handle) {
      ctx.font = font(600, 30); ctx.fillStyle = C.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(S.brand.handle, SAFE.left, ED.handleY);
      reg("handle", SAFE.left, ED.handleY, ctx.measureText(S.brand.handle).width, 34);
    }
  }

  function sceneAt(t) {
    for (const e of sched) if (t < e.end) return e;
    return sched[sched.length - 1];
  }

  function renderAt(t) {
    t = clamp(t, 0, Math.max(0, total - 1e-6));
    ctx.setTransform(DS.k, 0, 0, DS.k, 0, 0);
    ctx.globalAlpha = 1;
    background(t);
    if (EDITORIAL) { editorialRender(t); overlay(t); return; }
    const e = sceneAt(t);
    const lt = t - e.start, d = e.s.duration;
    const isLast = e.i === sched.length - 1;
    const isFirst = e.i === 0;
    const inP = isFirst ? 1 : easeOutCubic(clamp(lt / S.motion.sceneIn));
    const inMove = isFirst ? 1 : spring(lt, SPRINGS.settle); // la escena entra con un muelle que se asienta
    const outP = isLast ? 0 : easeInCubic(clamp((lt - (d - S.motion.sceneOut)) / S.motion.sceneOut));
    const fn = SCENES[e.s.type];
    currentLabel = `#${e.i + 1} ${e.s.type}`;
    if (e.s.image) {
      // la imagen anterior queda debajo mientras entra la nueva (fundido de 0.35 s)
      const prev = sched[e.i - 1];
      const fade = clamp(lt / 0.35);
      if (prev && prev.s.image && fade < 1) drawImageBg(prev.s, prev.i, prev.s.duration, prev.s.duration);
      ctx.save();
      ctx.globalAlpha = prev && prev.s.image ? easeOutCubic(fade) : 1;
      drawImageBg(e.s, e.i, lt, d);
      // oscurecer para que el texto central se lea (panel pone su propia sombra)
      const dim = e.s.dim ?? (e.s.type === "panel" ? 0.1 : 0.5);
      if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }
    if (ANIME && e.s.impact) speedLines(t, lt, Math.min(inP, 1 - outP));
    ctx.save();
    ctx.globalAlpha = Math.min(inP, 1 - outP);
    ctx.translate(0, 50 * (1 - inMove) - 70 * outP);
    if (ANIME && e.s.kanji) kanjiDecor(e.s.kanji, lt);
    if (fn) fn(e.s, lt, d);
    else drawRich({ text: `Escena desconocida: ${e.s.type}`, x: W / 2, y: CENTER_Y, maxWidth: CW, size: 60, color: C.bad });
    ctx.restore();
    if (ANIME && !isFirst) slashCut(lt);
    overlay(t);
  }

  // Sensor: renderiza cada escena ya revelada y devuelve las cajas de texto.
  function layoutReport() {
    const out = [];
    for (const e of sched) {
      collect = [];
      const t = e.start + Math.max(0.05, e.s.duration - S.motion.sceneOut - 0.02);
      renderAt(t);
      out.push({ scene: e.i + 1, type: e.s.type, boxes: collect });
      collect = null;
    }
    return { safe: SAFE, width: W, height: H, scenes: out };
  }

  return {
    W, H, fps, total, totalFrames, sched, SAFE,
    renderAt,
    renderFrame: (f) => renderAt(f / fps),
    layoutReport,
  };
}

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const SCENE_TYPES = ["hook", "statement", "list", "number", "compare", "casefile", "theories", "panel", "ficha", "cta"];
