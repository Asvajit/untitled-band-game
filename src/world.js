import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, basic, canvasTex, neonTex } from './render.js';
import { makeInstrument } from './instruments.js';
import { mulberry32, noise2, clamp, lerp, smoothstep } from './util.js';
import { defaultLevel, ACCESS } from './level.js';

export const ROAD_HALF = 4.6;
export const LEGS = [
  { id: 1, title: 'PART 1 · STARTING OUT', venueName: 'The Rusty Nail', town: 'Hollow Creek', vehicle: 'van' },
  { id: 2, title: 'PART 2 · THE OPEN ROAD', venueName: 'Neon Falls', town: 'Neon Falls', vehicle: 'rv' },
  { id: 3, title: 'PART 3 · MAKING IT BIG', venueName: 'The Megadome', town: 'Chrome City', vehicle: 'bus' },
];

export class World {
  constructor(scene, level) {
    this.scene = scene; this.level = level || defaultLevel();
    this.boxes = []; this.obstacles = []; this.anim = []; this.night = []; this.venues = []; this.studios = [];
    this.rng = mulberry32(7);
    this.buildRoad();
    this.defineZones();
    this.buildTerrain();
    this.buildRoadMesh();
    this.buildWaterfall();
    this.buildProps();
    this.buildCity();
    this.buildStart();
    this.buildRest();
    this.studios.push(this.buildStudio(this.sStudio1, 'HAYLOFT STUDIO', '#a8452f', '#ffd27a'));
    this.studios.push(this.buildStudio(this.sStudio2, 'PRACTICE STUDIO', '#5a6f8a', '#d8ff9e'));
    this.studios.push(this.buildStudio(this.sStudio3, 'CHROME REHEARSALS', '#3a3f55', '#7af0ff'));
    this.venues.push(this.buildBar(this.V1));
    this.venues.push(this.buildNeonFalls(this.V2));
    this.venues.push(this.buildStadium(this.V3));
    this.buildObstacles();
    this.setVenue(0);
  }

  // ---------------- road ----------------
  buildRoad() {
    const LV = this.level;
    const pts = LV.road.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.length = this.curve.getLength();
    const N = Math.ceil(this.length / 2);
    this.N = N; this.step = this.length / N;
    const sp = this.curve.getSpacedPoints(N);
    this.rx = new Float32Array(N + 1); this.rz = new Float32Array(N + 1); this.ry = new Float32Array(N + 1);
    this.tx = new Float32Array(N + 1); this.tz = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { this.rx[i] = sp[i].x; this.rz[i] = sp[i].z; }
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
      const dx = this.rx[b] - this.rx[a], dz = this.rz[b] - this.rz[a];
      const l = Math.hypot(dx, dz) || 1; this.tx[i] = dx / l; this.tz[i] = dz / l;
    }
    // spatial hash (needed before landmark lookup)
    this.cell = 24; this.hash = new Map();
    for (let i = 0; i <= N; i++) {
      const k = Math.floor(this.rx[i] / this.cell) + ',' + Math.floor(this.rz[i] / this.cell);
      if (!this.hash.has(k)) this.hash.set(k, []);
      this.hash.get(k).push(i);
    }
    this._nr = { d: 0, s: 0, i: 0, side: 0, px: 0, pz: 0 };
    // landmarks along the road
    const L = this.length;
    const sOf = (p) => this.nearestRoad(p[0], p[1]).s;
    const ve = LV.venues;
    this.sBar = clamp(sOf([ve[0][0], ve[0][1] + ACCESS[0]]), 200, L - 400);
    this.sNF = clamp(sOf([ve[1][0], ve[1][1] + ACCESS[1]]), this.sBar + 200, L - 200);
    this.sEnd = L;
    this.sFalls = clamp(sOf(LV.falls), 80, L - 80);
    this.sStudio1 = clamp(sOf(LV.studios[0]), 60, L - 60);
    this.sRest = clamp(sOf(LV.rest), 60, L - 60);
    this.sStudio2 = clamp(sOf(LV.studios[1]), 60, L - 60);
    this.sStudio3 = clamp(sOf(LV.studios[2]), 60, L - 60);
    this.legRange = [[0, this.sBar], [this.sBar, this.sNF], [this.sNF, L]];
    // elevation: rolling hills in the country, gentle desert, flat city
    const raw = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const s = i * this.step, b = this.biome(s);
      const amp = 1.25 * b.c + 0.9 * b.d + 0.08 * b.u;
      raw[i] = amp * (6 * Math.sin(s / 150) + 3.2 * Math.sin(s / 61 + 1.3) + 1.6 * Math.sin(s / 29 + 0.4)) + Math.min(s, this.sNF + 200) * 0.012;
    }
    const flats = [[20, 30, 110], [this.sStudio1, 30, 90], [this.sBar, 50, 130], [this.sRest, 35, 95], [this.sStudio2, 30, 90], [this.sNF, 60, 140], [this.sStudio3, 30, 90], [L, 60, 150]];
    const at = (s) => raw[Math.round(clamp(s, 0, L) / this.step)];
    for (let i = 0; i <= N; i++) {
      const s = i * this.step;
      let e = raw[i];
      for (const [fs, a, b] of flats) e = lerp(at(fs), e, smoothstep(a, b * 1.8, Math.abs(s - fs)));
      this.ry[i] = e;
    }
    // smooth, then cap the gradient so there are no sudden humps or drops anywhere on the route
    const smooth = (passes, k0) => { for (let pass = 0; pass < passes; pass++) { const c = this.ry.slice(); for (let i = 0; i <= N; i++) { let sum = 0; for (let k = -k0; k <= k0; k++) sum += c[clamp(i + k, 0, N)]; this.ry[i] = sum / (k0 * 2 + 1); } } };
    smooth(4, 6);
    const maxG = 0.055 * this.step;
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i <= N; i++) this.ry[i] = clamp(this.ry[i], this.ry[i - 1] - maxG, this.ry[i - 1] + maxG);
      for (let i = N - 1; i >= 0; i--) this.ry[i] = clamp(this.ry[i], this.ry[i + 1] - maxG, this.ry[i + 1] + maxG);
      smooth(2, 5);
    }
    // coarse nearest-road field for fast terrain generation
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i <= N; i++) { minX = Math.min(minX, this.rx[i]); maxX = Math.max(maxX, this.rx[i]); minZ = Math.min(minZ, this.rz[i]); maxZ = Math.max(maxZ, this.rz[i]); }
    this.bbox = { minX, maxX, minZ, maxZ };
  }
  // biome weights at road distance s: c = countryside, d = desert, u = urban
  biome(s) {
    const c = 1 - smoothstep(this.sBar + 80, this.sBar + 420, s);
    const u = smoothstep(this.sNF + 140, this.sNF + 460, s);
    return { c, u, d: Math.max(0, 1 - c - u) };
  }
  legAt(s) { return s < this.sBar + 40 ? 0 : s < this.sNF + 60 ? 1 : 2; }
  roadIndex(s) { return clamp(s / this.step, 0, this.N); }
  roadYAt(s) { const f = this.roadIndex(s), i = Math.floor(f), j = Math.min(this.N, i + 1), t = f - i; return lerp(this.ry[i], this.ry[j], t); }
  roadPoint(s) {
    const f = this.roadIndex(s), i = Math.floor(f), j = Math.min(this.N, i + 1), t = f - i;
    return { x: lerp(this.rx[i], this.rx[j], t), z: lerp(this.rz[i], this.rz[j], t), y: lerp(this.ry[i], this.ry[j], t), tx: lerp(this.tx[i], this.tx[j], t), tz: lerp(this.tz[i], this.tz[j], t) };
  }
  nearestRoad(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = -1, bd = Infinity, foundAt = -1;
    for (let r = 0; r < 30; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const arr = this.hash.get((cx + dx) + ',' + (cz + dz));
          if (!arr) continue;
          for (const i of arr) { const ddx = this.rx[i] - x, ddz = this.rz[i] - z; const d = ddx * ddx + ddz * ddz; if (d < bd) { bd = d; best = i; } }
        }
      }
      if (best >= 0 && foundAt < 0) foundAt = r;
      if (foundAt >= 0 && r >= foundAt + 1) break;
    }
    const o = this._nr;
    if (best < 0) { o.d = 1e4; o.s = 0; o.i = 0; o.px = x; o.pz = z; o.side = 0; return o; }
    let bs = best * this.step, bdist = Math.sqrt(bd), bpx = this.rx[best], bpz = this.rz[best];
    for (const j of [best - 1, best]) {
      if (j < 0 || j + 1 > this.N) continue;
      const ax = this.rx[j], az = this.rz[j], ex = this.rx[j + 1] - ax, ez = this.rz[j + 1] - az;
      const L2 = ex * ex + ez * ez; let t = ((x - ax) * ex + (z - az) * ez) / L2; t = clamp(t, 0, 1);
      const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
      if (d < bdist) { bdist = d; bs = (j + t) * this.step; bpx = px; bpz = pz; }
    }
    o.d = bdist; o.s = bs; o.i = best; o.px = bpx; o.pz = bpz;
    const p = this.roadPoint(bs);
    o.side = Math.sign((x - bpx) * (-p.tz) + (z - bpz) * p.tx);
    return o;
  }

  frameAt(s, off = 0) {
    const p = this.roadPoint(s), rx = -p.tz, rz = p.tx;
    return { x: p.x, z: p.z, y: this.roadYAt(s), tx: p.tx, tz: p.tz, rx, rz, cx: p.x + rx * off, cz: p.z + rz * off };
  }
  defineZones() {
    const L = this.length;
    const pr = this.frameAt(this.sRest, 24); this.restFrame = pr; this.restCenter = { x: pr.cx, z: pr.cz };
    // venues: axis-aligned, stage at the north end facing south, road passing behind (north) for load-in
    const vy = (s) => this.roadYAt(s);
    const ve = this.level.venues;
    this.V1 = { x: ve[0][0], z: ve[0][1], y: vy(this.sBar) };
    this.V2 = { x: ve[1][0], z: ve[1][1], y: vy(this.sNF) };
    this.V3 = { x: ve[2][0], z: ve[2][1], y: vy(L) };
    const p0 = this.roadPoint(20);
    this.zones = [
      { x: p0.x, z: p0.z, r: 48, y: this.roadYAt(20) },
      { x: pr.cx, z: pr.cz, r: 22, y: pr.y },
      { x: this.V1.x, z: this.V1.z, r: 18, y: this.V1.y }, { x: this.V1.x, z: this.V1.z + 22, r: 16, y: this.V1.y },
      { x: this.V2.x, z: this.V2.z, r: 58, y: this.V2.y }, { x: this.V2.x, z: this.V2.z + 42, r: 34, y: this.V2.y },
      { x: this.V3.x, z: this.V3.z, r: 98, y: this.V3.y }, { x: this.V3.x, z: this.V3.z + 85, r: 40, y: this.V3.y },
    ];
    for (const s of [this.sStudio1, this.sStudio2, this.sStudio3]) { const f = this.frameAt(s, 22); this.zones.push({ x: f.cx, z: f.cz, r: 20, y: f.y }); }
    // waterfall + river crossing the road (countryside)
    const fw = this.frameAt(this.sFalls);
    this.fallsY = fw.y - 5.5;
    this.riverDir = { x: fw.rx, z: fw.rz }; // from the road toward the falls (right side)
    this.falls = { x: fw.x + fw.rx * 58, z: fw.z + fw.rz * 58 };
    this.river = [];
    for (let k = -1; k <= 14; k++) { const d = 50 - k * 12; const wob = Math.sin(k * 0.9) * 6; this.river.push({ x: fw.x + fw.rx * d + fw.tx * wob, z: fw.z + fw.rz * d + fw.tz * wob }); }
    this.startPoseS = 20;
  }
  riverDist(x, z) {
    let best = Infinity;
    const R = this.river;
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / L2, 0, 1);
      best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t));
    }
    return best;
  }

  heightNatural(x, z, n) {
    const base = this.roadYAt(n.s), d = n.d, b = this.biome(n.s);
    const rough = 1 - b.u * 0.97;
    const hills = b.c * 1.35 + b.d;
    const nat = base
      + Math.max(0, d - 12) * 0.3 * (0.75 + 0.5 * (noise2(x / 90, z / 90) * 0.5 + 0.5)) * rough
      + 14 * hills * noise2(x / 140 + 3, z / 140) * smoothstep(20, 90, d)
      + 3.5 * noise2(x / 38, z / 38) * smoothstep(12, 40, d) * rough
      + 0.9 * noise2(x / 9, z / 9) * smoothstep(10, 22, d) * rough;
    let h = lerp(base - 0.25, nat, smoothstep(9.5, 32, d));
    // waterfall cliff + river valley
    const fd = Math.hypot(x - this.falls.x, z - this.falls.z);
    if (fd < 140) {
      const up = (x - this.falls.x) * this.riverDir.x + (z - this.falls.z) * this.riverDir.z; // >0 = behind the falls
      const cliff = smoothstep(-4, 6, up) * (1 - smoothstep(40, 110, fd));
      h = Math.max(h, lerp(h, this.fallsY + 24 + noise2(x / 12, z / 12) * 2, cliff));
    }
    const rd = this.riverDist(x, z);
    if (rd < 26) h = lerp(Math.min(h, this.fallsY - 1.4), h, smoothstep(5, 26, rd));
    if (rd < 60 && fd < 120) h = lerp(Math.min(h, this.fallsY + 1.5), h, smoothstep(14, 60, rd));
    for (const zn of this.zones) {
      const dz = Math.hypot(x - zn.x, z - zn.z);
      const w = 1 - smoothstep(zn.r, zn.r + 20, dz);
      if (w > 0) h = lerp(h, zn.y - 0.06, w);
    }
    return h;
  }

  // ---------------- terrain (tiled, only near the road) ----------------
  buildTerrain() {
    const bb = this.bbox, pad = 200, cs = 6;
    this.cs = cs;
    this.tMinX = Math.floor(bb.minX - pad); this.tMinZ = Math.floor(bb.minZ - pad);
    this.tnx = Math.ceil((bb.maxX + pad - this.tMinX) / cs); this.tnz = Math.ceil((bb.maxZ + pad - this.tMinZ) / cs);
    const W = this.tnx + 1, H = this.tnz + 1;
    this.th = new Float32Array(W * H);
    const ts = new Float32Array(W * H), td = new Float32Array(W * H).fill(999), done = new Uint8Array(W * H);
    // coarse nearest-road grid (16 m) using a subsampled road, refined locally per vertex
    const cg = 16, cgx = Math.ceil((W * cs) / cg) + 1, cgz = Math.ceil((H * cs) / cg) + 1;
    const coarse = new Int32Array(cgx * cgz);
    const sub = []; for (let i = 0; i <= this.N; i += 4) sub.push(i);
    for (let j = 0; j < cgz; j++) for (let i = 0; i < cgx; i++) {
      const x = this.tMinX + i * cg, z = this.tMinZ + j * cg;
      let bd = Infinity, bi = 0;
      for (const k of sub) { const dx = this.rx[k] - x, dz = this.rz[k] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = k; } }
      coarse[j * cgx + i] = bi;
    }
    const nr = { d: 0, s: 0 };
    const fastNearest = (x, z) => {
      const ci = clamp(Math.round((x - this.tMinX) / cg), 0, cgx - 1), cj = clamp(Math.round((z - this.tMinZ) / cg), 0, cgz - 1);
      const c = coarse[cj * cgx + ci];
      let bd = Infinity, bs = 0;
      for (let j = Math.max(0, c - 14); j < Math.min(this.N, c + 14); j++) {
        const ax = this.rx[j], az = this.rz[j], ex = this.rx[j + 1] - ax, ez = this.rz[j + 1] - az;
        const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
        const d = Math.hypot(x - ax - ex * t, z - az - ez * t);
        if (d < bd) { bd = d; bs = (j + t) * this.step; }
      }
      nr.d = bd; nr.s = bs; return nr;
    };
    this.fastNearest = fastNearest;
    const TS = 32, ntx = Math.ceil(this.tnx / TS), ntz = Math.ceil(this.tnz / TS);
    const cA = new THREE.Color('#c77a45'), cA2 = new THREE.Color('#a95a37'), cG = new THREE.Color('#6f9a48'), cG2 = new THREE.Color('#4b7a3a'), cU = new THREE.Color('#77757c'), cU2 = new THREE.Color('#5f8a5a');
    const gravel = new THREE.Color('#8a7a6a'), rock = new THREE.Color('#7b6f6a'), pave = new THREE.Color('#7e7b80'), mud = new THREE.Color('#5a5040');
    const tmp = new THREE.Color(), tmp2 = new THREE.Color();
    const mat = toon('#ffffff', { vertexColors: true });
    this.terrainTiles = [];
    for (let ty = 0; ty < ntz; ty++) for (let tx = 0; tx < ntx; tx++) {
      const i0 = tx * TS, j0 = ty * TS, i1 = Math.min(this.tnx, i0 + TS), j1 = Math.min(this.tnz, j0 + TS);
      const ccx = this.tMinX + (i0 + i1) / 2 * cs, ccz = this.tMinZ + (j0 + j1) / 2 * cs;
      if (fastNearest(ccx, ccz).d > 330) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * W + i; if (done[k]) continue;
        const x = this.tMinX + i * cs, z = this.tMinZ + j * cs;
        const n = fastNearest(x, z);
        this.th[k] = this.heightNatural(x, z, n); ts[k] = n.s; td[k] = n.d; done[k] = 1;
      }
      const tris = (i1 - i0) * (j1 - j0) * 2;
      const pos = new Float32Array(tris * 9), col = new Float32Array(tris * 9);
      let q = 0;
      const vtx = (i, j) => [this.tMinX + i * cs, this.th[j * W + i], this.tMinZ + j * cs];
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const p00 = vtx(i, j), p10 = vtx(i + 1, j), p01 = vtx(i, j + 1), p11 = vtx(i + 1, j + 1);
        const ia = j * W + i;
        for (const tri of [[p00, p11, p10], [p00, p01, p11]]) {
          const a = tri[0], b = tri[1], c = tri[2];
          const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
          const s = ts[ia], d = td[ia], bio = this.biome(s);
          const nz = noise2(cx / 25, cz / 25) * 0.5 + 0.5;
          tmp.copy(cG).lerp(cG2, nz).multiplyScalar(bio.c);
          tmp2.copy(cA).lerp(cA2, nz); tmp.add(tmp2.multiplyScalar(bio.d));
          tmp2.copy(cU).lerp(cU2, nz > 0.72 ? 1 : 0.1); tmp.add(tmp2.multiplyScalar(bio.u));
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nnz = ux * vy - uy * vx;
          const slope = 1 - Math.abs(ny) / Math.hypot(nx, ny, nnz);
          if (slope > 0.25) tmp.lerp(rock, clamp((slope - 0.25) * 3, 0, 0.85));
          if (this.riverDist(cx, cz) < 9) tmp.lerp(mud, 0.6);
          if (d < 9) tmp.lerp(gravel, 0.7 * (1 - bio.u * 0.5));
          for (const zn of this.zones) { if (Math.hypot(cx - zn.x, cz - zn.z) < zn.r - 2) { tmp.lerp(pave, 0.55); break; } }
          tmp.multiplyScalar(0.94 + noise2(cx * 0.7, cz * 0.7) * 0.06);
          for (const p of tri) { pos[q] = p[0]; pos[q + 1] = p[1]; pos[q + 2] = p[2]; col[q] = tmp.r; col[q + 1] = tmp.g; col[q + 2] = tmp.b; q += 3; }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals(); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true;
      this.scene.add(mesh); this.terrainTiles.push(mesh);
    }
  }
  sampleTerrain(x, z) {
    const W = this.tnx + 1;
    let fx = (x - this.tMinX) / this.cs, fz = (z - this.tMinZ) / this.cs;
    fx = clamp(fx, 0, this.tnx - 0.0001); fz = clamp(fz, 0, this.tnz - 0.0001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const h00 = this.th[j * W + i], h10 = this.th[j * W + i + 1], h01 = this.th[(j + 1) * W + i], h11 = this.th[(j + 1) * W + i + 1];
    if (u >= v) return h00 + u * (h10 - h00) + v * (h11 - h10);
    return h00 + v * (h01 - h00) + u * (h11 - h01);
  }
  groundH(x, z) {
    const n = this.nearestRoad(x, z);
    let h = this.sampleTerrain(x, z);
    if (n.d < ROAD_HALF + 0.4) h = Math.max(h, this.roadYAt(n.s) + 0.06);
    this.lastOnRoad = n.d < ROAD_HALF + 0.8; this.lastS = n.s; this.lastD = n.d;
    return h;
  }
  walkH(x, z, feetY) {
    let h = this.groundH(x, z);
    for (const b of this.boxes) {
      if (b.top - feetY > 0.5) continue;
      const lx = (x - b.cx) * b.c - (z - b.cz) * b.s, lz = (x - b.cx) * b.s + (z - b.cz) * b.c;
      if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz) h = Math.max(h, b.top);
    }
    return h;
  }
  collideCircle(p, r, feetY) {
    let hit = false;
    for (const b of this.boxes) {
      if (b.top - feetY <= 0.5) continue;
      if (b.bottom !== undefined && feetY + 1.6 < b.bottom) continue;
      const dx = p.x - b.cx, dz = p.z - b.cz;
      if (Math.abs(dx) > b.hx + b.hz + r + 1 && Math.abs(dz) > b.hx + b.hz + r + 1) continue;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const qx = clamp(lx, -b.hx, b.hx), qz = clamp(lz, -b.hz, b.hz);
      const ex = lx - qx, ez = lz - qz; const d = Math.hypot(ex, ez);
      if (d < r) {
        let nx, nz, pen;
        if (d > 1e-5) { nx = ex / d; nz = ez / d; pen = r - d; }
        else { const ox = b.hx - Math.abs(lx), oz = b.hz - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; pen = ox + r; } else { nx = 0; nz = Math.sign(lz) || 1; pen = oz + r; } }
        const wx = nx * b.c + nz * b.s, wz = -nx * b.s + nz * b.c;
        p.x += wx * pen; p.z += wz * pen; hit = { nx: wx, nz: wz, pen };
      }
    }
    return hit;
  }
  addBox(x, y, z, w, h, d, mat, rot = 0, { solid = true, cast = true, parent = null } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z); m.rotation.y = rot; m.castShadow = cast; m.receiveShadow = true;
    (parent || this.scene).add(m);
    if (solid) this.boxes.push({ cx: x, cz: z, hx: w / 2, hz: d / 2, c: Math.cos(rot), s: Math.sin(rot), top: y + h, bottom: y });
    return m;
  }
  gable(x, y, z, w, len, rise, rot, mat) {
    const half = w / 2 + 0.4, slope = Math.atan2(rise, half), sl = Math.hypot(half, rise);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.3, len), mat);
      m.rotation.order = 'YXZ'; m.rotation.set(0, rot, s * slope);
      m.position.set(x - Math.cos(rot) * s * half / 2, y + rise / 2, z + Math.sin(rot) * s * half / 2); m.castShadow = true; this.scene.add(m);
    }
  }
  addCollider(x, z, hx, hz, rot, y0, y1) { const b = { cx: x, cz: z, hx, hz, c: Math.cos(rot), s: Math.sin(rot), top: y1, bottom: y0 }; this.boxes.push(b); return b; }
  removeCollider(b) { this.boxes = this.boxes.filter((x) => x !== b); }
  plane(w, h, tex, x, y, z, ry, transparent = true) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic('#ffffff', { map: tex, transparent }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); return m;
  }

  buildRoadMesh() {
    const N = this.N, W = ROAD_HALF;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const x = this.rx[i], z = this.rz[i], y = this.ry[i] + 0.06, rx = -this.tz[i], rz = this.tx[i];
      pos.push(x + rx * W, y, z + rz * W, x - rx * W, y, z - rz * W);
      const v = (i * this.step) / 12;
      uv.push(0, v, 1, v);
    }
    for (let i = 0; i < N; i++) { const A = i * 2, B = i * 2 + 1; idx.push(A, A + 2, B, B, A + 2, B + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const tex = canvasTex(32, 128, (g) => {
      g.fillStyle = '#3d3942'; g.fillRect(0, 0, 32, 128);
      const r = mulberry32(3);
      for (let i = 0; i < 300; i++) { g.fillStyle = r() > 0.5 ? '#46414c' : '#35313a'; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 128), 1, 1); }
      g.fillStyle = '#d8d2c4'; g.fillRect(1, 0, 1, 128); g.fillRect(30, 0, 1, 128);
      g.fillStyle = '#e8b13a'; g.fillRect(15, 0, 2, 64);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(geo, toon('#ffffff', { map: tex }));
    m.receiveShadow = true; this.scene.add(m);
  }

  // ---------------- waterfall, river & bridge ----------------
  buildWaterfall() {
    const F = this.falls, Y = this.fallsY, d = this.riverDir;
    const ry = Math.atan2(-d.x, -d.z); // plane faces back toward the road
    // water textures
    const fallTex = canvasTex(32, 128, (g) => { g.fillStyle = '#9fd8f0'; g.fillRect(0, 0, 32, 128); const r = mulberry32(9); for (let i = 0; i < 220; i++) { g.fillStyle = r() > 0.5 ? '#e8f8ff' : '#6fb6d8'; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 128), 1, 2 + Math.floor(r() * 8)); } });
    fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; fallTex.repeat.set(3, 2);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(13, 25, 1, 1), basic('#ffffff', { map: fallTex, transparent: true, opacity: 0.92 }));
    fall.position.set(F.x - d.x * 1.5, Y + 12.2, F.z - d.z * 1.5); fall.rotation.y = ry; this.scene.add(fall);
    // rock face around the fall
    const rockM = toon('#6f6862'), rockM2 = toon('#857d74');
    const r = mulberry32(41);
    for (let k = 0; k < 26; k++) {
      const side = (k % 2 ? 1 : -1), along = 5.5 + r() * 26;
      const px = F.x + d.z * side * along + d.x * (1 + r() * 4), pz = F.z - d.x * side * along + d.z * (1 + r() * 4);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + r() * 5, 0), r() > 0.5 ? rockM : rockM2);
      m.position.set(px, Y + 3 + r() * 19, pz); m.rotation.set(r() * 3, r() * 3, 0); m.scale.y = 1.4; m.castShadow = true; this.scene.add(m);
    }
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + r() * 1.5, 0), rockM2); m.position.set(F.x - d.x * (4 + r() * 6) + d.z * (r() - 0.5) * 14, Y + 0.2, F.z - d.z * (4 + r() * 6) - d.x * (r() - 0.5) * 14); this.scene.add(m); }
    // pool + river ribbon
    const riverTex = canvasTex(32, 64, (g) => { g.fillStyle = '#4f9cc4'; g.fillRect(0, 0, 32, 64); const rr = mulberry32(5); for (let i = 0; i < 90; i++) { g.fillStyle = rr() > 0.6 ? '#9fd8f0' : '#3d86b0'; g.fillRect(Math.floor(rr() * 32), Math.floor(rr() * 64), 3 + Math.floor(rr() * 5), 1); } });
    riverTex.wrapS = riverTex.wrapT = THREE.RepeatWrapping;
    const pos = [], uv = [], idx = [], R = this.river;
    for (let i = 0; i < R.length; i++) {
      const a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
      const w = i < 2 ? 11 : 4.5;
      pos.push(R[i].x - tz * w, Y, R[i].z + tx * w, R[i].x + tz * w, Y, R[i].z - tx * w);
      uv.push(0, i * 1.2, 1, i * 1.2);
    }
    for (let i = 0; i < R.length - 1; i++) { const A = i * 2; idx.push(A, A + 1, A + 2, A + 1, A + 3, A + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const river = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: riverTex, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })); this.scene.add(river);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(12, 16), new THREE.MeshBasicMaterial({ map: riverTex, transparent: true, opacity: 0.9 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(F.x - d.x * 7, Y + 0.02, F.z - d.z * 7); this.scene.add(pool);
    // spray
    const spray = [];
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), basic('#e8f6ff', { transparent: true, opacity: 0.5 })); this.scene.add(m); spray.push({ m, t: Math.random() }); }
    this.anim.push((t, dt) => {
      fallTex.offset.y = (t * 1.6) % 1; riverTex.offset.y = -(t * 0.35) % 1;
      for (const s of spray) {
        s.t += (dt || 0.016) * 0.6; if (s.t > 1) s.t = 0;
        const a = s.t * 6.28 + spray.indexOf(s);
        s.m.position.set(F.x - d.x * (3 + s.t * 4) + Math.cos(a) * 3, Y + s.t * 3.5, F.z - d.z * (3 + s.t * 4) + Math.sin(a) * 3);
        s.m.scale.setScalar(0.6 + s.t * 1.6); s.m.material.opacity = 0.5 * (1 - s.t);
      }
    });
    // bridge where the river crosses the road
    const p = this.roadPoint(this.sFalls), rot = Math.atan2(p.tx, p.tz), yR = this.roadYAt(this.sFalls);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 1.2, 1.2, 34), toon('#8a8580')); deck.position.set(p.x, yR - 0.55, p.z); deck.rotation.y = rot; deck.castShadow = true; this.scene.add(deck);
    for (const s of [-1, 1]) {
      const ox = Math.cos(rot) * s * (ROAD_HALF + 0.35), oz = -Math.sin(rot) * s * (ROAD_HALF + 0.35);
      this.addBox(p.x + ox, yR, p.z + oz, 0.3, 1.0, 34, toon('#b0a99e'), rot);
      for (const a of [-12, 0, 12]) { const px = p.x + ox + Math.sin(rot) * a, pz = p.z + oz + Math.cos(rot) * a; this.addBox(px, Y - 2, pz, 1.2, yR - Y + 0.9, 1.2, toon('#7a746c'), rot, { solid: false }); }
    }
    // scenic sign
    const fs = this.frameAt(this.sFalls - 70);
    this.billboard(this.sFalls - 90, ['SILVERTHREAD FALLS', 'SCENIC VIEW ▶'], '#7af0ff', 1);
    void fs;
    this.fallsView = { x: p.x, z: p.z, y: yR };
  }

  // ---------------- props ----------------
  buildProps() {
    const r = this.rng;
    const g = (geo, tx = 0, ty = 0, tz = 0) => { geo.translate(tx, ty, tz); return geo.toNonIndexed(); };
    const pine = mergeGeometries([g(new THREE.CylinderGeometry(0.18, 0.25, 1.4, 5), 0, 0.7), g(new THREE.ConeGeometry(1.5, 2.6, 6), 0, 2.4), g(new THREE.ConeGeometry(1.1, 2.0, 6), 0, 3.6)]); pine.computeVertexNormals();
    const oakTrunk = g(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 5), 0, 1.1); oakTrunk.computeVertexNormals();
    const oakTop = mergeGeometries([g(new THREE.IcosahedronGeometry(1.9, 0), 0, 3.4), g(new THREE.IcosahedronGeometry(1.3, 0), 1.0, 2.9, 0.4), g(new THREE.IcosahedronGeometry(1.2, 0), -0.9, 3.0, -0.3)]); oakTop.computeVertexNormals();
    const bush = mergeGeometries([g(new THREE.IcosahedronGeometry(0.8, 0), 0, 0.5), g(new THREE.IcosahedronGeometry(0.6, 0), 0.6, 0.4, 0.2)]); bush.computeVertexNormals();
    const hay = g(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 8)); hay.rotateZ(Math.PI / 2); hay.translate(0, 0.75, 0); hay.computeVertexNormals();
    const cactus = mergeGeometries([g(new THREE.CylinderGeometry(0.28, 0.32, 3, 6), 0, 1.5), g(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 6), 0.55, 1.9), (() => { const q = new THREE.CylinderGeometry(0.17, 0.17, 0.5, 6); q.rotateZ(Math.PI / 2); q.translate(0.32, 1.45, 0); return q.toNonIndexed(); })(), g(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), -0.5, 1.4)]); cactus.computeVertexNormals();
    const dead = mergeGeometries([g(new THREE.CylinderGeometry(0.1, 0.22, 3.4, 5), 0, 1.7), (() => { const q = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 4); q.rotateZ(0.8); q.translate(-0.5, 2.6, 0); return q.toNonIndexed(); })(), (() => { const q = new THREE.CylinderGeometry(0.04, 0.08, 1.3, 4); q.rotateZ(-0.7); q.translate(0.45, 2.2, 0.1); return q.toNonIndexed(); })()]); dead.computeVertexNormals();
    const rock = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(); rock.computeVertexNormals();
    const lists = { pine: [], oakTrunk: [], oakTop: [], bush: [], hay: [], cactus: [], dead: [], rock: [] };
    const L = this.length;
    const tries = Math.round(this.sNF * 1.6);
    for (let n = 0; n < tries; n++) {
      const s = r() * (this.sNF + 300), p = this.roadPoint(s), side = r() > 0.5 ? 1 : -1;
      const d = 13 + Math.pow(r(), 1.4) * 160;
      const x = p.x + (-p.tz) * side * d + (r() - 0.5) * 8, z = p.z + p.tx * side * d + (r() - 0.5) * 8;
      if (this.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + 8)) continue;
      const nr = this.nearestRoad(x, z); if (nr.d < 11) continue;
      if (this.riverDist(x, z) < 16) continue;
      const b = this.biome(nr.s);
      if (b.u > 0.5) continue;
      const y = this.sampleTerrain(x, z) - 0.1;
      let type;
      if (r() < b.c) { const q = r(); type = q < 0.18 ? 'rock' : q < 0.45 ? 'oak' : q < 0.72 ? 'pine' : q < 0.93 ? 'bush' : 'hay'; }
      else { const q = r(); type = q < 0.32 ? 'rock' : q < 0.75 ? 'cactus' : q < 0.92 ? 'dead' : 'pine'; }
      const sc = type === 'rock' ? 0.5 + r() * 2.2 : 0.8 + r() * 0.8;
      const o = { x, y, z, sc, ry: r() * 6.28, sy: type === 'rock' ? 0.5 + r() * 0.5 : 1 };
      if (type === 'oak') { lists.oakTrunk.push(o); lists.oakTop.push(o); } else lists[type].push(o);
    }
    const mats = { pine: toon('#3e6b4f'), oakTrunk: toon('#5a4637'), oakTop: toon('#5f8f3e'), bush: toon('#4f7f3a'), hay: toon('#d9b45a'), cactus: toon('#6a8f47'), dead: toon('#5a4637'), rock: toon('#8e7f74') };
    const geos = { pine, oakTrunk, oakTop, bush, hay, cactus, dead, rock };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    for (const k of Object.keys(lists)) {
      const arr = lists[k]; if (!arr.length) continue;
      const im = new THREE.InstancedMesh(geos[k], mats[k], arr.length);
      arr.forEach((o, i) => { e.set(0, o.ry, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); sv.set(o.sc, o.sc * o.sy, o.sc); m4.compose(v, q, sv); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
    }
    // fence posts along the country road
    const fenceGeo = mergeGeometries([g(new THREE.BoxGeometry(0.14, 1.1, 0.14), 0, 0.55), g(new THREE.BoxGeometry(0.06, 0.1, 3.0), 0, 0.85, 1.5), g(new THREE.BoxGeometry(0.06, 0.1, 3.0), 0, 0.45, 1.5)]); fenceGeo.computeVertexNormals();
    const fences = [];
    for (let s = 60; s < this.sBar - 60; s += 3) {
      if (Math.abs(s - this.sFalls) < 40 || Math.abs(s - this.sStudio1) < 40 || (s % 400) > 260) continue;
      const p = this.roadPoint(s);
      for (const side of [-1, 1]) { const x = p.x - p.tz * side * 7.2, z = p.z + p.tx * side * 7.2; fences.push({ x, z, y: this.sampleTerrain(x, z) - 0.05, ry: Math.atan2(p.tx, p.tz) }); }
    }
    const fim = new THREE.InstancedMesh(fenceGeo, toon('#8a6a48'), fences.length);
    fences.forEach((o, i) => { e.set(0, o.ry, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); sv.set(1, 1, 1); m4.compose(v, q, sv); fim.setMatrixAt(i, m4); });
    fim.computeBoundingSphere(); this.scene.add(fim);
    // power poles (country + desert)
    const poleGeo = mergeGeometries([g(new THREE.CylinderGeometry(0.12, 0.16, 8, 5), 0, 4), g(new THREE.BoxGeometry(2.2, 0.15, 0.15), 0, 7.4)]); poleGeo.computeVertexNormals();
    const poles = [];
    for (let s = 10; s < this.sNF - 60; s += 42) {
      if (Math.abs(s - this.sFalls) < 30) continue;
      const p = this.roadPoint(s);
      const x = p.x + p.tz * 8, z = p.z - p.tx * 8;
      if (this.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r)) continue;
      poles.push({ x, z, y: this.sampleTerrain(x, z) - 0.2, ry: Math.atan2(p.tx, p.tz) });
    }
    const pim = new THREE.InstancedMesh(poleGeo, toon('#4a3a30'), poles.length);
    const wire = [];
    poles.forEach((o, i) => {
      e.set(0, o.ry + Math.PI / 2, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); sv.set(1, 1, 1); m4.compose(v, q, sv); pim.setMatrixAt(i, m4);
      const a = poles[i - 1];
      if (a && Math.hypot(a.x - o.x, a.z - o.z) < 60) {
        for (const off of [-0.9, 0.9]) {
          const pa = new THREE.Vector3(a.x + Math.sin(a.ry + Math.PI / 2) * off, a.y + 7.5, a.z + Math.cos(a.ry + Math.PI / 2) * off);
          const pb = new THREE.Vector3(o.x + Math.sin(o.ry + Math.PI / 2) * off, o.y + 7.5, o.z + Math.cos(o.ry + Math.PI / 2) * off);
          for (let t = 0; t < 6; t++) {
            const t0 = t / 6, t1 = (t + 1) / 6, sag = (tt) => -Math.sin(tt * Math.PI) * 0.9;
            wire.push(lerp(pa.x, pb.x, t0), lerp(pa.y, pb.y, t0) + sag(t0), lerp(pa.z, pb.z, t0), lerp(pa.x, pb.x, t1), lerp(pa.y, pb.y, t1) + sag(t1), lerp(pa.z, pb.z, t1));
          }
        }
      }
    });
    pim.castShadow = true; pim.computeBoundingSphere(); this.scene.add(pim);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    this.scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2a2228' })));
    // billboards
    const boards = [
      [140, ['THE LOOSE WIRES', 'LIVE @ THE RUSTY NAIL — TONIGHT'], '#ff6ad5', 1, 'band1'],
      [this.sStudio1 - 160, ['HAYLOFT STUDIO', 'NEXT RIGHT — PRACTISE!'], '#ffd27a', 1],
      [this.sBar - 300, ['THE RUSTY NAIL', 'LIVE MUSIC · COLD OIL'], '#ffb347', -1],
      [this.sBar + 260, ['THE LOOSE WIRES', 'LIVE @ NEON FALLS'], '#ff6ad5', 1, 'band2'],
      [this.sRest - 160, ['REST STOP AHEAD', '⚡ CHARGE • SNACKS • STRINGS'], '#5ff3ff', -1],
      [this.sStudio2 - 150, ['PRACTICE STUDIO', 'NEXT RIGHT — PRACTISE!'], '#d8ff9e', 1],
      [this.sNF - 260, ['NEON FALLS', 'CITY LIMITS'], '#ffb347', 1],
      [this.sNF + 300, ['CHROME CITY', 'THE MEGADOME — SOLD OUT'], '#7af0ff', -1, 'band3'],
      [this.sStudio3 - 120, ['CHROME REHEARSALS', 'NEXT RIGHT'], '#7af0ff', 1],
    ];
    this.boardFaces = {};
    boards.forEach(([s, lines, col, side, key]) => { const f = this.billboard(s, lines, col, side); if (key) this.boardFaces[key] = { f, lines, col }; });
  }
  billboard(s, lines, col, side) {
    const p = this.roadPoint(s);
    const rx = -p.tz * side, rz = p.tx * side;
    const x = p.x + rx * 13, z = p.z + rz * 13, y = this.sampleTerrain(x, z) - 0.3;
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.rotation.y = Math.atan2(-rx, -rz) + (side > 0 ? 0.35 : -0.35);
    const wood = toon('#4a3a30');
    for (const sx of [-3, 3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), wood); l.position.set(sx, 3, 0); l.castShadow = true; g.add(l); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 0.3), toon('#2b2530')); back.position.y = 6.5; back.castShadow = true; g.add(back);
    const tex = neonTex(lines, { w: 512, h: 200, color: col, size: [58, 30], bg: '#1d1622', border: true });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.3), basic('#ffffff', { map: tex })); face.position.set(0, 6.5, 0.16); g.add(face);
    this.scene.add(g);
    return face;
  }

  // ---------------- city ----------------
  buildCity() {
    const r = mulberry32(77);
    const facade = canvasTex(64, 64, (g) => {
      g.fillStyle = '#b8b4ae'; g.fillRect(0, 0, 64, 64);
      for (let y = 4; y < 64; y += 16) for (let x = 4; x < 64; x += 16) { g.fillStyle = '#2c3440'; g.fillRect(x, y, 9, 9); g.fillStyle = '#4a5666'; g.fillRect(x, y, 9, 2); }
    });
    facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
    const lit = canvasTex(64, 64, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
      const rr = mulberry32(12);
      for (let y = 4; y < 64; y += 16) for (let x = 4; x < 64; x += 16) { const v = rr(); if (v > 0.45) { g.fillStyle = v > 0.85 ? '#7af0ff' : v > 0.75 ? '#ff8ad8' : '#ffcf7a'; g.fillRect(x, y, 9, 9); } }
    });
    lit.wrapS = lit.wrapT = THREE.RepeatWrapping;
    const geos = [], placed = [];
    const tryBuilding = (x, z, w, d, h, rot) => {
      const nr = this.nearestRoad(x, z);
      if (nr.d < Math.max(w, d) * 0.72 + 8) return false;
      if (this.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + Math.max(w, d) * 0.7 + 4)) return false;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r + Math.max(w, d) * 0.6))) return false;
      placed.push({ x, z, r: Math.max(w, d) * 0.6 });
      const y = this.sampleTerrain(x, z) - 0.3;
      const geo = new THREE.BoxGeometry(w, h, d);
      const uvA = geo.attributes.uv, dims = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; const [du, dv] = dims[f]; uvA.setXY(i, du ? uvA.getX(i) * du / 5 : 0.02, dv ? uvA.getY(i) * dv / 4 : 0.02); }
      geo.rotateY(rot); geo.translate(x, y + h / 2, z);
      const c = new THREE.Color().setHSL(0.55 + r() * 0.5, 0.12 + r() * 0.15, 0.55 + r() * 0.3);
      const col = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(geo);
      this.addCollider(x, z, w / 2, d / 2, rot, y, y + h);
      return true;
    };
    const s0 = this.sNF + 300;
    for (let s = s0; s < this.length - 20; s += 9) {
      const p = this.roadPoint(s), rot = Math.atan2(p.tx, p.tz), down = smoothstep(s0, this.length - 400, s);
      for (const side of [-1, 1]) for (const row of [0, 1, 2]) {
        if (r() < 0.25) continue;
        const w = 10 + r() * 14, d = 10 + r() * 12, h = 8 + r() * (16 + down * 60) * (row ? 1.2 : 0.8);
        const off = 18 + row * 26 + r() * 6;
        tryBuilding(p.x - p.tz * side * off, p.z + p.tx * side * off, w, d, h, rot);
      }
    }
    if (geos.length) {
      const geo = mergeGeometries(geos);
      const mat = toon('#ffffff', { map: facade, vertexColors: true, emissiveMap: lit, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
      this.night.push((k) => { mat.emissiveIntensity = k * 1.1; });
    }
    // street lamps along city roads
    const lampGeo = (() => { const a = new THREE.CylinderGeometry(0.1, 0.14, 7, 5); a.translate(0, 3.5, 0); const b = new THREE.BoxGeometry(0.12, 0.12, 2); b.translate(0, 7, 1); return mergeGeometries([a.toNonIndexed(), b.toNonIndexed()]); })();
    lampGeo.computeVertexNormals();
    const bulbGeo = new THREE.BoxGeometry(0.5, 0.15, 0.7); bulbGeo.translate(0, 6.9, 1.9);
    const lamps = [];
    for (let s = this.sNF + 220; s < this.length - 30; s += 28) {
      const p = this.roadPoint(s);
      for (const side of [-1, 1]) { const x = p.x - p.tz * side * 6.4, z = p.z + p.tx * side * 6.4; lamps.push({ x, z, y: this.sampleTerrain(x, z) - 0.1, ry: Math.atan2(p.tz * side, -p.tx * side) }); }
    }
    const lim = new THREE.InstancedMesh(lampGeo, toon('#3a3a42'), lamps.length), bim = new THREE.InstancedMesh(bulbGeo, basic('#ffe6b0'), lamps.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    lamps.forEach((o, i) => { e.set(0, o.ry, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); m4.compose(v, q, one); lim.setMatrixAt(i, m4); bim.setMatrixAt(i, m4); });
    lim.computeBoundingSphere(); bim.computeBoundingSphere(); this.scene.add(lim, bim);
    const bulbMat = bim.material; this.night.push((k) => bulbMat.color.set(k > 0.4 ? '#ffe6b0' : '#77746a'));
    // parked cars
    const carGeo = mergeGeometries([(() => { const a = new THREE.BoxGeometry(1.8, 0.7, 4.2); a.translate(0, 0.65, 0); return a.toNonIndexed(); })(), (() => { const a = new THREE.BoxGeometry(1.6, 0.6, 2.2); a.translate(0, 1.3, -0.2); return a.toNonIndexed(); })()]);
    carGeo.computeVertexNormals();
    const cars = [];
    for (let s = this.sNF + 260; s < this.length - 60; s += 17) {
      if (r() < 0.45) continue;
      const p = this.roadPoint(s), side = r() > 0.5 ? 1 : -1;
      const x = p.x - p.tz * side * 7.6, z = p.z + p.tx * side * 7.6;
      if (this.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + 4)) continue;
      cars.push({ x, z, y: this.sampleTerrain(x, z), ry: Math.atan2(p.tx, p.tz), c: new THREE.Color().setHSL(r(), 0.5, 0.45) });
      this.obstacles.push({ x, z, r: 1.2 });
      this.addCollider(x, z, 0.9, 2.1, Math.atan2(p.tx, p.tz), cars[cars.length - 1].y, cars[cars.length - 1].y + 1.6);
    }
    const cim = new THREE.InstancedMesh(carGeo, toon('#ffffff'), cars.length);
    cars.forEach((o, i) => { e.set(0, o.ry, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); m4.compose(v, q, one); cim.setMatrixAt(i, m4); cim.setColorAt(i, o.c); });
    cim.castShadow = true; cim.computeBoundingSphere(); this.scene.add(cim);
  }

  // Road blockers the band has to get out and clear.
  buildObstacles() {
    this.blockers = [];
    const defs = this.level.blockers.map((b) => [clamp(this.nearestRoad(b[0], b[1]).s, 40, this.length - 40), b[2]]);
    for (const [s, kind] of defs) {
      const p = this.roadPoint(s), y = this.roadYAt(s);
      const g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = Math.atan2(p.tx, p.tz);
      const pieces = [];
      if (kind === 'rocks') {
        for (const [ox, sc] of [[-3, 1.0], [-1.1, 1.3], [0.9, 0.9], [2.8, 1.15]]) {
          const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * sc, 0).toNonIndexed(), toon('#8e7f74')); m.geometry.computeVertexNormals();
          m.position.set(ox, 0.45 * sc, (Math.random() - 0.5) * 0.8); m.rotation.set(Math.random(), Math.random() * 6, 0); m.scale.y = 0.75; m.castShadow = true; g.add(m); pieces.push([ox, 0.85 * sc]);
        }
      } else if (kind === 'log') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 10, 8), toon('#6a4a34')); m.rotation.z = Math.PI / 2; m.position.y = 0.45; m.castShadow = true; g.add(m);
        for (const [bx, bl, ang] of [[-2, 1.4, 0.7], [1.5, 1.1, -0.6], [3.6, 0.9, 0.9]]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, bl, 5), toon('#6a4a34')); br.position.set(bx, 0.9, 0.2); br.rotation.z = ang; g.add(br); }
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), toon('#3e6b4f')); leaves.position.set(5.2, 1.0, 0); leaves.scale.set(1.2, 0.8, 1); g.add(leaves);
        for (let k = -4; k <= 4; k++) pieces.push([k * 1.1, 0.55]);
      } else if (kind === 'crates') {
        for (const [ox, oz, rr, h] of [[-2.6, 0.3, 0.3, 0], [-1.3, -0.4, -0.2, 0], [0.3, 0.2, 0.5, 0], [1.8, -0.2, 0.1, 0], [-1.9, 0, 0.4, 1], [2.9, 0.4, -0.3, 0]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), toon(h ? '#b0844f' : '#a0743f')); m.position.set(ox, 0.5 + h, oz); m.rotation.y = rr; m.castShadow = true; g.add(m);
          if (!h) pieces.push([ox, 0.75]);
        }
        const amp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.6), toon('#26252b')); amp.position.set(3.9, 0.45, -0.6); amp.rotation.y = 0.8; g.add(amp); pieces.push([3.9, 0.6]);
      } else if (kind === 'barrier') {
        const sign = canvasTex(64, 32, (c) => { c.fillStyle = '#f2a33a'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#222'; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 12, 32); c.lineTo(i * 12 + 6, 32); c.lineTo(i * 12 + 22, 0); c.lineTo(i * 12 + 16, 0); c.fill(); } });
        for (const ox of [-2.4, 2.4]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.2), toon('#ffffff', { map: sign })); bar.position.set(ox, 0.95, 0); bar.castShadow = true; g.add(bar);
          for (const lx of [-1.8, 1.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.5), toon('#3a3a3a')); leg.position.set(ox + lx, 0.5, 0); g.add(leg); }
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), basic('#ffb020')); lamp.position.set(ox, 1.35, 0); g.add(lamp);
          this.anim.push((t) => { lamp.visible = Math.sin(t * 6 + ox) > 0; });
          for (let k = -2; k <= 2; k++) pieces.push([ox + k * 0.9, 0.5]);
        }
      }
      this.scene.add(g);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 2.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.1; g.add(hit);
      const b = { s, kind, g, hit, cleared: false, clearing: 0, circles: [], side: Math.random() < 0.5 ? -1 : 1 };
      for (const [ox, rr] of pieces) { const c = { x: p.x + Math.cos(g.rotation.y) * ox, z: p.z - Math.sin(g.rotation.y) * ox, r: rr }; b.circles.push(c); this.obstacles.push(c); }
      this.blockers.push(b);
    }
  }
  clearBlocker(b) {
    if (b.cleared) return false;
    b.cleared = true; b.clearing = 0.0001;
    this.obstacles = this.obstacles.filter((c) => !b.circles.includes(c));
    const x0 = b.g.position.x, z0 = b.g.position.z, ry = b.g.rotation.y;
    this.anim.push((t, dt) => {
      if (b.clearing <= 0 || b.clearing >= 1) return;
      b.clearing = Math.min(1, b.clearing + (dt || 0.016) * 0.9);
      const e = b.clearing * b.clearing, off = b.side * e * 9;
      b.g.position.set(x0 + Math.cos(ry) * off, b.g.position.y, z0 - Math.sin(ry) * off);
      b.g.rotation.z = b.side * e * 0.4; b.g.scale.setScalar(1 - e * 0.25);
      if (b.clearing >= 1) b.g.visible = false;
    });
    return true;
  }
  resetBlockers() {
    for (const b of this.blockers) {
      if (!b.cleared) continue;
      const p = this.roadPoint(b.s);
      b.cleared = false; b.clearing = 0; b.g.visible = true; b.g.position.set(p.x, this.roadYAt(b.s), p.z); b.g.rotation.z = 0; b.g.scale.setScalar(1);
      this.obstacles.push(...b.circles);
    }
  }

  // ---------------- start: farm ----------------
  buildStart() {
    const p = this.roadPoint(20), y = this.zones[0].y;
    const rx = -p.tz, rz = p.tx, rot = Math.atan2(p.tx, p.tz);
    const at = (a, b) => ({ x: p.x + p.tx * a + rx * b, z: p.z + p.tz * a + rz * b });
    let q = at(-5, -17);
    this.addBox(q.x, y, q.z, 11, 5.5, 14, toon('#a8452f'), rot);
    this.gable(q.x, y + 5.5, q.z, 11, 14.6, 3, rot, toon('#4a3a34'));
    const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), toon('#e8dcc4')); door.position.set(q.x + rx * 5.52, y + 2.25, q.z + rz * 5.52); door.rotation.y = rot - Math.PI / 2; this.scene.add(door);
    this.plane(8, 2, neonTex('HOLLOW CREEK FARM', { color: '#ffd27a', size: 54 }), q.x + rx * 5.6, y + 5.0, q.z + rz * 5.6, rot - Math.PI / 2);
    q = at(18, -16); this.addBox(q.x, y, q.z, 8, 5, 7, toon('#e8dcc4'), rot + 0.1);
    this.addBox(q.x, y + 5, q.z, 8.6, 0.4, 7.6, toon('#5a3d30'), rot + 0.1);
    q = at(-20, 15); this.addBox(q.x, y, q.z, 7, 4, 6, toon('#b08a5a'), rot - 0.1);
    q = at(-26, -30);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 12, 10), toon('#c9c4bb')); silo.position.set(q.x, y + 6, q.z); silo.castShadow = true; this.scene.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 5, 0, 6.3, 0, 1.57), toon('#8a3a2a')); dome.position.set(q.x, y + 12, q.z); this.scene.add(dome);
    this.addCollider(q.x, q.z, 3, 3, 0, y, y + 12);
    const sg = new THREE.Group(); q = at(8, 7); sg.position.set(q.x, y, q.z); sg.rotation.y = rot;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), toon('#888')); pole.position.y = 1.5; sg.add(pole);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), basic('#ffffff', { map: neonTex(['THE RUSTY NAIL', `${(this.sBar / 1000).toFixed(1)} KM`], { color: '#ffffff', size: [36, 30], bg: '#2f6e4a', w: 256, h: 96 }) }));
    pl.position.set(0, 2.7, 0.05); pl.rotation.y = Math.PI; sg.add(pl);
    this.scene.add(sg);
    this.startPose = { x: p.x + rx * 1.8, z: p.z + rz * 1.8, heading: rot };
  }

  // ---------------- desert rest stop ----------------
  buildRest() {
    const F = this.restFrame, y = F.y;
    const rot = Math.atan2(F.tx, F.tz);
    const at = (a, b) => ({ x: F.x + F.tx * a + F.rx * b, z: F.z + F.tz * a + F.rz * b });
    const c = at(0, 22);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 34), toon('#8b878c')); pad.position.set(c.x, y - 0.02, c.z); pad.rotation.y = rot; pad.receiveShadow = true; this.scene.add(pad);
    for (let k = -3; k <= 3; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 6), basic('#e9e4d6')); const q = at(k * 4, 16); ln.position.set(q.x, y + 0.04, q.z); ln.rotation.order = 'YXZ'; ln.rotation.set(-Math.PI / 2, rot, 0); this.scene.add(ln); }
    const wall = toon('#d9c29a'), trim = toon('#c0583a');
    const kb = (a, b, w, h, d, m, yy = y) => { const q = at(a, b); return this.addBox(q.x, yy, q.z, w, h, d, m, rot); };
    kb(0, 33.8, 0.4, 4, 12, wall); kb(-5.8, 31, 5.6, 4, 0.4, wall); kb(5.8, 31, 5.6, 4, 0.4, wall);
    kb(0, 31, 6.6, 0.3, 12.8, trim, y + 4);
    kb(0, 28.6, 0.9, 1.05, 10, toon('#6b4a3a'));
    let q = at(0, 27.6);
    const sign = this.plane(9, 2.2, neonTex('REST STOP', { color: '#5ff3ff', size: 80 }), q.x, y + 5.3, q.z, rot + Math.PI / 2);
    this.anim.push((t) => { sign.material.opacity = Math.sin(t * 13) > -0.92 ? 1 : 0.3; });
    q = at(0, 27.9); this.plane(8, 0.9, neonTex('CHARGE • SNACKS • STRINGS', { color: '#ff6ad5', size: 40, w: 512, h: 64 }), q.x, y + 4.15, q.z, rot + Math.PI / 2);
    kb(-3, 33.2, 0.6, 2.4, 3.5, toon('#5a4a6a')); kb(3, 33.2, 0.6, 2.4, 3.5, toon('#5a4a6a'));
    this.shopSpots = [-3, 0, 3].map((a) => { const pp = at(a, 28.6); return { x: pp.x, y: y + 1.05, z: pp.z }; });
    q = at(0, 30.6); this.vendorPose = { x: q.x, y, z: q.z, heading: rot + Math.PI / 2 };
    q = at(-11, 18);
    this.addBox(q.x, y, q.z, 0.8, 2.2, 0.8, toon('#2b2d36'), rot);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.4, 0.84), basic('#4ff0ff')); glow.position.set(q.x, y + 1.6, q.z); glow.rotation.y = rot; this.scene.add(glow);
    this.anim.push((t) => glow.material.color.setHSL(0.5, 1, 0.45 + Math.sin(t * 3) * 0.15));
    q = at(11, 24); this.addBox(q.x, y, q.z, 1.6, 0.8, 3, toon('#7a5a3a'), rot);
    for (const a of [-14, 14]) {
      q = at(a, 13);
      this.addBox(q.x, y, q.z, 0.2, 5, 0.2, toon('#444'), 0, { solid: false });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), basic('#ffe8b0')); b.position.set(q.x, y + 5, q.z); this.scene.add(b);
    }
    const pl = new THREE.PointLight('#ffd0a0', 30, 30, 1.5); q = at(0, 26); pl.position.set(q.x, y + 4, q.z); this.scene.add(pl);
    this.restParking = { ...at(0, 14), heading: rot };
  }

  // ---------------- practice studios ----------------
  buildStudio(s, label, wallCol, signCol) {
    const F = this.frameAt(s), y = F.y;
    const rot = Math.atan2(F.tx, F.tz);
    const at = (a, b) => ({ x: F.x + F.tx * a + F.rx * b, z: F.z + F.tz * a + F.rz * b });
    const kb = (a, b, w, h, d, m, yy = y, opts) => { const q = at(a, b); return this.addBox(q.x, yy, q.z, w, h, d, m, rot, opts); };
    const wall = toon(wallCol), inside = toon('#3a2f3a');
    const c = at(0, 15); const pad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 22), toon('#7e7b80')); pad.position.set(c.x, y - 0.02, c.z); pad.rotation.y = rot; pad.receiveShadow = true; this.scene.add(pad);
    kb(-4.15, 21, 0.3, 4.2, 5.7, wall); kb(4.15, 21, 0.3, 4.2, 5.7, wall);
    kb(0, 21, 0.3, 1.2, 2.6, wall, y + 3.0);
    kb(0, 31, 0.3, 4.2, 14.3, wall);
    kb(-7, 26, 10.3, 4.2, 0.3, wall); kb(7, 26, 10.3, 4.2, 0.3, wall);
    kb(0, 26, 10.6, 0.3, 14.6, toon('#3a3a44'), y + 4.2, { solid: false });
    const fl = at(0, 26); const floor = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.04, 13.6), toon('#6e4a30')); floor.position.set(fl.x, y + 0.02, fl.z); floor.rotation.y = rot; floor.receiveShadow = true; this.scene.add(floor);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(5, 0.03, 9), toon('#7a3f5a')); rug.position.set(fl.x, y + 0.05, fl.z); rug.rotation.y = rot; this.scene.add(rug);
    for (let k = -5; k <= 5; k += 2.5) { const q = at(k, 30.75); const pnl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.12), inside); pnl.position.set(q.x, y + 2.2, q.z); pnl.rotation.y = rot; this.scene.add(pnl); }
    let q = at(0, 20.8);
    const sgn = this.plane(7, 1.5, neonTex(label, { color: signCol, size: 62, w: 512, h: 110 }), q.x, y + 4.9, q.z, rot + Math.PI / 2);
    this.anim.push((t) => { sgn.material.opacity = Math.sin(t * 11 + s) > -0.95 ? 1 : 0.4; });
    q = at(3.6, 20.8); this.plane(2.2, 0.6, neonTex('● ON AIR', { color: '#ff4a4a', size: 70, w: 256, h: 70 }), q.x, y + 3.6, q.z, rot + Math.PI / 2);
    const light = new THREE.PointLight('#ffd6a0', 30, 16, 1.4); q = at(0, 26); light.position.set(q.x, y + 3.6, q.z); this.scene.add(light);
    const order = ['bass', 'guitar', 'synthA', 'synthB', 'drums', 'trumpet'];
    const face = rot + Math.PI / 2;
    const spots = {};
    order.forEach((r, i) => {
      const a = -5 + i * 2, b = r === 'drums' ? 28.3 : 27.6;
      const pp = at(a, b);
      const g = makeInstrument(r); g.position.set(pp.x, y + 0.05, pp.z); g.rotation.y = face; this.scene.add(g);
      spots[r] = { x: pp.x, y: y + 0.05, z: pp.z, yaw: face };
    });
    return { s, label, spots, center: at(0, 22), parking: { ...at(0, 11), heading: rot }, y };
  }

  // ---------------- venues ----------------
  // shared stage-light rig
  stageRig(sx, sz, y, w, n, h, col = '#ff6ad5', fwd = false) {
    const truss = toon('#9a9aa2'), lights = [];
    for (const s of [-1, 1]) this.addBox(sx + s * w / 2, y, sz, 0.35, h, 0.35, truss, 0, { solid: false });
    this.addBox(sx, y + h, sz, w, 0.35, 0.35, truss, 0, { solid: false });
    for (let i = 0; i < n; i++) {
      const lx = sx - w / 2 + 1 + i * (w - 2) / Math.max(1, n - 1);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 6), toon('#222')); can.position.set(lx, y + h - 0.4, sz); can.rotation.x = 0.6; this.scene.add(can);
      const bl = h * 0.9;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(bl * 0.23, bl, 10, 1, true), basic(col, { transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      if (fwd) { beam.position.set(lx, y + h - bl / 2 + 0.2, sz - bl * 0.3); beam.rotation.x = 0.6; }
      else { beam.position.set(lx, y + h - bl / 2 - 0.2, sz + 1.6); beam.rotation.x = -0.6; }
      this.scene.add(beam);
      lights.push({ can, beam });
    }
    return lights;
  }
  makeCrowd(n, x0, x1, z0, z1, y, seed, sp = 0.85) {
    const r = mulberry32(seed), out = [];
    for (let i = 0; i < n * 4 && out.length < n; i++) {
      const x = lerp(x0, x1, r()), z = lerp(z0, z1, r());
      if (out.some((q) => Math.hypot(q.x - x, q.z - z) < sp)) continue;
      out.push({ x, y, z, ry: (r() - 0.5) * 0.6 });
    }
    return out;
  }
  setlistBoardAt(x, z, y, ry) {
    this.addBox(x, y, z, ry ? 0.2 : 2.4, 2.2, ry ? 2.4 : 0.2, toon('#2a2630'), 0);
    const tex = canvasTex(256, 220, (g) => this.drawBoard(g, null), false);
    const off = 0.12;
    const bt = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), basic('#ffffff', { map: tex }));
    bt.position.set(x + (ry ? Math.sign(ry) * off : 0), y + 1.2, z - (ry ? 0 : off)); bt.rotation.y = ry || Math.PI; this.scene.add(bt);
    return { board: { x, z, y }, tex };
  }
  loadingBayAt(x, z, y, len, signFace = 0) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 5.4), toon('#3e3a44')); box.position.set(x, y + 0.06, z); this.scene.add(box);
    for (const dz of [-2.7, 2.7]) { const ln = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.15), basic('#e8b13a')); ln.position.set(x, y + 0.08, z + dz); this.scene.add(ln); }
    // sign on the stage side of the bay, facing the road (north)
    this.plane(4.5, 1.2, neonTex('LOADING BAY', { color: '#ffb347', size: 64, w: 512, h: 120, bg: '#1d1622', border: true }), x, y + 2.9, z - 3.7, 0, false);
    for (const dx of [-2.1, 2.1]) this.addBox(x + dx, y, z - 3.72, 0.15, 2.4, 0.15, toon('#444'), 0, { solid: false });
    void signFace;
    return { x, z, heading: -Math.PI / 2, y };
  }

  // sign at the end of a loading bay pointing the way onward; also records which way to face when leaving
  exitSign(lb, off, s, name, col) {
    const east = this.roadPoint(Math.min(this.length, s + 30)).tx >= 0;
    lb.exitHeading = east ? Math.PI / 2 : -Math.PI / 2; lb.exitTurn = east ? 'LEFT' : 'RIGHT';
    const x = lb.x + (east ? off : -off);
    this.plane(3.4, 1.3, neonTex([name, east ? '↰ LEFT ONTO THE ROAD' : 'RIGHT ONTO THE ROAD ↱'], { w: 512, h: 200, color: col, size: [64, 36], bg: '#1d1622', border: true }), x, lb.y + 2.4, lb.z + 2, east ? -Math.PI / 2 : Math.PI / 2, false);
    this.addBox(x + (east ? 0.05 : -0.05), lb.y, lb.z + 2, 0.12, 1.8, 0.12, toon('#444'), 0, { solid: false });
  }
  // PART 1: a tiny country bar
  buildBar(V) {
    const y = V.y, x0 = V.x - 9, x1 = V.x + 9, z0 = V.z - 10, z1 = V.z + 10, H = 4.2;
    const wall = toon('#7a5236'), wallIn = toon('#5a3a28'), floorM = toon('#4a3324');
    const wb = (cx, cz, w, d, h = H, yy = y, m = wall) => this.addBox(cx, yy, cz, w, h, d, m);
    // walls: back (north) with load-in door at x V.x+6..7.6, front (south) door at centre
    wb((x0 + V.x + 6) / 2, z1, V.x + 6 - x0, 0.3); wb((V.x + 7.6 + x1) / 2, z1, x1 - V.x - 7.6, 0.3); wb(V.x + 6.8, z1, 1.6, 0.3, 1.2, y + 3.0);
    wb((x0 + V.x - 1) / 2, z0, V.x - 1 - x0, 0.3); wb((V.x + 1 + x1) / 2, z0, x1 - V.x - 1, 0.3); wb(V.x, z0, 2, 0.3, 1.2, y + 3.0);
    wb(x0, V.z, 0.3, 20); wb(x1, V.z, 0.3, 20);
    this.addBox(V.x, y + H, V.z, 19, 0.3, 21, toon('#3a2a22'), 0, { solid: false });
    this.gable(V.x, y + H, V.z, 18, 21, 2.4, 0, toon('#5a4a44'));
    const fl = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.04, 19.6), floorM); fl.position.set(V.x, y + 0.02, V.z); fl.receiveShadow = true; this.scene.add(fl);
    // stage
    const sz = V.z + 7.4, sx = V.x, top = y + 0.45;
    this.addBox(sx, y, sz, 10, 0.45, 4.6, toon('#2e2a33'));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.08, 0.08), basic('#ffb347')); edge.position.set(sx, top - 0.04, sz - 2.32); this.scene.add(edge);
    const back = this.plane(9, 3.2, neonTex(['THE RUSTY NAIL', 'THE LOOSE WIRES'], { w: 512, h: 190, color: '#ffb347', size: [64, 40], bg: '#1a120e' }), sx, y + 2.6, z1 - 0.2, Math.PI, false);
    // bar counter (west wall) + bottle shelf
    this.addBox(x0 + 1.4, y, V.z - 3, 1.0, 1.1, 10, toon('#6b4a3a'));
    this.addBox(x0 + 0.45, y + 1.4, V.z - 3, 0.5, 1.6, 9, toon('#3a2a22'), 0, { solid: false });
    const bottles = canvasTex(64, 32, (g) => { g.fillStyle = '#2a1a14'; g.fillRect(0, 0, 64, 32); const rr = mulberry32(3); for (let i = 0; i < 18; i++) { g.fillStyle = ['#3a7a4a', '#7a3a2a', '#c9a24a', '#5a7aa8'][i % 4]; g.fillRect(2 + i * 3.4, 6 + rr() * 6, 2, 22); } });
    for (let k = 0; k < 2; k++) this.plane(8.6, 1.4, bottles, x0 + 0.72, y + 1.6 + k * 0.01, V.z - 3, Math.PI / 2, false);
    // high tables + string lights
    for (const [tx, tz] of [[x1 - 1.5, V.z - 6], [x1 - 1.5, V.z - 1.5]]) { this.addBox(tx, y, tz, 0.9, 1.05, 0.9, toon('#4a3324')); }
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), basic(['#ffcf7a', '#ff8ad8', '#7af0ff'][i % 3])); b.position.set(x0 + 1 + i * 1.45, y + H - 0.35 - Math.sin(i / 11 * Math.PI) * 0.4, V.z - 4); this.scene.add(b); }
    // outside: neon sign facing the road + porch light + parked pickups
    this.plane(8, 1.6, neonTex('THE RUSTY NAIL', { color: '#ffb347', size: 70, w: 512, h: 100 }), V.x, y + H + 1.3, z1 + 0.3, 0);
    this.plane(5, 1.2, neonTex('LIVE MUSIC', { color: '#ff6ad5', size: 60, w: 512, h: 100 }), V.x, y + 3.6, z0 - 0.2, Math.PI);
    for (const [px, pz] of [[V.x - 6, z0 - 9], [V.x + 7, z0 - 10]]) { this.addBox(px, y, pz, 2, 1.3, 4.6, toon('#8a4a3a')); this.addBox(px, y + 1.3, pz + 0.6, 1.8, 0.8, 1.8, toon('#8a4a3a')); }
    const stageLights = this.stageRig(sx, sz - 2.1, top, 9, 4, 2.9, '#ffb347', true);
    const spot = new THREE.SpotLight('#ffc89a', 70, 18, 0.8, 0.5, 1.2); spot.position.set(sx, y + 3.9, sz - 6); spot.target.position.set(sx, top, sz); this.scene.add(spot, spot.target);
    const light = new THREE.PointLight('#ffb070', 18, 22, 1.2); light.position.set(V.x, y + 3.4, V.z - 3); this.scene.add(light);
    const fz = sz - 1.0, bz = sz + 0.9;
    const bandSpots = { trumpet: { x: sx, z: fz - 0.2 }, synthA: { x: sx - 2.7, z: fz }, guitar: { x: sx + 2.7, z: fz }, bass: { x: sx - 3.7, z: bz - 0.3 }, drums: { x: sx, z: bz }, synthB: { x: sx + 3.7, z: bz - 0.3 } };
    const crowdPos = this.makeCrowd(30, x0 + 2.6, x1 - 2.4, z0 + 1.2, sz - 3.3, y, 21, 0.95);
    const sb = this.setlistBoardAt(x1 - 0.2, V.z + 2.5, y, -Math.PI / 2);
    const lb = this.loadingBayAt(V.x + 4, z1 + 9, y, 9, Math.PI);
    this.exitSign(lb, 13, this.sBar, 'NEON FALLS', '#ff6ad5');
    return {
      id: 1, name: 'The Rusty Nail', center: V, y, stage: { x: sx, z: sz, top, front: sz - 2.3 }, bandSpots, crowdPos, stageLights, spot, light, backdrop: back, backdropLines: (n) => ['THE RUSTY NAIL', n], backdropCol: '#ffb347',
      backstage: { x: V.x + 6.8, z: V.z + 5, y }, idleSpots: [[V.x + 6.6, V.z + 6.4], [V.x + 7.8, V.z + 5], [V.x + 6.2, V.z + 3.4], [V.x + 7.6, V.z + 2], [V.x + 5.6, V.z + 1.2]],
      setlistBoard: sb.board, boardTex: sb.tex, loadingBay: lb, camK: 0.42, crowdBox: [x0 + 2.6, x1 - 1.5, z0 + 1.5, sz - 3.6], insideY: H,
    };
  }

  // PART 2: Neon Falls open-air stage (desert)
  buildNeonFalls(V) {
    const y = V.y;
    const sz = V.z + 24, sx = V.x;
    const stage = { x: sx, z: sz, top: y + 1.3, front: sz - 4.5 };
    this.addBox(sx, y, sz, 18, 1.3, 9, toon('#2e2a33'));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.12, 0.12), basic('#ff6ad5')); edge.position.set(sx, y + 1.25, sz - 4.52); this.scene.add(edge);
    this.addBox(sx + 10, y, sz - 2, 2, 0.45, 2, toon('#3b3640'));
    this.addBox(sx + 10, y, sz, 2, 0.9, 2, toon('#3b3640'));
    this.addBox(sx, y + 1.3, sz + 4.3, 18, 8, 0.4, toon('#1c1820'));
    const back = this.plane(15, 6.4, neonTex(['NEON FALLS', 'THE LOOSE WIRES', 'ON TOUR'], { w: 512, h: 220, color: '#ff6ad5', size: [74, 44, 30], bg: '#150f1c' }), sx, y + 5.4, sz + 4.08, Math.PI, false);
    const stageLights = this.stageRig(sx, sz - 4, y + 1.3, 18, 6, 7);
    const spot = new THREE.SpotLight('#ff9ae6', 120, 40, 0.7, 0.5, 1.2); spot.position.set(sx, y + 10, sz - 10); spot.target.position.set(sx, y + 1.3, sz); this.scene.add(spot, spot.target);
    for (const s of [-1, 1]) { this.addBox(sx + s * 10.8, y, sz - 5.6, 2, 3.2, 1.6, toon('#1f1d24')); this.addBox(sx + s * 10.8, y + 3.2, sz - 5.6, 1.8, 1.8, 1.4, toon('#1f1d24')); }
    const fz = sz - 2.2, bz = sz + 1.2;
    const bandSpots = { trumpet: { x: sx, z: fz - 0.6 }, synthA: { x: sx - 3.6, z: fz }, guitar: { x: sx + 3.6, z: fz }, bass: { x: sx - 6.4, z: bz - 0.6 }, drums: { x: sx, z: bz }, synthB: { x: sx + 6.4, z: bz - 0.6 } };
    const crowdPos = this.makeCrowd(130, sx - 15, sx + 15, sz - 31.5, sz - 7.5, y, 11);
    const bz2 = sz + 12;
    this.addBox(sx - 9, y + 3.2, bz2, 8, 0.2, 7, toon('#3d5a7a'), 0, { solid: false });
    for (const [a, b] of [[-12.8, -3.3], [-5.2, -3.3], [-12.8, 3.3], [-5.2, 3.3]]) this.addBox(sx + a, y, bz2 + b, 0.2, 3.2, 0.2, toon('#666'));
    const sb = this.setlistBoardAt(sx - 11, bz2 + 3, y, 0);
    const bl = new THREE.PointLight('#ffd0a0', 40, 26, 1.4); bl.position.set(sx - 8, y + 3, bz2); this.scene.add(bl);
    for (const [a, b] of [[-14, -20], [14, -20], [-14, 0], [14, 0]]) {
      this.addBox(V.x + a, y, V.z + b, 0.25, 6, 0.25, toon('#444'), 0, { solid: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), basic('#ffd6a0')); bulb.position.set(V.x + a, y + 6, V.z + b); this.scene.add(bulb);
    }
    const light = new THREE.PointLight('#ff8ad8', 60, 50, 1.3); light.position.set(sx, y + 6, sz - 10); this.scene.add(light);
    const lb = this.loadingBayAt(sx + 9, sz + 23, y, 13, Math.PI);
    this.exitSign(lb, 15, this.sNF, 'CHROME CITY', '#7af0ff');
    return {
      id: 2, name: 'Neon Falls', center: V, y, stage, bandSpots, crowdPos, stageLights, spot, light, backdrop: back, backdropLines: (n) => ['NEON FALLS', n, 'ON TOUR'], backdropCol: '#ff6ad5',
      backstage: { x: sx, z: bz2, y }, idleSpots: [[sx - 3, bz2 - 3], [sx - 0.6, bz2 - 3], [sx + 1.8, bz2 - 3], [sx - 3, bz2 - 0.8], [sx - 0.6, bz2 - 0.8]],
      setlistBoard: sb.board, boardTex: sb.tex, loadingBay: lb, camK: 1, crowdBox: [sx - 7, sx + 7, sz - 14, sz - 9],
    };
  }

  // PART 3: The Megadome stadium (city)
  buildStadium(V) {
    const y = V.y;
    const sz = V.z + 62, sx = V.x, SH = 2.0;
    const stage = { x: sx, z: sz, top: y + SH, front: sz - 6 };
    this.addBox(sx, y, sz, 30, SH, 12, toon('#26232c'));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(30.1, 0.14, 0.14), basic('#7af0ff')); edge.position.set(sx, y + SH - 0.05, sz - 6.02); this.scene.add(edge);
    // side stairs (east), reachable from the field and from backstage
    for (let k = 0; k < 4; k++) this.addBox(sx + 16.2 + (3 - k) * 0.9, y, sz - 1, 0.9, 0.5 * (k + 1), 3, toon('#3b3640'));
    // giant backdrop screen + wings
    this.addBox(sx, y + SH, sz + 6.4, 34, 15, 0.6, toon('#15121a'));
    const back = this.plane(30, 12, neonTex(['THE MEGADOME', 'THE LOOSE WIRES', 'WORLD TOUR'], { w: 1024, h: 420, color: '#7af0ff', size: [120, 90, 60], bg: '#0b0a12' }), sx, y + SH + 7.5, sz + 6.05, Math.PI, false);
    for (const s of [-1, 1]) {
      this.addBox(sx + s * 23, y, sz - 2, 6, 16, 1, toon('#15121a'));
      const scr = this.plane(5.4, 3.2, neonTex(['LIVE', 'ON STAGE'], { w: 256, h: 150, color: '#ff6ad5', size: [60, 30], bg: '#120c18' }), sx + s * 23, y + 12, sz - 2.55, Math.PI, false); void scr;
      for (let k = 0; k < 3; k++) { this.addBox(sx + s * 17, y, sz - 7 - k * 0.1, 2.4, 2.6 + k * 2.6, 2, toon('#1f1d24'), 0, { solid: k === 0 }); }
    }
    const stageLights = this.stageRig(sx, sz - 5, y + SH, 30, 10, 11, '#7af0ff');
    const rig2 = this.stageRig(sx, sz + 2, y + SH, 30, 6, 13, '#ff6ad5');
    stageLights.push(...rig2);
    const spot = new THREE.SpotLight('#bff6ff', 300, 80, 0.6, 0.5, 1.1); spot.position.set(sx, y + 24, sz - 30); spot.target.position.set(sx, y + SH, sz); this.scene.add(spot, spot.target);
    // barrier between field crowd and stage
    this.addBox(sx, y, sz - 8.5, 28, 1.1, 0.3, toon('#8a8a92'));
    const fz = sz - 3.2, bz = sz + 1.8;
    const bandSpots = { trumpet: { x: sx, z: fz - 0.8 }, synthA: { x: sx - 5.4, z: fz }, guitar: { x: sx + 5.4, z: fz }, bass: { x: sx - 9.6, z: bz - 0.8 }, drums: { x: sx, z: bz }, synthB: { x: sx + 9.6, z: bz - 0.8 } };
    const crowdPos = this.makeCrowd(380, sx - 26, sx + 26, V.z - 34, sz - 10, y, 31, 0.95);
    // stands: west, east, south with a static crowd
    const standM = toon('#4a4752'), standM2 = toon('#5a5762');
    const fans = [];
    const r = mulberry32(5);
    const tiers = 7, td = 4.2, th = 1.6;
    const stand = (cx, cz, len, dirX, dirZ) => {
      for (let t = 0; t < tiers; t++) {
        const off = 4 + t * td, hh = 1 + t * th;
        const bx = cx + dirX * off, bz3 = cz + dirZ * off;
        const w = dirX ? td : len, d = dirX ? len : td;
        this.addBox(bx, y, bz3, w, hh, d, t % 2 ? standM : standM2);
        for (let k = -len / 2 + 1; k < len / 2 - 1; k += 1.15) {
          if (r() < 0.12) continue;
          const fx = bx + (dirX ? 0 : k) + (r() - 0.5) * 0.2, fzz = bz3 + (dirX ? k : 0);
          fans.push({ x: fx - dirX * 0.6, y: y + hh, z: fzz - dirZ * 0.6, ry: Math.atan2(-dirX, -dirZ) });
        }
      }
      const outer = 4 + tiers * td + 0.5;
      this.addBox(cx + dirX * outer, y, cz + dirZ * outer, dirX ? 1 : len + 10, 1 + tiers * th + 4, dirX ? len + 10 : 1, toon('#2e2c35'));
    };
    const fx0 = 40, fzS = V.z - 48;
    stand(sx - fx0, V.z + 8, 110, -1, 0); stand(sx + fx0, V.z + 8, 110, 1, 0); stand(sx, fzS, 80, 0, -1);
    const fanGeo = mergeGeometries([(() => { const a = new THREE.BoxGeometry(0.42, 0.8, 0.32); a.translate(0, 0.4, 0); return a.toNonIndexed(); })(), (() => { const a = new THREE.BoxGeometry(0.36, 0.28, 0.28); a.translate(0, 0.98, 0); return a.toNonIndexed(); })()]);
    fanGeo.computeVertexNormals();
    const fim = new THREE.InstancedMesh(fanGeo, toon('#ffffff'), fans.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    const cols = ['#c9763c', '#4f8a6b', '#8a4f9c', '#d9b23e', '#3f6fae', '#b5493f', '#6e6a64', '#7af0ff'];
    fans.forEach((o, i) => { e.set(0, o.ry, 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); m4.compose(v, q, one); fim.setMatrixAt(i, m4); fim.setColorAt(i, c.set(cols[i % cols.length])); });
    fim.computeBoundingSphere(); this.scene.add(fim);
    this.standFans = { mesh: fim, fans };
    // floodlight towers + neon ring
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = sx + ax * 74, pz = V.z + 8 + az * 62;
      this.addBox(px, y, pz, 1.2, 34, 1.2, toon('#3a3a42'));
      const head = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), basic('#fff6e0')); head.position.set(px, y + 34, pz); head.lookAt(sx, y, V.z); this.scene.add(head);
    }
    const ring = new THREE.Mesh(new THREE.BoxGeometry(170, 0.5, 0.5), basic('#7af0ff')); ring.position.set(sx, y + 17.5, fzS - 34.2); this.scene.add(ring);
    this.plane(40, 6, neonTex('THE MEGADOME', { color: '#7af0ff', size: 90, w: 1024, h: 140 }), sx, y + 21, fzS - 34.6, Math.PI, true);
    // backstage + loading bay behind the stage
    const bz2 = sz + 14;
    this.addBox(sx - 12, y + 3.4, bz2, 12, 0.25, 8, toon('#3d5a7a'), 0, { solid: false });
    for (const [a, b] of [[-17.8, -3.8], [-6.2, -3.8], [-17.8, 3.8], [-6.2, 3.8]]) this.addBox(sx + a, y, bz2 + b, 0.2, 3.4, 0.2, toon('#666'));
    const sb = this.setlistBoardAt(sx - 14, bz2 + 3.6, y, 0);
    const bl = new THREE.PointLight('#ffd0a0', 50, 30, 1.4); bl.position.set(sx - 10, y + 3.2, bz2); this.scene.add(bl);
    const light = new THREE.PointLight('#9ae6ff', 120, 90, 1.2); light.position.set(sx, y + 14, sz - 20); this.scene.add(light);
    const lb = this.loadingBayAt(sx + 12, sz + 27, y, 17, Math.PI);
    return {
      id: 3, name: 'The Megadome', center: V, y, stage, bandSpots, crowdPos, stageLights, spot, light, backdrop: back, backdropLines: (n) => ['THE MEGADOME', n, 'WORLD TOUR'], backdropCol: '#7af0ff', backdropBig: true,
      backstage: { x: sx, z: bz2, y }, idleSpots: [[sx - 4, bz2 - 3], [sx - 1, bz2 - 3], [sx + 2, bz2 - 3], [sx - 4, bz2], [sx - 1, bz2]],
      setlistBoard: sb.board, boardTex: sb.tex, loadingBay: lb, camK: 1.9, crowdBox: [sx - 12, sx + 12, sz - 22, sz - 12],
    };
  }
  setVenue(i) {
    const v = this.venues[i];
    this.venueIdx = i; this.venue = v;
    Object.assign(this, { stage: v.stage, bandSpots: v.bandSpots, crowdPos: v.crowdPos, stageLights: v.stageLights, spot: v.spot, venueLight: v.light, backstage: v.backstage, setlistBoard: v.setlistBoard, boardTex: v.boardTex, loadingBay: v.loadingBay, venueY: v.y, venueCenter: v.center });
    // other venues' stage lights off
    for (const o of this.venues) if (o !== v) for (const l of o.stageLights) l.beam.visible = false;
  }
  drawBoard(g, setlist, songs) {
    g.fillStyle = '#1c1a22'; g.fillRect(0, 0, 256, 220);
    g.strokeStyle = '#d8ff9e'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 208);
    g.fillStyle = '#d8ff9e'; g.font = '28px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('SETLIST', 128, 44);
    g.font = '20px "VT323", monospace'; g.textAlign = 'left';
    if (!setlist) { g.fillStyle = '#ffffff'; g.fillText('Press E to plan', 40, 100); g.fillText("tonight's show", 40, 126); }
    else setlist.forEach((id, i) => { const s = songs.find((x) => x.id === id); g.fillStyle = '#ffffff'; g.fillText(`${i + 1}. ${s.title}`, 24, 90 + i * 34); });
  }
  setBandName(name) {
    const N = name.toUpperCase();
    const sub = { band1: 'LIVE @ THE RUSTY NAIL — TONIGHT', band2: 'LIVE @ NEON FALLS', band3: 'THE MEGADOME — SOLD OUT' };
    for (const k of Object.keys(sub)) { const b = this.boardFaces[k]; if (b) { b.f.material.map = neonTex([N, sub[k]], { w: 512, h: 200, color: b.col, size: [58, 30], bg: '#1d1622', border: true }); b.f.material.needsUpdate = true; } }
    for (const v of this.venues) {
      if (!v.backdrop) continue;
      const lines = v.backdropLines(N);
      v.backdrop.material.map = v.backdropBig ? neonTex(lines, { w: 1024, h: 420, color: v.backdropCol, size: [120, 90, 60], bg: '#0b0a12' }) : neonTex(lines, { w: 512, h: lines.length > 2 ? 220 : 190, color: v.backdropCol, size: lines.length > 2 ? [74, 44, 30] : [64, 40], bg: '#150f1c' });
      v.backdrop.material.needsUpdate = true;
    }
  }
  setNight(k) { for (const f of this.night) f(k); }
  update(t, dt) { for (const f of this.anim) f(t, dt); }
}
