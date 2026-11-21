# The Loose Wires — On Tour (prototype)

Co-op robot-band touring game. Three.js, bundled with esbuild into a single HTML page.

## Run
    npm install
    node build.mjs              # builds dist/index.html (game inlined) — audio lives in dist/audio/
    cd dist && python3 -m http.server 8765
    open http://localhost:8765

## Test server
    ./deploy.sh                 # builds and pushes dist/ to the gh-pages branch (GitHub Pages)

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
