# Review · folio-a-la-luna

## Vuelta 1
check: 6 contadores a 0 · avisos de lectura en hook y escenas 2, 4 y 5 → textos acortados y duraciones subidas.

## Vuelta 2
check: 6 contadores a 0, sin avisos.

| Criterio | Nota | Por qué |
|---|---|---|
| Gancho | 8 | Pregunta de 8 palabras, "Luna" destacada; se lee en 3 s |
| Móvil | 8 | En phone-test todo se lee; las etiquetas de la torre son lo más pequeño (40 px) |
| Movimiento | 7 | Entradas con muelle; la torre acelera al principio y deja ~3 s sin nada que pase |
| Variedad | 7 | Tras la torre vienen tres escenas de texto seguidas (16 s) |
| Sonido | 5 | Sin pista |
| Verdad y estilo | 9 | Cada cifra con fuente en el brief; preset explicativo |

### Los 3 peores defectos
| # | Instante | Prueba | Arreglo |
|---|---|---|---|
| 1 | 19.1 s | keyframe 03: la barra cruza la Luna sin que pase nada | las etiquetas dan un salto amortiguado al cruzarlas |
| 2 | 8.9–12 s | strip: los primeros dobleces van lentos y no hay marcas abajo | progresión lineal (≈ 4 dobleces/s) y marca "Canasta · 3,05 m" (FIBA) |
| 3 | 21.3–34 s | contact sheet: tres afirmaciones seguidas tras la torre | escena 4 pasa a `compare`: 41 dobleces (219.902 km) frente a 42 (439.805 km) |

## Vuelta 3
check: 6 contadores a 0, sin avisos.

| Criterio | Nota | Por qué |
|---|---|---|
| Gancho | 8 | Igual |
| Móvil | 8 | Igual |
| Movimiento | 8 | Cada marca salta al cruzarla; la Luna, en rosa, en el último doblez |
| Variedad | 8 | hook · statement · doubling · compare · statement · cta |
| Sonido | 6 | Sin pista: el vídeo funciona en silencio; música pendiente |
| Verdad y estilo | 9 | Igual |

Veredicto: ✅ exportar (pendiente: @ real y, si se quiere, música).

## Vuelta 4 (petición de pablo: "hazlo animando")
Escena `doubling` sustituida por `folding`: el folio se dobla de verdad 5 veces (vista frontal, solapa con perspectiva) y luego, de lado, la columna crece mientras la cámara se aleja y pasan a escala real la canasta, la Torre Eiffel, el Everest, la Estación Espacial y la Luna, que queda justo encima de la columna.
check: 6 contadores a 0, sin avisos. Duración 44,0 s.
Fallo encontrado y corregido: el Everest, visto de muy cerca, tapaba toda la pantalla de gris (16 s) → los monumentos solo se dibujan cuando caben enteros.
Veredicto: ✅ exportar.
