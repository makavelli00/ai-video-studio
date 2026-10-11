// AI Video Studio — motor de render
// Principio: cada fotograma es una función pura del tiempo -> renderAt(t).
// Nada de timers, Math.random ni recursos externos: el mismo t siempre da el mismo fotograma.

export const DEFAULT_STYLE = {
  brand: { handle: "@tu_usuario" },
  ebook: { title: "Tu ebook", author: "Tu nombre", tag: "EBOOK" },
  look: "clean", // "clean" (explicativo) | "mystery" (niebla, viñeta, grano)
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

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
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
export function createStudio(canvas, timeline, styleIn) {
  const W = timeline.width || 1080;
  const H = timeline.height || 1920;
  const fps = timeline.fps || 30;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const S = mergeStyle(styleIn);
  const C = S.colors;
  const FAMILY = S.fonts.family || "Inter";
  const font = (weight, size) => `${weight} ${size}px ${FAMILY}, Inter, Arial, sans-serif`;
  const mono = (weight, size) => `${weight} ${size}px "${S.fonts.mono || "Liberation Mono"}", "Courier New", monospace`;
  const MYSTERY = S.look === "mystery";

  // Grano de película: textura generada una vez con semilla fija.
  let grain = null;
  if (MYSTERY && typeof document !== "undefined") {
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
  function layoutRich({ text, maxWidth, size, weight = 800, lh = 1.12, hlMode = "marker" }) {
    ctx.font = font(weight, size);
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
    return { lines: out, space, padX, lineH, h: out.length * lineH, w: widest, size, weight, hlMode, count: words.length };
  }

  // Dibuja texto con revelado palabra a palabra. y = borde superior del bloque.
  function drawRich(opts) {
    const {
      x, y, align = "center", color = C.text,
      t = Infinity, delay = 0, stagger = S.motion.wordStagger, label = "texto",
    } = opts;
    const L = opts.layout || layoutRich(opts);
    const marker = L.hlMode === "marker";
    ctx.font = font(L.weight, L.size);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let idx = 0;
    L.lines.forEach((ln, li) => {
      const mid = y + li * L.lineH + L.lineH / 2;
      const x0 = align === "center" ? x - ln.width / 2 : align === "right" ? x - ln.width : x;
      ln.words.forEach((wd) => {
        const wt = clamp((t - delay - idx * stagger) / 0.4);
        idx++;
        if (wt <= 0) return;
        const e = easeOutCubic(wt);
        const dy = (1 - e) * L.size * 0.35;
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
            ctx.fillStyle = s.hl ? C.accent : color;
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
        const e = easeOutBack(clamp(lt / 0.5));
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
        const e = easeOutBack(clamp((lt - d0) / 0.45));
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
      const pop = easeOutBack(clamp(lt / 0.5));
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
      const be = easeOutBack(clamp(lt / 0.6));
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
        const e = easeOutBack(clamp((lt - bd) / 0.45));
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
      const e = easeOutBack(clamp((lt - bd) / 0.45));
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

  function overlay(t) {
    if (MYSTERY) mysteryFinish(t);
    if (S.overlay.progress) {
      const x = SAFE.left, y = 200, w = CW, h = 8;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = C.accent;
      roundRect(ctx, x, y, Math.max(h, w * clamp(t / total)), h, 4); ctx.fill();
    }
    if (S.overlay.handle && S.brand.handle) {
      ctx.fillStyle = C.muted;
      ctx.font = font(600, 34);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(S.brand.handle, SAFE.left, 236);
    }
  }

  function sceneAt(t) {
    for (const e of sched) if (t < e.end) return e;
    return sched[sched.length - 1];
  }

  function renderAt(t) {
    t = clamp(t, 0, Math.max(0, total - 1e-6));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    background(t);
    const e = sceneAt(t);
    const lt = t - e.start, d = e.s.duration;
    const isLast = e.i === sched.length - 1;
    const isFirst = e.i === 0;
    const inP = isFirst ? 1 : easeOutCubic(clamp(lt / S.motion.sceneIn));
    const outP = isLast ? 0 : easeInCubic(clamp((lt - (d - S.motion.sceneOut)) / S.motion.sceneOut));
    const fn = SCENES[e.s.type];
    currentLabel = `#${e.i + 1} ${e.s.type}`;
    ctx.save();
    ctx.globalAlpha = Math.min(inP, 1 - outP);
    ctx.translate(0, 50 * (1 - inP) - 70 * outP);
    if (fn) fn(e.s, lt, d);
    else drawRich({ text: `Escena desconocida: ${e.s.type}`, x: W / 2, y: CENTER_Y, maxWidth: CW, size: 60, color: C.bad });
    ctx.restore();
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

export const SCENE_TYPES = ["hook", "statement", "list", "number", "compare", "casefile", "theories", "cta"];
