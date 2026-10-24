# Diseño sonoro sintetizado (motion-director/sfx.py) atado a las palabras del guion, igual que scene.js.
# Uso: python3 sound.py  -> sfx_raw.wav (luego loudnorm a -14 LUFS)
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
cuts = [at('La') - .2, at('Pero') - .2, at('metaanálisis') - .3, at('proteína', 2) - .3, at('Pero', 2) - .2, at('Si') - .15, at('Envíaselo') - .15]

# pocos sonidos y suaves (pablo): un toque en cada momento clave, nada de golpes ni ráfagas
soft = lambda x: lp(x, 2500)
m.add(.05, soft(ping(660, 1.2)), .35, verb=.3)                      # gancho
m.add(at('0,8') + .3, soft(ping(880, 1.0)), .3, verb=.3)            # 0,8 en el indicador
m.add(at('49'), soft(ping(740, 1.2)), .35, verb=.3)                 # 49 estudios
m.add(at('1,6'), soft(ping(990, 1.2)), .35, verb=.3)                # marcador 1,6
m.add(at('112'), soft(kick(.3, 90, 45, click=0)), .4)               # 112 g
m.add(at('amigo') + .6, soft(ping(1320, 1.4)), .3, verb=.4)         # enviado

m.save(os.path.join(HERE, 'sfx_raw.wav'))
print('ok', D)
