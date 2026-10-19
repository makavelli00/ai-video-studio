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

## Vuelta 3 (2026-10-19, petición de pablo: dibujos de los ejercicios)
Nuevo dibujo `exercise` en el motor: figura de trazo en la prensa a 45° y en la máquina de extensiones, haciendo repeticiones (muslo en rojo; en la prensa del beat 7 también el glúteo). Beat 1: las dos máquinas en lugar de las palabras «Prensa / Extensión». Beat 7: «Recto femoral → extensiones» y «Toda la pierna → prensa» con sus dibujos.
Los dibujos entran con un iris opaco: con transparencia se veían los cruces de los trazos.
check: 6 contadores a 0 · 4 avisos de lectura (los mismos más el beat 7, por 0,2 s).
Veredicto: ✅ exportar.

## Vuelta 4 (2026-10-19, petición de pablo: textos y gráficas más llamativos)
Barra a 46 px con las palabras clave en caja blanca. Etiqueta en mayúsculas y negrita. Cifras de `compare` más grandes y contando desde 0, con la ganadora en caja roja (beats 3 y 6). Barras más anchas, cifras a 70 px que cuentan y columna rosa detrás de las destacadas. Sin @, la línea DATA baja y el dibujo gana sitio.
Fallo: el rotulador partía «casi empate» entre dos líneas y dejaba huecos entre palabras. Arreglo: espacio duro dentro de la frase destacada; `parseRich` ya no corta por él.
check: 6 contadores a 0 · 4 avisos de lectura.
Veredicto: ✅ exportar.
