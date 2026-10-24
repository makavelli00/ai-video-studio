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
