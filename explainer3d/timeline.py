#!/usr/bin/env python3
"""Build/refresh the `words` track of timeline.json from a script (+ optional voice-over).

Script syntax (script.txt):
  *palabra*   -> keyword highlighted with the blue "selection box"
  /           -> force a caption break after the previous word
  Normal punctuation (. ? ! ,) also ends caption phrases.

Timing sources (best first):
  --words words.json  : [{"word":..,"start":..,"end":..}] from any aligner (ElevenLabs "with timestamps", WhisperX, CapCut export...)
  --whisper           : run faster-whisper locally on --audio (needs `pip install faster-whisper` + model download)
  --srt subs.srt      : segment timings; words spread inside each segment by syllables
  --audio voice.mp3   : no aligner -> spread words over the audio duration by syllables + punctuation pauses
  (nothing)           : estimate at --rate syllables/second (default 6.3, a fast Spanish narrator)

Usage: python3 timeline.py <projectDir> [--audio voice.mp3] [--whisper | --srt f | --words f] [--rate 6.3] [--lead 0.15]
"""
import json, re, sys, os, subprocess, unicodedata, difflib, argparse

ap = argparse.ArgumentParser()
ap.add_argument('project'); ap.add_argument('--audio'); ap.add_argument('--srt'); ap.add_argument('--words')
ap.add_argument('--whisper', action='store_true'); ap.add_argument('--rate', type=float, default=6.3)
ap.add_argument('--lead', type=float, default=0.15, help='silence before first word when estimating')
ap.add_argument('--lang', default='es')
a = ap.parse_args()
P = a.project
script = open(os.path.join(P, 'script.txt'), encoding='utf8').read()

# ---- tokenize script ----
toks = []
for raw in script.replace('\n', ' ').split():
    if raw == '/':
        if toks: toks[-1]['br'] = True
        continue
    hl = '*' in raw
    w = raw.replace('*', '')
    if w.endswith('/'):
        w = w[:-1]; toks.append({'w': w, 'hl': hl, 'br': True}); continue
    toks.append({'w': w, 'hl': hl})

def norm(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)
def syl(w):
    n = len(re.findall(r'[aeiouáéíóúü]+', w.lower()))
    return max(1, n)
def pause_after(w):
    if re.search(r'[.?!…]$', w): return 1.6
    if re.search(r'[,;:]$', w): return 0.8
    return 0.0

def audio_dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())

def spread(tokens, t0, t1):
    """distribute tokens between t0 and t1 by syllable weight + punctuation pauses (pause unit = 1 syllable)."""
    weights = [syl(t['w']) for t in tokens]; pauses = [pause_after(t['w']) for t in tokens]
    total = sum(weights) + sum(pauses[:-1])
    k = (t1 - t0) / total if total else 0; t = t0
    for i, tk in enumerate(tokens):
        tk['s'] = round(t, 3); t += weights[i] * k; tk['e'] = round(t, 3)
        if i < len(tokens) - 1: t += pauses[i] * k

def apply_aligned(tokens, aligned):
    """aligned: list of (word, start, end) from an ASR. Map onto script tokens via sequence matching."""
    A = [norm(w) for w, _, _ in aligned]; B = [norm(t['w']) for t in tokens]
    sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    for blk in sm.get_matching_blocks():
        for j in range(blk.size):
            w, s, e = aligned[blk.a + j]; tokens[blk.b + j]['s'] = round(s, 3); tokens[blk.b + j]['e'] = round(e, 3)
    # fill gaps by interpolation
    i = 0
    while i < len(tokens):
        if 's' in tokens[i]: i += 1; continue
        j = i
        while j < len(tokens) and 's' not in tokens[j]: j += 1
        t0 = tokens[i - 1]['e'] if i > 0 else 0.0
        t1 = tokens[j]['s'] if j < len(tokens) else t0 + 0.3 * (j - i)
        spread(tokens[i:j], t0, max(t1, t0 + 0.05 * (j - i)))
        i = j

duration = None
if a.words:
    data = json.load(open(a.words)); apply_aligned(toks, [(d.get('word') or d.get('text'), d['start'], d['end']) for d in data])
elif a.whisper:
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get('WHISPER_MODEL', 'small'), device='cpu', compute_type='int8')
    segs, _ = m.transcribe(os.path.join(P, a.audio) if not os.path.isabs(a.audio) else a.audio, language=a.lang, word_timestamps=True)
    aligned = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    apply_aligned(toks, aligned)
elif a.srt:
    txt = open(a.srt, encoding='utf8').read()
    segs = []
    for m in re.finditer(r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\s*\n(.+?)(?:\n\n|\Z)', txt, re.S):
        g = m.groups(); s = int(g[0]) * 3600 + int(g[1]) * 60 + int(g[2]) + int(g[3]) / 1000; e = int(g[4]) * 3600 + int(g[5]) * 60 + int(g[6]) + int(g[7]) / 1000
        segs.append((s, e, g[8].split()))
    aligned = []
    for s, e, ws in segs:
        tmp = [{'w': w} for w in ws]; spread(tmp, s, e); aligned += [(t['w'], t['s'], t['e']) for t in tmp]
    apply_aligned(toks, aligned)
elif a.audio:
    duration = audio_dur(os.path.join(P, a.audio))
    spread(toks, a.lead, duration - 0.35)
else:
    total = sum(syl(t['w']) for t in toks) + sum(pause_after(t['w']) for t in toks[:-1])
    spread(toks, a.lead, a.lead + total / a.rate)

tl_path = os.path.join(P, 'timeline.json')
tl = json.load(open(tl_path)) if os.path.exists(tl_path) else {}
tl.setdefault('fps', 30)
if a.audio: tl['audio'] = a.audio
if duration is None and a.audio: duration = audio_dur(os.path.join(P, a.audio))
end_words = toks[-1]['e']
outro = tl.get('outro')
if outro and outro.get('startWord'):
    sw = norm(outro['startWord'])
    hit = next((t for t in toks if norm(t['w']) == sw), None)
    if hit: outro['start'] = round(hit['s'] - 0.1, 3)
tl['words'] = [{k: v for k, v in t.items() if v is not False} for t in toks]
tl['duration'] = round(max(duration or 0, end_words + 0.8, (outro or {}).get('start', 0) + 3.4), 2)
json.dump(tl, open(tl_path, 'w'), ensure_ascii=False, indent=1)
print(f"{len(toks)} words, {tl['duration']}s -> {tl_path}")
for t in toks: print(f"{t['s']:6.2f} {t['e']:6.2f}  {'*' if t.get('hl') else ' '} {t['w']}")
