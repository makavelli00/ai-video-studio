# Review · curl-sentado-vs-tumbado

## Vuelta 1 (2026-10-24)
Check: 6 contadores a 0. Avisos de lectura en la escena 1 (cuenta el titular) y en la 6.

| Criterio | Nota | Por qué |
|---|---|---|
| Gancho | 8 | La pregunta A o B se entiende sin sonido y los dos dibujos la apoyan desde el primer segundo. |
| Móvil | 7 | Los nombres de músculo a 24 px y el esquema de isquios se leen justos a 360 px. |
| Movimiento | 8 | Las repeticiones de los dos dibujos siguen el reloj global y las cifras cuentan y saltan con muelle. A los 1,1 s se veían los puntos de las sesiones antes de tiempo. |
| Variedad | 8 | Estudio con puntos, comparación, músculo por músculo y contador. Hay tres escenas de músculo seguidas (el límite). |
| Sonido | 8 | Cortes movidos a pulsos con beats --snap (89,1 BPM). |
| Verdad y estilo | 9 | Todas las cifras son de Maeo 2021. El empate del bíceps femoral corto se dice tal cual. "Tumbado también creció" evita la promesa exagerada. |

Tres peores defectos:
1. 1,1 s, strip f31–f39: los puntos y "24 sesiones" aparecían antes que las cifras. Arreglo: entran con fundido en `study`.
2. Escenas 3–5, phone-test: los nombres de músculo se leían pequeños. Arreglo: 24 → 26 px.
3. Escenas 3–5, keyframe 04: la línea que separa las columnas cruzaba el esquema y las cifras. Arreglo: la línea solo baja por la franja de los dibujos.

Además, la escena 6 pasó de 6,06 a 6,73 s tras el snap.

## Vuelta 2
Arreglados los tres defectos. Móvil sube a 8. El esquema de isquios sigue pequeño (unos 110 px de ancho): se distingue el músculo rojo, pero no su forma. Mejorarlo exige más alto en la zona del dibujo.
Veredicto: ✅ exportar.

## Vuelta 3 (tras el ok de pablo)
- Se añade la marca: cuadrado rojo "cd" + @cuerpo.con.datos bajo la línea DATA (`brand.mark`, `brand.handle` en style.json del vídeo).
- Con menos alto, los nombres del bíceps femoral largo pisaban el veredicto: la tabla reserva su hueco.
- "más del doble" salía en tres cajas separadas: espacios duros dentro de la frase (mismo arreglo que el 2026-10-19).
Check 0 errores. Render 42,1 s.
