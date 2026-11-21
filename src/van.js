import * as THREE from 'three';
import { toon, basic, canvasTex, neonTex } from './render.js';
import { clamp, lerp } from './util.js';
import { makeInstrument } from './instruments.js';

export const GEARS = ['R', 'N', '1', '2', '3', '4', '5'];
const RATIO = { R: -3.0, N: 0, 1: 2.8, 2: 1.8, 3: 1.25, 4: 0.95, 5: 0.74 };
export const GATE = { '1': [-1, 1], '2': [-1, -1], '3': [0, 1], '4': [0, -1], '5': [1, 1], R: [1, -1], N: [0, 0] };
const slotGear = (col, up) => ({ '-1': up ? '1' : '2', '0': up ? '3' : '4', '1': up ? '5' : 'R' })[String(col)];
const K = 225;

// ---------------------------------------------------------------- vehicle specs
// local space: +z forward, +x = left (driver side), -x = right (door side)
const P2 = Math.PI / 2;
export const SPECS = {
  van: {
    name: 'Van', title: 'the camper van', F: 0.62, W: 1.05, IW: 0.97, ZB: -2.4, ZF: 2.15, TOP: 2.54, driverX: 0.45,
    wheelR: 0.38, track: 0.98, axleF: 1.35, axleR: -1.45, wheelbase: 3.4, power: 1.1, vmax: 21, maxSteer: 0.5, steerV: 8, steerRate: 3, drain: 0.4, solar: false, grip: 7.2,
    colZ: [1.3, -1.3], colR: 1.15, orbit: 9, chase: [4.2, -10], exit: [-2.6, -0.55], mirrorCam: [0, 2.2, -2.7], mirror: [0.0, 1.62],
    smoke: [0.5, 0.9, -2.7], wipers: [[0.35, 0.72], [-0.55, 0.72]],
    seats: {
      driver: { p: [0.45, 0.62, 0.7], yaw: 0, stand: [-0.45, 0.05, P2 * 2] },
      shotgun: { p: [-0.45, 0.62, 0.7], yaw: 0, stand: [-0.45, 0.05, P2 * 2] },
      row1A: { p: [0.66, 0.62, -0.38], yaw: 0, stand: [-0.48, -0.38, 0] },
      row1B: { p: [0.16, 0.62, -0.38], yaw: 0, stand: [-0.48, -0.38, 0] },
      row2A: { p: [0.6, 0.62, -1.45], yaw: 0, stand: [-0.48, -0.95, 0] },
      row2B: { p: [0.0, 0.62, -1.45], yaw: 0, stand: [-0.48, -0.95, 0] },
      row2C: { p: [-0.6, 0.62, -1.45], yaw: 0, stand: [-0.48, -0.95, 0] },
    },
    botSeats: ['shotgun', 'row1A', 'row1B', 'row2A', 'row2B'],
  },
  rv: {
    name: 'RV', title: 'the RV', F: 1.0, W: 1.45, IW: 1.35, ZB: -5.8, ZF: 5.3, TOP: 3.53, driverX: 0.72,
    wheelR: 0.58, track: 1.5, axleF: 3.75, axleR: -3.4, wheelbase: 6.2, power: 1.6, vmax: 32, maxSteer: 0.55, steerV: 16, steerRate: 4, drain: 1, solar: true, grip: 6.0,
    colZ: [4.6, 1.6, -1.6, -4.6], colR: 1.6, orbit: 13, chase: [6, -15], exit: [-4.2, 1.2], mirrorCam: [0, 3.0, -6.2], mirror: [0.12, 1.82],
    smoke: [0, 1.8, 5.8], wipers: [[0.62, 0.85], [-0.38, 0.85]],
    roofY: 3.65,
    ladder: { bottom: [0.9, 0.05, -6.35], top: [0.9, 3.67, -5.35] },
    seats: {
      driver: { p: [0.72, 1.0, 3.85], yaw: 0, stand: [0, 3.3, P2 * 2] },
      shotgun: { p: [-0.72, 1.0, 3.85], yaw: 0, stand: [0, 3.3, P2 * 2] },
      sofaA: { p: [0.92, 1.0, 2.35], yaw: Math.PI, stand: [0.15, 2.35, Math.PI] },
      sofaB: { p: [0.92, 1.0, 0.72], yaw: 0, stand: [0.15, 0.72, 0] },
      benchA: { p: [-1.02, 1.0, 0.12], yaw: P2, stand: [-0.4, 0.12, P2] },
      benchB: { p: [-1.02, 1.0, -0.5], yaw: P2, stand: [-0.4, -0.5, P2] },
      roofA: { p: [-0.55, 3.65, 0.9], yaw: 0, roof: true, stand: [-0.22, 0.3, 0] },
      roofB: { p: [0.55, 3.65, 0.9], yaw: 0, roof: true, stand: [0.22, 0.3, 0] },
    },
    botSeats: ['shotgun', 'sofaA', 'sofaB', 'benchA', 'benchB'],
  },
  bus: {
    name: 'Tour Bus', title: 'the tour bus', F: 1.35, W: 1.28, IW: 1.18, ZB: -6.6, ZF: 6.6, TOP: 3.45, driverX: 0.72,
    wheelR: 0.52, track: 1.2, axleF: 4.9, axleR: -4.2, wheelbase: 8.6, power: 1.22, vmax: 26, maxSteer: 0.52, steerV: 13, steerRate: 3, drain: 0.5, solar: false, grip: 5.2,
    colZ: [5.6, 2.8, 0, -2.8, -5.6], colR: 1.4, orbit: 17, chase: [7.5, -19], exit: [-3.9, 6.0], cams: true,
    smoke: [0, 3.4, -6.2], wipers: [[0.75, 1.05], [-0.55, 1.05]],
    seats: {
      driver: { p: [0.72, 1.35, 5.72], yaw: 0, stand: [0, 4.95, P2 * 2] },
      sofaL1: { p: [0.86, 1.35, 3.45], yaw: -P2, stand: [0, 3.45, -P2] },
      sofaL2: { p: [0.86, 1.35, 2.8], yaw: -P2, stand: [0, 2.8, -P2] },
      sofaR1: { p: [-0.86, 1.35, 3.45], yaw: P2, stand: [0, 3.45, P2] },
      sofaR2: { p: [-0.86, 1.35, 2.8], yaw: P2, stand: [0, 2.8, P2] },
      dinA1: { p: [0.94, 1.35, 1.95], yaw: Math.PI, stand: [-0.15, 1.95, Math.PI] },
      dinA2: { p: [0.5, 1.35, 1.95], yaw: Math.PI, stand: [-0.15, 1.95, Math.PI] },
      dinB1: { p: [0.94, 1.35, 0.62], yaw: 0, stand: [-0.15, 0.62, 0] },
      dinB2: { p: [0.5, 1.35, 0.62], yaw: 0, stand: [-0.15, 0.62, 0] },
    },
    botSeats: ['sofaL1', 'sofaR1', 'sofaR2', 'dinA1', 'dinB1'],
  },
};

export class Van {
  constructor(scene, world, audio, type = 'rv') {
    this.type = type; this.spec = SPECS[type];
    const S = this.spec;
    this.world = world; this.audio = audio; this.scene = scene;
    this.seats = S.seats; this.floor = S.F; this.roofY = S.roofY; this.dims = { ZB: S.ZB, ZF: S.ZF, W: S.W, IW: S.IW, F: S.F, TOP: S.TOP };
    this.root = new THREE.Group(); scene.add(this.root);
    this.hit = {};
    this.build();
    this.v = 0; this.heading = 0; this.steer = 0; this.y = 0; this.vy = 0; this.pitch = 0; this.roll = 0;
    this.engineOn = false; this.rpm = 0; this.gear = 'N'; this.handbrake = true; this.headlights = false;
    this.knob = { x: 0, y: 0 }; this.grindT = 0;
    this.fuel = 100; this.health = 100; this.crank = 0; this.stallT = 0; this.radioOn = false;
    this.jolt = 0; this.shake = 0; this.odometer = 0; this.wheelRot = 0; this.dashT = 0;
    this.pos = new THREE.Vector3();
    this.onToast = () => {};
    this.active = false;
  }
  // ------------------------------------------------------------ build helpers
  build() {
    const S = this.spec, R = this.root;
    this.cols = [];
    this.meshBx = (x0, x1, y0, y1, z0, z1, m, { solid = true, parent = R, cast = true, inner = -1, panel = null } = {}) => {
      let mat = m;
      if (inner >= 0) { mat = [m, m, m, m, m, m]; mat[inner] = panel || this.panelMat; }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mesh.castShadow = cast; mesh.receiveShadow = true;
      parent.add(mesh);
      if (solid) this.cols.push([x0, x1, y0, y1, z0, z1]);
      return mesh;
    };
    this.walls = new THREE.Group(); R.add(this.walls);
    this.roof = new THREE.Group(); R.add(this.roof);
    this.interior = new THREE.Group(); R.add(this.interior);
    this.glass = new THREE.MeshToonMaterial({ color: '#8cc4d6', transparent: true, opacity: 0.18, depthWrite: false });
    this.rack = [];
    if (this.type === 'van') this.buildVan(); else if (this.type === 'bus') this.buildBus(); else this.buildRV();
    this.buildCab();
    this.buildWheels();
    this.dress();
    // seat hitboxes
    for (const [k, s] of Object.entries(S.seats)) this.hb('seat_' + k, s.p[0] - 0.35, s.p[0] + 0.35, s.p[1] + 0.1, s.p[1] + 1.1, s.p[2] - 0.35, s.p[2] + 0.35);
    this.smoke = [];
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), toon('#555')); s.visible = false; this.scene.add(s); this.smoke.push({ m: s, life: 0 }); }
  }
  hb(name, x0, x1, y0, y1, z0, z1, parent = this.root) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); parent.add(m); m.userData.name = name; this.hit[name] = m; return m;
  }
  seatBox(x, z, col = '#8f8a86', col2 = '#a49e98', w = 0.32) {
    const F = this.spec.F, ip = { parent: this.interior };
    this.meshBx(x - w, x + w, F, F + 0.48, z - 0.3, z + 0.3, toon(col), ip);
    this.meshBx(x - w, x + w, F + 0.48, F + 1.35, z - 0.4, z - 0.25, toon(col2), ip);
  }
  lights(front, back, hx, hy, tx, ty, round = 0) {
    const F = this.spec.F, R = this.root, bx = this.meshBx;
    this.lampMat = basic('#6b6352'); this.tailMat = basic('#5a1a1a');
    for (const s of [-1, 1]) {
      if (round) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(round + 0.035, round + 0.035, 0.06, 14), toon('#c9c6c0')); ring.rotation.x = Math.PI / 2; ring.position.set(s * hx, F + hy + 0.12, front); this.walls.add(ring);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(round, round, 0.07, 14), this.lampMat); lens.rotation.x = Math.PI / 2; lens.position.set(s * hx, F + hy + 0.12, front + 0.01); this.walls.add(lens);
      } else bx(s * hx - 0.2, s * hx + 0.2, F + hy, F + hy + 0.25, front, front + 0.05, this.lampMat, { solid: false });
    }
    for (const s of [-1, 1]) bx(s * tx - 0.14, s * tx + 0.14, F + ty, F + ty + 0.4, back - 0.05, back, this.tailMat, { solid: false });
    this.headL = [];
    for (const s of [-1, 1]) {
      const sp = new THREE.SpotLight('#ffe9c0', 0, 50, 0.5, 0.5, 1.2); sp.position.set(hx * s, F + hy, front + 0.1);
      sp.target.position.set(hx * s, 0, front + 14); R.add(sp, sp.target); this.headL.push(sp);
    }
  }
  buildWheels() {
    const S = this.spec, R = S.wheelR, wide = 0.34;
    this.wheels = [];
    const zs = this.type === 'bus' ? [S.axleF, S.axleR + 0.65, S.axleR - 0.65] : [S.axleF, S.axleR];
    const tyre = toon('#1c1b20'), wall = toon('#2c2a30'), rim = toon(this.type === 'van' ? '#e8e2d4' : this.type === 'bus' ? '#b9bcc4' : '#d8d2c4'), well = basic('#0c0b0e'), flare = toon(this.type === 'van' ? '#b85e2c' : this.type === 'bus' ? '#15151a' : '#8a4a2e');
    const xv = S.W + 0.04 - wide / 2; // outer face sits just proud of the body, inside an arch
    for (const z of zs) for (const s of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(s * xv, R, z); this.root.add(piv);
      const spin = new THREE.Group(); piv.add(spin);
      const mk = (geo, mat, x = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.z = Math.PI / 2; m.position.x = x; m.castShadow = true; spin.add(m); return m; };
      mk(new THREE.CylinderGeometry(R, R, wide, 14), tyre);
      mk(new THREE.CylinderGeometry(R * 0.8, R * 0.8, wide + 0.02, 14), wall);
      mk(new THREE.CylinderGeometry(R * 0.6, R * 0.6, wide + 0.05, 10), rim);
      mk(new THREE.CylinderGeometry(R * 0.2, R * 0.2, wide + 0.1, 8), toon('#8d8a86'));
      for (let k = 0; k < 5; k++) { const lug = new THREE.Mesh(new THREE.BoxGeometry(0.03, R * 0.1, R * 0.1), toon('#55524e')); const a = k / 5 * 6.283; lug.position.set(s * (wide / 2 + 0.03), Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4); spin.add(lug); }
      // wheel well + arch flare on the body side
      const wl = new THREE.Mesh(new THREE.CircleGeometry(R + 0.1, 14, 0, Math.PI), well); wl.rotation.y = s * Math.PI / 2; wl.position.set(s * (S.W + 0.012), R - 0.02, z); this.walls.add(wl);
      const fl = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.05, 5, 12, Math.PI), flare); fl.rotation.y = Math.PI / 2; fl.position.set(s * (S.W + 0.02), R - 0.02, z); fl.scale.z = 1.6; this.walls.add(fl);
      // mud flap behind the wheel
      const mf = new THREE.Mesh(new THREE.BoxGeometry(0.03, R * 0.9, wide), toon('#18171b')); mf.rotation.y = Math.PI / 2; mf.position.set(s * xv, R * 0.75, z - R - 0.16); this.walls.add(mf);
      this.wheels.push({ piv, w: spin, front: z === S.axleF });
    }
  }
  // exterior detail so each vehicle reads as a real one (visual only; no collision)
  dress() {
    const S = this.spec, F = S.F, W = S.W, ZB = S.ZB, ZF = S.ZF, TOP = S.TOP, P2_ = Math.PI / 2;
    const add = (mesh, x, y, z, parent = this.walls) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? toon(m) : m);
    const chrome = toon('#c9c6c0'), dark = toon('#1c1b20'), amber = basic('#ffb347'), red = basic('#c0281e');
    // a curved panel across the front: vertical cylinder segment whose chord spans the body width
    const curved = (R, y0, y1, zFace, mat, halfW = W) => { const half = Math.asin(Math.min(0.999, halfW / R)); const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, y1 - y0, 12, 1, false, -half, half * 2), mat); return add(m, 0, (y0 + y1) / 2, zFace - R * Math.cos(half)); };
    if (this.type === 'van') {
      const lower = toon('#d9763a'), upper = toon('#efe6d2'), BL = F + 0.82;
      // rounded two-tone nose with a curved bumper
      curved(2.0, 0.42, BL - 0.3, ZF + 0.25, lower); curved(2.005, BL - 0.3, BL + 0.02, ZF + 0.25, upper);
      curved(2.09, 0.34, 0.54, ZF + 0.25, chrome, W + 0.05);
      for (const s of [-1, 1]) add(box(0.09, 0.3, 0.08, chrome), s * 0.42, 0.5, ZF + 0.6); // overriders
      const emb = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), chrome); emb.rotation.x = P2_; add(emb, 0, BL - 0.42, ZF + 0.545);
      const emb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), lower); emb2.rotation.x = P2_; add(emb2, 0, BL - 0.42, ZF + 0.55);
      for (const s of [-1, 1]) { const ind = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), amber); ind.rotation.x = P2_; add(ind, s * 0.74, F + 0.02, ZF + 0.4); }
      // split windscreen: centre pillar + visor, wipers already there
      add(box(0.07, 0.9, 0.06, upper), 0, BL + 0.44, ZF + 0.01);
      const visor = add(box(W * 2 + 0.06, 0.05, 0.3, upper), 0, F + 1.72, ZF + 0.12); visor.rotation.x = 0.25;
      // sills, belt-line trim, rear bumper details, tail-light housings, roof gutter
      for (const s of [-1, 1]) { add(box(0.03, 0.05, ZF - ZB, chrome), s * (W + 0.015), BL + 0.01, (ZF + ZB) / 2); add(box(0.05, 0.06, ZF - ZB + 0.1, upper), s * (W + 0.02), TOP + 0.02, (ZF + ZB) / 2); }
      for (const s of [-1, 1]) add(box(0.09, 0.3, 0.08, chrome), s * 0.45, 0.5, ZB - 0.18);
      add(box(0.5, 0.16, 0.02, '#e8e2d0'), 0, F + 0.05, ZB - 0.03); // number plate
      add(box(0.7, 0.05, 0.05, chrome), 0, F + 0.72, ZB - 0.04); // tailgate handle
      this.mirrors(1.5, F + 1.0, 0.22, 0.22);
      this.addAutoDoor({ side: -1, z0: -1.2, z1: 0.1, y0: F, y1: F + 1.75, kind: 'slide', dir: -1, mat: lower, glassFrom: BL, trim: null });
    } else if (this.type === 'rv') {
      const cream = toon('#e6dcc4'), stripe = toon('#8a4a2e'), stripe2 = toon('#c9763c');
      // sloped hood, grille surround, front apron
      const hood = add(box(W * 2 - 0.1, 0.06, 0.82, cream), 0, F + 0.86, ZF + 0.38); hood.rotation.x = 0.26;
      add(box(2.75, 0.06, 0.05, chrome), 0, F + 0.58, ZF + 0.79); add(box(2.75, 0.06, 0.05, chrome), 0, F + 0.07, ZF + 0.79);
      for (let k = 0; k < 4; k++) add(box(2.5, 0.03, 0.03, chrome), 0, F + 0.17 + k * 0.1, ZF + 0.79);
      for (const s of [-1, 1]) { const ind = add(box(0.2, 0.1, 0.04, amber), s * 0.98, F - 0.08, ZF + 0.79); void ind; }
      add(box(0.5, 0.16, 0.02, '#e8e2d0'), 0, 0.62, ZF + 0.96);
      // cab-over front: window band + marker lights, windscreen pillars and visor
      for (let k = -2; k <= 2; k++) add(box(0.12, 0.06, 0.04, amber), k * 0.5, TOP + 0.02, 4.62);
      for (const s of [-1, 0, 1]) add(box(0.07, 1.05, 0.07, cream), s * (S.IW - 0.02), F + 1.47, ZF + 0.01);
      const visor = add(box(W * 2, 0.05, 0.36, cream), 0, F + 2.08, ZF + 0.15); visor.rotation.x = 0.2;
      // awning roll (door side), roof AC shroud, vents
      const aw = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 8), cream); aw.rotation.x = P2_; add(aw, -W - 0.11, TOP - 0.12, -1.7);
      for (const z of [-4.4, 1.0]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 8), stripe); cap.rotation.x = P2_; add(cap, -W - 0.11, TOP - 0.12, z); add(box(0.05, 0.3, 0.05, chrome), -W - 0.05, TOP - 0.3, z); }
      const awStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 1.2, 8), stripe2); awStripe.rotation.x = P2_; add(awStripe, -W - 0.11, TOP - 0.12, -1.7);
      // skirt, running boards, service hatches, fuel/charge door
      for (const s of [-1, 1]) { add(box(0.03, 0.2, ZF - ZB - 0.2, '#b9ad94'), s * (W + 0.012), F - 0.14, (ZF + ZB) / 2 - 0.1); for (const z of [-2.2, -0.6]) { add(box(0.02, 0.5, 0.9, '#d8cdb2'), s * (W + 0.012), F + 0.3, z); add(box(0.03, 0.04, 0.12, chrome), s * (W + 0.025), F + 0.46, z + 0.3); } }
      // back: spare wheel, bumper, plate, high brake light
      const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 14), dark); spare.rotation.x = P2_; add(spare, -0.55, F + 0.58, ZB - 0.12);
      const spareCap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14), cream); spareCap.rotation.x = P2_; add(spareCap, -0.55, F + 0.58, ZB - 0.13);
      add(box(W * 2 + 0.1, 0.22, 0.2, '#8a3a22'), 0, 0.6, ZB - 0.12); add(box(0.5, 0.16, 0.02, '#e8e2d0'), 0.2, 0.62, ZB - 0.23);
      add(box(0.6, 0.07, 0.04, red), 0, TOP - 0.2, ZB - 0.02);
      this.mirrors(4.55, F + 1.45, 0.34, 0.34);
      this.addAutoDoor({ side: -1, z0: 0.6, z1: 1.75, y0: F, y1: F + 2.15, kind: 'hinge', mat: cream, glassFrom: F + 1.15, trim: { y: F + 0.62, mat: stripe } });
    } else {
      const body = toon('#23252e'), accent = toon('#7af0ff'), panel = toon('#2f323d');
      // rounded front cap, raked visor, grille, plate
      curved(4.2, 0.44, F + 0.85, ZF + 0.2, body); curved(4.28, 0.4, 0.74, ZF + 0.2, chrome, W + 0.04);
      curved(4.205, F + 0.2, F + 0.3, ZF + 0.2, accent);
      for (let k = 0; k < 4; k++) add(box(1.1, 0.03, 0.03, dark), 0, F - 0.25 + k * 0.09, ZF + 0.41);
      add(box(0.5, 0.16, 0.02, '#e8e2d0'), 0, 0.57, ZF + 0.43);
      const visor = add(box(W * 2, 0.07, 0.5, body), 0, TOP - 0.1, ZF + 0.2); visor.rotation.x = 0.3;
      for (const s of [-1, 1]) add(box(0.09, TOP - F - 0.9, 0.09, body), s * (S.IW + 0.02), (F + 0.85 + TOP) / 2, ZF + 0.01);
      for (let k = -2; k <= 2; k++) add(box(0.14, 0.05, 0.04, amber), k * 0.45, TOP + 0.1, ZF - 0.02);
      // sides: chrome sill, luggage-bay hatches between the axles, roof-edge trim, indicator repeaters
      for (const s of [-1, 1]) {
        add(box(0.03, 0.06, ZF - ZB, chrome), s * (W + 0.014), F - 0.5, (ZF + ZB) / 2);
        add(box(0.05, 0.08, ZF - ZB, panel), s * (W + 0.02), TOP + 0.04, (ZF + ZB) / 2);
        for (let k = 0; k < 4; k++) { const z = 2.9 - k * 1.55; add(box(0.02, 0.5, 1.4, panel), s * (W + 0.012), F - 0.2, z); add(box(0.03, 0.04, 0.14, chrome), s * (W + 0.026), F - 0.06, z); }
        add(box(0.03, 0.08, 0.16, amber), s * (W + 0.015), F + 0.3, ZF - 1.0);
      }
      // back: engine cover frame, bumper, plate, high-level lights
      add(box(W * 2 + 0.06, 0.26, 0.16, chrome), 0, 0.56, ZB - 0.08); add(box(0.5, 0.16, 0.02, '#e8e2d0'), 0, F + 0.9, ZB - 0.02);
      for (const s of [-1, 1]) add(box(0.3, 0.07, 0.04, red), s * 0.9, TOP - 0.15, ZB - 0.02);
      add(box(1.9, 0.9, 0.03, '#0d1418'), 0, F + 1.6, ZB - 0.015); // rear window
      this.mirrors(ZF - 0.1, TOP - 0.55, 0.55, 0.55, true);
      const dm = body, tr = { y: F + 0.55, mat: accent };
      this.addAutoDoor({ side: -1, z0: 5.58, z1: 6.46, y0: F, y1: F + 2.0, kind: 'slide', dir: -1, mat: dm, glassFrom: F + 0.7, trim: null });
      this.addAutoDoor({ side: -1, z0: -1.98, z1: -1.1, y0: F, y1: F + 2.0, kind: 'slide', dir: -1, mat: dm, glassFrom: F + 0.85, trim: tr });
      this.addAutoDoor({ side: -1, z0: -5.6, z1: -4.9, y0: F, y1: F + 2.0, kind: 'slide', dir: 1, mat: dm, trim: tr });
      this.addAutoDoor({ side: 1, z0: -0.95, z1: -0.2, y0: F, y1: F + 2.0, kind: 'slide', dir: -1, mat: dm, glassFrom: F + 0.85, trim: tr });
    }
  }
  // Use a loaded 3D model as the outside of the vehicle. The box-built walls stay as the walk-in interior:
  // the model is shown when you look at the vehicle from outside, the interior shell when you're inside it.
  attachModel(scene, cfg) {
    const S = this.spec, shell = new THREE.Group(); shell.add(scene);
    scene.scale.set(...cfg.scale); scene.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(scene);
    scene.position.set(cfg.xShift || 0, -bb.min.y, cfg.zShift || 0); scene.updateMatrixWorld(true);
    // door openings cut out of the model (vehicle-local boxes), done in the shader
    const holes = cfg.holes.map((h) => [new THREE.Vector3(h[0], h[2], h[4]), new THREE.Vector3(h[1], h[3], h[5])]);
    this.shellU = { uInvRoot: { value: new THREE.Matrix4() }, uHoleMin: { value: holes.map((h) => h[0]) }, uHoleMax: { value: holes.map((h) => h[1]) } };
    const cut = (mat) => {
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, this.shellU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uInvRoot;\nvarying vec3 vVeh;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvVeh = (uInvRoot * modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vVeh;\nuniform vec3 uHoleMin[${holes.length}];\nuniform vec3 uHoleMax[${holes.length}];`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nfor (int i = 0; i < ${holes.length}; i++) { if (all(greaterThan(vVeh, uHoleMin[i])) && all(lessThan(vVeh, uHoleMax[i]))) discard; }`);
      };
      mat.customProgramCacheKey = () => 'shellholes' + holes.length;
      return mat;
    };
    const mats = new Map(); this.shellSpin = []; this.shellLamps = [];
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material, name = src.name || '';
      box.setFromObject(o);
      if (cfg.hide && cfg.hide(o, name, box)) { o.visible = false; return; }
      if (cfg.spin && cfg.spin(o, name)) this.shellSpin.push(o.parent && !o.parent.isScene && o.parent.children.length === 1 ? o.parent : o);
      if (!mats.has(src)) {
        let m;
        if (/window|glass/i.test(name)) m = new THREE.MeshToonMaterial({ color: '#1c2a33', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
        else { m = toon('#ffffff', { map: src.map || null, side: THREE.DoubleSide }); if (!src.map) m.color.copy(src.color); if (cfg.tint) cfg.tint(m, name); }
        if (src.emissiveMap) { m.emissiveMap = src.emissiveMap; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.25; this.shellLamps.push(m); }
        mats.set(src, cut(m));
      }
      o.material = mats.get(src); o.castShadow = !o.material.transparent; o.receiveShadow = true;
    });
    this.root.add(shell); this.shell = shell;
    // everything box-built on the outside becomes "interior view only"
    for (const c of [...this.root.children]) if (c.isMesh && !c.userData.ext && c.material && c.material.visible !== false) this.walls.add(c);
    // doors stay visible from both views, painted to match the model
    const doorMat = toon(cfg.doorColor);
    for (const d of [...(this.autoDoors || []), ...Object.values(this.doors || {})]) {
      this.root.add(d.piv);
      d.piv.traverse((m) => { if (m.isMesh && m.material !== this.glass && m.material.visible !== false && m.geometry.parameters.depth > 0.3 && m.geometry.parameters.width > 0.06) m.material = doorMat; });
    }
    // own wheels: either hidden (the model's axles spin) or moved to where the model's wheels are
    if (cfg.wheels) { this.wheels.forEach((w, i) => { const p = cfg.wheels.pos[i]; w.piv.position.set(p[0], cfg.wheels.r, p[1]); w.piv.scale.setScalar(cfg.wheels.r / S.wheelR); }); S.wheelR = cfg.wheels.r; }
    else for (const w of this.wheels) w.piv.visible = false;
    if (cfg.axles) { S.axleF = cfg.axles[0]; S.axleR = cfg.axles[1]; }
    if (cfg.ladder) { S.ladder = cfg.ladder; const dx = cfg.ladder.bottom[0] - this.hit.ladder.position.x; this.hit.ladder.position.x += dx; this.hit.ladderTop.position.x += dx; this.hit.ladder.position.z = cfg.ladder.bottom[2] + 0.25; }
    if (cfg.after) cfg.after(this);
    this.inside = null; this.setView(false);
  }
  setView(inside) {
    if (!this.shell || inside === this.inside) return;
    this.inside = inside;
    this.shell.visible = !inside; this.walls.visible = inside;
    for (const c of this.roof.children) c.visible = inside || !!c.userData.keep;
    for (const c of this.interior.children) if (c.userData.insideOnly) c.visible = inside;
  }
  // side mirrors on arms
  mirrors(z, y, armLen, headH, top = false) {
    const S = this.spec, dark = toon('#1c1b20'), glassM = basic('#9fc4d6');
    for (const s of [1, -1]) {
      const g = new THREE.Group(); g.position.set(s * S.W, y, z); this.walls.add(g);
      if (top) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, armLen), dark); arm.position.set(s * 0.1, headH / 2 + 0.1, armLen / 2); arm.rotation.x = 0.35; g.add(arm); const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, headH, 0.2), dark); head.position.set(s * 0.14, 0, armLen); g.add(head); const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, headH - 0.06), glassM); gl.position.set(s * 0.14, 0, armLen - 0.036); gl.rotation.y = Math.PI; g.add(gl); }
      else { const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.04, 0.04), dark); arm.position.set(s * armLen / 2, 0, 0); g.add(arm); const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, headH, 0.2), dark); head.position.set(s * (armLen + 0.02), 0.02, 0); head.rotation.y = s * 0.25; g.add(head); const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, headH - 0.06), glassM); gl.position.set(s * (armLen + 0.02), 0.02, -0.034); gl.rotation.y = Math.PI + s * 0.25; g.add(gl); }
    }
  }
  // a door panel that opens by itself when a walking player comes near, and shuts behind them
  addAutoDoor({ side, z0, z1, y0, y1, kind = 'slide', dir = -1, mat, glassFrom = null, trim = null }) {
    const S = this.spec, x = side * (S.W - 0.045), L = z1 - z0, zh = kind === 'hinge' ? z1 : (z0 + z1) / 2, zc = (z0 + z1) / 2 - zh;
    const piv = new THREE.Group(); piv.position.set(x, 0, zh); this.walls.add(piv);
    const part = (ya, yb, m, cast = true, w = 0.07) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, yb - ya, L - 0.03), m); mesh.position.set(0, (ya + yb) / 2, zc); mesh.castShadow = cast; piv.add(mesh); return mesh; };
    const gf = glassFrom ?? y1;
    part(y0 - 0.25, gf, mat);
    if (gf < y1 - 0.15) { part(gf, y1 - 0.1, this.glass, false, 0.04); part(y1 - 0.1, y1, mat); for (const e of [-1, 1]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.07, y1 - gf, 0.06), mat); fr.position.set(0, (gf + y1) / 2, zc + e * (L / 2 - 0.045)); piv.add(fr); } }
    if (trim) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, L - 0.03), trim.mat); t.position.set(0, trim.y, zc); piv.add(t); }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), toon('#c9c6c0')); handle.position.set(side * 0.05, Math.min(gf, y0 + 1.0) - 0.12, zc + (kind === 'hinge' ? -1 : dir) * -(L / 2 - 0.2)); piv.add(handle);
    const col = [side > 0 ? S.IW : -S.W, side > 0 ? S.W : -S.IW, y0 - 0.3, y1, z0, z1]; this.cols.push(col);
    (this.autoDoors = this.autoDoors || []).push({ piv, side, kind, dir, L, x, zh, zm: (z0 + z1) / 2, y0, y1, t: 0, col, closed: col.slice() });
  }
  logo(lines, color, placements) {
    const tex = neonTex(lines, { w: 512, h: 160, color, size: [56, 30], font: 'Bungee' });
    this.logoMat = basic('#ffffff', { map: tex, transparent: true }); this.logoCol = color;
    for (const [w, h, x, y, z, ry] of placements) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.logoMat); m.position.set(x, y, z); m.rotation.y = ry; this.walls.add(m); }
  }

  // ------------------------------------------------------------ PART 1: camper van
  buildVan() {
    const S = this.spec, F = S.F, W = S.W, IW = S.IW, ZB = S.ZB, ZF = S.ZF, TOP = S.TOP, bx = this.meshBx;
    const lower = toon('#d9763a'), upper = toon('#efe6d2'), dark = toon('#2b2a30'), chrome = toon('#c9c6c0');
    this.panelMat = toon('#b78a5a');
    const wp = { parent: this.walls }, wl = { parent: this.walls, inner: 1 }, wr = { parent: this.walls, inner: 0 };
    const BL = F + 0.82, WT = F + 1.55; // belt line, window top
    bx(-W, W, 0.3, F - 0.04, ZB, ZF + 0.25, toon('#3a3430'));
    bx(-IW, IW, F - 0.04, F, ZB + 0.08, ZF - 0.08, toon('#7a5a3e'), { solid: false });
    const D0 = 0.3, D1 = 1.3; // cab door openings (both sides)
    // left (+x) side
    bx(IW, W, F, BL, ZB, D0, lower, wl); bx(IW, W, F, BL, D1, ZF, lower, wl);
    bx(IW, W, WT, TOP, ZB, ZF, upper, wl);
    for (const [z0, z1] of [[ZB, -1.9], [-0.4, -0.25], [0.2, D0], [D1, 1.42], [ZF - 0.12, ZF]]) bx(IW, W, BL, WT, z0, z1, upper, wl);
    for (const [z0, z1] of [[-1.9, -0.4], [-0.25, 0.2], [1.42, ZF - 0.12]]) bx(IW + 0.03, W - 0.03, BL, WT, z0, z1, this.glass, { ...wp, cast: false });
    // right (-x) side: sliding door gap z [-1.2, 0.1] + cab door
    bx(-W, -IW, F, BL, ZB, -1.2, lower, wr); bx(-W, -IW, F, BL, 0.1, D0, lower, wr); bx(-W, -IW, F, BL, D1, ZF, lower, wr);
    bx(-W, -IW, WT, TOP, ZB, -1.2, upper, wr); bx(-W, -IW, WT, TOP, 0.1, ZF, upper, wr);
    bx(-W, -IW, F + 1.75, TOP, -1.2, 0.1, upper, wr);
    for (const [z0, z1] of [[ZB, -1.9], [-1.35, -1.2], [0.1, D0], [D1, 1.42], [ZF - 0.12, ZF]]) bx(-W, -IW, BL, WT, z0, z1, upper, wr);
    for (const [z0, z1] of [[-1.9, -1.35], [1.42, ZF - 0.12]]) bx(-W + 0.03, -IW - 0.03, BL, WT, z0, z1, this.glass, { ...wp, cast: false });
    // hinged cab doors (driver = left, passenger = right), hinge at the front edge
    this.doors = {};
    for (const [key, side] of [['L', 1], ['R', -1]]) {
      const piv = new THREE.Group(); piv.position.set(side * (W - 0.04), 0, D1); this.walls.add(piv);
      const L = D1 - D0;
      const mk = (y0, y1, m, solid = true) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, y1 - y0, L), m); mesh.position.set(0, (y0 + y1) / 2, -L / 2); mesh.castShadow = solid; piv.add(mesh); return mesh; };
      mk(F - 0.25, BL, lower); mk(BL, WT, this.glass, false); mk(WT - 0.05, WT, upper);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.08, WT - BL, 0.06), upper); fr.position.set(0, (BL + WT) / 2, -L + 0.03); piv.add(fr);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), chrome); handle.position.set(side * 0.05, BL - 0.12, -L + 0.18); piv.add(handle);
      const hbm = new THREE.Mesh(new THREE.BoxGeometry(0.5, WT - F + 0.2, L), new THREE.MeshBasicMaterial({ visible: false })); hbm.position.set(0, (F + WT) / 2, -L / 2); piv.add(hbm);
      hbm.userData.name = 'door' + key; this.hit['door' + key] = hbm;
      const col = [side > 0 ? IW : -W, side > 0 ? W : -IW, F - 0.3, WT, D0, D1]; this.cols.push(col);
      this.doors[key] = { piv, side, open: false, ang: 0, col, closed: col.slice() };
      bx(side > 0 ? W : -W - 0.32, side > 0 ? W + 0.32 : -W, 0.18, 0.34, D0 + 0.05, D1 - 0.05, chrome).userData.ext = true;
    }
    // back + rear window, roof
    bx(-W, W, F, TOP, ZB, ZB + 0.08, upper, { parent: this.walls, inner: 4 });
    bx(-W, W, 0.3, BL, ZB - 0.02, ZB + 0.02, lower, { ...wp, solid: false });
    bx(-0.6, 0.6, BL + 0.1, WT - 0.05, ZB - 0.02, ZB + 0.1, toon('#22313a'), { ...wp, solid: false });
    const rp = { parent: this.roof };
    bx(-W, W, TOP, TOP + 0.1, ZB, ZF, upper, rp);
    bx(-W + 0.04, W - 0.04, TOP + 0.1, TOP + 0.18, ZB + 0.1, ZF - 0.1, toon('#e2d8c2'), { ...rp, solid: false });
    // roof rack with luggage
    for (const s of [-1, 1]) bx(s * 0.85 - 0.03, s * 0.85 + 0.03, TOP + 0.18, TOP + 0.32, -1.9, 1.4, chrome, { ...rp, solid: false });
    bx(-0.6, 0.2, TOP + 0.2, TOP + 0.6, -1.4, -0.4, toon('#3f6fae'), { ...rp, solid: false });
    bx(0.25, 0.75, TOP + 0.2, TOP + 0.5, -1.6, -0.2, toon('#26252b'), { ...rp, solid: false });
    bx(-0.7, 0.6, TOP + 0.2, TOP + 0.45, 0.2, 1.1, toon('#8a4f2c'), { ...rp, solid: false });
    // front: flat face with V paint line, windshield
    bx(-W, W, 0.4, BL, ZF, ZF + 0.25, lower);
    const vline = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), upper); vline.position.set(0, BL - 0.2, ZF + 0.252); vline.rotation.z = Math.PI / 4; vline.scale.set(0.7, 0.7, 1); this.walls.add(vline);
    const emb = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), chrome); emb.position.set(0, BL - 0.3, ZF + 0.256); this.walls.add(emb);
    bx(-IW, IW, BL, WT + 0.15, ZF - 0.05, ZF, this.glass, { ...wp, cast: false });
    bx(-W, W, WT + 0.15, TOP, ZF - 0.12, ZF, upper, wp);
    bx(-W - 0.04, W + 0.04, 0.35, 0.55, ZF + 0.24, ZF + 0.38, chrome);
    bx(-W - 0.04, W + 0.04, 0.35, 0.55, ZB - 0.16, ZB, chrome);
    // round headlights
    this.lights(ZF + 0.43, ZB, 0.7, 0.2, 0.85, 0.15, 0.15);
    // side door step
    bx(-W - 0.35, -W, 0.18, 0.34, -1.15, 0.05, chrome).userData.ext = true;
    // interior
    const ip = { parent: this.interior };
    bx(-IW, IW, TOP - 0.02, TOP, ZB + 0.1, ZF - 0.1, toon('#c9b28a'), { ...ip, solid: false, cast: false });
    this.seatBox(0.45, 0.7, '#8a5a3a', '#a06a44', 0.26); this.seatBox(-0.45, 0.7, '#8a5a3a', '#a06a44', 0.26);
    const cush = toon('#c8572f'), cush2 = toon('#a8452a');
    // row 1: two seats on the driver side, aisle by the door
    bx(-0.12, IW, F, F + 0.45, -0.65, -0.1, cush, ip); bx(-0.12, IW, F + 0.45, F + 1.15, -0.72, -0.6, cush2, ip);
    // row 2: rear bench
    bx(-IW, IW, F, F + 0.45, -1.72, -1.18, cush, ip); bx(-IW, IW, F + 0.45, F + 1.15, -1.82, -1.7, cush2, ip);
    // cargo behind the rear bench: amps & cases
    const amp = bx(-0.9, -0.3, F, F + 0.55, -2.32, -1.86, toon('#26252b'), ip); this.rack.push({ g: amp, base: amp.position.clone() });
    const cs = bx(-0.2, 0.85, F, F + 0.32, -2.32, -1.9, toon('#2fa39a'), ip); this.rack.push({ g: cs, base: cs.position.clone() });
    const lamp = new THREE.PointLight('#ffcf9a', 1.2, 5, 1.5); lamp.position.set(0, TOP - 0.25, -0.5); this.interior.add(lamp);
    // dash
    bx(-IW, IW, F, F + 0.8, ZF - 0.65, ZF - 0.05, toon('#3a3430'));
    bx(-IW, IW, F + 0.8, F + 0.86, ZF - 0.8, ZF - 0.05, toon('#e8dcc4'), { ...ip, solid: false });
    // ports
    const port = bx(0.55, 0.85, F + 0.25, F + 0.5, ZB - 0.04, ZB, basic('#1c4a52'), { solid: false }); this.portMat = port.material;
    this.hb('port', 0.4, 1.0, F + 0.05, F + 0.7, ZB - 0.4, ZB);
    this.hb('hatch', -0.6, 0.3, 0.3, F + 0.75, ZB - 0.45, ZB);
    for (let k = 0; k < 6; k++) bx(-0.45 + k * 0.12, -0.4 + k * 0.12, F + 0.45, F + 0.7, ZB - 0.03, ZB, dark, { solid: false });
    this.logo(['THE LOOSE WIRES', 'ON TOUR'], '#ffe6b0', [[2.4, 0.7, W + 0.02, F + 0.45, -0.4, P2], [1.8, 0.55, -W - 0.02, F + 0.45, -1.85, -P2]]);
  }

  // ------------------------------------------------------------ PART 2: RV (unchanged layout)
  buildRV() {
    const S = this.spec, R = this.root, bx = this.meshBx;
    const cream = toon('#e6dcc4'), stripe = toon('#8a4a2e'), stripe2 = toon('#c9763c'), dark = toon('#2b2a30'), chrome = toon('#c9c6c0');
    const wood = toon('#a7784c'), woodDark = toon('#6e4a30'), carpet = toon('#b07a45'), cushion = toon('#c87a3a'), cushion2 = toon('#8a5a3a');
    this.panelMat = toon('#8a5a36');
    const F = S.F, TOP = S.TOP, ZB = S.ZB, ZF = S.ZF, W = S.W, IW = S.IW;
    bx(-W, W, 0.38, F - 0.06, ZB, ZF, toon('#5a3524'));
    bx(-IW, IW, F - 0.06, F, ZB + 0.1, ZF - 0.1, carpet, { solid: false });
    const wp = { parent: this.walls }, wl = { parent: this.walls, inner: 1 }, wr = { parent: this.walls, inner: 0 };
    bx(IW, W, F, F + 1.0, ZB, 3.2, cream, wl);
    bx(IW, W, F + 2.0, TOP, ZB, 3.2, cream, wl);
    for (const [z0, z1] of [[ZB, -4.4], [-3.2, -2.9], [-1.4, 0.4], [2.2, 3.2]]) bx(IW, W, F + 1.0, F + 2.0, z0, z1, cream, wl);
    for (const [z0, z1] of [[-4.4, -3.2], [-2.9, -1.4], [0.4, 2.2]]) bx(IW + 0.04, W - 0.04, F + 1.0, F + 2.0, z0, z1, this.glass, { ...wp, cast: false });
    const DZ0 = 0.6, DZ1 = 1.75; // side door
    bx(-W, -IW, F, F + 1.0, ZB, DZ0, cream, wr);
    bx(-W, -IW, F + 2.0, TOP, ZB, DZ0, cream, wr);
    for (const [z0, z1] of [[ZB, -4.3], [-2.6, -0.8], [0.4, DZ0]]) bx(-W, -IW, F + 1.0, F + 2.0, z0, z1, cream, wr);
    for (const [z0, z1] of [[-4.3, -2.6], [-0.8, 0.4]]) bx(-W + 0.04, -IW - 0.04, F + 1.0, F + 2.0, z0, z1, this.glass, { ...wp, cast: false });
    bx(-W, -IW, F + 2.15, TOP, DZ0, DZ1, cream, wr);
    bx(-W, -IW, F, TOP, DZ1, 3.2, cream, wr);
    for (const s of [-1, 1]) {
      const x = s * (W + 0.01);
      for (const [z0, z1] of (s > 0 ? [[ZB, ZF]] : [[ZB, DZ0], [DZ1, ZF]])) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, z1 - z0), stripe); st.position.set(x, F + 0.62, (z0 + z1) / 2); this.walls.add(st);
        const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, z1 - z0), stripe2); st2.position.set(x, F + 0.42, (z0 + z1) / 2); this.walls.add(st2);
      }
    }
    bx(-W, W, F, TOP, ZB, ZB + 0.1, cream, { parent: this.walls, inner: 4 });
    bx(-0.7, 0.7, F + 1.2, F + 1.9, ZB - 0.01, ZB + 0.11, toon('#22313a'), { ...wp, solid: false });
    bx(IW, W, F, F + 0.95, 3.2, ZF, cream, wp); bx(-W, -IW, F, F + 0.95, 3.2, ZF, cream, wp);
    bx(IW + 0.04, W - 0.04, F + 0.95, F + 2.0, 3.25, ZF - 0.1, this.glass, { ...wp, cast: false });
    bx(-W + 0.04, -IW - 0.04, F + 0.95, F + 2.0, 3.25, ZF - 0.1, this.glass, { ...wp, cast: false });
    for (const s of [-1, 1]) { bx(s > 0 ? IW : -W, s > 0 ? W : -IW, F + 0.95, F + 2.05, ZF - 0.15, ZF, cream, wp); bx(s > 0 ? IW : -W, s > 0 ? W : -IW, F + 0.95, F + 2.05, 3.2, 3.32, cream, wp); }
    bx(-IW, IW, F + 0.95, F + 2.0, ZF - 0.06, ZF, this.glass, { ...wp, cast: false });
    bx(-W, W, F + 2.0, F + 2.1, 3.2, ZF, cream, wp);
    bx(-IW, IW, F, F + 0.8, ZF - 0.65, ZF - 0.06, toon('#5b3c28'));
    bx(-IW, IW, F + 0.8, F + 0.86, ZF - 0.8, ZF - 0.06, woodDark, { solid: false });
    bx(-W, W, 0.55, F + 0.75, ZF, ZF + 0.75, cream);
    bx(-1.3, 1.3, F + 0.1, F + 0.55, ZF + 0.74, ZF + 0.78, toon('#3a3a40'), { solid: false });
    bx(-W - 0.05, W + 0.05, 0.45, 0.75, ZF + 0.72, ZF + 0.95, toon('#8a3a22'));
    const rp = { parent: this.roof };
    bx(-W, W, TOP, TOP + 0.12, ZB, 3.2, cream, rp);
    bx(-W, W, F + 2.1, TOP + 0.12, 3.2, 4.6, cream, rp);
    bx(-W + 0.1, W - 0.1, F + 2.25, TOP, 4.6, 4.75, toon('#22313a'), { ...rp, solid: false });
    bx(-0.6, 0.6, TOP + 0.12, TOP + 0.4, -1.5, -0.6, dark, rp);
    const cell = toon('#1f3d6e'), frameM = toon('#b8bcc4');
    for (let r = 0; r < 2; r++) for (let c2 = 0; c2 < 2; c2++) {
      const x0 = -1.15 + c2 * 1.18, z0 = -5.35 + r * 1.55;
      bx(x0, x0 + 1.12, TOP + 0.2, TOP + 0.24, z0, z0 + 1.45, frameM, { ...rp, solid: false });
      bx(x0 + 0.04, x0 + 1.08, TOP + 0.24, TOP + 0.25, z0 + 0.04, z0 + 1.41, cell, { ...rp, solid: false, cast: false });
      for (let k = 1; k < 4; k++) bx(x0 + 0.04, x0 + 1.08, TOP + 0.25, TOP + 0.255, z0 + k * 0.36, z0 + k * 0.36 + 0.015, frameM, { ...rp, solid: false, cast: false });
    }
    for (const [x, z] of [[-1.1, -5.3], [1.1, -5.3], [-1.1, -2.3], [1.1, -2.3]]) bx(x - 0.03, x + 0.03, TOP + 0.12, TOP + 0.2, z - 0.03, z + 0.03, frameM, { ...rp, solid: false });
    for (const cx of [-0.55, 0.55]) {
      const cm = toon(cx < 0 ? '#2f8f8a' : '#e2763a');
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.45), cm); seat.position.set(cx, TOP + 0.24, 0.9); seat.userData.keep = true; this.roof.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), cm); back.position.set(cx, TOP + 0.48, 0.66); back.rotation.x = -0.25; back.userData.keep = true; this.roof.add(back);
      for (const [lx, lz] of [[-0.22, 0.7], [0.22, 0.7], [-0.22, 1.1], [0.22, 1.1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), chrome); l.position.set(cx + lx, TOP + 0.18, lz); l.userData.keep = true; this.roof.add(l); }
    }
    for (const sx of [-1, 1]) bx(sx * 1.38 - 0.02, sx * 1.38 + 0.02, TOP + 0.12, TOP + 0.75, -5.6, 4.4, chrome, { ...rp, cast: false });
    bx(-1.38, 1.38, TOP + 0.12, TOP + 0.75, 4.38, 4.42, chrome, { ...rp, cast: false });
    bx(-1.38, 0.6, TOP + 0.12, TOP + 0.75, -5.62, -5.58, chrome, { ...rp, cast: false });
    for (const s of [-1, 1]) bx(0.9 + s * 0.22 - 0.03, 0.9 + s * 0.22 + 0.03, F, TOP + 0.3, ZB - 0.12, ZB - 0.06, chrome, { solid: false });
    for (let k = 0; k < 6; k++) bx(0.66, 1.14, F + 0.3 + k * 0.4, F + 0.34 + k * 0.4, ZB - 0.12, ZB - 0.06, chrome, { solid: false });
    this.logo(['THE LOOSE WIRES', 'WORLD TOUR'], '#c9763c', [[3.4, 1.0, W + 0.02, F + 1.5, -2.2, P2], [2.2, 0.65, -W - 0.02, F + 2.5, -1.6, -P2]]);
    bx(-W - 0.62, -W - 0.3, 0.2, 0.36, DZ0 + 0.05, DZ1 - 0.05, chrome).userData.ext = true;
    bx(-W - 0.3, -W, 0.2, 0.68, DZ0 + 0.05, DZ1 - 0.05, chrome).userData.ext = true;
    this.lights(ZF + 0.78, ZB, 0.98, 0.12, 1.15, 0.3, 0.17);
    // interior
    const I = this.interior, ip = { parent: I };
    bx(-IW, IW, TOP - 0.02, TOP, ZB + 0.1, 3.2, toon('#a88a66'), { ...ip, solid: false, cast: false });
    this.seatBox(0.72, 3.85); this.seatBox(-0.72, 3.85);
    bx(0.5, IW, F, F + 0.45, 2.2, 2.65, cushion, ip); bx(0.5, IW, F + 0.45, F + 1.1, 2.55, 2.68, cushion2, ip);
    bx(0.5, IW, F, F + 0.45, 0.45, 0.9, cushion, ip); bx(0.5, IW, F + 0.45, F + 1.1, 0.42, 0.55, cushion2, ip);
    bx(0.55, IW, F + 0.72, F + 0.78, 1.05, 2.1, toon('#e2c27a'), ip);
    bx(0.95, 1.0, F, F + 0.72, 1.5, 1.6, chrome, { ...ip, solid: false });
    bx(-IW, -0.8, F, F + 0.45, -0.85, 0.48, cushion, ip); bx(-IW, -1.2, F + 0.45, F + 1.1, -0.85, 0.48, cushion2, ip);
    bx(0.78, IW, F, F + 0.95, -2.8, 0.25, wood, ip);
    bx(0.78, IW, F + 0.95, F + 1.0, -2.8, 0.25, toon('#d9d2c2'), { ...ip, solid: false });
    bx(0.88, 1.25, F + 0.96, F + 1.02, -0.9, -0.3, toon('#9fb4bd'), { ...ip, solid: false });
    bx(0.88, 1.25, F + 1.0, F + 1.03, -2.3, -1.6, toon('#2a2a30'), { ...ip, solid: false });
    bx(-IW, -0.72, F, F + 1.9, -2.5, -1.6, toon('#e8e4da'), ip);
    bx(-IW, IW, F, F + 0.55, ZB + 0.1, -4.35, woodDark, ip);
    bx(-IW + 0.05, IW - 0.05, F + 0.55, F + 0.72, ZB + 0.15, -4.4, toon('#7a3a4a'), { ...ip, solid: false });
    bx(-1.0, 1.0, F + 0.72, F + 0.85, ZB + 0.2, ZB + 0.6, toon('#e8e2d0'), { ...ip, solid: false });
    bx(-0.6, 0.6, F, F + 0.01, -2.4, 1.2, toon('#7a3f5a'), { ...ip, solid: false, cast: false });
    const lamp = new THREE.PointLight('#ffcf9a', 2.2, 8, 1.5); lamp.position.set(0, TOP - 0.3, -1.0); I.add(lamp);
    const lamp2 = new THREE.PointLight('#ffcf9a', 1.0, 5, 1.5); lamp2.position.set(0, TOP - 0.3, 3.5); I.add(lamp2);
    for (const [role, x, z, sc] of [['drums', -0.95, -3.7, 0.36], ['synthA', 0.95, -3.4, 0.32], ['synthB', 0.95, -4.0, 0.3]]) { const g = makeInstrument(role); g.scale.setScalar(sc); g.position.set(x, F, z); g.rotation.y = P2; I.add(g); this.rack.push({ g, base: g.position.clone() }); }
    for (const [x, z, c] of [[-1.2, -2.9, '#2fa39a'], [-1.2, -2.6, '#c8372d']]) { const cs = bx(x - 0.06, x + 0.06, F, F + 1.15, z - 0.15, z + 0.15, toon(c), { ...ip, solid: false }); this.rack.push({ g: cs, base: cs.position.clone() }); }
    const port = bx(0.75, 1.05, F + 0.55, F + 0.85, ZB - 0.04, ZB, basic('#1c4a52'), { solid: false }); this.portMat = port.material;
    this.hb('port', 0.6, 1.2, F + 0.4, F + 1.0, ZB - 0.35, ZB);
    this.hb('ladder', 0.55, 1.25, F, F + 2.2, ZB - 0.6, ZB);
    this.hb('ladderTop', 0.6, 1.2, TOP + 0.1, TOP + 0.9, ZB, ZB + 0.6);
    this.hb('hatch', -1.2, 1.2, F + 0.3, F + 0.8, ZF + 0.1, ZF + 0.85);
    void R;
  }

  // ------------------------------------------------------------ PART 3: tour bus (single deck, from the floor plan)
  buildBus() {
    const S = this.spec, bx = this.meshBx;
    const F = S.F, W = S.W, IW = S.IW, ZB = S.ZB, ZF = S.ZF, TOP = S.TOP;
    const body = toon('#23252e'), body2 = toon('#2f323d'), accent = toon('#7af0ff'), chrome = toon('#c9c6c0'), dark = toon('#17171c');
    this.panelMat = toon('#3a0d14'); // padded oxblood wall panels
    const wp = { parent: this.walls }, wl = { parent: this.walls, inner: 1 }, wr = { parent: this.walls, inner: 0 };
    const BL = F + 0.85, WT = F + 1.9;
    bx(-W, W, 0.42, F - 0.05, ZB, ZF, toon('#15151a'));
    bx(-IW, IW, F - 0.05, F, ZB + 0.1, ZF - 0.1, toon('#6e0f1a'), { solid: false }); // deep red carpet
    // left (+x) wall: mid door gap z[-0.95,-0.2]
    const leftSegs = [[ZB, -0.95], [-0.2, ZF - 0.4]];
    for (const [z0, z1] of leftSegs) { bx(IW, W, F, BL, z0, z1, body, wl); bx(IW, W, WT, TOP, z0, z1, body, wl); }
    bx(IW, W, F + 2.0, TOP, -0.95, -0.2, body, wl);
    for (const [z0, z1] of [[ZB, -5.6], [-2.1, -0.95], [-0.2, 0.1], [ZF - 0.55, ZF - 0.4]]) bx(IW, W, BL, WT, z0, z1, body2, wl);
    for (const [z0, z1] of [[-5.6, -2.1], [0.1, ZF - 0.55]]) bx(IW + 0.03, W - 0.03, BL, WT, z0, z1, toon('#1a2a36', { transparent: true, opacity: 0.55 }), { ...wp, cast: false });
    // right (-x) wall: front door z[5.58,6.46], mid door z[-1.98,-1.1], luggage door z[-5.6,-4.9]
    const rDoors = [[-5.6, -4.9], [-1.98, -1.1], [5.58, 6.46]];
    let zc = ZB;
    for (const [d0, d1] of rDoors) { bx(-W, -IW, F, BL, zc, d0, body, wr); bx(-W, -IW, WT, TOP, zc, d0, body, wr); bx(-W, -IW, F + 2.0, TOP, d0, d1, body, wr); zc = d1; }
    bx(-W, -IW, F, TOP, zc, ZF, body, wr);
    for (const [z0, z1] of [[ZB, -5.6], [-4.9, -4.6], [-2.1, -1.98], [-1.1, -0.8], [5.3, 5.58]]) bx(-W, -IW, BL, WT, z0, z1, body2, wr);
    for (const [z0, z1] of [[-4.6, -2.1], [-0.8, 5.3]]) bx(-W + 0.03, -IW - 0.03, BL, WT, z0, z1, toon('#1a2a36', { transparent: true, opacity: 0.55 }), { ...wp, cast: false });
    // accent stripes
    const stripeSegs = { 1: [[ZB, -0.95], [-0.2, ZF]], [-1]: [[ZB, -5.6], [-4.9, -1.98], [-1.1, 5.58], [6.46, ZF]] };
    for (const s of [-1, 1]) for (const [z0, z1] of stripeSegs[s]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, z1 - z0), accent); st.position.set(s * (W + 0.012), F + 0.55, (z0 + z1) / 2); this.walls.add(st); }
    // back wall & engine bay
    bx(-W, W, F, TOP, ZB, ZB + 0.1, body, { parent: this.walls, inner: 4 });
    bx(-IW, IW, F, F + 1.25, ZB + 0.1, -5.76, toon('#2a2a30'));
    for (let k = 0; k < 9; k++) bx(-1.0 + k * 0.24, -0.9 + k * 0.24, F - 0.3, F + 0.6, ZB - 0.03, ZB, dark, { solid: false });
    // roof
    const rp = { parent: this.roof };
    bx(-W, W, TOP, TOP + 0.14, ZB, ZF, body, rp);
    bx(-0.8, 0.8, TOP + 0.14, TOP + 0.4, -3.5, -1.5, toon('#3a3d48'), { ...rp, solid: false });
    bx(-0.6, 0.6, TOP + 0.14, TOP + 0.35, 1.0, 2.4, toon('#3a3d48'), { ...rp, solid: false });
    // front: windshield with low dash, nose, bumper
    bx(-IW, IW, F + 0.85, TOP - 0.15, ZF - 0.05, ZF, this.glass, { ...wp, cast: false });
    bx(-W, W, TOP - 0.15, TOP, ZF - 0.12, ZF, body, wp);
    bx(-W, W, 0.42, F + 0.85, ZF, ZF + 0.2, body);
    bx(-W - 0.04, W + 0.04, 0.4, 0.75, ZF + 0.18, ZF + 0.34, chrome);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.24), basic('#ffffff', { map: neonTex('★ ON TOUR ★', { w: 256, h: 34, color: '#ffb347', size: 26, bg: '#000' }) }));
    dest.position.set(0, TOP - 0.3, ZF + 0.005); this.walls.add(dest);
    this.lights(ZF + 0.21, ZB, 0.95, -0.25, 1.05, 0.5);
    // door steps
    const stairs = (s, z0, z1) => { for (let k = 0; k < 3; k++) { const xo = W + (3 - k) * 0.3, m = s > 0 ? bx(W, xo, 0.12, F * (k + 1) / 4, z0, z1, k % 2 ? dark : chrome) : bx(-xo, -W, 0.12, F * (k + 1) / 4, z0, z1, k % 2 ? dark : chrome); m.userData.ext = true; } };
    stairs(-1, 5.6, 6.44); stairs(-1, -1.96, -1.12); stairs(-1, -5.58, -4.92); stairs(1, -0.93, -0.22);
    // ---- interior (floor plan, front → back)
    const ip = { parent: this.interior };
    bx(-IW, IW, TOP - 0.02, TOP, ZB + 0.1, ZF - 0.1, toon('#16090c'), { ...ip, solid: false, cast: false });
    const purple = toon('#141216'), sofa = toon('#b3121f'), sofa2 = toon('#860d17'), counter = toon('#141216'), gold = toon('#d1a94a');
    this.seatBox(0.72, 5.72, '#3a3a42', '#2c2c33');
    // cab partition with centre doorway
    bx(0.36, IW, F, F + 1.3, 4.44, 5.32, toon('#141216'), ip); bx(-IW, -0.34, F, F + 1.3, 4.44, 5.32, toon('#141216'), ip);
    bx(0.36, IW, F + 1.3, TOP, 4.44, 4.52, toon('#3a0d14'), ip); bx(-IW, -0.34, F + 1.3, TOP, 4.44, 4.52, toon('#3a0d14'), ip);
    // corner side tables
    for (const s of [-1, 1]) { const x0 = s > 0 ? 0.68 : -IW, x1 = s > 0 ? IW : -0.68; bx(x0, x1, F, F + 0.62, 3.87, 4.4, purple, ip); const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 8), basic('#ffd9a0')); lp.position.set(s * 0.93, F + 0.8, 4.13); this.interior.add(lp); }
    // facing sofas
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 0.6 : -IW, x1 = s > 0 ? IW : -0.6;
      bx(x0, x1, F, F + 0.45, 2.41, 3.83, sofa, ip);
      bx(s > 0 ? 1.04 : -IW, s > 0 ? IW : -1.04, F + 0.45, F + 1.1, 2.41, 3.83, sofa2, ip);
      for (let k = 0; k < 3; k++) bx(x0 + 0.05, x1 - 0.05, F + 0.45, F + 0.5, 2.48 + k * 0.46, 2.88 + k * 0.46, toon('#c9182a'), { ...ip, solid: false });
    }
    // dinette (left): two pairs of chairs + table
    const chair = (x, z, back) => { bx(x - 0.18, x + 0.18, F, F + 0.45, z - 0.2, z + 0.2, sofa, ip); bx(x - 0.18, x + 0.18, F + 0.45, F + 1.05, back - 0.05, back + 0.05, sofa2, ip); };
    chair(0.94, 1.95, 2.2); chair(0.5, 1.95, 2.2); chair(0.94, 0.62, 0.37); chair(0.5, 0.62, 0.37);
    bx(0.3, IW, F + 0.72, F + 0.78, 1.08, 1.6, purple, ip); bx(0.7, 0.78, F, F + 0.72, 1.3, 1.38, chrome, { ...ip, solid: false });
    this.cols.push([0.3, IW, F, F + 0.78, 1.08, 1.6]);
    // galley (right)
    bx(-IW, -0.68, F, F + 0.95, -0.94, 2.41, counter, ip);
    bx(-IW, -0.68, F + 0.95, F + 1.0, -0.94, 2.41, gold, { ...ip, solid: false });
    bx(-1.08, -0.78, F + 0.96, F + 1.02, 0.95, 1.75, toon('#9fb4bd'), { ...ip, solid: false });
    bx(-IW, -0.68, F + 1.5, F + 2.0, -0.94, 2.41, toon('#141216'), { ...ip, solid: false });
    // WC (left, behind the mid door)
    const wc = toon('#1c1418');
    bx(0.07, IW, F, TOP, -0.98, -0.94, wc, ip);
    bx(0.07, 0.11, F, TOP, -2.05, -1.45, wc, ip); bx(0.07, 0.11, F + 2.0, TOP, -1.45, -0.98, wc, ip);
    const toilet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.42, 10), toon('#ffffff')); toilet.position.set(0.85, F + 0.21, -1.25); this.interior.add(toilet);
    bx(0.45, 0.8, F + 0.75, F + 0.85, -2.0, -1.75, toon('#ffffff'), ip);
    // little counter + bulkhead to the luggage bay (doorway on the right where the stairs were)
    bx(-0.57, 0.07, F, F + 0.9, -2.05, -1.8, counter, ip);
    bx(-0.57, IW, F, TOP, -2.11, -2.05, toon('#3a0d14'), ip);
    bx(-IW, -0.57, F + 2.0, TOP, -2.11, -2.05, toon('#3a0d14'), ip);
    // luggage bay: flight cases + amps
    const cases = [[-0.9, -3.0, 0.55, '#26252b'], [-0.9, -3.8, 0.8, '#2fa39a'], [0.8, -2.8, 0.9, '#c8372d'], [0.8, -3.7, 0.6, '#26252b'], [0.6, -4.8, 1.1, '#3f6fae'], [-0.7, -5.3, 0.7, '#26252b']];
    for (const [x, z, h, c] of cases) { const m = bx(x - 0.35, x + 0.35, F, F + h, z - 0.35, z + 0.35, toon(c), ip); this.rack.push({ g: m, base: m.position.clone() }); }
    for (const [role, x, z, sc] of [['drums', 0.15, -4.1, 0.5], ['synthA', -0.25, -2.8, 0.45]]) { const g = makeInstrument(role); g.scale.setScalar(sc); g.position.set(x, F, z); g.rotation.y = P2; this.interior.add(g); this.rack.push({ g, base: g.position.clone() }); }
    // mood lighting
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 9.8), basic('#ff2a3c')); strip.position.set(IW - 0.02, TOP - 0.05, 0); this.interior.add(strip);
    const strip2 = strip.clone(); strip2.position.x = -IW + 0.02; this.interior.add(strip2);
    for (const z of [3.2, 0.6, -3.6]) { const l = new THREE.PointLight('#ff9a8a', 1.8, 6, 1.5); l.position.set(0, TOP - 0.3, z); this.interior.add(l); }
    // dash
    bx(-0.4, IW, F, F + 0.8, ZF - 0.65, ZF - 0.05, toon('#26252b'));
    bx(-0.4, IW, F + 0.8, F + 0.86, ZF - 0.8, ZF - 0.05, toon('#1a1a20'), { ...ip, solid: false });
    bx(-IW, -0.4, F, F + 0.3, ZF - 0.5, ZF - 0.05, toon('#26252b'), { ...ip, solid: false });
    // ports + engine hatch at the back
    const port = bx(0.75, 1.05, F + 0.55, F + 0.85, ZB - 0.04, ZB, basic('#1c4a52'), { solid: false }); this.portMat = port.material;
    this.hb('port', 0.6, 1.2, F + 0.4, F + 1.0, ZB - 0.35, ZB);
    this.hb('hatch', -0.9, 0.5, 0.4, F + 0.7, ZB - 0.45, ZB);
    this.logo(['THE LOOSE WIRES', 'WORLD TOUR'], '#7af0ff', [[4.6, 1.3, W + 0.02, F + 1.35, -3.4, P2], [4.0, 1.15, -W - 0.02, F + 1.35, 2.3, -P2], [2.0, 0.6, 0, F + 1.8, ZB - 0.02, Math.PI]]);
    // --- rock-star fittings: gold trim, a lit bar, a wall TV, a starlight ceiling and the band's name in neon
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 9.6), gold); t.position.set(s * (IW - 0.015), BL - 0.03, 0.2); this.interior.add(t); const fl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 9.6), basic('#ff2a3c')); fl.position.set(s * (IW - 0.02), F + 0.03, 0.2); this.interior.add(fl); }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), gold); btn.position.set(s * 1.02, F + 0.85, 2.6 + k * 0.36); this.interior.add(btn); }
    const bottles = canvasTex(128, 32, (g) => { g.fillStyle = '#1a0508'; g.fillRect(0, 0, 128, 32); for (let i = 0; i < 26; i++) { g.fillStyle = ['#e8c15a', '#c9182a', '#7af0ff', '#f2ead8', '#3fae6a'][i % 5]; g.fillRect(3 + i * 4.8, 7 + (i * 7 % 5), 3, 22); g.fillRect(4 + i * 4.8, 3 + (i * 7 % 5), 1, 5); } });
    const shelf = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), basic('#ffffff', { map: bottles })); shelf.position.set(-IW + 0.06, F + 1.27, 0.73); shelf.rotation.y = P2; this.interior.add(shelf);
    const barGlow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 3.3), basic('#ffb347')); barGlow.position.set(-0.69, F + 0.9, 0.73); this.interior.add(barGlow);
    for (const z of [-0.4, 0.3, 1.0]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), sofa); st.position.set(-0.42, F + 0.62, z); this.interior.add(st); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6), gold); leg.position.set(-0.42, F + 0.3, z); this.interior.add(leg); }
    const tv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 1.1), toon('#0a0a0c')); tv.position.set(IW - 0.04, F + 1.45, 1.34); this.interior.add(tv);
    const tvS = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.54), basic('#ffffff', { map: neonTex(['LIVE', 'WORLD TOUR'], { w: 256, h: 136, color: '#ff2a3c', size: [64, 30], bg: '#12060a' }) })); tvS.position.set(IW - 0.07, F + 1.45, 1.34); tvS.rotation.y = -P2; this.interior.add(tvS);
    this.busNeon = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.4), basic('#ffffff', { map: neonTex('THE LOOSE WIRES', { w: 512, h: 120, color: '#ffd27a', size: 56 }), transparent: true })); this.busNeon.position.set(0.63, F + 1.75, -2.04); this.interior.add(this.busNeon);
    const stars = new THREE.Group(); for (let i = 0; i < 70; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.01, 0.025), basic(i % 6 ? '#ffe9c0' : '#ff5a6a')); d.position.set((Math.sin(i * 12.9898) * 0.5) * (IW * 1.8), TOP - 0.03, -1.9 + ((i * 0.6180339) % 1) * 6.2); stars.add(d); } this.interior.add(stars);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.012, 1.5), toon('#141216')); rug.position.set(0, F + 0.006, 3.1); this.interior.add(rug);
    const rugTrim = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.01, 1.58), gold); rugTrim.position.set(0, F + 0.003, 3.1); this.interior.add(rugTrim);
    // diegetic CCTV: 4 cameras feeding a monitor on the dash
    const RTW = 256, RTH = 144;
    this.camFeeds = [
      { label: 'CAM 1 · LOUNGE', p: [0, F + 1.95, 4.3], t: [0, F + 0.7, 0.6] },
      { label: 'CAM 2 · GALLEY', p: [-0.9, F + 1.95, -0.7], t: [0.5, F + 0.6, 2.4] },
      { label: 'CAM 3 · LUGGAGE', p: [0.9, F + 1.95, -2.4], t: [-0.4, F + 0.3, -5.6] },
      { label: 'CAM 4 · REAR', p: [0, TOP - 0.2, ZB - 0.25], t: [0, F + 0.2, ZB - 30], outside: true },
    ].map((c) => {
      const rt = new THREE.WebGLRenderTarget(RTW, RTH, { type: THREE.HalfFloatType });
      const cam = new THREE.PerspectiveCamera(c.outside ? 60 : 85, RTW / RTH, 0.05, c.outside ? 400 : 30);
      return { ...c, rt, cam };
    });
    const mon = new THREE.Group(); mon.position.set(0.05, TOP - 0.36, ZF - 0.3); mon.rotation.set(-0.3, Math.PI - 0.5, 0, 'YXZ'); this.interior.add(mon);
    mon.add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.04), dark));
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), dark); stand.position.set(0, 0.3, -0.02); mon.add(stand);
    this.camFeeds.forEach((c, i) => {
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.17), new THREE.MeshBasicMaterial({ map: c.rt.texture, toneMapped: false }));
      sc.position.set((i % 2 ? 0.16 : -0.16), (i < 2 ? 0.1 : -0.1), 0.021); sc.rotation.y = 0; mon.add(sc);
      const lt = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.022), basic('#ffffff', { map: neonTex(c.label, { w: 256, h: 36, color: '#a8ff7a', size: 24, font: 'VT323', bg: '#000' }) }));
      lt.position.set(sc.position.x - 0.07, sc.position.y + 0.072, 0.023); mon.add(lt);
    });
    this.monitor = mon; this.camIdx = 0;
  }

  // ------------------------------------------------------------ cab controls (shared; positioned relative to the driver seat)
  buildCab() {
    const S = this.spec, F0 = 1.0, dark = toon('#2b2a30'), chrome = toon('#c9c6c0');
    const cab = new THREE.Group(); cab.position.set(S.driverX - 0.72, S.F - F0, S.seats.driver.p[2] - 3.85); this.interior.add(cab);
    this.cab = cab;
    const F = F0, bx = (x0, x1, y0, y1, z0, z1, m) => this.meshBx(x0, x1, y0, y1, z0, z1, m, { parent: cab, solid: false });
    const I = cab;
    this.wheelGrp = new THREE.Group(); this.wheelGrp.position.set(0.72, F + 0.9, 4.36); this.wheelGrp.rotation.x = this.type === 'bus' ? -0.5 : -0.22; I.add(this.wheelGrp);
    const wr = this.type === 'bus' ? 0.24 : this.type === 'van' ? 0.21 : 0.23;
    this.wheelGrp.add(new THREE.Mesh(new THREE.TorusGeometry(wr, 0.022, 5, 18), toon(this.type === 'van' ? '#e8e2d4' : '#3a2a20')));
    this.wheelGrp.add(new THREE.Mesh(new THREE.BoxGeometry(wr * 1.9, 0.04, 0.025), toon('#c9d4e0')));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), toon('#9fb0c0')); hub.rotation.x = P2; this.wheelGrp.add(hub);
    this.wheelHands = new THREE.Group(); this.wheelGrp.add(this.wheelHands);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), toon('#8d8a86')); h.position.set(s * (wr - 0.015), 0.06, 0.02); h.scale.set(1.2, 0.9, 1); this.wheelHands.add(h); }
    this.wheelHands.visible = false;
    const colm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), dark); colm.position.set(0.72, F + 0.84, 4.58); colm.rotation.x = -0.22; I.add(colm);
    this.dashTex = canvasTex(256, 96, () => {}, false);
    bx(0.02, 0.64, F + 0.84, F + 1.14, 4.66, 4.74, toon('#2a2128'));
    const dg = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.22), basic('#ffffff', { map: this.dashTex }));
    dg.position.set(0.33, F + 0.99, 4.65); dg.rotation.set(0, Math.PI, 0); I.add(dg);
    this.gearGrp = new THREE.Group(); this.gearGrp.position.set(0.22, F, 4.1); I.add(this.gearGrp);
    this.meshBx(-0.12, 0.12, 0, 0.1, -0.12, 0.12, dark, { parent: this.gearGrp, solid: false });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6), toon('#6a8aa8')); stick.position.y = 0.45; this.gearGrp.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#c08a50')); knob.position.y = 0.9; this.gearGrp.add(knob);
    this.hbGrp = new THREE.Group(); this.hbGrp.position.set(0.3, F + 0.5, 3.95); I.add(this.hbGrp);
    this.meshBx(-0.08, 0.08, -0.03, 0.03, -0.12, 0.12, dark, { parent: this.hbGrp, solid: false });
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 6), toon('#6a6a72')); lever.rotation.x = P2 - 0.5; lever.position.set(0, 0.1, 0.17); this.hbGrp.add(lever);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 8), toon('#c0392b')); grip.rotation.x = P2 - 0.5; grip.position.set(0, 0.19, 0.34); this.hbGrp.add(grip);
    const kx = this.type === 'van' ? 0.98 : 1.07;
    bx(kx - 0.09, kx + 0.09, F + 0.74, F + 0.92, 4.5, 4.62, toon('#2a2128'));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), chrome); barrel.rotation.x = P2; barrel.position.set(kx, F + 0.83, 4.495); I.add(barrel);
    const key = new THREE.Group(); key.position.set(kx, F + 0.83, 4.47); I.add(key);
    key.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.05), chrome));
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.012), toon('#e0b84a')); bow.position.z = -0.03; key.add(bow);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.006), toon('#c8372d')); tag.position.set(0, -0.055, -0.035); key.add(tag);
    this.keyMesh = key;
    // rear-view mirror (van + RV); the bus uses its camera monitor instead
    if (S.mirror) {
      this.mirrorRT = new THREE.WebGLRenderTarget(320, 112, { type: THREE.HalfFloatType });
      this.mirrorRT.texture.wrapS = THREE.RepeatWrapping; this.mirrorRT.texture.repeat.x = -1; this.mirrorRT.texture.offset.x = 1;
      const mg = new THREE.Group(); mg.position.set(S.mirror[0], S.F + S.mirror[1] - (S.F - F0), S.ZF - 0.22); mg.position.sub(cab.position); mg.position.y = F + S.mirror[1]; mg.rotation.set(0.08, Math.PI + 0.12, 0); I.add(mg);
      mg.position.x = S.mirror[0] - cab.position.x; mg.position.z = S.ZF - 0.22 - cab.position.z;
      mg.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.17, 0.03), dark));
      this.mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), new THREE.MeshBasicMaterial({ map: this.mirrorRT.texture, toneMapped: false })); this.mirror.position.z = 0.016; mg.add(this.mirror);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), dark); stem.position.set(0, 0.12, -0.03); mg.add(stem);
      this.mirrorCam = new THREE.PerspectiveCamera(48, 320 / 112, 0.3, 500);
    }
    bx(-0.3, 0.1, F + 0.62, F + 0.74, 4.6, 4.66, toon('#1a1a20'));
    this.radioLed = bx(-0.29, 0.09, F + 0.63, F + 0.73, 4.585, 4.595, basic('#331a1a'));
    this.radioFace = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), basic('#ffffff', { map: neonTex('♪ KRUST FM', { w: 256, h: 64, color: '#ff5fd2', size: 40, font: 'VT323', bg: '#120a14' }), transparent: true }));
    this.radioFace.position.set(-0.1, F + 0.68, 4.583); this.radioFace.rotation.y = Math.PI; this.radioFace.visible = false; I.add(this.radioFace);
    bx(-0.06, 0.06, F + 0.8, F + 0.83, 4.47, 4.57, toon('#1a1a20')); bx(-0.24, -0.12, F + 0.8, F + 0.83, 4.47, 4.57, toon('#1a1a20'));
    this.lightBtn = bx(-0.04, 0.04, F + 0.83, F + 0.86, 4.49, 4.55, basic('#5a4a20'));
    this.wiperBtn = bx(-0.22, -0.14, F + 0.83, F + 0.86, 4.49, 4.55, basic('#203a5a'));
    const icon = (txt, x) => { const t = canvasTex(64, 32, (c) => { c.fillStyle = '#1a1a20'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#ddd'; c.font = '18px monospace'; c.textAlign = 'center'; c.fillText(txt, 32, 22); }, false); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), basic('#fff', { map: t })); m.rotation.x = -P2; m.rotation.z = Math.PI; m.position.set(x, F + 0.832, 4.6); I.add(m); };
    icon('LIGHT', 0.0); icon('WIPE', -0.18);
    this.hb('radio', -0.35, 0.15, F + 0.55, F + 0.79, 4.45, 4.7, cab);
    this.hb('ignition', kx - 0.14, kx + 0.17, F + 0.66, F + 1.0, 4.3, 4.64, cab);
    this.hb('lightbtn', -0.07, 0.07, F + 0.79, F + 0.9, 4.45, 4.6, cab);
    this.hb('wiperbtn', -0.25, -0.11, F + 0.79, F + 0.9, 4.45, 4.6, cab);
    this.hb('handbrake', 0.16, 0.44, F + 0.4, F + 0.85, 3.85, 4.4, cab);
    // wipers on the windshield
    this.wipers = [];
    for (const [x, len] of S.wipers) {
      const piv = new THREE.Group(); piv.position.set(x, S.F + (this.type === 'van' ? 0.84 : 0.87), S.ZF + 0.02); this.walls.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.025, len, 0.02), toon('#1a1a1e')); arm.position.y = len / 2; piv.add(arm);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, len * 0.94, 0.03), toon('#26262c')); blade.position.set(0.02, len * 0.53, 0.01); piv.add(blade);
      piv.rotation.z = 1.35; this.wipers.push(piv);
    }
    this.wipersOn = false; this.wipeT = 0;
  }

  setBandName(name) {
    const old = this.logoMat.map;
    this.logoMat.map = neonTex([name.toUpperCase(), this.type === 'van' ? 'ON TOUR' : 'WORLD TOUR'], { w: 512, h: 160, color: this.logoCol, size: [56, 30], font: 'Bungee' });
    this.logoMat.needsUpdate = true; if (old) old.dispose();
    if (this.busNeon) { this.busNeon.material.map = neonTex(name.toUpperCase(), { w: 512, h: 120, color: '#ffd27a', size: 56 }); this.busNeon.material.needsUpdate = true; }
  }
  // ---- collision helpers for walkers (local space) ----
  collideLocal(p, r, h = 1.7, step = 0.45) {
    let hit = false;
    for (const b of this.cols) {
      if (p.y + step >= b[3] || p.y + h <= b[2]) continue;
      const qx = clamp(p.x, b[0], b[1]), qz = clamp(p.z, b[4], b[5]);
      const dx = p.x - qx, dz = p.z - qz; const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-5) { p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
        else {
          const o = [p.x - b[0], b[1] - p.x, p.z - b[4], b[5] - p.z]; const m = Math.min(...o);
          if (m === o[0]) p.x = b[0] - r; else if (m === o[1]) p.x = b[1] + r; else if (m === o[2]) p.z = b[4] - r; else p.z = b[5] + r;
        }
        hit = true;
      }
    }
    return hit;
  }
  floorLocal(x, z, feetY, step = 0.45, r = 0.18) {
    let top = -Infinity;
    for (const b of this.cols) {
      if (x < b[0] - r || x > b[1] + r || z < b[4] - r || z > b[5] + r) continue;
      if (b[3] <= feetY + step && b[3] > top) top = b[3];
    }
    return top;
  }
  insideLocal(p) { const S = this.spec; return Math.abs(p.x) < S.W - 0.05 && p.z > S.ZB && p.z < S.ZF && p.y > S.F - 0.3 && p.y < S.TOP - 0.1; }
  nearLocal(p) { const S = this.spec; return Math.abs(p.x) < S.W + 3 && p.z > S.ZB - 3 && p.z < S.ZF + 3; }
  place(x, z, heading) {
    this.pos.set(x, 0, z); this.heading = heading; this.v = 0;
    this.y = this.world.groundH(x, z); this.vy = 0; this.pitch = 0; this.roll = 0;
    this.updateTransform(0);
  }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  local(x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyMatrix4(this.root.matrixWorld); }
  stepGear(dir, clutch) {
    const order = ['R', 'N', '1', '2', '3', '4', '5'];
    const i = order.indexOf(this.gear), j = clamp(i + dir, 0, order.length - 1);
    if (i === j) return;
    const g = order[j];
    if (this.engineOn && !clutch) { this.grind('*GRIIIND* Hold Q (clutch) to change gear!'); return; }
    if (g === 'R' && this.v > 1) { this.grind('Stop before shifting into reverse!'); return; }
    this.setGear(g); this.audio.play('shift');
  }
  setGear(g) { this.gear = g; const p = GATE[g]; this.knob.x = p[0]; this.knob.y = p[1]; }
  grind(msg) {
    if (this.grindT > 0) return;
    this.grindT = 0.6; this.audio.play('grind'); this.jolt += 0.3;
    if (msg) this.onToast(msg);
  }
  moveKnob(dx, dy, clutch) {
    const k = this.knob, Sy = 0.0085, SX = 0.034;
    if (Math.abs(k.y) < 0.4 && Math.abs(dx) > Math.abs(dy) * 1.2) k.y = 0;
    const inRail = Math.abs(k.y) < 0.14;
    if (inRail) {
      k.x = clamp(k.x + dx * SX, -1, 1);
      const col = Math.round(k.x);
      if (Math.abs(dy) > Math.abs(dx) * 0.4) { k.x = col; k.y = clamp(k.y - dy * Sy, -1, 1); }
      else { k.y = clamp(k.y - dy * Sy, -0.13, 0.13); }
    } else {
      k.x = Math.round(k.x);
      k.y = clamp(k.y - dy * Sy, -1, 1);
    }
    if (Math.abs(k.y) > 0.3 && !slotGear(Math.round(k.x), k.y > 0)) { k.y = Math.sign(k.y) * 0.13; return; }
    if (Math.abs(k.y) > 0.5) {
      const g = slotGear(Math.round(k.x), k.y > 0);
      if (g !== this.gear) {
        if (this.engineOn && !clutch) { k.y = Math.sign(k.y) * 0.5; this.grind('*GRIIIND* Hold Q (clutch) while you shift!'); return; }
        if (g === 'R' && this.v > 1) { k.y = Math.sign(k.y) * 0.5; this.grind('Stop before shifting into reverse!'); return; }
      }
    }
    let ng = this.gear;
    if (Math.abs(k.y) >= 0.85) ng = slotGear(Math.round(k.x), k.y > 0);
    else if (Math.abs(k.y) < 0.5) ng = 'N';
    if (ng !== this.gear) { this.gear = ng; this.audio.play('shift'); }
  }
  ignition(clutch) {
    if (this.engineOn) { this.engineOn = false; this.audio.play('stall'); return; }
    if (this.crank > 0) return;
    const hatch = this.type === 'rv' ? 'front' : 'back';
    if (this.health <= 0) { this.audio.play('crank'); this.onToast(`Engine's busted. Use a Repair Kit on the engine hatch (${hatch}).`); return; }
    if (this.fuel <= 0) { this.audio.play('deny'); this.onToast('Battery is flat! Plug a Power Cell into the rear charge port.'); return; }
    if (this.gear !== 'N' && !clutch && !this.automatic) { this.audio.play('stall'); this.v += 0.8 * Math.sign(RATIO[this.gear]); this.jolt += 1; this.onToast('*LURCH* — hold Q (clutch) or put it in Neutral, then press R.'); return; }
    this.crank = 0.85; this.audio.play('crank');
  }
  update(dt, inp) {
    const w = this.world, S = this.spec;
    let throttle = inp.throttle, brake = inp.brake;
    const clutch = this.automatic ? false : inp.clutch;
    if (this.automatic && this.engineOn) {
      const stopped = Math.abs(this.v) < 0.6;
      if (this.gear === 'R') { if (inp.throttle > 0 && stopped) this.setGear('1'); }
      else if (inp.brake > 0 && stopped && inp.throttle === 0) this.setGear('R');
      else if (this.gear === 'N' && inp.throttle > 0) this.setGear('1');
      if (this.gear === 'R') { throttle = inp.brake; brake = inp.throttle; }
      const gi = ['1', '2', '3', '4', '5'].indexOf(this.gear);
      this.shiftT = (this.shiftT || 0) - dt;
      if (gi >= 0 && this.shiftT <= 0) {
        if (this.rpm > 4700 && gi < 4 && throttle > 0) { this.setGear(String(gi + 2)); this.shiftT = 0.7; this.audio.play('shift'); }
        else if (this.rpm < 1600 && gi > 0) { this.setGear(String(gi)); this.shiftT = 0.7; }
      }
    }
    this.effBrake = brake;
    this.solar = S.solar ? (inp.solar || 0) : 0;
    if (this.solar > 0.02) this.fuel = Math.min(100, this.fuel + dt * 0.5 * this.solar);
    // coming to a stop in gear pops it into neutral (only after actually driving)
    if (Math.abs(this.v) > 1.2) this.wasMoving = true;
    if (!this.automatic && this.wasMoving && Math.abs(this.v) < 1.0 && ['1', '2', '3', '4', '5'].includes(this.gear) && throttle < 0.05) {
      this.stopT = (this.stopT || 0) + dt;
      if (this.stopT > 0.25) { this.setGear('N'); this.audio.play('shift'); this.stopT = 0; this.wasMoving = false; }
    } else this.stopT = 0;
    if (Math.abs(this.v) < 1.0 && throttle >= 0.05) this.wasMoving = false;
    if (this.crank > 0) { this.crank -= dt; if (this.crank <= 0) { this.engineOn = true; this.rpm = 1100; this.stallT = 0; } }
    const ratio = RATIO[this.gear];
    const coupled = this.engineOn && !clutch && this.gear !== 'N';
    let aDrive = 0;
    if (this.engineOn) {
      const wheelRpm = Math.abs(this.v * ratio * K);
      const tq = (r) => clamp(0.55 + 0.45 * Math.sin(clamp(r / 6200, 0, 1) * Math.PI * 0.95), 0, 1);
      if (coupled) {
        if (wheelRpm < 900) {
          if (throttle > 0.05) { this.rpm = lerp(this.rpm, 1000 + throttle * 1300, dt * 6); aDrive = throttle * tq(this.rpm) * ratio * S.power; }
          else this.rpm = lerp(this.rpm, 850, dt * 4);
        } else {
          this.rpm = lerp(this.rpm, wheelRpm, dt * 12);
          aDrive = this.rpm > 6000 ? 0 : throttle * tq(this.rpm) * ratio * S.power;
          if (throttle < 0.05) aDrive -= Math.sign(this.v) * Math.abs(ratio) * 0.18;
        }
      } else {
        const free = clutch && this.gear !== 'N' ? 1100 + throttle * 1400 : 850 + throttle * 3600;
        this.rpm = lerp(this.rpm, free, dt * (throttle > 0 ? 3 : 2.5));
      }
      this.stallT = 0;
      if (this.rpm > 6000) this.rpm = 6000 - Math.random() * 120;
      aDrive *= 0.45 + 0.55 * (this.health / 100);
      this.fuel = Math.max(0, this.fuel - dt * (0.03 + throttle * (this.rpm / 6000)) * S.drain * (inp.dbgNoFuel ? 0 : 1));
      if (this.fuel <= 0) { this.engineOn = false; this.audio.play('stall'); this.onToast(`${S.name} sputters… out of charge!`); }
    } else this.rpm = lerp(this.rpm, 0, dt * 3);
    aDrive *= inp.boost || 1;
    const fwd = this.forward();
    const nr = w.nearestRoad(this.pos.x, this.pos.z);
    const onRoad = nr.d < 5.2;
    this.offroad = !onRoad;
    let a = aDrive - 9.8 * Math.sin(this.pitch);
    const roll = (onRoad ? 0.12 : 0.9) + 0.0022 * this.v * this.v;
    const hold = (throttle < 0.05 && Math.abs(this.v) < 1.2 && !(coupled && Math.abs(this.v) > 0.3)) ? 2.6 : 0; // hill hold when stopped
    const decel = (brake > 0 ? 9 * brake : 0) + (this.handbrake ? 7 : 0) + roll + hold;
    this.v += a * dt;
    const dv = decel * dt;
    if (Math.abs(this.v) <= dv) { if (Math.abs(a) <= decel) this.v = 0; }
    else this.v -= Math.sign(this.v) * dv;
    this.v = clamp(this.v, -8, S.vmax);
    const maxSteer = S.maxSteer / (1 + Math.abs(this.v) / S.steerV);
    this.steer = lerp(this.steer, inp.steer * maxSteer, Math.min(1, dt * S.steerRate));
    // tyres only have so much grip: too fast into a bend and the vehicle runs wide and scrubs speed
    let yawRate = (this.v / S.wheelbase) * Math.tan(this.steer);
    const latWant = this.v * yawRate, maxLat = S.grip * (onRoad ? 1 : 0.65) * (inp.grip ?? 1);
    this.slip = Math.max(0, Math.abs(latWant) / maxLat - 1);
    if (this.slip > 0) {
      yawRate *= maxLat / Math.abs(latWant);
      this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), (1.5 + this.slip * 6) * dt);
      this.skidT = (this.skidT || 0) - dt;
      if (this.skidT <= 0 && Math.abs(this.v) > 6) { this.audio.play('skid'); this.skidT = 0.22; }
    }
    this.heading += yawRate * dt;
    // body lean in corners, squat/dive on throttle and brakes
    const latNow = this.v * yawRate, accel = (this.v - (this.vPrev ?? this.v)) / Math.max(dt, 1e-3); this.vPrev = this.v;
    this.lean = lerp(this.lean || 0, clamp(-latNow * S.TOP * 0.0042, -0.07, 0.07), Math.min(1, dt * 5));
    this.squat = lerp(this.squat || 0, clamp(accel * 0.006, -0.035, 0.03), Math.min(1, dt * 5));
    this.pos.x += fwd.x * this.v * dt; this.pos.z += fwd.z * this.v * dt; this.odometer += Math.abs(this.v * dt);
    this.collide();
    // suspension from wheels
    const T = S.track - 0.12;
    const pts = [[T, S.axleF], [-T, S.axleF], [T, S.axleR], [-T, S.axleR]].map(([lx, lz]) => {
      const x = this.pos.x + Math.cos(this.heading) * lx + Math.sin(this.heading) * lz;
      const z = this.pos.z - Math.sin(this.heading) * lx + Math.cos(this.heading) * lz;
      return w.groundH(x, z);
    });
    const front = (pts[0] + pts[1]) / 2, back = (pts[2] + pts[3]) / 2, left = (pts[0] + pts[2]) / 2, right = (pts[1] + pts[3]) / 2;
    const tp = Math.atan2(front - back, S.axleF - S.axleR), tr = Math.atan2(left - right, T * 2);
    const ty = Math.max(...pts) * 0.3 + (pts[0] + pts[1] + pts[2] + pts[3]) / 4 * 0.7;
    const prevVy = this.vy;
    this.vy += ((ty - this.y) * 120 - this.vy * 14) * dt;
    this.y += this.vy * dt;
    if (this.y < ty - 0.25) { this.y = ty - 0.25; this.vy = Math.max(this.vy, 0); }
    this.pitch = lerp(this.pitch, tp, Math.min(1, dt * 10)); this.roll = lerp(this.roll, tr, Math.min(1, dt * 10));
    const jerk = Math.abs(this.vy - prevVy) / Math.max(dt, 0.001);
    const offJolt = this.offroad ? Math.abs(this.v) * 0.04 * (0.5 + Math.random()) : 0;
    this.jolt = Math.max(0, this.jolt - dt * 3) + jerk * 0.0025 + offJolt * dt * 3;
    this.shake = Math.min(1, this.jolt * 0.6);
    this.updateTransform(dt);
    this.audio.setEngine(this.engineOn || this.crank > 0, this.crank > 0 ? 400 + Math.random() * 300 : this.rpm * (this.type === 'bus' ? 0.8 : this.type === 'van' ? 1.12 : 1), coupled ? throttle : throttle * 0.4, inp.engineVol ?? 1);
    this.audio.setWind(Math.abs(this.v), inp.engineVol ?? 1);
    for (const l of this.headL) l.intensity = this.headlights ? 60 : 0;
    this.lampMat.color.set(this.headlights ? '#fff4d0' : '#6b6352');
    this.tailMat.color.set(brake > 0 ? '#ff3030' : this.headlights ? '#a02020' : '#5a1a1a');
    this.radioLed.material.color.set(this.radioOn ? '#120a14' : '#2a1a22'); this.radioFace.visible = this.radioOn;
    this.portMat.color.set(this.fuel < 20 ? (Math.sin(performance.now() / 200) > 0 ? '#ff4040' : '#401010') : '#1c4a52');
    this.wheelGrp.rotation.z = this.steer * 4;
    this.keyMesh.rotation.z = this.engineOn ? -1.2 : this.crank > 0 ? -1.6 : 0;
    this.gearGrp.rotation.x = this.knob.y * 0.22; this.gearGrp.rotation.z = this.knob.x * 0.2;
    this.grindT = Math.max(0, this.grindT - dt);
    this.hbGrp.rotation.x = this.handbrake ? -0.55 : 0.15;
    this.lightBtn.material.color.set(this.headlights ? '#ffe066' : '#5a4a20');
    this.wiperBtn.material.color.set(this.wipersOn ? '#5ff3ff' : '#203a5a');
    if (this.wipersOn || Math.abs(this.wipers[0].rotation.z - 1.35) > 0.02) {
      this.wipeT += dt * 2.6;
      const ang = this.wipersOn ? 1.35 - (1 - Math.cos(this.wipeT)) * 0.62 : this.wipers[0].rotation.z + (1.35 - this.wipers[0].rotation.z) * Math.min(1, dt * 6);
      for (const wp of this.wipers) wp.rotation.z = ang;
      if (!this.wipersOn) this.wipeT = 0;
    }
    if (this.doors) for (const d of Object.values(this.doors)) {
      const want = d.open ? -d.side * 1.15 : 0;
      d.ang += (want - d.ang) * Math.min(1, dt * 7); d.piv.rotation.y = d.ang;
      if (d.open) { d.col[2] = -99; d.col[3] = -98; } else { for (let i = 0; i < 6; i++) d.col[i] = d.closed[i]; }
    }
    if (this.autoDoors) {
      const pl = inp.playerLocal;
      for (const d of this.autoDoors) {
        const near = pl && Math.abs(pl.z - d.zm) < d.L / 2 + 1.25 && Math.abs(pl.x - d.x) < 2.1 && pl.y > d.y0 - 1.4 && pl.y < d.y1;
        const was = d.t;
        d.t = clamp(d.t + (near ? 1 : -1) * dt * 4, 0, 1);
        if ((was === 0 && d.t > 0) || (was === 1 && d.t < 1)) this.audio.play('door');
        const e = d.t * d.t * (3 - 2 * d.t);
        if (d.kind === 'hinge') d.piv.rotation.y = -d.side * 1.25 * e;
        else { d.piv.position.x = d.x + d.side * 0.1 * Math.min(1, e * 5); d.piv.position.z = d.zh + d.dir * (d.L + 0.02) * e; }
        if (d.t > 0.35) { d.col[2] = -99; d.col[3] = -98; } else for (let i = 0; i < 6; i++) d.col[i] = d.closed[i];
      }
    }
    for (const r of this.rack) { r.g.position.x = r.base.x + (Math.random() - 0.5) * this.shake * 0.05; r.g.position.y = r.base.y + Math.random() * this.shake * 0.06; }
    if (this.health < 35 && this.engineOn) {
      for (const s of this.smoke) {
        if (s.life <= 0 && Math.random() < dt * 3) { s.life = 1.5; s.m.visible = true; this.local(...S.smoke, s.m.position); }
        if (s.life > 0) { s.life -= dt; s.m.position.y += dt * 1.2; s.m.scale.setScalar(1 + (1.5 - s.life)); if (s.life <= 0) s.m.visible = false; }
      }
    }
    if (this.shell) {
      this.shellU.uInvRoot.value.copy(this.root.matrixWorld).invert();
      const dth = this.v * dt / this.spec.wheelR; for (const a of this.shellSpin) a.rotateX(dth);
      for (const m of this.shellLamps) m.emissiveIntensity = this.headlights ? 1.2 : 0.2;
    }
    this.dashT -= dt; if (this.dashT <= 0) { this.dashT = 0.08; this.drawDash(); }
  }
  // render the in-cab mirror / CCTV monitor (called by main while someone is driving)
  renderCams(renderer, scene) {
    const S = this.spec, _a = new THREE.Vector3();
    if (this.mirrorCam) {
      const mc = this.mirrorCam;
      this.local(...S.mirrorCam, mc.position); mc.up.set(0, 1, 0); mc.lookAt(this.local(S.mirrorCam[0], S.mirrorCam[1] - 0.8, S.ZB - 34, _a));
      renderer.setRenderTarget(this.mirrorRT); renderer.render(scene, mc);
    }
    if (this.camFeeds) {
      // one feed per frame keeps it cheap; the rear feed refreshes every other frame
      this.camIdx = (this.camIdx + 1) % 6;
      const c = this.camFeeds[this.camIdx % 2 ? 3 : Math.floor(this.camIdx / 2)];
      this.local(...c.p, c.cam.position); c.cam.up.set(0, 1, 0).applyQuaternion(this.root.quaternion); c.cam.lookAt(this.local(...c.t, _a));
      renderer.setRenderTarget(c.rt); renderer.render(scene, c.cam);
    }
    renderer.setRenderTarget(null);
  }
  collide() {
    const w = this.world, S = this.spec;
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    for (const lz of S.colZ) {
      const p = { x: this.pos.x + s * lz, z: this.pos.z + c * lz };
      const r = S.colR;
      let hitN = null;
      for (const o of w.obstacles) {
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
        if (d < r + o.r && d > 1e-4) { const pen = r + o.r - d; this.pos.x += dx / d * pen; this.pos.z += dz / d * pen; hitN = { nx: dx / d, nz: dz / d }; }
      }
      const q = { x: p.x, z: p.z };
      const bh = w.collideCircle(q, r, this.y + 0.3);
      if (bh) { this.pos.x += q.x - p.x; this.pos.z += q.z - p.z; hitN = bh; }
      if (hitN) {
        const fwd = this.forward();
        const imp = Math.abs(this.v * (fwd.x * hitN.nx + fwd.z * hitN.nz));
        if (imp > 1.5) {
          if (!this.godMode) this.health = Math.max(0, this.health - imp * 2.6);
          this.jolt += imp * 0.25; this.audio.play('clunk');
          this.onHit && this.onHit(imp);
          if (this.health <= 0 && this.engineOn) { this.engineOn = false; this.onToast('KRNNNK. The engine died. Repair kit needed!'); }
        }
        this.v *= -0.25;
      }
    }
    // stay within the generated world: don't wander too far from the road
    const n = w.nearestRoad(this.pos.x, this.pos.z);
    if (n.d > 220) { const k = (n.d - 220) / n.d; this.pos.x -= (this.pos.x - n.px) * k; this.pos.z -= (this.pos.z - n.pz) * k; this.v *= 0.5; }
  }
  updateTransform(dt = 0) {
    this.root.position.set(this.pos.x, this.y, this.pos.z);
    this.root.rotation.set(-this.pitch - (this.squat || 0), this.heading, this.roll + (this.lean || 0), 'YXZ');
    this.wheelRot += this.v * dt / this.spec.wheelR;
    for (const wh of this.wheels) { wh.w.rotation.x = this.wheelRot; wh.piv.rotation.y = wh.front ? this.steer : 0; }
    this.root.updateMatrixWorld(true);
  }
  drawDash() {
    const g = this.dashTex.userData.ctx;
    g.fillStyle = '#111014'; g.fillRect(0, 0, 256, 96);
    const dial = (cx, val, max, label, col) => {
      g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.arc(cx, 52, 34, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.strokeStyle = col; g.beginPath(); g.arc(cx, 52, 34, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * clamp(val / max, 0, 1))); g.stroke();
      const a = Math.PI * (0.8 + 1.4 * clamp(val / max, 0, 1));
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 52); g.lineTo(cx + Math.cos(a) * 30, 52 + Math.sin(a) * 30); g.stroke();
      g.fillStyle = '#aaa'; g.font = '11px monospace'; g.textAlign = 'center'; g.fillText(label, cx, 82);
    };
    dial(42, Math.abs(this.v) * 3.6, 110, `${Math.round(Math.abs(this.v) * 3.6)} KM/H`, '#5ff3ff');
    dial(214, this.rpm, 7000, `${(this.rpm / 1000).toFixed(1)}k RPM`, this.rpm > 5600 ? '#ff4a4a' : '#ffb347');
    g.fillStyle = '#ffe066'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.fillText(this.gear, 128, 50);
    g.fillStyle = '#333'; g.fillRect(88, 62, 80, 8);
    g.fillStyle = this.fuel < 20 ? '#ff4a4a' : '#4ff0ff'; g.fillRect(88, 62, 80 * this.fuel / 100, 8);
    g.fillStyle = this.solar > 0.05 ? '#ffe066' : '#aaa'; g.font = '10px monospace'; g.fillText(this.solar > 0.05 ? '☀ SOLAR CHARGING' : '⚡ CHARGE', 128, 84);
    const lamp = (x, on, txt, col) => { g.fillStyle = on ? col : '#2a2a2a'; g.font = 'bold 12px monospace'; g.fillText(txt, x, 14); };
    if (this.engineOn && this.rpm > 5200 && !['5', 'N', 'R'].includes(this.gear) && Math.sin(performance.now() / 90) > 0) { g.fillStyle = '#ffe066'; g.font = 'bold 13px monospace'; g.fillText('SHIFT ▲', 128, 92); }
    lamp(96, this.handbrake, '(P)', '#ff4040'); lamp(128, this.engineOn, 'ENG', '#4cff7a'); lamp(160, this.health < 35, 'DMG', '#ff4040');
    this.dashTex.needsUpdate = true;
  }
}
