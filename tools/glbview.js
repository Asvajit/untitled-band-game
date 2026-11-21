import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1);
window.run = async (url, k = 1) => {
  const gltf = await new GLTFLoader().loadAsync(url); const root = gltf.scene; root.scale.setScalar(k); root.updateMatrixWorld(true); { const b0 = new THREE.Box3().setFromObject(root); root.position.y = -b0.min.y - 1.5575 * (k === 1 ? 1 : 0) ; if (k !== 1) root.position.y = -b0.min.y; root.updateMatrixWorld(true); }
  const info = []; root.traverse((o) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); info.push([o.name, o.material.name, b.min.toArray().map((v) => +v.toFixed(2)), b.max.toArray().map((v) => +v.toFixed(2))]); } });
  const bb = new THREE.Box3().setFromObject(root);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7f5ee'); scene.add(root);
  scene.add(new THREE.HemisphereLight('#fff', '#998', 2.2)); const d = new THREE.DirectionalLight('#fff', 2); d.position.set(3, 6, 4); scene.add(d);
  const grid = new THREE.GridHelper(20, 20, '#c0392b', '#9aa'); scene.add(grid);
  const out = {};
  const shot = (name, pos, up, w, h, gridRot) => { grid.rotation.set(...gridRot); const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100); cam.position.set(...pos); cam.up.set(...up); cam.lookAt(0, pos[1] === 30 ? 0 : 1.5, 0); if (pos[1] !== 30) { cam.position.y = 1.5; cam.lookAt(pos[0] ? 0 : 0, 1.5, 0); } renderer.setSize(w * 100, h * 100); renderer.render(scene, cam); out[name] = renderer.domElement.toDataURL('image/png'); };
  shot('left', [30, 1.5, 0], [0, 1, 0], 12, 5, [0, 0, Math.PI / 2]);
  shot('right', [-30, 1.5, 0], [0, 1, 0], 12, 5, [0, 0, Math.PI / 2]);
  shot('top', [0, 30, 0], [1, 0, 0], 12, 5, [0, 0, 0]);
  shot('front', [0, 1.5, 30], [0, 1, 0], 6, 5, [Math.PI / 2, 0, 0]);
  shot('back', [0, 1.5, -30], [0, 1, 0], 6, 5, [Math.PI / 2, 0, 0]);
  return { info, bb: [bb.min.toArray(), bb.max.toArray()], out };
};
window.ready = true;
