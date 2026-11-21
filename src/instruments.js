import * as THREE from 'three';
import { toon, basic } from './render.js';

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r1, r2, h, m, s = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m);

// Instrument props, built facing +z (player stands at z ~ -0.6 looking +z ... we orient later)
export function makeInstrument(role) {
  const g = new THREE.Group();
  const chrome = toon('#c9c6c0'), black = toon('#26252b');
  if (role === 'drums') {
    const shell = toon('#b8432e');
    const kick = cyl(0.42, 0.42, 0.45, shell, 12); kick.rotation.x = Math.PI / 2; kick.position.set(0, 0.42, 0.5); g.add(kick);
    const head = cyl(0.4, 0.4, 0.02, toon('#f4ecd8'), 12); head.rotation.x = Math.PI / 2; head.position.set(0, 0.42, 0.26); g.add(head);
    const snare = cyl(0.26, 0.26, 0.16, chrome, 12); snare.position.set(-0.45, 0.7, 0.05); g.add(snare);
    const tom = cyl(0.22, 0.22, 0.22, shell, 12); tom.position.set(0.15, 0.95, 0.45); tom.rotation.x = 0.3; g.add(tom);
    const floor = cyl(0.3, 0.3, 0.4, shell, 12); floor.position.set(0.62, 0.45, 0.1); g.add(floor);
    for (const [x, y, z] of [[-0.75, 1.05, 0.25], [0.7, 1.3, 0.55]]) {
      const st = cyl(0.015, 0.015, y, chrome, 4); st.position.set(x, y / 2, z); g.add(st);
      const cy = cyl(0.32, 0.04, 0.03, toon('#e0b84a'), 12); cy.position.set(x, y, z); cy.rotation.z = 0.15; g.add(cy);
    }
    const stool = cyl(0.18, 0.18, 0.08, black, 8); stool.position.set(0, 0.55, -0.45); g.add(stool);
    const sl = cyl(0.03, 0.03, 0.55, chrome, 4); sl.position.set(0, 0.27, -0.45); g.add(sl);
  } else if (role === 'bass' || role === 'guitar') {
    const amp = box(role === 'guitar' ? 0.6 : 0.7, role === 'guitar' ? 0.6 : 0.8, 0.45, role === 'guitar' ? toon('#d9c8a0') : black); amp.position.set(0, 0.4, 0.6); g.add(amp);
    const grill = box(0.6, 0.6, 0.02, toon('#45434c')); grill.position.set(0, 0.42, 0.37); g.add(grill);
    const stand = cyl(0.02, 0.02, 0.9, chrome, 4); stand.position.set(0.5, 0.45, 0.2); g.add(stand);
  } else if (role === 'trumpet') {
    for (let k = 0; k < 3; k++) { const leg = box(0.02, 0.02, 0.22, black); const a = k * 2.094; leg.position.set(Math.sin(a) * 0.09, 0.03, 0.55 + Math.cos(a) * 0.09); leg.rotation.y = a; g.add(leg); }
    const post = cyl(0.012, 0.012, 0.42, chrome, 5); post.position.set(0, 0.22, 0.55); g.add(post);
    const cone = cyl(0.03, 0.065, 0.12, black, 8); cone.position.set(0, 0.47, 0.55); g.add(cone);
    const horn = makeTrumpet(); horn.rotation.x = -Math.PI / 2; horn.position.set(0, 0.42, 0.55); horn.name = 'horn'; g.add(horn);
    g.userData.horn = horn;
  } else if (role === 'synthA' || role === 'synthB') {
    const legs = [[-0.5, 0.05], [0.5, 0.05]];
    for (const [x] of legs) { const l = box(0.05, 0.85, 0.05, chrome); l.position.set(x, 0.42, 0.35); l.rotation.x = 0.35; g.add(l); const l2 = l.clone(); l2.rotation.x = -0.35; g.add(l2); }
    const kb = box(1.2, 0.1, 0.38, toon(role === 'synthB' ? '#3a2a1a' : '#2a2733')); kb.position.set(0, 0.88, 0.35); g.add(kb);
    const keys = box(1.1, 0.03, 0.16, toon('#f1ece2')); keys.position.set(0, 0.945, 0.25); g.add(keys);
    for (let i = 0; i < 8; i++) { const k = box(0.03, 0.03, 0.03, basic(i % 2 ? '#ff7ae6' : '#7af0ff')); k.position.set(-0.45 + i * 0.12, 0.95, 0.47); g.add(k); }
    if (role === 'synthB') { const top = box(0.9, 0.1, 0.3, toon('#5a3a22')); top.position.set(0, 1.12, 0.45); top.rotation.x = -0.4; g.add(top); for (let i = 0; i < 6; i++) { const kn = cyl(0.03, 0.03, 0.04, toon('#e8e2d0'), 6); kn.position.set(-0.3 + i * 0.12, 1.19, 0.44); g.add(kn); } }
  } else if (role === 'turntable') {
    const tbl = box(1.5, 0.08, 0.6, toon('#3b2f2a')); tbl.position.set(0, 0.9, 0.35); g.add(tbl);
    for (const s of [-1, 1]) { const l = box(0.06, 0.9, 0.06, black); l.position.set(0.68 * s, 0.45, 0.35); g.add(l); }
    for (const s of [-1, 1]) {
      const deck = box(0.5, 0.08, 0.42, toon('#cfcac0')); deck.position.set(0.48 * s, 0.98, 0.35); g.add(deck);
      const rec = cyl(0.17, 0.17, 0.02, black, 14); rec.position.set(0.48 * s, 1.03, 0.35); g.add(rec); g.userData['rec' + s] = rec;
      const lbl = cyl(0.05, 0.05, 0.022, basic(s > 0 ? '#d8ff9e' : '#ff8a5c'), 8); lbl.position.set(0.48 * s, 1.035, 0.35); g.add(lbl);
    }
    const mix = box(0.24, 0.1, 0.36, black); mix.position.set(0, 0.99, 0.35); g.add(mix);
  } else if (role === 'vocals') {
    const st = cyl(0.015, 0.015, 1.45, chrome, 4); st.position.set(0, 0.72, 0.4); g.add(st);
    const base = cyl(0.18, 0.18, 0.03, black, 8); base.position.set(0, 0.02, 0.4); g.add(base);
    const mic = cyl(0.04, 0.025, 0.16, black, 6); mic.position.set(0, 1.5, 0.35); mic.rotation.x = -0.9; g.add(mic);
    const wedge = box(0.6, 0.3, 0.35, black); wedge.position.set(0, 0.15, 0.9); wedge.rotation.x = -0.4; g.add(wedge);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Handheld bits (attached to robot hand)
export function makeTrumpet() {
  const g = new THREE.Group();
  const brass = toon('#e3b64a'), brassD = toon('#b8862e'), silver = toon('#d8d4cc');
  const tube = (r, len, x, y, z, rotX = Math.PI / 2, m = brass) => { const c = cyl(r, r, len, m, 8); c.rotation.x = rotX; c.position.set(x, y, z); g.add(c); return c; };
  const mp = cyl(0.012, 0.022, 0.06, silver, 8); mp.rotation.x = Math.PI / 2; mp.position.set(0, 0, 0.03); g.add(mp);   // mouthpiece
  tube(0.013, 0.36, 0, 0, 0.24);                         // lead pipe
  tube(0.013, 0.30, 0, -0.07, 0.25);                     // lower slide
  const bend = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.013, 6, 10, Math.PI), brass); bend.rotation.y = Math.PI / 2; bend.position.set(0, -0.035, 0.42); bend.rotation.z = Math.PI / 2; g.add(bend);
  const bell = cyl(0.1, 0.014, 0.2, brass, 14); bell.rotation.x = -Math.PI / 2; bell.position.set(0, 0, 0.5); g.add(bell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 5, 16), brassD); rim.position.set(0, 0, 0.6); g.add(rim);
  for (let k = 0; k < 3; k++) {                          // valves
    const v = cyl(0.019, 0.019, 0.13, brass, 8); v.position.set(0, -0.03, 0.17 + k * 0.042); g.add(v);
    const cap = cyl(0.014, 0.014, 0.03, silver, 8); cap.position.set(0, 0.05, 0.17 + k * 0.042); g.add(cap);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Low-poly bass / guitar. Built lying along +x (neck), face toward +z, body centre at origin.
export function makeStringed(kind = 'bass') {
  const g = new THREE.Group();
  const bass = kind === 'bass';
  const bodyMat = toon(bass ? '#1f7f78' : '#c8372d'), guard = toon(bass ? '#efe6d2' : '#1d1b20');
  const wood = toon('#a8743f'), board = toon('#3a2618'), metal = toon('#d8d4cc'), black = toon('#222026');
  const T = 0.07;
  const disc = (r, x, y, m, t = T, z = 0) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 12), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c; };
  // body: lower bout, upper bout, waist and two horns
  disc(0.21, -0.2, -0.02, bodyMat);
  disc(0.16, 0.0, 0.0, bodyMat);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, T), bodyMat); waist.position.set(-0.1, -0.01, 0); g.add(waist);
  const hornA = disc(0.06, 0.13, 0.13, bodyMat); hornA.scale.set(1.4, 1, 1);
  const hornB = disc(0.05, 0.11, -0.12, bodyMat); hornB.scale.set(1.2, 1, 1);
  // pickguard + pickups + bridge + knobs
  const pg = disc(0.13, -0.06, 0.03, guard, 0.012, T / 2 + 0.004); pg.scale.set(1.3, 1, 1);
  for (const x of bass ? [-0.08, -0.2] : [-0.04, -0.13, -0.22]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.035, bass ? 0.09 : 0.075, 0.02), black); p.position.set(x, 0, T / 2 + 0.012); g.add(p); }
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.02), metal); br.position.set(-0.3, 0, T / 2 + 0.01); g.add(br);
  for (let k = 0; k < (bass ? 2 : 3); k++) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.025, 6), metal); kn.rotation.x = Math.PI / 2; kn.position.set(-0.3 + k * 0.05, -0.12, T / 2 + 0.01); g.add(kn); }
  // neck + fretboard + frets
  const L = bass ? 0.78 : 0.6;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.055, 0.04), wood); neck.position.set(0.12 + L / 2, 0, 0.005); g.add(neck);
  const fb = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.01), board); fb.position.set(0.12 + L / 2, 0, 0.03); g.add(fb);
  for (let k = 1; k < 12; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.062, 0.012), metal); f.position.set(0.12 + L - k * (L / 13) * (1 - k * 0.025), 0, 0.033); g.add(f); }
  // headstock + pegs
  const hs = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.085, 0.03), wood); hs.position.set(0.12 + L + 0.085, 0.01, 0); hs.rotation.z = 0.08; g.add(hs);
  const nS = bass ? 4 : 6;
  for (let k = 0; k < nS; k++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 5), metal);
    const along = bass ? k : k % 3, side = bass ? 1 : (k < 3 ? 1 : -1);
    peg.position.set(0.12 + L + 0.03 + along * 0.045, 0.05 * side + 0.01, 0); g.add(peg);
  }
  // strings
  for (let k = 0; k < nS; k++) {
    const y = (k - (nS - 1) / 2) * (bass ? 0.013 : 0.009);
    const st = new THREE.Mesh(new THREE.BoxGeometry(L + 0.42, 0.003, 0.003), metal); st.position.set(0.12 + L / 2 - 0.17, y, 0.04); g.add(st);
  }
  // strap button/strap stub
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.015), black); strap.position.set(0.18, 0.32, -0.06); strap.rotation.z = -0.5; strap.name = 'strap'; g.add(strap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Handheld bits (attached to robot hand)
export function makeHandheld(role) {
  const g = new THREE.Group();
  if (role === 'bass' || role === 'guitar') {
    const inst = makeStringed(role);
    inst.rotation.z = 0.5;           // neck up toward the robot's left
    inst.position.set(-0.04, -0.06, 0.04);
    g.add(inst);
  } else if (role === 'trumpet') {
    const t = makeTrumpet(); t.position.set(0, 0.0, -0.12); t.rotation.x = 0.12; g.add(t);
    g.position.set(0, 0.45, 0);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// First-person held instrument (in camera space)
export function makeFPInstrument(role) {
  if (role === 'bass' || role === 'guitar') {
    const g = new THREE.Group();
    const inst = makeStringed(role);
    const strap = inst.getObjectByName('strap'); if (strap) strap.visible = false;
    const neck = new THREE.Vector3(-1, 0.32, -0.45).normalize();
    let face = new THREE.Vector3(0.15, 0.75, 0.65); face.sub(neck.clone().multiplyScalar(face.dot(neck))).normalize();
    const y = new THREE.Vector3().crossVectors(face, neck);
    inst.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(neck, y, face));
    inst.position.set(0.12, -0.42, -0.62);
    g.add(inst);
    return g;
  }
  if (role === 'trumpet') {
    const g = new THREE.Group();
    const t = makeTrumpet(); t.rotation.y = Math.PI + 0.12; t.rotation.x = 0.22; t.position.set(0.06, -0.19, -0.2); t.scale.setScalar(0.85); g.add(t);
    return g;
  }
  return null;
}

export function makeItem(kind) {
  const g = new THREE.Group();
  if (kind === 'cell') {
    const c = cyl(0.14, 0.14, 0.42, toon('#2a2d36'), 8); g.add(c);
    const band = cyl(0.145, 0.145, 0.2, basic('#4ff0ff'), 8); g.add(band);
    const cap = cyl(0.07, 0.07, 0.06, toon('#c9c6c0'), 8); cap.position.y = 0.24; g.add(cap);
  } else if (kind === 'kit') {
    const b = box(0.46, 0.22, 0.22, toon('#c8372d')); g.add(b);
    const h = box(0.2, 0.06, 0.04, toon('#26252b')); h.position.y = 0.15; g.add(h);
    const l = box(0.47, 0.03, 0.23, toon('#e6c34a')); l.position.y = 0.05; g.add(l);
  } else if (kind === 'oil') {
    const c = cyl(0.1, 0.12, 0.3, toon('#3f7a4a'), 8); g.add(c);
    const sp = cyl(0.015, 0.03, 0.2, toon('#c9c6c0'), 5); sp.position.set(0.05, 0.22, 0); sp.rotation.z = -0.6; g.add(sp);
    const lb = cyl(0.105, 0.125, 0.12, toon('#f2e4b0'), 8); g.add(lb);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export const ITEMS = {
  cell: { name: 'Power Cell', price: 15, desc: 'Plug into the van\'s rear charge port' },
  kit: { name: 'Repair Kit', price: 20, desc: 'Fix the van at the engine hatch' },
  oil: { name: 'Oil Can', price: 5, desc: 'Drink with F — hype boost at the next show' },
};
