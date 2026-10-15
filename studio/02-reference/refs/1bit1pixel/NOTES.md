# 1Bit1Pixel: notas de referencia

Material: 4 reels de @1bit1pixel subidos por pablo el 2026-10-15 (perro y refracción, velocidad del coche, atascos en un silo, huevos y edificio). Los cuatro terminan en el logotipo `1Bit1Pixel`. Las hojas de fotogramas están en la carpeta del proyecto (`ai-video-studio/refs-1bit1pixel/`), no en el repo, porque el contenido es suyo. Aquí se copia la gramática, no el contenido.

## Ficha técnica (medido)

| | |
|---|---|
| Duración | 127–172 s (2–3 min), muy lejos de nuestros 20–45 s |
| Cortes | **Ninguno.** El detector de escena (umbral 0.25) no encuentra un solo corte en ninguno de los cuatro: todo es un plano continuo que se transforma |
| Audio | Sonido continuo de principio a fin, a -14 LUFS (igual que nuestro render). Lo más probable es que lleve voz en off: el texto en pantalla solo etiqueta |
| Formato | 720×1280 a 30 fps (lo que da la descarga de Instagram) |

## Paleta (muestreada en hex)

| Papel | Hex |
|---|---|
| Fondo | `#0C0F16` (casi negro, frío) |
| Paneles y pistas | `#141921` / `#191C25` |
| Acento A (lo bueno, lo lento, "nosotros") | `#00FFA1` verde neón |
| Acento B (lo malo, lo rápido, "ellos") | `#FF0081` rosa neón |
| Énfasis puntual | `#F3C614` amarillo; `#CA9845` ámbar para trayectorias |
| Texto | `#FFFFFF`; secundario en gris |

Siempre **dos colores enfrentados** (verde contra rosa) que codifican las dos opciones que se comparan; el amarillo solo para la respuesta.

## Tipografía

- Una sola familia **monoespaciada** (tipo JetBrains Mono / IBM Plex Mono) para todo: títulos, cifras, etiquetas y el logotipo.
- Texto **pequeño**: el título de pantalla ocupa ~1/3 del ancho ("Un solo kilómetro"). Nada de titulares gigantes.
- Las cifras son el texto grande (`30:00`, `25:00`, `7`), en el color de su bando.
- Etiquetas en **pastilla con borde fino** ("2003 · Lago Michigan", "Menos de 5 min", "Fermat · 1662", "Perruchet y Gallego · 2006"): fecha y fuente siempre a la vista.

## Gramática visual

1. **Un mundo por vídeo.** Una escena ilustrada (playa, carretera de noche, silo, edificio con luna) que no desaparece: se le añaden capas encima (trayectorias, barras, contadores) y luego se quitan.
2. **El dato es un objeto.** No se escribe "tardas 30 min": un coche recorre la pista y un cronómetro corre. Huevos que caen, granos que se atascan, un perro que corre y nada.
3. **HUD fijo.** Contadores arriba que cambian con la acción ("Lanzamientos 13", dos huevos que se rompen, "Granos fuera 63").
4. **Gráfico que nace de la escena.** Las barras de "un solo kilómetro" se convierten en un gráfico de barras, la curva aparece sobre ellas ("Hipérbola", `t = d / v`) y luego queda la curva sola.
5. **Comparación A/B constante.** Dos filas, dos colores, dos tiempos. Tarjetas lado a lado al final (Granos ×100 · Ovejas 2 de 3 · Personas Igual).
6. **Pregunta en pantalla** ("¿Qué ahorra más?", "¿Cuánto?") y la respuesta se construye delante del espectador.
7. **Cierre sin CTA visible:** solo el logotipo sobre negro.

## Ritmo

Sin cortes, el ritmo lo dan los cambios dentro del plano: cada 3–6 s aparece o desaparece una capa (una etiqueta, una barra, un contador). La cámara hace zoom a un detalle (el ángulo de refracción, el hueco de salida) y vuelve.

## Qué nos llevamos al estudio (propuesta, nada aplicado)

- **Preset nuevo "explicativo"** con esta paleta (fondo `#0C0F16`, verde `#00FFA1`, rosa `#FF0081`, amarillo `#F3C614`) y una fuente mono. Iría en `studio/02-reference/presets/`, no en `style.json`.
- **Componentes de motor:** pastilla de etiqueta con borde, contador HUD, barra que crece con tiempo, gráfico que se dibuja (barras y curva).
- **Escena nueva `race` o `sim`:** dos objetos que recorren una pista a distinta velocidad con cronómetro; es la forma más directa de "el dato es un objeto".
- **Escena persistente:** poder mantener un fondo/mundo entre escenas y añadir capas, en lugar de cortar escena a escena.

## Lo que no encaja con nuestras reglas

- Dependen de la voz: sin sonido se entiende la mitad. Nuestra regla es que se entienda en silencio, así que nuestras etiquetas tienen que contar más.
- 2–3 min: para nuestros 20–45 s habría que quedarse con una sola comparación por reel.
- Ilustraciones (perro, edificios, personas vistas desde arriba) hechas a mano: el motor puede dibujar formas simples, pero no ese nivel de ilustración sin trabajo extra.
