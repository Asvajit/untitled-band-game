// Standalone: builds the band robots in a T-pose, renders a scaled reference sheet and exports a GLB.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Robot, ROLES, ROLE_LIST } from '../src/robot.js';

function tpose(role) {
  const r = new Robot(role);
  r.arms.forEach((a, i) => { a.rotation.set(0, 0, (i === 0 ? -1 : 1) * Math.PI / 2); });
  r.legs.forEach((l) => l.rotation.set(0, 0, 0));
  r.head.rotation.set(0, 0, 0); r.body.position.set(0, 0, 0); r.body.rotation.set(0, 0, 0);
  r.group.name = `robot_${role}`;
  return r;
}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7f5ee');
scene.add(new THREE.HemisphereLight('#ffffff', '#b8a890', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(2, 4, 5); scene.add(sun);
// grid on a back plane (0.1 m minor, 0.5 m major)
function gridCanvas(wm, hm, px) {
  const c = document.createElement('canvas'); c.width = wm * px; c.height = hm * px; const g = c.getContext('2d');
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x <= wm + 1e-6; x += 0.1) { g.strokeStyle = Math.abs(x * 2 - Math.round(x * 2)) < 1e-6 ? '#c9d3e2' : '#e7ebf1'; g.beginPath(); g.moveTo(x * px, 0); g.lineTo(x * px, c.height); g.stroke(); }
  for (let y = 0; y <= hm + 1e-6; y += 0.1) { g.strokeStyle = Math.abs(y * 2 - Math.round(y * 2)) < 1e-6 ? '#c9d3e2' : '#e7ebf1'; g.beginPath(); g.moveTo(0, c.height - y * px); g.lineTo(c.width, c.height - y * px); g.stroke(); }
  return c;
}
function renderView(objs, cam, w, h) {
  renderer.setSize(w, h); const s = new THREE.Scene(); s.background = null;
  scene.children.filter((o) => o.isLight).forEach((l) => s.add(l.clone()));
  objs.forEach((o) => s.add(o));
  renderer.setClearColor(0x000000, 0); renderer.render(s, cam);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return c;
}
window.makeSheet = function () {
  const PX = 240; // pixels per metre
  const sheet = document.createElement('canvas'); sheet.width = 2600; sheet.height = 1500; const g = sheet.getContext('2d');
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.fillStyle = '#1d2433'; g.font = 'bold 34px sans-serif'; g.fillText('THE LOOSE WIRES — BAND ROBOTS (T-POSE)', 50, 60);
  g.font = '18px monospace'; g.fillStyle = '#555';
  g.fillText('Grid: 0.1 m (major 0.5 m) · all views orthographic, same scale · robot faces the viewer in FRONT views', 50, 92);
  const views = [['FRONT', [0, 1, 10]], ['SIDE (robot\'s left)', [10, 1, 0]], ['BACK', [0, 1, -10]]];
  // top row: one robot (drums), three views, 2.2 m tall area x 1.6 m wide each
  const VW = 1.7, VH = 2.1;
  views.forEach(([name, p], i) => {
    const r = tpose('drums'); r.update && 0;
    const cam = new THREE.OrthographicCamera(-VW / 2, VW / 2, VH - 0.05, -0.05, 0.1, 50); cam.position.set(...p); cam.lookAt(0, 1, 0); cam.position.y = 0; cam.lookAt(0, 0, 0);
    cam.position.set(p[0], 0, p[2]); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    const ox = 50 + i * (VW * PX + 40), oy = 130;
    g.drawImage(gridCanvas(VW, VH, PX), ox, oy);
    g.drawImage(renderView([r.group], cam, VW * PX, VH * PX), ox, oy);
    g.fillStyle = '#1d2433'; g.font = 'bold 18px sans-serif'; g.fillText(name, ox, oy - 10);
    // height marks
    g.font = '14px monospace'; g.fillStyle = '#c0392b';
    for (let y = 0; y <= 2.0; y += 0.5) { const yy = oy + (VH - 0.05 - y) * PX; g.fillRect(ox, yy, 14, 2); g.fillText(`${y.toFixed(1)} m`, ox + 18, yy + 5); }
  });
  // key dimensions measured from the model
  const r = tpose('drums'); r.group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(r.group), sz = bb.getSize(new THREE.Vector3());
  const tx = 50 + 3 * (VW * PX + 40) + 10;
  g.fillStyle = '#1d2433'; g.font = 'bold 20px sans-serif'; g.fillText('DIMENSIONS (T-pose)', tx, 150);
  g.font = '17px monospace'; g.fillStyle = '#333';
  const lines = [`Height (to antenna tip)  ${(bb.max.y).toFixed(2)} m`, `Arm span                 ${sz.x.toFixed(2)} m`, `Depth                    ${sz.z.toFixed(2)} m`, '', 'Head (monitor)   0.48 × 0.36 × 0.34', 'Screen face      0.38 × 0.27', 'Head centre      y = 1.52 m', 'Torso            0.36 × 0.42 × 0.24', 'Shoulder pivot   y = 1.18, x = ±0.24', 'Arm length       0.52 + hand Ø 0.11', 'Hip pivot        y = 0.74, x = ±0.11', 'Leg length       0.66 + foot 0.08 tall', 'First-person eye y = 1.56 m'];
  lines.forEach((t, i) => g.fillText(t, tx, 185 + i * 26));
  // bottom row: the whole band, front view
  const oy = 130 + VH * PX + 90, BW = 2600 - 100, BH = 1500 - oy - 30, perW = BW / 6;
  g.fillStyle = '#1d2433'; g.font = 'bold 18px sans-serif'; g.fillText('THE BAND — front, same scale', 50, oy - 10);
  const w = 1.8, cellPx = w * PX, s = Math.min(BH / (2.05 * PX), perW / cellPx);
  ROLE_LIST.forEach((role, i) => {
    const rr = tpose(role);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, 2.0, -0.05, 0.1, 50); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
    const ox = 50 + i * perW + (perW - cellPx * s) / 2;
    const img = renderView([rr.group], cam, cellPx, 2.05 * PX);
    g.drawImage(gridCanvas(w, 2.05, PX), ox, oy, cellPx * s, 2.05 * PX * s);
    g.drawImage(img, ox, oy, cellPx * s, 2.05 * PX * s);
    g.fillStyle = ROLES[role].color; g.font = 'bold 18px sans-serif'; g.textAlign = 'center';
    g.fillText(ROLES[role].name.toUpperCase(), ox + cellPx * s / 2, oy + 2.05 * PX * s + 22); g.textAlign = 'left';
  });
  return sheet.toDataURL('image/png');
};
window.makeGLB = function () {
  const root = new THREE.Group(); root.name = 'LooseWires_Robots_TPose';
  ROLE_LIST.forEach((role, i) => { const r = tpose(role); r.group.position.x = (i - 2.5) * 1.6; root.add(r.group); });
  return new Promise((res, rej) => new GLTFExporter().parse(root, (buf) => {
    const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); res(btoa(s));
  }, rej, { binary: true }));
};
window.ready = true;
