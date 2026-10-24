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

# sin fondo continuo (pablo lo pidió quitar): solo efectos puntuales

# transiciones: whoosh corto antes de cada cambio
for c in cuts: m.add(c - .3, whoosh(.34, 400, 5000), .4)

# gancho: los números entran y se cruzan
m.add(.05, impact(.6), .7, verb=.25, duck=.8)
m.add(at('necesitas') - .1, whoosh(.5, 300, 3000), .5)
# 0,8: indicador que se llena
m.add(at('0,8') - .45, tone_sweep(.8, 300, 900), .4)
m.add(at('0,8') + .35, blip(880, .06, 'sine'), .6)
# músculo se ilumina
m.add(at('músculo') - .1, riser(.5, 400, 3000), .3)
m.add(at('músculo') + .2, ping(990, 1.2), .6, verb=.3)
# 49 tarjetas aterrizando
t0, t1 = at('metaanálisis') - .2, at('49') + .25
for k in range(25): m.add(t0 + (t1 - t0) * k / 24, click(2400 + 40 * (k % 5)), .3)
m.add(at('49'), impact(.6), .7, verb=.25, duck=.8)
# la curva sube (sonido ascendente) y se aplana
m.add(at('suma') - .2, riser(at('aplana') - at('suma') + .2, 200, 2400), .35)
m.add(at('1,6'), impact(.5), .6, verb=.3, duck=.8)
m.add(at('aplana'), ping(1320, 1.4), .5, verb=.4)
# franja de incertidumbre
m.add(at('aproximado') - .2, tone_sweep(.9, 600, 400), .3)
# cálculo: 70, ×, y golpe seco en el 112
m.add(at('70'), blip(660, .06, 'sine'), .6); m.add(at('70') + .3, blip(990, .06, 'sine'), .6)
m.add(at('112'), kick(.35, 150, 40, click=.6), .9, duck=.9)
m.add(at('112'), crack(.18), .5)
# cierre: la coctelera cae y rebota; el icono sale hacia cámara
land = at('Envíaselo') - .15 + .45
m.add(land, kick(.3, 120, 45, click=.3), .7)
m.add(land + .2, click(1800), .3)
m.add(at('amigo') - .05, whoosh(.7, 500, 6000), .6)
m.add(at('amigo') + .7, ping(1760, 1.4), .7, verb=.5)

m.save(os.path.join(HERE, 'sfx_raw.wav'))
print('ok', D)
