/* ==========================================================================
   slot.js — ドパミンスロット
   ・結果を先に決めてからリールを止める（＝ガチャ実機と同じ思想）
   ・「あと1コマで揃った」を意図的に量産する“スベリ”を実装
   ・ハズレが続くと「そろそろ来ます」と煽る（後段でネタバラシする）
   ========================================================================== */

const SYM = ['🧠', '📱', '🔥', '💊', '💸', '👁', '⚡', '🍒'];
const LEN = SYM.length;
const JACK = 0;               // 🧠 = ドパガキJACKPOT
const IH_VAR = '--ih';

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* 出目テーブル（合計 1.0）。“おしい”を最も厚く積んでいる */
const TABLE = [
  ['jackpot', 0.015],
  ['triple', 0.035],
  ['near', 0.300],   // ← リーチ→スベリ。射幸性の主砲
  ['double', 0.180],
  ['lose', 0.470],
];

const HYPE_LOSE = [
  [3, 'まだ来ない'],
  [5, 'そろそろ来る'],
  [8, '絶対そろそろ来る'],
  [11, 'もう来るしかない'],
  [14, '確率は変わっていません'],
];

class Reel {
  constructor(el, idx) {
    this.el = el;
    this.idx = idx;
    this.strip = el.querySelector('.reel__strip');
    this.pos = Math.random() * LEN;
    this.speed = 0;
    this.tween = null;
    this.state = 'idle';
    // 3周ぶん敷いてループ継ぎ目を消す
    this.strip.innerHTML = Array.from({ length: LEN * 3 }, (_, i) => `<span>${SYM[i % LEN]}</span>`).join('');
    this.ih = 0;
    this.measure();
  }
  measure() {
    this.ih = parseFloat(getComputedStyle(this.el).getPropertyValue('height')) / 3;
  }
  render() {
    const p = ((this.pos % LEN) + LEN) % LEN;
    const y = this.ih - (LEN + p) * this.ih;
    this.strip.style.transform = `translate3d(0,${y}px,0)`;
  }
  spin(speed = 26) {
    this.state = 'spin';
    this.speed = speed;
    this.tween = null;
    this.el.classList.add('blur');
    this.el.classList.remove('reach');
  }
  /** target まで減速停止。slip=true なら「1コマ手前で止まりかけてから滑る」 */
  stopAt(target, { dur = 1100, minAdv = LEN * 2, slip = false, onLand } = {}) {
    const cur = this.pos;
    const land = slip ? ((target - 1) + LEN) % LEN : target;
    let end = Math.ceil(cur / LEN) * LEN + land;
    while (end < cur + minAdv) end += LEN;
    this.state = 'stop';
    this.tween = {
      from: cur, to: end, t: 0, dur: dur / 1000,
      ease: easeOutQuart,
      phase: slip ? 'pre' : 'final',
      onLand,
    };
  }
  step(dt) {
    if (this.state === 'spin') {
      this.pos += this.speed * dt;
    } else if (this.state === 'stop' && this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      this.pos = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) {
        this.pos = tw.to;
        if (tw.phase === 'pre') {
          // ── 止まったフリ ──
          this.el.classList.remove('blur');
          tw.phase = 'hold';
          tw.t = 0; tw.dur = 0.34;
        } else if (tw.phase === 'hold') {
          // ── スベる（1コマだけ進む）──
          tw.phase = 'final';
          tw.from = this.pos; tw.to = this.pos + 1;
          tw.t = 0; tw.dur = 0.46; tw.ease = easeOutBack;
        } else {
          this.state = 'idle';
          this.el.classList.remove('blur');
          this.el.classList.add('hit');
          setTimeout(() => this.el.classList.remove('hit'), 400);
          this.tween = null;
          tw.onLand && tw.onLand();
        }
      }
    }
    this.render();
  }
  get symbol() { return ((Math.round(this.pos) % LEN) + LEN) % LEN; }
}

export class Slot {
  constructor(opts) {
    this.o = opts;                      // { audio, vfx, scene, onResult, onSpinStart }
    this.root = document.getElementById('slot');
    this.hero = document.getElementById('hero');
    this.veil = document.getElementById('reachveil');
    this.btn = document.getElementById('slotBtn');
    this.lever = document.getElementById('slotLever');
    this.hype = document.getElementById('slotHype');
    this.elSpins = document.getElementById('slotSpins');
    this.elDp = document.getElementById('slotDp');
    this.elNear = document.getElementById('slotNear');

    this.reels = [...document.querySelectorAll('.reel')].map((el, i) => new Reel(el, i));
    this.busy = false;

    this.stats = { spins: 0, dp: 0, near: 0, jackpot: 0, triple: 0, loseStreak: 0, maxLoseStreak: 0, history: [] };

    this.btn.addEventListener('click', () => this.spin());
    this.lever?.addEventListener('click', () => this.spin());
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this._inView()) { e.preventDefault(); this.spin(); }
    });
    addEventListener('resize', () => this.reels.forEach(r => r.measure()), { passive: true });

    this.last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _inView() {
    const r = this.root.getBoundingClientRect();
    return r.top < innerHeight * 0.9 && r.bottom > 0;
  }

  _loop(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.reels.forEach(r => r.step(dt));
    requestAnimationFrame((t) => this._loop(t));
  }

  /* ---------------- 抽選 ---------------- */
  _roll() {
    // 15連敗で救済（＝“そろそろ来ます”を最後だけ本当にする仕掛け）
    if (this.stats.loseStreak >= 15) return 'triple';
    let r = Math.random(), acc = 0;
    for (const [k, w] of TABLE) { acc += w; if (r < acc) return k; }
    return 'lose';
  }

  _targets(kind) {
    const rs = () => 1 + ((Math.random() * (LEN - 1)) | 0); // 🧠以外
    switch (kind) {
      case 'jackpot': return { t: [JACK, JACK, JACK], slip: false };
      case 'triple': { const s = rs(); return { t: [s, s, s], slip: false }; }
      case 'near': { const s = rs(); return { t: [s, s, s], slip: true }; }  // 3つ目が1コマ滑る
      case 'double': {
        let a = rs(), b = rs(); while (b === a) b = rs();
        return { t: [a, b, a], slip: false };
      }
      default: {
        let a = rs(), b = rs(), c = rs();
        while (b === a) b = rs();
        while (c === a || c === b) c = rs();
        return { t: [a, b, c], slip: false };
      }
    }
  }

  /* ---------------- 回す ---------------- */
  spin() {
    if (this.busy) return;
    this.busy = true;
    this.btn.disabled = true;
    this.lever?.classList.add('pull');
    setTimeout(() => this.lever?.classList.remove('pull'), 420);

    const { audio, vfx, scene } = this.o;
    audio?.click();
    audio?.whoosh();
    scene?.hit(0.7);
    vfx?.kick(6, 0.86);
    this.hype.innerHTML = '';
    this.root.classList.remove('is-hot');
    this.o.onSpinStart?.();

    this.stats.spins++;
    this.elSpins.textContent = this.stats.spins;
    this._pop(this.elSpins);

    const kind = this._roll();
    const { t, slip } = this._targets(kind);

    this.reels.forEach((r, i) => r.spin(26 + i * 2.5));

    // 1・2リール停止
    this.reels[0].stopAt(t[0], { dur: 900, minAdv: LEN * 2 });
    setTimeout(() => {
      audio?.tap(2); vfx?.kick(5, 0.85);
      this.reels[1].stopAt(t[1], { dur: 950, minAdv: LEN * 2 });
    }, 380);

    // 3リール（リーチ判定つき）
    setTimeout(() => {
      audio?.tap(4); vfx?.kick(5, 0.85);
      const isReach = t[0] === t[1];
      if (isReach) this._reachOn(t[0] === JACK);
      this.reels[2].stopAt(t[2], {
        dur: isReach ? 2100 : 1000,
        minAdv: isReach ? LEN * 4 : LEN * 2,
        slip,
        onLand: () => this._resolve(kind, t),
      });
    }, 760);
  }

  _reachOn(isJack) {
    const { audio, vfx } = this.o;
    this.reels[2].el.classList.add('reach');
    this.hero.classList.add('reach');
    this.veil.classList.add('on');
    this.root.classList.add('is-hot');
    this.hype.innerHTML = `<span class="near">${isJack ? '🧠 リーチ' : 'リーチ'}</span>`;
    audio?.setIntensity(1);
    // 鼓動
    this._beat = 0;
    const beat = () => {
      if (!this.veil.classList.contains('on')) return;
      audio?._tone({ freq: 62, to: 40, type: 'sine', dur: 0.22, vol: 0.34 });
      vfx?.kick(4, 0.8);
      this._beat++;
      setTimeout(beat, Math.max(220, 460 - this._beat * 34));
    };
    beat();
  }

  _reachOff() {
    this.veil.classList.remove('on');
    this.hero.classList.remove('reach');
    this.reels[2].el.classList.remove('reach');
    this.o.audio?.setIntensity(0);
  }

  _pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  _center() {
    const r = this.reels[1].el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  _resolve(kind, t) {
    const { audio, vfx, scene } = this.o;
    this._reachOff();
    const { x, y } = this._center();
    const gains = { jackpot: 10000, triple: 2000, near: 50, double: 150, lose: 10 };
    const gain = gains[kind];

    this.stats.dp += gain;
    this.stats.history.push(kind);
    this.elDp.textContent = this.stats.dp.toLocaleString();
    this._pop(this.elDp);

    if (kind === 'jackpot' || kind === 'triple') {
      this.stats.loseStreak = 0;
      this.stats[kind === 'jackpot' ? 'jackpot' : 'triple']++;
    } else {
      this.stats.loseStreak++;
      this.stats.maxLoseStreak = Math.max(this.stats.maxLoseStreak, this.stats.loseStreak);
    }

    switch (kind) {
      case 'jackpot':
        this.hype.innerHTML = `<span class="win">ドパガキ JACKPOT!!</span><span class="fake">脳が焼けました　+10,000 DP</span>`;
        vfx?.flash(0.95, 220); vfx?.kick(34, 0.92);
        vfx?.confetti(220); vfx?.ring(x, y, '#ffe500', 700, 7); vfx?.ring(x, y, '#ff2e93', 520, 5);
        vfx?.burst(x, y, 90, { speed: 900, size: 10 });
        vfx?.text(x, y - 70, '+10,000', '#ffe500', 64);
        scene?.jackpot(); audio?.fanfare(); audio?.impact();
        break;
      case 'triple':
        this.hype.innerHTML = `<span class="win">当たり</span><span class="fake">+2,000 DP</span>`;
        vfx?.flash(0.6, 180); vfx?.kick(20, 0.9);
        vfx?.confetti(90); vfx?.ring(x, y, '#ff2e93', 420, 5);
        vfx?.burst(x, y, 46, { speed: 620, size: 8 });
        vfx?.text(x, y - 60, '+2,000', '#ffe500', 46);
        scene?.hit(2.2); audio?.fanfare();
        break;
      case 'near':
        this.stats.near++;
        this.elNear.textContent = this.stats.near; this._pop(this.elNear);
        this.hype.innerHTML = `<span class="near">おしい</span><span class="fake">あと1コマでした</span>`;
        vfx?.kick(16, 0.88);
        vfx?.burst(x, y, 24, { speed: 380, color: '#ffe500', size: 6 });
        vfx?.text(x, y - 50, 'あと1コマ', '#ffe500', 30);
        scene?.hit(1.2);
        audio?._tone({ freq: 520, to: 180, type: 'sawtooth', dur: 0.5, vol: 0.22 });
        break;
      case 'double':
        this.hype.innerHTML = `<span class="lose">2つ揃い　+150 DP</span>`;
        vfx?.burst(x, y, 14, { speed: 260, size: 5 });
        vfx?.text(x, y - 40, '+150', '#ffffff', 24);
        audio?.tap(6);
        break;
      default:
        this.hype.innerHTML = `<span class="lose">ハズレ　+10 DP</span>`;
        vfx?.burst(x, y, 7, { speed: 180, size: 3, color: '#7b8095' });
        audio?._tone({ freq: 220, to: 150, type: 'triangle', dur: 0.16, vol: 0.1 });
    }

    // 連敗煽り（＝後で暴くための仕掛け）
    if (kind !== 'jackpot' && kind !== 'triple') {
      const h = [...HYPE_LOSE].reverse().find(([n]) => this.stats.loseStreak >= n);
      if (h) {
        this.hype.innerHTML += `<span class="fake">${this.stats.loseStreak}連敗　—　${h[1]}</span>`;
      }
    }

    this.o.onResult?.(kind, this.stats, gain);
    this.busy = false;
    this.btn.disabled = false;
  }
}
