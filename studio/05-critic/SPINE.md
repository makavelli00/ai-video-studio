# Spine · registro de fallos

Cada fallo que encuentren los sensores, el crítico o el usuario va aquí. Si un fallo aparece **dos veces**, no se vuelve a arreglar a mano: se convierte en regla (`CLAUDE.md`) o en sensor (`scripts/check.mjs`), y se indica en la columna "Regla/sensor".

| Fecha | Vídeo | Fallo | Arreglo | Veces | Regla/sensor |
|---|---|---|---|---|---|
| 2026-10-11 | misterio-paso-dyatlov | 5 escenas sin tiempo suficiente para leerse | Duraciones subidas y nota de la escena 7 acortada | 1 | Ya cubierto por el aviso de lectura del check |
| 2026-10-11 | (motor) | Chromium de Playwright no coincidía con el de la nube | `chromiumOptions()` usa el del entorno | 1 | — |
| 2026-10-12 | caso-apagon | Botón del CTA demasiado largo, se salía por los lados | Texto del botón acortado | 1 | Ya cubierto por el check (zona segura) |
| 2026-10-15 | mito-10000-pasos | Dos beats seguidos con el mismo dibujo quieto (13 s) | Beat 2 con dibujo propio (kanji del Manpo-kei) | 1 | — |
| 2026-10-15 | mito-10000-pasos | Beats justos de tiempo de lectura (look editorial, muy denso) | Etiquetas redundantes fuera; resto aceptado | 2 | Ya cubierto por el aviso de lectura del check |
| 2026-10-15 | placa-silenciosa | Valor de `compare` demasiado largo, se salía por el lado | Texto más corto; el motor usa un tamaño común por escena | 1 | Ya cubierto por el check (zona segura) |
| 2026-10-15 | prensa-vs-extensiones | Contador con `sub` dibujado diminuto (la fuente del sub pisaba la de la cifra) | `engine.js` restablece la fuente antes de dibujar la cifra | 1 | — |
| 2026-10-15 | prensa-vs-extensiones | Cuatro `compare` seguidos | Beat 4 pasa a contador | 1 | — |
| 2026-10-19 | prensa-vs-extensiones | Palabras destacadas en caja partidas entre líneas, con huecos entre ellas | Espacio duro dentro de la frase; `parseRich` no corta por U+00A0 | 1 | — |
| 2026-10-20 | agarre-por-edad | Palabras destacadas partidas entre líneas en la barra («30 y los / 40», «19 / kg») | Espacio duro (U+00A0) dentro de los `*…*` | 2 | Sensor en `scripts/check.mjs`: error si un destacado del look editorial lleva espacios normales |
| 2026-10-20 | agarre-por-edad | Textos del viz `lines` pequeños en móvil y tachados por umbrales | Tamaños 26–30 y fondo bajo las cifras (engine) | 1 | — |
| 2026-10-24 | agarre-por-edad | Con la firma @ el gráfico encoge y las etiquetas de hombres y mujeres se pisaban a los 20 años | `lines` separa las etiquetas al menos 100 px | 1 | Ya cubierto por el check (solapes) |
