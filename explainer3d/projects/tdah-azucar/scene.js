// TDAH con datos · ¿El azúcar pone hiperactivo? — un solo universo 3D, cámara por tramos.
// Fuentes: Hoover y Milich (1994), J Abnorm Child Psychol (35 niños, todos con placebo; a unas madres les dijeron "mucho azúcar")
// y Wolraich, Wilson y White (1995), JAMA 274:1617 (metaanálisis de 23 estudios). El gráfico de puntos es ilustrativo.
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export default async function (api) {
  const { THREE, mat, geo, contactShadow, prog, ease, lerp, clamp, at, project, rng, camera } = api;
  const GOLD = '#e9b44c', CYAN = '#6ff5df', RED = '#ff5a5a', WHITE = '#f5f5f7', GREY = '#9a9aa0';
  const font = await new Promise((ok, ko) => new FontLoader().load('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json', ok, undefined, ko));

  // ---------- utilidades ----------
  const pop = (t, t0, k = 1) => { const x = (t - t0) * k; return x <= 0 ? 0 : 1 - Math.exp(-7 * x) * Math.cos(12 * x); };
  const out = (t, t1, d = .3) => 1 - prog(t, t1, t1 + d, ease.in);
  const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
  const setS = (o, s) => { o.visible = s > .002; o.scale.setScalar(Math.max(.002, s)); };
  const smooth = (x) => x * x * (3 - 2 * x);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function text3d(str, size, m) {
    const g = new TextGeometry(str, { font, size, depth: size * .28, curveSegments: 8, bevelEnabled: true, bevelThickness: size * .04, bevelSize: size * .025, bevelSegments: 3 });
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
    const o = new THREE.Group(); o.add(new THREE.Mesh(g, m)); return o;
  }
  const glowM = (c, k = .5) => new THREE.MeshStandardMaterial({ color: c, metalness: .3, roughness: .3, emissive: c, emissiveIntensity: k });

  const world = new THREE.Group();

  // ---------- 1 · plataforma y 35 figuras ----------
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, .16, 96), mat.plastic('#17181c', .55));
  stage.position.y = -.08; world.add(stage);
  const rimLine = new THREE.Mesh(new THREE.TorusGeometry(2.62, .015, 8, 160), mat.neon(GOLD)); rimLine.rotation.x = Math.PI / 2; rimLine.position.y = .005; world.add(rimLine);
  const stageSh = contactShadow(7, 7, .5); stageSh.position.y = -.17; world.add(stageSh);
  const figM = mat.plastic('#cfd3da', .45), figA = new THREE.MeshStandardMaterial({ color: '#cfd3da', roughness: .45, emissive: GOLD, emissiveIntensity: 0 });
  function figure(m, s = 1) {
    const f = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(.11 * s, .26 * s, 6, 16), m); b.position.y = .24 * s; f.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(.1 * s, 20, 12), m); h.position.y = .55 * s; f.add(h);
    return f;
  }
  const figs = [];
  for (let i = 0; i < 35; i++) {
    const r = i % 7, c = Math.floor(i / 7), A = i % 2 === 0;    // A = a su madre le dijeron "mucho azúcar"
    const f = figure(A ? figA : figM);
    const home = [(r - 3) * .55, 0, (c - 2) * .55];
    const nA = figs.filter(x => x.userData.A).length, nB = figs.length - nA, k = A ? nA : nB;
    const split = [(A ? -1 : 1) * (1.05 + (k % 3) * .38), 0, (Math.floor(k / 3) - 2.5) * .36];
    f.userData = { A, home, split };
    figs.push(f); world.add(f);
  }
  const qMark = text3d('?', 1.3, glowM(GOLD, .6)); world.add(qMark);

  // ---------- 2–3 · vaso con terrones y su desintegración ----------
  const glass = new THREE.Group();
  {
    const prof = [[0.001, 0], [.42, 0], [.46, .05], [.55, 1.15], [.52, 1.15], [.43, .07], [0.001, .07]].map(([r, y]) => new THREE.Vector2(r, y));
    glass.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .28, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide })));
  }
  world.add(glass);
  const sugarM = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: .85, emissive: '#ffffff', emissiveIntensity: .08 });
  const cubes = [], R = rng(5);
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(geo.rbox(.22, .22, .22, .03), sugarM);
    c.userData = { o: [(R() - .5) * .7, .35 + i * .13 + R() * .1, (R() - .5) * .5], spin: R() * 6, ph: R() * 6 };
    cubes.push(c); glass.add(c);
  }
  // partículas en las que se deshacen los terrones (puntos, posición = f(t))
  const NP = 14 * 40, pPos = new Float32Array(NP * 3);
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: '#ffffff', size: .05, transparent: true, depthWrite: false });
  const parts = new THREE.Points(pGeo, pMat); glass.add(parts);
  const placebo = text3d('PLACEBO', .3, glowM(CYAN, .7)); world.add(placebo);

  // ---------- 4 · indicador holográfico: percepción de las madres ----------
  const holo = new THREE.Group();
  const barFrame = (x) => { const f = new THREE.Mesh(geo.rbox(.55, 2.0, .3, .04), mat.glass(CYAN, .12)); f.position.set(x, 1.0, 0); holo.add(f); return f; };
  barFrame(-.5); barFrame(.5);
  const fillA = new THREE.Mesh(geo.rbox(.45, 1, .22, .03), new THREE.MeshBasicMaterial({ color: GOLD, toneMapped: false }));
  const fillB = new THREE.Mesh(geo.rbox(.45, 1, .22, .03), new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }));
  holo.add(fillA, fillB);
  const baseLine = new THREE.Mesh(geo.rbox(1.8, .03, .4, .01), mat.neon(CYAN)); holo.add(baseLine);
  world.add(holo);
  const cGold = new THREE.Color(GOLD), cRed = new THREE.Color(RED);

  // ---------- 5 · terrón gigante, cerebro y conexión que se rompe ----------
  const bigCube = new THREE.Mesh(geo.rbox(1, 1, 1, .1), sugarM); world.add(bigCube);
  const brain = new THREE.Group();
  {
    const bm = new THREE.MeshStandardMaterial({ color: '#e7a3b4', roughness: .55, emissive: '#e7a3b4', emissiveIntensity: .08 });
    for (const s of [1, -1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(.55, 48, 32), bm); h.scale.set(.62, .78, 1); h.position.x = s * .3; brain.add(h);
      for (let k = 0; k < 5; k++) {
        const g = new THREE.Mesh(new THREE.TorusGeometry(.5 - k * .02, .025, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color: '#c97f92', roughness: .6 }));
        g.rotation.set(0, Math.PI / 2, (k - 2) * .35); g.scale.set(.62, .78, 1); g.position.x = s * (.3 + .32 * 0) ; g.position.x = s * .3; brain.add(g);
      }
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .45, 24), bm); stem.position.set(0, -.55, -.1); brain.add(stem);
  }
  world.add(brain);
  const linkPts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; linkPts.push(new THREE.Vector3(lerp(-.85, .85, u), Math.sin(u * Math.PI) * .45, 0)); }
  const link = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linkPts), 120, .035, 10), mat.neon(GOLD)); world.add(link);
  const linkIdx = link.geometry.index.count;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(.09, 24, 12), mat.neon(RED)); world.add(spark);

  // ---------- 6 · 23 estudios → gráfico de puntos centrado en 0 ----------
  const docs = [], NS = 23, Rd = rng(23);
  const docM = mat.plastic('#eceef2', .5), docStripe = mat.neon(GOLD);
  for (let i = 0; i < NS; i++) {
    const d = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .02), docM); d.add(face);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, .08, .022), docStripe); st.position.y = .4; d.add(st);
    const th = Rd() * Math.PI * 2;
    // efecto ilustrativo: repartido alrededor de 0 (no son los valores de cada estudio)
    const eff = (hash(i + 3) - .5) * 1.2, ci = .25 + hash(i + 40) * .35;
    d.userData = { from: [Math.cos(th) * 5, Math.sin(th) * 3.5 + 1.5, 3 + Rd() * 3], spin: (Rd() - .5) * 6, eff, ci, face, st };
    docs.push(d); world.add(d);
  }
  const zeroLine = new THREE.Mesh(new THREE.BoxGeometry(.03, 1, .03), mat.neon(CYAN)); world.add(zeroLine);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.14), mat.neon(CYAN)); world.add(diamond);
  const ciBars = docs.map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(1, .02, .02), mat.plastic('#8d93a0', .5)); world.add(b); return b; });

  // ---------- 7 · niño y lupa ----------
  const child = figure(figM, 2.6); world.add(child);
  const lens = new THREE.Group();
  {
    lens.add(new THREE.Mesh(new THREE.TorusGeometry(.62, .06, 16, 80), mat.metal('#c9cdd3')));
    const g = new THREE.Mesh(new THREE.CircleGeometry(.6, 64), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .22, roughness: .02, depthWrite: false })); lens.add(g);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .8, 24), mat.plastic('#1e232c', .4)); handle.position.set(.62, -.62, 0); handle.rotation.z = Math.PI / 4; lens.add(handle);
  }
  world.add(lens);

  // ---------- 8 · el terrón se vuelve interrogación + compartir ----------
  const q2 = text3d('?', 1.15, glowM(GOLD, .6)); world.add(q2);
  const share = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .1, 64), mat.neon(CYAN)); disc.rotation.x = Math.PI / 2; share.add(disc);
    const ink = new THREE.MeshBasicMaterial({ color: '#0d0d0e' });
    const stem = new THREE.Mesh(geo.rbox(.3, .08, .02, .03), ink); stem.position.set(-.05, -.04, .06); stem.rotation.z = .5; share.add(stem);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.12, .2, 3), ink); head.position.set(.12, .07, .06); head.rotation.z = -Math.PI / 2 + .5; share.add(head);
  }
  world.add(share);
  const NB = 120, bPos = new Float32Array(NB * 3), bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const burst = new THREE.Points(bGeo, new THREE.PointsMaterial({ color: CYAN, size: .06, transparent: true, depthWrite: false })); world.add(burst);

  // ---------- tiempos (atados a la voz) ----------
  const T = {
    s2: at('A') - .15, s3: at('Pero') - .15, s4: at('Y') - .15, s5: at('¿Entonces') - .15,
    s6: at('análisis') - .35, s7: at('A', 2) - .15, s8: at('¿Tú') - .15,
  };
  const END = api.timeline.duration;

  // Cámara por tramos: [inicio, posición, objetivo]; entre tramos, deslizamiento de .7 s.
  const CAM = [
    [0, [0, 4.6, 15], [0, 1.1, 0]],
    [T.s2, [-1.0, 4.8, 13.5], [-.7, 1.75, 0]],
    [T.s3, [-.8, 4.2, 12.5], [-1.0, 2.35, 0]],
    [T.s4, [0, 2.8, 13.5], [0, 1.55, 0]],
    [T.s5, [0, 2.6, 13], [0, 1.65, 0]],
    [T.s6, [0, 2.6, 14], [0, 1.75, 0]],
    [T.s7, [0, 2.2, 12.5], [0, 1.45, 0]],
    [T.s8, [0, 2.4, 12.5], [0, 1.6, 0]],
  ];
  function cameraAt(t) {
    let i = 0; while (i + 1 < CAM.length && CAM[i + 1][0] <= t) i++;
    let [t0, p, g] = CAM[i];
    if (i > 0) { const k = smooth(clamp((t - t0) / .7)); p = mix(CAM[i - 1][1], p, k); g = mix(CAM[i - 1][2], g, k); }
    const drift = (t - t0) * .08;
    if (i === 0) p = [p[0], lerp(7, p[1], prog(t, 0, 1.2, ease.out)), lerp(21, p[2], prog(t, 0, 1.2, ease.out)) - drift];  // acercamiento rápido
    else p = [p[0], p[1], p[2] - drift];
    camera.position.set(...p); camera.fov = 30; camera.updateProjectionMatrix(); camera.lookAt(...g); camera.updateMatrixWorld();
  }

  // Titulares (separados de los subtítulos: y≈560–760) y fuente abajo.
  function headline(ov, l1, l2, a, c1 = WHITE, c2 = GOLD, s1 = 76, s2 = 56) {
    if (a <= 0) return;
    if (l1) ov.text(l1, 540, 580, { size: s1, weight: 800, color: c1, alpha: a });
    if (l2) ov.text(l2, 540, 580 + s1 * .6 + s2 * .75, { size: s2, weight: 800, color: c2, alpha: a });
  }
  const source = (ov, s, a) => {   // con una banda oscura detrás para que se lea sobre la plataforma
    if (a <= 0) return; const c = ov.ctx; c.save(); c.globalAlpha = a * .7; c.fillStyle = '#0d0d0e';
    c.font = "500 30px 'Inter Display'"; const w = c.measureText(s).width + 44; c.beginPath(); c.roundRect(540 - w / 2, 1586, w, 48, 24); c.fill(); c.restore();
    ov.text(s, 540, 1610, { size: 30, weight: 500, color: GREY, alpha: a });
  };

  const shot = { start: 0, in: 'cut', out: 'cut', group: world, update(lt, { t, ov }) {
    cameraAt(t);

    // --- 1–4 · plataforma y figuras
    const stIn = pop(t, 0, 1.6), stOut = out(t, T.s4, .35);
    setS(stage, stIn * stOut); setS(rimLine, stIn * stOut); stageSh.visible = stage.visible;
    const spl = smooth(prog(t, T.s2 + .1, T.s2 + .9));
    figs.forEach((f, i) => {
      const u = f.userData, s = pop(t, .15 + i * .018, 1.6) * stOut;
      const p = mix(u.home, u.split, spl);
      f.position.set(p[0], p[1] + Math.max(0, Math.sin(t * 6 + i)) * .03 * spl, p[2]); f.rotation.y = Math.sin(t * .7 + i) * .3;
      setS(f, s);
    });
    figA.emissiveIntensity = .55 * prog(t, at('muchísimo') - .2, at('azúcar') + .2) * (1 - .6 * prog(t, at('placebo') - .2, at('placebo') + .2));
    const qa = pop(t, at('trampa') - .25, 1.3) * out(t, T.s2, .25);
    qMark.position.set(0, 1.25, 0); qMark.rotation.y = Math.sin(t * 1.5) * .35; setS(qMark, qa);

    // --- 2–3 · vaso con terrones sobre el grupo A; se congela, gira 180° y se deshace
    const gIn = pop(t, T.s2 + .5, 1.3), gOut = out(t, T.s4 + .2, .3);
    glass.position.set(-1.35, 1.75, 0);
    const turn = smooth(prog(t, at('secreto') - .1, at('secreto') + .6));
    glass.rotation.set(0, turn * Math.PI, 0); setS(glass, .9 * gIn * gOut);
    const freeze = clamp(1 - turn * 3);   // los terrones flotan hasta que el vaso se congela
    const dis = prog(t, at('todos') - .1, at('placebo') + .2, ease.out);
    cubes.forEach((c, i) => {
      const u = c.userData, bob = Math.sin(t * 2 + u.ph) * .06 * freeze;
      c.position.set(u.o[0], u.o[1] + bob + (1 - gIn) * .5, u.o[2]);
      c.rotation.set(u.spin + t * .6 * freeze, u.spin * .7 + t * .4 * freeze, 0);
      c.scale.setScalar(Math.max(.001, 1 - dis)); c.visible = dis < .99;
    });
    for (let i = 0; i < NP; i++) {
      const c = cubes[i % 14].userData, a = hash(i) * Math.PI * 2, b = hash(i + 999) * Math.PI - Math.PI / 2, r = dis * (.4 + hash(i + 77) * 1.4);
      pPos[i * 3] = c.o[0] + Math.cos(a) * Math.cos(b) * r; pPos[i * 3 + 1] = c.o[1] + Math.sin(b) * r + dis * .5; pPos[i * 3 + 2] = c.o[2] + Math.sin(a) * Math.cos(b) * r;
    }
    pGeo.attributes.position.needsUpdate = true; parts.visible = dis > 0 && dis < 1; pMat.opacity = 1 - dis;
    const plIn = pop(t, at('placebo') - .1, 1.2) * out(t, T.s4 + .2, .3);
    placebo.position.set(-1.0, 3.3, .2); placebo.rotation.y = Math.sin(t * 1.2) * .15; setS(placebo, plIn);

    // --- 4 · indicador holográfico: barra A sube y se pone roja; barra B baja
    const hIn = pop(t, T.s4 + .3, 1.3) * out(t, T.s5, .3);
    holo.position.set(0, .2, .6); setS(holo, hIn);
    const ra = prog(t, at('calificaron') - .1, at('hiperactivos') + .3, ease.out), hA = .25 + 1.55 * ra, hB = .25 + .75 * ra;
    fillA.scale.y = hA; fillA.position.set(-.5, hA / 2 + .05, 0); fillA.material.color.copy(cGold).lerp(cRed, prog(t, at('hiperactivos') - .2, at('hiperactivos') + .3));
    fillB.scale.y = hB; fillB.position.set(.5, hB / 2 + .05, 0);

    // --- 5 · terrón gigante + cerebro; la conexión no llega
    const s5 = pop(t, T.s5 + .2, 1.2) * out(t, T.s6, .3);
    bigCube.position.set(-1.05, 2.0, 0); bigCube.rotation.set(.4 + t * .2, .6 + t * .3, 0); setS(bigCube, .85 * s5);
    brain.position.set(1.05, 2.05, 0); brain.rotation.set(0, -.5 + Math.sin(t * .8) * .2, 0); setS(brain, s5);
    const grow = prog(t, at('provoca') - .1, at('subidón') + .1, ease.out), brk = prog(t, at('subidón') + .15, at('subidón') + .45);
    link.position.set(0, 2.1, 0); link.visible = s5 > .05 && grow > 0;
    link.geometry.setDrawRange(0, Math.floor(linkIdx * Math.min(.86, grow) * (1 - brk) / 6) * 6);
    spark.position.set(lerp(-.85, .85, .86), 2.1 + Math.sin(.86 * Math.PI) * .45, 0); setS(spark, Math.max(0, Math.sin(brk * Math.PI)) * 1.4 * s5);

    // --- 6 · 23 estudios: llegan, se apilan y se ordenan en un gráfico de puntos centrado en 0
    const g6 = out(t, T.s7, .35), landEnd = at('23') + .4, span = landEnd - (T.s6 + .2) - .45;
    const toPlot = smooth(prog(t, at('encontró') - .1, at('significativo') + .2));
    let landed = 0;
    docs.forEach((d, i) => {
      const u = d.userData, st = T.s6 + .2 + span * (i / (NS - 1)), f = prog(t, st, st + .45, ease.out); if (f >= 1) landed++;
      const pile = [0, .8 + i * .045, 0], row = [u.eff * .9, .55 + i * .075, 0];
      let p = mix(u.from, pile, f); p = mix(p, row, toPlot);
      d.position.set(...p);
      d.rotation.set(lerp(-Math.PI / 2 * f, 0, toPlot) + (1 - f) * u.spin, (1 - f) * u.spin, 0);
      const w = lerp(1.1, .09, toPlot), h = lerp(.8, .09, toPlot);
      d.scale.set(w, h, lerp(1, 4, toPlot)); u.st.visible = toPlot < .5;
      d.visible = t >= st && g6 > .01; if (d.visible) d.scale.multiplyScalar(g6);
      const cb = ciBars[i]; cb.visible = toPlot > .5 && g6 > .01; cb.scale.set(Math.max(.001, u.ci * 2 * (toPlot - .5) * 2 * g6), 1, 1); cb.position.set(u.eff * .9, row[1], -.02);
      if (toPlot > .4) u.face.material = docM;
    });
    zeroLine.visible = toPlot > .02 && g6 > .01; zeroLine.scale.y = Math.max(.001, 2.0 * toPlot * g6); zeroLine.position.set(0, .45 + 1.0 * toPlot * g6, -.05);
    const dm = prog(t, at('promedio') - .2, at('promedio') + .2, ease.out) * g6;
    diamond.position.set(0, .3, 0); diamond.rotation.y = t * 1.5; diamond.scale.set(1.6 * dm || .001, 1 * dm || .001, 1 * dm || .001); diamond.visible = dm > .01;

    // --- 7 · niño igual; la lupa pasa y cambia la etiqueta de alrededor
    const s7 = pop(t, T.s7 + .2, 1.2) * out(t, T.s8, .3);
    child.position.set(0, .45, 0); child.rotation.y = Math.sin(t * .6) * .15; setS(child, s7 * 1);
    const sweep = prog(t, at('cambia') - .3, at('percepción') + .4, ease.inOut);
    lens.position.set(lerp(-1.4, 1.4, sweep), 1.65 + Math.sin(sweep * Math.PI) * .25, 1.1); lens.rotation.z = -.2; setS(lens, s7 * .8);

    // --- 8 · terrón → interrogación → compartir con partículas
    const s8 = t - T.s8;
    const cubeBack = pop(t, T.s8 + .1, 1.4) * (1 - smooth(prog(t, at('creías') - .2, at('creías') + .2)));
    if (t > T.s8) { bigCube.position.set(0, 2.1, 0); bigCube.rotation.set(.4 + t * .4, .6 + t * .5, 0); setS(bigCube, .9 * cubeBack); }
    const qi = pop(t, at('creías') - .05, 1.3) * out(t, at('Compártelo') - .25, .25);
    q2.position.set(0, 1.6, 0); q2.rotation.y = Math.sin(t * 2) * .3; setS(q2, qi);
    const sh = pop(t, at('Compártelo') - .05, 1.4);
    share.position.set(0, 2.1, .3); share.rotation.y = Math.sin(t * 1.4) * .25; setS(share, sh * (t > T.s8 ? 1 : 0));
    const bk = prog(t, at('Compártelo') + .1, at('Compártelo') + 1.3, ease.out);
    for (let i = 0; i < NB; i++) {
      const a = hash(i + 5) * Math.PI * 2, b = (hash(i + 55) - .5) * Math.PI, r = bk * (.6 + hash(i + 555) * 1.6);
      bPos[i * 3] = Math.cos(a) * Math.cos(b) * r; bPos[i * 3 + 1] = 2.1 + Math.sin(b) * r; bPos[i * 3 + 2] = .3 + Math.sin(a) * Math.cos(b) * r * .4;
    }
    bGeo.attributes.position.needsUpdate = true; burst.visible = bk > 0 && bk < 1; burst.material.opacity = 1 - bk;
    void s8; void END;

    // ---------- textos en pantalla ----------
    const src94 = 'Hoover y Milich · J Abnorm Child Psychol, 1994';
    headline(ov, '35 MADRES', 'UNA TRAMPA', prog(t, at('35') - .1, at('35') + .2) * out(t, T.s2 - .1, .2), WHITE, GOLD);
    source(ov, src94, prog(t, .6, 1) * out(t, T.s5 - .1, .2));
    if (t > T.s2 && t < T.s3 + .3) {   // sello luminoso sobre el vaso
      const [gx0, y] = project([-1.35, 2.5, 0]), x = Math.min(gx0 + 400, 760), a = prog(t, at('muchísimo') - .1, at('muchísimo') + .15, ease.out) * out(t, T.s3 + .05, .2);
      ov.rect(x - 230, y - 48, 460, 96, { color: GOLD, width: 5, alpha: a, glowBlur: 24, radius: 14 });
      ov.label('MUCHO AZÚCAR', x, y, { color: GOLD, size: 54, weight: 800, alpha: a });
    }
    headline(ov, 'PERCEPCIÓN DE LAS MADRES', null, prog(t, T.s4 + .3, T.s4 + .6) * out(t, T.s5 - .1, .2), WHITE, GOLD, 60);
    if (holo.visible) {
      const a = hIn;
      const [xa, ya] = project([-.5, .2 - .1, .6]), [xb] = project([.5, .2 - .1, .6]);
      ov.text('les dijeron', xa, ya + 40, { size: 30, weight: 500, color: GREY, alpha: a }); ov.text('AZÚCAR', xa, ya + 78, { size: 38, weight: 800, color: GOLD, alpha: a });
      ov.text('les dijeron', xb, ya + 40, { size: 30, weight: 500, color: GREY, alpha: a }); ov.text('PLACEBO', xb, ya + 78, { size: 38, weight: 800, color: CYAN, alpha: a });
      const [xt, yt] = project([-.5, .2 + .05 + hA + .2, .6]);
      ov.label('más hiperactivos', xt, yt, { color: RED, size: 40, weight: 800, alpha: prog(t, at('hiperactivos') - .1, at('hiperactivos') + .2) * a, glowBlur: 12 });
    }
    headline(ov, '¿SUBIDÓN?', null, prog(t, at('subidón') - .1, at('subidón') + .2) * out(t, T.s6 - .1, .2), GOLD, WHITE, 90);
    {
      const a = prog(t, T.s6 + .3, T.s6 + .6) * out(t, T.s7 - .1, .2);
      if (landed > 0) ov.label(String(landed), 540, 600, { color: GOLD, size: 140, weight: 800, glowBlur: 20, alpha: a * (1 - toPlot) });
      ov.text('ESTUDIOS', 540, 700, { size: 52, weight: 800, color: WHITE, alpha: landed > 0 ? a * (1 - toPlot) : 0 });
      headline(ov, 'SIN EFECTO SIGNIFICATIVO', 'en promedio', a * toPlot, WHITE, CYAN, 62, 52);
      if (zeroLine.visible) { const [x0, y0] = project([0, .3, 0]); ov.text('0 = sin efecto', x0 + 70, y0, {align: 'left', size: 34, weight: 600, color: CYAN, alpha: a * toPlot }); }
      source(ov, 'Wolraich y otros · JAMA, 1995 · gráfico ilustrativo', a);
    }
    if (child.visible) {   // la etiqueta cambia según por dónde pasa la lupa; el niño no cambia
      const [cx, cy] = project([0, 2.25, 0]), a = s7, k = smooth(clamp((sweep - .35) / .3));
      ov.text('tranquilo', cx, cy - 40, { size: 50, weight: 800, color: WHITE, alpha: a * (1 - k) });
      ov.label('¿hiperactivo?', cx, cy - 40, { size: 50, weight: 800, color: RED, alpha: a * k, glowBlur: 12 });
      headline(ov, 'EL NIÑO NO CAMBIA', 'cambia cómo lo miramos', prog(t, at('percepción') - .1, at('percepción') + .2) * out(t, T.s8 - .1, .2), WHITE, GOLD, 64, 50);
    }
    headline(ov, '¿TÚ TAMBIÉN LO CREÍAS?', null, prog(t, T.s8 + .2, T.s8 + .5), WHITE, CYAN, 64);
  } };

  return { shots: [shot] };
}
