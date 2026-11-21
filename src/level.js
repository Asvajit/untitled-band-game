import * as THREE from 'three';
// Level layout data. The game builds the whole world from this; the editor edits it.
//   road:     [[x,z],...] control points of the one continuous road (start → stadium)
//   venues:   [[x,z] x3]   centre of each gig (stage faces south; the road must pass just NORTH of it)
//   falls / rest / studios / blockers: points that snap to the nearest spot on the road
// distance (m) north of each venue centre where the road should pass / end (loading-bay access)
export const ACCESS = [34, 64, 112];
export const BLOCKER_KINDS = ['log', 'rocks', 'crates', 'barrier'];
// One continuous road: countryside (Hollow Creek) → desert (Neon Falls) → city (Chrome City)
const CTRL = [[0, -50], [0, 60], [-30, 170], [-110, 240], [-170, 340], [-150, 460], [-70, 540], [20, 600], [110, 690], [150, 800], [120, 920], [40, 1000], [-60, 1060], [-140, 1150], [-160, 1270], [-100, 1370], [0, 1420], [90, 1500], [130, 1620], [100, 1740], [20, 1820], [-70, 1880], [-120, 1940], [-80, 1988], [0, 1992], [80, 1995],
  [160, 2060], [230, 2170], [270, 2300], [220, 2420], [100, 2480], [-20, 2570], [-50, 2710], [20, 2820], [150, 2880], [240, 2960], [230, 3060], [130, 3100], [40, 3140], [50, 3200], [110, 3214], [190, 3214], [270, 3245],
  [320, 3340], [330, 3460], [330, 3600], [300, 3700], [220, 3760], [130, 3800], [70, 3880], [60, 4000], [90, 4120], [180, 4180], [220, 4260], [220, 4380], [250, 4450], [330, 4462]];

// add tighter S-bends to the countryside part of the route (start → bar approach)
function wiggleCountry(ctrl, endIdx, step = 60, amp = 32) {
  const base = new THREE.CatmullRomCurve3(ctrl.slice(0, endIdx + 1).map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const n = Math.floor(base.getLength() / step), pts = base.getSpacedPoints(n), out = [];
  for (let k = 0; k <= n; k++) {
    const t = base.getTangentAt(Math.min(1, k / n));
    const fade = Math.min(1, k / 3, (n - k) / 3);
    const off = amp * fade * Math.sin(k * 1.85) * (0.75 + 0.25 * Math.sin(k * 0.37));
    out.push([pts[k].x - t.z * off, pts[k].z + t.x * off]);
  }
  return [...out, ...ctrl.slice(endIdx + 1)];
}


export function sampleRoad(road, step = 2) {
  const curve = new THREE.CatmullRomCurve3(road.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const L = curve.getLength(), n = Math.max(2, Math.ceil(L / step));
  return { pts: curve.getSpacedPoints(n), L, step: L / n };
}
export function nearestS(sr, x, z) {
  let bd = Infinity, bi = 0;
  for (let i = 0; i < sr.pts.length; i++) { const dx = sr.pts[i].x - x, dz = sr.pts[i].z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  return { s: bi * sr.step, d: Math.sqrt(bd), i: bi, x: sr.pts[bi].x, z: sr.pts[bi].z };
}
export function defaultLevel() {
  const road = wiggleCountry(CTRL, 21).map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  const sr = sampleRoad(road), L = sr.L;
  const at = (s) => { const p = sr.pts[Math.round(Math.max(0, Math.min(L, s)) / sr.step)]; return [Math.round(p.x), Math.round(p.z)]; };
  const venues = [[-20, 1956], [150, 3150], [330, 4350]];
  const sBar = nearestS(sr, venues[0][0], venues[0][1] + ACCESS[0]).s, sNF = nearestS(sr, venues[1][0], venues[1][1] + ACCESS[1]).s;
  const sFalls = sBar * 0.565, sRest = sBar + (sNF - sBar) * 0.42, sS3 = sNF + (L - sNF) * 0.55;
  return {
    version: 1, road, venues,
    falls: at(sFalls), rest: at(sRest),
    studios: [at(sBar * 0.8), at(sBar + (sNF - sBar) * 0.72), at(sS3)],
    blockers: [[520, 'log'], [sFalls + 260, 'rocks'], [sBar - 520, 'log'], [sBar + 420, 'rocks'], [sRest + 120, 'crates'], [sNF - 380, 'barrier'], [sNF + 520, 'barrier'], [sS3 + 160, 'crates']].map(([s, k]) => [...at(s), k]),
  };
}
export function validLevel(l) {
  try {
    return l && Array.isArray(l.road) && l.road.length >= 6 && l.road.every((p) => p.length >= 2 && isFinite(p[0]) && isFinite(p[1]))
      && Array.isArray(l.venues) && l.venues.length === 3 && Array.isArray(l.studios) && l.studios.length === 3 && Array.isArray(l.falls) && Array.isArray(l.rest) && Array.isArray(l.blockers);
  } catch (e) { return false; }
}
export const encodeLevel = (l) => btoa(unescape(encodeURIComponent(JSON.stringify(l))));
export const decodeLevel = (t) => { try { const s = t.trim(); const l = JSON.parse(s.startsWith('{') ? s : decodeURIComponent(escape(atob(s)))); return validLevel(l) ? l : null; } catch (e) { return null; } };
