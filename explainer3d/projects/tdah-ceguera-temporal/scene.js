// TDAH · ceguera temporal — escena 3D (formato "resulta que").
// Fuente del dato: Marx, Cortese, Koelch y Hacker (2021), J Am Acad Child Adolesc Psychiatry, metaanálisis de 55 estudios.
export default function (api) {
  const { THREE, mat, geo, contactShadow, prog, kf, ease, lerp, clamp, at, fit, project, rng } = api;
  const GOLD = '#e9b44c', CYAN = '#6ff5df', RED = '#ff5a5a';
  const shots = [];

  // ---------- objetos ----------
  // La sombra va fuera del objeto para que fit() encuadre solo el objeto (userData.core).
  function wrap(core, sh) { const o = new THREE.Group(); o.add(core, sh); o.userData = core.userData; core.userData.core = core; return o; }
  // Reloj de arena: dos ampollas de cristal, arena que baja, tapas de madera y 3 columnas.
  const BULB = [[0.001, 0], [0.07, 0.02], [0.2, 0.14], [0.42, 0.36], [0.5, 0.6], [0.46, 0.84], [0.32, 0.97], [0.001, 1]];
  function makeHourglass() {
    const g = new THREE.Group();
    const glassM = new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .2, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
    const prof = BULB.map(([r, y]) => new THREE.Vector2(r, y));
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glassM); m.scale.y = s; g.add(m); }
    const sandM = mat.plastic('#e7b65a', .85);
    // arena de arriba: cono invertido que se vacía (escala desde el cuello)
    const top = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0.02], [0.18, 0.14], [0.38, 0.36], [0.44, 0.58], [0.001, 0.58]].map(([r, y]) => new THREE.Vector2(r, y)), 48), sandM);
    g.add(top);
    // montón de abajo
    const pile = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.34, 48, 1), sandM); g.add(pile);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), sandM); g.add(stream);
    const wood = mat.wood([1, 1]);
    for (const y of [1.06, -1.06]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 64), wood); c.position.y = y; g.add(c); }
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + .5, p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 16), wood);
      p.position.set(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56); g.add(p);
    }
    const sh = contactShadow(2.2, 2.2, .6); sh.position.y = -1.13;
    // k = 0 (todo arriba) .. 1 (todo abajo)
    g.userData.setSand = (k) => {
      const up = Math.cbrt(1 - k);
      top.scale.set(up, up, up); top.visible = up > .02;
      pile.scale.set(Math.sqrt(k) || .001, Math.sqrt(k) || .001, Math.sqrt(k) || .001);
      pile.position.y = -1 + 0.17 * Math.sqrt(k);
      stream.visible = k > .01 && k < .99; stream.scale.y = .9; stream.position.y = -0.5;
    };
    g.userData.setSand(.3);
    return wrap(g, sh);
  }

  // Reloj de pared: cuerpo, esfera, 12 marcas y dos agujas con pivote.
  function makeClock() {
    const g = new THREE.Group();
    const rimM = mat.metal('#b9bdc4');
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 24, 96), rimM); g.add(rim);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 96), mat.plastic('#2a2b2f', .6));
    back.rotation.x = Math.PI / 2; back.position.z = -0.08; g.add(back);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.96, 96), mat.plastic('#f1ede4', .7)); face.position.z = 0.005; g.add(face);
    const tickM = mat.plastic('#1b1b1d', .5);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, big = i % 3 === 0;
      const t = new THREE.Mesh(geo.rbox(big ? .05 : .03, big ? .16 : .1, .02, .01), tickM);
      t.position.set(Math.sin(a) * .8, Math.cos(a) * .8, .02); t.rotation.z = -a; g.add(t);
    }
    const hand = (len, w, col) => { const p = new THREE.Group(); const m = new THREE.Mesh(geo.rbox(w, len, .025, .012), mat.plastic(col, .4)); m.position.y = len / 2 - .08; p.add(m); p.position.z = .04; g.add(p); return p; };
    const hH = hand(.5, .07, '#1b1b1d'), hM = hand(.74, .045, '#1b1b1d');
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .05, 24), mat.gold()); cap.rotation.x = Math.PI / 2; cap.position.z = .07; g.add(cap);
    const base = new THREE.Color('#b9bdc4'), red = new THREE.Color(RED);
    g.userData.setHands = (h, m) => { hH.rotation.z = -h; hM.rotation.z = -m; };
    g.userData.setRed = (k) => { rimM.color.copy(base).lerp(red, k); };
    return g;
  }

  // Pila de folios (los 55 estudios).
  function makeStack(n) {
    const g = new THREE.Group(), r = rng(11), sheets = [];
    const paper = mat.plastic('#f1ede4', .9), paper2 = mat.plastic('#e4ddcf', .9);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(geo.rbox(1.2, .014, .85, .006), i % 2 ? paper : paper2);
      s.position.set((r() - .5) * .06, i * .017, (r() - .5) * .05); s.rotation.y = (r() - .5) * .12; g.add(s); sheets.push(s);
    }
    const sh = contactShadow(2.4, 2, .55); sh.position.y = -.01;
    g.userData.show = (k) => { const c = Math.round(n * k); sheets.forEach((s, i) => { s.visible = i < c; }); return c; };
    return wrap(g, sh);
  }

  // Temporizador de cocina: cuerpo torneado, dial con marcas y pomo.
  function makeTimer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.62, 0], [0.7, 0.08], [0.72, 0.3], [0.66, 0.5], [0.001, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)), 80), mat.plastic('#f1ede4', .5));
    g.add(body);
    const dial = new THREE.Group(); dial.position.y = .52; g.add(dial);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.6, .64, .14, 80), mat.plastic('#e9573f', .45)); ring.position.y = .07; dial.add(ring);
    const tickM = mat.plastic('#f1ede4', .5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, t = new THREE.Mesh(geo.rbox(.03, .02, .1, .008), tickM); t.position.set(Math.sin(a) * .5, .145, Math.cos(a) * .5); t.rotation.y = a; dial.add(t); }
    const knob = new THREE.Mesh(geo.rbox(.16, .14, .5, .05), mat.plastic('#f1ede4', .4)); knob.position.y = .2; dial.add(knob);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.05, .12, 3), mat.metal('#2a2b2f')); arrow.rotation.x = Math.PI / 2; arrow.position.set(0, .56, .66); g.add(arrow);
    const sh = contactShadow(2, 2, .6); sh.position.y = -.01;
    g.userData.setDial = (a) => { dial.rotation.y = a; };
    return wrap(g, sh);
  }

  // ---------- planos ----------
  const T = {
    no: at('No'), con: at('Con'), meta: at('metaanálisis') - .25, si: at('Si'), y: at('Y'),
    eso: at('eso') - .3, temp: at('temporizador') - .2,
  };

  // 1 · Gancho: reloj de arena, anillo dorado, "5 min" que acaban siendo "40".
  {
    const hg = makeHourglass(), group = new THREE.Group(); group.add(hg);
    shots.push({ start: 0, in: 'cut', group, update(lt, { t, ov }) {
      hg.rotation.y = .4 + lt * .25;
      hg.userData.setSand(lerp(.15, .85, prog(t, at('acaban'), at('40') + .3)));
      fit(hg.userData.core, { dir: [-.4, .35, 1.3], fill: lerp(.62, .7, prog(lt, 0, 3)), screenY: .6 });
      const [x, y] = project([0, 0, 0]);
      ov.ring(x, y, 400, { color: GOLD, progress: prog(lt, .1, .7, ease.out) });
      const five = prog(t, at('5') - .05, at('5') + .2, ease.out) * (1 - prog(t, at('40') - .1, at('40') + .05));
      ov.label('5 min', x, y + 520, { color: CYAN, size: 96, alpha: five });
      ov.label('40 min', x, y + 520, { color: RED, size: 110, alpha: prog(t, at('40'), at('40') + .15, ease.out) });
    } });
  }

  // 2 · "No es pereza": la palabra se tacha.
  {
    const hg = makeHourglass(), group = new THREE.Group(); group.add(hg);
    shots.push({ start: T.no, group, update(lt, { t, ov }) {
      hg.rotation.y = 1.2 + lt * .2; hg.userData.setSand(.9);
      fit(hg.userData.core, { dir: [.5, .2, 1.3], fill: lerp(.5, .55, prog(lt, 0, 2)), screenY: .64 });
      const [x, y] = project([0, 0, 0]);
      const a = prog(t, at('pereza') - .1, at('pereza') + .1, ease.out);
      ov.label('PEREZA', x, y - 520, { color: '#ffffff', size: 120, weight: 800, alpha: a, glowBlur: 0 });
      ov.line([[x - 260, y - 520], [x + 260, y - 520]], { color: RED, width: 14, progress: prog(t, at('pereza') + .25, at('pereza') + .55, ease.out) });
    } });
  }

  // 3 · Reloj interno desajustado: agujas que se embalan, aro rojo.
  {
    const ck = makeClock(), group = new THREE.Group(); group.add(ck);
    shots.push({ start: T.con, group, update(lt, { t, ov }) {
      ck.rotation.y = -.35 + lt * .1; ck.rotation.x = -.08;
      const wob = Math.sin(lt * 7) * .6 + lt * 5;
      ck.userData.setHands(1.2 + wob * .25, wob * 1.8 + Math.sin(lt * 13) * .4);
      const red = prog(t, at('desajustado') - .1, at('desajustado') + .3);
      ck.userData.setRed(red);
      fit(ck, { dir: [-.35, .1, 1.3], fill: lerp(.72, .8, prog(lt, 0, 2.5)), screenY: .6 });
      const [x, y] = project([0, 0, 0]);
      ov.ring(x, y, 470, { color: RED, progress: red, alpha: red });
    } });
  }

  // 4 · 55 estudios: los folios se apilan y cuenta el número; fuente visible.
  {
    const st = makeStack(55), group = new THREE.Group(); group.add(st);
    shots.push({ start: T.meta, group, update(lt, { t, ov }) {
      st.rotation.y = .6 + lt * .15;
      const c = st.userData.show(prog(t, at('juntó') - .1, at('55') + .5, ease.out));
      fit(st.userData.core, { dir: [-.8, .9, 1.2], fill: .56, screenY: .64 });
      const [x, y] = project([0, .95, 0]);
      if (c > 0) ov.label(String(c), x, y - 260, { color: GOLD, size: 200, weight: 800 });
      ov.text('estudios', x, y - 120, { size: 54, weight: 600, alpha: c > 0 ? 1 : 0 });
      ov.text('Marx, Cortese y otros · J Am Acad Child Adolesc Psychiatry, 2021', 540, 1610, { size: 30, weight: 500, color: '#9a9aa0', alpha: prog(lt, .4, .8) });
    } });
  }

  // 5 · Repetir un tiempo: barra de referencia (cian) vs la repetida (roja), con el hueco marcado.
  {
    const group = new THREE.Group();
    const ref = new THREE.Mesh(geo.rbox(1, .16, .16, .05), mat.neon(CYAN)), rep = new THREE.Mesh(geo.rbox(1, .16, .16, .05), mat.neon(RED));
    for (const [m, y] of [[ref, .35], [rep, -.35]]) { m.position.y = y; group.add(m); }
    const hg = makeHourglass(); hg.scale.setScalar(.42); hg.position.set(-2.05, 0, 0); group.add(hg);
    const anchor = new THREE.Group(); anchor.add(new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.6, .1), mat.glass(CYAN, 0))); group.add(anchor);
    const L = 3.1, L2 = 2.0, x0 = -1.5;
    shots.push({ start: T.si, group, update(lt, { t, ov }) {
      const a = prog(t, at('tiempo') - .2, at('tiempo') + .8), b = prog(t, at('vivir'), at('falla') + .3);
      ref.scale.x = Math.max(.001, L * a); ref.position.x = x0 + L * a / 2; ref.visible = a > 0;
      rep.scale.x = Math.max(.001, L2 * b); rep.position.x = x0 + L2 * b / 2; rep.visible = b > 0;
      hg.rotation.y = lt * .3; hg.userData.setSand(clamp(a));
      fit(anchor, { dir: [0, .05, 1], fill: .86, screenY: .58 });
      const [lx, ly] = project([x0, .35, 0]), [rx] = project([x0 + L, .35, 0]), [qx, qy] = project([x0 + L2, -.35, 0]);
      ov.text('lo que pasó', lx, ly - 70, { size: 46, weight: 600, color: CYAN, align: 'left', alpha: a });
      ov.text('lo que repites', lx, qy + 80, { size: 46, weight: 600, color: RED, align: 'left', alpha: b });
      const gap = prog(t, at('falla') - .1, at('falla') + .3);
      ov.line([[qx + 14, qy], [rx, qy]], { color: GOLD, width: 4, dash: [10, 12], progress: gap, alpha: gap });
      ov.line([[rx, qy - 30], [rx, qy + 30]], { color: GOLD, width: 4, alpha: gap });
    } });
  }

  // 6 · ¿Cuál de dos dura más? Dos relojes de arena casi iguales.
  {
    const group = new THREE.Group(), A = makeHourglass(), B = makeHourglass();
    A.position.x = -.85; B.position.x = .85; A.scale.setScalar(.8); B.scale.setScalar(.8); group.add(A, B);
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, .1), mat.glass(GOLD, 0)); group.add(box);
    shots.push({ start: T.y, group, update(lt, { t, ov }) {
      A.rotation.y = lt * .3; B.rotation.y = -lt * .3 + 1;
      A.userData.setSand(clamp(.2 + lt * .18)); B.userData.setSand(clamp(.2 + lt * .16));
      fit(box, { dir: [0, .3, 1.3], fill: lerp(.84, .9, prog(lt, 0, 2)), screenY: .6 });
      const [ax, ay] = project(A), [bx, by] = project(B);
      const r = prog(t, at('dos') - .1, at('dos') + .3, ease.out);
      ov.ring(ax, ay, 230, { color: GOLD, progress: r }); ov.ring(bx, by, 230, { color: GOLD, progress: r });
      ov.label('?', (ax + bx) / 2, ay - 330, { color: '#ffffff', size: 150, weight: 800, glowBlur: 0, alpha: prog(t, at('más', 2) - .1, at('más', 2) + .15, ease.out) });
    } });
  }

  // 7 · Sacar el tiempo fuera: el reloj, ahora sano, con anillo cian.
  {
    const ck = makeClock(), group = new THREE.Group(); group.add(ck);
    shots.push({ start: T.eso, group, update(lt, { t, ov }) {
      ck.rotation.y = .3 - lt * .08;
      const m = lt * .5; ck.userData.setHands(2.1 + m / 12, m); ck.userData.setRed(0);
      const out = prog(t, at('fuera') - .2, at('fuera') + .3, ease.out);
      fit(ck, { dir: [.3, .1, 1.3], fill: lerp(.5, .72, out), screenY: .6 });
      const [x, y] = project([0, 0, 0]);
      ov.ring(x, y, 460, { color: CYAN, progress: out });
      ov.label('a la vista', x, y + 560, { size: 64, color: CYAN, alpha: prog(t, at('vista') - .1, at('vista') + .15) });
    } });
  }

  // 8 · Un temporizador por tarea (se queda debajo del cierre de compartir).
  {
    const tm = makeTimer(), group = new THREE.Group(); group.add(tm);
    shots.push({ start: T.temp, group, update(lt, { t, ov }) {
      tm.rotation.y = -.3 + lt * .05;
      tm.userData.setDial(-lt * .35);
      fit(tm.userData.core, { dir: [-.4, .9, 1.2], fill: lerp(.6, .68, prog(lt, 0, 3)), screenY: .6 });
      const [x, y] = project([0, .3, 0]);
      ov.ring(x, y, 420, { color: CYAN, progress: prog(lt, .1, .6, ease.out) });
      ov.label('1 tarea = 1 temporizador', x, y + 500, { size: 56, color: CYAN, alpha: prog(lt, .3, .6) });
    } });
  }

  return { shots };
}
