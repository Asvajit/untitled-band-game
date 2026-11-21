// Concept sheet only — alternative, less triangular robot bodies. Does not touch the game.
import * as THREE from 'three';
import { Robot, ROLES, ROLE_LIST } from '../src/robot.js';
import { toon, basic } from '../src/render.js';

const DARK = '#2b2a30', METAL = '#8d8a86';
function base(role) {
  const r = new Robot(role);
  r.arms.forEach((a, i) => a.rotation.set(0, 0, (i === 0 ? -1 : 1) * Math.PI / 2));
  return r;
}
// remove the cone poncho + collar (and optionally the boxy torso under it)
function strip(r, torsoToo) {
  const kill = [];
  r.body.children.forEach((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.parameters || {};
    if (o.geometry.type === 'CylinderGeometry' && p.radialSegments === 7) kill.push(o); // poncho + collar
    if (torsoToo && o.geometry.type === 'BoxGeometry' && Math.abs(o.position.y - 1.02) < 1e-3) kill.push(o);
  });
  kill.forEach((o) => r.body.remove(o));
}
const add = (r, mesh, x, y, z) => { mesh.position.set(x, y, z); r.body.add(mesh); return mesh; };
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? toon(c) : c);
const cyl = (a, b, h, c, s = 8) => new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, s), toon(c));

const VARIANTS = [
  { name: 'CURRENT — cone poncho', note: 'what is in the game now', build: (r) => r },
  { name: 'A · BOXY JACKET', note: 'straight-cut jacket, shoulder pads, lapels', build: (r, col) => {
    strip(r, true);
    add(r, box(0.42, 0.46, 0.27, col), 0, 1.02, 0);
    for (const s of [-1, 1]) { add(r, box(0.13, 0.08, 0.29, col), s * 0.23, 1.22, 0); add(r, box(0.06, 0.24, 0.02, DARK), s * 0.07, 1.08, 0.141).rotation.z = s * 0.35; }
    add(r, box(0.36, 0.06, 0.28, DARK), 0, 0.82, 0);
    add(r, box(0.05, 0.05, 0.02, basic('#ffd27a')), 0.12, 0.98, 0.14);
    return r;
  } },
  { name: 'B · BARREL TORSO', note: 'drum-like chest unit with a lit panel', build: (r, col) => {
    strip(r, true);
    add(r, cyl(0.21, 0.19, 0.46, col, 10), 0, 1.02, 0);
    for (const y of [0.83, 1.21]) add(r, cyl(0.215, 0.215, 0.04, METAL, 10), 0, y, 0);
    add(r, box(0.18, 0.12, 0.03, DARK), 0, 1.05, 0.2);
    [-0.05, 0, 0.05].forEach((x, i) => add(r, box(0.03, 0.03, 0.02, basic(['#ff5a5a', '#ffd27a', '#7af0ff'][i])), x, 1.05, 0.217));
    for (const s of [-1, 1]) add(r, new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(METAL)), s * 0.22, 1.18, 0);
    return r;
  } },
  { name: 'C · HOODIE', note: 'rounded body, hood behind the monitor head, front pocket', build: (r, col) => {
    strip(r, true);
    const b = add(r, new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), toon(col)), 0, 1.0, 0); b.scale.set(0.95, 1.05, 0.62);
    const hood = add(r, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 6, 12, Math.PI), toon(col)), 0, 1.28, -0.08); hood.rotation.x = -0.5;
    add(r, box(0.24, 0.11, 0.04, col), 0, 0.9, 0.15);
    add(r, box(0.25, 0.012, 0.045, DARK), 0, 0.96, 0.152);
    for (const s of [-1, 1]) add(r, cyl(0.008, 0.008, 0.14, '#e8e2d0', 4), s * 0.05, 1.12, 0.16);
    return r;
  } },
  { name: 'D · OVERALLS', note: 'slim metal frame, bib overalls in the band colour', build: (r, col) => {
    strip(r, false);
    add(r, box(0.34, 0.26, 0.26, col), 0, 0.92, 0);
    add(r, box(0.24, 0.16, 0.02, col), 0, 1.12, 0.125);
    for (const s of [-1, 1]) { add(r, box(0.05, 0.3, 0.27, col), s * 0.12, 1.1, 0).rotation.z = s * -0.05; add(r, box(0.035, 0.035, 0.02, toon('#d8d2c4')), s * 0.1, 1.17, 0.137); }
    add(r, box(0.09, 0.07, 0.02, toon(DARK)), 0, 1.1, 0.137);
    return r;
  } },
];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1);
function render(obj, cam, w, h) {
  renderer.setSize(w, h); const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight('#ffffff', '#b8a890', 1.6)); const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(2, 4, 5); s.add(d);
  s.add(obj); renderer.setClearColor(0, 0); renderer.render(s, cam);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0); return c;
}
window.makeSheet = () => {
  const ROWH = 470, W = 2700, H = 120 + ROWH * VARIANTS.length;
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H; const g = sheet.getContext('2d');
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d2433'; g.font = 'bold 34px sans-serif'; g.fillText('BODY SHAPE CONCEPTS — less triangular robots (concept only, game unchanged)', 40, 56);
  g.font = '18px monospace'; g.fillStyle = '#555'; g.fillText('Same heads, arms, legs and proportions as the game · only the torso changes · T-pose, 0.5 m grid', 40, 88);
  VARIANTS.forEach((v, vi) => {
    const y0 = 120 + vi * ROWH;
    g.fillStyle = vi ? '#ffffff' : '#efece4'; g.fillRect(30, y0 + 8, W - 60, ROWH - 16);
    g.fillStyle = '#1d2433'; g.font = 'bold 22px sans-serif'; g.fillText(v.name, 50, y0 + 42);
    g.font = '15px monospace'; g.fillStyle = '#666'; g.fillText(v.note, 50, y0 + 66);
    // 3/4 hero view (drums)
    const hero = v.build(base('drums'), ROLES.drums.color);
    const pc = new THREE.PerspectiveCamera(30, 1, 0.1, 50); pc.position.set(2.4, 1.6, 3.4); pc.lookAt(0, 1.0, 0);
    g.drawImage(render(hero.group, pc, 380, 380), 40, y0 + 78);
    // the band, front view
    const cw = 360, ch = 380, wm = 1.8;
    ROLE_LIST.forEach((role, i) => {
      const r = v.build(base(role), ROLES[role].color);
      const oc = new THREE.OrthographicCamera(-wm / 2, wm / 2, 2.05, -0.05, 0.1, 50); oc.position.set(0, 0, 10); oc.lookAt(0, 0, 0);
      const x = 440 + i * (cw + 10), y = y0 + 60;
      g.strokeStyle = '#e3e7ee'; g.lineWidth = 1;
      for (let k = 0; k <= 4; k++) { const yy = y + ch - (k * 0.5 + 0.05) * (ch / 2.1); g.beginPath(); g.moveTo(x, yy); g.lineTo(x + cw, yy); g.stroke(); }
      g.drawImage(render(r.group, oc, cw, ch), x, y);
      g.fillStyle = ROLES[role].color; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText(ROLES[role].name.toUpperCase(), x + cw / 2, y + ch + 18); g.textAlign = 'left';
    });
  });
  return sheet.toDataURL('image/png');
};
window.ready = true;
