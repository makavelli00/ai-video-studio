# Review · mito-10000-pasos

## Vuelta 1
check: 6 contadores a 0 (antes 2 fuera de zona: la última marca del eje X; arreglado alineándola a la derecha) · 7 avisos de lectura.
Defectos: el titular ocupaba 4 líneas y apretaba los dibujos; la curva tenía la etiqueta del eje encima de los números; el `xLabel` se quitó y pasó al título del gráfico.

## Vuelta 2
check: 6 contadores a 0 · 8 avisos de lectura (faltan entre 0,3 y 2,3 s por beat).

| Criterio | Nota (1–10) | Por qué |
|---|---|---|
| Gancho | 9 | El titular se lee en el primer segundo y ya es la tesis; el contador de 10.000 arranca a 1 s |
| Móvil | 8 | En phone-test se leen barra, cifras y DATA; las marcas del eje (24 px) quedan justas |
| Movimiento | 8 | Barra con muelle, contador, barras que crecen, curva que se dibuja; strip sin tirones |
| Variedad | 8 | Cambio de dibujo cada 4–6 s: contador, kanji, contador, barras, curva, columnas, botón |
| Sonido | 5 | Sin pista. Su referencia lleva música continua a -14 LUFS |
| Verdad y estilo | 9 | Cada dato con fuente al pie; "probablemente" en el origen; curva marcada como ilustrativa; aviso de que no prueba causa |

### Los 3 peores defectos
| # | Instante | Prueba | Arreglo |
|---|---|---|---|
| 1 | 0–13 s | contact-sheet, escenas 1 y 2: el mismo 10.000 quieto 13 s | escena 2 → `compare` 万 · 歩 · 計 = 10.000 · pasos · medidor ✔ |
| 2 | 41–45 s | keyframe 09: botón pequeño en mucho blanco | botón 54 → 68 px ✔ |
| 3 | todo | aviso de lectura en 8 beats | etiqueta redundante del beat 4 quitada y beat 7 a 5,5 s ✔; el resto se queda: es la densidad de la referencia y subir más pasa de 45 s |

Veredicto: ✅ exportar (pendiente: sonido y @ de pablo).
