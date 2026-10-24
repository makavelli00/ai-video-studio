"""Motion Director — procedural sound design (no samples, no internet).
Every sound is synthesized so it can be placed frame-exactly on the same timeline as the visuals.
Usage from a project:  from sfx import *; mix = Mix(15.0); mix.add(1.6, impact()); mix.save('a.wav')
"""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_exp(d, k):
    return np.exp(-t_(d) * k)


def adsr(d, a=0.005, r=0.05):
    n = int(d * SR); e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, q=0.6, block=256):
    """band-pass whose centre glides f0->f1 (log), processed in blocks"""
    out = np.zeros_like(x); n = len(x); zi = None
    for i in range(0, n, block):
        k = i / max(1, n - 1); fc = f0 * (f1 / f0) ** k; lo, hi = fc * (1 - q / 2), min(fc * (1 + q / 2), SR / 2 - 100)
        sos = signal.butter(2, [max(lo, 20), hi], 'band', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9; return x / m * peak


# ---------------- instruments ----------------
def kick(d=0.4, f0=160, f1=42, k=9, click=0.4):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 32); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * k); c = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * click
    return np.tanh((x + c) * 1.6) * 0.9


def sub_boom(d=1.6, f0=70, f1=32):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 6); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    return np.tanh(x * 2.2) * 0.9


def crack(d=0.25, lo=1500, hi=9000, k=28):
    return bp(rng.standard_normal(int(d * SR)), lo, hi) * env_exp(d, k) * 2.2


def impact(size=1.0):
    a = sub_boom(1.6 * size); b = kick(0.5); c = crack(0.35)
    n = max(len(a), len(b), len(c)); out = np.zeros(n); out[:len(a)] += a * 0.9; out[:len(b)] += b * 0.8; out[:len(c)] += c * 0.5
    return out * size


def whoosh(d=0.5, f0=300, f1=4000, peak_at=0.7):
    x = sweep_filter(rng.standard_normal(int(d * SR)), f0, f1, q=0.9)
    t = np.linspace(0, 1, len(x)); e = np.where(t < peak_at, (t / peak_at) ** 2, ((1 - t) / (1 - peak_at)) ** 1.5)
    return norm(x * e, 0.7)


def riser(d=1.0, f0=200, f1=6000):
    n = int(d * SR); t = np.linspace(0, 1, n)
    nz = sweep_filter(rng.standard_normal(n), f0, f1, q=0.7)
    tone_f = 110 * (2 ** (t * 3)); tone = signal.sawtooth(2 * np.pi * np.cumsum(tone_f) / SR) * 0.25
    return norm((norm(nz) + lp(tone, 3000)) * t ** 2.2, 0.8)


def click(f=None):
    f = f or rng.uniform(1800, 3400); d = 0.03; t = t_(d)
    x = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.6 + np.sin(2 * np.pi * f * t) * np.exp(-t * 220) * 0.4
    return x


def blip(f=880, d=0.05, wave='square'):
    t = t_(d); x = signal.square(2 * np.pi * f * t) if wave == 'square' else np.sin(2 * np.pi * f * t)
    return x * adsr(d, 0.002, 0.02) * 0.35


def pixel_shimmer(d=0.35, density=60):
    n = int(d * SR); out = np.zeros(n); notes = [523, 659, 784, 1047, 1319, 1568, 2093]
    for _ in range(int(density * d)):
        s = int(rng.uniform(0, d - 0.04) * SR); b = blip(rng.choice(notes), 0.035); out[s:s + len(b)] += b * rng.uniform(0.3, 1)
    return out * np.linspace(0.6, 1, n)


def glitch(d=0.25):
    n = int(d * SR); x = rng.standard_normal(n)
    buzz = signal.square(2 * np.pi * rng.uniform(60, 140) * t_(d)) * 0.6
    gate = (signal.square(2 * np.pi * rng.uniform(25, 45) * t_(d)) > 0).astype(float)
    y = (bp(x, 800, 7000) + buzz) * gate
    y = np.round(y * 6) / 6  # bitcrush
    return y * adsr(d, 0.003, 0.05) * 0.5


def beep(f=1000, d=0.12):
    return np.sin(2 * np.pi * f * t_(d)) * adsr(d, 0.004, 0.04) * 0.3


def ping(f=1400, d=1.4):
    t = t_(d); x = np.sin(2 * np.pi * f * t) * np.exp(-t * 4) + np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 7) * 0.3
    return x * 0.35


def drone(d=2.0, root=55.0):
    t = t_(d); x = sum(signal.sawtooth(2 * np.pi * root * m * (1 + det) * t) for m, det in [(1, 0), (1, .006), (2, -.004), (1.5, .003)])
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t)
    return lp(x, 900) * (0.5 + 0.5 * lfo) * adsr(d, 0.15, 0.3) * 0.18


def tone_sweep(d=0.8, f0=220, f1=880):
    t = np.linspace(0, 1, int(d * SR)); f = f0 * (f1 / f0) ** t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t) * 0.25


def pad(notes, d=2.0, attack=0.05):
    t = t_(d); x = np.zeros(len(t))
    for f in notes:
        for det in (-0.004, 0, 0.005): x += signal.sawtooth(2 * np.pi * f * (1 + det) * t)
    return lp(x, 2600) * adsr(d, attack, 0.6) * 0.06


def hat(d=0.06, open_=False):
    d = 0.22 if open_ else d; return hp(rng.standard_normal(int(d * SR)), 7000) * env_exp(d, 18 if open_ else 70) * 0.25


def bass_note(f=55, d=0.22):
    t = t_(d); x = signal.sawtooth(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    return lp(x, 400) * adsr(d, 0.004, 0.08) * 0.35


def reverb(x, decay=1.4, mix=0.25):
    n = int(decay * SR); ir = rng.standard_normal((2, n)) * np.exp(-np.arange(n) / SR * (6.9 / decay)); ir[:, :int(0.01 * SR)] = 0
    wet = np.stack([signal.fftconvolve(x, ir[c])[:len(x)] for c in range(2)]); wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    return np.stack([x, x]) * (1 - mix) + wet * mix


# ---------------- mixer ----------------
class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR); self.fx = np.zeros(self.n); self.bed = np.zeros(self.n); self.duck = np.ones(self.n); self.verb = np.zeros(self.n)

    def _put(self, buf, t, x, g):
        s = int(t * SR); e = min(self.n, s + len(x))
        if s < self.n and e > 0: buf[max(0, s):e] += x[max(0, -s):e - s] * g

    def add(self, t, x, g=1.0, verb=0.0, duck=0.0):
        self._put(self.fx, t, x, g)
        if verb: self._put(self.verb, t, x, g * verb)
        if duck:  # sidechain the music bed
            s = int(t * SR); L = int(0.35 * SR); e = min(self.n, s + L)
            if s < self.n: self.duck[s:e] = np.minimum(self.duck[s:e], 1 - duck * np.exp(-np.arange(e - s) / SR * 9))

    def music(self, t, x, g=1.0):
        self._put(self.bed, t, x, g)

    def render(self):
        dry = np.stack([self.fx, self.fx]) + np.stack([self.bed * self.duck] * 2)
        wet = reverb(self.verb, 1.8, 1.0)
        out = dry + wet * 0.5
        out = np.tanh(out * 1.2) / np.tanh(1.2)
        return norm(out, 0.92)

    def save(self, path):
        from scipy.io import wavfile
        wavfile.write(path, SR, (self.render().T * 32767).astype(np.int16))
