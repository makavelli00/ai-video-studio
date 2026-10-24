# Diseño sonoro sintetizado (motion-director/sfx.py) sobre la misma línea de tiempo que scene.js.
# Uso: python3 sound.py  -> sfx.wav (luego loudnorm a -14 LUFS)
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
cuts = [at('No'), at('Con'), at('metaanálisis') - .25, at('Si'), at('Y'), at('eso') - .3, at('temporizador') - .2]
outro = tl['outro']['start']

# base: reloj que hace tic-tac cada 0,5 s (el tiempo es el tema) + acorde suave
for i in range(int(D / .5)):
    t = i * .5
    if t >= outro: break
    m.add(t, click(2600 if i % 2 else 2000), .22)
m.music(0, pad([110, 164.8, 220, 277.2], D, attack=.8), .9)

# cortes: whoosh justo antes, golpe suave en el corte
for c in cuts:
    m.add(c - .32, whoosh(.36, 400, 5000), .45)
    m.add(c, kick(.3, 120, 45, click=.2), .35, duck=.5)

# momentos
m.add(at('40'), impact(.8), .8, verb=.3, duck=.9)
m.add(at('pereza') + .25, glitch(.22), .5)
m.add(at('desajustado'), tone_sweep(.7, 880, 180), .7)
for k in range(10):  # folios que se apilan
    m.add(at('juntó') - .1 + k * .06, click(), .4)
m.add(at('55'), impact(.6), .7, verb=.25, duck=.8)
m.add(at('tiempo') - .2, riser(1.0, 300, 3000), .25)
m.add(at('falla'), beep(330, .25), .6)
m.add(at('dos'), blip(660, .06, 'sine'), .7); m.add(at('dos') + .12, blip(990, .06, 'sine'), .7)
m.add(at('fuera'), ping(1320, 1.6), .8, verb=.4)
for k in range(6):  # el dial del temporizador
    m.add(at('temporizador') + k * .09, click(3000), .35)

# cierre de compartir: toques del dedo y "enviado"
m.add(outro, whoosh(.5, 300, 3000), .5)
for dt in (.95, 1.75, 2.45): m.add(outro + dt, click(2200), .7)
m.add(outro + 2.57, ping(1760, 1.4), .8, verb=.5)

m.save(os.path.join(HERE, 'sfx_raw.wav'))
print('ok', D)
