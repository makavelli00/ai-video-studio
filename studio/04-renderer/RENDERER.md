# Capa 4 · Renderer

El vídeo no se "genera" con IA de imagen: es **código**. `engine/engine.js` expone `renderAt(t)`, que dibuja el fotograma del segundo `t` en un canvas de 1080×1920.

```
fotograma(f) = renderAt(f / fps)
```

Por eso:
- **Determinista:** el mismo `t` siempre da el mismo fotograma. Renderizar dos veces = mismo vídeo.
- **Saltable (seekable):** se puede ver cualquier instante sin reproducir lo anterior (hojas de contacto, vista previa).
- **Editable en local:** cambiar una frase en `timeline.json` solo cambia esa escena.

## Cómo se exporta
`npm run render -- <video>` abre `engine/player.html` en Chromium sin ventana (Playwright), pide los fotogramas uno a uno y se los pasa a ffmpeg → `videos/<video>/out/<video>.mp4` (H.264, yuv420p, 30 fps, listo para Instagram/TikTok/YouTube Shorts).

Si `timeline.json` tiene `"audio": "musica.mp3"`, se mezcla con fundido de salida de 1 s.

## Reglas del motor
- Nada de `Math.random()`, `Date.now()`, `setTimeout` ni animaciones CSS.
- Nada de recursos remotos (fuentes, imágenes): todo vive en el proyecto.
- Todo texto pasa por `drawRich` o `pill` para que el check pueda medirlo.

## Variables de entorno opcionales
- `CHROMIUM_PATH` — usar otro Chromium/Chrome.
- `FFMPEG` — usar otro ffmpeg (por defecto, el de `ffmpeg-static`).
- `PORT` — puerto de la vista previa (3333).
