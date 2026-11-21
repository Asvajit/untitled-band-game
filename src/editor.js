// Top-down level editor. Edits a level object (see level.js) and hands it back to the game to play.
import { ACCESS, BLOCKER_KINDS, sampleRoad, nearestS, defaultLevel, encodeLevel, decodeLevel } from './level.js';

const FOOT = [[18, 20, 'THE RUSTY NAIL', '#ffb347'], [44, 64, 'NEON FALLS', '#ff6ad5'], [150, 170, 'THE MEGADOME', '#7af0ff']];
const LEGCOL = ['#7fc45a', '#e0925a', '#a9a7b4'];
const css = `
#editor{z-index:80;align-items:stretch;justify-content:stretch;background:#14121a;font-family:monospace;color:#e8e2f0}
#edwrap{display:flex;width:100%;height:100%}
#edcan{flex:1;min-width:0;cursor:crosshair;touch-action:none;display:block}
#edside{width:310px;box-sizing:border-box;padding:14px;background:#1d1a26;overflow-y:auto;border-left:2px solid #3a3448;font-size:13px;line-height:1.45}
#edside h2{font:bold 18px sans-serif;margin:0 0 6px;color:#fff}
#edside h3{font:bold 13px sans-serif;margin:14px 0 4px;color:#b9b0cc;letter-spacing:.05em}
#edside button,#edside select{font:bold 13px monospace;padding:7px 9px;margin:3px 3px 3px 0;background:#2e2940;color:#fff;border:1px solid #564d70;border-radius:4px;cursor:pointer}
#edside button:hover{background:#3d3656}
#edside button.go{background:#2f8f4a;border-color:#4cc470;font-size:15px;width:100%;padding:11px}
#edside button.warn{background:#6e2f2f;border-color:#a85050}
#edside textarea{width:100%;height:70px;box-sizing:border-box;background:#0f0d14;color:#a8ff7a;border:1px solid #564d70;font:11px monospace}
#edside .w{color:#ffb347;margin:3px 0}#edside .ok{color:#7fe08a}#edside .k{color:#9a92a8}
#edside table{border-collapse:collapse;width:100%}#edside td{padding:1px 0}#edside td:last-child{text-align:right;color:#fff}
`;

export function openEditor(host, startLevel, { onPlay, onReset, onClose, isCustom }) {
  let L = JSON.parse(JSON.stringify(startLevel));
  host.innerHTML = `<style>${css}</style><div id="edwrap"><canvas id="edcan"></canvas><div id="edside">
    <h2>LEVEL EDITOR</h2><div class="k">${isCustom ? 'Editing your custom level' : 'Editing the default level'}</div>
    <button class="go" id="edplay">▶ PLAY THIS LAYOUT</button>
    <h3>ROUTE</h3><table id="edstats"></table>
    <h3>CHECKS</h3><div id="edwarn"></div>
    <h3>SELECTED</h3><div id="edsel" class="k">Nothing selected</div>
    <h3>ADD</h3><button id="edaddb">+ Road block</button><button id="edaddp">+ Road point at end</button>
    <h3>HOW TO</h3><div class="k">
      <b>Drag</b> a white dot to bend the road.<br><b>Double-click</b> the road to add a dot.<br><b>Delete</b> key removes the selected dot or road block.<br>
      <b>Drag</b> gigs, studios, the rest stop, the falls and road blocks. Things on the road snap to it.<br>
      <b>Drag empty space</b> to pan · <b>wheel</b> to zoom.<br><br>
      Each gig's stage faces south. The road has to pass through the gig's <span style="color:#fff">◇ access point</span> just north of it, running roughly east–west. The road must END at the Megadome's access point.</div>
    <h3>SAVE / SHARE</h3><button id="edcopy">Copy level text</button><button id="edload">Load from text</button>
    <textarea id="edtext" placeholder="Level text appears here. Paste one and press Load."></textarea>
    <button id="edundo">Undo</button><button class="warn" id="edreset">Reset to default</button><button id="edclose">Close</button>
  </div></div>`;
  const can = host.querySelector('#edcan'), g = can.getContext('2d');
  const q = (id) => host.querySelector(id);
  let cam = { x: 80, z: 2200, k: 0.14 }, sel = null, drag = null, sr = null, info = {}, undo = [];
  const X = (x) => can.width / 2 + (cam.x - x) * cam.k, Y = (z) => can.height / 2 + (cam.z - z) * cam.k;
  const wx = (px) => cam.x - (px - can.width / 2) / cam.k, wz = (py) => cam.z - (py - can.height / 2) / cam.k;
  const pushUndo = () => { undo.push(JSON.stringify(L)); if (undo.length > 60) undo.shift(); };
  const access = (i) => [L.venues[i][0], L.venues[i][1] + ACCESS[i]];

  function recompute(final = true) {
    sr = sampleRoad(L.road, final ? 2 : 5);
    if (final) { // keep on-road things on the road
      const snap = (p) => { const n = nearestS(sr, p[0], p[1]); p[0] = Math.round(n.x); p[1] = Math.round(n.z); };
      snap(L.falls); snap(L.rest); L.studios.forEach(snap); L.blockers.forEach(snap);
    }
    const a0 = nearestS(sr, ...access(0)), a1 = nearestS(sr, ...access(1)), end = sr.pts[sr.pts.length - 1], a2 = access(2);
    info = { sBar: a0.s, sNF: a1.s, L: sr.L, d0: a0.d, d1: a1.d, d2: Math.hypot(end.x - a2[0], end.z - a2[1]), i0: a0.i, i1: a1.i };
    const warns = [];
    const names = ['The Rusty Nail', 'Neon Falls', 'The Megadome'];
    if (info.d0 > 14) warns.push(`Road misses ${names[0]}'s access point by ${info.d0 | 0} m`);
    if (info.d1 > 14) warns.push(`Road misses ${names[1]}'s access point by ${info.d1 | 0} m`);
    if (info.d2 > 18) warns.push(`Road should END at the Megadome's access point (${info.d2 | 0} m away)`);
    if (info.sBar >= info.sNF - 300) warns.push('The road must reach The Rusty Nail well before Neon Falls');
    if (info.sNF > sr.L - 300) warns.push('Part 3 is very short');
    const hd = (i) => { const a = sr.pts[Math.max(0, i - 4)], b = sr.pts[Math.min(sr.pts.length - 1, i + 4)]; return Math.abs(Math.atan2(b.z - a.z, b.x - a.x)); };
    [[info.i0, 0], [info.i1, 1]].forEach(([i, v]) => { const h = hd(i), off = Math.min(h, Math.PI - h); if (off > 0.75 && (v ? info.d1 : info.d0) <= 14) warns.push(`Road should run east–west past ${names[v]}`); });
    const sOf = (p) => nearestS(sr, p[0], p[1]).s;
    if (sOf(L.falls) > info.sBar) warns.push('The waterfall is meant to be in Part 1');
    const sRest = sOf(L.rest); if (sRest < info.sBar || sRest > info.sNF) warns.push('The rest stop is meant to be in Part 2');
    L.studios.forEach((p, i) => { const s = sOf(p), r = [[0, info.sBar], [info.sBar, info.sNF], [info.sNF, sr.L]][i]; if (s < r[0] || s > r[1]) warns.push(`Studio ${i + 1} is outside Part ${i + 1}`); });
    if (final) {
      // tight bends + the road passing too close to itself
      const P = sr.pts; let tight = 0, close = false;
      for (let i = 6; i < P.length - 6; i += 3) {
        const a = Math.atan2(P[i].x - P[i - 6].x, P[i].z - P[i - 6].z), b = Math.atan2(P[i + 6].x - P[i].x, P[i + 6].z - P[i].z);
        let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d; if (d / (12 * sr.step) > 1 / 16) tight++;
      }
      for (let i = 0; i < P.length && !close; i += 8) for (let j = i + 60; j < P.length; j += 8) if (Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) < 45) { close = true; break; }
      if (tight) warns.push('Some bends are very tight (under ~16 m radius) — the bus may struggle');
      if (close) warns.push('The road passes within 45 m of itself somewhere (terrain may clash)');
      for (const [i, f] of FOOT.entries()) { // road through a venue footprint
        const v = L.venues[i]; let hit = false;
        for (let k = 0; k < P.length; k += 4) if (Math.abs(P[k].x - v[0]) < f[0] / 2 + 8 && P[k].z > v[1] - f[1] / 2 - 8 && P[k].z < v[1] + ACCESS[i] - 14) { hit = true; break; }
        if (hit) warns.push(`The road runs through ${names[i]}`);
      }
    }
    info.warns = warns;
    q('#edstats').innerHTML = [['Part 1 · van', info.sBar], ['Part 2 · RV', info.sNF - info.sBar], ['Part 3 · bus', sr.L - info.sNF], ['Total', sr.L]].map(([t, v], i) => `<tr><td style="color:${LEGCOL[i] || '#fff'}">${t}</td><td>${(v / 1000).toFixed(2)} km</td></tr>`).join('') + `<tr><td class="k">Road points</td><td>${L.road.length}</td></tr>`;
    q('#edwarn').innerHTML = warns.length ? warns.map((w) => `<div class="w">⚠ ${w}</div>`).join('') : '<div class="ok">✓ Layout looks drivable</div>';
  }
  function showSel() {
    const el = q('#edsel');
    if (!sel) { el.className = 'k'; el.textContent = 'Nothing selected'; return; }
    el.className = '';
    const p = itemPos(sel), name = { road: `Road point ${sel.i + 1} of ${L.road.length}`, venue: FOOT[sel.i]?.[2], falls: 'Silverthread Falls (bridge)', rest: 'Rest stop', studio: `Practice studio ${sel.i + 1}`, blocker: 'Road block' }[sel.t];
    let h = `<b>${name}</b><br><span class="k">x ${p[0] | 0} · z ${p[1] | 0}</span><br>`;
    if (sel.t === 'blocker') h += `<select id="edkind">${BLOCKER_KINDS.map((k) => `<option ${L.blockers[sel.i][2] === k ? 'selected' : ''}>${k}</option>`).join('')}</select><button id="eddel">Delete</button>`;
    if (sel.t === 'road') h += `<button id="eddel">Delete point</button>`;
    el.innerHTML = h;
    const d = q('#eddel'); if (d) d.onclick = delSel;
    const k = q('#edkind'); if (k) k.onchange = () => { pushUndo(); L.blockers[sel.i][2] = k.value; draw(); };
  }
  const itemPos = (it) => it.t === 'road' ? L.road[it.i] : it.t === 'venue' ? L.venues[it.i] : it.t === 'falls' ? L.falls : it.t === 'rest' ? L.rest : it.t === 'studio' ? L.studios[it.i] : L.blockers[it.i];
  function delSel() {
    if (!sel) return;
    if (sel.t === 'road' && L.road.length > 6) { pushUndo(); L.road.splice(sel.i, 1); sel = null; }
    else if (sel.t === 'blocker') { pushUndo(); L.blockers.splice(sel.i, 1); sel = null; }
    recompute(); showSel(); draw();
  }
  function items() {
    const out = [];
    L.blockers.forEach((p, i) => out.push({ t: 'blocker', i }));
    out.push({ t: 'falls' }, { t: 'rest' }); L.studios.forEach((p, i) => out.push({ t: 'studio', i }));
    L.venues.forEach((p, i) => out.push({ t: 'venue', i }));
    L.road.forEach((p, i) => out.push({ t: 'road', i }));
    return out;
  }
  function pick(px, py) {
    let best = null, bd = 13;
    for (const it of items()) { const p = itemPos(it), d = Math.hypot(X(p[0]) - px, Y(p[1]) - py) - (it.t === 'road' ? 0 : 3); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  function draw() {
    const W = can.width, H = can.height;
    g.fillStyle = '#14121a'; g.fillRect(0, 0, W, H);
    // grid
    const step = cam.k > 0.5 ? 50 : cam.k > 0.12 ? 100 : 500;
    g.font = '11px monospace'; g.fillStyle = '#6c647c';
    for (let x = Math.floor(wx(W) / step) * step; x <= wx(0); x += step) { g.strokeStyle = x % 500 === 0 ? '#3a3448' : '#23202c'; g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); if (x % 500 === 0) g.fillText(x, X(x) + 3, H - 5); }
    for (let z = Math.floor(wz(H) / step) * step; z <= wz(0); z += step) { g.strokeStyle = z % 500 === 0 ? '#3a3448' : '#23202c'; g.beginPath(); g.moveTo(0, Y(z)); g.lineTo(W, Y(z)); g.stroke(); if (z % 500 === 0) g.fillText(z + ' m', 4, Y(z) - 3); }
    // biome corridor + road
    const P = sr.pts, legOf = (i) => { const s = i * sr.step; return s < info.sBar ? 0 : s < info.sNF ? 1 : 2; };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [0, 1, 2]) {
      let i = 0;
      while (i < P.length - 1) {
        const leg = legOf(i); g.beginPath(); g.moveTo(X(P[i].x), Y(P[i].z));
        while (i < P.length - 1 && legOf(i) === leg) { i++; g.lineTo(X(P[i].x), Y(P[i].z)); }
        if (pass === 0) { g.strokeStyle = ['#2c4a22', '#5a3a22', '#3a3a44'][leg]; g.lineWidth = Math.max(10, 320 * cam.k); g.globalAlpha = 0.55; }
        else if (pass === 1) { g.strokeStyle = '#0c0b10'; g.lineWidth = Math.max(5, 9.2 * cam.k + 4); g.globalAlpha = 1; }
        else { g.strokeStyle = LEGCOL[leg]; g.lineWidth = Math.max(2.5, 9.2 * cam.k); }
        g.stroke(); g.globalAlpha = 1;
      }
    }
    // km ticks
    g.fillStyle = '#fff'; g.font = '11px monospace';
    for (let s = 500; s < sr.L; s += 500) { const p = P[Math.round(s / sr.step)]; g.beginPath(); g.arc(X(p.x), Y(p.z), 2, 0, 7); g.fill(); if (cam.k > 0.09) g.fillText((s / 1000).toFixed(1) + 'km', X(p.x) + 5, Y(p.z) + 14); }
    // venues
    L.venues.forEach((v, i) => {
      const f = FOOT[i], a = access(i), bad = [info.d0, info.d1, info.d2][i] > (i === 2 ? 18 : 14);
      g.fillStyle = f[3] + '33'; g.strokeStyle = f[3]; g.lineWidth = sel && sel.t === 'venue' && sel.i === i ? 3 : 1.5;
      g.fillRect(X(v[0] + f[0] / 2), Y(v[1] + f[1] / 2), f[0] * cam.k, f[1] * cam.k); g.strokeRect(X(v[0] + f[0] / 2), Y(v[1] + f[1] / 2), f[0] * cam.k, f[1] * cam.k);
      g.strokeStyle = bad ? '#ff5a5a' : '#ffffff'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(v[0]), Y(v[1])); g.lineTo(X(a[0]), Y(a[1])); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(X(a[0]), Y(a[1])); g.rotate(Math.PI / 4); g.lineWidth = 2; g.strokeRect(-6, -6, 12, 12); g.restore();
      g.fillStyle = f[3]; g.beginPath(); g.arc(X(v[0]), Y(v[1]), 7, 0, 7); g.fill();
      g.font = 'bold 13px sans-serif'; g.fillText(`GIG ${i + 1} · ${f[2]}`, X(v[0]) + 12, Y(v[1]) + 4);
      // stage side marker (north)
      g.fillStyle = f[3]; g.fillRect(X(v[0] + f[0] / 4), Y(v[1] + f[1] / 2), f[0] / 2 * cam.k, Math.max(2, 3 * cam.k));
    });
    // on-road markers
    const mark = (p, col, label, on, shape) => {
      g.fillStyle = col; g.strokeStyle = on ? '#fff' : '#111'; g.lineWidth = on ? 3 : 1.5; g.beginPath();
      if (shape === 'sq') g.rect(X(p[0]) - 6, Y(p[1]) - 6, 12, 12); else if (shape === 'tri') { g.moveTo(X(p[0]), Y(p[1]) - 8); g.lineTo(X(p[0]) + 7, Y(p[1]) + 6); g.lineTo(X(p[0]) - 7, Y(p[1]) + 6); g.closePath(); } else g.arc(X(p[0]), Y(p[1]), 7, 0, 7);
      g.fill(); g.stroke();
      if (label && cam.k > 0.07) { g.font = '12px monospace'; g.fillStyle = col; g.fillText(label, X(p[0]) + 11, Y(p[1]) + 4); }
    };
    const is = (t, i) => sel && sel.t === t && (i === undefined || sel.i === i);
    L.blockers.forEach((b, i) => mark(b, '#ff5a5a', cam.k > 0.2 ? b[2] : '', is('blocker', i), 'tri'));
    mark(L.falls, '#4fb4e4', 'Falls + bridge', is('falls'), 'sq');
    mark(L.rest, '#5ff3ff', 'Rest stop', is('rest'), 'sq');
    L.studios.forEach((p, i) => mark(p, '#a8ff7a', `Studio ${i + 1}`, is('studio', i), 'sq'));
    // road control points
    L.road.forEach((p, i) => {
      const on = is('road', i);
      g.fillStyle = on ? '#ffe066' : '#ffffff'; g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(p[0]), Y(p[1]), on ? 6.5 : cam.k > 0.1 ? 4.5 : 3, 0, 7); g.fill(); g.stroke();
    });
    const s0 = L.road[0]; g.font = 'bold 13px sans-serif'; g.fillStyle = '#ffd27a'; g.fillText('START · farm', X(s0[0]) + 10, Y(s0[1]) + 4);
    // scale bar + north
    const bar = cam.k > 0.5 ? 50 : cam.k > 0.1 ? 200 : 1000;
    g.fillStyle = '#fff'; g.fillRect(20, 20, bar * cam.k, 5); g.font = '12px monospace'; g.fillText(`${bar} m`, 20, 42); g.fillText('N ↑   E →', 20, 60);
  }
  function resize() { const r = can.getBoundingClientRect(); can.width = Math.max(200, r.width); can.height = Math.max(200, r.height); draw(); }
  // ---- input
  const pos = (e) => { const r = can.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  can.onpointerdown = (e) => {
    const [px, py] = pos(e); can.setPointerCapture(e.pointerId);
    const it = e.button === 0 ? pick(px, py) : null;
    if (it) { sel = it; pushUndo(); drag = { item: it, moved: false }; }
    else { sel = null; drag = { pan: true, px, py, cx: cam.x, cz: cam.z }; }
    showSel(); draw();
  };
  can.onpointermove = (e) => {
    if (!drag) return; const [px, py] = pos(e);
    if (drag.pan) { cam.x = drag.cx + (px - drag.px) / cam.k; cam.z = drag.cz + (py - drag.py) / cam.k; draw(); return; }
    const p = itemPos(drag.item); let x = wx(px), z = wz(py);
    if (!['road', 'venue'].includes(drag.item.t)) { const n = nearestS(sr, x, z); x = n.x; z = n.z; }
    p[0] = Math.round(x); p[1] = Math.round(z); drag.moved = true;
    recompute(false); draw();
  };
  can.onpointerup = () => { if (drag && drag.item) { if (!drag.moved) undo.pop(); recompute(); showSel(); } drag = null; draw(); };
  can.ondblclick = (e) => {
    const [px, py] = pos(e); if (pick(px, py)) return;
    const n = nearestS(sr, wx(px), wz(py)); if (n.d * cam.k > 14) return;
    // insert after the control point that precedes this spot along the road
    let at = 1, best = Infinity;
    const ss = L.road.map((p) => nearestS(sr, p[0], p[1]).s);
    for (let i = 0; i < ss.length - 1; i++) if (n.s >= ss[i] && n.s <= ss[i + 1] && ss[i + 1] - ss[i] < best) { best = ss[i + 1] - ss[i]; at = i + 1; }
    pushUndo(); L.road.splice(at, 0, [Math.round(n.x), Math.round(n.z)]); sel = { t: 'road', i: at }; recompute(); showSel(); draw();
  };
  can.onwheel = (e) => { e.preventDefault(); const [px, py] = pos(e), x = wx(px), z = wz(py); cam.k = Math.min(3, Math.max(0.04, cam.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18))); cam.x = x + (px - can.width / 2) / cam.k; cam.z = z + (py - can.height / 2) / cam.k; draw(); };
  can.oncontextmenu = (e) => e.preventDefault();
  const onKey = (e) => {
    if (!host.classList.contains('show')) return;
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); delSel(); }
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) doUndo();
  };
  const doUndo = () => { if (!undo.length) return; L = JSON.parse(undo.pop()); sel = null; recompute(); showSel(); draw(); };
  window.addEventListener('keydown', onKey); window.addEventListener('resize', resize);
  // ---- buttons
  q('#edplay').onclick = () => { recompute(); if (info.warns.length && !confirm('There are warnings:\n\n• ' + info.warns.join('\n• ') + '\n\nPlay anyway?')) return; onPlay(L); };
  q('#edaddb').onclick = () => { pushUndo(); const n = nearestS(sr, cam.x, cam.z); L.blockers.push([Math.round(n.x), Math.round(n.z), 'rocks']); sel = { t: 'blocker', i: L.blockers.length - 1 }; recompute(); showSel(); draw(); };
  q('#edaddp').onclick = () => { pushUndo(); const a = L.road[L.road.length - 2], b = L.road[L.road.length - 1]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; L.road.push([Math.round(b[0] + (b[0] - a[0]) / d * 80), Math.round(b[1] + (b[1] - a[1]) / d * 80)]); sel = { t: 'road', i: L.road.length - 1 }; recompute(); showSel(); draw(); };
  q('#edcopy').onclick = () => { const t = JSON.stringify(L); q('#edtext').value = t; q('#edtext').select(); try { navigator.clipboard.writeText(t); } catch (e) { /* shown in the box */ } q('#edcopy').textContent = 'Copied ✓'; setTimeout(() => (q('#edcopy').textContent = 'Copy level text'), 1500); };
  q('#edload').onclick = () => { const l = decodeLevel(q('#edtext').value); if (!l) { alert('That doesn\'t look like a level. Paste the full level text first.'); return; } pushUndo(); L = l; sel = null; recompute(); showSel(); draw(); };
  q('#edundo').onclick = doUndo;
  q('#edreset').onclick = () => { if (confirm('Throw away your custom level and go back to the default layout?')) onReset(); };
  q('#edclose').onclick = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', resize); onClose(L); };
  recompute();
  // fit the whole route
  setTimeout(() => {
    resize();
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const p of sr.pts) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); }
    cam.x = (a + b) / 2; cam.z = (c + d) / 2; cam.k = Math.min(can.width / (b - a + 500), can.height / (d - c + 300)); draw();
  }, 30);
  return { get level() { return L; }, encode: () => encodeLevel(L), _dbg: { screen: (p) => { const r = can.getBoundingClientRect(); return [r.left + X(p[0]), r.top + Y(p[1])]; }, recompute, draw, get info() { return info; }, set(l) { L = l; recompute(); draw(); } } };
}
export { defaultLevel };
