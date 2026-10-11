# Capa 2 · Referencia — guía de estilo

La guía manda sobre cualquier ocurrencia del momento. Los valores concretos viven en `style.json`; aquí está el *porqué*.

## Identidad
- **Tono:** cercano, directo, de tú a tú. Frases cortas. Cero relleno.
- **Promesa de la cuenta:** explicar una cosa útil en menos de 40 segundos.
- **Destino de todo el contenido:** que la persona quiera el ebook.

## Tipografía
- Inter. Titulares en Black (900), cuerpo en Bold/SemiBold.
- Titulares: 90–120 px. Texto de apoyo: 44–60 px. Nunca por debajo de 40 px (se lee en móvil).
- Máximo 2 tamaños de texto por escena.

## Color
- Fondo oscuro `bg`, texto claro `text`, secundario `muted`.
- **Un único color de acento** (`accent`) para lo importante: palabras destacadas con `*asteriscos*`, números, botones.
- `bad` / `good` solo en comparaciones antes/después.
- Destaca como mucho **1–3 palabras por frase**. Si todo está destacado, nada lo está.

## Ritmo
- Una idea por escena. Si necesitas "y además", es otra escena.
- Hook en los primeros 3 s. Cambio visual cada 2.5–5 s.
- Las palabras entran una a una (`wordStagger` 0.06 s). Entradas suaves de 0.45 s, salidas de 0.3 s.
- Duración total del reel: 20–45 s (el check avisa fuera de 15–60 s).

## Zona segura (Reels / TikTok / Shorts)
- Arriba quedan la barra de progreso y el @usuario (hasta y=310).
- Abajo, desde y=1500, está la interfaz de la app (descripción, botones). **Ningún texto ahí.**
- Márgenes laterales de 90 px.
- `npm run check` lo verifica automáticamente.

## Prohibido
- Emojis dentro del vídeo (no se renderizan igual en todas partes).
- Cifras o estadísticas sin fuente verificable (`source` en la escena `number`).
- Más de 5 puntos en una lista.
- Textos de más de 3 líneas en un titular.
- Promesas exageradas ("hazte rico", "100% garantizado").

## Referencias
Guarda aquí capturas o enlaces de reels que te gusten (`studio/02-reference/refs/`) y anota qué copias de cada uno: ritmo, color, tipo de gancho.
