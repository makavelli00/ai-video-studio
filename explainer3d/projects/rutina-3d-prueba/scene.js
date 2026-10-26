// Prueba de formato "rutina con personaje 3D" (ref. de gramática: @bluebro.fit) — Cuerpo con Datos
// Personaje y animación de Mixamo (assets/*.fbx, fuera de git). La animación se muestrea con setTime(t): puro en t.
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export default async function (api) {
  const { THREE, contactShadow, prog, ease, clamp, timeline } = api;
  const INK = '#15181d', RED = '#d6362b', GREEN = '#2fa35a', SOFT = '#e7e3da';
  const BODY = new THREE.Color('#3b4250');

  const loader = new FBXLoader();
  const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const anim = await load('/project/assets/air-squat.fbx');

  // un solo material propio: el personaje deja de ser "el de Mixamo" y pasa a ser la figura del canal
  const skin = new THREE.MeshPhysicalMaterial({ color: BODY, roughness: .38, metalness: .05, clearcoat: .5, clearcoatRoughness: .3, sheen: .4, sheenColor: new THREE.Color('#9aa6b8') });
  anim.traverse(o => { if (o.isMesh) { o.material = skin; o.frustumCulled = false; } });
  anim.scale.setScalar(.01); // Mixamo trabaja en cm

  const clip = anim.animations[0];
  const mixer = new THREE.AnimationMixer(anim);
  mixer.clipAction(clip).play();
  const REP = clip.duration;

  const g = new THREE.Group();
  g.add(anim);
  const sh = contactShadow(1.1, 1.1, .3); sh.position.y = .001; g.add(sh);
  g.rotation.y = -.55;

  const reps = timeline.reps || 2;
  const dur = REP * reps;
  const EX = ['Sentadilla', 'Zancada', 'Peso muerto rumano', 'Extensión', 'Curl femoral', 'Gemelo'];

  return {
    shots: [{
      start: 0, end: dur, group: g, in: 'none', out: 'none',
      background: { bg: '#f5f3ee', grid: false, glow: { a: 0 }, particles: false },
      update(lt, { ov }) {
        mixer.setTime(lt % REP);
        api.cam([0, 1.5, 5.9], [0, 1.32, 0], 30);
        const c = ov.ctx;
        // marca
        ov.text('CUERPO CON DATOS', 90, 150, { color: INK, size: 30, weight: 800, align: 'left' });
        c.fillStyle = RED; c.fillRect(90, 175, 64, 6);
        // titular fijo
        ov.text('La rutina de pierna', 540, 300, { color: INK, size: 72, weight: 800 });
        // fila de progreso: 6 ejercicios, el actual en rojo, se marca con check al final de la serie
        const n = 6, w = 120, gap = 22, x0 = 540 - (n * w + (n - 1) * gap) / 2, y0 = 380;
        c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x0 - 20, y0 - 18, n * w + (n - 1) * gap + 40, w + 36, 26); c.fill();
        const done = prog(lt, dur - .7, dur - .35, ease.outBack);
        for (let i = 0; i < n; i++) {
          const x = x0 + i * (w + gap);
          c.fillStyle = i === 0 ? '#fbe3e0' : SOFT; c.beginPath(); c.roundRect(x, y0, w, w, 20); c.fill();
          if (i === 0) { c.strokeStyle = RED; c.lineWidth = 5; c.stroke(); }
          ov.text(String(i + 1), x + w / 2, y0 + w / 2, { color: i === 0 ? RED : '#a6a29a', size: 54, weight: 800 });
          if (i === 0 && done > 0) {
            const cx = x + w - 12, cy = y0 + w - 12, r = 26 * clamp(done, 0, 1.2);
            c.fillStyle = GREEN; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
            c.beginPath(); c.moveTo(cx - r * .45, cy); c.lineTo(cx - r * .1, cy + r * .35); c.lineTo(cx + r * .45, cy - r * .35); c.stroke();
          }
        }
        // ejercicio actual
        ov.text(EX[0], 540, 600, { color: INK, size: 60, weight: 800 });
        ov.text('Ejercicio 1 de 6', 540, 668, { color: '#7d7a73', size: 34, weight: 600 });
      },
    }],
  };
}
