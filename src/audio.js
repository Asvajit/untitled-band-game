export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    // reverb
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.22;
    this.verbSend.connect(this.verb); this.verb.connect(this.master);
    // noise
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // engine
    this.eOsc1 = ctx.createOscillator(); this.eOsc1.type = 'sawtooth';
    this.eOsc2 = ctx.createOscillator(); this.eOsc2.type = 'square';
    this.eFilt = ctx.createBiquadFilter(); this.eFilt.type = 'lowpass'; this.eFilt.frequency.value = 300;
    this.eGain = ctx.createGain(); this.eGain.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.eOsc1.connect(this.eFilt); this.eOsc2.connect(g2); g2.connect(this.eFilt); this.eFilt.connect(this.eGain); this.eGain.connect(this.sfx);
    this.eOsc1.start(); this.eOsc2.start();
    // wind / road noise
    const wn = ctx.createBufferSource(); wn.buffer = nb; wn.loop = true;
    this.wFilt = ctx.createBiquadFilter(); this.wFilt.type = 'lowpass'; this.wFilt.frequency.value = 500;
    this.wGain = ctx.createGain(); this.wGain.gain.value = 0;
    wn.connect(this.wFilt); this.wFilt.connect(this.wGain); this.wGain.connect(this.sfx); wn.start();
    // radio bus (band-limited)
    this.radio = ctx.createGain(); this.radio.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.radio.connect(hp); hp.connect(lp); lp.connect(this.master);
  }
  // fetch early (no context needed), decode once the context exists
  prefetch(files) { this._raw = this._raw || {}; for (const [k, url] of Object.entries(files)) if (!this._raw[k]) this._raw[k] = fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }); }
  async loadStems(files) {
    this.prefetch(files); this.stems = this.stems || {};
    await Promise.all(Object.keys(files).map(async (k) => { if (this.stems[k]) return; const ab = await this._raw[k]; this.stems[k] = await this.ctx.decodeAudioData(ab.slice(0)); }));
    return this.stems;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setEngine(on, rpm, load, vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 18 + rpm / 60 * 1.1;
    this.eOsc1.frequency.setTargetAtTime(f, t, 0.03);
    this.eOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.eFilt.frequency.setTargetAtTime(180 + rpm * 0.16 + load * 500, t, 0.05);
    this.eGain.gain.setTargetAtTime(on ? (0.045 + load * 0.06) * vol : 0, t, 0.06);
  }
  setWind(speed, vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.004) * vol, t, 0.2);
    this.wFilt.frequency.setTargetAtTime(300 + speed * 40, t, 0.2);
  }
  _env(g, t, a, peak, d, sus = 0) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
  }
  noise(t, dur, dest) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.connect(dest); s.start(t, Math.random()); s.stop(t + dur); return s; }
  osc(type, f, t, dur, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  // ---- drums
  kick(t, dest) {
    const c = this.ctx, g = c.createGain(); g.connect(dest);
    const o = this.osc('sine', 150, t, 0.4, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this._env(g, t, 0.002, 1.0, 0.38);
  }
  snare(t, dest) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    f.connect(g); g.connect(dest); this.noise(t, 0.25, f); this._env(g, t, 0.001, 0.7, 0.18);
    const g2 = c.createGain(); g2.connect(dest); const o = this.osc('triangle', 210, t, 0.12, g2); o.frequency.exponentialRampToValueAtTime(140, t + 0.1); this._env(g2, t, 0.001, 0.35, 0.1);
  }
  hat(t, dest, open = false) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200;
    f.connect(g); g.connect(dest); this.noise(t, 0.3, f); this._env(g, t, 0.001, 0.28, open ? 0.25 : 0.05);
  }
  crash(t, dest) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
    f.connect(g); g.connect(dest); this.noise(t, 1.6, f); this._env(g, t, 0.002, 0.32, 1.4);
  }
  // ---- tonal
  bass(t, dest, m, dur) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.25);
    f.connect(g); g.connect(dest);
    this.osc('sawtooth', mtof(m), t, dur, f); this.osc('square', mtof(m - 12), t, dur, f);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.008); g.gain.setTargetAtTime(0.32, t + 0.02, 0.1);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.04);
  }
  trumpet(t, dest, m, dur) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2600, t + 0.05); f.frequency.setTargetAtTime(1500, t + 0.06, 0.1);
    f.connect(g); g.connect(dest); g.connect(this.verbSend);
    const o = this.osc('sawtooth', mtof(m), t, dur, f);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.008, t + 0.25);
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    o.frequency.setValueAtTime(mtof(m) * 0.97, t); o.frequency.linearRampToValueAtTime(mtof(m), t + 0.04);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.035); g.gain.setTargetAtTime(0.2, t + 0.05, 0.1); g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
  }
  chord(t, dest, ms, dur, stab = false) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(stab ? 3200 : 600, t); f.frequency.setTargetAtTime(stab ? 900 : 1800, t, stab ? 0.08 : 0.4);
    f.connect(g); g.connect(dest); g.connect(this.verbSend);
    for (const m of ms) { for (const det of [-8, 8]) { const o = this.osc('sawtooth', mtof(m), t, dur, f); o.detune.value = det; } }
    const pk = stab ? 0.16 : 0.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + (stab ? 0.005 : 0.12));
    g.gain.setTargetAtTime(stab ? 0.0001 : pk * 0.8, t + 0.02, stab ? 0.09 : 0.3); g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
  }
  scratch(t, dest, dir) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    const d = 0.13;
    f.frequency.setValueAtTime(dir > 0 ? 500 : 2600, t); f.frequency.exponentialRampToValueAtTime(dir > 0 ? 2600 : 450, t + d);
    f.connect(g); g.connect(dest);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.setValueAtTime(dir > 0 ? 0.5 : 2, t); s.playbackRate.linearRampToValueAtTime(dir > 0 ? 2 : 0.5, t + d);
    s.connect(f); s.start(t, Math.random()); s.stop(t + d + 0.02);
    const o = this.osc('sawtooth', dir > 0 ? 220 : 640, t, d, f); o.frequency.exponentialRampToValueAtTime(dir > 0 ? 640 : 200, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.01); g.gain.setTargetAtTime(0.0001, t + d - 0.02, 0.02);
  }
  vox(t, dest, m, dur) {
    const c = this.ctx, g = c.createGain(); g.connect(dest); g.connect(this.verbSend);
    const src = c.createGain();
    for (const [fr, q, a] of [[730, 8, 1], [1150, 9, 0.6], [2600, 10, 0.25]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; const bg = c.createGain(); bg.gain.value = a; src.connect(b); b.connect(bg); bg.connect(g); }
    const o = this.osc('sawtooth', mtof(m), t, dur, src);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.012, t + 0.4);
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.06); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  }
  click(t, hi = false) { const g = this.ctx.createGain(); g.connect(this.sfx); this.osc('square', hi ? 1800 : 1200, t, 0.03, g); this._env(g, t, 0.001, 0.12, 0.03); }
  // ---- sfx
  play(name) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, out = this.sfx;
    const g = c.createGain(); g.connect(out);
    switch (name) {
      case 'honk': { this.osc('square', 392, t, 0.5, g); this.osc('square', 494, t, 0.5, g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.02); g.gain.setTargetAtTime(0.0001, t + 0.45, 0.03); break; }
      case 'clunk': { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.connect(g); this.noise(t, 0.3, f); this.osc('sine', 90, t, 0.25, g); this._env(g, t, 0.002, 0.8, 0.25); break; }
      case 'grind': { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 2; f.connect(g); this.noise(t, 0.45, f); const o = this.osc('sawtooth', 70, t, 0.4, g); o.frequency.linearRampToValueAtTime(40, t + 0.4); this._env(g, t, 0.01, 0.35, 0.4); break; }
      case 'shift': { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.connect(g); this.noise(t, 0.08, f); this._env(g, t, 0.001, 0.35, 0.07); break; }
      case 'crank': { for (let i = 0; i < 6; i++) { const gg = c.createGain(); gg.connect(out); this.osc('sawtooth', 55, t + i * 0.11, 0.08, gg); this._env(gg, t + i * 0.11, 0.005, 0.12, 0.08); } g.disconnect(); break; }
      case 'stall': { const o = this.osc('sawtooth', 40, t, 0.5, g); o.frequency.linearRampToValueAtTime(15, t + 0.5); this._env(g, t, 0.005, 0.2, 0.5); break; }
      case 'buy': { [880, 1320].forEach((f, i) => { const gg = c.createGain(); gg.connect(out); this.osc('square', f, t + i * 0.08, 0.1, gg); this._env(gg, t + i * 0.08, 0.002, 0.08, 0.1); }); break; }
      case 'pickup': { const o = this.osc('triangle', 500, t, 0.12, g); o.frequency.linearRampToValueAtTime(900, t + 0.1); this._env(g, t, 0.002, 0.2, 0.12); break; }
      case 'plug': { const o = this.osc('sine', 300, t, 0.5, g); o.frequency.exponentialRampToValueAtTime(1400, t + 0.45); this._env(g, t, 0.01, 0.2, 0.5); break; }
      case 'deny': { this.osc('square', 140, t, 0.18, g); this._env(g, t, 0.002, 0.12, 0.18); break; }
      case 'dud': { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.connect(g); this.osc('sawtooth', 98, t, 0.15, f); this.osc('sawtooth', 104, t, 0.15, f); this._env(g, t, 0.002, 0.3, 0.15); break; }
      case 'door': { const o = this.osc('square', 180, t, 0.12, g); o.frequency.linearRampToValueAtTime(90, t + 0.12); this._env(g, t, 0.002, 0.15, 0.14); break; }
      case 'repair': { for (let i = 0; i < 5; i++) { const gg = c.createGain(); gg.connect(out); this.osc('square', 1400 + Math.random() * 600, t + i * 0.09, 0.03, gg); this._env(gg, t + i * 0.09, 0.001, 0.12, 0.04); } break; }
      case 'drink': { for (let i = 0; i < 3; i++) { const gg = c.createGain(); gg.connect(out); const o = this.osc('sine', 300, t + i * 0.18, 0.12, gg); o.frequency.linearRampToValueAtTime(160, t + i * 0.18 + 0.1); this._env(gg, t + i * 0.18, 0.01, 0.25, 0.12); } break; }
      case 'clap': { for (const d of [0, 0.012]) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2; const gg = c.createGain(); f.connect(gg); gg.connect(out); this.noise(t + d, 0.08, f); this._env(gg, t + d, 0.001, 0.6, 0.07); } break; }
      case 'thump': { this.osc('sine', 70, t, 0.15, g); this._env(g, t, 0.002, 0.4, 0.15); break; }
      default: break;
    }
  }
  cheer(dur = 3, amt = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const bus = c.createGain(); bus.gain.value = 0.9; bus.connect(this.master); bus.connect(this.verbSend);
    // applause: lots of short, individually filtered claps that thin out over time
    const n = Math.round(160 * dur * Math.min(1.5, amt));
    for (let k = 0; k < n; k++) {
      const u = Math.random(); const t = t0 + Math.pow(u, 1.7) * dur;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.4 + Math.random();
      const g = c.createGain(); f.connect(g); g.connect(bus);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.connect(f);
      src.start(t, Math.random() * 1.5); src.stop(t + 0.05);
      const pk = (0.05 + Math.random() * 0.05) * (1 - (t - t0) / (dur * 1.1));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.001, pk), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    }
    // a few "woo"s
    for (let k = 0; k < Math.round(5 * amt); k++) {
      const t = t0 + Math.random() * dur * 0.5, gg = c.createGain(); gg.connect(bus);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; f.connect(gg);
      const o = this.osc('sawtooth', 380 + Math.random() * 200, t, 0.55, f); o.frequency.linearRampToValueAtTime(700 + Math.random() * 300, t + 0.35);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.035, t + 0.06); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    }

  }
}
