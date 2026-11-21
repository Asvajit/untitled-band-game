#!/bin/sh
# Build the game and publish dist/ to the gh-pages branch (the test server).
set -e
node build.mjs
rm -rf /tmp/lw-pages && mkdir /tmp/lw-pages && cp -r dist/index.html dist/audio dist/models /tmp/lw-pages/ && rm -f /tmp/lw-pages/models/bus.glb && touch /tmp/lw-pages/.nojekyll
cd /tmp/lw-pages && git init -q -b gh-pages && git add -A && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Deploy $(date -u +%F\ %T)"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
