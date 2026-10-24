// Cuerpo con Datos · ¿Cuánta proteína necesitas de verdad? — escena 3D (formato "resulta que").
// Fuentes: Morton y otros (2018), Br J Sports Med 52:376 (49 ensayos, 1.863 personas; corte 1,62 g/kg/día, IC 95 % 1,03–2,20)
// y EFSA (2012), ingesta de referencia de proteína en adultos: 0,83 g/kg/día.
export default function (api) {
  const { THREE, mat, geo, contactShadow, prog, ease, lerp, clamp, at, fit, project, rng, tex } = api;
  const GOLD = '#e9b44c', CYAN = '#6ff5df', RED = '#ff5a5a', GREY = '#9a9aa0';
  const shots = [];

  function wrap(core, sh) { const o = new THREE.Group(); o.add(core, sh); o.userData = core.userData; core.userData.core = core; return o; }
  // Etiqueta pintada en un canvas (para el bote y las pantallas).
  function labelTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------- objetos ----------
  // Bote de proteína: cuerpo negro, tapa roja, banda con la palabra PROTEÍNA.
  function makeTub() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.66, 0], [0.7, 0.05], [0.7, 1.45], [0.62, 1.52], [0.001, 1.52]].map(([r, y]) => new THREE.Vector2(r, y)), 80), mat.plastic('#1c1c20', .35));
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.705, 0.705, 0.8, 80, 1, true), new THREE.MeshStandardMaterial({
      map: labelTex(2048, 512, (c, w, h) => {
        c.fillStyle = '#f1ede4'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#e9573f'; c.fillRect(0, h * .78, w, h * .1);
        c.fillStyle = '#1c1c20'; c.font = "800 190px 'Inter Display'"; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const x of [w * .25, w * .75]) c.fillText('PROTEÍNA', x, h * .42);
      }), roughness: .5,
    }));
    band.position.y = .72; band.rotation.y = 2.15; g.add(band);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.26, 80), mat.plastic('#e9573f', .4)); lid.position.y = 1.62; g.add(lid);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = new THREE.Mesh(geo.rbox(.03, .2, .03, .01), mat.plastic('#d24a33', .4)); r.position.set(Math.sin(a) * .68, 1.62, Math.cos(a) * .68); g.add(r); }
    const sh = contactShadow(2.2, 2.2, .6); sh.position.y = -.01;
    return wrap(g, sh);
  }

  // Báscula de baño con pantalla (el texto de la pantalla se pinta en cada fotograma).
  function makeScale() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(geo.rbox(2.2, .16, 2.2, .14), mat.plastic('#f1ede4', .35)); g.add(base);
    const glass = new THREE.Mesh(geo.rbox(2.08, .04, 2.08, .02), new THREE.MeshStandardMaterial({ color: '#cfd6dd', roughness: .08, metalness: .2, transparent: true, opacity: .55 })); glass.position.y = .09; g.add(glass);
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.8, .3), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2; screen.position.set(0, .115, -.6); g.add(screen);
    g.userData.setText = (s) => {
      if (g.userData.last === s) return; g.userData.last = s;
      const x = c.getContext('2d'); x.fillStyle = '#0d1a17'; x.fillRect(0, 0, 512, 192);
      x.fillStyle = CYAN; x.font = "700 120px 'Inter Display'"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 256, 100); t.needsUpdate = true;
    };
    g.userData.setText('0,0');
    const sh = contactShadow(3, 3, .6); sh.position.y = -.08;
    return wrap(g, sh);
  }

  // Mancuerna: barra, empuñadura moleteada y discos.
  function makeDumbbell() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.4, 32), mat.metal('#c9cdd3')); bar.rotation.z = Math.PI / 2; g.add(bar);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .9, 32), mat.metal('#7d8188')); grip.rotation.z = Math.PI / 2; g.add(grip);
    for (const s of [1, -1]) {
      [[.62, .5, .14], [.8, .42, .12], [.95, .34, .1]].forEach(([x, r, w]) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 64), mat.plastic('#1c1c20', .5)); p.rotation.z = Math.PI / 2; p.position.x = s * x; g.add(p);
      });
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .08, 32), mat.metal('#c9cdd3')); col.rotation.z = Math.PI / 2; col.position.x = s * 1.05; g.add(col);
    }
    const sh = contactShadow(3.2, 1.6, .55); sh.position.y = -.5;
    return wrap(g, sh);
  }

  // Pila de folios (los 49 ensayos).
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

  // Gráfica 3D: ganancia de músculo según g/kg/día. Forma ilustrativa: sube y se aplana en 1,6 (modelo de corte de Morton 2018).
  const XMAX = 3, GX = 3.6 / XMAX, GY = 1.6; // unidades de mundo por g/kg y altura de la meseta
  const gx = (v) => -1.8 + v * GX;
  const curveY = (v) => { const k = Math.min(v, 1.62) / 1.62; return GY * (.12 + .88 * (1 - (1 - k) * (1 - k))); };
  function makeChart() {
    const g = new THREE.Group();
    const axM = mat.plastic('#3a3a40', .6);
    const xAx = new THREE.Mesh(geo.rbox(3.9, .04, .04, .015), axM); xAx.position.set(.15, 0, 0); g.add(xAx);
    const yAx = new THREE.Mesh(geo.rbox(.04, 2.1, .04, .015), axM); yAx.position.set(-1.8, 1.05, 0); g.add(yAx);
    for (let v = 0; v <= XMAX; v += .5) { const tk = new THREE.Mesh(geo.rbox(.02, v % 1 === 0 ? .14 : .08, .02, .008), axM); tk.position.set(gx(v), -.04, 0); g.add(tk); }
    const pts = []; for (let i = 0; i <= 120; i++) { const v = i / 120 * XMAX; pts.push(new THREE.Vector3(gx(v), curveY(v), 0)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, .045, 12), mat.neon(CYAN)); g.add(tube);
    const idx = tube.geometry.index.count;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.09, 32, 16), mat.neon(GOLD)); dot.position.set(gx(1.62), curveY(1.62), 0); g.add(dot);
    const drop = new THREE.Mesh(geo.rbox(.02, curveY(1.62), .02, .008), mat.neon(GOLD)); drop.position.set(gx(1.62), curveY(1.62) / 2, 0); g.add(drop);
    // franja de incertidumbre (IC 95 %: 1,03–2,20)
    const band = new THREE.Mesh(new THREE.BoxGeometry((2.2 - 1.03) * GX, 2.0, .3), mat.glass(GOLD, .28)); band.position.set(gx((1.03 + 2.2) / 2), 1.0, 0); g.add(band);
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.3, .1), mat.glass(CYAN, 0)); anchor.position.set(.15, 1.0, 0); g.add(anchor);
    g.userData = {
      anchor,
      draw(k) { tube.geometry.setDrawRange(0, Math.max(0, Math.floor(idx * k / 6) * 6)); tube.visible = k > 0; },
      dot(k) { dot.visible = k > 0; dot.scale.setScalar(Math.max(.001, k)); drop.visible = k > 0; drop.scale.y = Math.max(.001, k); drop.position.y = curveY(1.62) * k / 2; },
      band(k) { band.visible = k > 0; band.scale.x = Math.max(.001, k); },
    };
    return g;
  }

  // Coctelera (batido): vaso translúcido con líquido, tapa y boquilla.
  function makeShaker() {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.42, 0], [0.48, 0.1], [0.52, 1.5], [0.001, 1.5]].map(([r, y]) => new THREE.Vector2(r, y)), 64), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .25, roughness: .1, depthWrite: false }));
    g.add(cup);
    const milk = new THREE.Mesh(new THREE.CylinderGeometry(.48, .42, 1, 64), mat.plastic('#d9b48c', .6)); milk.position.y = .52; g.add(milk);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(.49, .48, .06, 64), mat.plastic('#efe2cf', .8)); foam.position.y = 1.05; g.add(foam);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.5, .54, .3, 64), mat.plastic('#1c1c20', .4)); lid.position.y = 1.65; g.add(lid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .22, 48), mat.plastic('#e9573f', .4)); top.position.y = 1.9; g.add(top);
    const sh = contactShadow(2, 2, .6); sh.position.y = -.01;
    return wrap(g, sh);
  }

  // ---------- planos ----------
  const T = {
    rec: at('La') - .2, pero: at('Pero') - .2, meta: at('metaanálisis') - .3, prot: at('proteína', 2) - .3,
    ojo: at('Ojo') - .15, si: at('Si') - .15,
  };

  // 1 · Gancho: el bote de proteína, «? g».
  {
    const tub = makeTub(), group = new THREE.Group(); group.add(tub);
    shots.push({ start: 0, in: 'cut', group, update(lt, { t, ov }) {
      tub.rotation.y = -.6 + lt * .35;
      fit(tub.userData.core, { dir: [-.3, .45, 1.3], fill: lerp(.58, .66, prog(lt, 0, 3)), screenY: .6 });
      const [x, y] = project([0, .8, 0]);
      ov.ring(x, y, 430, { color: GOLD, progress: prog(lt, .1, .7, ease.out) });
      ov.label('? g', x, y + 560, { color: CYAN, size: 130, weight: 800, alpha: prog(t, at('número') - .1, at('número') + .15, ease.out) });
    } });
  }

  // 2 · Recomendación general: la báscula marca 0,83 g/kg (EFSA).
  {
    const sc = makeScale(), group = new THREE.Group(); group.add(sc);
    shots.push({ start: T.rec, group, update(lt, { t, ov }) {
      sc.rotation.y = .25 + lt * .08;
      const k = prog(t, at('0,8') - .3, at('0,8') + .3, ease.out);
      sc.userData.setText((.83 * k).toFixed(2).replace('.', ','));
      fit(sc.userData.core, { dir: [0, 1.1, 1], fill: .7, screenY: .6 });
      const [x, y] = project([0, .12, -.6]);
      ov.label('g de proteína por kg', x, y - 200, { size: 54, color: '#ffffff', glowBlur: 0, alpha: prog(t, at('gramos') - .1, at('gramos') + .2) });
      ov.text('EFSA, 2012 · ingesta de referencia en adultos', 540, 1610, { size: 30, weight: 500, color: GREY, alpha: prog(lt, .4, .8) });
    } });
  }

  // 3 · «Para no quedarte corto, no para ganar músculo»: mancuerna y la cifra tachada.
  {
    const db = makeDumbbell(), group = new THREE.Group(); group.add(db);
    shots.push({ start: T.pero, group, update(lt, { t, ov }) {
      db.rotation.set(.15, -.5 + lt * .2, .08);
      fit(db.userData.core, { dir: [.2, .45, 1.3], fill: .74, screenY: .62 });
      const [x, y] = project([0, 0, 0]);
      ov.label('0,8 = lo básico', x, y - 420, { color: '#ffffff', size: 96, weight: 800, glowBlur: 0, alpha: prog(t, at('corto') - .15, at('corto') + .15, ease.out) });
      const m = prog(t, at('músculo') - .1, at('músculo') + .25, ease.out);
      ov.label('para ganar músculo: ¿?', x, y + 420, { color: RED, size: 64, alpha: m });
      ov.ring(x, y, 520, { color: RED, progress: m, alpha: m });
    } });
  }

  // 4 · 49 ensayos: los folios se apilan y cuenta el número; fuente visible.
  {
    const st = makeStack(49), group = new THREE.Group(); group.add(st);
    shots.push({ start: T.meta, group, update(lt, { t, ov }) {
      st.rotation.y = .6 + lt * .15;
      const c = st.userData.show(prog(t, at('juntó') - .1, at('49') + .5, ease.out));
      fit(st.userData.core, { dir: [-.8, .9, 1.2], fill: .56, screenY: .64 });
      const [x, y] = project([0, .85, 0]);
      if (c > 0) ov.label(String(c), x, y - 260, { color: GOLD, size: 200, weight: 800 });
      ov.text('ensayos · 1.863 personas', x, y - 120, { size: 50, weight: 600, alpha: c > 0 ? 1 : 0 });
      ov.text('entrenamiento de fuerza', x, y + 480, { size: 50, weight: 600, color: CYAN, alpha: prog(t, at('fuerza') - .1, at('fuerza') + .2) });
      ov.text('Morton y otros · Br J Sports Med, 2018 (metaanálisis)', 540, 1610, { size: 30, weight: 500, color: GREY, alpha: prog(lt, .4, .8) });
    } });
  }

  // 5 y 6 · La curva sube y se aplana en 1,6; después, franja de incertidumbre 1–2,2.
  const chart = makeChart();
  function chartShot(start, withBand) {
    const group = new THREE.Group(), ch = withBand ? makeChart() : chart; group.add(ch);
    shots.push({ start, group, update(lt, { t, ov }) {
      ch.rotation.y = withBand ? -.18 + lt * .03 : -.28 + lt * .04;
      const draw = withBand ? 1 : prog(t, at('suma') - .2, at('aplana') + .2, ease.inOut);
      ch.userData.draw(draw);
      const d = withBand ? 1 : prog(t, at('1,6') - .1, at('1,6') + .3, ease.out);
      ch.userData.dot(d);
      const b = withBand ? prog(t, at('1') - .1, at('2,2') + .2, ease.inOut) : 0;
      ch.userData.band(b);
      fit(ch.userData.anchor, { dir: [0, .1, 1], fill: .92, screenY: .58 });
      const [x0, y0] = project([gx(0), 0, 0]), [xd, yd] = project([gx(1.62), curveY(1.62), 0]), [xe, ye] = project([gx(XMAX), 0, 0]);
      ov.text('g de proteína por kg al día', xe, ye + 140, { size: 38, weight: 600, color: GREY, align: 'right' });
      ov.text('músculo ganado', x0, project([gx(0), 2.15, 0])[1] - 30, { size: 38, weight: 600, color: GREY, align: 'left' });
      for (const v of [0, 1, 2, 3]) { const [vx, vy] = project([gx(v), 0, 0]); ov.text(String(v), vx, vy + 70, { size: 36, weight: 600, color: GREY }); }
      ov.label('1,6', xd, yd - 110, { color: GOLD, size: 110, weight: 800, alpha: d });
      if (!withBand) {
        const fl = prog(t, at('aplana') - .1, at('aplana') + .3, ease.out);
        const [xp, yp] = project([gx(2.6), curveY(2.6), 0]);
        ov.label('se aplana', xp, yp - 120, { color: CYAN, size: 60, alpha: fl });
      } else {
        const [xa] = project([gx(1.03), 0, 0]), [xb] = project([gx(2.2), 0, 0]);
        ov.line([[xa, y0 + 140], [xb, y0 + 140]], { color: GOLD, width: 6, progress: b, alpha: b });
        ov.label('entre 1 y 2,2', (xa + xb) / 2, y0 + 220, { color: GOLD, size: 64, alpha: prog(t, at('2,2') - .1, at('2,2') + .2) });
        ov.text('Morton 2018 · IC 95 %: 1,03–2,20 g/kg', 540, 1610, { size: 30, weight: 500, color: GREY, alpha: prog(lt, .3, .7) });
      }
    } });
  }
  chartShot(T.prot, false);
  chartShot(T.ojo, true);

  // 7 · Ejemplo: 70 kg × 1,6 = 112 g. La báscula cuenta.
  {
    const sc = makeScale(), group = new THREE.Group(); group.add(sc);
    shots.push({ start: T.si, group, update(lt, { t, ov }) {
      sc.rotation.y = -.25 + lt * .08;
      const k = prog(t, at('70') - .3, at('70') + .3, ease.out);
      sc.userData.setText(String(Math.round(70 * k)) + ' kg');
      fit(sc.userData.core, { dir: [0, 1.1, 1], fill: .7, screenY: .62 });
      const [x, y] = project([0, .12, -.6]);
      const g = prog(t, at('112') - .3, at('112') + .3, ease.out);
      ov.text('70 × 1,6', x, y - 230, { size: 70, weight: 700, color: '#ffffff', alpha: prog(t, at('70') + .1, at('70') + .4) });
      if (g > 0) ov.label(`${Math.round(112 * g)} g`, x, y + 520, { color: GOLD, size: 170, weight: 800 });
      ov.text('de proteína al día', x, y + 640, { size: 50, weight: 600, alpha: prog(t, at('día', 2) - .1, at('día', 2) + .2) });
    } });
  }

  // 8 · Cierre: la coctelera, debajo del «envíaselo».
  {
    const sk = makeShaker(), group = new THREE.Group(); group.add(sk);
    shots.push({ start: api.timeline.outro.start - .1, group, update(lt) {
      sk.rotation.y = lt * .4; sk.rotation.z = Math.sin(lt * 9) * .06 * (1 - prog(lt, .6, 1.2));
      fit(sk.userData.core, { dir: [-.3, .35, 1.3], fill: .52, screenY: .6 });
    } });
  }

  return { shots };
}
