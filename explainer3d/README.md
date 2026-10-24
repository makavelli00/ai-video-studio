# explainer3d · reels 3D «resulta que»

Segundo motor del estudio (skills `explainer-3d-reels` + sonido de `motion-director`): objeto 3D (Three.js) sobre negro,
subtítulos palabra a palabra arriba, anotaciones neón y cierre de «envíaselo». Cada fotograma es función pura de t.

```
cd explainer3d && npm i                       # three@0.170.0 (playwright sale del repo raíz)
python3 timeline.py projects/<v>              # tiempos estimados (sin voz)
python3 timeline.py projects/<v> --audio voz.mp3   # con la voz de pablo: se re-sincroniza solo
node render.mjs projects/<v> --stills 1.6,3.6  # fotogramas de prueba en projects/<v>/stills/
python3 projects/<v>/sound.py && ffmpeg -i projects/<v>/sfx_raw.wav -af loudnorm=I=-14:TP=-1 projects/<v>/sfx.wav
node render.mjs projects/<v> --out projects/<v>/<v>.mp4 --workers 3
```

Proyecto: `projects/<v>/` con `script.txt` (`*clave*`), `timeline.json`, `scene.js`, `sound.py`.
Con voz: `"audio": "voz.mp3"` y los efectos como `"music": "sfx.wav", "musicVolume": 0.5`.
Mismas reglas que el estudio: datos con fuente visible, sin emojis, texto entre y=250 y y=1650.
