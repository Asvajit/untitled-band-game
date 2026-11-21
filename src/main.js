import * as THREE from 'three';
import { Post, Sky, toon, basic, canvasTex } from './render.js';
import { World, LEGS } from './world.js';
import { defaultLevel, decodeLevel, encodeLevel } from './level.js';
import { openEditor } from './editor.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Van, SPECS } from './van.js';
import { Robot, ROLES, ROLE_LIST, Crowd, crowdFaceTex } from './robot.js';
import { makeInstrument, makeHandheld, makeItem, makeFPInstrument, ITEMS } from './instruments.js';
import { AudioEngine } from './audio.js';
import { SONG, SETLIST_SONGS } from './song.js';
import { Performance } from './rhythm.js';
import { CrowdSigns } from './signs.js';
const STEM_FILES = Object.fromEntries(ROLE_LIST.map((r) => [r, SONG.parts[r].file]));
const SFX_FILES = { horn: 'audio/horn.mp3' };
import { clamp, lerp, angDiff, smoothstep } from './util.js';

const $ = (id) => document.getElementById(id);
const audio = new AudioEngine();
const G = {
  weather: 'auto', wet: 0, rainAmt: 0,
  leg: 0, role: 'drums', playerName: 'You', bandName: 'The Loose Wires', coins: 30, carrying: null, confidence: 0, hypeBonus: 0, obj: 0, setlist: null, mode: 'title', fans: 0,
  tod: 0.1, todOverride: null, practiced: false, perf: null, overlay: null, chase: false, t: 0,
  clutchKey: 'KeyQ', shifting: false, automatic: false,
  dbg: { third: false, botMistakes: false, offsetMs: 0, autoplay: false, windowMult: 1, noteSpeed: 420, god: false, noFuel: false, boost: 1, freecam: false, fps: false },
};

// ---------------------------------------------------------------- renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#efc79a', 70, 460);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 900);
const post = new Post(renderer);
const post2 = new Post(renderer); post2.scale = 1; post2.levels = 16;
const cam2 = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 900);
renderer.shadowMap.autoUpdate = false;
const INSET = { w: 512, h: 288, m: 14 };
const sky = new Sky(scene);
const hemi = new THREE.HemisphereLight('#ffe2c0', '#5a3a4a', 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd0a0', 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 2.5;
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 320 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const rcan = $('rhythm');
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  INSET.w = Math.round(Math.min(512, w * 0.4)); INSET.h = Math.round(INSET.w * 9 / 16);
  renderer.setSize(w, h, false); post.setSize(w, h); post2.setSize(INSET.w, INSET.h); post2.fullW = w; post2.fullH = h;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  rcan.width = w; rcan.height = h; mapCan.width = Math.min(w - 40, 720); mapCan.height = Math.min(h - 120, 720);
}
const mapCan = $('mapcan');

const TOD = [
  { t: 0, top: '#5f9ec0', hor: '#f2c48d', bot: '#c78a5a', sun: '#ffe0b0', sunI: 2.6, hs: '#ffe8cc', hg: '#6a4a3a', hi: 1.3, fog: '#efc79a', el: 0.8 },
  { t: 0.55, top: '#5b3a6e', hor: '#ff8a4a', bot: '#8a4a5a', sun: '#ff9a5a', sunI: 2.0, hs: '#ffb08a', hg: '#4a2a4a', hi: 1.0, fog: '#e88a6a', el: 0.16 },
  { t: 1, top: '#05060f', hor: '#1c1430', bot: '#0c0814', sun: '#7a86d8', sunI: 0.22, hs: '#4a4880', hg: '#1a1424', hi: 0.42, fog: '#2a1a3a', el: -0.12 },
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function mixHex(a, b, t, out) { return out.set(a).lerp(_c2.set(b), t); }
function setTOD(x) {
  x = clamp(x, 0, 1);
  let i = 0; while (i < TOD.length - 2 && x > TOD[i + 1].t) i++;
  const A = TOD[i], B = TOD[i + 1], t = (x - A.t) / (B.t - A.t);
  const u = sky.mat.uniforms;
  mixHex(A.top, B.top, t, u.top.value); mixHex(A.hor, B.hor, t, u.hor.value); mixHex(A.bot, B.bot, t, u.bot.value);
  mixHex(A.sun, B.sun, t, u.sunCol.value); u.stars.value = smoothstep(0.7, 1, x);
  mixHex(A.fog, B.fog, t, scene.fog.color);
  sun.color.copy(u.sunCol.value); sun.intensity = lerp(A.sunI, B.sunI, t);
  mixHex(A.hs, B.hs, t, hemi.color); mixHex(A.hg, B.hg, t, hemi.groundColor); hemi.intensity = lerp(A.hi, B.hi, t);
  const el = lerp(A.el, B.el, t), az = -2.3;
  u.sunDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const le = Math.max(el, 0.35);
  G.sunDir = new THREE.Vector3(Math.cos(le) * Math.sin(az), Math.sin(le), Math.cos(le) * Math.cos(az));
  scene.fog.far = lerp(460, 300, smoothstep(0.6, 1, x));
}

// ---------------------------------------------------------------- world & actors
let world, van, P, bots = [], vendor, crowd, signs, stageProps = {}, shopItems = [], dyn = [];
const vehicles = {};
const parkedCols = {};
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffe066', depthTest: false, transparent: true }));
hl.renderOrder = 99; hl.visible = false; hl.matrixAutoUpdate = false;
const keys = new Set();
const ray = new THREE.Raycaster();
let interactables = [], hover = null;

// ---------------------------------------------------------------- custom levels + editor
let customLevel = null, editor = null, editLevel = null;
function loadCustomLevel() {
  try { const h = location.hash.match(/level=([^&]+)/); if (h) { const l = decodeLevel(decodeURIComponent(h[1])); if (l) return l; } } catch (e) { /* ignore */ }
  try { const t = localStorage.getItem('lw_level'); if (t) { const l = decodeLevel(t); if (l) return l; } } catch (e) { /* ignore */ }
  return null;
}
function playLevel(l) {
  const enc = encodeLevel(l);
  try { localStorage.setItem('lw_level', enc); } catch (e) { /* storage may be unavailable */ }
  try { location.hash = 'level=' + encodeURIComponent(enc); } catch (e) { /* ignore */ }
  location.reload();
}
function resetLevel() {
  try { localStorage.removeItem('lw_level'); } catch (e) { /* ignore */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  location.reload();
}
function showEditor() {
  if (G.perf) abortPerf();
  if (G.overlay) hideOverlay();
  if (G.dbgOpen) toggleDebug();
  editor = openEditor($('editor'), editLevel || world.level, { isCustom: !!customLevel, onPlay: playLevel, onReset: resetLevel, onClose: (l) => { editLevel = l; hideOverlay(); } });
  showOverlay('editor');
}
// Vehicle models (CC-BY 4.0): "FREE GMC Motorhome reimagined low poly" by Karol Miklas, "VW Van" by jesseroberts (Sketchfab)
const MODELS = {
  van: { url: 'models/van.glb', scale: [0.2, 0.215, 0.2], zShift: -0.1, doorColor: '#2aa3a6',
    hide: (o, name, b) => b.max.y < 0.95 && Math.abs((b.min.x + b.max.x) / 2) < 0.2 ? /Hubcap|Logo/.test(o.name) : (b.max.y < 0.95 && /polySurface24[1-4]/.test(o.name)),
    wheels: { r: 0.45, pos: [[0.86, 1.53], [-0.86, 1.53], [0.86, -1.78], [-0.86, -1.78]] }, axles: [1.53, -1.78],
    holes: [[-3, -0.9, 0.45, 2.37, -1.2, 0.1], [-3, -0.9, 0.6, 2.17, 0.3, 1.3], [0.9, 3, 0.6, 2.17, 0.3, 1.3]] },
  rv: { url: 'models/rv.glb', scale: [1.087, 1.19, 1.3], zShift: 0.25, doorColor: '#c47a1e',
    hide: (o, name) => name === 'interior', spin: (o, name) => name === 'clay.001', axles: [4.23, -1.9],
    ladder: { bottom: [-0.87, 0.05, -6.5], top: [-0.87, 3.67, -5.35] },
    holes: [[-3, -1.2, 0.72, 3.15, 0.6, 1.75]] },
  bus: { url: 'models/bus.glb', scale: [1.06, 1, 1], xShift: -0.16, zShift: 4.1, doorColor: '#d9dad2',
    wheels: { r: 0.52, pos: [[1.16, 4.1], [-1.16, 4.1], [1.16, -2.89], [-1.16, -2.89], [1.16, -4.39], [-1.16, -4.39]] }, axles: [4.1, -3.64],
    holes: [[-3, -1.0, 1.05, 3.35, 5.58, 6.46], [-3, -1.0, 1.05, 3.35, -1.98, -1.1], [-3, -1.0, 1.05, 3.35, -5.6, -4.9], [1.0, 3, 1.05, 3.35, -0.95, -0.2]],
    after: (V) => { for (const k of ['port', 'hatch']) V.hit[k].position.z -= 1.35; V.spec.colZ = [...V.spec.colZ, -6.6]; } },
};
async function loadVehicleModels() {
  const loader = new GLTFLoader();
  for (const [type, cfg] of Object.entries(MODELS)) {
    try { const g = await loader.loadAsync(cfg.url); vehicles[type].attachModel(g.scene, cfg); }
    catch (e) { console.warn('vehicle model not loaded, using the built-in one:', type, e); }
  }
}
async function init() {
  try { await Promise.race([Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('20px VT323')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* */ }
  try { audio.prefetch({ ...STEM_FILES, ...SFX_FILES }); } catch (e) { /* */ }
  customLevel = loadCustomLevel();
  world = new World(scene, customLevel || defaultLevel());
  scene.add(hl);
  for (const type of ['van', 'rv', 'bus']) {
    const v = new Van(scene, world, audio, type);
    v.onToast = toast;
    v.onHit = (imp) => { if (P && P.onboard && P.mode !== 'drive' && imp > 5) { toast('WHOA! Everyone in the back goes flying.'); } };
    v.root.visible = false;
    vehicles[type] = v;
  }
  await loadVehicleModels();
  van = vehicles.van; van.root.visible = true; van.active = true;
  const sp = world.startPose;
  van.place(sp.x, sp.z, sp.heading);
  // vendor
  vendor = new Robot('drums', { vendor: true });
  const vp = world.vendorPose; vendor.group.position.set(vp.x, vp.y, vp.z); vendor.group.rotation.y = vp.heading; scene.add(vendor.group);
  // shop items
  ['cell', 'kit', 'oil'].forEach((k, i) => {
    const s = world.shopSpots[i], m = makeItem(k); m.position.set(s.x, s.y + 0.22, s.z); scene.add(m);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 48, (g) => { g.fillStyle = '#1d1622'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#ffe066'; g.font = '22px VT323, monospace'; g.textAlign = 'center'; g.fillText(ITEMS[k].name.toUpperCase(), 64, 20); g.fillText(`${ITEMS[k].price}¢`, 64, 42); }, false) }));
    tag.scale.set(0.9, 0.34, 1); tag.position.set(s.x, s.y + 0.85, s.z); scene.add(tag);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false })); hb.position.set(s.x, s.y + 0.3, s.z); scene.add(hb);
    shopItems.push({ kind: k, mesh: m, hb });
  });
 P = { robot: null, pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, onboard: false, seat: null, mode: 'walk', speed: 0, drvYaw: 0, drvPitch: -0.12, bob: 0 };
  scene.add(camera);
  buildInteractables();
  setupVenue(0);
  setupRole('drums', true);
  setTOD(0.1);
  resize();
  buildTitle(); buildDebug();
  $('loading').style.display = 'none';
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- roles & band
function setupRole(role, initial = false) {
  if (P.robot) { scene.remove(P.robot.group); }
  bots.forEach((b) => scene.remove(b.robot.group));
  G.role = role;
  P.robot = new Robot(role); scene.add(P.robot.group);
  const seats = van.spec.botSeats;
  bots = ROLE_LIST.filter((r) => r !== role).map((r, i) => {
    const robot = new Robot(r); scene.add(robot.group);
    return { role: r, robot, seat: seats[i], at: G.obj >= 3 ? 'venue' : 'van', idle: { x: 0, z: 0, yaw: 0 }, talkT: 0 };
  });
  if (G.obj >= 3) bandHopOut(true);
  if (initial) { placePlayerOutsideVan(); }
  if (P.seat && P.seat !== 'driver' && bots.some((b) => b.seat === P.seat && b.at === 'van')) standUp();
  buildViewmodel();
  $('rolename').textContent = `${ROLES[role].name.toUpperCase()} · ${ROLES[role].bot}`;
}
function placePlayerOutsideVan() {
  P.onboard = false; P.seat = null; P.mode = 'walk'; van.wheelHands.visible = false;
  const ex = van.spec.exit, p = van.local(ex[0], 0, ex[1], _v);
  P.pos.set(p.x, world.walkH(p.x, p.z, 50), p.z); P.vy = 0;
  P.yaw = van.heading + Math.PI / 2; P.pitch = 0.05;
}
// first-person hands
let vm = null, vmItem = null;
function buildViewmodel() {
  if (vm) camera.remove(vm);
  vm = new THREE.Group(); camera.add(vm);
  const col = ROLES[G.role].color;
  vm.arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.3, -0.36, -0.5); vm.add(a);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 7), toon(col)); sleeve.rotation.x = Math.PI / 2 - 0.3; sleeve.position.z = 0.16; a.add(sleeve);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6), toon('#3b3a40')); wrist.rotation.x = Math.PI / 2; wrist.position.set(0, 0.03, -0.06); a.add(wrist);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.08), toon('#8d8a86')); hand.position.set(0, 0.04, -0.12); a.add(hand);
    for (let f = 0; f < 3; f++) { const fi = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.05), toon('#6e6b68')); fi.position.set(-0.024 + f * 0.024, 0.045, -0.18); fi.rotation.x = 0.3; a.add(fi); }
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.04), toon('#6e6b68')); th.position.set(-s * 0.045, 0.04, -0.13); a.add(th);
    vm.arms.push(a);
  }
  vmItem = new THREE.Group(); vmItem.position.set(0.0, -0.3, -0.62); vmItem.scale.setScalar(0.6); vm.add(vmItem);
  vm.inst = makeFPInstrument(G.role); if (vm.inst) { vm.inst.visible = false; vm.add(vm.inst); }
  if (G.carrying) { const m = makeItem(G.carrying); vmItem.add(m); }
  vm.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 5; } });
}
function bandHopOut(silent = false) {
  const sp = world.venue.idleSpots;
  bots.forEach((b, i) => {
    b.at = 'venue';
    b.idle = { x: sp[i % sp.length][0] + (Math.random() - 0.5) * 0.4, z: sp[i % sp.length][1] + (Math.random() - 0.5) * 0.4, yaw: Math.random() * 6.28 };
  });
  if (!silent) toast('The band piles out of the van and heads backstage!');
}

// ---------------------------------------------------------------- interactables
function inCabReach() { return false; }
function buildInteractables() {
  const I = (obj, ok, label, use, tag) => interactables.push({ obj, ok, label, use, tag });
  for (const V of Object.values(vehicles)) {
    const H = V.hit, on = () => van === V;
    I(H.radio, () => on() && (P.mode === 'walk' || P.mode === 'drive'), () => van.radioOn ? 'Radio off  (N)' : 'Radio on — KRUST FM  (N)', () => toggleRadio());
    I(H.ignition, () => on() && P.mode === 'drive', () => van.engineOn ? 'Turn the key — engine OFF  (R)' : van.crank > 0 ? 'Cranking…' : 'Turn the key — START engine  (R)', () => van.ignition(isClutch()));
    I(H.lightbtn, () => on() && P.mode === 'drive', () => `Headlights ${van.headlights ? 'off' : 'on'}  (H)`, () => { van.headlights = !van.headlights; audio.play('shift'); });
    I(H.wiperbtn, () => on() && P.mode === 'drive', () => `Wipers ${van.wipersOn ? 'off' : 'on'}  (K)`, () => { van.wipersOn = !van.wipersOn; audio.play('shift'); });
    I(H.handbrake, () => on() && P.mode === 'drive', () => van.handbrake ? 'Release parking brake  (P)' : 'Pull parking brake  (P)', () => { van.handbrake = !van.handbrake; audio.play('shift'); });
    if (V.doors) for (const [k, d] of Object.entries(V.doors)) {
      I(H['door' + k], () => on() && (P.mode === 'walk' || (P.mode === 'drive' && k === 'L')), () => `${d.open ? 'Close' : 'Open'} the ${k === 'L' ? 'driver' : 'passenger'} door`, () => { d.open = !d.open; audio.play('door'); });
    }
    if (H.ladder) {
      I(H.ladder, () => on() && P.mode === 'walk' && P.pos.y < van.local(0, 2, 0, _v4).y, () => 'Climb the ladder to the roof', () => climb(true));
      I(H.ladderTop, () => on() && P.mode === 'walk' && P.pos.y > van.local(0, 3.2, 0, _v4).y, () => 'Climb down the ladder', () => climb(false));
    }
    for (const k of Object.keys(V.seats)) {
      I(H['seat_' + k], () => on() && P.mode === 'walk' && !seatTaken(k), () => k === 'driver' ? 'Drive' : V.seats[k].roof ? 'Sit in the deck chair' : 'Sit Down', () => sit(k));
    }
    I(H.port, () => on() && P.mode === 'walk', () => G.carrying === 'cell' ? 'Plug in the Power Cell' : `Charge port — ${Math.round(van.fuel)}% (needs a Power Cell)`, () => {
      if (G.carrying !== 'cell') { audio.play('deny'); return; }
      consumeItem(); van.fuel = Math.min(100, van.fuel + 65); audio.play('plug'); toast(`Charged! ${van.spec.name} at ${Math.round(van.fuel)}%`);
      if (G.leg === 1 && G.obj === 1) setObj(2);
    });
    I(H.hatch, () => on() && P.mode === 'walk', () => G.carrying === 'kit' ? 'Repair the engine' : `Open Hatch — engine ${Math.round(van.health)}%`, () => {
      if (G.carrying !== 'kit') { audio.play('deny'); return; }
      consumeItem(); van.health = 100; audio.play('repair'); toast('Engine patched up. Good as new(ish)!');
    });
  }
  shopItems.forEach((s) => I(s.hb, () => P.mode === 'walk', () => `Buy ${ITEMS[s.kind].name} — ${ITEMS[s.kind].price}¢  (${ITEMS[s.kind].desc})`, () => buy(s.kind)));
  const vhb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshBasicMaterial({ visible: false })); vhb.position.y = 0.9; vendor.group.add(vhb);
  const vlines = ['"Long drive to Neon Falls, eh? Charge up."', '"Strings, snacks, sparks. We got it all."', '"Saw a band like you once. They were also robots."', '"No refunds on oil. It\'s been opened."'];
  I(vhb, () => P.mode === 'walk', () => 'Talk to the vendor', () => toast('VENDOR: ' + vlines[Math.floor(Math.random() * vlines.length)]));
  // setlist boards (one per venue)
  world.venues.forEach((v, i) => {
    const sb = v.setlistBoard;
    const bh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), new THREE.MeshBasicMaterial({ visible: false })); bh.position.set(sb.x, sb.y + 1.2, sb.z); scene.add(bh);
    I(bh, () => P.mode === 'walk' && !P.onboard && world.venueIdx === i, () => 'Plan tonight\'s setlist', () => openSetlist());
  });
  // practice studios: every instrument set up
  world.studios.forEach((st, si) => {
    for (const r of ROLE_LIST) {
      const sp = st.spots[r];
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 1.8), new THREE.MeshBasicMaterial({ visible: false })); h.position.set(sp.x + Math.sin(sp.yaw) * 0.4, sp.y + 1, sp.z + Math.cos(sp.yaw) * 0.4); scene.add(h);
      I(h, () => P.mode === 'walk' && !P.onboard && r === G.role, () => `Practice your ${ROLES[r].name} part`, () => { G.studio = si; startPractice(); });
      I(h, () => P.mode === 'walk' && !P.onboard && r !== G.role, () => `${ROLES[r].name} — ${ROLES[r].bot}'s rig`, () => toast(`That's ${ROLES[r].bot}'s ${ROLES[r].name.toLowerCase()} — find your own ${ROLES[G.role].name.toLowerCase()}.`));
    }
  });
}
// stage props, crowd and signs for the active venue
function setupVenue(i) {
  world.setVenue(i);
  for (const r of Object.keys(stageProps)) { scene.remove(stageProps[r]); scene.remove(stageProps[r].hb); }
  interactables = interactables.filter((x) => x.tag !== 'stage');
  if (crowd) for (const m of [crowd.bodyMesh, crowd.headMesh, crowd.faceMesh]) scene.remove(m);
  if (signs) for (const sg of signs.signs) scene.remove(sg.g);
  stageProps = {};
  for (const r of ROLE_LIST) {
    const s = world.bandSpots[r], g = makeInstrument(r);
    g.position.set(s.x, world.stage.top, s.z - 0.15); g.rotation.y = Math.PI; scene.add(g); stageProps[r] = g;
    const hb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2, 1.6), new THREE.MeshBasicMaterial({ visible: false })); hb.position.set(s.x, world.stage.top + 1, s.z - 0.3); scene.add(hb);
    stageProps[r].hb = hb;
    interactables.push({ tag: 'stage', obj: hb, ok: () => P.mode === 'walk' && !P.onboard && r === G.role, label: () => G.obj >= 3 ? (G.setlist ? 'START THE SHOW!' : 'Start the show (default setlist)') : 'Your instrument (the band isn\'t here yet)', use: () => {
      if (G.obj < 3 && !G.dbgAnywhere) { toast(`Get the whole band to ${world.venue.name} first!`); return; }
      startGig();
    } });
  }
  crowd = new Crowd(scene, world.crowdPos, crowdFaceTex());
  signs = new CrowdSigns(scene, world.crowdPos, Math.min(16, Math.max(6, Math.round(world.crowdPos.length / 10))));
  world.drawBoard(world.boardTex.userData.ctx, G.setlist, SETLIST_SONGS); world.boardTex.needsUpdate = true;
}
function toggleRadio() { van.radioOn = !van.radioOn; audio.play('shift'); if (van.radioOn) { juke.start(); toast('♪ KRUST FM — "Offbeat Dub"'); } }
function seatTaken(k) { return bots.some((b) => b.at === 'van' && b.seat === k); }
function isClutch() { return G.clutchKey === 'Shift' ? (keys.has('ShiftLeft') || keys.has('ShiftRight')) : keys.has(G.clutchKey); }
function clutchName() { return { KeyQ: 'Q', Shift: 'SHIFT', Space: 'SPACE', KeyC: 'C' }[G.clutchKey] || G.clutchKey; }

// ---------------------------------------------------------------- items
function pickUp(kind) {
  G.carrying = kind; if (vmItem) { while (vmItem.children.length) vmItem.remove(vmItem.children[0]); vmItem.add(makeItem(kind)); }
  P.robot.carrying = true; audio.play('pickup');
}
function consumeItem() {
  if (vmItem) while (vmItem.children.length) vmItem.remove(vmItem.children[0]);
  P.robot.carrying = null; G.carrying = null;
}
function dropItem() {
  if (!G.carrying) return;
  const kind = G.carrying; consumeItem();
  const m = makeItem(kind);
  const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ visible: false })); m.add(hb);
  const x = P.pos.x + f.x * 0.6, z = P.pos.z + f.z * 0.6;
  if (P.onboard) {
    const lp = van.root.worldToLocal(_v.set(x, P.pos.y, z));
    const D = van.dims; lp.x = clamp(lp.x, -D.IW + 0.25, D.IW - 0.25); lp.z = clamp(lp.z, D.ZB + 0.4, D.ZF - 1.4);
    lp.y = Math.max(D.F, van.floorLocal(lp.x, lp.z, lp.y + 0.3)) + 0.2;
    m.position.copy(lp); van.root.add(m);
  } else { m.position.set(x, world.walkH(x, z, P.pos.y + 0.3) + 0.2, z); scene.add(m); }
  interactables.push({ obj: hb, ok: () => P.mode === 'walk' && !G.carrying, label: () => `Pick up ${ITEMS[kind].name}`, use: () => { m.parent.remove(m); interactables = interactables.filter((x) => x.obj !== hb); pickUp(kind); }, dyn: true });
  audio.play('thump');
}
function buy(kind) {
  if (G.carrying) { audio.play('deny'); toast('Your hands are full — G to drop what you\'re holding.'); return; }
  const it = ITEMS[kind];
  if (G.coins < it.price) { audio.play('deny'); toast('Not enough coins!'); return; }
  G.coins -= it.price; audio.play('buy'); pickUp(kind); toast(`Bought ${it.name}. ${it.desc}.`);
}
function drink() {
  if (G.carrying !== 'oil') return;
  consumeItem(); G.hypeBonus = 15; audio.play('drink'); P.robot.setFace('happy', 1.5); toast('Glug glug. Premium 10W-40. +15 starting hype at the next show!');
}

// ---------------------------------------------------------------- ladder
function climb(up) {
  const L = van.spec.ladder; if (!L) return;
  const bot = new THREE.Vector3(...L.bottom), top = new THREE.Vector3(...L.top);
  const a = up ? bot : top.clone().setY(top.y - 0.02);
  const b = up ? top : bot.clone().setZ(bot.z - 0.15);
  P.climb = { a, b, t: 0, up }; P.mode = 'climb'; P.vy = 0;
  P.yaw = van.heading + (up ? 0 : Math.PI); P.pitch = up ? 0.6 : -0.6;
  audio.play('thump');
}
function updateClimb(dt) {
  const c = P.climb; c.t = Math.min(1, c.t + dt / 1.6);
  const k = c.t, lp = new THREE.Vector3();
  if (c.up) { lp.set(c.a.x, c.a.y + (c.b.y - c.a.y) * Math.min(1, k / 0.8), c.a.z + (c.b.z - c.a.z) * Math.max(0, (k - 0.8) / 0.2)); }
  else { lp.set(c.a.x, c.a.y + (c.b.y - c.a.y) * Math.max(0, (k - 0.2) / 0.8), c.a.z + (c.b.z - c.a.z) * Math.min(1, k / 0.2)); }
  P.pos.copy(van.root.localToWorld(lp));
  P.bob = (P.bob || 0) + dt * 6; P.speed = 2;
  P.robot.group.position.copy(P.pos); P.robot.group.rotation.set(0, P.yaw, 0);
  if (k >= 1) { P.mode = 'walk'; P.climb = null; P.onboard = c.up; P.grounded = true; P.pos.y = c.up ? P.pos.y : world.walkH(P.pos.x, P.pos.z, P.pos.y + 1); }
}
// ---------------------------------------------------------------- horn
let hornSrc = null, hornGain = null;
function hornOn() {
  if (!audio.ctx || hornSrc) return;
  for (const b of bots) if (b.at === 'van' && Math.random() < 0.5) b.robot.setFace('wow', 0.6);
  const buf = audio.stems && audio.stems.horn;
  if (!buf) { audio.play('honk'); return; }
  hornGain = audio.ctx.createGain(); hornGain.gain.value = 0.9; hornGain.connect(audio.sfx);
  hornSrc = audio.ctx.createBufferSource(); hornSrc.buffer = buf; hornSrc.connect(hornGain); hornSrc.start();
  const me = hornSrc; hornSrc.onended = () => { if (hornSrc === me) { hornSrc = null; } };
}
function hornOff() {
  if (!hornSrc) return;
  const t = audio.now; hornGain.gain.setTargetAtTime(0, t, 0.08); try { hornSrc.stop(t + 0.4); } catch (e) { /* */ }
  hornSrc = null;
}
// ---------------------------------------------------------------- road blockers
function nearBlocker(maxD = 4.5) {
  let best = null, bd = maxD;
  for (const b of world.blockers) { if (b.cleared) continue; for (const c of b.circles) { const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z) - c.r; if (d < bd) { bd = d; best = b; } } }
  return best;
}
function clearBlocker(b, silent) {
  if (!world.clearBlocker(b)) return;
  audio.play('clunk'); if (!silent) toast({ rocks: 'Rocks rolled off the road!', log: 'Heave! The tree is off the road.', crates: 'Crates stacked out of the way.', barrier: 'Barrier moved aside.' }[b.kind]);
}
function clearAhead() {
  let n = 0;
  for (const b of world.blockers) { if (b.cleared) continue; const c = b.circles[0]; if (Math.hypot(van.pos.x - c.x, van.pos.z - c.z) < 140) { clearBlocker(b, true); n++; } }
  toast(n ? `Cleared ${n} road block${n > 1 ? 's' : ''} ahead (L).` : 'No road blocks nearby.');
}
// ---------------------------------------------------------------- high fives
const _hf = { t: -9, idx: -1 };
let hfArm = null;
function nearFan() {
  if (!crowd) return -1;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  let best = -1, bd = 1.7;
  world.crowdPos.forEach((c, i) => { const dx = c.x - P.pos.x, dz = c.z - P.pos.z, d = Math.hypot(dx, dz); if (d < bd && Math.abs(c.y - P.pos.y) < 0.8 && (dx * fx + dz * fz) / (d || 1) > 0.3) { bd = d; best = i; } });
  return best;
}
function highFive(i) {
  _hf.t = G.t; _hf.idx = i;
  audio.play('clap'); if (G.perf) G.perf.hype = Math.min(100, G.perf.hype + 2);
  if (!hfArm) { hfArm = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6), toon('#8d8a86')); a.position.y = 0.3; hfArm.add(a); const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.05), toon('#8d8a86')); h.position.y = 0.66; hfArm.add(h); scene.add(hfArm); }
  const c = world.crowdPos[i]; hfArm.position.set(c.x + 0.18, c.y + 1.15, c.z); hfArm.visible = true;
  hfArm.lookAt(P.pos.x, c.y + 1.15, P.pos.z); hfArm.rotateX(0.0);
  crowd.hop(i, G.t);
  P.robot.setFace('happy', 0.6);
}
// ---------------------------------------------------------------- seats / driving
function sit(k) {
  P.seat = k; P.mode = k === 'driver' ? 'drive' : 'seat'; P.onboard = true;
  P.drvYaw = 0; P.drvPitch = k === 'driver' ? -0.16 : -0.1;
  if (k === 'driver') {
    G.chase = false; van.wheelHands.visible = true;
    toast(G.automatic ? (van.engineOn ? 'Driving! W to go, S to brake (hold S when stopped to reverse). P = park.' : 'Press R to start the engine, then hold W to drive.') : (van.engineOn ? 'Driving! Hold Q + hold LEFT CLICK to move the gear stick (or Q + scroll).' : 'Press R to start (in Neutral, or hold Q). Release the parking brake with P or click the lever.'));
  }
  audio.play('thump');
}
function standUp() {
  const k = P.seat || 'driver', s = van.seats[k] || van.seats.driver;
  let st = s.stand;
  // hop straight out of an open cab door
  const door = van.doors && (k === 'driver' ? van.doors.L : k === 'shotgun' ? van.doors.R : null);
  if (door && door.open) st = [door.side * (van.dims.W + 0.75), s.p[2], door.side * Math.PI / 2];
  van.local(st[0], (s.roof ? s.p[1] : van.floor) + 0.02, st[1], P.pos);
  P.yaw = van.heading + st[2]; P.pitch = 0;
  P.vy = 0; P.seat = null; P.mode = 'walk'; P.onboard = true; van.wheelHands.visible = false; G.shifting = false;
}

// ---------------------------------------------------------------- objectives
const OBJ = [
  [
    'Drive the van to THE RUSTY NAIL in Hollow Creek — your first gig is tonight! (Walk in the side door → driver seat → E)',
    '',
    'Keep driving to THE RUSTY NAIL — stop at the HAYLOFT STUDIO on the way to practise (optional). Park out back at the LOADING BAY.',
    'You made it! Plan the SETLIST on the board inside the bar',
    'Get on stage and press E at your instrument to start the show',
    'SHOWTIME!',
    'First gig done!',
  ],
  [
    'New wheels! Drive the RV to the REST STOP — it\'s low on charge. (Side door → driver seat → E)',
    'Rest stop! Buy a POWER CELL at the kiosk, then plug it into the RV\'s REAR charge port',
    'Drive on to NEON FALLS — stop at the PRACTICE STUDIO on the way (optional), then park at the LOADING BAY behind the stage',
    'You made it! Plan the SETLIST on the board backstage',
    'Get on stage and press E at your instrument to start the show',
    'SHOWTIME!',
    'Neon Falls conquered!',
  ],
  [
    'The big time! Drive the TOUR BUS into CHROME CITY. (Front door → driver seat → E)',
    '',
    'Head for THE MEGADOME — CHROME REHEARSALS is on the way (optional). Park at the LOADING BAY behind the stage.',
    'You made it! Plan the SETLIST on the board backstage',
    'Get on stage and press E at your instrument to start the show',
    'SHOWTIME!',
    'Tour complete! Free roam.',
  ],
];
function setObj(i, force) {
  if (i === G.obj && !force) return;
  G.obj = i; $('obj').innerHTML = `<b>${LEGS[G.leg].title}</b><br>${OBJ[G.leg][i]}`;
  $('obj').classList.remove('pulse'); void $('obj').offsetWidth; $('obj').classList.add('pulse');
}
function checkObjectives() {
  const vp = van.pos;
  if (G.leg === 1) {
    if (G.obj === 0 && Math.hypot(vp.x - world.restCenter.x, vp.z - world.restCenter.z) < 32) { setObj(van.fuel >= 80 ? 2 : 1); toast('Welcome to the Rest Stop!'); }
    if (G.obj === 1 && van.fuel >= 80) setObj(2);
  } else if (G.obj === 0 && van.engineOn && Math.abs(van.v) > 3) setObj(2);
  {
    // wrong-way warning: only when driving FORWARD (not reversing) against the route for a while
    const n = world.nearestRoad(vp.x, vp.z);
    const rp = world.roadPoint(n.s), f = van.forward(), dot = f.x * rp.tx + f.z * rp.tz;
    if (P.mode === 'drive' && van.v > 5 && n.d < 6 && dot < -0.75) G.wrongT = (G.wrongT || 0) + 1 / 60; else G.wrongT = Math.max(0, (G.wrongT || 0) - 2 / 60);
    if (G.wrongT > 5 && G.t - (G.wrongToast || -99) > 15) { G.wrongToast = G.t; G.wrongT = 0; toast(`⚠ Wrong way? ${world.venue.name} is back the other direction (M for the map).`); }
  }
  for (const st of world.studios) {
    if (Math.hypot(vp.x - st.center.x, vp.z - st.center.z) < 30) { if (G.studioHint !== st) { G.studioHint = st; toast(`${st.label} — every instrument is set up inside. Go in and practise!`); } }
  }
  if (Math.hypot(vp.x - world.falls.x, vp.z - world.falls.z) < 110 && !G.fallsHint) { G.fallsHint = true; toast('Silverthread Falls! Pull over for the view if you like.'); }
  if (van.fuel < 12 && !G.lowWarn) { G.lowWarn = true; toast(G.leg === 1 ? '⚡ Charge critically low! Rest stop is up ahead…' : '⚡ Charge critically low!'); }
  if (van.fuel > 20) G.lowWarn = false;
  const V = world.venue.center, lb = world.loadingBay;
  if (G.obj <= 2 && G.bayHint !== G.leg && Math.hypot(vp.x - V.x, vp.z - V.z) < 90) { G.bayHint = G.leg; toast(`${world.venue.name.toUpperCase()}! Pull into the LOADING BAY round the back.`); }
  if (G.obj <= 2 && Math.hypot(vp.x - lb.x, vp.z - lb.z) < 10 && Math.abs(van.v) < 2) { setObj(3); bandHopOut(); toast('Parked at the loading bay — the band heads inside!'); }
}

// ---------------------------------------------------------------- weather
const RAIN_N = 2200;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b8c8e0', transparent: true, opacity: 0.55 }));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
const drops = new Float32Array(RAIN_N * 4); // x, y, z, speed
function respawnDrop(i, c, top) {
  const minR = (P && (P.mode === 'drive' || P.mode === 'seat' || (P.onboard && P.pos.y < van.local(0, van.dims.TOP - 0.2, 0, _v4).y))) ? Math.max(3.2, van.dims.ZF) : 0.6;
  const a = Math.random() * 6.283, r = minR + Math.pow(Math.random(), 0.7) * 28;
  drops[i * 4] = c.x + Math.cos(a) * r; drops[i * 4 + 2] = c.z + Math.sin(a) * r;
  drops[i * 4 + 1] = top ? c.y + 14 : c.y - 8 + Math.random() * 22; drops[i * 4 + 3] = 20 + Math.random() * 8;
}
function weatherFlags() {
  const w = G.weather;
  let autoRain = false;
  // it rains on the drive between gig 1 (The Rusty Nail) and gig 2 (Neon Falls)
  if (w === 'auto' && G.leg === 1 && G.obj < 3 && van) {
    const s = world.nearestRoad(van.pos.x, van.pos.z).s;
    autoRain = s > world.sBar + 60 && s < world.sNF - 150;
    if (autoRain && !G.rainToast) { G.rainToast = true; toast('Rain rolling across the desert… wipers on! (K)'); }
  }
  return { night: w === 'night' || w === 'storm', rain: w === 'rain' || w === 'storm' || autoRain };
}
let glassDrops = [], lastWipeSide = 0;
function updateWeather(dt) {
  const f = weatherFlags();
  G.rainAmt = lerp(G.rainAmt, f.rain ? 1 : 0, Math.min(1, dt * 0.8));
  const ra = G.rainAmt, c = camera.position;
  rain.visible = ra > 0.02;
  if (rain.visible) {
    if (!rain.userData.init) { for (let i = 0; i < RAIN_N; i++) respawnDrop(i, c, false); rain.userData.init = true; }
    const shown = Math.floor(RAIN_N * ra);
    for (let i = 0; i < RAIN_N; i++) {
      let x = drops[i * 4], y = drops[i * 4 + 1], z = drops[i * 4 + 2];
      y -= drops[i * 4 + 3] * dt; x += 1.5 * dt;
      if (y < c.y - 10 || Math.abs(x - c.x) > 32 || Math.abs(z - c.z) > 32) { respawnDrop(i, c, true); x = drops[i * 4]; y = drops[i * 4 + 1]; z = drops[i * 4 + 2]; }
      drops[i * 4] = x; drops[i * 4 + 1] = y;
      const o = i * 6, on = i < shown;
      rainPos[o] = x; rainPos[o + 1] = on ? y : -9999; rainPos[o + 2] = z;
      rainPos[o + 3] = x - 0.06; rainPos[o + 4] = on ? y + 0.55 : -9999; rainPos[o + 5] = z;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // fog & light dimming in rain
  scene.fog.near = lerp(scene.fog.near, 70 - ra * 64, 1); scene.fog.far = lerp(scene.fog.far, scene.fog.far * (1 - ra * 0.65), 1);
  scene.fog.color.lerp(_c1.set(f.night ? '#151520' : '#7d8088'), ra * 0.7);
  sky.mat.uniforms.top.value.lerp(_c1.set(f.night ? '#0a0b12' : '#5c6068'), ra * 0.75);
  sky.mat.uniforms.hor.value.lerp(_c1.set(f.night ? '#16161e' : '#8a8c92'), ra * 0.75);
  sun.intensity *= 1 - ra * 0.6;
  // windshield
  const cab = P.mode === 'drive' && !G.chase && G.mode === 'play';
  const facing = Math.abs(P.drvYaw) < 1.0 && P.drvPitch > -0.9;
  if (ra > 0.05) G.wet = Math.min(1, G.wet + dt * 0.11 * ra); else G.wet = Math.max(0, G.wet - dt * 0.2);
  // wipers clear on each pass
  const wz = van.wipers[0].rotation.z, side = wz < 0.75 ? 1 : 0;
  if (van.wipersOn && side !== lastWipeSide) { G.wet = Math.max(0.05, G.wet * 0.25); glassDrops = glassDrops.filter(() => Math.random() < 0.15); }
  lastWipeSide = side;
  const gl = $('rainglass'), show = cab && facing && G.wet > 0.03;
  gl.style.display = show ? 'block' : 'none';
  if (show) {
    gl.style.backdropFilter = gl.style.webkitBackdropFilter = `blur(${(G.wet * 7).toFixed(1)}px)`;
    const cv = $('raincan'), W = cv.width = Math.round(window.innerWidth / 3), H = cv.height = Math.round(window.innerHeight / 3), g = cv.getContext('2d');
    const want = Math.floor(G.wet * 260);
    while (glassDrops.length < want) glassDrops.push({ x: Math.random(), y: Math.random() * 0.75, r: 1 + Math.random() * 3.5, s: Math.random() });
    if (glassDrops.length > want + 40) glassDrops.length = want;
    g.clearRect(0, 0, W, H);
    for (const d of glassDrops) {
      d.y += d.s * 0.0006 * (1 + G.wet); if (d.y > 0.8) { d.y = Math.random() * 0.3; d.x = Math.random(); }
      const x = d.x * W, y = d.y * H;
      g.fillStyle = 'rgba(200,215,235,0.28)'; g.beginPath(); g.ellipse(x, y, d.r, d.r * 1.3, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - d.r * 0.3, y - d.r * 0.6, 1, 1);
    }
    if (!van.wipersOn && G.wet > 0.6 && !G.wiperHint) { G.wiperHint = true; toast('Can\'t see a thing! Turn on the wipers (K or the WIPE button).'); }
  }
  if (G.wet < 0.3) G.wiperHint = false;
}

// ---------------------------------------------------------------- toast / hud
let toastT = 0;
const toastLog = [];
function toast(msg) { toastLog.push([+G.t.toFixed(1), msg]); const el = $('toast'); el.textContent = msg; el.style.opacity = 1; toastT = 3.2; }

// ---------------------------------------------------------------- radio jukebox
const juke = {
  srcs: [], playing: false,
  async start() {
    if (this.playing) return;
    try { await ensureStems(); } catch (e) { toast('Radio: couldn\'t load the song.'); return; }
    if (!van.radioOn || this.playing) return;
    const t = audio.now + 0.05;
    this.srcs = ROLE_LIST.map((r) => { const s = audio.ctx.createBufferSource(); s.buffer = audio.stems[r]; s.loop = true; s.connect(audio.radio); s.start(t); return s; });
    this.playing = true;
  },
  stop() { this.srcs.forEach((s) => { try { s.stop(); } catch (e) { /* */ } }); this.srcs = []; this.playing = false; },
  update() {
    if (!audio.ctx) return;
    if (!van.radioOn || G.perf) { audio.radio.gain.setTargetAtTime(0, audio.now, 0.1); if (!van.radioOn && this.playing) this.stop(); return; }
    if (!this.playing) this.start();
    const near = P.onboard ? 1 : clamp(1 - van.pos.distanceTo(P.pos) / 25, 0, 1);
    audio.radio.gain.setTargetAtTime(0.45 * near, audio.now, 0.1);
  },
};
let stemsPromise = null;
function ensureStems() {
  if (audio.stems && ROLE_LIST.every((r) => audio.stems[r])) return Promise.resolve(audio.stems);
  if (!stemsPromise) stemsPromise = audio.loadStems(STEM_FILES).catch((e) => { stemsPromise = null; throw e; });
  return stemsPromise;
}
function withStems(fn) {
  if (audio.stems && ROLE_LIST.every((r) => audio.stems[r])) { fn(); return; }
  toast('Loading "Offbeat Dub"…');
  ensureStems().then(fn).catch((e) => { console.error(e); toast('Couldn\'t load the song audio: ' + e.message); });
}

// ---------------------------------------------------------------- performance (gig / practice)
let camCut = 0, camShot = 0;
function onPerfEvent(type, d) {
  if (type === 'hit') P.robot.setFace(d.res === 'perfect' ? 'note' : 'happy', 0.35);
  else if (type === 'miss') { P.robot.setFace('sad', 0.5); post.flash = 0.04; }
  else if (type === 'bot') { const b = bots.find((x) => x.role === d.r); if (b && Math.random() < 0.3) b.robot.setFace(d.hit ? 'happy' : 'sad', 0.4); }
  else if (type === 'grooveMove') P.robot.setFace('happy', 0.4);
  else if (type === 'finish') endPerf(d);
}
function placeBandOnStage() {
  const all = [{ role: G.role, robot: P.robot }, ...bots];
  for (const b of all) {
    const s = world.bandSpots[b.role];
    b.robot.group.position.set(s.x, world.stage.top, s.z + (b.role === 'drums' ? 0.45 : 0.25));
    b.robot.group.rotation.set(0, Math.PI, 0);
    b.robot.state = 'play'; b.robot.group.visible = true;
    if (!b.robot.handheld) { const h = makeHandheld(b.role); b.robot.hand.add(h); b.robot.handheld = h; }
    if (b.role === 'drums') b.robot.group.position.y = world.stage.top + 0.05;
    b.at = 'stage';
  }
}
function startGig() { withStems(startGigNow); }
function startGigNow() {
  if (G.perf) return;
  if (!G.setlist) G.setlist = ['offbeat'];
  if (G.carrying) dropItem();
  if (G.obj < 3) { bandHopOut(true); }
  G.mode = 'gig'; P.mode = 'gig'; P.onboard = false;
  placeBandOnStage();
  setObj(5);
  G.todOverride = G.todOverride ?? null;
  G.signSlot = -1; G.signOrder = [...ROLE_LIST].sort(() => Math.random() - 0.5); signs.lowerAll(); shotIdx = -1;
  G.perf = new Performance({ audio, buffers: audio.stems, role: G.role, mode: 'gig', confidence: G.confidence, hypeStart: 35 + G.hypeBonus, dbg: G.dbg, canvas: rcan, onEvent: onPerfEvent });
  G.hypeBonus = 0; camShot = -1; camCut = 0;
  document.body.classList.add('perf', 'gig');
  takePost(true);
  G.perf.insetBottom = INSET.m + INSET.h; G.perf.insetW = INSET.w;
  toast('You\'re at your post. SPACE to play · E to step away and roam the stage.');
}
function postSpot() { const s = world.bandSpots[G.role]; return { x: s.x, z: s.z + (G.role === 'drums' ? 0.45 : 0.25), y: world.stage.top + (G.role === 'drums' ? 0.05 : 0) }; }
function takePost(silent) {
  const s = postSpot();
  G.atPost = true; P.mode = 'gig'; P.onboard = false;
  P.robot.group.position.set(s.x, s.y, s.z); P.robot.group.rotation.set(0, Math.PI, 0);
  P.pos.set(s.x, s.y, s.z); P.yaw = Math.PI; P.pitch = -0.12; P.vy = 0;
  if (G.perf) G.perf.atPost = true;
  if (!silent) { audio.play('thump'); toast('Back at your post!'); }
}
function leavePost() {
  toast('Off your post — your part is muted. SPACE jumps, E near fans to high five, E at your instrument to play.');
  const s = postSpot();
  G.atPost = false; P.mode = 'walk';
  P.pos.set(s.x + 0.9, s.y, s.z + 0.2); P.vy = 0;
  if (G.perf) G.perf.atPost = false;
  audio.play('thump');
}
function nearPost() { const s = postSpot(); return Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 1.6 && Math.abs(P.pos.y - s.y) < 0.6; }
function practicePost() { return world.studios[G.studio ?? 0].spots[G.role]; }
function startPractice() { withStems(startPracticeNow); }
function startPracticeNow() {
  if (G.perf) return;
  if (G.carrying) dropItem();
  G.mode = 'practice'; P.mode = 'practice';
  const sp = practicePost();
  P.pos.set(sp.x, sp.y, sp.z); P.yaw = sp.yaw; P.pitch = -0.15;
  P.robot.group.position.set(sp.x, sp.y, sp.z); P.robot.group.rotation.set(0, sp.yaw, 0); P.robot.state = 'play';
  if (!P.robot.handheld) { const h = makeHandheld(G.role); P.robot.hand.add(h); P.robot.handheld = h; }
  G.perf = new Performance({ audio, buffers: audio.stems, role: G.role, mode: 'practice', confidence: G.confidence, hypeStart: 50, dbg: G.dbg, canvas: rcan, onEvent: onPerfEvent });
  document.body.classList.add('perf');
}
function endPerf(d) {
  const mode = G.mode;
  G.perf = null; document.body.classList.remove('perf', 'gig'); G.atPost = false;
  if (P.robot.handheld) { P.robot.hand.remove(P.robot.handheld); P.robot.handheld = null; }
  if (mode === 'practice') {
    if (!d) { G.mode = 'play'; P.mode = 'walk'; P.robot.state = 'idle'; return; }
    G.confidence = Math.max(G.confidence, d.acc); G.practiced = true;
    G.mode = 'play'; P.mode = 'walk'; P.robot.state = 'idle';
    const sp = practicePost(); P.pos.set(sp.x + Math.sin(sp.yaw) * 1.3, sp.y, sp.z + Math.cos(sp.yaw) * 1.3); P.yaw = sp.yaw;
    toast(`Practice: ${Math.round(d.acc * 100)}% — confidence up for the next show!`);
    return;
  }
  // gig
  bots.forEach((b) => { if (b.robot.handheld) { b.robot.hand.remove(b.robot.handheld); b.robot.handheld = null; } b.robot.state = 'cheer'; });
  P.robot.state = 'cheer';
  if (!d) { finishGigCleanup(); return; }
  const coins = Math.round(20 + d.score / 150 + d.hype * 0.4);
  const fans = Math.round(d.hype * 3 + d.acc * 120);
  G.coins += coins; G.fans += fans; G.lastGig = d;
  audio.cheer(5, 0.6 + d.hype / 100);
  if (G.leg > 0) signs.raise(G.t, 6, G.bandName.toUpperCase(), 'ENCORE!', 12);
  const stars = '★'.repeat(d.stars) + '☆'.repeat(5 - d.stars);
  const bandRows = Object.entries(d.bots).map(([r, a]) => `<div class="brow"><span style="color:${ROLES[r].color}">${ROLES[r].name}</span><span>${Math.round(a * 100)}%</span></div>`).join('');
  $('results').innerHTML = `<div class="card">
    <h1>SHOW'S OVER!</h1><div class="sub">${G.bandName} · Live at ${world.venue.name}</div><div class="stars">${stars}</div>
    <div class="grid"><div>Your accuracy<b>${Math.round(d.acc * 100)}%</b></div><div>Score<b>${d.score}</b></div><div>Max combo<b>${d.maxCombo}</b></div><div>Crowd hype<b>${Math.round(d.hype)}%</b></div></div>
    <div class="sub">Perfect ${d.stats.perfect} · Good ${d.stats.good} · OK ${d.stats.ok} · Miss ${d.stats.miss}</div>
    <h3>BANDMATES</h3>${bandRows}
    <div class="earn">+${coins}¢ &nbsp; · &nbsp; +${fans} fans</div>
    <div class="btns"><button id="rcont">${G.leg < 2 ? 'Continue ▶' : 'Continue (free roam)'}</button><button id="ragain">Play the set again</button></div></div>`;
  showOverlay('results');
  $('rcont').onclick = () => { hideOverlay(); finishGigCleanup(); setObj(6); if (G.leg < 2) showAward(); else toast('TOUR COMPLETE! You played the Megadome. Free roam — ` for debug.'); };
  $('ragain').onclick = () => { hideOverlay(); startGig(); };
}
function finishGigCleanup() {
  G.mode = 'play'; P.mode = 'walk';
  const s = world.bandSpots[G.role];
  P.pos.set(s.x + 1, world.stage.top, s.z - 1.2); P.vy = 0; P.yaw = Math.PI; P.pitch = 0;
  const cb = world.venue.crowdBox;
  bots.forEach((b) => { b.at = 'venue'; b.robot.state = 'idle'; b.idle = { x: lerp(cb[0], cb[1], Math.random()), z: lerp(cb[2], cb[3], Math.random()), yaw: Math.PI }; });
  P.robot.state = 'idle';
}
// ---------------------------------------------------------------- tour progression
const AWARD = [
  { veh: 'rv', title: 'YOU GOT AN RV!', text: 'The Rusty Nail\'s owner was so impressed she handed over the keys to her old RV. Room for the whole band, a kitchen, and a roof deck. Next stop: <b>Neon Falls</b>, across the desert.' },
  { veh: 'bus', title: 'YOU GOT A TOUR BUS!', text: 'Neon Falls went wild. A promoter signs you on the spot — and lends you a proper tour bus with a lounge, galley and CCTV. Next stop: <b>The Megadome</b> in Chrome City.' },
];
function showAward() {
  const a = AWARD[G.leg];
  $('results').innerHTML = `<div class="card"><h1>${a.title}</h1><p class="sub" style="max-width:520px;margin:10px auto;line-height:1.4">${a.text}</p>
    <p class="sub">The old ${van.spec.name.toLowerCase()} stays parked here.</p><div class="btns"><button id="rgo">Hit the road ▶</button></div></div>`;
  showOverlay('results');
  $('rgo').onclick = () => { hideOverlay(); startLeg(G.leg + 1); };
}
function parkVehicle(V, x, z, heading) {
  V.root.visible = true; V.active = false; V.engineOn = false; V.handbrake = true; V.v = 0; V.radioOn = false; V.headlights = false; V.setGear('N');
  V.place(x, z, heading);
  if (parkedCols[V.type]) world.removeCollider(parkedCols[V.type]);
  const S = V.spec;
  parkedCols[V.type] = world.addCollider(x + Math.sin(heading) * (S.ZF + S.ZB) / 2, z + Math.cos(heading) * (S.ZF + S.ZB) / 2, S.W, (S.ZF - S.ZB) / 2 + 0.3, heading, V.y, V.y + S.TOP);
}
function hideVehicle(V) { V.root.visible = false; V.active = false; if (parkedCols[V.type]) { world.removeCollider(parkedCols[V.type]); parkedCols[V.type] = null; } V.place(0, -9999, 0); }
function activateVehicle(type, x, z, heading) {
  if (van) van.wheelHands.visible = false;
  juke.stop(); if (van) van.radioOn = false;
  van = vehicles[type]; van.active = true; van.root.visible = true;
  if (parkedCols[type]) { world.removeCollider(parkedCols[type]); parkedCols[type] = null; }
  van.fuel = type === 'rv' ? 45 : 100; van.health = 100; van.setGear('N'); van.handbrake = true; van.engineOn = false; van.v = 0;
  van.setBandName(G.bandName);
  van.place(x, z, heading);
}
// vehicles that exist before/after each leg
function arrangeVehicles(leg) {
  const types = ['van', 'rv', 'bus'];
  types.forEach((t, i) => {
    if (i === leg) return;
    if (i < leg) { const v = world.venues[i], lb = v.loadingBay; parkVehicle(vehicles[t], lb.x - 8, lb.z + 7, -Math.PI / 2); }
    else hideVehicle(vehicles[t]);
  });
}
function startLeg(leg, where) {
  if (G.perf) abortPerf();
  G.leg = leg; G.obj = 0; G.setlist = null; G.lastGig = null; G.studio = leg; G.bayHint = -1; G.mode = G.mode === 'title' ? 'title' : 'play';
  P.mode = 'walk'; P.seat = null; P.onboard = false; if (G.carrying) consumeItem();
  setupVenue(leg);
  arrangeVehicles(leg);
  let pose;
  if (leg === 0) pose = world.startPose;
  else { const lb = world.venues[leg - 1].loadingBay; pose = { x: lb.x + 1, z: lb.z, heading: lb.exitHeading ?? Math.PI / 2 }; } // facing onward
  activateVehicle(LEGS[leg].vehicle, pose.x, pose.z, pose.heading);
  G.legStartS = leg === 0 ? 0 : world.legRange[leg][0];
  setupRole(G.role);
  bots.forEach((b) => (b.at = 'van'));
  placePlayerOutsideVan();
  G.todOverride = null; G.tod = 0.06;
  setObj(0, true);
  if (!where && leg > 0) toast(`${LEGS[leg].title} — the next morning. Climb aboard ${van.spec.title}, then turn ${world.venues[leg - 1].loadingBay.exitTurn || 'LEFT'} out of the lot onto the road.`);
}

function abortPerf() { if (G.perf) { G.perf.stop(); const m = G.mode; endPerf(null); if (m === 'gig') { toast('Show stopped.'); setObj(4); } } }

// ---------------------------------------------------------------- overlays
function showOverlay(id) { G.overlay = id; $(id).classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); }
function hideOverlay() { if (G.overlay) $(G.overlay).classList.remove('show'); G.overlay = null; }
function toggleMap() { if (G.overlay === 'map') { hideOverlay(); return; } drawMap(); showOverlay('map'); }
function drawMap() {
  const c = mapCan, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#e9dcae'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c9b98a'; for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(0, (i * H) / 20); g.lineTo(W, (i * H) / 20); g.stroke(); }
  const r = world.legRange[G.leg], i0 = Math.max(0, Math.floor((r[0] - 150) / world.step)), i1 = Math.min(world.N, Math.ceil((r[1] + 150) / world.step));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = i0; i <= i1; i++) { minX = Math.min(minX, world.rx[i]); maxX = Math.max(maxX, world.rx[i]); minZ = Math.min(minZ, world.rz[i]); maxZ = Math.max(maxZ, world.rz[i]); }
  minX -= 80; maxX += 80; minZ -= 60; maxZ += 60;
  const sc = Math.min((W - 60) / (maxX - minX), (H - 80) / (maxZ - minZ));
  const tx = (x) => W / 2 + (x - (minX + maxX) / 2) * sc * -1, tz = (z) => H / 2 + 10 - (z - (minZ + maxZ) / 2) * sc;
  const seg = (a, b, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = a; i <= b; i += 2) { const X = tx(world.rx[i]), Y = tz(world.rz[i]); i > a ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); };
  seg(0, world.N, 'rgba(90,74,58,0.35)', 5); seg(i0, i1, '#5a4a3a', 6);
  g.setLineDash([6, 6]); seg(i0, i1, '#e8b13a', 2); g.setLineDash([]);
  // river
  g.strokeStyle = '#4f9cc4'; g.lineWidth = 4; g.beginPath(); world.river.forEach((p, i) => (i ? g.lineTo(tx(p.x), tz(p.z)) : g.moveTo(tx(p.x), tz(p.z)))); g.stroke();
  const pin = (x, z, col, txt) => { g.fillStyle = col; g.beginPath(); g.arc(tx(x), tz(z), 8, 0, 7); g.fill(); g.fillStyle = '#2a2020'; g.font = '20px VT323, monospace'; g.textAlign = 'left'; g.fillText(txt, tx(x) + 12, tz(z) + 6); };
  const sp = world.roadPoint(20); pin(sp.x, sp.z, '#c0583a', 'HOLLOW CREEK FARM');
  pin(world.falls.x, world.falls.z, '#4f9cc4', 'SILVERTHREAD FALLS');
  pin(world.restCenter.x, world.restCenter.z, '#2f8f8a', 'REST STOP');
  world.studios.forEach((st) => pin(st.center.x, st.center.z, '#7db63a', st.label));
  world.venues.forEach((v, i) => pin(v.center.x, v.center.z, i === G.leg ? '#c04fa8' : '#8a7a8a', v.name.toUpperCase() + (i === G.leg ? ' ★' : '')));
  const vx = tx(van.pos.x), vz = tz(van.pos.z);
  g.save(); g.translate(vx, vz); g.rotate(-van.heading); g.fillStyle = '#1d6fd1'; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#1d6fd1'; g.font = '20px VT323, monospace'; g.fillText(van.spec.name.toUpperCase(), vx + 12, vz - 8);
  if (!P.onboard) { g.fillStyle = '#ff6ad5'; g.beginPath(); g.arc(tx(P.pos.x), tz(P.pos.z), 5, 0, 7); g.fill(); }
  g.fillStyle = '#2a2020'; g.font = '26px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText(LEGS[G.leg].title, W / 2, 34);
}
function openSetlist() {
  const sel = G.setlist ? [...G.setlist] : [];
  const render = () => {
    const on = sel.includes('offbeat');
    $('setlist').innerHTML = `<div class="card"><h1>TONIGHT'S SETLIST</h1><p class="sub">One song in the book so far. Pick it to lock in tonight's set.</p>
      <div class="songs"><button class="song ${on ? 'on' : ''}" data-id="offbeat"><span class="n">${on ? 1 : ''}</span><b>${SONG.title}</b><span>${SONG.bpm} BPM · ${SONG.genre} · ${SONG.bars} bars</span></button>
      ${['Song 2', 'Song 3', 'Song 4'].map((t) => `<button class="song" disabled style="opacity:.4"><b>${t}</b><span>coming soon</span></button>`).join('')}</div>
      <div class="btns"><button id="slok" ${on ? '' : 'disabled'}>Lock it in</button><button id="slx">Cancel</button></div></div>`;
    document.querySelectorAll('#setlist .song[data-id]').forEach((b) => (b.onclick = () => { const i = sel.indexOf('offbeat'); if (i >= 0) sel.splice(i, 1); else sel.push('offbeat'); render(); }));
    $('slok').onclick = () => { G.setlist = sel; world.drawBoard(world.boardTex.userData.ctx, sel, SETLIST_SONGS); world.boardTex.needsUpdate = true; hideOverlay(); toast('Setlist locked! Practice, or head on stage.'); if (G.obj === 3) setObj(4); };
    $('slx').onclick = () => hideOverlay();
  };
  render(); showOverlay('setlist');
}

// ---------------------------------------------------------------- update: player
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
function moveInput() {
  const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  return { f, r };
}
function updatePlayer(dt) {
  const R = P.robot;
  if (P.mode === 'climb') { updateClimb(dt); R.update(dt, 1.5); if (vm) vm.visible = !G.dbg.third; return; }
  const fp = !G.dbg.third;
  if (P.mode === 'walk') {
    const { f, r } = moveInput();
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const sp = run ? 5.6 : 3.2;
    const cy = P.yaw;
    let dx = Math.sin(cy) * f - Math.cos(cy) * r, dz = Math.cos(cy) * f + Math.sin(cy) * r;
    const l = Math.hypot(dx, dz); if (l > 0) { dx /= l; dz /= l; }
    P.speed = l > 0 ? sp : 0;
    P.pos.x += dx * sp * dt; P.pos.z += dz * sp * dt;
    if (P.onboard && van.shake > 0.35 && Math.random() < dt * 6) { P.pos.x += (Math.random() - 0.5) * van.shake * 0.25; P.pos.z += (Math.random() - 0.5) * van.shake * 0.25; }
    if (!P.onboard) {
      world.collideCircle(P.pos, 0.3, P.pos.y);
      const nr = world.nearestRoad(P.pos.x, P.pos.z);
      if (nr.d > 215) { const k = (nr.d - 215) / nr.d; P.pos.x -= (P.pos.x - nr.px) * k; P.pos.z -= (P.pos.z - nr.pz) * k; }
    }
    if (G.mode === 'gig' && world.crowdPos) for (const c of world.crowdPos) { const dx = P.pos.x - c.x, dz = P.pos.z - c.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 1e-4 && P.pos.y < c.y + 1.2) { P.pos.x = c.x + dx / d * 0.6; P.pos.z = c.z + dz / d * 0.6; } }
    // van body / interior collisions (local space)
    const lp = van.root.worldToLocal(_v3.copy(P.pos));
    if (van.nearLocal(lp)) {
      van.collideLocal(lp, 0.28);
      const w = van.root.localToWorld(lp); P.pos.x = w.x; P.pos.z = w.z;
    }
    // ground: world vs van surfaces
    let g = world.walkH(P.pos.x, P.pos.z, P.pos.y);
    const lp2 = van.root.worldToLocal(_v3.copy(P.pos));
    const ft = van.floorLocal(lp2.x, lp2.z, lp2.y);
    let onVan = false;
    if (ft > -Infinity) { const wy = van.local(lp2.x, ft, lp2.z, _v4).y; if (wy >= g - 0.05) { g = wy; onVan = true; } }
    P.vy -= 22 * dt; P.pos.y += P.vy * dt;
    if (P.pos.y <= g) { P.pos.y = g; P.vy = 0; P.grounded = true; } else if (P.pos.y - g > 0.08) P.grounded = false;
    const inside = van.insideLocal(lp2);
    if (keys.has('Space') && P.grounded) { P.vy = inside ? 4.2 : 6; P.grounded = false; }
    P.onboard = onVan || inside;
    R.group.position.copy(P.pos); R.group.rotation.set(0, P.yaw, 0);
    R.state = 'idle'; R.group.visible = !fp;
    P.bob = (P.bob || 0) + dt * P.speed * 2.2;
  } else if (P.mode === 'seat' || P.mode === 'drive') {
    const s = van.seats[P.seat];
    van.local(s.p[0], s.p[1], s.p[2], _v);
    R.group.position.copy(_v); R.group.quaternion.copy(van.root.quaternion); R.group.rotateY(s.yaw);
    R.state = 'sit'; P.pos.copy(_v); P.onboard = true;
    R.group.visible = !fp || (P.mode === 'drive' && G.chase);
  }
  if (P.mode !== 'gig' && P.mode !== 'practice') R.update(dt, P.speed);
  if (P.mode === 'drive') { R.arms[0].rotation.x = R.arms[1].rotation.x = -1.1; }
  // viewmodel
  if (vm) {
    const atPost = P.mode === 'gig' || P.mode === 'practice';
    vm.visible = fp && (P.mode === 'walk' || atPost) && (G.mode === 'play' || G.mode === 'gig' || G.mode === 'practice');
    const b = P.bob || 0, mv = P.speed > 0 ? 1 : 0;
    vm.position.set(Math.cos(b) * 0.012 * mv, Math.abs(Math.sin(b)) * 0.018 * mv, 0);
    const carry = !!G.carrying;
    const hitK = G.perf ? clamp(1 - (G.perf.tnow() - G.perf.flashT) / 0.18, 0, 1) : 0;
    const groove = G.perf && atPost && !G.perf.isActive(G.role);
    if (vm.inst) { vm.inst.visible = atPost && !groove; vm.inst.position.y = -hitK * 0.012; }
    vm.arms.forEach((a, i) => {
      if (atPost && groove) { const ph = G.perf.beatPos() * Math.PI; a.position.set((i ? 1 : -1) * 0.5, -0.12 + Math.abs(Math.sin(ph)) * 0.07, -0.62); a.rotation.set(0.75, 0, (i ? -1 : 1) * 0.35); }
      else if (atPost && (G.role === 'bass' || G.role === 'guitar')) {
        if (i === 0) { a.position.set(-0.26, -0.3, -0.72); a.rotation.set(-0.15, 0.55, 0.2); }
        else { a.position.set(0.1, -0.4 - hitK * 0.07, -0.56); a.rotation.set(-0.5 - hitK * 0.4, -0.3, 0); }
      }
      else if (atPost && G.role === 'trumpet') { a.position.set(i ? 0.13 : -0.02, -0.3, -0.46 + (i ? 0 : -0.06)); a.rotation.set(-0.25 - (i ? hitK * 0.15 : 0), (i ? -1 : 1) * 0.35, 0); }
      else if (atPost) { a.position.set((i ? 1 : -1) * 0.22, -0.34 - hitK * 0.06 * (i ? 1 : 0.5), -0.48); a.rotation.set(-0.35 - hitK * 0.35, (i ? 1 : -1) * 0.25, 0); }
      else { a.position.set((i ? 1 : -1) * (carry ? 0.17 : 0.3), carry ? -0.27 : -0.36, -0.5); a.rotation.set(0, carry ? (i ? 0.35 : -0.35) : 0, 0); }
    });
  }
}
function lerpAngle(a, b, t) { return a + angDiff(a, b) * Math.min(1, t); }

function updateBots(dt) {
  const beat = G.perf ? G.perf.beatPos() : 0;
  for (const b of bots) {
    const R = b.robot;
    if (b.at === 'van') {
      const s = van.seats[b.seat];
      van.local(s.p[0], s.p[1], s.p[2], _v);
      R.group.position.copy(_v); R.group.quaternion.copy(van.root.quaternion); R.group.rotateY(s.yaw);
      R.state = 'sit';
      if (van.shake > 0.5 && Math.random() < dt * 3) R.setFace('wow', 0.5);
      R.update(dt, 0);
    } else if (b.at === 'venue') {
      const p = R.group.position;
      const gy = world.walkH(b.idle.x, b.idle.z, world.venueY + 2);
      if (p.distanceTo(_v.set(b.idle.x, gy, b.idle.z)) > 30) p.set(b.idle.x, gy, b.idle.z);
      const dx = b.idle.x - p.x, dz = b.idle.z - p.z, d = Math.hypot(dx, dz);
      let sp = 0;
      if (d > 0.3) { sp = 2.4; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; R.group.rotation.set(0, Math.atan2(dx, dz), 0); }
      else {
        b.talkT -= dt;
        const toP = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
        const near = P.pos.distanceTo(p) < 5;
        R.group.rotation.y = lerpAngle(R.group.rotation.y, near ? toP : b.idle.yaw, dt * 3);
        if (b.talkT < 0) { b.talkT = 4 + Math.random() * 6; if (Math.random() < 0.3) b.idle = { x: b.idle.x + (Math.random() - 0.5) * 3, z: b.idle.z + (Math.random() - 0.5) * 3, yaw: Math.random() * 6.28 }; }
      }
      p.y = world.walkH(p.x, p.z, p.y + 0.5);
      if (R.state !== 'cheer' || !G.lastGig) R.state = 'idle';
      R.update(dt, sp);
    } else {
      R.update(dt, 0, beat);
    }
  }
  // trumpet sits on its stand unless someone is holding it
  {
    const tr = G.role === 'trumpet' ? P.robot : (bots.find((b) => b.role === 'trumpet') || {}).robot;
    const held = tr && tr.handheld && tr.handheld.visible && (tr !== P.robot || P.mode === 'gig' || P.mode === 'practice');
    const fpHeld = G.role === 'trumpet' && P.mode === 'gig' && vm && vm.inst && vm.inst.visible;
    if (stageProps.trumpet && stageProps.trumpet.userData.horn) stageProps.trumpet.userData.horn.visible = !(held || fpHeld);
  }
  if (G.perf) {
    const sb = G.perf.songBeat();
    for (const b of bots) if (b.at === 'stage') b.robot.state = G.perf.isActive(b.role, sb) ? 'play' : 'dance';
    if (P.mode === 'gig' || P.mode === 'practice') P.robot.state = G.perf.isActive(G.role, sb) ? 'play' : 'dance';
    if (G.mode === 'gig' && P.mode === 'walk' && P.robot.handheld) P.robot.handheld.visible = true;
    for (const b of [...bots.map((x) => x.robot), P.robot]) if (b.handheld) b.handheld.visible = b.state !== 'dance';
    if (G.mode === 'gig' && P.mode === 'walk' && P.robot.handheld && G.role === 'trumpet') P.robot.handheld.visible = false;
  }
  if (P.mode === 'gig' || P.mode === 'practice') P.robot.update(dt, 0, beat);
  if (P.mode === 'gig' || P.mode === 'practice') P.robot.group.visible = !!G.dbg.third;
  vendor.group.rotation.y = lerpAngle(vendor.group.rotation.y, P.pos.distanceTo(vendor.group.position) < 7 ? Math.atan2(P.pos.x - vendor.group.position.x, P.pos.z - vendor.group.position.z) : world.vendorPose.heading, dt * 3);
  vendor.update(dt, 0);
}

// ---------------------------------------------------------------- update: camera
const fc = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
function updateCamera(dt) {
  camera.up.set(0, 1, 0);
  if (G.dbg.freecam) {
    const sp = (keys.has('ShiftLeft') ? 40 : 12) * dt;
    const f = new THREE.Vector3(Math.sin(fc.yaw) * Math.cos(fc.pitch), Math.sin(fc.pitch), Math.cos(fc.yaw) * Math.cos(fc.pitch));
    const r = new THREE.Vector3(-Math.cos(fc.yaw), 0, Math.sin(fc.yaw));
    if (keys.has('KeyW')) fc.pos.addScaledVector(f, sp); if (keys.has('KeyS')) fc.pos.addScaledVector(f, -sp);
    if (keys.has('KeyD')) fc.pos.addScaledVector(r, sp); if (keys.has('KeyA')) fc.pos.addScaledVector(r, -sp);
    if (keys.has('KeyE')) fc.pos.y += sp; if (keys.has('KeyQ')) fc.pos.y -= sp;
    camera.position.copy(fc.pos); camera.lookAt(_v.copy(fc.pos).add(f)); return;
  }
  if (G.mode === 'title') {
    const t = G.t * 0.12;
    const o = van.spec.orbit;
    camera.position.copy(van.local(Math.sin(t) * o, 3.2, Math.cos(t) * o, _v));
    camera.lookAt(van.local(0, 1.9, 0, _v2)); return;
  }
  if (P.mode === 'gig' && !G.dbg.third) {
    const sp = postSpot();
    const bp = G.perf ? G.perf.beatPos() : 0;
    const groove = G.perf && !G.perf.isActive(G.role);
    const bob = Math.abs(Math.sin(bp * Math.PI)) * (groove ? 0.06 : 0.02);
    const eye = _v.set(sp.x, sp.y + 1.52 + bob, sp.z - 0.22);
    const d = _v2.set(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
    camera.position.copy(eye); camera.lookAt(_v3.copy(eye).add(d));
    return;
  }
  if (P.mode === 'practice' && !G.dbg.third) {
    const sp = practicePost();
    const eye = _v.set(sp.x - Math.sin(sp.yaw) * 0.22, sp.y + 1.52, sp.z - Math.cos(sp.yaw) * 0.22);
    const d = _v2.set(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
    camera.position.copy(eye); camera.lookAt(_v3.copy(eye).add(d)); return;
  }
  if (P.mode === 'drive' && G.chase) {
    const want = van.local(0, van.spec.chase[0], van.spec.chase[1], _v);
    const gh = world.groundH(want.x, want.z) + 1; if (want.y < gh) want.y = gh;
    camera.position.lerp(want, Math.min(1, dt * 4));
    camera.lookAt(van.local(0, 2.4, 2, _v2)); return;
  }
  if (P.mode === 'drive' || P.mode === 'seat') {
    const s = van.seats[P.seat];
    const fwd = 0.08, ex = s.p[0] + Math.sin(s.yaw) * fwd, ez = s.p[2] + Math.cos(s.yaw) * fwd;
    const eye = van.local(ex, s.p[1] + (P.mode === 'drive' ? 1.42 : 1.32), ez - (P.mode === 'drive' ? 0.12 : 0), _v);
    const sh = van.shake * 0.05; eye.x += (Math.random() - 0.5) * sh; eye.y += (Math.random() - 0.5) * sh;
    const yaw = s.yaw + P.drvYaw;
    const d = _v2.set(Math.sin(yaw) * Math.cos(P.drvPitch), Math.sin(P.drvPitch), Math.cos(yaw) * Math.cos(P.drvPitch)).applyQuaternion(van.root.quaternion);
    camera.position.copy(eye);
    camera.up.set(0, 1, 0).applyQuaternion(van.root.quaternion);
    camera.lookAt(_v3.copy(eye).add(d));
    return;
  }
  // first person on foot
  if (!G.dbg.third) {
    const b = P.bob || 0, mv = P.speed > 0 ? 1 : 0;
    const eye = _v.set(P.pos.x, P.pos.y + 1.56 + Math.abs(Math.sin(b)) * 0.035 * mv, P.pos.z);
    const d = _v2.set(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
    camera.position.copy(eye); camera.lookAt(_v3.copy(eye).add(d));
    return;
  }
  // debug third person
  const tgt = _v2.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
  const dist = 4.2, cp = Math.max(0.15, -P.pitch);
  const want = _v.set(tgt.x - Math.sin(P.yaw) * Math.cos(cp) * dist, tgt.y + Math.sin(cp) * dist, tgt.z - Math.cos(P.yaw) * Math.cos(cp) * dist);
  camera.position.copy(want); camera.lookAt(tgt);
}

function bandRobots() { return [{ role: G.role, robot: P.robot }, ...bots.map((b) => ({ role: b.role, robot: b.robot }))]; }
const SHOT_SEQ = ['wide', 'close', 'side', 'close', 'crowd', 'close', 'wide', 'close', 'high', 'close'];
let shotIdx = -1, closeIdx = 0, shotT = 0;
function updateInsetCam(dt) {
  camCut -= dt; shotT += dt;
  if (camCut <= 0 || shotIdx < 0) {
    shotIdx = (shotIdx + 1) % SHOT_SEQ.length; shotT = 0;
    camCut = SHOT_SEQ[shotIdx] === 'close' ? 3.5 + Math.random() * 1.5 : 5 + Math.random() * 2;
    if (SHOT_SEQ[shotIdx] === 'close') closeIdx = (closeIdx + 1) % ROLE_LIST.length;
    cam2.userData.cut = true;
  }
  const st = world.stage, kind = SHOT_SEQ[shotIdx], k = world.venue.camK, kh = Math.min(1, k * 1.4);
  let pos, look;
  if (kind === 'close') {
    const m = bandRobots().find((b) => b.role === ROLE_LIST[closeIdx]).robot.group.position;
    const side = closeIdx % 2 ? 1 : -1, dolly = shotT * 0.08;
    pos = [m.x + side * (0.55 - dolly * 0.5), m.y + 1.55, m.z - 1.75 + dolly];
    look = [m.x, m.y + 1.3, m.z];
    cam2.fov = 42;
  } else if (kind === 'side') { pos = [st.x - 13 * k + shotT * 0.3 * k, st.top + 2.6 * kh, st.z - 11 * k]; look = [st.x, st.top + 1.2, st.z - 1]; cam2.fov = 50; }
  else if (kind === 'crowd') { pos = [st.x + 3 * k - shotT * 0.4 * k, st.top + (k < 0.6 ? 2.6 : 0.6), st.z - 27 * k]; look = [st.x, st.top + 1.8, st.z]; cam2.fov = 45; }
  else if (kind === 'high') { pos = [st.x + 9 * k, st.top + 6 * kh, st.z - 20 * k]; look = [st.x, st.top + 1.4, st.z - 2]; cam2.fov = 50; }
  else { pos = [st.x + Math.sin(G.t * 0.15) * 6 * k, st.top + 3.2 * kh, st.z - 16 * k]; look = [st.x, st.top + 1.4, st.z]; cam2.fov = 52; }
  cam2.updateProjectionMatrix();
  if (cam2.userData.cut) { cam2.position.set(...pos); cam2.userData.cut = false; }
  else cam2.position.lerp(_v.set(...pos), Math.min(1, dt * 2));
  cam2.lookAt(look[0], look[1], look[2]);
  const lbl = $('insetlbl');
  if (lbl) { const t = kind === 'close' ? `${memberName(ROLE_LIST[closeIdx])} · ${ROLES[ROLE_LIST[closeIdx]].name.toUpperCase()}` : 'BAND CAM'; if (lbl.textContent !== t) lbl.textContent = t; }
}
function memberName(role) { return role === G.role ? (G.playerName || 'You').toUpperCase() : ROLES[role].bot; }
function renderInset() {
  const W = post.w, H = post.h;
  const el = $('inset'); if (el._w !== INSET.w) { el.style.width = INSET.w + 'px'; el.style.height = INSET.h + 'px'; el._w = INSET.w; }
  const vp = { x: W - INSET.w - INSET.m, y: H - INSET.h - INSET.m, w: INSET.w, h: INSET.h };
  const vmv = vm ? vm.visible : false, rv = P.robot.group.visible;
  if (vm) vm.visible = false; P.robot.group.visible = true;
  post2.render(scene, cam2, vp);
  if (vm) vm.visible = vmv; P.robot.group.visible = rv;
}
// ---------------------------------------------------------------- interaction raycast
function updateHover() {
  hover = null; hl.visible = false;
  if ((G.mode !== 'play' && G.mode !== 'gig') || G.overlay || G.dbg.freecam) return;
  const list = interactables.filter((i) => i.ok());
  if (!list.length) return;
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  ray.far = P.mode === 'drive' ? 1.8 : G.dbg.third ? 7 : 2.7;
  if (P.mode !== 'walk' && P.mode !== 'drive') return;
  if (P.mode === 'drive' && (G.chase || isClutch())) return;
  const hits = ray.intersectObjects(list.map((i) => i.obj), false);
  for (const h of hits) {
    if (G.dbg.third && h.point.distanceTo(_v.set(P.pos.x, P.pos.y + 1, P.pos.z)) > 3) continue;
    hover = list.find((i) => i.obj === h.object); if (hover) break;
  }
  if (!hover && P.mode === 'walk') {
    // proximity fallback: nearest usable thing in front of the player
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let best = null, bd = P.onboard ? 1.2 : 1.8;
    for (const it of list) {
      it.obj.getWorldPosition(_v3);
      const dx = _v3.x - P.pos.x, dz = _v3.z - P.pos.z, d = Math.hypot(dx, dz);
      if (Math.abs(_v3.y - (P.pos.y + 1)) > 1.6) continue;
      if (d < bd && (d < 0.6 || (dx * fx + dz * fz) / d > 0.2)) { bd = d; best = it; }
    }
    hover = best;
  }
  if (hover) {
    const o = hover.obj, p = o.geometry.parameters;
    o.updateWorldMatrix(true, false);
    hl.matrix.copy(o.matrixWorld).multiply(new THREE.Matrix4().makeScale(p.width * 1.04, p.height * 1.04, p.depth * 1.04));
    hl.matrixWorldNeedsUpdate = true; hl.visible = false;
    hl.material.opacity = 0.6 + Math.sin(G.t * 8) * 0.3;
  }
}
function useHover(btn = 0) { if (hover) { hover.use(btn); return true; } return false; }

// ---------------------------------------------------------------- HUD
let hudT = 0, fpsN = 0, fpsT = 0, fps = 0;
function drawGearbox() {
  const c = $('gearbox'), driving = P.mode === 'drive' && G.mode === 'play' && !G.overlay;
  const show = driving && !G.automatic && (isClutch() || G.shifting);
  c.style.display = show ? 'block' : 'none';
  const lg = $('legend');
  lg.style.display = driving ? 'flex' : 'none';
  if (driving) {
    const cur = van.handbrake ? 'P' : van.gear;
    const gearCol = ['5', '4', '3', '2', '1', 'N', 'R', 'P'].map((g) => `<span class="${g === cur ? 'on' : ''}">${g}</span>`).join('');
    const row = (k, txt, cls = '') => `<div class="lrow ${cls}"><kbd>${k}</kbd>${txt}</div>`;
    const manual = G.automatic ? '' : `${row(clutchName(), 'Hold Clutch', isClutch() ? 'held' : '')}`;
    const shiftRow = G.automatic ? `${row('S', 'Brake / Reverse')}` : `${row(clutchName() + '+🖱', 'Move Gear Stick', G.shifting && isClutch() ? 'held' : '')}${row('⇕', 'Scroll: Gear Up/Down')}`;
    const html = `<div class="gcol">${gearCol}</div><div class="lkeys">${row('R', 'Toggle Engine', van.engineOn ? 'held' : '')}${manual}${row('P', 'Toggle Park', van.handbrake ? 'hot2' : '')}${row('H', 'Lights', van.headlights ? 'held' : '')}${row('K', 'Wipers', van.wipersOn ? 'held' : '')}${row('SPACE', 'Horn', hornSrc ? 'held' : '')}${row('N', 'Radio', van.radioOn ? 'held' : '')}${row('🖱', 'Click controls')}${row('E', 'Exit Vehicle')}${shiftRow}${row('L', 'Clear road (test)')}</div>`;
    if (lg._h !== html) { lg.innerHTML = html; lg._h = html; }
  }
  if (!show) return;
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const r = 16;
  g.fillStyle = 'rgba(235,235,240,0.32)';
  g.beginPath(); g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.fill();
  const X = (x) => W / 2 + x * W * 0.17, Y = (y) => H / 2 - y * H * 0.3;
  g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(-1), Y(0)); g.lineTo(X(1), Y(0));
  for (const x of [-1, 0, 1]) { g.moveTo(X(x), Y(1)); g.lineTo(X(x), Y(-1)); }
  g.stroke();
  g.fillStyle = '#ffffff'; g.font = '18px VT323, monospace'; g.textAlign = 'center';
  for (const [k, x, y] of [['1', -1, 1], ['3', 0, 1], ['5', 1, 1], ['2', -1, -1], ['4', 0, -1], ['R', 1, -1]]) g.fillText(k, X(x), y > 0 ? Y(1) - 8 : Y(-1) + 20);
  g.fillStyle = '#000'; g.beginPath(); g.arc(X(van.knob.x), Y(van.knob.y), 9, 0, 7); g.fill();
}
function updateHUD(dt) {
  drawGearbox();
  toastT -= dt; if (toastT < 0) $('toast').style.opacity = 0;
  fpsN++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  const pr = $('prompt');
  if (hover) {
    pr.innerHTML = `<kbd>${P.mode === 'drive' ? 'CLICK' : 'E'}</kbd>${hover.label()}`; pr.style.opacity = 1;
  } else if (G.mode === 'play' && P.mode === 'walk' && !P.onboard && nearBlocker(3.5)) { pr.innerHTML = '<kbd>E</kbd>Clear the road'; pr.style.opacity = 1; }
  else if (G.mode === 'gig' && P.mode === 'walk' && nearPost()) { pr.innerHTML = '<kbd>E</kbd>Take your post'; pr.style.opacity = 1; }
  else if (G.mode === 'gig' && P.mode === 'walk' && nearFan() >= 0) { pr.innerHTML = '<kbd>E</kbd>High five!'; pr.style.opacity = 1; }
  else if (G.mode === 'gig' && P.mode === 'gig') { pr.innerHTML = '<kbd>E</kbd>Step away'; pr.style.opacity = 0.55; }
  else pr.style.opacity = 0;
  const carry = G.carrying ? `<div>✋ ${ITEMS[G.carrying].name} <small>(G drop${G.carrying === 'oil' ? ' · F drink' : ''})</small></div>` : '';
  $('status').innerHTML = `<div>¢ <b>${G.coins}</b> &nbsp; ★ <b>${G.fans}</b> fans</div>${carry}
    <div>${van.spec.name} ⚡ <b style="color:${van.fuel < 20 ? '#ff5a5a' : '#5ff3ff'}">${Math.round(van.fuel)}%</b>${van.solar > 0.05 ? ' <span style="color:#ffe066">☀</span>' : ''} · 🔧 <b>${Math.round(van.health)}%</b></div>
    ${G.confidence ? `<div>Confidence <b>${Math.round(G.confidence * 100)}%</b></div>` : ''}
    ${G.dbg.fps ? `<div>${fps} fps</div>` : ''}`;
  let help = '';
  if (G.perf) help = '';
  else if (P.mode === 'drive') help = 'W gas · S brake · A/D steer';
  else if (P.mode === 'seat') help = 'E stand up · N radio';
  else help = 'WASD move · SHIFT run · SPACE jump · E interact · G drop · M map · ` debug';
  $('help').textContent = help;
  $('crosshair').style.display = (G.mode === 'play' && !G.overlay) ? 'block' : 'none';
  $('lockhint').style.display = (G.mode !== 'title' && !G.overlay && !document.pointerLockElement && !G.perf) ? 'block' : 'none';
  if (G.dbgOpen) updateDebugReadout();
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.t += dt;
  // van input
  let inp = { throttle: 0, brake: 0, steer: 0, clutch: false };
  if (P.mode === 'drive' && !G.overlay && G.mode === 'play' && !G.dbg.freecam) {
    inp = { throttle: keys.has('KeyW') ? 1 : 0, brake: keys.has('KeyS') ? 1 : 0, steer: (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0), clutch: isClutch() };
  }
  if (P.mode === 'drive' && !G.automatic && van.engineOn && van.rpm > 5900 && !isClutch() && !['N', '5', 'R'].includes(van.gear) && G.t - (G.shiftHintT || -99) > 12) { G.shiftHintT = G.t; toast('Redlining! Hold Q and push the stick (or Q + scroll up) to shift up.'); }
  if (P.mode === 'drive' && G.automatic && inp.throttle > 0) {
    if (van.handbrake && (van.engineOn || van.crank > 0)) { van.handbrake = false; audio.play('shift'); toast('Park released — off we go!'); }
    else if (!van.engineOn && van.crank <= 0 && !G.engHint) { G.engHint = true; toast('The engine is off — press R to start it.'); setTimeout(() => (G.engHint = false), 3000); }
  }
  inp.boost = G.dbg.boost; inp.dbgNoFuel = G.dbg.noFuel;
  inp.solar = clamp(1 - smoothstep(0.55, 0.85, G.tod), 0, 1) * (1 - (G.rainAmt || 0) * 0.92);
  inp.engineVol = G.perf ? 0 : (P.onboard || P.mode === 'drive') ? 1 : clamp(1 - van.pos.distanceTo(camera.position) / 50, 0, 1);
  van.godMode = G.dbg.god; van.automatic = G.automatic;
  inp.grip = 1 - 0.3 * (G.rainAmt || 0);
  inp.playerLocal = P.mode === 'walk' ? van.root.worldToLocal(_v2.copy(P.pos)).clone() : null;
  van.roof.visible = !(G.dbg.third && P.onboard && P.mode === 'walk');
  {
    // model exterior from outside, walk-in shell from inside
    let inside = false;
    if (!G.chase && !G.dbg.third && !G.dbg.freecam && G.mode !== 'title' && !G.perf) {
      const seat = P.seat && van.seats[P.seat];
      if (P.mode === 'drive' || (P.mode === 'seat' && seat && !seat.roof)) inside = true;
      else if (P.mode === 'walk') { const l = van.root.worldToLocal(_v3.copy(camera.position)); inside = Math.abs(l.x) < van.dims.W - 0.02 && l.z > van.dims.ZB && l.z < van.dims.ZF && l.y > van.dims.F - 0.4 && l.y < van.dims.TOP + 0.05; }
    }
    for (const V of Object.values(vehicles)) V.setView(V === van && inside);
  }
  const carry = P.mode === 'walk' && P.onboard && G.mode !== 'title';
  const h0 = van.heading;
  if (carry) P.local = van.root.worldToLocal(_v4.copy(P.pos)).clone();
  van.update(dt, inp);
  if (carry) { P.pos.copy(van.root.localToWorld(P.local)); P.yaw += van.heading - h0; }
  if (G.mode !== 'title') {
    if (!G.dbg.freecam && !G.overlay) updatePlayer(dt); else P.robot.update(dt, 0);
    updateBots(dt);
    if (G.mode === 'play') checkObjectives();
  } else { updatePlayer(dt); updateBots(dt); }
  // time of day
  let tod;
  if (weatherFlags().night) tod = 1;
  else if (G.todOverride !== null) tod = G.todOverride;
  else if (G.obj >= 3) tod = 0.95;
  else {
    const n = world.nearestRoad(van.pos.x, van.pos.z), r = world.legRange[G.leg];
    const prog = clamp((n.s - r[0]) / (r[1] - r[0]), 0, 1);
    tod = 0.06 + [0.9, 0.66, 0.72][G.leg] * prog;
  }
  G.tod = lerp(G.tod, tod, Math.min(1, dt * (G.weather !== 'auto' ? 2.5 : 0.6))); setTOD(G.tod);
  updateWeather(dt);
  world.setNight(smoothstep(0.62, 0.88, G.tod));
  // venue fx
  const nightish = G.tod > 0.6;
  const beat = G.perf ? G.perf.beatPos() : G.t * 1.6;
  const hype = G.perf ? G.perf.hype / 100 : G.mode === 'gig' ? 0.4 : 0.15;
  if (G.perf && G.mode === 'gig') {
    G.mood = lerp(G.mood || 0, G.perf.irritation || 0, Math.min(1, dt * 1.5));
    if (G.mood > 0.6 && !G.moodWarned) { G.moodWarned = true; toast('The crowd is getting irritated — hit those notes!'); }
    if (G.mood < 0.3) G.moodWarned = false;
  } else G.mood = lerp(G.mood || 0, 0, Math.min(1, dt));
  crowd.reserved = G.leg === 0; crowd.warm = G.perf && G.mode === 'gig' ? G.perf.hype / 100 : 0;
  crowd.setMood(G.mood);
  crowd.update(G.t, beat, G.perf && G.mode === 'gig' ? hype : 0.12);
  if (G.perf && G.mode === 'gig') {
    const slot = Math.floor(Math.max(0, G.perf.songBeat()) / 16);
    if (G.mood > 0.6) signs.lowerAll();
    if (G.leg > 0 && G.perf.songBeat() >= 0 && slot !== G.signSlot && G.mood < 0.5) { // nobody at The Rusty Nail knows the band yet
      G.signSlot = slot;
      if (slot % 5 === 0) signs.raise(G.t, 4, G.bandName.toUpperCase(), 'WE ♥ YOU!', 10);
      else { const r = G.signOrder[(slot - Math.floor(slot / 5) - 1) % G.signOrder.length]; signs.raise(G.t, 3, memberName(r), `${ROLES[r].name.toUpperCase()} ♥`, 10); }
    }
  }
  signs.update(dt, G.t, beat, G.perf && G.mode === 'gig' ? hype : 0.2);
  world.stageLights.forEach((l, i) => {
    const on = G.mode === 'gig' || nightish;
    l.beam.visible = on;
    l.beam.material.color.setHSL(((Math.floor(beat) + i) % 6) / 6, 0.9, 0.6);
    l.beam.rotation.z = Math.sin(G.t * 0.8 + i) * 0.35;
    l.beam.material.opacity = (G.mode === 'gig' ? (P.mode === 'gig' ? 0.04 + hype * 0.04 : 0.1 + hype * 0.12) : 0.06) * (1 + Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.6);
  });
  world.spot.intensity = (G.mode === 'gig' ? 140 + Math.sin(beat * Math.PI * 2) * 40 * hype : 60) * [0.5, 1, 2.5][world.venueIdx];
  world.spot.color.setHSL((G.t * 0.05) % 1, 0.7, 0.7);
  world.update(G.t, dt);
  if (hfArm && hfArm.visible) { const k = (G.t - _hf.t) / 0.6; if (k > 1) hfArm.visible = false; else hfArm.scale.setScalar(1 - Math.max(0, k - 0.7) * 3); }
  if (vm && vm.arms && G.t - _hf.t < 0.35) { const k = (G.t - _hf.t) / 0.35; vm.arms[1].position.set(0.2, -0.15 + Math.sin(k * Math.PI) * 0.12, -0.55 - Math.sin(k * Math.PI) * 0.15); vm.arms[1].rotation.set(1.2, 0, -0.2); }
  post.flash = Math.max(0, post.flash - dt * 0.3);
  juke.update();
  if (G.perf) G.perf.update(dt);
  updateCamera(dt);
  updateHover();
  // shadow follow
  const fcs = camera.position;
  sun.target.position.set(Math.round(fcs.x / 2) * 2, Math.round((fcs.y - 4) / 2) * 2, Math.round(fcs.z / 2) * 2); // snapped so shadow edges don't crawl
  sun.position.copy(sun.target.position).addScaledVector(G.sunDir, 140);
  sky.mesh.position.copy(camera.position);
  updateHUD(dt);
  renderer.shadowMap.needsUpdate = true;
  // rear-view mirror: only rendered while someone is in the cab looking forward
  if (P.mode === 'drive' && !G.chase && G.mode === 'play') {
    const vmv = vm ? vm.visible : false, rv = P.robot.group.visible; if (vm) vm.visible = false; P.robot.group.visible = true;
    van.renderCams(renderer, scene);
    if (vm) vm.visible = vmv; P.robot.group.visible = rv;
  }
  post.render(scene, camera);
  const showInset = G.mode === 'gig';
  $('inset').style.display = showInset ? 'block' : 'none';
  if (showInset) { updateInsetCam(dt); renderInset(); }
}

// ---------------------------------------------------------------- input
function lockPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* */ } }
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Backquote' || e.code === 'F2') { toggleDebug(); e.preventDefault(); return; }
  if (G.mode === 'title') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat && G.perf) return;
  keys.add(e.code);
  if (G.overlay === 'editor') return;
  if (G.overlay) { if (e.code === 'Escape' || (G.overlay === 'map' && e.code === 'KeyM')) hideOverlay(); return; }
  if (G.perf) {
    const roaming = G.mode === 'gig' && P.mode === 'walk';
    if (e.code === 'Backspace') abortPerf();
    else if (e.code === 'KeyE' && G.mode === 'gig' && !e.repeat) {
      if (G.atPost) leavePost();
      else if (nearPost()) takePost();
      else { const f = nearFan(); if (f >= 0) highFive(f); else toast('Walk back to your instrument and press E to play.'); }
    }
    else if (!roaming) G.perf.keydown(e.code);
    else if (e.code === 'KeyG') dropItem();
    return;
  }
  if (G.dbg.freecam) return;
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      if (P.mode === 'drive' || P.mode === 'seat') standUp(); else if (!useHover(0) && !P.onboard) { const nb = nearBlocker(3.5); if (nb) clearBlocker(nb); }
      break;
    case 'Space': if (P.mode === 'seat') standUp(); else if (P.mode === 'drive') hornOn(); break;
    case 'KeyV': if (P.mode === 'drive') G.chase = !G.chase; break;
    case 'KeyR': if (P.mode === 'drive') van.ignition(isClutch()); break;
    case 'KeyP': if (P.mode === 'drive') { van.handbrake = !van.handbrake; audio.play('shift'); } break;
    case 'KeyH': if (P.mode === 'drive') { van.headlights = !van.headlights; audio.play('shift'); } break;
    case 'KeyK': if (P.mode === 'drive') { van.wipersOn = !van.wipersOn; audio.play('shift'); } break;
    case 'KeyL': clearAhead(); break;
    case 'KeyG': dropItem(); break;
    case 'KeyQ': if (P.mode !== 'drive' && G.clutchKey !== 'KeyQ') dropItem(); break;
    case 'KeyF': drink(); break;
    case 'KeyM': toggleMap(); break;
    case 'KeyN': if (P.onboard || P.mode === 'drive' || P.mode === 'seat') toggleRadio(); else toast('Get in the vehicle to use the radio.'); break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Space') hornOff(); if (G.perf) G.perf.keyup(e.code); });
window.addEventListener('blur', () => { keys.clear(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let dragging = false;
function onDown(e) {
  if (G.mode === 'title' || G.overlay) return;
  if (!document.pointerLockElement) { lockPointer(); dragging = true; }
  if (G.perf && !(G.mode === 'gig' && P.mode === 'walk')) { if (e.button === 0) G.perf.mouseDown(); return; }
  if (G.mode === 'gig' && P.mode === 'walk') { if (e.button === 0) { if (nearPost()) takePost(); else { const f = nearFan(); if (f >= 0) highFive(f); } } return; }
  if (P.mode === 'drive') {
    if (e.button === 0 && isClutch() && !G.automatic) G.shifting = true;
    else if (e.button === 0) useHover(0);
    return;
  }
  if (P.mode === 'walk' && e.button === 0) useHover(0);
}
canvas.addEventListener('mousedown', onDown);
window.addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) G.shifting = false; if (G.perf && e.button === 0) G.perf.mouseUp(); });
window.addEventListener('mousemove', (e) => {
  if (G.mode === 'title' || G.overlay) return;
  const locked = !!document.pointerLockElement;
  if (!locked && !dragging && !G.perf && !G.shifting) return;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  if (G.perf && G.mode !== 'gig' && G.mode !== 'practice') { G.perf.mouse(dx, dy); return; }
  if (G.mode === 'practice') { if (locked || dragging) { P.yaw -= dx * 0.0024; P.pitch = clamp(P.pitch - dy * 0.0024, -1.2, 1.2); } return; }
  if (G.mode === 'gig' && !locked && !dragging) return;
  if (G.dbg.freecam) { fc.yaw -= dx * 0.0025; fc.pitch = clamp(fc.pitch - dy * 0.0025, -1.4, 1.4); return; }
  if (P.mode === 'drive' && G.shifting) { if (!isClutch()) G.shifting = false; if (isClutch()) van.moveKnob(dx, dy, true); else if (Math.abs(dx) + Math.abs(dy) > 6 && !G.warnedClutch) { G.warnedClutch = 1; toast(`Hold ${clutchName()} (clutch) to move the gear stick.`); setTimeout(() => (G.warnedClutch = 0), 2500); } return; }
  if (P.mode === 'drive' || P.mode === 'seat') { P.drvYaw = clamp(P.drvYaw - dx * 0.0022, -2.3, 2.3); P.drvPitch = clamp(P.drvPitch - dy * 0.0022, -1.15, 0.9); }
  else { P.yaw -= dx * 0.0024; P.pitch = clamp(P.pitch - dy * 0.0024, -1.45, 1.45); }
});

window.addEventListener('wheel', (e) => {
  if (!P || P.mode !== 'drive' || G.automatic || G.overlay) return;
  const now = performance.now(); if (now - (G.wheelT || 0) < 140) return; G.wheelT = now;
  van.stepGear(e.deltaY < 0 ? 1 : -1, isClutch());
}, { passive: true });
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- title
function buildTitle() {
  const el = $('title');
  let pick = 'drums';
  const render = () => {
    el.innerHTML = `<div class="tcard"><h1 id="tband">${G.bandName.toUpperCase()}</h1><h2>ON TOUR · PROTOTYPE</h2>
      <p class="sub">A robot band, a beat-up camper van, and a very long road.</p>
      <div class="names"><label>BAND NAME<input id="inBand" maxlength="24" value="${G.bandName}"></label><label>YOUR NAME<input id="inName" maxlength="14" value="${G.playerName === 'You' ? '' : G.playerName}" placeholder="Player 1"></label></div>
      <p class="sub">Pick your instrument.</p>
      <div class="roles">${ROLE_LIST.map((r) => `<button class="role ${r === pick ? 'on' : ''}" data-r="${r}" style="--c:${ROLES[r].color}"><b>${ROLES[r].name}</b></button>`).join('')}</div>
      <button id="go">START THE TOUR ▶</button>
      <button id="goedit" style="font-size:15px;padding:8px 18px;margin-top:8px;background:#2e2940;">✎ LEVEL EDITOR${customLevel ? ' · custom level loaded' : ''}</button>
      <p class="note">Offline prototype: the other 5 bandmates are bots (multiplayer slots for up to 6). Keyboard + mouse. Press <kbd>\`</kbd> any time for debug tools.<br>Vehicle models via Sketchfab (modified): \"FREE GMC Motorhome reimagined low poly\" by Karol Miklas and \"VW Van\" by jesseroberts (CC BY 4.0); \"Scania Touring (2026)\" by geyges.</p></div>`;
    const keepNames = () => { G.bandName = ($('inBand').value.trim() || 'The Loose Wires'); G.playerName = ($('inName').value.trim() || 'Player 1'); };
    $('inBand').oninput = () => { $('tband').textContent = ($('inBand').value.trim() || 'The Loose Wires').toUpperCase(); };
    el.querySelectorAll('.role').forEach((b) => (b.onclick = () => { keepNames(); pick = b.dataset.r; setupRole(pick, true); render(); }));
    $('goedit').onclick = () => { keepNames(); showEditor(); };
    $('go').onclick = () => {
      keepNames(); van.setBandName(G.bandName); world.setBandName(G.bandName);
      audio.init(); audio.ctx.resume(); ensureStems().catch((e) => console.warn('stems', e)); audio.loadStems(SFX_FILES).catch((e) => console.warn('horn', e));
      el.style.display = 'none'; G.mode = 'play';
      setObj(0, true);
      document.body.classList.add('playing');
      lockPointer();
      toast('Walk in through the van\'s side door, then E at the driver seat. Your first gig is tonight!');
    };
  };
  render();
}

// ---------------------------------------------------------------- debug
function toggleDebug() { G.dbgOpen = !G.dbgOpen; $('debug').classList.toggle('show', G.dbgOpen); if (G.dbgOpen && document.pointerLockElement) document.exitPointerLock(); }
const SECTIONS = {
  start: 0, falls: 0, studio1: 0, bar: 0,
  leg2: 1, rest: 1, studio2: 1, neon: 1,
  leg3: 2, city: 2, studio3: 2, stadium: 2,
};
function placeOnRoad(s) { const p = world.roadPoint(s), rx = -p.tz, rz = p.tx; van.place(p.x + rx * 1.8, p.z + rz * 1.8, Math.atan2(p.tx, p.tz)); }
function teleport(where) {
  if (G.perf) abortPerf();
  hideOverlay();
  if (where in SECTIONS) {
    const leg = SECTIONS[where];
    if (leg !== G.leg || ['start', 'leg2', 'leg3'].includes(where) || G.obj >= 3) startLeg(leg, true);
  }
  van.setGear('N'); van.handbrake = true; van.v = 0;
  const atVenue = () => { const lb = world.loadingBay; van.place(lb.x, lb.z, lb.heading); setObj(3); bandHopOut(true); placePlayerOutsideVan(); };
  const toStudio = (i) => { const sp = world.studios[i].parking; van.place(sp.x, sp.z, sp.heading); G.studio = i; if (G.obj < 2) setObj(2); placePlayerOutsideVan(); };
  if (where === 'falls') { placeOnRoad(world.sFalls - 90); setObj(2); placePlayerOutsideVan(); }
  else if (where === 'studio1') toStudio(0);
  else if (where === 'bar' || where === 'neon' || where === 'stadium') atVenue();
  else if (where === 'rest') { const sp = world.restParking; van.place(sp.x, sp.z, sp.heading); setObj(van.fuel >= 80 ? 2 : 1); placePlayerOutsideVan(); }
  else if (where === 'studio2') toStudio(1);
  else if (where === 'city') { placeOnRoad(world.sNF + (world.length - world.sNF) * 0.3); setObj(2); placePlayerOutsideVan(); }
  else if (where === 'studio3') toStudio(2);
  else if (where === 'backstage') { if (G.obj < 3) atVenue(); const b = world.backstage; P.onboard = false; P.seat = null; P.mode = 'walk'; P.pos.set(b.x - 1.5, world.venueY, b.z - 1.5); P.yaw = Math.PI; P.pitch = 0; }
  else if (where === 'stage') { if (G.obj < 3) atVenue(); const s = world.bandSpots[G.role]; P.onboard = false; P.seat = null; P.mode = 'walk'; P.pos.set(s.x, world.stage.top, s.z - 1.2); P.yaw = Math.PI; P.pitch = -0.1; }
  if (P.mode !== 'drive' && P.mode !== 'seat') P.robot.state = 'idle';
}
function buildDebug() {
  const el = $('debug');
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); refresh(); }; return b; };
  const row = (title, ...kids) => { const d = document.createElement('div'); d.className = 'drow'; const h = document.createElement('label'); h.textContent = title; d.appendChild(h); const w = document.createElement('div'); w.className = 'dk'; kids.forEach((k) => w.appendChild(k)); d.appendChild(w); el.appendChild(d); return d; };
  const check = (label, get, set) => { const l = document.createElement('label'); l.className = 'ck'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => set(i.checked); l.append(i, ' ' + label); l._sync = () => (i.checked = get()); return l; };
  const slider = (label, min, max, step, get, set) => { const l = document.createElement('label'); l.className = 'sl'; const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get(); const s = document.createElement('span'); s.textContent = `${label} ${(+get()).toFixed(2)}`; i.oninput = () => { set(+i.value); s.textContent = `${label} ${(+i.value).toFixed(2)}`; }; l.append(s, i); return l; };
  el.innerHTML = '<div class="dh">DEBUG <small>( ` to close )</small></div>';
  row('Play as', ...ROLE_LIST.map((r) => btn(ROLES[r].name, () => { if (G.perf) abortPerf(); const wasDrive = P.mode; setupRole(r); if (wasDrive === 'drive') { P.mode = 'drive'; } })));
  row('Part 1 · Van', btn('Farm (start)', () => teleport('start')), btn('Waterfall', () => teleport('falls')), btn('Hayloft Studio', () => teleport('studio1')), btn('The Rusty Nail', () => teleport('bar')));
  row('Part 2 · RV', btn('Leave the bar', () => teleport('leg2')), btn('Rest stop', () => teleport('rest')), btn('Practice Studio', () => teleport('studio2')), btn('Neon Falls', () => teleport('neon')));
  row('Part 3 · Bus', btn('Leave Neon Falls', () => teleport('leg3')), btn('City', () => teleport('city')), btn('Chrome Rehearsals', () => teleport('studio3')), btn('The Megadome', () => teleport('stadium')));
  row('Level', btn('Open level editor', () => showEditor()), btn('Reset to default level', () => { if (confirm('Go back to the default layout?')) resetLevel(); }));
  row('Here', btn('Backstage', () => teleport('backstage')), btn('On stage', () => teleport('stage')), btn('Into driver seat', () => { if (G.perf) abortPerf(); sit('driver'); }), btn('Show award', () => { if (G.leg < 2) showAward(); }), btn('Reset road blocks', () => world.resetBlockers()));
  row('Vehicle', btn('Full charge', () => (van.fuel = 100)), btn('Repair', () => (van.health = 100)), btn('Engine on (N)', () => { van.setGear('N'); van.engineOn = true; van.rpm = 900; }), btn('Brake off + 1st', () => { van.handbrake = false; van.setGear('1'); }), btn('Damage -40', () => (van.health = Math.max(0, van.health - 40))), btn('Drain charge', () => (van.fuel = 5)), btn('Flip upright / stop', () => { van.v = 0; van.place(van.pos.x, van.pos.z, van.heading); }));
  row('Items', btn('+50¢', () => (G.coins += 50)), btn('Give cell', () => { consumeItem(); pickUp('cell'); }), btn('Give kit', () => { consumeItem(); pickUp('kit'); }), btn('Give oil', () => { consumeItem(); pickUp('oil'); }));
  row('Show', btn('Start gig now', () => { if (G.perf) abortPerf(); G.dbgAnywhere = true; startGig(); }), btn('Practice now', () => { if (G.perf) abortPerf(); teleport(['studio1', 'studio2', 'studio3'][G.leg]); startPractice(); }), btn('Stop performance', () => abortPerf()), btn('Set default setlist', () => { G.setlist = ['offbeat']; world.drawBoard(world.boardTex.userData.ctx, G.setlist, SETLIST_SONGS); world.boardTex.needsUpdate = true; }), btn('Next objective', () => setObj(Math.min(6, G.obj + 1))));
  const cks = [];
  row('Gearbox', check('Automatic (uncheck for manual H-pattern)', () => G.automatic, (v) => { G.automatic = v; van.setGear('N'); }));
  row('Clutch key', ...[['KeyQ', 'Q'], ['Shift', 'Shift'], ['Space', 'Space'], ['KeyC', 'C']].map(([k, l]) => btn(l, () => { G.clutchKey = k; toast(`Clutch is now ${l}`); })));
  row('Rhythm', cks[cks.length] = check('Autoplay', () => G.dbg.autoplay, (v) => (G.dbg.autoplay = v)), btn('Make crowd irritated', () => { if (G.perf) G.perf.recentMiss = 9; }), check('Bandmates make mistakes', () => G.dbg.botMistakes, (v) => (G.dbg.botMistakes = v)), slider('Hit window ×', 0.5, 3, 0.05, () => G.dbg.windowMult, (v) => (G.dbg.windowMult = v)), slider('Note speed', 250, 800, 10, () => G.dbg.noteSpeed, (v) => (G.dbg.noteSpeed = v)), slider('Audio offset ms (+ = notes later)', -150, 150, 5, () => G.dbg.offsetMs, (v) => (G.dbg.offsetMs = v)));
  const todChk = check('Override', () => G.todOverride !== null, (v) => (G.todOverride = v ? G.tod : null));
  row('Weather', ...[['auto', 'Auto (time of day)'], ['clear', 'Clear day'], ['night', 'Night'], ['rain', 'Rain'], ['storm', 'Rain + Night']].map(([k, l]) => btn(l, () => { G.weather = k; if (k === 'clear') { G.todOverride = 0.15; } else if (k === 'auto') G.todOverride = null; toast(`Weather: ${l}`); })));
  row('Time of day', todChk, slider('Time', 0, 1, 0.01, () => G.tod, (v) => { G.todOverride = v; todChk._sync(); }));
  row('Render', ...[1, 2, 3, 4].map((s) => btn(`Pixel ×${s}`, () => { post.scale = s; resize(); })), cks[cks.length] = check('Dither', () => post.dither, (v) => (post.dither = v)), cks[cks.length] = check('Outlines', () => post.outline, (v) => (post.outline = v)), slider('Colour levels', 3, 32, 1, () => post.levels, (v) => (post.levels = v)), slider('Dither strength', 0, 1.5, 0.05, () => post.ditherAmt, (v) => (post.ditherAmt = v)), slider('FOV', 45, 95, 1, () => camera.fov, (v) => { camera.fov = v; camera.updateProjectionMatrix(); }));
  row('Cheats', check('God mode (no damage)', () => G.dbg.god, (v) => (G.dbg.god = v)), check('Infinite charge', () => G.dbg.noFuel, (v) => (G.dbg.noFuel = v)), slider('Engine power ×', 1, 4, 0.1, () => G.dbg.boost, (v) => (G.dbg.boost = v)));
  row('Camera', check('Third-person (debug)', () => G.dbg.third, (v) => (G.dbg.third = v)), check('Free camera (WASD/QE, mouse)', () => G.dbg.freecam, (v) => { G.dbg.freecam = v; if (v) { fc.pos.copy(camera.position); const d = new THREE.Vector3(); camera.getWorldDirection(d); fc.yaw = Math.atan2(d.x, d.z); fc.pitch = Math.asin(d.y); } }), check('Show FPS', () => G.dbg.fps, (v) => (G.dbg.fps = v)));
  const ro = document.createElement('pre'); ro.id = 'dbgro'; el.appendChild(ro);
  function refresh() { cks.forEach((c) => c._sync && c._sync()); }
}
function updateDebugReadout() {
  const n = world.nearestRoad(van.pos.x, van.pos.z);
  $('dbgro').textContent =
`leg ${G.leg + 1} (${van.type})  mode ${G.mode}/${P.mode}${P.onboard ? ' (onboard)' : ''}  seat ${P.seat || '-'}  obj ${G.obj}
van  ${Math.round(Math.abs(van.v) * 3.6)}km/h  rpm ${Math.round(van.rpm)}  gear ${van.gear}  eng ${van.engineOn ? 'ON' : 'off'}  hb ${van.handbrake ? 'ON' : 'off'}
road ${Math.round(n.s)}/${Math.round(world.length)}m  off ${n.d.toFixed(1)}m  ${van.offroad ? 'OFFROAD' : 'road'}  jolt ${van.jolt.toFixed(2)}
⚡ ${van.fuel.toFixed(1)}  hp ${van.health.toFixed(0)}  tod ${G.tod.toFixed(2)}
player ${P.pos.x.toFixed(1)}, ${P.pos.y.toFixed(1)}, ${P.pos.z.toFixed(1)}
${G.perf ? `perf song ${G.perf.si + 1} hype ${G.perf.hype.toFixed(0)} score ${G.perf.score} combo ${G.perf.combo}` : ''}`;
}

window.__G = G; window.__au = audio; window.__dbg = { fc, get stageProps() { return stageProps; }, forceShot: (i) => { shotIdx = i - 1; camCut = 0; }, get hover() { return hover && hover.label(); }, teleport, startGig, startPractice, abortPerf, get van() { return van; }, vehicles, showEditor, get editor() { return editor; }, checkObjectives, get toastLog() { return toastLog; }, startLeg, setupVenue, get P() { return P; }, get world() { return world; }, sit, standUp, setupRole };
init().catch((e) => { console.error(e); $('loading').textContent = 'Error: ' + e.message; });
