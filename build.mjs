import * as esbuild from 'esbuild';
import fs from 'fs';
await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, outfile: 'dist/game.js', target: 'es2020', legalComments: 'none' });
const js = fs.readFileSync('dist/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('template.html', 'utf8');
const i = html.indexOf('/*__GAME__*/');
fs.writeFileSync('dist/index.html', html.slice(0, i) + js + html.slice(i + 12));
console.log('built', (fs.statSync('dist/index.html').size / 1024).toFixed(0) + 'KB');
