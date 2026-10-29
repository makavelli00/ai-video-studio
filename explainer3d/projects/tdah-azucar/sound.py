# Diseño sonoro suave (motion-director/sfx.py) en la misma línea de tiempo que scene.js.
# Uso: python3 sound.py -> sfx_raw.wav (luego loudnorm a -14 LUFS)
import json, os, sys, unicodedata, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from sfx import *

HERE = os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(HERE, 'timeline.json')))
words = tl['words']; D = tl['duration']
def norm_(s): return re.sub(r'[^a-z0-9ñ]', '', ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn'))
def at(w, n=1):
    k = 0
    for x in words:
        if norm_(x['w']) == norm_(w):
            k += 1
            if k == n: return x['s']
    raise KeyError(w)

m = Mix(D)
cuts = [at('A') - .15, at('Pero') - .15, at('Y') - .15, at('Entonces') - .15, at('análisis') - .35, at('A', 2) - .15, at('Tú') - .15]
m.music(0, pad([98, 146.8, 196, 246.9], D, attack=1.0), .8)          # acorde de fondo
for c in cuts: m.add(c - .3, whoosh(.36, 300, 3500), .3)                # deslizamiento de cámara
m.add(at('trampa'), ping(880, 1.4), .45, verb=.4)                        # aparece la interrogación
m.add(at('muchísimo'), blip(660, .06, 'sine'), .5)                      # sello
m.add(at('todos') - .1, pixel_shimmer(.6, 70), .35)                      # los terrones se deshacen
m.add(at('placebo'), ping(1320, 1.6), .55, verb=.4)
m.add(at('calificaron'), tone_sweep(1.2, 220, 660), .4)                 # la barra sube
m.add(at('subidón') + .15, glitch(.18), .25)                             # la conexión se rompe
for k in range(10): m.add(at('análisis') - .1 + k * .12, click(), .25)  # llegan los estudios
m.add(at('promedio'), blip(520, .08, 'sine'), .6)
m.add(at('Compártelo'), ping(1760, 1.4), .6, verb=.5)
m.save(os.path.join(HERE, 'sfx_raw.wav'))
print('ok', D)
