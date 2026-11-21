import * as THREE from 'three';

const gm = new Uint8Array([72, 72, 72, 255, 165, 165, 165, 255, 255, 255, 255, 255]);
export const gradientMap = new THREE.DataTexture(gm, 3, 1, THREE.RGBAFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

const cache = new Map();
export function toon(color, opts) {
  if (!opts) {
    const k = String(color);
    if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color, gradientMap }));
    return cache.get(k);
  }
  return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
}
export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

export function canvasTex(w, h, draw, nearest = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.userData.canvas = c; t.userData.ctx = g;
  return t;
}

export function neonTex(lines, { w = 512, h = 128, color = '#ff5fd2', font = 'Bungee', size = 64, bg = null, border = false } = {}) {
  if (typeof lines === 'string') lines = [lines];
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 16; g.strokeRect(10, 10, w - 20, h - 20); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = h / lines.length;
    lines.forEach((ln, i) => {
      const s = Array.isArray(size) ? size[i] : size;
      let fs = s; g.font = `${fs}px ${font}, Impact, sans-serif`;
      while (fs > 10 && g.measureText(ln).width > w * 0.92) { fs -= 2; g.font = `${fs}px ${font}, Impact, sans-serif`; }
      g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color;
      g.fillText(ln, w / 2, lh * (i + 0.5));
      g.shadowBlur = 0; g.fillStyle = '#fff6fb';
      g.globalAlpha = 0.55; g.fillText(ln, w / 2, lh * (i + 0.5)); g.globalAlpha = 1;
    });
  }, false);
}

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
const POST_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float near; uniform float far;
uniform float uDither; uniform float uOutline; uniform float uLevels; uniform float uFlash; uniform float uDitherAmt;
varying vec2 vUv;
float lin(float d){ float z = d*2.0-1.0; return (2.0*near*far)/(far+near-z*(far-near)); }
float bayer(vec2 p){
  int x = int(mod(p.x,4.0)); int y = int(mod(p.y,4.0));
  int i = x + y*4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i]/16.0 - 0.5;
}
void main(){
  vec2 px = 1.0/res;
  vec3 c = texture2D(tColor, vUv).rgb;
  if(uOutline > 0.5){
    float d = lin(texture2D(tDepth, vUv).r);
    float d1 = lin(texture2D(tDepth, vUv+vec2(px.x,0.)).r);
    float d2 = lin(texture2D(tDepth, vUv+vec2(0.,px.y)).r);
    float d3 = lin(texture2D(tDepth, vUv-vec2(px.x,0.)).r);
    float d4 = lin(texture2D(tDepth, vUv-vec2(0.,px.y)).r);
    float e = max(max(d1-d, d2-d), max(d3-d, d4-d));
    float edge = step(0.045*d + 0.04, e) * (1.0 - smoothstep(70.0, 160.0, d));
    c = mix(c, c*0.22 + vec3(0.02,0.015,0.04), edge*0.9);
  }
  c = pow(max(c, vec3(0.0)), vec3(1.0/2.2));
  // warm grade
  c = mix(c, c*vec3(1.05,0.98,0.92), 0.5);
  vec2 q = vUv - 0.5; c *= 1.0 - dot(q,q)*0.55;
  c += vec3(uFlash);
  if(uDither > 0.5){
    vec2 p = floor(vUv*res);
    float n = fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5;  // interleaved gradient noise: no visible tiles
    c = floor(c*uLevels + 0.5 + n*uDitherAmt) / uLevels;
  }
  gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.scale = 2; this.dither = true; this.outline = true; this.levels = 18; this.ditherAmt = 0.7; this.flash = 0;
    const dt = new THREE.DepthTexture(4, 4);
    dt.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, depthBuffer: true, depthTexture: dt });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, res: { value: new THREE.Vector2(4, 4) },
        near: { value: 0.1 }, far: { value: 900 }, uDither: { value: 1 }, uOutline: { value: 1 }, uLevels: { value: 9 }, uFlash: { value: 0 }, uDitherAmt: { value: 0.7 },
      },
      vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    const sw = Math.max(1, Math.floor(w / this.scale)), sh = Math.max(1, Math.floor(h / this.scale));
    this.rt.setSize(sw, sh);
    this.mat.uniforms.res.value.set(sw, sh);
  }
  render(scene, camera, vp = null) {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.render(scene, camera);
    r.setRenderTarget(null);
    if (vp) { r.setViewport(vp.x, vp.y, vp.w, vp.h); r.setScissor(vp.x, vp.y, vp.w, vp.h); r.setScissorTest(true); }
    const u = this.mat.uniforms;
    u.near.value = camera.near; u.far.value = camera.far;
    u.uDither.value = this.dither ? 1 : 0; u.uDitherAmt.value = this.ditherAmt; u.uOutline.value = this.outline ? 1 : 0; u.uLevels.value = this.levels;
    u.uFlash.value = this.flash;
    r.render(this.scene, this.cam);
    if (vp) { r.setScissorTest(false); r.setViewport(0, 0, this.fullW || this.w, this.fullH || this.h); }
  }
}

export class Sky {
  constructor(scene) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, stars: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float y = vP.y; vec3 c = y>0. ? mix(hor, top, pow(clamp(y,0.,1.),0.6)) : mix(hor, bot, clamp(-y*4.,0.,1.));
          float s = max(dot(vP, normalize(sunDir)),0.); c += sunCol*(pow(s,600.)*3.0 + pow(s,12.)*0.35);
          vec3 q = floor(vP*220.); float st = step(0.997, h(q)) * stars * smoothstep(0.05,0.4,y); c += vec3(st);
          gl_FragColor = vec4(c,1.); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), this.mat);
    this.mesh.renderOrder = -10; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
}
