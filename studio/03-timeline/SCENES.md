# Capa 3 · Timeline — escenas disponibles

La historia se escribe como una lista de estados en `videos/<video>/timeline.json`. Cada escena es **un beat**: una idea, un cambio visual.

Patrón base de un reel explicativo:

```
hook → problema/error → explicación → (comparación | lista | número) → cta
```

Usa `*asteriscos*` para destacar palabras con el color de acento.

| type | Campos | Para qué |
|---|---|---|
| `hook` | `text`, `sub?`, `size?` | Gancho de apertura. ≤ 12 palabras. ≤ 3.5 s. |
| `statement` | `text`, `kicker?`, `note?`, `size?` | Una afirmación, un error, un paso. `kicker` = etiqueta ("Error 1"). |
| `list` | `items[]`, `title?`, `itemSize?`, `itemDelay?` | 2–5 puntos que aparecen uno a uno. |
| `number` | `value`, `prefix?`, `suffix?`, `decimals?`, `label?`, `source` | Cifra que cuenta hacia arriba. **`source` obligatorio** si es un dato. |
| `compare` | `left{label,text}`, `right{label,text}`, `title?`, `secondDelay?` | Antes / después, mal / bien. |
| `cta` | `text`, `button?`, `sub?` | Cierre con la portada del ebook (título en `style.json`). |

Campos globales del timeline: `title`, `fps` (30), `width` (1080), `height` (1920), `audio?` (archivo en la carpeta del vídeo), `audioVolume?`.

## Duraciones orientativas
- Tiempo de lectura: ~3.3 palabras/segundo + 0.8 s de margen. El check avisa si falta tiempo.
- hook 2.5–3.2 s · statement 3–4.5 s · list 4–6 s · compare 4–5.5 s · cta 3.5–4.5 s.

## Añadir un tipo de escena nuevo
1. Añade una función en `SCENES` dentro de `engine/engine.js`. Recibe `(escena, tiempoLocal, duración)`.
2. Debe ser **pura**: solo depende de `t`. Sin `Math.random()`, `Date.now()`, timers ni imágenes remotas.
3. Usa `drawRich`/`pill` para el texto (así el check controla las zonas seguras).
4. Añade el tipo a `SCENE_TYPES` y sus reglas a `scripts/check.mjs`.
5. Documenta la escena en esta tabla.
