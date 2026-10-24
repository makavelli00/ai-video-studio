// Prensa vs. extensiones — Cuerpo con Datos
// Datos: Kinoshita et al., Med Sci Sports Exerc 2026 (doi 10.1249/MSS.0000000000003957)
export default function (api) {
  const { THREE, mat, geo, neonPlane, contactShadow, prog, kf, ease, lerp, clamp, at, fit, project } = api;
  const shots = [];
  const D = Math.PI / 180;
  const GOLD = '#e9b44c', CYAN = '#6ff5df', GREY = '#8d8d92', WHITE = '#ffffff';
  const SRC = 'Kinoshita et al. · Med Sci Sports Exerc 2026';

  // ---------- materials ----------
  const BASE = new THREE.Color('#a8483c');
  // muscle fibres: fine streaks along the muscle (v = length), shared as colour map and bump map
  const fibre = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), r = api.rng(11);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 420; i++) {
      const x0 = r() * 512, amp = 2 + r() * 5, ph = r() * 6;
      g.strokeStyle = `rgba(${40 + r() * 40},0,0,${.06 + r() * .2})`; g.lineWidth = .6 + r() * 2.2; g.beginPath();
      for (let y = -8; y <= 520; y += 16) g.lineTo(x0 + Math.sin(y * .012 + ph) * amp, y);
      g.stroke();
    }
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(255,235,225,${.15 + r() * .25})`; g.lineWidth = .8; const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y + 20 + r() * 50); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.anisotropy = 8;
    return t;
  })();
  const boneMat = () => new THREE.MeshStandardMaterial({ color: '#cdbfa5', roughness: .7, metalness: .02 });
  const tendonMat = () => new THREE.MeshPhysicalMaterial({ color: '#efe6d6', roughness: .28, metalness: .05, clearcoat: .6, clearcoatRoughness: .25 });
  const muscleMat = () => new THREE.MeshPhysicalMaterial({ color: BASE.clone(), map: fibre, bumpMap: fibre, bumpScale: 1.6, roughness: .42, metalness: 0, clearcoat: .35, clearcoatRoughness: .4, sheen: .5, sheenColor: new THREE.Color('#ffb4a2'), sheenRoughness: .5, emissive: new THREE.Color(0) });

  // fusiform muscle belly along a curve: thin tendinous ends, thick belly peaking at `peak`, elliptical section (sx in-plane, sz out of plane)
  const Z = new THREE.Vector3(0, 0, 1);
  function spindle(pts, rMax, { rMin = .006, peak = .5, sharp = 1, sx = 1, sz = 1, segs = 40, rad = 22 } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts), pos = [], uv = [], idx = [];
    const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; curve.getPointAt(u, P); curve.getTangentAt(u, T);
      N.crossVectors(T, Z); if (N.lengthSq() < 1e-8) N.set(1, 0, 0); N.normalize(); B.crossVectors(T, N).normalize();
      const w = u < peak ? u / peak * .5 : .5 + (u - peak) / (1 - peak) * .5;
      const r = rMin + (rMax - rMin) * Math.pow(Math.sin(Math.PI * w), sharp);
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * Math.PI * 2, c = -Math.cos(a) * r * sx, s = Math.sin(a) * r * sz;
        pos.push(P.x + c * N.x + s * B.x, P.y + c * N.y + s * B.y, P.z + c * N.z + s * B.z); uv.push(j / rad, u);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // static muscle: geometry centred on itself so scaling grows it in place
  function muscle(pts, rMax, o = {}, m = muscleMat()) {
    const g = spindle(pts.map(p => new THREE.Vector3(...p)), rMax, o), c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z); g.computeBoundingBox(); const mesh = new THREE.Mesh(g, m); mesh.position.copy(c); return mesh;
  }
  function tint(m, color, k, glow = .45) {
    const c = new THREE.Color(color);
    m.material.color.copy(BASE).lerp(c, k);
    m.material.emissive.copy(c).multiplyScalar(k * glow);
  }
  function dim(m, k) { m.material.color.copy(BASE).lerp(new THREE.Color('#3a3536'), k); m.material.emissive.setRGB(0, 0, 0); }

  // ---------- leg (side view in XY plane, +x = front) ----------
  function makeLeg() {
    const root = new THREE.Group();
    const sphere = (r, [x, y, z], [sx, sy, sz] = [1, 1, 1], m = boneMat()) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };
    const bone = (r0, r1, len, [x, y, z], m = boneMat()) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 28), m); o.position.set(x, y, z); return o; };
    // pelvis: iliac wing + ischium, bone coloured
    const pelvis = sphere(.085, [-.07, .13, -.03], [1.3, .9, .28]); pelvis.rotation.z = .35; root.add(pelvis);
    root.add(sphere(.035, [-.07, .03, -.03], [1, 1.3, .8]));
    const hip = sphere(.048, [0, 0, 0]); root.add(hip);
    const glute = muscle([[-.19, .15, .0], [-.16, .05, .04], [-.11, -.05, .06], [-.04, -.1, .065]], .11, { peak: .45, sx: 1.25, sz: .85, sharp: .8 }); root.add(glute);

    const thigh = new THREE.Group(); root.add(thigh);
    thigh.add(bone(.022, .027, .44, [0, -.23, 0]), sphere(.034, [-.025, -.04, .045], [1, 1.2, 1]));
    // vasti: lateral is the big one, medial is the teardrop above the knee, intermedius under the rectus
    const vl = muscle([[-.005, -.05, .045], [.045, -.17, .07], [.065, -.3, .065], [.07, -.43, .035]], .076, { peak: .42, sx: 1.05, sz: .85 });
    const vm = muscle([[0, -.18, -.04], [.04, -.3, -.065], [.065, -.4, -.06], [.075, -.45, -.03]], .064, { peak: .7, sharp: .8 });
    const vi = muscle([[.025, -.07, 0], [.05, -.24, 0], [.06, -.42, 0]], .056, { peak: .5 });
    const add = muscle([[-.03, .0, -.08], [-.02, -.12, -.085], [-.0, -.26, -.07], [.01, -.36, -.05]], .075, { peak: .3, sx: 1.25, sz: .9, sharp: .8 });
    // hamstrings + lower leg share one material ("the rest"), so the scene tints/dims them through `calf`
    const cm = muscleMat();
    const ham = muscle([[-.07, -.03, .02], [-.085, -.2, .03], [-.075, -.34, .03], [-.05, -.45, .035]], .064, { peak: .45 }, cm);
    const ham2 = muscle([[-.07, -.03, -.03], [-.08, -.22, -.04], [-.06, -.38, -.045], [-.035, -.46, -.04]], .058, { peak: .5 }, cm);
    [vl, vm, vi, add, ham, ham2].forEach(m => thigh.add(m));
    // knee: femoral condyles + patella
    const kneeJ = sphere(.045, [-.005, -.46, 0], [1.15, .85, 1.35]); thigh.add(kneeJ);
    const patella = sphere(.03, [.068, -.45, 0], [.55, 1, .9]); thigh.add(patella);

    const shin = new THREE.Group(); shin.position.y = -.46; thigh.add(shin);
    shin.add(bone(.045, .03, .05, [0, -.03, 0]), bone(.026, .02, .4, [.005, -.23, 0]), bone(.009, .009, .38, [-.025, -.23, .03]));
    shin.add(sphere(.022, [.008, -.43, -.02]), sphere(.018, [-.02, -.425, .03]));
    const calf = muscle([[-.03, .0, .03], [-.075, -.1, .035], [-.07, -.2, .025], [-.04, -.31, .01]], .058, { peak: .35 }, cm);
    const gastM = muscle([[-.03, .0, -.03], [-.078, -.11, -.035], [-.07, -.22, -.025], [-.04, -.31, -.008]], .062, { peak: .35 }, cm);
    const sol = muscle([[-.02, -.1, 0], [-.05, -.22, 0], [-.04, -.34, 0], [-.035, -.4, 0]], .05, { peak: .45, sz: 1.3 }, cm);
    const tib = muscle([[.03, -.03, .03], [.042, -.18, .03], [.035, -.33, .02], [.04, -.43, .0]], .032, { peak: .3 }, cm);
    [calf, gastM, sol, tib].forEach(m => shin.add(m));
    shin.add(muscle([[-.035, -.3, 0], [-.04, -.38, 0], [-.045, -.44, 0]], .014, { rMin: .01, sx: .6 }, tendonMat()));
    // foot: heel bone + tapered forefoot
    const foot = new THREE.Group(); foot.position.set(0, -.44, 0); shin.add(foot);
    foot.add(sphere(.035, [-.035, -.005, 0], [1.2, 1, 1]));
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(.018, .04, .19, 28), boneMat()); fore.rotation.z = -Math.PI / 2 + .12; fore.scale.set(1, 1, 1.5); fore.position.set(.07, -.01, 0); foot.add(fore);

    // rectus femoris: pelvis -> over the knee -> tibia, and the patellar tendon. Rebuilt every frame from the pose.
    const rf = new THREE.Mesh(new THREE.BufferGeometry(), muscleMat()); root.add(rf);
    const pt = new THREE.Mesh(new THREE.BufferGeometry(), tendonMat()); root.add(pt);
    const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
    const toRoot = (obj, p) => root.worldToLocal(obj.localToWorld(p.clone()));
    const anchors = () => {
      root.updateMatrixWorld(true);
      return [v(.06, .13), toRoot(thigh, v(.1, -.05)), toRoot(thigh, v(.1, -.24)), toRoot(thigh, v(.088, -.42)), toRoot(shin, v(.05, -.07))];
    };
    let restLen = null;
    function pose(hipDeg, kneeDeg) {
      thigh.rotation.z = hipDeg * D; shin.rotation.z = kneeDeg * D;
      const pts = anchors(); const curve = new THREE.CatmullRomCurve3(pts);
      rf.geometry.dispose(); rf.geometry = spindle(pts, .05, { peak: .4, rMin: .01, sharp: .9, sz: 1.1, segs: 48 });
      pt.geometry.dispose(); pt.geometry = spindle([toRoot(thigh, v(.08, -.46)), toRoot(shin, v(.055, -.04)), toRoot(shin, v(.04, -.08))], .016, { rMin: .012, sz: 1.4, segs: 12 });
      const len = curve.getLength(); if (restLen == null) restLen = len; return { len, pts };
    }
    pose(0, 0);
    root.userData = { pose, thigh, shin, rf, vastii: [vl, vm, vi], add, glute, pelvis, hip, kneeJ, calf };
    return root;
  }
  const rfAll = L => L.userData.rf;

  // ---------- machines ----------
  function makePress() {
    const g = new THREE.Group(), dark = mat.metal('#3d4048'), steel = mat.metal('#b9bdc4');
    const base = new THREE.Mesh(geo.rbox(1.25, .07, .55, .03), dark); base.position.set(.2, 0, 0); g.add(base);
    const seat = new THREE.Mesh(geo.rbox(.5, .07, .46, .03), mat.plastic('#22252b', .7)); seat.position.set(-.18, .22, 0); seat.rotation.z = 28 * D; g.add(seat);
    const back = new THREE.Mesh(geo.rbox(.6, .07, .46, .03), mat.plastic('#22252b', .7)); back.position.set(-.52, .45, 0); back.rotation.z = 55 * D; g.add(back);
    const post = new THREE.Mesh(geo.rbox(.08, .22, .3, .02), dark); post.position.set(-.25, .1, 0); g.add(post);
    const a = new THREE.Vector3(.05, .05, 0), b = new THREE.Vector3(.85, .8, 0), dir = b.clone().sub(a), L = dir.length();
    for (const z of [-.2, .2]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, L, 16), steel);
      rail.position.copy(a.clone().add(b).multiplyScalar(.5)).setZ(z); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); g.add(rail);
    }
    const sled = new THREE.Group(); g.add(sled);
    const plate = new THREE.Mesh(geo.rbox(.06, .5, .52, .02), steel); plate.rotation.z = Math.atan2(dir.y, dir.x); sled.add(plate);
    for (const z of [-.3, .3]) { const disc = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .05, 40), mat.gold()); disc.rotation.x = Math.PI / 2; disc.position.set(.12, .1, z); sled.add(disc); }
    const sh = contactShadow(1.8, 1, .6); sh.position.y = -.035; g.add(sh);
    g.userData.set = k => { const p = a.clone().lerp(b, lerp(.42, .72, k)); sled.position.copy(p); };
    g.userData.set(0);
    return g;
  }
  function makeExt() {
    const g = new THREE.Group(), dark = mat.metal('#3d4048'), steel = mat.metal('#b9bdc4');
    const base = new THREE.Mesh(geo.rbox(.8, .07, .55, .03), dark); g.add(base);
    const col = new THREE.Mesh(geo.rbox(.1, .42, .3, .02), dark); col.position.set(-.05, .22, 0); g.add(col);
    const seat = new THREE.Mesh(geo.rbox(.5, .08, .46, .03), mat.plastic('#22252b', .7)); seat.position.set(-.05, .46, 0); g.add(seat);
    const back = new THREE.Mesh(geo.rbox(.08, .6, .46, .03), mat.plastic('#22252b', .7)); back.position.set(-.3, .78, 0); back.rotation.z = -8 * D; g.add(back);
    const arm = new THREE.Group(); arm.position.set(.24, .46, .26); g.add(arm);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .42, 16), steel); bar.position.y = -.21; arm.add(bar);
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .5, 32), mat.gold()); roller.rotation.x = Math.PI / 2; roller.position.set(.02, -.4, -.26); arm.add(roller);
    const stack = new THREE.Mesh(geo.rbox(.16, .5, .26, .02), steel); stack.position.set(-.32, .3, -.0); stack.visible = false; g.add(stack);
    const sh = contactShadow(1.3, 1, .6); sh.position.y = -.035; g.add(sh);
    g.userData.set = k => { arm.rotation.z = lerp(0, 75 * D, k); };
    g.userData.set(0);
    return g;
  }

  // ---------- 2D helpers ----------
  const src = (ov, a = 1) => ov.text(SRC, 540, 1800, { size: 26, weight: 400, color: GREY, alpha: a });
  function stat(ov, value, sub, x, y, { color = GOLD, a = 1, size = 104 } = {}) {
    ov.label(value, x, y, { color, size, weight: 800, alpha: a, glowBlur: color === GREY ? 0 : 22 });
    ov.text(sub, x, y + size * .78, { size: 30, weight: 600, color: GREY, alpha: a });
  }
  const tag = (ov, s, x, y, a = 1, color = WHITE) => ov.text(s, x, y, { size: 34, weight: 700, color, alpha: a });
  // pulse with press / extension cycles (pure in t)
  const cyc = (t, period = 1.6) => .5 - .5 * Math.cos(t / period * Math.PI * 2);
  const pressPose = (L, k) => L.userData.pose(lerp(118, 58, k), lerp(-118, -12, k));
  const extPose = (L, k) => L.userData.pose(90, lerp(-90, -4, k));

  // ===== 1 · HOOK: two machines =====
  {
    const group = new THREE.Group(), press = makePress(), ext = makeExt();
    press.position.set(-.85, 0, 0); ext.position.set(.95, 0, 0); group.add(press, ext);
    shots.push({ start: 0, in: 'cut', group, update(lt, { t, ov }) {
      fit(group, { dir: [.12, .32, 1], fill: lerp(.95, 1.0, prog(lt, 0, 2.8)), screenY: .58 });
      press.userData.set(cyc(lt, 1.4)); ext.userData.set(cyc(lt + .7, 1.4));
      const [px, py] = project([-.65, -.15, .3]), [ex, ey] = project([.95, -.15, .3]);
      tag(ov, 'PRENSA', px, py + 40, prog(lt, .1, .4)); tag(ov, 'EXTENSIONES', ex, ey + 40, prog(t, at('extensiones') - .1, at('extensiones') + .2));
      const [rx, ry] = project([.95, .55, 0]);
      ov.ring(rx, ry, 250, { progress: prog(t, at('extensiones'), at('extensiones') + .5, ease.out), alpha: 1 - prog(lt, 2.4, 2.7) });
    } });
  }

  // ===== 2 · RESONANCIA: scan plane slides down the thigh =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    const scan = neonPlane(.5, .5, CYAN); scan.rotation.x = -Math.PI / 2; group.add(scan);
    shots.push({ start: at('Lo'), group, update(lt, { ov }) {
      L.userData.pose(0, 0);
      fit(L, { dir: [.55, .2, 1], fill: .62, screenY: .6 });
      const k = prog(lt, .2, 1.6, ease.inOut);
      scan.position.set(0, lerp(.12, -.5, k), 0); scan.userData.set(Math.sin(Math.PI * clamp(k * 1.05)) * .9 + .1);
      for (const m of [...L.userData.vastii, rfAll(L)]) tint(m, CYAN, clamp(1 - Math.abs(scan.position.y - (m.position?.y ?? -.2)) * 4) * .9);
      tag(ov, 'RESONANCIA MAGNÉTICA', 540, 1610, prog(lt, .2, .5), CYAN);
    } });
  }

  // ===== 3 · DISEÑO: 17 · 12 semanas · una pierna en cada máquina =====
  {
    const group = new THREE.Group(), A = makeLeg(), B = makeLeg();
    A.position.set(-.55, 0, 0); B.position.set(.55, 0, 0); group.add(A, B);
    const frame0 = new THREE.Group(); group.add(frame0);
    shots.push({ start: at('17'), group, update(lt, { t, ov }) {
      pressPose(A, cyc(lt, 1.5)); extPose(B, cyc(lt + .4, 1.5));
      fit(group, { dir: [0, .1, 1], fill: lerp(.9, 1.05, prog(t, at('una') - .2, at('una') + .5)), screenY: .64, offset: [0, .05, 0] });
      const a1 = prog(lt, 0, .3, ease.out), a2 = prog(t, at('12') - .1, at('12') + .2, ease.out);
      ov.label('17', 330, 640, { color: WHITE, size: 150, weight: 800, alpha: a1, glowBlur: 0 }); ov.text('PRINCIPIANTES', 330, 735, { size: 30, color: GREY, alpha: a1 });
      ov.label('12', 750, 640, { color: WHITE, size: 150, weight: 800, alpha: a2, glowBlur: 0 }); ov.text('SEMANAS', 750, 735, { size: 30, color: GREY, alpha: a2 });
      const a3 = prog(t, at('maquina') - .3, at('maquina'));
      const [ax, ay] = project([-.55, -.75, 0]), [bx, by] = project([.55, -.75, 0]);
      tag(ov, 'PIERNA A · PRENSA', ax, Math.min(1690, ay + 60), a3, GOLD); tag(ov, 'PIERNA B · EXTENSIONES', bx, Math.min(1690, by + 60), a3, CYAN);
      ov.text('5 × 10 al 70 % · 2 días por semana', 540, 1750, { size: 28, weight: 500, color: GREY, alpha: a3 });
      src(ov, a1);
    } });
  }

  // ===== 4 · CUÁDRICEPS: casi empate =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('cuadriceps', 2) - .35, group, update(lt, { t, ov }) {
      L.userData.pose(90, -90);
      fit(L, { dir: [.35, .25, 1], fill: .7, screenY: .62 });
      const k = prog(lt, .1, .6);
      for (const m of [...L.userData.vastii, rfAll(L)]) tint(m, GOLD, k);
      const s = 1 + .08 * prog(lt, .3, 1.2, ease.out); L.userData.vastii.forEach(m => m.scale.set(s, 1, s));
      const ae = prog(t, at('empate') - .25, at('empate') + .1, ease.out);
      stat(ov, '+4,9 %', 'PRENSA', 300, 1500, { a: ae, size: 96 }); stat(ov, '+7,1 %', 'EXTENSIONES', 780, 1500, { a: ae, size: 96 });
      ov.text('CUÁDRICEPS ENTERO', 540, 1680, { size: 28, color: GREY, alpha: ae });
      src(ov);
    } });
  }

  // ===== 5 · RECTO FEMORAL: solo con extensiones =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('Pero'), group, update(lt, { t, ov }) {
      extPose(L, cyc(lt, 1.4));
      fit(L, { dir: [.3, .2, 1], fill: .72, screenY: .6, offset: [.05, -.1, 0] });
      const kr = prog(t, at('recto') - .3, at('recto'));
      L.userData.vastii.forEach(m => dim(m, kr)); dim(L.userData.add, kr); dim(L.userData.glute, kr); dim(L.userData.calf, kr);
      tint(rfAll(L), CYAN, kr, .7);
      const ar = prog(t, at('recto'), at('recto') + .3, ease.out);
      stat(ov, '+13,2 %', 'CON EXTENSIONES', 300, 1520, { color: CYAN, a: ar, size: 100 });
      stat(ov, '+1,1 %', 'CON PRENSA · NO SIGNIF.', 780, 1520, { color: GREY, a: ar, size: 100 });
      src(ov);
    } });
  }

  // ===== 6 · DOS ARTICULACIONES: cadera y rodilla =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('Es'), group, update(lt, { t, ov }) {
      L.userData.pose(70, -40);
      fit(L, { dir: [.2, .15, 1], fill: lerp(.66, .72, prog(lt, 0, 3)), screenY: .6 });
      L.userData.vastii.forEach(m => dim(m, 1)); dim(L.userData.add, 1); dim(L.userData.glute, 1); dim(L.userData.calf, 1);
      tint(rfAll(L), CYAN, 1, .7);
      const [hx, hy] = project(L.userData.hip), [kx, ky] = project(L.userData.kneeJ);
      ov.ring(hx, hy, 95, { progress: prog(t, at('cadera') - .1, at('cadera') + .35, ease.out) });
      ov.ring(kx, ky, 95, { progress: prog(t, at('rodilla') - .1, at('rodilla') + .35, ease.out) });
      tag(ov, 'CADERA', hx - 120, hy - 125, prog(t, at('cadera'), at('cadera') + .2), GOLD);
      tag(ov, 'RODILLA', kx + 180, ky, prog(t, at('rodilla'), at('rodilla') + .2), GOLD);
      const a = prog(lt, .1, .4); ov.label('2', 540, 1560, { color: CYAN, size: 150, weight: 800, alpha: a }); ov.text('ARTICULACIONES', 540, 1660, { size: 30, color: GREY, alpha: a });
    } });
  }

  // ===== 7 · PRENSA: cadera y rodilla a la vez → el recto apenas cambia de largo =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('en', 3), group, update(lt, { t, ov }) {
      const k = cyc(lt, 1.8); const { pts } = pressPose(L, k);
      const kz = prog(t, at('apenas') - .2, at('apenas') + .4);
      fit(L, { dir: [lerp(.2, .05, kz), .15, 1], fill: lerp(.62, .74, kz), screenY: .58, offset: [.15, 0, 0] });
      L.userData.vastii.forEach(m => tint(m, GOLD, .6)); dim(L.userData.calf, .6);
      tint(rfAll(L), GREY, .8, 0);
      const [hx, hy] = project(L.userData.hip), [kx, ky] = project(L.userData.kneeJ);
      const ar = prog(lt, .2, .5);
      ov.arrow(hx - 40, hy + 140, hx + 60, hy + 40, { alpha: ar * .9 * (1 - kz) }); ov.arrow(kx + 40, ky + 140, kx + 120, ky + 20, { alpha: ar * .9 * (1 - kz) });
      const p0 = project(pts[0]), p4 = project(pts[4]), nx = -(p4[1] - p0[1]), ny = p4[0] - p0[0], nl = Math.hypot(nx, ny) || 1, o = 70;
      const q0 = [p0[0] + nx / nl * o, p0[1] + ny / nl * o], q4 = [p4[0] + nx / nl * o, p4[1] + ny / nl * o];
      ov.line([p0, q0, q4, p4], { color: GOLD, width: 5, progress: kz, alpha: kz });
      const al = prog(t, at('largo') - .5, at('largo'));
      ov.label('≈', 540, 1540, { color: WHITE, size: 140, weight: 700, alpha: al, glowBlur: 0 });
      ov.text('MISMO LARGO DEL RECTO FEMORAL', 540, 1650, { size: 30, color: GREY, alpha: al });
      ov.text('Explicación de los autores, no medida directa', 540, 1760, { size: 26, weight: 400, color: GREY, alpha: al * .9 });
    } });
  }

  // ===== 8 · GLÚTEO Y ADUCTOR: solo con prensa =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('cambio') - .25, group, update(lt, { t, ov }) {
      pressPose(L, cyc(lt, 1.6));
      fit(L, { dir: [-.45, .2, 1], fill: .64, screenY: .6, offset: [.1, 0, 0] });
      L.userData.vastii.forEach(m => dim(m, .5)); dim(rfAll(L), .5); dim(L.userData.calf, .5);
      const kg = prog(t, at('gluteo') - .2, at('gluteo') + .2), ka = prog(t, at('aductor') - .2, at('aductor') + .2);
      tint(L.userData.glute, GOLD, kg); L.userData.glute.scale.setScalar(1 + .12 * kg);
      tint(L.userData.add, GOLD, ka); L.userData.add.scale.set(1 + .1 * ka, 1, 1 + .1 * ka);
      stat(ov, '+15,4 %', 'GLÚTEO', 300, 1520, { a: kg, size: 100 }); stat(ov, '+6,2 %', 'ADUCTOR', 780, 1520, { a: ka, size: 100 });
      ov.text('Con extensiones: ≈ 0', 540, 1690, { size: 30, color: GREY, alpha: ka });
      src(ov);
    } });
  }

  // ===== 9 · PIERNA ENTERA: gana la prensa =====
  {
    const group = new THREE.Group(), A = makeLeg(), B = makeLeg();
    A.position.set(-.5, 0, 0); B.position.set(.5, 0, 0); group.add(A, B);
    shots.push({ start: at('Sumando'), group, update(lt, { t, ov }) {
      A.userData.pose(0, 0); B.userData.pose(0, 0);
      fit(group, { dir: [0, .12, 1], fill: .7, screenY: .55 });
      const ka = prog(lt, .3, 1.1), kb = prog(lt, .5, 1.1);
      const allA = [...A.userData.vastii, A.userData.add, A.userData.glute, A.userData.calf, rfAll(A)];
      const allB = [...B.userData.vastii, B.userData.add, B.userData.glute, B.userData.calf, rfAll(B)];
      allA.forEach(m => tint(m, GOLD, ka)); allB.forEach(m => dim(m, kb * .6));
      const ap = prog(t, at('prensa', 4) - .4, at('prensa', 4), ease.out);
      const [ax] = project([-.5, 0, 0]), [bx] = project([.5, 0, 0]);
      stat(ov, '+6,3 %', 'PRENSA', ax, 1560, { a: prog(lt, .3, .6), size: 104 });
      stat(ov, '+2,8 %', 'EXTENSIONES', bx, 1560, { color: GREY, a: prog(lt, .5, .8), size: 104 });
      ov.text('MÚSCULO TOTAL DE LA PIERNA', 540, 1720, { size: 28, color: GREY, alpha: prog(lt, .3, .6) });
      const [rx, ry] = project([-.5, -.25, 0]); ov.ring(rx, ry, 230, { progress: ap });
      src(ov);
    } });
  }

  // ===== 10 · OJO: principiantes =====
  {
    const group = new THREE.Group(), L = makeLeg(); group.add(L);
    shots.push({ start: at('Ojo'), group, update(lt, { t, ov }) {
      L.userData.pose(0, 0);
      fit(L, { dir: [.6, .25, 1], fill: .56, screenY: .58 });
      [...L.userData.vastii, L.userData.add, L.userData.glute, L.userData.calf, rfAll(L)].forEach(m => dim(m, .3));
      const a = prog(t, at('principiantes') - .3, at('principiantes'));
      ov.label('17 principiantes', 540, 1500, { color: WHITE, size: 72, weight: 800, alpha: a, glowBlur: 0 });
      ov.text('En gente entrenada puede salir distinto', 540, 1600, { size: 32, weight: 500, color: GREY, alpha: a });
      src(ov);
    } });
  }

  // ===== 11 · CIERRE: haz las dos (callback a las máquinas) =====
  {
    const group = new THREE.Group(), press = makePress(), ext = makeExt();
    press.position.set(-.85, 0, 0); ext.position.set(.95, 0, 0); group.add(press, ext);
    shots.push({ start: at('Asi'), group, update(lt, { t, ov }) {
      fit(group, { dir: [-.12, .32, 1], fill: .9, screenY: .6 });
      press.userData.set(cyc(lt, 1.4)); ext.userData.set(cyc(lt, 1.4));
      const k = prog(t, at('dos', 2) - .2, at('dos', 2) + .3, ease.out);
      const [px, py] = project([-.55, .35, 0]), [ex, ey] = project([.95, .55, 0]);
      ov.ring(px, py, 240, { color: CYAN, progress: k }); ov.ring(ex, ey, 240, { color: CYAN, progress: k });
      const [lx, ly] = project([-.65, -.15, .3]), [rx, ry] = project([.95, -.15, .3]);
      tag(ov, 'PRENSA', lx, ly + 40, 1, GOLD); tag(ov, 'EXTENSIONES', rx, ry + 40, 1, CYAN);
      ov.text('Toda la pierna  +  recto femoral', 540, 1640, { size: 36, weight: 700, color: WHITE, alpha: k });
    } });
  }

  return { shots };
}
