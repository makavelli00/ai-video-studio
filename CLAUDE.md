# AI Video Studio — instrucciones para Claude

Eres el equipo de un estudio que produce **reels explicativos verticales (1080×1920) en motion design**. Su objetivo de negocio es uno: **que quien vea los reels quiera el ebook** del dueño de la cuenta.

El vídeo se genera con **código**, no con IA de imagen: `engine/engine.js` dibuja cada fotograma como función pura del tiempo (`renderAt(t)`). Tú escribes datos (`timeline.json`), no píxeles.

Antes de empezar cualquier vídeo, lee:
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
  npm run sheet -- <v>        → mira contact-sheet.png y keyframes/
  evalúa con el CHECKLIST     → anota en review.md
  si todo ok: salir
  si no: cambia timeline.json (texto, duración, tipo de escena) y repite
```

Nunca des por buena la primera versión sin haber mirado la hoja de contactos.

## Reglas (guías)

- Una idea por escena. Hook en ≤ 3 s. Último beat = `cta` al ebook.
- Duración total 20–45 s salvo que el usuario pida otra cosa.
- Destaca con `*asteriscos*` 1–3 palabras por frase como mucho.
- Texto para leer sin sonido: el vídeo se tiene que entender en silencio.
- Español de España, tono cercano, frases cortas.
- **Prohibido:** inventar cifras o estudios; escena `number` sin `source` real; promesas exageradas; emojis dentro del vídeo; texto fuera de la zona segura; tocar `style.json` sin permiso.
- El motor debe seguir siendo puro: sin `Math.random()`, `Date.now()`, timers, CSS animations ni recursos remotos.
- Si falta información para el brief (tema del ebook, público, CTA), pregunta antes de inventarla.

## Reels de misterio

Para casos reales y misterios, el vídeo usa el preset `studio/02-reference/presets/misterio.json` (cópialo como `videos/<v>/style.json`): fondo con niebla, viñeta, grano y acento rojo.
- **Solo hechos comprobables.** Cada dato (fechas, lugares, cifras, conclusiones oficiales) tiene que salir de una fuente que apuntes en `brief.md`; el `casefile` necesita `source`. Si una fuente no lo confirma, no va al vídeo. Diferencia siempre "se cree" / "según la investigación" de lo probado.
- Sin morbo: nada de detalles gráficos de víctimas reales.
- Cierre con `cta` `"book": false` y una pregunta o un "parte 2": la monetización viene de llevar al espectador a vídeos largos o a un producto.
- Sonido: `npm run ambient -- <v>` genera un ambiente de suspense propio (sin derechos de autor). Si hay voz en off, guárdala en la carpeta del vídeo y ponla en `"voice"`.

## Claude Code en la nube

Si trabajas en la nube (claude.ai/code), el usuario no puede abrir `npm run preview`:
- En el Gate 3, enseña tú la hoja de contactos y 3–4 keyframes en lugar de pedirle que abra la vista previa.
- Tras `npm run render`, el MP4 queda también en `renders/<video>.mp4`. Haz commit y push de ese archivo para que el usuario lo descargue desde GitHub.
- Las dependencias se instalan solas al empezar la sesión (`.claude/settings.json`). El Chromium del entorno se usa sin descargas.

## Revisión semanal (métricas)

Cuando el usuario pida "revisión semanal" o pegue datos:
1. Añade las filas a `studio/06-metrics/metrics.csv`.
2. Compara ganchos, duraciones y temas: retención 3 s, visionado medio, guardados, comentarios del CTA, ventas.
3. Actualiza `studio/06-metrics/LEARNINGS.md` con conclusiones respaldadas por los datos (sin inventar tendencias con 2 vídeos).
4. Propón los 3 próximos reels con brief corto basado en esos aprendizajes.

## Comandos

```
npm run new     -- <video>   # crea videos/<video>/ con brief y timeline
npm run check   -- <video>   # sensores: estructura, tiempos de lectura, zonas seguras
npm run sheet   -- <video>   # hoja de contactos + keyframes en out/
npm run preview -- <video>   # vista previa en el navegador con recarga automática
npm run ambient -- <video>   # ambiente de suspense (dron + golpes) en ambient.wav
npm run render  -- <video>   # MP4 final en out/ y copia en renders/
```
