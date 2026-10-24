// Cuerpo con Datos · ¿Cuánta proteína necesitas de verdad? — un solo universo 3D que se transforma.
// Fuentes: Morton y otros (2018), Br J Sports Med 52:376 (49 estudios, 1.863 personas; corte 1,62 g/kg/día, IC 95 % 1,03–2,20)
// y EFSA (2012), ingesta de referencia de proteína en adultos: 0,83 g/kg/día.
// La curva es ilustrativa (forma del modelo de corte), no datos de cada estudio.
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export default async function (api) {
  const { THREE, mat, geo, contactShadow, prog, ease, lerp, clamp, at, project, rng, camera } = api;
  const INK = '#10141C', CYAN = '#19D8E8', AMBER = '#F5B942', WHITE = '#F5F7FA', GREY = '#8b93a1';
  const font = await new Promise((ok, ko) => new FontLoader().load('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json', ok, undefined, ko));

  // ---------- utilidades ----------
  // Muelle en forma cerrada: 0 antes de t0, sube a 1 con un pequeño rebote.
  const pop = (t, t0, k = 1) => { const x = (t - t0) * k; return x <= 0 ? 0 : 1 - Math.exp(-7 * x) * Math.cos(12 * x); };
  const out = (t, t1, d = .3) => 1 - prog(t, t1, t1 + d, ease.in);
  const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
  const setS = (o, s) => { o.visible = s > .002; o.scale.setScalar(Math.max(.002, s)); };
  const smooth = (x) => x * x * (3 - 2 * x);

  const amberM = new THREE.MeshStandardMaterial({ color: AMBER, metalness: .35, roughness: .3, emissive: AMBER, emissiveIntensity: .25 });
  const whiteM = new THREE.MeshStandardMaterial({ color: WHITE, metalness: .1, roughness: .35, emissive: WHITE, emissiveIntensity: .08 });
  function text3d(str, size, m) {
    const g = new TextGeometry(str, { font, size, depth: size * .28, curveSegments: 8, bevelEnabled: true, bevelThickness: size * .04, bevelSize: size * .025, bevelSegments: 3 });
    g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
    const o = new THREE.Group(); o.add(new THREE.Mesh(g, m)); return o;
  }

  const world = new THREE.Group();

  // ---------- objetos ----------
  // Báscula de baño con pantalla digital.
  const scale = new THREE.Group();
  {
    const base = new THREE.Mesh(geo.rbox(2.0, .14, 2.0, .12), mat.plastic('#e9edf2', .35)); scale.add(base);
    const glass = new THREE.Mesh(geo.rbox(1.9, .03, 1.9, .015), new THREE.MeshStandardMaterial({ color: '#cfd6dd', roughness: .06, metalness: .2, transparent: true, opacity: .5 })); glass.position.y = .08; scale.add(glass);
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.8, .3), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2; screen.position.set(0, .1, .62); scale.add(screen);
    scale.userData.setText = (s) => {
      if (scale.userData.last === s) return; scale.userData.last = s;
      const x = c.getContext('2d'); x.fillStyle = '#071214'; x.fillRect(0, 0, 512, 192);
      x.fillStyle = CYAN; x.font = "700 118px 'Inter Display'"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 256, 100); t.needsUpdate = true;
    };
    scale.userData.setText('0 kg');
    const sh = contactShadow(2.8, 2.8, .55); sh.position.y = -.08; scale.add(sh);
  }
  world.add(scale);

  // Indicador de proteína: aro vertical de 0 a 2 g/kg que se llena.
  const GMAX = 2;
  const gauge = new THREE.Group();
  const gaugeArc = new THREE.Mesh(new THREE.TorusGeometry(.62, .055, 16, 160, Math.PI * 2), mat.neon(CYAN));
  {
    const track = new THREE.Mesh(new THREE.TorusGeometry(.62, .03, 12, 160), mat.plastic('#2a3140', .6)); gauge.add(track);
    gaugeArc.rotation.z = Math.PI / 2; gaugeArc.scale.x = -1; gauge.add(gaugeArc);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI / 2 - i / 8 * Math.PI * 2, tk = new THREE.Mesh(geo.rbox(.02, i % 4 === 0 ? .12 : .07, .02, .008), mat.plastic('#5b6578', .5));
      tk.position.set(Math.cos(a) * .75, Math.sin(a) * .75, 0); tk.rotation.z = a - Math.PI / 2; gauge.add(tk);
    }
  }
  const arcIdx = gaugeArc.geometry.index.count;
  const setGauge = (v) => { const k = clamp(v / GMAX); gaugeArc.geometry.setDrawRange(0, Math.floor(arcIdx * k / 6) * 6); gaugeArc.visible = k > .005; };
  world.add(gauge);

  // Mancuerna.
  const dumbbell = new THREE.Group();
  {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.7, 32), mat.metal('#c9cdd3')); bar.rotation.z = Math.PI / 2; dumbbell.add(bar);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.062, .062, .6, 32), mat.metal('#7d8188')); grip.rotation.z = Math.PI / 2; dumbbell.add(grip);
    for (const s of [1, -1]) [[.42, .34, .1], [.55, .29, .09], [.66, .23, .08]].forEach(([x, r, w]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 64), mat.plastic('#1e232c', .45)); p.rotation.z = Math.PI / 2; p.position.x = s * x; dumbbell.add(p);
    });
  }
  world.add(dumbbell);

  // Figura humana estilizada (maniquí). Los "músculos" (brazos, pecho, muslos) se iluminan.
  const body = new THREE.Group();
  const skinM = mat.plastic('#c9ced6', .4);
  const muscleM = new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: .4, emissive: AMBER, emissiveIntensity: 0 });
  const muscleBase = new THREE.Color('#c9ced6'), muscleHot = new THREE.Color(AMBER);
  {
    const cap = (r, l, m, x, y, rz = 0) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 24), m); o.position.set(x, y, 0); o.rotation.z = rz; body.add(o); return o; };
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 32, 16), skinM); head.position.y = 1.72; body.add(head);
    cap(.07, .08, skinM, 0, 1.5);                       // cuello
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(.26, .22, 8, 24), muscleM); chest.position.y = 1.18; chest.scale.set(1.2, 1, .75); body.add(chest);
    const waist = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .16, 8, 24), skinM); waist.position.y = .82; waist.scale.set(1.05, 1, .7); body.add(waist);
    for (const s of [1, -1]) {
      cap(.1, .3, muscleM, s * .43, 1.18, s * .25);      // brazo
      cap(.075, .3, skinM, s * .55, .78, s * .08);       // antebrazo
      cap(.13, .38, muscleM, s * .13, .42, s * .03);     // muslo
      cap(.09, .38, skinM, s * .15, -.06, 0);            // pierna
    }
    const sh = contactShadow(1.2, 1.2, .5); sh.position.y = -.3; body.add(sh);
    body.userData.footY = -.3;
  }
  world.add(body);

  // Números 3D que viajan por todo el vídeo.
  const n08 = text3d('0,8', .5, whiteM), n16 = text3d('1,6', .5, amberM), n70 = text3d('70', .42, whiteM), n112 = text3d('112 g', .5, amberM);
  const times = new THREE.Group();
  for (const r of [1, -1]) { const b = new THREE.Mesh(geo.rbox(.26, .055, .055, .02), whiteM); b.rotation.z = r * Math.PI / 4; times.add(b); }
  world.add(n08, n16, n70, n112, times);

  // 49 tarjetas de estudio: llegan, forman un muro 7×7 y luego se convierten en las barras de la gráfica.
  const N = 49, cards = [], R = rng(7);
  const cardM = mat.plastic('#e9edf2', .5), stripeM = mat.neon(CYAN);
  for (let i = 0; i < N; i++) {
    const c = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .02), cardM); c.add(face);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1, .08, .022), stripeM); stripe.position.y = .42; c.add(stripe);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.7 - k * .15, .05, .022), mat.plastic('#9aa3b2', .6)); l.position.set(-.1 + k * .07 * 0, .18 - k * .17, 0); c.add(l); }
    const th = R() * Math.PI * 2, ph = R() * Math.PI;
    c.userData = {
      from: [Math.cos(th) * 5, Math.sin(th) * 4 + 1, 2 + R() * 4], spin: (R() - .5) * 6,
      wall: [(i % 7 - 3) * .3, 1.95 - Math.floor(i / 7) * .36, 0],
      face, stripe,
    };
    void ph; cards.push(c); world.add(c);
  }

  // Gráfica: ejes, curva neón, línea del 1,6 y franja de incertidumbre.
  const XMAX = 3, GX = 1.0, GY = 1.5, X0 = -1.5;
  const gx = (v) => X0 + v * GX;
  const curveY = (v) => { const k = Math.min(v, 1.62) / 1.62; return GY * (.12 + .88 * (1 - (1 - k) * (1 - k))); };
  const chart = new THREE.Group();
  const axM = mat.plastic('#3a4252', .6);
  const xAx = new THREE.Mesh(geo.rbox(3.25, .035, .035, .012), axM); xAx.position.set(.1, 0, 0); chart.add(xAx);
  const yAx = new THREE.Mesh(geo.rbox(.035, 1.95, .035, .012), axM); yAx.position.set(X0, .97, 0); chart.add(yAx);
  for (let v = 0; v <= XMAX; v += .5) { const tk = new THREE.Mesh(geo.rbox(.018, v % 1 === 0 ? .12 : .07, .018, .006), axM); tk.position.set(gx(v), -.03, 0); chart.add(tk); }
  const cpts = []; for (let i = 0; i <= 120; i++) { const v = i / 120 * XMAX; cpts.push(new THREE.Vector3(gx(v), curveY(v) + .03, .06)); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cpts), 240, .035, 12), mat.neon(CYAN)); chart.add(tube);
  const tubeIdx = tube.geometry.index.count;
  const vline = new THREE.Mesh(new THREE.BoxGeometry(.025, 1, .025), mat.neon(AMBER)); chart.add(vline);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.07, 32, 16), mat.neon(AMBER)); dot.position.set(gx(1.62), curveY(1.62) + .03, .06); chart.add(dot);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .3), mat.glass(AMBER, .32)); chart.add(band);
  world.add(chart);

  // Coctelera y el icono de compartir.
  const shaker = new THREE.Group();
  {
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.36, 0], [0.4, 0.08], [0.44, 1.25], [0.001, 1.25]].map(([r, y]) => new THREE.Vector2(r, y)), 64), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .25, roughness: .1, depthWrite: false }));
    shaker.add(cup);
    const milk = new THREE.Mesh(new THREE.CylinderGeometry(.4, .36, .85, 64), mat.plastic('#d9b48c', .6)); milk.position.y = .44; shaker.add(milk);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.42, .46, .26, 64), mat.plastic('#1e232c', .4)); lid.position.y = 1.38; shaker.add(lid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.18, .23, .2, 48), mat.plastic(AMBER, .4)); top.position.y = 1.6; shaker.add(top);
  }
  const shakerShadow = contactShadow(1.6, 1.6, .55); world.add(shaker, shakerShadow);
  const share = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .08, 64), mat.neon(CYAN)); disc.rotation.x = Math.PI / 2; share.add(disc);
    const arrM = new THREE.MeshBasicMaterial({ color: INK });
    const stem = new THREE.Mesh(geo.rbox(.22, .06, .02, .02), arrM); stem.position.set(-.04, -.03, .05); stem.rotation.z = .5; share.add(stem);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.09, .16, 3), arrM); head.position.set(.09, .05, .05); head.rotation.z = -Math.PI / 2 + .5; share.add(head);
  }
  world.add(share);

  // ---------- tiempos (todo atado a la voz) ----------
  const T = {
    s2: at('La') - .2, s3: at('Pero') - .2, s4: at('metaanálisis') - .3, s5: at('proteína', 2) - .3,
    s6: at('Pero', 2) - .2, s7: at('Si') - .15, s8: at('Envíaselo') - .15,
  };

  // Cámara por tramos: [inicio, posición, objetivo]. Entre tramos, deslizamiento suave de .7 s.
  const CAM = [
    [0, [0, 1.6, 13], [0, 1.55, 0]],
    [T.s2, [0, 3.2, 12.5], [0, 1.4, 0]],
    [T.s3, [.6, 1.6, 13], [0, 1.65, 0]],
    [T.s4, [0, 1.4, 13.2], [0, 1.95, 0]],
    [T.s5, [0, 1.5, 14.6], [0, 1.75, 0]],
    [T.s6, [-.4, 1.5, 14.4], [0, 1.75, 0]],
    [T.s7, [0, 1.9, 14], [0, .85, 0]],
    [T.s8, [0, 1.5, 12], [0, 1.75, 0]],
  ];
  function cameraAt(t) {
    let i = 0; while (i + 1 < CAM.length && CAM[i + 1][0] <= t) i++;
    let [t0, p, g] = CAM[i];
    if (i > 0) { const k = smooth(clamp((t - t0) / .7)); p = mix(CAM[i - 1][1], p, k); g = mix(CAM[i - 1][2], g, k); }
    const drift = (t - t0) * .06;
    if (i === 0) p = [p[0], p[1], lerp(18, 13, prog(t, 0, .8, ease.out)) - drift * 2];   // zoom rápido del gancho
    else p = [p[0], p[1], p[2] - drift];
    // pequeño golpe de cámara cuando aterriza el 112
    const hit = Math.exp(-9 * Math.max(0, t - at('112'))) * (t > at('112') ? 1 : 0);
    camera.position.set(p[0] + Math.sin(t * 60) * .03 * hit, p[1] + Math.cos(t * 53) * .03 * hit, p[2]);
    camera.fov = 30; camera.updateProjectionMatrix(); camera.lookAt(...g); camera.updateMatrixWorld();
  }

  // Titulares (separados de los subtítulos, entre y=540 y y=760).
  function headline(ov, l1, l2, a, c1 = WHITE, c2 = AMBER, s1 = 80, s2 = 64) {
    if (a <= 0) return;
    if (l1) ov.text(l1, 540, 560, { size: s1, weight: 800, color: c1, alpha: a });
    if (l2) ov.text(l2, 540, 560 + s1 * .6 + s2 * .75, { size: s2, weight: 800, color: c2, alpha: a });
  }
  const source = (ov, s, a) => ov.text(s, 540, 1610, { size: 30, weight: 500, color: GREY, alpha: a });

  const shot = { start: 0, in: 'cut', out: 'cut', group: world, update(lt, { t, ov }) {
    cameraAt(t);

    // --- 1 · Gancho: 0,8 contra 1,6, cambian de sitio; la báscula aparece entre los dos.
    const swap = smooth(prog(t, at('necesitas') - .1, at('necesitas') + .6));
    const enter = pop(t, .05, 1.4);
    const p08a = [-.65, 1.75, 0], p08b = [.6, .35, .3], p16a = [.55, .5, .4], p16b = [-.5, 1.75, 0];
    // tramo 2: el 0,8 entra en el indicador; el 1,6 se aparca fuera de cuadro
    const to2 = smooth(prog(t, T.s2, T.s2 + .7));
    let p08 = mix(mix(p08a, p08b, swap), [0, 1.35, .08], to2), s08 = lerp(lerp(.75, 1.7, swap), .62, to2) * enter;
    s08 *= out(t, T.s3 + .5, .35);
    n08.position.set(...p08); n08.rotation.y = Math.sin(t * 1.3) * .18 * (1 - to2); setS(n08, s08);

    // 1,6: aparcado y después vuelve como marcador de la gráfica y como factor del cálculo
    const mk = [gx(1.62), curveY(1.62) + .5, .1];
    const back5 = smooth(prog(t, at('1,6') - .35, at('1,6') + .2));
    const toOp = smooth(prog(t, at('70') + .1, at('70') + .7));
    let p16 = mix(mix(p16a, p16b, swap), [2.6, 3.4, -1], to2);
    p16 = mix(p16, mk, back5); p16 = mix(p16, [.75, 2.35, 0], toOp);
    let s16 = lerp(lerp(1.9, .8, swap), .5, to2) * enter;
    s16 = lerp(s16, .62, back5); s16 = lerp(s16, .7, toOp);
    const opBack = smooth(prog(t, at('112') - .25, at('112') + .25));
    s16 *= lerp(1, .55, opBack) * out(t, T.s8, .3);
    n16.position.set(lerp(p16[0], .45, opBack), p16[1] + opBack * .5, p16[2] - opBack * .6); n16.rotation.y = Math.sin(t * 1.1 + 1) * .18 * (1 - to2); setS(n16, s16);

    // Báscula: aparece entre los dos números, crece en el tramo 2, se va y vuelve en el 7 con la figura encima.
    const sIn = pop(t, .9, 1.3) * .45, s2 = smooth(prog(t, T.s2, T.s2 + .6)), s3o = out(t, T.s3 + .1, .35);
    const s7 = pop(t, T.s7 + .05, 1.2) * out(t, T.s8, .3);
    const sv = Math.max(lerp(sIn, 1, s2) * s3o, s7 * .95);
    scale.position.set(0, lerp(-.2, -.55, s2), 0); if (t > T.s7) scale.position.set(0, -1.05, 0);
    scale.rotation.set(t < T.s7 ? lerp(.5, 0, s2) : 0, -.25 + t * .03, 0); setS(scale, sv);
    const kg = t < T.s7 ? 70 * prog(t, T.s2 + .2, T.s2 + 1.2, ease.out) : 70 * prog(t, at('70') - .4, at('70') + .1, ease.out);
    scale.userData.setText(`${Math.round(kg)} kg`);

    // Indicador: se llena hasta 0,83 g/kg; en el tramo 3 se contrae y de su centro sale la mancuerna.
    const gIn = pop(t, T.s2 + .15, 1.3), gCollapse = smooth(prog(t, T.s3 + .1, T.s3 + .55));
    gauge.position.set(0, 1.35, 0); setS(gauge, gIn * (1 - gCollapse));
    setGauge(.83 * prog(t, at('0,8') - .45, at('0,8') + .35, ease.out));

    // --- 3 · Cubrir necesidades ≠ maximizar músculo: mancuerna (del indicador) y la figura.
    const dIn = pop(t, T.s3 + .4, 1.2), dOut = out(t, T.s4 + .1, .3);
    dumbbell.position.set(lerp(0, .78, smooth(prog(t, T.s3 + .5, T.s3 + 1.2))), lerp(1.35, .55, smooth(prog(t, T.s3 + .5, T.s3 + 1.2))), .5);
    dumbbell.rotation.set(.25, t * .5, lerp(0, .5, smooth(prog(t, T.s3 + .5, T.s3 + 1.2)))); setS(dumbbell, .85 * dIn * dOut);
    const bIn3 = pop(t, at('cubre') - .1, 1.1) * out(t, T.s4 + .05, .3), bIn7 = pop(t, T.s7 + .3, 1.1) * out(t, T.s8, .3);
    body.position.set(t < T.s7 ? -.15 : 0, t < T.s7 ? .25 : -.67, 0); body.rotation.y = t < T.s7 ? .35 + Math.sin(t * .8) * .1 : .15;
    setS(body, Math.max(bIn3, bIn7) * (t < T.s7 ? 1 : .78));
    { const k = prog(t, at('músculo') - .15, at('músculo') + .3) * out(t, T.s4, .3); muscleM.emissiveIntensity = .7 * k; muscleM.color.copy(muscleBase).lerp(muscleHot, k); }

    // --- 4 · 49 estudios: las tarjetas llegan volando y forman el muro.
    const landEnd = at('49') + .25, span = landEnd - (T.s4 + .1) - .45;
    let landed = 0;
    // --- 5 · las tarjetas se convierten en barras; la curva se dibuja.
    cards.forEach((c, i) => {
      const u = c.userData, st = T.s4 + .1 + span * (i / (N - 1));
      const f = prog(t, st, st + .45, ease.out); if (f >= 1) landed++;
      const v = (i + .5) / N * XMAX, bh = curveY(v);
      const toBar = smooth(prog(t, T.s5 + i * .006, T.s5 + .55 + i * .006));
      const bar = [gx(v), bh / 2, 0];
      let p = mix(u.from, u.wall, f); p = mix(p, bar, toBar);
      c.position.set(...p);
      c.rotation.set(0, (1 - f) * u.spin + toBar * 0, (1 - f) * u.spin * .5);
      const w = lerp(.26, GX * XMAX / N * .72, toBar), h = lerp(.33, bh, toBar);
      c.scale.set(w, h, 1);
      u.stripe.visible = toBar < .5; u.face.material = cardM;
      c.visible = t >= st && t < T.s7 + .35;
      if (t > T.s7) { const k = prog(t, T.s7, T.s7 + .35, ease.in); c.scale.y = Math.max(.001, h * (1 - k)); c.position.y = bh * (1 - k) / 2; }
    });

    // Gráfica
    const chIn = prog(t, T.s5 + .2, T.s5 + .6), chOut = out(t, T.s7, .35);
    chart.visible = t > T.s5 && t < T.s7 + .4;
    xAx.scale.x = Math.max(.001, chIn * chOut); yAx.scale.y = Math.max(.001, chIn * chOut);
    const draw = prog(t, at('suma') - .2, at('aplana') + .2, ease.inOut) * chOut;
    tube.geometry.setDrawRange(0, Math.floor(tubeIdx * draw / 6) * 6); tube.visible = draw > 0;
    const vl = prog(t, at('1,6') - .1, at('1,6') + .35, ease.out) * chOut, yTop = curveY(1.62) + .3;
    vline.visible = vl > 0; vline.scale.y = Math.max(.001, vl * yTop); vline.position.set(gx(1.62), vl * yTop / 2, .06);
    setS(dot, vl);
    const bw = smooth(prog(t, at('aproximado') - .3, at('límite') + .2)) * chOut;
    band.visible = bw > 0; band.scale.set(Math.max(.001, (2.2 - 1.03) * GX * bw), GY + .25, 1); band.position.set(gx(1.62) + (gx((1.03 + 2.2) / 2) - gx(1.62)) * bw, (GY + .25) / 2, 0);

    // --- 7 · 70 × 1,6 = 112 g
    const o70 = pop(t, at('70') - .1, 1.3) * lerp(1, .55, opBack) * out(t, T.s8, .3);
    n70.position.set(lerp(-.75, -.45, opBack), 2.35 + opBack * .5, -opBack * .6); setS(n70, o70);
    times.position.set(0, 2.35 + opBack * .5, -opBack * .6); setS(times, pop(t, at('70') + .3, 1.3) * lerp(1, .55, opBack) * out(t, T.s8, .3));
    const b112 = pop(t, at('112') - .05, 1.1) * out(t, T.s8, .3);
    n112.position.set(0, 2.3, lerp(-1, 1.1, smooth(prog(t, at('112') - .05, at('112') + .35)))); setS(n112, b112 * 1.15);
    n112.rotation.y = Math.sin(t * 1.4) * .1;

    // --- 8 · la coctelera cae, rebota y suelta el icono de compartir hacia cámara.
    const land = T.s8 + .45;
    let y; if (t < land) { const p = clamp((t - T.s8) / .45); y = 7 * (1 - p * p); } else { const x = t - land; y = .32 * Math.exp(-5 * x) * Math.abs(Math.sin(8 * x)); }
    shaker.visible = t > T.s8; shaker.position.set(0, -.2 + y, 0); shaker.rotation.y = .4 + (t - T.s8) * .25;
    const squash = t > land ? 1 - .12 * Math.exp(-10 * (t - land)) * Math.abs(Math.cos(8 * (t - land))) : 1;
    shaker.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    shakerShadow.visible = shaker.visible; shakerShadow.position.set(0, -.21, 0); shakerShadow.scale.setScalar(lerp(.4, 1, 1 - clamp(y / 7)));
    const fly = prog(t, at('amigo') - .05, at('amigo') + .75, ease.in);
    share.visible = t > at('amigo') - .3 && fly < 1;
    const sp = mix([0, 1.9, .3], [camera.position.x, camera.position.y - .3, camera.position.z - .8], fly);
    share.position.set(...sp); share.scale.setScalar(Math.max(.002, pop(t, at('amigo') - .3, 1.6) * lerp(.9, 1.6, fly)));
    share.lookAt(camera.position);

    // ---------- textos en pantalla ----------
    headline(ov, '¿Cuánta proteína necesitas?', null, prog(t, .3, .7) * out(t, T.s2 - .1, .2), WHITE, AMBER, 64);
    headline(ov, '0,8 g/kg/día', 'REFERENCIA GENERAL', prog(t, at('0,8') - .1, at('0,8') + .2) * out(t, T.s3 - .1, .2), WHITE, CYAN, 84, 52);
    source(ov, 'EFSA, 2012 · ingesta de referencia en adultos', prog(t, T.s2 + .4, T.s2 + .8) * out(t, T.s3 - .1, .2));
    {
      const a = out(t, T.s4 - .1, .2);
      ov.text('CUBRIR NECESIDADES', 540, 560, { size: 70, weight: 800, color: WHITE, alpha: prog(t, at('cubre') - .1, at('cubre') + .2) * a });
      ov.text('≠', 540, 650, { size: 70, weight: 800, color: GREY, alpha: prog(t, at('no', 1) - .1, at('no', 1) + .2) * a });
      ov.text('MAXIMIZAR MÚSCULO', 540, 740, { size: 70, weight: 800, color: AMBER, alpha: prog(t, at('maximizar') - .1, at('maximizar') + .2) * a });
    }
    {
      const a = prog(t, T.s4 + .3, T.s4 + .6) * out(t, T.s5 - .1, .2);
      const c = landed;
      if (c > 0) ov.label(String(c), 540, 590, { color: AMBER, size: 150, weight: 800, glowBlur: 20, alpha: a });
      ov.text('ESTUDIOS', 540, 700, { size: 56, weight: 800, color: WHITE, alpha: c > 0 ? a : 0 });
      ov.text('1.863 PARTICIPANTES', 540, 770, { size: 52, weight: 800, color: CYAN, alpha: prog(t, at('gente') - .1, at('gente') + .2) * a });
      source(ov, 'Morton y otros · Br J Sports Med, 2018 (metaanálisis)', a);
    }
    headline(ov, '≈1,6 g/kg/día', 'las ganancias tienden a estabilizarse', prog(t, at('1,6') - .1, at('1,6') + .2) * out(t, T.s6 - .1, .2), AMBER, WHITE, 84, 44);
    headline(ov, 'NO ES UN LÍMITE EXACTO', 'IC 95 %: 1,03–2,20 g/kg', prog(t, at('aproximado') - .1, at('aproximado') + .2) * out(t, T.s7 - .1, .2), WHITE, AMBER, 70, 48);
    // etiquetas de la gráfica
    if (chart.visible && chIn * chOut > 0) {
      const a = chIn * chOut;
      for (const v of [0, 1, 2, 3]) { const [x, y0] = project([gx(v), 0, 0]); ov.text(String(v), x, y0 + 55, { size: 36, weight: 600, color: GREY, alpha: a }); }
      const [, yb] = project([0, 0, 0]);
      ov.text('g de proteína por kg al día', 540, yb + 120, { size: 36, weight: 600, color: GREY, alpha: a });
      const [xl, yl] = project([X0, GY + .35, 0]);
      ov.text('músculo ganado', xl, yl, { size: 36, weight: 600, color: GREY, align: 'left', alpha: a });
      source(ov, 'Morton 2018 · curva ilustrativa del modelo (corte en 1,62)', a * out(t, T.s6, .2));
      source(ov, 'Morton 2018 · intervalo de confianza del 95 %', a * prog(t, T.s6, T.s6 + .3));
    }
    {
      const a = prog(t, at('112') + .1, at('112') + .4) * out(t, T.s8 - .1, .2);
      ov.text('de proteína al día', 540, project([0, 2.3, 1.1])[1] + 150, { size: 48, weight: 700, color: WHITE, alpha: a });
      source(ov, 'Cálculo: 70 kg × 1,6 g/kg = 112 g', a);
    }
    headline(ov, 'ENVÍASELO AL DEL BATIDO', 'Que haga sus cuentas.', prog(t, T.s8 + .3, T.s8 + .55), WHITE, CYAN, 70, 54);
  } };

  return { shots: [shot] };
}
