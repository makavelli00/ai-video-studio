# Spine · registro de fallos

Cada fallo que encuentren los sensores, el crítico o el usuario va aquí. Si un fallo aparece **dos veces**, no se vuelve a arreglar a mano: se convierte en regla (`CLAUDE.md`) o en sensor (`scripts/check.mjs`), y se indica en la columna "Regla/sensor".

| Fecha | Vídeo | Fallo | Arreglo | Veces | Regla/sensor |
|---|---|---|---|---|---|
| 2026-10-11 | misterio-paso-dyatlov | 5 escenas sin tiempo suficiente para leerse | Duraciones subidas y nota de la escena 7 acortada | 1 | Ya cubierto por el aviso de lectura del check |
| 2026-10-11 | (motor) | Chromium de Playwright no coincidía con el de la nube | `chromiumOptions()` usa el del entorno | 1 | — |
| 2026-10-12 | caso-apagon | Botón del CTA demasiado largo, se salía por los lados | Texto del botón acortado | 1 | Ya cubierto por el check (zona segura) |
