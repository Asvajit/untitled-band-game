# The Loose Wires — On Tour (prototype)

Co-op robot-band touring game. Three.js, bundled with esbuild into a single HTML page.

## Run
    npm install
    node build.mjs              # builds dist/index.html (game inlined) — audio lives in dist/audio/
    cd dist && python3 -m http.server 8765
    open http://localhost:8765

## Hosting
Cloudflare Workers static assets (wrangler.jsonc serves ./dist). The built dist/index.html is committed,
so run `node build.mjs` before committing. With the repo connected in Cloudflare, every push to main deploys.

## Layout
- src/main.js      game loop, state (G), player (P), interactables, legs/progression, HUD, debug panel
- src/world.js     continuous road (country → desert → city), terrain tiles, waterfall, studios, rest stop, 3 venues
- src/van.js       vehicles: SPECS for van / rv / bus (layout, seats, handling), cab controls, physics, mirror + bus CCTV
- src/level.js     level layout data (road points, venues, studios, road blocks)
- src/editor.js    in-game top-down level editor
- src/rhythm.js    one-button rhythm game (Performance)
- src/song.js      "Offbeat Dub" charts + stem files
- src/robot.js     band robots, instanced crowd
- src/instruments.js, src/signs.js, src/audio.js, src/render.js (toon/dither post), src/util.js
- template.html    CSS/DOM; build.mjs inlines the bundle at /*__GAME__*/
- tests/           Playwright headless scenarios (use window.__dbg / __G hooks)

## Debug
` or F2 opens the debug panel: jump to any part/section, swap instrument, weather, time of day, cheats.

## Credits
Vehicle exterior models, used under CC BY 4.0 (modified: textures stripped, van mesh simplified, rescaled, door openings cut):
- "FREE GMC Motorhome reimagined low poly" by Karol Miklas — https://sketchfab.com/3d-models/free-gmc-motorhome-reimagined-low-poly-6hiH0iyDqXqtdD9wbqSbyLLhKmz
- "VW Van" by jesseroberts — https://sketchfab.com/3d-models/vw-van-718f8f0185bb4ce1b34242796b19418c
Models live in dist/models/; src/main.js MODELS sets their scale, wheels and door openings. tools/glbstrip.py prepares a new one.
