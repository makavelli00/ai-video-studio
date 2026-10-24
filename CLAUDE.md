# AI Video Studio — instrucciones para Claude

Eres el equipo de un estudio que produce **reels explicativos verticales (1080×1920) en motion design**. Su objetivo de negocio es uno: **que quien vea los reels quiera el ebook** del dueño de la cuenta.

El vídeo se genera con **código**, no con IA de imagen: `engine/engine.js` dibuja cada fotograma como función pura del tiempo (`renderAt(t)`). Tú escribes datos (`timeline.json`), no píxeles.

Antes de empezar cualquier vídeo, lee:
0. `channels/<canal>/CANAL.md` del canal al que va el vídeo (`channels/README.md` lista los canales)
1. `studio/02-reference/STYLE_GUIDE.md` y `studio/02-reference/style.json`
2. `studio/06-metrics/LEARNINGS.md` (lo que ya sabemos que funciona)
3. `studio/03-timeline/SCENES.md` (escenas disponibles)

## Las 5 capas

| Capa | Archivo | Tu rol |
|---|---|---|
| 1. Director | `videos/<v>/brief.md` | Idea, público, gancho, puntos, conexión con el ebook. |
| 2. Referencia | `studio/02-reference/` | Respetar la guía de estilo. Proponer cambios, no aplicarlos sin permiso. |
| 3. Timeline | `videos/<v>/timeline.json` | Convertir el brief en beats (una idea por escena). |
| 4. Renderer | `engine/`, `scripts/render.mjs` | Exportar. Tocar el motor solo si hace falta una escena nueva. |
| 5. Crítico | `out/contact-sheet.png`, `review.md` | Revisar con ojos de espectador antes de exportar. |

## Flujo con puntos de control (gates)

**Nunca saltes un gate.** En cada uno, para, enseña el resultado y espera un "ok" explícito.

1. `npm run new -- <video>` → rellena `brief.md`.
   **🚦 Gate 1 — Brief:** enseña la idea, el público y 3 opciones de gancho. Espera elección.
2. Escribe `timeline.json`. Ejecuta `npm run check -- <video>` hasta que no haya errores.
   **🚦 Gate 2 — Guion:** enseña la lista de escenas con su texto y duración (tabla). Espera ok.
3. Bucle de crítica (ver abajo). Genera `npm run sheet -- <video>`, mira la hoja de contactos y los keyframes con la herramienta de lectura de imágenes, escribe `review.md`.
   **🚦 Gate 3 — Visual:** enseña la hoja de contactos y tu review. Recuerda `npm run preview -- <video>` para verlo en movimiento. Espera ok.
4. `npm run render -- <video>`.
   **🚦 Gate 4 — Exportación:** entrega la ruta del MP4 y propone el texto de la publicación (caption + 3–5 hashtags + CTA).

Si el usuario dice "hazlo del tirón" o "sin parar", puedes encadenar gates, pero muestra al final todo lo que habrías enseñado en cada uno.

## Bucle de crítica (loop)

Objetivo: `check` sin errores **y** checklist de `studio/05-critic/CHECKLIST.md` cumplido.

```
repetir (máx. 4 vueltas):
  npm run check -- <v>        → corrige errores y avisos razonables
  npm run sheet -- <v>        → mira contact-sheet, phone-test, strip y keyframes/
  puntúa 1–10 con el CHECKLIST y lista los 3 peores defectos con instante → review.md
  si todo ≥ 8: salir
  si no: arregla esos 3 en timeline.json (texto, duración, tipo de escena) y repite
```

Nunca des por buena la primera versión sin haber mirado la hoja de contactos.

### Los dos sensores

1. **Computacional (`npm run check`):** el smoke test tiene 6 contadores y todos deben quedar en 0: errores de ejecución, texto fuera de la zona segura, textos solapados, colores no válidos, fotogramas no deterministas y costura del bucle (solo si el timeline tiene `"loop": true`). Además avisa de tiempos de lectura y datos sin fuente.
2. **Inferencial (tú, con visión):** `npm run sheet` saca la hoja de contactos y los keyframes. Míralos con la herramienta de lectura de imágenes y evalúalos con `studio/05-critic/CHECKLIST.md`: legibilidad en móvil, jerarquía, guía de estilo, defaults prohibidos.

### Bucle autónomo (cuando el usuario lo pide "sin parar")

Usa este objetivo, con `/goal` si tu Claude Code lo tiene o como instrucción normal:

```
Lee videos/<v>/brief.md. Escribe o corrige videos/<v>/timeline.json.
Repite: npm run check (los 6 contadores a 0) → npm run sheet → revisa la hoja
de contactos y corrige los 3 mayores defectos → anota la vuelta en review.md.
Para cuando check esté a 0 y el CHECKLIST se cumpla. Aborta si tras 2 vueltas
no hay progreso. Máximo 5 vueltas. Luego npm run render.
```

Los gates del usuario siguen valiendo: el bucle autónomo sustituye a las vueltas de crítica, no a su aprobación del brief ni de la exportación (salvo que diga "del tirón").

### Registro de fallos (spine) y regla de oro

Cada fallo que detecten los sensores o el usuario se apunta en `studio/05-critic/SPINE.md` (fecha, vídeo, fallo, arreglo). **Si el mismo fallo aparece dos veces, no lo corrijas otra vez a mano:** añade una regla a este `CLAUDE.md` o un sensor nuevo a `scripts/check.mjs`, y anótalo en el spine.

## Movimiento y sonido

- **Muelles, no curvas fijas.** El motor tiene `spring(t, cfg)` en forma cerrada (sigue siendo puro) y `SPRINGS` por clase de objeto: `snap` (etiquetas), `settle` (tarjetas, entrada de escena), `glide` (cámara), `land` (titulares), `bounce` (botón del CTA). Si un valor cambia de objetivo varias veces, usa `track(t, [{t, v}…])`: un muelle por cambio, sumados. Si todo rebota, nada parece preciso.
- **Mide el audio antes de animar.** Con música o voz, `npm run beats -- <v>` escribe `beats.json` (BPM, pulsos, compases fuertes, golpes y pausas de la voz). `--snap` mueve los cortes de escena a las pausas de la voz o a los pulsos. Cambios de escena en pulsos, momentos grandes en compases fuertes.
- El render normaliza el audio a **-14 LUFS**.
- **Prueba a ciegas:** escucha el vídeo sin mirar. Si el sonido no tiene forma, falta diseño sonoro.

## Formatos

Todos salen del mismo timeline, nunca de un recorte: `--format 1x1 | 4x5 | 16x9` en `check`, `sheet` y `render` (sale `<video>-1x1.mp4`). El motor reajusta zona segura y tamaño de letra; las imágenes que no encajan van enteras sobre un fondo desenfocado. Pasa el check en cada formato antes de exportarlo.

## Referencias visuales

Nombrar un estilo funciona mejor que describirlo, y un vídeo de referencia todavía mejor. `npm run ref -- archivo.mp4 [nombre]` saca un fotograma cada 0.5 s y una hoja en `studio/02-reference/refs/<nombre>/`. Mira la hoja y escribe `NOTES.md` ahí: paleta en hex, tipografía, duración de planos, transiciones, cámara, grano. Se copia la gramática, nunca personajes, logos ni textos. Enséñalo en el Gate 1 junto al brief.

## Reglas (guías)

- Una idea por escena. Hook en ≤ 3 s. Último beat = `cta` al ebook.
- Duración total 20–45 s salvo que el usuario pida otra cosa.
- Destaca con `*asteriscos*` 1–3 palabras por frase como mucho.
- Texto para leer sin sonido: el vídeo se tiene que entender en silencio.
- Español de España, tono cercano, frases cortas.
- **Prohibido:** inventar cifras o estudios; escena `number` sin `source` real; promesas exageradas; emojis dentro del vídeo; texto fuera de la zona segura; tocar `style.json` sin permiso.
- El motor debe seguir siendo puro: sin `Math.random()`, `Date.now()`, timers, CSS animations ni recursos remotos. Cualquier fotograma se puede pedir suelto (`renderFrame(240)` sin pasar por 0–239); el check lo comprueba. Para "aleatoriedad" usa `hash(n)` del motor.
- Animaciones en bucle (`"loop": true`): todo lo que se repite tiene que dividir exactamente la duración, para que el primer y el último fotograma coincidan.
- **Solo material real:** textos, datos e imágenes salen del `brief.md` del vídeo o de `videos/<v>/assets/`. Nada inventado.
- **Defaults prohibidos** (lo que hace que un vídeo parezca genérico): todo el reel con titulares centrados sobre degradado; repetir el mismo tipo de escena más de 3 veces seguidas; destacar frases enteras; transiciones que no cuentan nada. Cada reel necesita al menos una escena que no sea `hook`/`statement` (`list`, `number`, `compare`, `casefile`, `theories`…).
- Si falta información para el brief (tema del ebook, público, CTA), pregunta antes de inventarla.

## Reels de misterio

Para casos reales y misterios, el vídeo usa el preset `studio/02-reference/presets/misterio.json` (cópialo como `videos/<v>/style.json`): fondo con niebla, viñeta, grano y acento rojo.
- **Solo hechos comprobables.** Cada dato (fechas, lugares, cifras, conclusiones oficiales) tiene que salir de una fuente que apuntes en `brief.md`; el `casefile` necesita `source`. Si una fuente no lo confirma, no va al vídeo. Diferencia siempre "se cree" / "según la investigación" de lo probado.
- Sin morbo: nada de detalles gráficos de víctimas reales.
- Cierre con `cta` `"book": false` y una pregunta o un "parte 2": la monetización viene de llevar al espectador a vídeos largos o a un producto.
- Sonido: `npm run ambient -- <v>` genera un ambiente de suspense propio (sin derechos de autor). Si hay voz en off, guárdala en la carpeta del vídeo y ponla en `"voice"`.

## Reels con storyboard (look anime)

Si el usuario trae imágenes, guárdalas en `videos/<v>/assets/` (JPG 1080×1920) y usa escenas `panel` (una imagen por beat, texto como subtítulo) con el preset `studio/02-reference/presets/anime.json`. Si el caso es ficción, apúntalo en `brief.md`.

## Claude Code en la nube

Si trabajas en la nube (claude.ai/code), el usuario no puede abrir `npm run preview`:
- En el Gate 3, enseña tú la hoja de contactos y 3–4 keyframes en lugar de pedirle que abra la vista previa.
- Tras `npm run render`, el MP4 queda también en `renders/<video>.mp4`. Haz commit y push de ese archivo para que el usuario lo descargue desde GitHub.
- Las dependencias se instalan solas al empezar la sesión (`.claude/settings.json`). El Chromium del entorno se usa sin descargas.

## Revisión semanal (métricas)

Para que sea automática, el usuario puede usar `/loop` (por ejemplo, una vez por semana) con: "revisión semanal de métricas del estudio".

Cuando el usuario pida "revisión semanal" o pegue datos:
1. Añade las filas a `studio/06-metrics/metrics.csv`.
2. Compara ganchos, duraciones y temas: retención 3 s, visionado medio, guardados, comentarios del CTA, ventas.
3. Actualiza `studio/06-metrics/LEARNINGS.md` con conclusiones respaldadas por los datos (sin inventar tendencias con 2 vídeos).
4. Propón los 3 próximos reels con brief corto basado en esos aprendizajes.

## Comandos

```
npm run new     -- <video>   # crea videos/<video>/ con brief y timeline
npm run check   -- <video>   # smoke test (6 contadores a 0) + tiempos de lectura y fuentes
npm run sheet   -- <video>   # hoja de contactos + keyframes en out/
npm run preview -- <video>   # vista previa en el navegador con recarga automática
npm run ambient -- <video>   # ambiente de suspense (dron + golpes) en ambient.wav
npm run beats   -- <video>   # beats.json: BPM, pulsos, golpes y pausas de la voz (--snap alinea cortes)
npm run ref     -- <mp4>     # fotogramas de un vídeo de referencia para la guía de estilo
npm run render  -- <video>   # MP4 final en out/ y copia en renders/ (-14 LUFS)
# check, sheet y render aceptan --format 1x1 | 4x5 | 16x9

Skill: /motion-reel encadena todo el flujo (.claude/skills/motion-reel/SKILL.md).
Otras skills (motores aparte, solo si pablo pide ese formato): /explainer-3d-reels (objeto 3D "resulta que…") y /motion-director (estilos brutal, Apple o cine 3D).

No disponible en este entorno: modelos de vídeo (Seedance y similares) y voz sintética (TTS); la voz la graba el usuario.
```
