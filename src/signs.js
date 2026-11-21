import * as THREE from 'three';
import { toon, canvasTex } from './render.js';

const BOARD_COLS = ['#ffe066', '#ff8ad8', '#ffffff', '#8ff7e8', '#ffb347', '#c9ff8a'];
const INK = ['#1d1622', '#7a1450', '#1d3a8a', '#0e5a3a'];

// Hand-made cardboard signs held up by crowd members (readable from the stage and from the band cam).
export class CrowdSigns {
  constructor(scene, crowdPos, count = 12) {
    this.signs = [];
    const step = Math.max(1, Math.floor(crowdPos.length / count));
    for (let k = 0; k < count && k * step < crowdPos.length; k++) {
      const p = crowdPos[(k * step + 3) % crowdPos.length];
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry;
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), toon('#8a6a48')); stick.position.set(0.15, 1.7, 0.2); g.add(stick);
      const tex = canvasTex(256, 128, () => {}, false);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.62), mat); front.position.set(0.15, 2.25, 0.23); g.add(front);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.62), mat); back.position.set(0.15, 2.25, 0.21); back.rotation.y = Math.PI; g.add(back);
      g.visible = false; scene.add(g);
      this.signs.push({ g, tex, up: 0, target: 0, base: p.y, ph: Math.random() * 6.28, text: '', until: 0 });
    }
  }
  write(s, text, sub = '') {
    const c = s.tex.userData.ctx, W = 256, H = 128;
    const bg = BOARD_COLS[Math.floor(Math.random() * BOARD_COLS.length)], ink = INK[Math.floor(Math.random() * INK.length)];
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = sub ? 46 : 54; c.font = `${fs}px Bungee, Impact, sans-serif`;
    while (fs > 14 && c.measureText(text).width > W - 20) { fs -= 2; c.font = `${fs}px Bungee, Impact, sans-serif`; }
    c.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
    if (sub) { c.font = '24px Bungee, Impact, sans-serif'; c.fillText(sub, W / 2, H * 0.8); }
    c.fillStyle = '#e8304a'; c.font = '26px sans-serif'; c.fillText('♥', W - 22, 20);
    s.tex.needsUpdate = true; s.text = text;
  }
  // raise n signs with text for `secs` seconds
  raise(now, n, text, sub, secs = 8) {
    const free = this.signs.filter((s) => s.target === 0 || s.until < now).sort(() => Math.random() - 0.5);
    for (const s of free.slice(0, n)) { this.write(s, text, sub); s.target = 1; s.until = now + secs * (0.8 + Math.random() * 0.4); }
  }
  lowerAll() { for (const s of this.signs) { s.target = 0; s.until = 0; } }
  update(dt, now, beat, hype) {
    for (const s of this.signs) {
      if (s.target === 1 && now > s.until) s.target = 0;
      s.up += (s.target - s.up) * Math.min(1, dt * 4);
      s.g.visible = s.up > 0.02;
      const bob = Math.abs(Math.sin(beat * Math.PI + s.ph)) * (0.05 + hype * 0.18);
      s.g.position.y = s.base - 1.2 * (1 - s.up) + bob * s.up;
      s.g.rotation.z = Math.sin(beat * Math.PI * 0.5 + s.ph) * 0.12 * s.up;
    }
  }
}
