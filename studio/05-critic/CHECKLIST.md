# Capa 5 · Crítico — checklist de revisión

Antes de exportar, el crítico mira lo que sale de `npm run sheet`: `contact-sheet.png`, `phone-test.png` (cada escena a 360 px, como en el móvil), `strip.png` (12 fotogramas seguidos alrededor del movimiento más brusco) y `keyframes/`. No se da por buena la primera versión.

## Puntuación (lo que se escribe en review.md)

Juzga solo los fotogramas renderizados, no lo que querías hacer. Puntúa de 1 a 10:

| Criterio | Qué mirar |
|---|---|
| Gancho | ¿Se entiende y engancha en los primeros 2 s, sin sonido? |
| Móvil | En `phone-test.png`, ¿se lee todo sin hacer zoom? |
| Movimiento | En `strip.png`, ¿hay tirones, cosas que deslizan sin peso, saltos? |
| Variedad | ¿Algo nuevo cada 2–4 s? ¿Algún tramo muerto? |
| Sonido | ¿Los cortes caen en golpes o pausas de la voz? (`npm run beats`) |
| Verdad y estilo | Datos con fuente, guía de estilo, sin defaults prohibidos. |

Luego, **los 3 peores defectos**, cada uno con instante (s), prueba (qué fotograma lo enseña) y arreglo local (escena, campo, valor nuevo). Arregla esos 3, vuelve a sacar las pruebas y repite hasta que **todo esté en 8 o más** (máximo 4 vueltas). Plantilla: `studio/05-critic/REVIEW_TEMPLATE.md`.

## Automático (`npm run check`)
- [ ] Smoke test con los 6 contadores a 0 (ejecución, zona segura, solapes, colores, determinismo, costura).
- [ ] Sin errores de estructura ni asteriscos sin cerrar.
- [ ] Tiempo suficiente para leer cada escena.
- [ ] Empieza con hook y termina con cta.

## Visual (hoja de contactos)
- [ ] **Gancho:** ¿se entiende en 1 segundo y sin sonido? ¿Da ganas de seguir?
- [ ] **Una idea por escena.** Si una escena dice dos cosas, se parte.
- [ ] **Jerarquía:** lo destacado (`*...*`) es lo importante, y es poco.
- [ ] **Legibilidad:** nada pequeño, nada pegado a los bordes, buen contraste.
- [ ] **Ritmo:** no hay escenas que se queden quietas demasiado tiempo ni que pasen sin poder leerse.
- [ ] **Coherencia** con `STYLE_GUIDE.md` (color de acento, tipografía, tono).
- [ ] **CTA:** queda claro qué hacer y qué se consigue (el ebook).
- [ ] **Verdad:** ninguna cifra sin fuente, ninguna promesa exagerada.
- [ ] **Nada genérico:** no es todo titulares centrados; hay al menos una escena con forma propia (lista, número, comparación, expediente, teorías).

## Resultado
Escribe en `videos/<video>/review.md`:
- Qué está bien.
- Qué cambiar (concreto: escena, campo, nuevo valor).
- Veredicto: ✅ exportar · 🔁 otra vuelta.

Y apunta en `studio/05-critic/SPINE.md` cualquier fallo que hayas tenido que corregir.
