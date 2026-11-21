import * as THREE from 'three';
import { toon, canvasTex, basic } from './render.js';

export const ROLE_LIST = ['bass', 'guitar', 'synthA', 'synthB', 'drums', 'trumpet'];
export const ROLES = {
  bass: { name: 'Bass', bot: 'LOWE', color: '#2fa39a', eye: '#8ff7e8', desc: 'Intro, verse, chorus & outro — the backbone' },
  guitar: { name: 'Guitar', bot: 'SKANK-7', color: '#4f86d9', eye: '#bfe0ff', desc: 'Plays the whole song — offbeat skanks' },
  synthA: { name: 'Synth A', bot: 'MOOGLE', color: '#c04fa8', eye: '#ffb3f0', desc: 'Offbeat stabs from the verse on' },
  synthB: { name: 'Synth B', bot: 'DUBPLATE', color: '#7db63a', eye: '#d8ff9e', desc: 'Pads & swells — break, chorus, outro' },
  drums: { name: 'Drums', bot: 'BOOM-8', color: '#e0663c', eye: '#ffd27a', desc: 'One-drop hits — verse, chorus, outro' },
  trumpet: { name: 'Trumpet', bot: 'BRASSICA', color: '#d9a62e', eye: '#fff1a8', desc: 'The chorus horn line — lots of grooving' },
};

export function drawFace(g, expr, col) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, 32, 24);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 24; y += 2) g.fillRect(0, y, 32, 1);
  g.fillStyle = col;
  const eye = (x0) => {
    switch (expr) {
      case 'blink': g.fillRect(x0, 11, 5, 2); break;
      case 'happy': g.fillRect(x0, 11, 1, 2); g.fillRect(x0 + 1, 9, 1, 2); g.fillRect(x0 + 2, 8, 1, 2); g.fillRect(x0 + 3, 9, 1, 2); g.fillRect(x0 + 4, 11, 1, 2); break;
      case 'sad': g.fillRect(x0, 10, 5, 2); g.fillStyle = '#6fb6ff'; g.fillRect(x0 + 1, 13, 1, 3); g.fillStyle = col; break;
      case 'focus': g.fillRect(x0, 10, 5, 3); break;
      case 'wow': g.fillRect(x0, 7, 5, 1); g.fillRect(x0, 13, 5, 1); g.fillRect(x0, 7, 1, 7); g.fillRect(x0 + 4, 7, 1, 7); break;
      case 'meh': g.fillRect(x0, 11, 5, 2); break;
      case 'angry': g.fillRect(x0, 10, 5, 3); g.fillStyle = '#ff5a5a'; if (x0 < 16) { g.fillRect(x0, 6, 2, 1); g.fillRect(x0 + 2, 7, 2, 1); g.fillRect(x0 + 4, 8, 1, 1); } else { g.fillRect(x0 + 3, 6, 2, 1); g.fillRect(x0 + 1, 7, 2, 1); g.fillRect(x0, 8, 1, 1); } g.fillStyle = col; break;
      case 'note': g.fillRect(x0 + 3, 6, 1, 7); g.fillRect(x0 + 1, 12, 3, 2); g.fillRect(x0 + 4, 6, 2, 1); g.fillRect(x0 + 5, 7, 1, 1); break;
      default: g.fillRect(x0, 7, 5, 7);
    }
  };
  eye(8); eye(19);
  if (expr === 'happy' || expr === 'note') { g.fillRect(13, 17, 6, 1); g.fillRect(12, 16, 1, 1); g.fillRect(19, 16, 1, 1); }
  if (expr === 'wow') { g.fillRect(14, 16, 4, 3); }
  if (expr === 'meh') { g.fillRect(12, 17, 8, 1); }
  if (expr === 'angry') { g.fillRect(13, 18, 6, 1); g.fillRect(12, 19, 1, 1); g.fillRect(19, 19, 1, 1); }
  if (expr === 'sad') { g.fillRect(13, 18, 6, 1); g.fillRect(12, 19, 1, 1); g.fillRect(19, 19, 1, 1); }
}

const metal = '#8d8a86', dark = '#3b3a40';

export class Robot {
  constructor(role, { vendor = false } = {}) {
    this.role = role;
    const R = vendor ? { color: '#c9763c', eye: '#9fffd8' } : ROLES[role];
    this.eyeCol = R.eye;
    const g = this.group = new THREE.Group();
    this.body = new THREE.Group(); g.add(this.body);
    const mMetal = toon(metal), mDark = toon(dark), mCol = toon(R.color);
    const cyl = (r1, r2, h, m, seg = 6) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(0.11 * s, 0.74, 0);
      const leg = cyl(0.05, 0.04, 0.66, mDark); leg.position.y = -0.34; p.add(leg);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), mMetal); knee.position.y = -0.34; p.add(knee);
      const foot = box(0.13, 0.08, 0.22, mMetal); foot.position.set(0, -0.69, 0.04); p.add(foot);
      this.body.add(p); this.legs.push(p);
    }
    // torso + poncho
    const hips = box(0.32, 0.12, 0.22, mDark); hips.position.y = 0.78; this.body.add(hips);
    const torso = box(0.36, 0.42, 0.24, mMetal); torso.position.y = 1.02; this.body.add(torso);
    // bib overalls in the band colour over the metal frame
    const bib = box(0.34, 0.26, 0.26, mCol); bib.position.y = 0.92; this.body.add(bib);
    const front = box(0.24, 0.16, 0.02, mCol); front.position.set(0, 1.12, 0.125); this.body.add(front);
    const pocket = box(0.09, 0.07, 0.02, mDark); pocket.position.set(0, 1.1, 0.137); this.body.add(pocket);
    for (const s of [-1, 1]) {
      const strap = box(0.05, 0.3, 0.27, mCol); strap.position.set(s * 0.12, 1.1, 0); strap.rotation.z = s * -0.05; this.body.add(strap);
      const btn = box(0.035, 0.035, 0.02, toon('#d8d2c4')); btn.position.set(s * 0.1, 1.17, 0.137); this.body.add(btn);
    }
    const neck = cyl(0.04, 0.05, 0.14, mDark); neck.position.y = 1.32; this.body.add(neck);
    // head (monitor)
    this.head = new THREE.Group(); this.head.position.y = 1.52; this.body.add(this.head);
    const shell = box(0.48, 0.36, 0.34, mMetal); this.head.add(shell);
    const bezel = box(0.42, 0.3, 0.02, mDark); bezel.position.z = 0.17; this.head.add(bezel);
    this.faceTex = canvasTex(32, 24, (c) => drawFace(c, 'idle', R.eye));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.27), basic(0xffffff, { map: this.faceTex }));
    screen.position.z = 0.182; this.head.add(screen);
    const back = box(0.3, 0.24, 0.12, mDark); back.position.z = -0.2; this.head.add(back);
    const ant = cyl(0.01, 0.01, 0.22, mDark, 4); ant.position.set(0.14, 0.28, -0.05); this.head.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), basic(R.eye)); tip.position.set(0.14, 0.4, -0.05); this.head.add(tip);
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(0.24 * s, 1.18, 0);
      const a = cyl(0.035, 0.03, 0.52, mDark); a.position.y = -0.26; p.add(a);
      const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), mMetal); hnd.position.y = -0.54; p.add(hnd);
      this.body.add(p); this.arms.push(p);
    }
    // accessories
    const acc = toon(vendor ? '#e9d3a0' : '#f1e6d0');
    if (vendor) {
      const cap = cyl(0.26, 0.27, 0.08, toon('#d34a3a'), 8); cap.position.y = 0.21; this.head.add(cap);
      const brim = box(0.3, 0.02, 0.16, toon('#d34a3a')); brim.position.set(0, 0.18, 0.22); this.head.add(brim);
    } else if (role === 'drums') {
      const band = box(0.5, 0.06, 0.36, toon('#f2f2f2')); band.position.y = 0.12; this.head.add(band);
      const knot = box(0.08, 0.14, 0.03, toon('#f2f2f2')); knot.position.set(-0.18, 0.08, -0.18); knot.rotation.z = 0.5; this.head.add(knot);
    } else if (role === 'bass') {
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), toon('#204e4a'));
      beanie.scale.set(1, 0.6, 0.78); beanie.position.y = 0.16; this.head.add(beanie);
    } else if (role === 'trumpet') {
      const hat = cyl(0.15, 0.17, 0.14, toon('#3a2a20'), 8); hat.position.y = 0.26; this.head.add(hat);
      const brim = cyl(0.27, 0.27, 0.02, toon('#3a2a20'), 10); brim.position.y = 0.19; this.head.add(brim);
    } else if (role === 'synthA') {
      const visor = box(0.5, 0.07, 0.06, basic('#ff7ae6')); visor.position.set(0, 0.11, 0.19); this.head.add(visor);
    } else if (role === 'synthB') {
      for (const s of [-1, 1]) { const cup = cyl(0.11, 0.11, 0.08, toon('#222'), 8); cup.rotation.z = Math.PI / 2; cup.position.x = 0.27 * s; this.head.add(cup); }
      const bnd = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 4, 10, Math.PI), toon('#222')); bnd.position.y = 0.0; this.head.add(bnd);
    } else if (role === 'guitar') {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 4, 8), toon('#e8e2d0')); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.3; this.body.add(scarf);
      const tail = box(0.08, 0.3, 0.03, toon('#e8e2d0')); tail.position.set(0.08, 1.16, 0.14); this.body.add(tail);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.hand = new THREE.Group(); this.hand.position.set(0, 0.95, 0.32); this.body.add(this.hand);
    this.expr = 'idle'; this.exprT = 0; this.blinkT = 1 + Math.random() * 3; this.walkPh = 0; this.state = 'idle';
    this.t = Math.random() * 10;
  }
  setFace(expr, hold = 0) {
    if (hold) this.exprT = hold;
    if (expr === this.expr) return;
    this.expr = expr;
    drawFace(this.faceTex.userData.ctx, expr, this.eyeCol);
    this.faceTex.needsUpdate = true;
  }
  update(dt, speed = 0, beat = null) {
    this.t += dt;
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.setFace(this.baseExpr || 'idle'); }
    else {
      this.blinkT -= dt;
      if (this.blinkT < 0) { this.setFace('blink'); if (this.blinkT < -0.12) { this.blinkT = 2 + Math.random() * 3; this.setFace(this.baseExpr || 'idle'); } }
    }
    const [lL, lR] = this.legs, [aL, aR] = this.arms;
    this.body.position.y = 0; this.body.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    if (this.state === 'sit') {
      lL.rotation.x = lR.rotation.x = -1.45; aL.rotation.x = aR.rotation.x = -0.6;
      this.body.position.y = -0.32;
      this.head.rotation.y = Math.sin(this.t * 0.4) * 0.3;
    } else if (this.state === 'play') {
      const b = beat || 0;
      const bob = Math.abs(Math.sin(b * Math.PI));
      this.body.position.y = -bob * 0.05;
      this.head.rotation.x = bob * 0.18 - 0.05;
      lL.rotation.x = lR.rotation.x = 0;
      const r = this.role;
      if (r === 'drums') { aL.rotation.x = -0.9 - Math.max(0, Math.sin(b * Math.PI * 2)) * 0.6; aR.rotation.x = -0.9 - Math.max(0, Math.sin(b * Math.PI * 2 + Math.PI)) * 0.6; }
      else if (r === 'trumpet') { aL.rotation.x = aR.rotation.x = -1.35; this.head.rotation.x = -0.15 + bob * 0.1; }
      else if (r === 'synthA' || r === 'synthB') { aL.rotation.x = aR.rotation.x = -0.75; aL.rotation.z = Math.sin(b * Math.PI) * 0.15; aR.rotation.z = -Math.sin(b * Math.PI * 0.5) * 0.25; }
      else if (r === 'bass' || r === 'guitar') { aL.rotation.x = -0.6; aR.rotation.x = -0.4 - bob * 0.3; }
      else { aR.rotation.x = -1.4; aL.rotation.x = -0.3 - bob * 0.4; aL.rotation.z = 0.4; }
    } else if (this.state === 'dance') {
      const b = beat || this.t * 1.33;
      const ph = b * Math.PI;
      this.body.position.y = Math.abs(Math.sin(ph)) * 0.1;
      this.body.rotation.y = Math.sin(ph * 0.5) * 0.35; this.body.rotation.z = Math.sin(ph) * 0.08;
      aL.rotation.x = -2.7 + Math.sin(ph) * 0.25; aR.rotation.x = -2.7 - Math.sin(ph) * 0.25;
      aL.rotation.z = 0.35 + Math.sin(ph * 0.5) * 0.2; aR.rotation.z = -0.35 + Math.sin(ph * 0.5) * 0.2;
      lL.rotation.x = Math.max(0, Math.sin(ph)) * 0.4; lR.rotation.x = Math.max(0, -Math.sin(ph)) * 0.4;
      this.head.rotation.z = Math.sin(ph) * 0.15;
    } else if (this.state === 'cheer') {
      const b = Math.abs(Math.sin(this.t * 6));
      this.body.position.y = b * 0.15; aL.rotation.x = aR.rotation.x = -2.8; aL.rotation.z = 0.3; aR.rotation.z = -0.3;
    } else {
      aL.rotation.z = aR.rotation.z = 0;
      if (speed > 0.2) {
        this.walkPh += dt * (3 + speed * 1.6);
        const s = Math.sin(this.walkPh) * Math.min(0.7, 0.25 + speed * 0.09);
        lL.rotation.x = s; lR.rotation.x = -s; aL.rotation.x = -s * 0.8; aR.rotation.x = s * 0.8;
        this.body.position.y = Math.abs(Math.cos(this.walkPh)) * 0.04;
      } else {
        lL.rotation.x = lR.rotation.x = 0;
        aL.rotation.x = Math.sin(this.t * 1.5) * 0.04; aR.rotation.x = -aL.rotation.x;
        this.head.rotation.z = Math.sin(this.t * 0.7) * 0.05;
      }
      if (this.carrying) { aL.rotation.x = aR.rotation.x = -1.2; }
    }
  }
}

// Instanced crowd of simple robots
export class Crowd {
  constructor(scene, positions, faceTex) {
    const n = positions.length;
    const parts = [];
    const body = new THREE.CylinderGeometry(0.2, 0.32, 0.9, 7); body.translate(0, 0.75, 0);
    const head = new THREE.BoxGeometry(0.46, 0.34, 0.32); head.translate(0, 1.42, 0);
    this.bodyMesh = new THREE.InstancedMesh(body, toon('#ffffff'), n);
    this.headMesh = new THREE.InstancedMesh(head, toon('#8d8a86'), n);
    const scr = new THREE.PlaneGeometry(0.36, 0.25); scr.translate(0, 1.42, 0.165);
    this.faceMesh = new THREE.InstancedMesh(scr, basic(0xffffff, { map: faceTex }), n);
    const cols = ['#c9763c', '#4f8a6b', '#8a4f9c', '#d9b23e', '#3f6fae', '#b5493f', '#6e6a64'];
    this.pos = positions; this.ph = positions.map(() => Math.random() * 6.28); this.amp = positions.map(() => 0.6 + Math.random() * 0.6);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { c.set(cols[i % cols.length]); this.bodyMesh.setColorAt(i, c); }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    for (const m of [this.bodyMesh, this.headMesh, this.faceMesh]) { m.castShadow = true; scene.add(m); m.frustumCulled = false; }
    this.mood = 0; this.faces = { happy: faceTex, idle: crowdFaceTex('idle', '#bfd8d0'), meh: crowdFaceTex('meh', '#d8d4a0'), angry: crowdFaceTex('angry', '#ffb0a0') }; this.face = 'happy';
    this.update(0, 0, 0.3);
  }
  hop(i, t) { this.hopT = this.hopT || {}; this.hopT[i] = t; }
  setMood(m) {
    this.mood = m;
    const f = m > 0.6 ? 'angry' : m > 0.3 ? 'meh' : (this.reserved && !(this.warm > 0.72)) ? 'idle' : 'happy';
    if (f !== this.face) { this.face = f; this.faceMesh.material.map = this.faces[f]; this.faceMesh.material.needsUpdate = true; }
  }
  update(t, beat, hype) {
    const e = new THREE.Euler();
    for (let i = 0; i < this.pos.length; i++) {
      const p = this.pos[i];
      const m = this.mood || 0, calm = (1 - m) * (this.reserved ? 0.25 + 0.5 * smoothRamp(this.warm || 0) : 1);
      const b = Math.abs(Math.sin(beat * Math.PI + this.ph[i] * 0.15));
      let y = b * (0.04 + hype * 0.35) * this.amp[i] * calm;
      const ht = this.hopT && this.hopT[i] !== undefined ? t - this.hopT[i] : 9; if (ht < 0.6) y += Math.sin(ht / 0.6 * Math.PI) * 0.35;
      const shake = m > 0.5 && (i % 3 === 0) ? Math.sin(t * 9 + this.ph[i]) * 0.35 * m : 0;   // head-shakers
      const away = m > 0.75 && (i % 4 === 1) ? Math.PI * Math.min(1, (m - 0.75) * 4) : 0;    // turning their backs
      e.set(-0.12 * m * (i % 2), p.ry + Math.sin(t * 0.8 + this.ph[i]) * 0.2 * calm + shake + away, Math.sin(beat * Math.PI * 0.5 + this.ph[i]) * hype * 0.12 * calm);
      this.q.setFromEuler(e); this.v.set(p.x, p.y + y, p.z);
      this.m.compose(this.v, this.q, this.s);
      this.bodyMesh.setMatrixAt(i, this.m); this.headMesh.setMatrixAt(i, this.m); this.faceMesh.setMatrixAt(i, this.m);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = this.headMesh.instanceMatrix.needsUpdate = this.faceMesh.instanceMatrix.needsUpdate = true;
  }
}
const smoothRamp = (h) => Math.max(0, Math.min(1, (h - 0.45) / 0.4));
export function crowdFaceTex(expr = 'happy', col = '#9fffd8') { return canvasTex(32, 24, (c) => drawFace(c, expr, col)); }
