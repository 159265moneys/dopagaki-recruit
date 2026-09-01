/* ==========================================================================
   audio.js — Web Audio による完全合成SE / BGM
   外部音源ファイルは一切使わない（読み込み0ms・著作権フリー）
   ========================================================================== */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDIノート → Hz

/* A minor: i - VI - III - VII （ネオン系の定番進行） */
const PROG = [
  { root: 45, chord: [57, 60, 64, 69] }, // Am
  { root: 41, chord: [53, 57, 60, 65] }, // F
  { root: 48, chord: [55, 60, 64, 67] }, // C
  { root: 43, chord: [55, 59, 62, 67] }, // G
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.ready = false;
    this._noiseBuf = null;
    this._timer = null;
    this._step = 0;
    this._next = 0;
    this.bpm = 124;
  }

  /* ---- 初期化（必ずユーザー操作から呼ぶ） ---- */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.18;

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.musBus = this.ctx.createGain();
    this.musBus.gain.value = 0.34;

    // 空間に少しだけ奥行きを（合成インパルスの簡易リバーブ）
    this.verb = this.ctx.createConvolver();
    this.verb.buffer = this._impulse(1.6, 2.6);
    this.verbSend = this.ctx.createGain();
    this.verbSend.gain.value = 0.24;

    this.sfxBus.connect(this.comp);
    this.musBus.connect(this.comp);
    this.sfxBus.connect(this.verbSend);
    this.musBus.connect(this.verbSend);
    this.verbSend.connect(this.verb);
    this.verb.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);

    this._noiseBuf = this._noise(2);
    this.ready = true;
  }

  _impulse(dur, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noise(sec) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * sec, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---- ON/OFF ---- */
  toggle() { this.setOn(!this.on); return this.on; }

  setOn(v) {
    this.init();
    if (!this.ready) return;
    this.on = v;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v ? 0.9 : 0.0, t, 0.12);
    if (v) this._startSeq(); else this._stopSeq();
  }

  /* ======================================================== SFX */
  _env(node, t, a, d, peak = 1) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _tone({ freq, type = 'sine', dur = 0.18, at = 0.004, vol = 0.3, to = null, dest = null, detune = 0 }) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    this._env(g, t, at, dur, vol);
    o.connect(g).connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + at + 0.05);
  }

  _noiseHit({ dur = 0.09, vol = 0.22, hp = 1200, lp = 9000, dest = null }) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    const f1 = this.ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
    const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
    this._env(g, t, 0.002, dur, vol);
    s.connect(f1).connect(f2).connect(g).connect(dest || this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.06);
  }

  /** ドパるタップ音。コンボが伸びるほど音階が上がっていく（＝連打が旋律になる） */
  tap(combo = 0) {
    if (!this.on) return;
    const step = Math.min(combo, 24);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
    const semi = scale[step % scale.length] + Math.floor(step / scale.length) * 12;
    const f = NOTE(69 + semi);
    this._tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.24 });
    this._tone({ freq: f * 2, type: 'sine', dur: 0.09, vol: 0.13 });
    this._noiseHit({ dur: 0.045, vol: 0.1, hp: 3000 });
  }

  /** ランクアップ・ファンファーレ */
  fanfare() {
    if (!this.on || !this.ready) return;
    const seq = [0, 4, 7, 12, 16, 19];
    seq.forEach((s, i) => {
      setTimeout(() => {
        this._tone({ freq: NOTE(69 + s), type: 'square', dur: 0.22, vol: 0.16 });
        this._tone({ freq: NOTE(69 + s) * 1.5, type: 'sine', dur: 0.18, vol: 0.1 });
      }, i * 62);
    });
    setTimeout(() => this._noiseHit({ dur: 0.5, vol: 0.14, hp: 400, lp: 6000 }), 20);
  }

  /** 実績解除 */
  achieve() {
    if (!this.on) return;
    [0, 7, 12].forEach((s, i) =>
      setTimeout(() => this._tone({ freq: NOTE(76 + s), type: 'sine', dur: 0.2, vol: 0.16 }), i * 70)
    );
  }

  ui() { this._tone({ freq: 880, type: 'sine', dur: 0.05, vol: 0.07 }); }

  click() {
    this._tone({ freq: 620, to: 340, type: 'triangle', dur: 0.1, vol: 0.16 });
    this._noiseHit({ dur: 0.03, vol: 0.07, hp: 2500 });
  }

  whoosh() {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.42);
    this._env(g, t, 0.09, 0.36, 0.16);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t); s.stop(t + 0.55);
  }

  /** 診断の結果表示など、重い一撃 */
  impact() {
    this._tone({ freq: 160, to: 42, type: 'sawtooth', dur: 0.7, vol: 0.3 });
    this._noiseHit({ dur: 0.36, vol: 0.2, hp: 120, lp: 3000 });
  }

  /* ======================================================== BGM（ステップシーケンサ） */
  _startSeq() {
    if (this._timer) return;
    this._step = 0;
    this._next = this.ctx.currentTime + 0.08;
    this._timer = setInterval(() => this._sched(), 25);
  }

  _stopSeq() {
    clearInterval(this._timer);
    this._timer = null;
  }

  _sched() {
    if (!this.on) return;
    const spb = 60 / this.bpm / 4; // 16分音符
    while (this._next < this.ctx.currentTime + 0.12) {
      this._playStep(this._step, this._next);
      this._step = (this._step + 1) % 64;
      this._next += spb;
    }
  }

  _playStep(step, t) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const ch = PROG[bar % PROG.length];
    const bus = this.musBus;

    // kick
    if (s === 0 || s === 4 || s === 8 || s === 12 || s === 14) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.85, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + 0.34);
    }

    // hat
    if (s % 2 === 1) {
      const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuf;
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7800;
      const open = s === 7 || s === 15;
      const v = open ? 0.14 : (s % 4 === 3 ? 0.1 : 0.055);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.16 : 0.045));
      n.connect(f).connect(g).connect(bus);
      n.start(t); n.stop(t + 0.2);
    }

    // clap（2・4拍）
    if (s === 4 || s === 12) {
      const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuf;
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 1.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      n.connect(f).connect(g).connect(bus);
      n.start(t); n.stop(t + 0.2);
    }

    // bass
    if (s === 0 || s === 6 || s === 10) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 6;
      o.type = 'sawtooth';
      o.frequency.value = NOTE(ch.root);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.36, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(f).connect(g).connect(bus);
      o.start(t); o.stop(t + 0.3);
    }

    // arp（16分のプラック）
    if (s % 2 === 0) {
      const idx = (s / 2 + bar) % ch.chord.length;
      const note = ch.chord[idx] + (s >= 8 ? 12 : 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 8;
      f.frequency.setValueAtTime(4200, t);
      f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
      o.type = 'sawtooth';
      o.frequency.value = NOTE(note);
      o.detune.value = (s % 4 === 0) ? 0 : 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(f).connect(g).connect(bus);
      o.start(t); o.stop(t + 0.26);
    }

    // pad（小節頭）
    if (s === 0) {
      ch.chord.forEach((n, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
        o.type = 'triangle';
        o.frequency.value = NOTE(n - 12);
        o.detune.value = i % 2 ? 8 : -8;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.85);
        o.connect(f).connect(g).connect(bus);
        o.start(t); o.stop(t + 2);
      });
    }
  }

  /** BGMのテンションを上げる（コンボ中など） */
  setIntensity(v) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.musBus.gain.setTargetAtTime(0.28 + v * 0.16, t, 0.3);
    this.bpm = 124 + Math.round(v * 12);
  }
}

export const audio = new Audio();
