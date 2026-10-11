# AI Video Studio

Estudio de **reels explicativos en motion design** (1080×1920) para Instagram, TikTok y YouTube Shorts, pensado para trabajar con Claude Code y llevar a la gente hacia tu **ebook**.

El vídeo no lo genera una IA de imagen: lo genera **código**. Cada fotograma es una función del tiempo (`renderAt(t)`), así que el resultado es nítido, editable frase a frase y siempre igual. Basado en las ideas de tu cuaderno *Estudio de Vídeo y Diseño Animado con IA* (las 5 capas de rari, los gates y los bucles de NO1ennn, el bucle de métricas de MAX).

## Instalación en Windows (una vez)

1. Instala **Node.js 20 o superior**: <https://nodejs.org> (botón LTS) → siguiente, siguiente.
2. Descomprime esta carpeta donde quieras, por ejemplo `C:\Users\TU_USUARIO\ai-video-studio`.
3. Abre una terminal en la carpeta (en el Explorador: clic derecho → *Abrir en Terminal*) y ejecuta:

```powershell
npm install
npm run setup
```

`npm install` descarga Playwright y ffmpeg; `npm run setup` descarga el Chromium con el que se renderiza.

4. Comprueba que todo va con el vídeo de ejemplo:

```powershell
npm run check   -- ejemplo-errores-ia
npm run preview -- ejemplo-errores-ia
npm run render  -- ejemplo-errores-ia
```

El MP4 aparece en `videos\ejemplo-errores-ia\out\`.

## Cómo se trabaja con Claude

Abre la carpeta con Claude Code (o la app de Claude con la carpeta conectada) y pide, por ejemplo:

> Haz un reel nuevo sobre "cómo escribir un buen gancho". Sigue el flujo del CLAUDE.md.

Claude lee `CLAUDE.md` y trabaja por capas, parándose en cada **gate** para que apruebes:

| Gate | Qué te enseña | Qué decides |
|---|---|---|
| 1 · Brief | Idea, público, 3 ganchos | Qué gancho y qué enfoque |
| 2 · Guion | Tabla de escenas con texto y duración | Si el guion está bien |
| 3 · Visual | Hoja de contactos + su crítica | Si se ve bien (y lo ves en `preview`) |
| 4 · Exportación | MP4 + texto para publicar | Publicar |

## Estructura

```
CLAUDE.md                 reglas del estudio para Claude (roles, gates, bucle de crítica)
engine/                   motor de render (renderAt(t)), vista previa, fuentes
scripts/                  new · check · sheet · preview · render
studio/
  01-director/            plantilla de brief
  02-reference/           guía de estilo + style.json (colores, ebook, @usuario)
  03-timeline/            tipos de escena y plantilla
  04-renderer/            cómo funciona el render
  05-critic/              checklist de revisión
  06-metrics/             metrics.csv + LEARNINGS.md (bucle semanal)
videos/<video>/           brief.md · timeline.json · out/ (mp4, hoja de contactos, keyframes)
```

## Primeros pasos recomendados

1. Edita `studio/02-reference/style.json`: tu `@usuario`, el **título del ebook**, tu nombre y, si quieres, los colores.
2. Cuéntale a Claude de qué va el ebook y para quién es; que lo añada a `STYLE_GUIDE.md` (sección Identidad).
3. Pide 5 ideas de reels que lleven al ebook y produce el primero.
4. Cada semana, pega tus métricas y pide "revisión semanal".

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run new -- nombre` | Crea `videos/nombre/` con brief y timeline |
| `npm run check -- nombre` | Sensores: estructura, tiempo de lectura, zonas seguras |
| `npm run sheet -- nombre` | Hoja de contactos y fotogramas clave en `out/` |
| `npm run preview -- nombre` | Vista previa en el navegador, se recarga al guardar |
| `npm run render -- nombre` | Exporta el MP4 |

## Música o voz

Copia el archivo (mp3/wav/m4a) en la carpeta del vídeo y añade al `timeline.json`:

```json
"audio": "musica.mp3",
"audioVolume": 0.4
```

Usa música sin copyright o la biblioteca de audio de Instagram/TikTok al publicar (suele dar más alcance que música incrustada).

## Problemas frecuentes

- **"Falta Playwright"** → `npm install` y `npm run setup`.
- **El navegador no se abre en preview** → copia la URL que aparece en la terminal.
- **Puerto ocupado** → `set PORT=4000` (cmd) o `$env:PORT=4000` (PowerShell) y vuelve a lanzar.

## Reels de misterio

Ejemplo: `videos/misterio-paso-dyatlov`. Estilo oscuro en `studio/02-reference/presets/misterio.json`, escenas `casefile` y `theories`, y `npm run ambient -- <video>` para el sonido de suspense. Para añadir voz en off, guarda el audio en la carpeta del vídeo (por ejemplo `voz.mp3`) y pon `"voice": "voz.mp3"` en el `timeline.json`.
