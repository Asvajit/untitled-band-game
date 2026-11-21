import { ROLE_LIST, ROLES } from './robot.js';
import { SONG } from './song.js';
import { clamp } from './util.js';

export const HIT_KEYS = ['Space', 'Enter'];

// One-button rhythm performance over the real song stems.
export class Performance {
  constructor(o) {
    Object.assign(this, o); // audio, buffers, role, mode, confidence, hypeStart, dbg, onEvent, canvas
    this.g = this.canvas.getContext('2d');
    this.spb = 60 / SONG.bpm;
    const practice = this.mode === 'practice';
    this.startBeat = practice ? 3 * 32 : 0;
    this.endBeat = practice ? 4 * 32 : SONG.bars * 4;
    this.notes = {};
    for (const r of ROLE_LIST) {
      const part = SONG.parts[r], arr = [];
      for (const s of part.sections) for (const [b, d] of part.chart) {
        const beat = s * 32 + b;
        const buf = this.buffers[r], lim = buf ? buf.duration / this.spb - 0.25 : Infinity;
        if (beat >= this.startBeat && beat < this.endBeat && beat < lim) arr.push({ b: beat - this.startBeat, d, judged: false });
      }
      arr.sort((a, c) => a.b - c.b);
      this.notes[r] = arr;
    }
    this.hype = this.hypeStart ?? 40; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.stats = { perfect: 0, good: 0, ok: 0, miss: 0, total: 0 };
    this.bot = {}; ROLE_LIST.forEach((r) => (this.bot[r] = { hit: 0, total: 0, last: 1, ptr: 0 }));
    this.popups = []; this.botQ = []; this.done = false; this.missUntil = 0; this.flashT = -9; this.grooveT = -9;
    const ctx = this.audio.ctx;
    this.out = ctx.createGain(); this.out.connect(this.audio.music);
    this.gains = {}; this.srcs = [];
    const now = ctx.currentTime;
    this.t0 = now + 0.5 + 4 * this.spb;
    for (let k = 0; k < 4; k++) this.audio.click(this.t0 - (4 - k) * this.spb, k === 0);
    for (const r of ROLE_LIST) {
      const g = ctx.createGain(); g.connect(this.out); this.gains[r] = g;
      const buf = this.buffers[r];
      if (practice && r !== this.role) continue; // practice: hear only your own part
      if (buf) {
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(g);
        src.start(this.t0, this.startBeat * this.spb, (this.endBeat - this.startBeat) * this.spb + 0.5);
        this.srcs.push(src);
      }
    }
    for (const r of ROLE_LIST) this.notes[r].forEach((n) => { n.t = this.t0 + n.b * this.spb; });
    this.jp = 0;
    this.endT = this.t0 + (this.endBeat - this.startBeat) * this.spb + 0.6;
    this.metro = practice; this.nextClick = this.t0;
    this.onEvent('songStart', { title: SONG.title });
  }
  // audible time: what the listener hears right now (output latency + manual offset)
  tnow() { const c = this.audio.ctx; return c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0) - (this.dbg.offsetMs || 0) / 1000; }
  get wm() { return (1 + 0.2 * (this.confidence || 0)) * (this.dbg.windowMult || 1); }
  get missWin() { return 0.17 * this.wm; }
  beatPos() { return (this.tnow() - this.t0) / this.spb; }
  songBeat() { return this.beatPos() + this.startBeat; }
  sectionAt(beat) { return clamp(Math.floor(Math.max(0, beat) / 32), 0, SONG.sections.length - 1); }
  isActive(role, beat = this.songBeat()) {
    if (this.mode === 'practice') return role === this.role;
    return SONG.parts[role].sections.includes(this.sectionAt(beat));
  }
  botAcc(r) { return this.dbg.botMistakes ? 0.93 : 1; }
  popup(text, col) { this.popups.push({ text, col, t: this.tnow() }); }
  judge(n, dt, forceMiss = false) {
    if (n.judged) return;
    n.judged = true;
    const ad = Math.abs(dt), wm = this.wm;
    let res;
    if (forceMiss || ad > this.missWin) res = 'miss';
    else if (ad < 0.06 * wm) res = 'perfect';
    else if (ad < 0.12 * wm) res = 'good';
    else res = 'ok';
    this.stats.total++; this.stats[res]++;
    if (res === 'miss') {
      this.combo = 0; this.hype = clamp(this.hype - 3, 0, 100); this.recentMiss = (this.recentMiss || 0) + 1;
      this.missUntil = this.tnow() + 0.4; this.missUntilRaw = this.audio.now + 0.4;
      if (this.atPost !== false) { this.audio.play('dud'); this.popup('MISS', '#ff5a5a'); this.onEvent('miss', {}); }
    } else {
      n.hit = true;
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const mult = Math.min(4, 1 + Math.floor(this.combo / 10));
      this.score += { perfect: 100, good: 60, ok: 30 }[res] * mult;
      this.hype = clamp(this.hype + (res === 'perfect' ? 1.6 : 1.1), 0, 100);
      this.popup(res === 'ok' ? (dt > 0 ? 'EARLY' : 'LATE') : res.toUpperCase(), res === 'perfect' ? '#a8ff7a' : res === 'good' ? '#5ff3ff' : '#ffe066');
      this.flashT = this.tnow();
      this.onEvent('hit', { res });
    }
  }
  press() {
    if (this.done) return;
    const now = this.tnow(), arr = this.notes[this.role], mw = this.missWin;
    if (this.atPost === false) {
      if (!this.isActive(this.role)) { this.grooveT = now; this.hype = clamp(this.hype + 0.4, 0, 100); this.onEvent('grooveMove', {}); }
      else this.popup('GET TO YOUR POST!', '#ff5a5a');
      return;
    }
    let best = null, bd = Infinity;
    for (let i = this.jp; i < arr.length; i++) {
      const n = arr[i]; if (n.t > now + mw) break;
      if (n.judged) continue;
      const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; }
    }
    if (best && bd < mw) { this.judge(best, best.t - now); return; }
    if (!this.isActive(this.role)) { this.grooveT = now; this.hype = clamp(this.hype + 0.4, 0, 100); this.onEvent('grooveMove', {}); }
  }
  keydown(code) { if (HIT_KEYS.includes(code)) { this.down = (this.down || new Set()); if (!this.down.has(code)) { this.down.add(code); this.press(); } } }
  keyup(code) { if (this.down) this.down.delete(code); }
  mouseDown() { this.mdown = true; this.press(); }
  mouseUp() { this.mdown = false; }
  get holding() { return this.mdown || (this.down && this.down.size > 0); }
  mouse() {}
  update() {
    if (this.done) return;
    const raw = this.audio.now, now = this.tnow();
    const dtm = this.lastU ? Math.min(0.1, raw - this.lastU) : 0; this.lastU = raw;
    this.recentMiss = (this.recentMiss || 0) * Math.exp(-dtm / 5);
    this.irritation = clamp(Math.max((this.recentMiss - 2) / 5, (22 - this.hype) / 22), 0, 1);
    // bots
    for (const r of ROLE_LIST) {
      if (r === this.role) continue;
      const arr = this.notes[r], b = this.bot[r];
      if (this.mode === 'practice') continue;
      while (b.ptr < arr.length && arr[b.ptr].t < raw + 0.1) {
        const n = arr[b.ptr++];
        const hit = Math.random() < this.botAcc(r);
        b.total++; if (hit) b.hit++;
        const t = Math.max(n.t, raw + 0.005);
        if (!hit) { const g = this.gains[r].gain; g.setTargetAtTime(0.08, t, 0.01); g.setTargetAtTime(1, t + 0.35, 0.05); }
        this.botQ.push({ t, r, hit });
      }
    }
    this.botQ.sort((a, c) => a.t - c.t);
    while (this.botQ.length && this.botQ[0].t <= raw) {
      const e = this.botQ.shift();
      this.hype = clamp(this.hype + (e.hit ? 0.15 : -0.8), 0, 100);
      this.bot[e.r].last = e.hit ? 1 : 0;
      this.onEvent('bot', e);
    }
    // player
    const arr = this.notes[this.role];
    for (let i = this.jp; i < arr.length; i++) {
      const n = arr[i]; if (n.t > now + 0.2) break;
      if (n.judged) continue;
      if (this.dbg.autoplay && now >= n.t && this.atPost !== false) { this.judge(n, 0); continue; }
      if (now > n.t + this.missWin) this.judge(n, 0, true);
    }
    while (this.jp < arr.length && arr[this.jp].judged) this.jp++;
    const away = this.atPost === false;
    this.gains[this.role].gain.setTargetAtTime(away ? 0 : raw < (this.missUntilRaw || 0) ? 0.12 : 1, raw, away ? 0.03 : 0.015);
    if (this.metro) { while (this.nextClick < raw + 0.12 && this.nextClick < this.endT) { const bi = Math.round((this.nextClick - this.t0) / this.spb); this.audio.click(this.nextClick, bi % 4 === 0); this.nextClick += this.spb; } }
    if (now > this.endT) { this.finish(); return; }
    this.popups = this.popups.filter((p) => now - p.t < 0.7);
    this.render();
  }
  finish() {
    this.done = true;
    const s = this.stats;
    const acc = s.total ? (s.perfect + s.good * 0.75 + s.ok * 0.45) / s.total : 0;
    const bots = {}; ROLE_LIST.forEach((r) => { if (r !== this.role) bots[r] = this.bot[r].total ? this.bot[r].hit / this.bot[r].total : 1; });
    const stars = acc >= 0.9 ? 5 : acc >= 0.78 ? 4 : acc >= 0.62 ? 3 : acc >= 0.45 ? 2 : 1;
    this.clear();
    this.onEvent('finish', { acc, score: this.score, maxCombo: this.maxCombo, hype: this.hype, stats: s, bots, stars });
  }
  stop() {
    this.done = true;
    const t = this.audio.now;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { this.srcs.forEach((s) => { try { s.stop(); } catch (e) { /* */ } }); try { this.out.disconnect(); } catch (e) { /* */ } }, 400);
    this.clear();
  }
  clear() { this.g.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  // ---------------- drawing ----------------
  render() {
    const c = this.canvas, g = this.g, W = c.width, H = c.height, now = this.tnow();
    g.clearRect(0, 0, W, H);
    const sb = this.songBeat(), secName = SONG.sections[this.sectionAt(sb)];
    const TX = this.mode === 'gig' ? Math.max(250, (W - (this.insetW || 0) - 28) / 2 + 60) : W / 2;
    g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 6;
    g.font = '28px VT323, monospace'; g.fillStyle = '#fff';
    g.fillText(`${this.mode === 'practice' ? `PRACTICE (${ROLES[this.role].name.toUpperCase()} SOLO + CLICK) — ` : ''}${SONG.title.toUpperCase()} · ${SONG.bpm} BPM · ${secName}`, TX, 40);
    const prog = clamp((now - this.t0) / (this.endT - this.t0), 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(TX - 220, 52, 440, 6);
    // section ticks
    const nSec = (this.endBeat - this.startBeat) / 32;
    for (let k = 1; k < nSec; k++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(TX - 220 + (440 * k * 32) / (this.endBeat - this.startBeat), 50, 2, 10); }
    g.fillStyle = '#ff6ad5'; g.fillRect(TX - 220, 52, 440 * prog, 6);
    g.shadowBlur = 0;
    if (now < this.t0) {
      const k = Math.ceil((this.t0 - now) / this.spb);
      g.font = '96px Bungee, Impact, sans-serif'; g.fillStyle = '#ffe066'; g.fillText(String(Math.min(4, k)), W / 2, H * 0.3);
      g.font = '26px VT323, monospace'; g.fillStyle = '#fff'; g.fillText('Press SPACE (or click) as each note hits the ring', W / 2, H * 0.3 + 50);
    }
    if (this.atPost === false) { this.drawAway(g, W, H, now, sb); return; }
    this.drawHighway(g, W, H, now, sb);
    this.drawSide(g, W, H);
  }
  drawAway(g, W, H, now, sb) {
    const active = this.isActive(this.role, Math.max(0, sb));
    let soon = active;
    if (!soon) { let nb = Math.ceil(Math.max(0, sb) / 32) * 32; while (nb < this.endBeat && !SONG.parts[this.role].sections.includes(nb / 32)) nb += 32; soon = nb < this.endBeat && nb - sb <= 8; }
    g.textAlign = 'center';
    if (soon && now >= this.t0 - 4 * this.spb) {
      const blink = Math.sin(now * 10) > -0.3;
      g.font = '44px Bungee, Impact, sans-serif'; g.fillStyle = blink ? '#ff5a5a' : '#ffb347';
      g.shadowColor = '#000'; g.shadowBlur = 10; g.fillText(active ? 'YOUR PART! GET TO YOUR POST!' : 'YOUR PART IS COMING IN!', W / 2 - (this.insetW || 0) / 3, H * 0.3);
      g.font = '24px VT323, monospace'; g.fillStyle = '#fff'; g.fillText('walk to your instrument and press E', W / 2 - (this.insetW || 0) / 3, H * 0.3 + 34); g.shadowBlur = 0;
    }
    g.font = '20px VT323, monospace'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'left';
    g.fillText(`OFF STAGE · ${ROLES[this.role].name.toUpperCase()} MUTED · SPACE jump · E high five`, 20, H - 20);
  }
  drawHighway(g, W, H, now, sb) {
    const cx = this.mode === 'gig' ? 160 : W * 0.5, lw = 120;
    const top = this.mode === 'gig' ? 150 : H * 0.12, hitY = H * 0.8, speed = this.dbg.noteSpeed || 380;
    g.fillStyle = 'rgba(10,8,16,0.5)'; g.fillRect(cx - lw / 2, top, lw, H - top - 60);
    // beat lines + section labels
    const bp = this.beatPos();
    for (let b = Math.ceil(bp); b < bp + 12; b++) {
      const y = hitY - (b - bp) * this.spb * speed; if (y < top) break;
      const sbeat = b + this.startBeat;
      const bar = sbeat % 4 === 0, sec = sbeat % 32 === 0;
      g.fillStyle = sec ? 'rgba(255,106,213,0.8)' : bar ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
      g.fillRect(cx - lw / 2, y, lw, sec ? 3 : bar ? 2 : 1);
      if (sec && sbeat / 32 < SONG.sections.length) { g.font = '18px VT323, monospace'; g.textAlign = 'left'; g.fillStyle = '#ff9ae6'; g.fillText(SONG.sections[sbeat / 32], cx + lw / 2 + 8, y + 5); }
    }
    const col = ROLES[this.role].color;
    // notes (held notes keep their line running through the ring until the note ends)
    const arr = this.notes[this.role];
    const top0 = Math.max(top, 0);
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      const y = hitY - (n.t - now) * speed;
      if (y < top - 40) break;
      const tEnd = n.t + n.d * this.spb, ye = hitY - (tEnd - now) * speed;
      const long = n.d >= 0.5;
      if (n.judged && (!n.hit || !long || now > tEnd)) continue;
      if (!n.judged && y > H) continue;
      if (long) {
        const yHead = n.hit ? hitY : y;
        const yTop = Math.max(top0, ye);
        if (yHead > yTop) {
          const lit = n.hit && (this.holding || this.dbg.autoplay);
          g.fillStyle = col; g.globalAlpha = n.hit ? (lit ? 0.95 : 0.4) : 0.55;
          g.fillRect(cx - 11, yTop, 22, yHead - yTop);
          g.fillStyle = '#ffffff'; g.globalAlpha = lit ? 0.6 : 0.25; g.fillRect(cx - 3, yTop, 6, yHead - yTop);
          g.globalAlpha = 1;
          if (ye >= top0) { g.fillStyle = col; g.beginPath(); g.ellipse(cx, ye, 14, 7, 0, 0, 7); g.fill(); }
          if (lit) { g.globalAlpha = 0.5 + Math.random() * 0.3; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, hitY, 30, 15, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
        }
      }
      if (n.judged) continue;
      g.fillStyle = col; g.beginPath(); g.ellipse(cx, y, 34, 17, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(cx, y - 4, 18, 6, 0, 0, 7); g.fill();
    }
    // hit ring
    const fl = clamp(1 - (now - this.flashT) / 0.15, 0, 1);
    g.strokeStyle = col; g.lineWidth = 5; g.globalAlpha = 0.65 + fl * 0.35;
    g.beginPath(); g.ellipse(cx, hitY, 38, 20, 0, 0, 7); g.stroke();
    if (fl > 0) { g.fillStyle = col; g.globalAlpha = fl * 0.6; g.fill(); }
    g.globalAlpha = 1; g.textAlign = 'center';
    g.fillStyle = '#fff'; g.font = '22px VT323, monospace'; g.fillText('SPACE / CLICK', cx, hitY + 50);
    // groove
    const active = this.isActive(this.role, Math.max(0, sb));
    if (now >= this.t0 && !active) {
      const pulse = 1 + Math.abs(Math.sin(this.beatPos() * Math.PI)) * 0.12 + clamp(1 - (now - this.grooveT) / 0.3, 0, 1) * 0.25;
      const gx = this.mode === 'gig' ? Math.max(cx, 230) : cx;
      g.save(); g.translate(gx, H * 0.45); g.scale(pulse, pulse);
      g.font = '58px Bungee, Impact, sans-serif'; g.fillStyle = '#ffe066'; g.shadowColor = '#ff6ad5'; g.shadowBlur = 18;
      g.fillText('GROOVE!', 0, 0); g.restore();
      g.font = '22px VT323, monospace'; g.fillStyle = '#fff'; if (this.mode === 'gig') { g.fillText('dance · SPACE to hype', gx, H * 0.45 + 40); g.fillText('E to roam the stage', gx, H * 0.45 + 64); } else g.fillText('hands up & dance — tap SPACE to hype the crowd', gx, H * 0.45 + 40);
      // next entry
      let nb = Math.ceil(Math.max(0, sb) / 32) * 32;
      while (nb < this.endBeat && !SONG.parts[this.role].sections.includes(nb / 32)) nb += 32;
      const bars = Math.ceil((nb - sb) / 4);
      if (nb < this.endBeat && bars <= 4) { g.fillStyle = '#5ff3ff'; g.font = '26px Bungee, Impact, sans-serif'; g.fillText(`GET READY · ${bars} BAR${bars > 1 ? 'S' : ''}`, gx, H * 0.45 + 80); }
    }
    if (this.atPost === false && now >= this.t0 - 4 * this.spb) {
      let soon = active;
      if (!soon) { let nb = Math.ceil(Math.max(0, sb) / 32) * 32; while (nb < this.endBeat && !SONG.parts[this.role].sections.includes(nb / 32)) nb += 32; soon = nb < this.endBeat && nb - sb <= 8; }
      if (soon) {
        const blink = Math.sin(now * 10) > -0.3;
        g.textAlign = 'center'; g.font = '44px Bungee, Impact, sans-serif'; g.fillStyle = blink ? '#ff5a5a' : '#ffb347';
        g.shadowColor = '#000'; g.shadowBlur = 10; g.fillText(active ? 'YOUR PART! GET TO YOUR POST!' : 'YOUR PART IS COMING IN!', W / 2, H * 0.3);
        g.font = '24px VT323, monospace'; g.fillStyle = '#fff'; g.fillText('walk to your spot and press E', W / 2, H * 0.3 + 34); g.shadowBlur = 0;
      }
    }
    for (const p of this.popups) {
      const a = 1 - (now - p.t) / 0.7;
      g.globalAlpha = a; g.fillStyle = p.col; g.font = '28px Bungee, Impact, sans-serif'; g.textAlign = 'center';
      g.fillText(p.text, cx, hitY - 60 - (1 - a) * 40); g.globalAlpha = 1;
    }
  }
  drawSide(g, W, H) {
    const hx = this.mode === 'gig' ? 240 : 30, hy = H * 0.2, hh = H * 0.5;
    g.fillStyle = 'rgba(10,8,16,0.6)'; g.fillRect(hx - 6, hy - 6, 30, hh + 12);
    const hv = this.hype / 100;
    const grad = g.createLinearGradient(0, hy + hh, 0, hy); grad.addColorStop(0, '#5ff3ff'); grad.addColorStop(0.6, '#ff6ad5'); grad.addColorStop(1, '#ffe066');
    g.fillStyle = grad; g.fillRect(hx, hy + hh * (1 - hv), 18, hh * hv);
    g.font = '20px VT323, monospace'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('HYPE', hx + 9, hy + hh + 28);
    const gig = this.mode === 'gig', sx = gig ? 100 : W - 30;
    g.textAlign = gig ? 'left' : 'right'; g.font = '34px VT323, monospace';
    g.fillText(String(this.score).padStart(6, '0'), sx, 90);
    const mult = Math.min(4, 1 + Math.floor(this.combo / 10));
    g.fillStyle = this.combo >= 10 ? '#ffe066' : '#fff'; g.fillText(`COMBO ${this.combo}  x${mult}`, sx, 124);
    g.textAlign = 'center'; g.font = '18px VT323, monospace';
    const cw = 108, cx0 = W / 2 - (ROLE_LIST.length * cw) / 2, sb = this.songBeat();
    ROLE_LIST.forEach((r, i) => {
      const x = cx0 + i * cw + cw / 2, y = H - 26, you = r === this.role;
      const act = this.isActive(r, Math.max(0, sb));
      const ok = you ? (this.tnow() < this.missUntil ? 0 : 1) : this.bot[r].last;
      g.fillStyle = you ? 'rgba(255,255,255,0.25)' : 'rgba(10,8,16,0.6)'; g.fillRect(x - cw / 2 + 4, y - 18, cw - 8, 26);
      g.fillStyle = !act ? '#888' : ok ? ROLES[r].color : '#ff5a5a'; g.fillRect(x - cw / 2 + 4, y + 6, cw - 8, 3);
      const awayYou = you && this.atPost === false;
      g.fillStyle = awayYou ? '#ff5a5a' : act ? '#fff' : 'rgba(255,255,255,0.5)'; g.fillText((awayYou ? '★ MUTED' : (you ? '★ ' : '') + ROLES[r].name.toUpperCase() + (act ? '' : ' ♪')), x, y);
    });
  }
}
