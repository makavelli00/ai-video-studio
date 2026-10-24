"""Diseño sonoro propio de agarre-por-edad (sin muestras ni derechos): sale de timeline.json.
- Colchón: acorde suave que cambia en cada beat y pulso a 100 BPM (el bombo entra cuando la bajada se acelera).
- Cursor: un tic cada vez que la edad cruza un año, al ritmo del easeInOut del motor.
- Cortes: golpe suave en cada cambio de beat; «pop» en el botón del CTA.
Uso: python3 videos/agarre-por-edad/sound.py  → videos/agarre-por-edad/sound.wav
"""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
tl = json.load(open(os.path.join(HERE, "timeline.json")))
scenes = tl["scenes"]
starts = np.cumsum([0] + [s["duration"] for s in scenes])
TOTAL = float(starts[-1])
N = int(TOTAL * SR)
L = np.zeros(N); R = np.zeros(N)


def t_(d):
    return np.arange(int(d * SR)) / SR


def add(at, x, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    x = x[: N - i] * gain
    L[i:i + len(x)] += x * (1 - pan) ** 0.5
    R[i:i + len(x)] += x * (1 + pan) ** 0.5


def lp1(x, fc):  # paso bajo de un polo
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc = (1 - a) * x[k] + a * acc; y[k] = acc
    return y


def ease(u):
    u = min(max(u, 0.0), 1.0)
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


# --- colchón: acordes por beat (re menor → fa → la menor → sol → re menor → fa) ---
CHORDS = [[50, 57, 62, 65, 69], [53, 57, 60, 65, 72], [45, 57, 60, 64, 69], [43, 55, 59, 62, 67], [50, 57, 62, 65, 69], [53, 60, 65, 69, 72]]
for i, s in enumerate(scenes):
    d = s["duration"] + 0.6
    t = t_(d)
    env = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.6)
    x = sum(np.sin(2 * np.pi * midi(n) * t + j) * (0.6 if n < 52 else 0.25) for j, n in enumerate(CHORDS[i % len(CHORDS)]))
    x *= env * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * t))
    add(starts[i], x, 0.05, pan=(-0.2 if i % 2 else 0.2))

# --- pulso a 100 BPM: tic grave siempre, bombo desde el beat que se acelera ---
BEAT = 60 / 100
accel = starts[2] if len(scenes) > 2 else 0
for k in range(int(TOTAL / BEAT) + 1):
    at = k * BEAT
    if at >= TOTAL - 0.8: break
    t = t_(0.35)
    if at >= accel:
        f = 45 + 110 * np.exp(-t * 30)
        add(at, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10), 0.13)
    if k % 2 == 1:
        n = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 60)
        add(at, n, 0.03, pan=0.3)

# --- tic del cursor: uno por año cruzado ---
for i, s in enumerate(scenes):
    v = s.get("viz") or {}
    a0, a1 = v.get("at", [0, 0])
    if a0 == a1: continue
    sweep = v.get("sweep", 2.4)
    last = round(a0)
    for k in range(int(sweep * 1000) + 300):
        lt = 0.3 + k / 1000
        age = a0 + (a1 - a0) * ease((lt - 0.3) / sweep)
        if round(age) != last:
            last = round(age)
            t = t_(0.03)
            pitch = 1400 + (90 - last) * 12  # baja de tono al envejecer
            add(starts[i] + lt, np.sin(2 * np.pi * pitch * t) * np.exp(-t * 180), 0.07, pan=0.4 * (age - 55) / 35)
        if lt > 0.3 + sweep: break

# --- golpe suave en cada cambio de beat ---
for i in range(1, len(scenes)):
    t = t_(1.2)
    f = 38 + 60 * np.exp(-t * 12)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4)
    noise = lp1(np.random.default_rng(i).standard_normal(len(t)), 900) * np.exp(-t * 8)
    add(starts[i], thump * 0.5 + noise * 0.6, 0.35)

# --- pop del botón del CTA ---
if scenes[-1]["type"] == "cta":
    t = t_(0.25)
    f = 520 + 600 * np.exp(-t * 40)
    add(starts[-2] + 0.35, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18), 0.25)

# --- salida ---
mx = max(np.abs(L).max(), np.abs(R).max()) + 1e-9
st = np.stack([L, R], 1) / mx * 0.9
fade = np.minimum(1, (TOTAL - np.arange(N) / SR) / 1.0)[:, None]
st *= fade
with wave.open(os.path.join(HERE, "sound.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print(f"sound.wav · {TOTAL:.1f} s")
