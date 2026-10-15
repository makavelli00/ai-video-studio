---
name: motion-reel
description: Produce un reel vertical del estudio de principio a fin (brief, timeline, crítica, render) con los gates de CLAUDE.md. Úsala cuando pidan "/motion-reel", "haz un reel de…" o un vídeo nuevo con guion, tema, imágenes o referencia.
---

# /motion-reel

Uso: `/motion-reel <tema o guion> [, 30s] [, imágenes adjuntas] [, referencia ./ruta.mp4] [, formatos 9x16,1x1] [, del tirón]`

Todo lo que no diga el usuario sale de CLAUDE.md, `studio/02-reference/` y `studio/06-metrics/LEARNINGS.md`. Si falta algo que cambia el vídeo (tema, público, CTA), pregunta una vez y sigue con lo demás.

## Pasos

1. **Preparar.** `npm run new -- <slug>`. Elige preset: `misterio.json` (casos reales), `anime.json` (storyboard de imágenes), `explicativo.json` (infografía oscura con letra mono, verde contra rosa; sale de `refs/1bit1pixel/NOTES.md`) o el estilo base. Cópialo a `videos/<slug>/style.json`. Imágenes del usuario → `assets/` en JPG 1080×1920. Con vídeo de referencia: `npm run ref -- <mp4> <slug>`, mira `sheet.jpg` y escribe `NOTES.md`.
2. **Brief.** Rellena `brief.md` (idea, público, material, referencia, línea roja, duración y formatos, fuentes). En casos reales, cada dato con fuente; si no hay fuente, no sale.
   🚦 Gate 1: idea, público y 3 ganchos.
3. **Timeline.** Escribe `timeline.json` (una idea por escena, hook ≤ 3 s, cierre `cta`). Si hay música o voz: `npm run beats -- <slug> --snap`. Repite `npm run check -- <slug>` hasta 0 errores.
   🚦 Gate 2: tabla de escenas con texto y duración.
4. **Crítica.** `npm run sheet -- <slug>`; mira `contact-sheet`, `phone-test`, `strip` y `keyframes/` con la herramienta de imágenes. Puntúa 1–10 con `studio/05-critic/CHECKLIST.md`, apunta en `review.md` los 3 peores defectos con instante y arreglo, arréglalos y repite hasta que todo esté en 8 o más (máx. 4 vueltas). Fallos → `studio/05-critic/SPINE.md`.
   🚦 Gate 3: hoja de contactos, 3–4 keyframes y la review.
5. **Exportar.** Sonido: `npm run ambient -- <slug>` si no hay pista. `npm run render -- <slug>`; por cada formato extra, `check` y `render` con `--format`.
   🚦 Gate 4: ruta del MP4 y texto de la publicación (caption, 3–5 hashtags, CTA).
6. **Entregar.** En la nube: commit y push de `renders/<slug>*.mp4` y del vídeo; si hay carpeta compartida del proyecto, copia el MP4 ahí.

Con "del tirón" se encadenan los gates, pero al final se enseña todo lo de cada uno.
