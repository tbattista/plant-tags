"""
Write starter drawings to samples/<key>.svg and refresh the list the
app reads (samples/index.json). See lib.py for the rules.

    python3 scripts/tag-art/build.py              # every drawing
    python3 scripts/tag-art/build.py fern aloe    # just these (keys or module names)
"""
import importlib
import json
import os
import pkgutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'samples')
sys.path.insert(0, HERE)

import plants  # noqa: E402

wanted = {w.replace('-', '_') for w in sys.argv[1:]}
index = []
for m in sorted(pkgutil.iter_modules(plants.__path__), key=lambda m: m.name):
    if wanted and m.name not in wanted:
        continue
    mod = importlib.import_module(f'plants.{m.name}')
    svg = mod.draw()
    with open(os.path.join(OUT, f'{mod.KEY}.svg'), 'w') as f:
        f.write(svg)
    print(f'{mod.KEY}: {len(svg)} bytes')

if not wanted:
    # the full list only when everything was built, so a partial run never drops entries
    for m in sorted(pkgutil.iter_modules(plants.__path__), key=lambda m: m.name):
        mod = importlib.import_module(f'plants.{m.name}')
        index.append({'key': mod.KEY, 'name': mod.NAME, 'match': mod.MATCH})
    index.sort(key=lambda e: e['name'].lower())
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'index.json: {len(index)} drawings')
