import json, sys, unicodedata, re
sys.path.insert(0, '../../engine')
from sfx import *

tl = json.load(open('timeline.json', encoding='utf8'))
W = tl['words']; DUR = tl['duration']
def norm_(s): return re.sub(r'[^a-z0-9ñ]', '', ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn'))
def at(w, n=1):
    k = 0
    for x in W:
        if norm_(x['w']) == norm_(w):
            k += 1
            if k == n: return x['s']
    raise KeyError(w)

m = Mix(DUR)
outro = tl['outro']['start']
cuts = [at('Lo'), at('17'), at('cuadriceps', 2) - .35, at('Pero'), at('Es'), at('en', 3), at('cambio') - .25, at('Sumando'), at('Ojo'), at('Asi'), outro]

# bed: 110 BPM soft pulse + pad, stops at the outro
bpm = 110; beat = 60 / bpm; chords = [[110, 164.8, 220], [98, 146.8, 196], [87.3, 130.8, 174.6], [98, 146.8, 196]]
b = 0; t = 0.0
while t < outro:
    if b % 2 == 0: m.music(t, bass_note([55, 49, 43.65, 49][(b // 8) % 4], .22), .55)
    m.music(t + beat / 2, hat(), .35)
    if b % 8 == 0: m.music(t, pad(chords[(b // 8) % 4], beat * 8 + .4, .3), 1.0)
    b += 1; t = b * beat

m.add(0.0, kick(), .8, duck=.6); m.add(0.0, sub_boom(1.0), .35)
for c in cuts:
    m.add(c - .32, whoosh(.38, 400, 5000), .45); m.add(c, click(2400), .7, duck=.4)
for w, n in [('empate', 1), ('recto', 1), ('gluteo', 1), ('aductor', 1), ('principiantes', 2)]:
    m.add(at(w, n), blip(1320, .06, 'sine'), .8, verb=.3)
m.add(at('Sumando') + .3, blip(1320, .06, 'sine'), .8, verb=.3); m.add(at('Sumando') + .5, blip(988, .06, 'sine'), .6, verb=.3)
for w in ['cadera', 'rodilla']: m.add(at(w), ping(1046, .9), .5, verb=.4)
m.add(at('dos', 2), ping(1318, 1.2), .6, verb=.5)
for d in (.95, 1.75, 2.45): m.add(outro + d, click(3000), .9)
m.add(outro + 2.57, ping(1568, 1.6), .7, verb=.6); m.add(outro + 2.6, pad([220, 277.2, 329.6], 1.6, .02), 1.6, verb=.5)
m.save('sound.wav'); print('ok', DUR)
