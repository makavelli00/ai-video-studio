# Review · prensa-vs-extensiones

## Vuelta 1
check: 6 contadores a 0 · 5 avisos de lectura. Hoja de contactos: cuatro `compare` seguidos (beats 1–4); el beat 1 va justo (6,8 s para titular + barra); la etiqueta del beat 7 («lo que no demuestra») no casaba con lo que enseña.

## Vuelta 2
Beat 1 +3 pulsos (8,8 s), beat 6 +2 pulsos (5,4 s): total 44,9 s, los cortes siguen en pulsos. Beat 4 pasa a contador («2 · cadera y rodilla»). Etiqueta del beat 7: «en resumen».
Fallo del motor: con `sub`, el contador salía diminuto porque `layoutRich` cambiaba la fuente antes de dibujar la cifra. Arreglado en `engine.js`.
check: 6 contadores a 0 · 3 avisos de lectura (beats 1, 4 y 5; incluyen el titular fijo, aceptados como en los otros reels).

| Criterio | Nota | Por qué |
|---|---|---|
| Gancho | 9 | El titular cuenta el giro entero: gana la prensa, pero hay un músculo que no toca |
| Móvil | 8 | Todo se lee a 360 px; los subtítulos de las barras son pequeños pero secundarios |
| Movimiento | 8 | Columnas por turnos, contador, barras que crecen; sin tirones |
| Variedad | 8 | pareja, pareja, pareja, contador, barras, pareja, pareja, botón |
| Sonido | 7 | Música de pablo en bucle por compases; cortes en pulsos |
| Verdad y estilo | 9 | Cifras de Kinoshita 2026 (MSSE); «no significativo» marcado; límites del estudio en el beat 7 |

### Los 3 peores defectos
| # | Instante | Prueba | Arreglo |
|---|---|---|---|
| 1 | 19–24 s | keyframe 04: cifra del contador diminuta | fuente restablecida tras `layoutRich` ✔ |
| 2 | 0–14 s | contact-sheet: 4 `compare` seguidos | beat 4 con contador ✔ |
| 3 | 0–9 s | aviso de lectura del beat 1 | +3 pulsos y barra más corta ✔ (queda aviso por el titular) |

Veredicto: ✅ exportar.
