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
| `cta` | `text`, `button?`, `sub?`, `book?` | Cierre con la portada del ebook (título en `style.json`). Con `"book": false`, cierre sin portada (seguir / parte 2). |
| `casefile` | `rows[{k,v,hl?}]`, `title?`, `stamp?`, `cps?`, `source` | Ficha de expediente en papel, datos a máquina y sello final. Para misterios. |
| `theories` | `items[{text, ruled?}]`, `title?`, `ruleAt?` | Teorías que aparecen una a una; las `ruled: true` se tachan. |
| `ficha` | `bar`, `label?`, `data`, `viz?` | Solo con el look `editorial`. Un beat de la ficha científica: frase en la barra roja, etiqueta mono, dibujo y línea DATA con la fuente. Ver abajo. |
| `panel` | `image`, `text`, `kicker?`, `note?`, `pos?` (`"top"`), `size?` | Imagen a pantalla completa con el texto como subtítulo abajo (o arriba). Para storyboards. |

Campos globales del timeline: `title`, `fps` (30), `width` (1080), `height` (1920), `audio?` (música o ambiente, archivo en la carpeta del vídeo), `audioVolume?`, `voice?` (voz en off; la música baja sola mientras se habla), `voiceVolume?`. En cada escena: `image` (archivo de `assets/`, a pantalla completa con movimiento de cámara; `move`: `in`/`out`/`left`/`right`/`up`; `dim` oscurece), y con el look `anime`, `impact: true` (líneas de impacto) y `kanji` (kanji vertical decorativo). `"hit": false` quita el golpe de sonido de `npm run ambient` en ese cambio.

Patrón de un reel de misterio (`style.json` con `"look": "mystery"`, ver `studio/02-reference/presets/misterio.json`):

```
hook → casefile → pistas (statement con kicker "Pista 1"...) → theories → giro → cta con book:false (parte 2)
```

Look anime (`studio/02-reference/presets/anime.json`): negro, rojo, trama manga, marco de viñeta y corte diagonal entre escenas. Pensado para storyboards de imágenes con `panel`.

## Movimiento
Las entradas usan muelles en forma cerrada (`spring`, `SPRINGS` en `engine/engine.js`): titulares `land`, etiquetas `snap`, tarjetas y escenas `settle`, botón `bounce`. Para un valor con varios objetivos (un cursor, un ancho que cambia), `track(t, [{t, v}, …])`.

Para alinear con música o voz: `npm run beats -- <video> [--snap]` (ver `beats.json`).

## Duraciones orientativas
- Tiempo de lectura: ~3.3 palabras/segundo + 0.8 s de margen. El check avisa si falta tiempo.
- hook 2.5–3.2 s · statement 3–4.5 s · list 4–6 s · compare 4–5.5 s · cta 3.5–4.5 s.

## Añadir un tipo de escena nuevo
1. Añade una función en `SCENES` dentro de `engine/engine.js`. Recibe `(escena, tiempoLocal, duración)`.
2. Debe ser **pura**: solo depende de `t`. Sin `Math.random()`, `Date.now()`, timers ni imágenes remotas.
3. Usa `drawRich`/`pill` para el texto (así el check controla las zonas seguras).
4. Añade el tipo a `SCENE_TYPES` y sus reglas a `scripts/check.mjs`.
5. Documenta la escena en esta tabla.

Look editorial (`studio/02-reference/presets/editorial.json`, referencia en las notas de @dr.williamwallace): ficha blanca sin cortes. En el timeline van `category` (etiqueta mono de arriba), `headline` (titular serif fijo todo el vídeo, hace de gancho; `*palabras*` en rojo) y `headlineSize?` (84). Todas las escenas son `ficha` salvo el `cta` final, que se dibuja como un beat más con su botón.

Dibujos fijos: `"figures": [{move, label, hl?}]` en el timeline los deja en una columna a la izquierda todo el vídeo (no cortan entre beats); el `viz` de cada beat va a su lado. Un beat puede cambiar lo que sale en rojo con `"fig": [{hl}, …]`.

`viz` de una `ficha` (`kind` + campos). En la barra, `*palabras*` salen en caja blanca; para que una frase destacada no se parta, une sus palabras con espacio duro (U+00A0). Si dos beats seguidos tienen el mismo `viz.id`, el dibujo no se vuelve a montar: se queda y solo cambia lo nuevo (colores, banda).

| kind | Campos | Para qué |
|---|---|---|
| `counter` | `value`, `from?`, `prefix?`, `suffix?`, `decimals?`, `caption?`, `sub?`, `dim?` | Cifra grande en serif que cuenta. |
| `bars` | `items[{label, value, text?, sub?, hl?}]`, `max?`, `caption?` | Barras verticales; `hl` en rojo, el resto en beige. |
| `curve` | `points[[x,y]]`, `x[min,max]`, `y[min,max]`, `xTicks[]`, `yLabel?`, `band{from,to,label}?` | Curva que se dibuja y banda que marca una zona. Si la forma es aproximada, dilo en `data` ("curva ilustrativa"). |
| `compare` | `items[{label, value, caption?, dim?, win?}]` | 2–3 columnas enfrentadas con etiqueta negra. Las cifras cuentan desde 0; `win` mete la ganadora en una caja roja. |
| `exercise` | `items[{label, move, hl?, caption?}]`, `period?` | Dibujo del ejercicio haciendo repeticiones (vista lateral). `move`: `prensa` o `extension`. `hl`: músculos en rojo (`cuadriceps`, `gluteo`; por defecto el cuádriceps). |
| `rows` | `items[{stats[{value, caption?, dim?, win?}]}]`, `size?` | Con `figures` en el timeline: una fila por dibujo fijo, con sus cifras al lado. |
| `agebar` | `items[{label, hold?[a,b], drop?, dropLabel?, fast?, new?}]`, `x?[min,max]`, `ticks?`, `focus?` | Regla de edad: una fila por capacidad, tramo negro (en su mejor momento) y rojo desde que baja (más grueso desde `fast`). `new` dibuja la fila en ese beat; `focus` apaga las demás. Con `pts[[edad, nivel 0–1]]` la fila es una curva que sube y baja mientras un cursor barre la edad (`sweep` s, `yMin`): pon «curva ilustrativa» en `data` si la forma no sale tal cual del estudio. |
| `lines` | `series[{label, pts[[x,y]], color?}]`, `x`, `y`, `xTicks?`, `yTicks?`, `yLabel?`, `unit?`, `at[desde,hasta]`, `sweep?`, `bands?[{series, lo, hi}]`, `refs?[{series, y, label}]`, `focus?` | Gráfico de líneas con datos reales (p. ej. kg por edad): las líneas avanzan con un cursor de `at[0]` a `at[1]`, con la cifra de cada serie junto al punto y la edad grande arriba. `bands` sombrea percentiles; `refs` pinta umbrales discontinuos. Entre puntos se une con rectas: pon solo puntos que salgan de la fuente. |
