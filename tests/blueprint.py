import asyncio, base64
from playwright.async_api import async_playwright
JS = r"""
(() => {
  const THREE = __THREE, PX = 70, PAD = 60;
  const specs = ['van','rv','bus'];
  // collect edge segments in vehicle-local space for a given filter
  function segs(V, keep) {
    const out = []; V.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(V.root.matrixWorld).invert();
    V.root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every((m) => m.visible === false)) return;
      if (!keep(o)) return;
      const eg = new THREE.EdgesGeometry(o.geometry, 25), p = eg.attributes.position;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), v = new THREE.Vector3();
      const isGlass = mats.some((mm) => mm.transparent && mm.opacity < 0.6);
      for (let i = 0; i < p.count; i += 2) {
        const a = v.fromBufferAttribute(p, i).applyMatrix4(m).clone(), b = new THREE.Vector3().fromBufferAttribute(p, i + 1).applyMatrix4(m);
        out.push([a, b, isGlass]);
      }
    });
    return out;
  }
  const inGroup = (o, g) => { for (let p = o; p; p = p.parent) if (p === g) return true; return false; };
  const sheets = [];
  for (const t of specs) {
    const V = __dbg.vehicles[t], S = V.spec;
    V.root.visible = true;
    const ext = segs(V, (o) => !inGroup(o, V.interior) || inGroup(o, V.walls));
    const plan = segs(V, (o) => !inGroup(o, V.roof) && !(o.geometry.parameters && o.geometry.parameters.height < 0.05 && o.position.y > S.TOP - 0.1));
    // bounds
    let b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
    for (const [a, c] of ext) for (const q of [a, c]) { b.x0 = Math.min(b.x0, q.x); b.x1 = Math.max(b.x1, q.x); b.y0 = Math.min(b.y0, q.y); b.y1 = Math.max(b.y1, q.y); b.z0 = Math.min(b.z0, q.z); b.z1 = Math.max(b.z1, q.z); }
    b.y0 = 0;
    const Lm = b.z1 - b.z0, Wm = b.x1 - b.x0, Hm = b.y1 - b.y0;
    const sideW = Math.ceil(Lm + 1) * PX, sideH = Math.ceil(Hm + 1) * PX, planH = Math.ceil(Wm + 1) * PX, frontW = Math.ceil(Wm + 1) * PX;
    const W = PAD * 2 + sideW + 140 + frontW + 60, H = 110 + sideH + 90 + planH + 90;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, W, H);
    const grid = (ox, oy, wm, hm, xm0, ym0) => { // origin in px, metres extents
      for (let x = Math.floor(xm0); x <= xm0 + wm + 0.001; x += 0.5) { g.strokeStyle = Math.abs(x % 1) < 1e-6 ? '#cfd8e6' : '#e6ebf2'; g.lineWidth = 1; g.beginPath(); g.moveTo(ox + (x - xm0) * PX, oy); g.lineTo(ox + (x - xm0) * PX, oy + hm * PX); g.stroke(); }
      for (let y = Math.floor(ym0); y <= ym0 + hm + 0.001; y += 0.5) { g.strokeStyle = Math.abs(y % 1) < 1e-6 ? '#cfd8e6' : '#e6ebf2'; g.beginPath(); g.moveTo(ox, oy + (y - ym0) * PX); g.lineTo(ox + wm * PX, oy + (y - ym0) * PX); g.stroke(); }
    };
    const draw = (list, map) => { for (const [a, b2, glass] of list) { const p1 = map(a), p2 = map(b2); g.strokeStyle = glass ? '#7aa7c7' : '#1d2433'; g.lineWidth = glass ? 1 : 1.1; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); } };
    const dim = (x1, y1, x2, y2, label, vert) => {
      g.strokeStyle = '#c0392b'; g.fillStyle = '#c0392b'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const ah = (x, y, dx, dy) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * 8 - dy * 4, y + dy * 8 + dx * 4); g.lineTo(x + dx * 8 + dy * 4, y + dy * 8 - dx * 4); g.closePath(); g.fill(); };
      const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L; ah(x1, y1, ux, uy); ah(x2, y2, -ux, -uy);
      g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.save(); g.translate((x1 + x2) / 2, (y1 + y2) / 2); if (vert) g.rotate(-Math.PI / 2); g.fillStyle = '#f7f5ee'; const tw = g.measureText(label).width + 8; g.fillRect(-tw / 2, -10, tw, 16); g.fillStyle = '#c0392b'; g.fillText(label, 0, 3); g.restore();
    };
    const label = (txt, x, y, size = 15, col = '#1d2433', align = 'left') => { g.font = `bold ${size}px sans-serif`; g.fillStyle = col; g.textAlign = align; g.fillText(txt, x, y); };
    // title
    label(`${S.name.toUpperCase()}  —  ${t === 'van' ? 'Part 1' : t === 'rv' ? 'Part 2' : 'Part 3'}`, PAD, 38, 24);
    g.font = '13px monospace'; g.fillStyle = '#555'; g.textAlign = 'left';
    g.fillText(`Body ${Lm.toFixed(2)} m long × ${(S.W*2).toFixed(2)} m wide (${Wm.toFixed(2)} m incl. steps/mirrors) × ${Hm.toFixed(2)} m tall · floor ${S.F.toFixed(2)} m · ceiling ${(S.TOP - S.F).toFixed(2)} m · wheelbase ${(S.axleF - S.axleR).toFixed(2)} m · wheel Ø ${(S.wheelR * 2).toFixed(2)} m`, PAD, 60);
    g.fillText('Grid: 1 m (minor 0.5 m) · front of vehicle → right · +x = driver side (left)', PAD, 78);
    // scale bar
    const sbx = W - PAD - 3 * PX, sby = 40; for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#f7f5ee' : '#1d2433'; g.fillRect(sbx + i * PX, sby, PX, 8); } g.strokeStyle = '#1d2433'; g.strokeRect(sbx, sby, 3 * PX, 8);
    g.font = '12px monospace'; g.fillStyle = '#1d2433'; g.textAlign = 'center'; for (let i = 0; i <= 3; i++) g.fillText(`${i} m`, sbx + i * PX, sby + 24);
    // SIDE ELEVATION (driver side, front to the right)
    const sx0 = PAD, sy0 = 110, zm0 = Math.floor(b.z0 * 2) / 2 - 0.5;
    const sideMap = (q) => [sx0 + (q.z - zm0) * PX, sy0 + (Math.ceil(Hm + 0.5) - q.y) * PX];
    grid(sx0, sy0, Math.ceil(Lm + 1), Math.ceil(Hm + 1), zm0, 0);
    label('SIDE ELEVATION (driver side)', sx0, sy0 - 10, 13, '#555');
    draw(ext.filter(([a, c2]) => true), sideMap);
    const gy = sideMap({ z: 0, y: 0 })[1]; g.strokeStyle = '#8a7a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx0, gy); g.lineTo(sx0 + Math.ceil(Lm + 1) * PX, gy); g.stroke();
    dim(sideMap({ z: b.z0, y: 0 })[0], gy + 26, sideMap({ z: b.z1, y: 0 })[0], gy + 26, `${Lm.toFixed(2)} m`);
    dim(sideMap({ z: b.z1, y: 0 })[0] + 26, gy, sideMap({ z: b.z1, y: b.y1 })[0] + 26, sideMap({ z: 0, y: b.y1 })[1], `${Hm.toFixed(2)} m`, true);
    dim(sideMap({ z: S.axleR, y: 0 })[0], gy + 50, sideMap({ z: S.axleF, y: 0 })[0], gy + 50, `wheelbase ${(S.axleF - S.axleR).toFixed(2)} m`);
    // PLAN (top down, roof removed)
    const py0 = sy0 + sideH + 90, xm0 = Math.floor(b.x0 * 2) / 2 - 0.5;
    const planMap = (q) => [sx0 + (q.z - zm0) * PX, py0 + (Math.ceil(Wm + 0.5) + xm0 - q.x) * PX + 0];
    grid(sx0, py0, Math.ceil(Lm + 1), Math.ceil(Wm + 1), zm0, xm0);
    label('PLAN — roof removed (driver side at top)', sx0, py0 - 10, 13, '#555');
    draw(plan, (q) => [sx0 + (q.z - zm0) * PX, py0 + ((Math.ceil(Wm + 1) + xm0) - q.x) * PX]);
    const pm = (x, z) => [sx0 + (z - zm0) * PX, py0 + ((Math.ceil(Wm + 1) + xm0) - x) * PX];
    g.font = '11px monospace'; g.fillStyle = '#2f6e4a'; g.textAlign = 'center';
    for (const [k, s] of Object.entries(S.seats)) { if (s.roof) continue; const [X, Y] = pm(s.p[0], s.p[2]); g.beginPath(); g.arc(X, Y, 4, 0, 7); g.fill(); g.fillText(k, X, Y - 7); }
    const [l0, l1] = [pm(S.W, b.z0), pm(-S.W, b.z0)]; dim(l0[0] - 26, l0[1], l1[0] - 26, l1[1], `${(S.W*2).toFixed(2)} m`, true);
    // FRONT ELEVATION
    const fx0 = sx0 + sideW + 140, fy0 = sy0;
    const frontMap = (q) => [fx0 + (q.x - xm0) * PX, fy0 + (Math.ceil(Hm + 0.5) - q.y) * PX];
    grid(fx0, fy0, Math.ceil(Wm + 1), Math.ceil(Hm + 1), xm0, 0);
    label('FRONT', fx0, fy0 - 10, 13, '#555');
    draw(ext, frontMap);
    g.strokeStyle = '#8a7a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx0, gy); g.lineTo(fx0 + Math.ceil(Wm + 1) * PX, gy); g.stroke();
    dim(frontMap({ x: -S.W, y: 0 })[0], gy + 26, frontMap({ x: S.W, y: 0 })[0], gy + 26, `${(S.W*2).toFixed(2)} m`);
    sheets.push({ t, url: c.toDataURL('image/png') });
    V.root.visible = V === __dbg.van || V.root.visible;
  }
  return sheets;
})()
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':800,'height':600})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function("document.getElementById('loading').style.display==='none'", timeout=180000)
        sheets = await pg.evaluate(JS)
        for s in sheets: open(f"shots/blueprint_{s['t']}.png",'wb').write(base64.b64decode(s['url'].split(',')[1]))
        print(errs); await b.close()
asyncio.run(main())
