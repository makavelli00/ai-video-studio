"""Word timings for a voiceover WITHOUT a speech model (offline fallback, from motion-director).
Finds voiced regions by energy and spreads the script's words over them weighted by syllables.
Output: JSON [{"word", "start", "end"}] for timeline.py --words.
Usage: python3 align.py voice.mp3 script.txt out.json
"""
import json, re, subprocess, sys
import numpy as np

SR = 16000


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def syllables(w):
    w = w.lower(); return max(1, len(re.findall(r'[aeiouáéíóúüy]+', w)))


def voiced_regions(x, hop=0.01, min_gap=0.18):
    h = int(hop * SR); rms = np.array([np.sqrt(np.mean(x[i:i + h] ** 2) + 1e-12) for i in range(0, len(x) - h, h)])
    db = 20 * np.log10(rms + 1e-9); thr = max(np.percentile(db, 30), db.max() - 38); on = db > thr
    regs, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None: regs.append([s * hop, i * hop]); s = None
    if s is not None: regs.append([s * hop, len(on) * hop])
    merged = []
    for r in regs:
        if merged and r[0] - merged[-1][1] < min_gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] > 0.06]


def align(audio, script):
    x = load(audio); regs = voiced_regions(x)
    words = [w for w in re.findall(r"\S+", script.replace('*', '')) if w != '/']
    total_voiced = sum(b - a for a, b in regs); total_syl = sum(syllables(w) for w in words)
    def voiced_to_time(v):
        acc = 0
        for a, b in regs:
            if v <= acc + (b - a): return a + (v - acc)
            acc += b - a
        return regs[-1][1]
    out, cum = [], 0
    for w in words:
        s = syllables(w); t0 = voiced_to_time(cum / total_syl * total_voiced + 1e-4); cum += s; t1 = voiced_to_time(cum / total_syl * total_voiced)
        out.append({'word': w, 'start': round(t0, 3), 'end': round(t1, 3)})
    return out


if __name__ == '__main__':
    res = align(sys.argv[1], open(sys.argv[2], encoding='utf8').read())
    json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
    print(len(res), 'words')
