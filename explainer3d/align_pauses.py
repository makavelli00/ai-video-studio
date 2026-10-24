"""Alinea el guion con la voz usando las pausas (silencedetect) como anclas.
Cada pausa se asigna a un final de frase/coma del guion (programación dinámica que busca un ritmo
de sílabas/segundo constante); dentro de cada tramo las palabras se reparten por sílabas.
Uso: python3 align_pauses.py voz.wav script.txt words.json [--db -35 --min 0.25]
"""
import json, re, subprocess, sys, argparse

ap = argparse.ArgumentParser(); ap.add_argument('audio'); ap.add_argument('script'); ap.add_argument('out')
ap.add_argument('--db', default='-35'); ap.add_argument('--min', default='0.25'); a = ap.parse_args()

log = subprocess.run(['ffmpeg', '-i', a.audio, '-af', f'silencedetect=noise={a.db}dB:d={a.min}', '-f', 'null', '-'], capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', log)]
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.audio]))
# silencios internos (descarta el de cabeza y el de cola)
sil = [(s, e) for s, e in zip(starts, ends + [dur]) if s > 0.05 and e < dur - 0.05]
lead = ends[0] if starts and starts[0] <= 0.05 else 0.0
tail = starts[-1] if len(starts) > len(ends) or (starts and ends and starts[-1] > ends[-1]) else dur
segs_t = [lead] + [x for s, e in sil for x in (s, e)] + [tail]
segs = [(segs_t[i], segs_t[i + 1]) for i in range(0, len(segs_t), 2)]

words = [w for w in open(a.script, encoding='utf8').read().replace('*', '').split() if w != '/']
SPOKEN = {'5': 'cinco', '40': 'cuarenta', '55': 'cincuenta y cinco', 'tdah': 'te de a hache', '08': 'cero coma ocho', '16': 'uno coma seis', '49': 'cuarenta y nueve', '70': 'setenta', '112': 'ciento doce', '22': 'dos coma dos'}  # cómo se dice, para contar sílabas
def syl(w):
    k = re.sub(r'[^0-9a-záéíóúüñ]', '', w.lower()); w = SPOKEN.get(k, w)
    return max(1, len(re.findall(r'[aeiouáéíóúü]+', w.lower())))
bounds = [i for i, w in enumerate(words[:-1]) if re.search(r'[.?!,:;»]$', w)]  # cortar después de la palabra i
K = len(segs) - 1
if K > len(bounds): sys.exit(f'{K} pausas pero solo {len(bounds)} finales de frase')
cum = [0]
for w in words: cum.append(cum[-1] + syl(w))
total_voiced = sum(e - s for s, e in segs); rate = cum[-1] / total_voiced
# dp[k][j]: coste mínimo usando k pausas con la última en bounds[j]
INF = 1e18
def cost(w0, w1, seg):  # palabras [w0, w1) en el tramo seg
    d = seg[1] - seg[0]; return (cum[w1] - cum[w0] - rate * d) ** 2
dp = [[INF] * len(bounds) for _ in range(K)]; prev = [[-1] * len(bounds) for _ in range(K)]
for j, b in enumerate(bounds): dp[0][j] = cost(0, b + 1, segs[0])
for k in range(1, K):
    for j, b in enumerate(bounds):
        for i in range(j):
            c = dp[k - 1][i] + cost(bounds[i] + 1, b + 1, segs[k])
            if c < dp[k][j]: dp[k][j], prev[k][j] = c, i
best = min(range(len(bounds)), key=lambda j: dp[K - 1][j] + cost(bounds[j] + 1, len(words), segs[K]))
chosen = [best]
for k in range(K - 1, 0, -1): chosen.append(prev[k][chosen[-1]])
cuts = [0] + [bounds[j] + 1 for j in reversed(chosen)] + [len(words)]
out = []
for k, (s, e) in enumerate(segs):
    ws = words[cuts[k]:cuts[k + 1]]; n = sum(syl(w) for w in ws); t = s
    for w in ws:
        d = (e - s) * syl(w) / n; out.append({'word': w, 'start': round(t, 3), 'end': round(t + d, 3)}); t += d
json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
for k in range(len(segs)): print(f'{segs[k][0]:6.2f}-{segs[k][1]:6.2f}  ' + ' '.join(words[cuts[k]:cuts[k + 1]]))
