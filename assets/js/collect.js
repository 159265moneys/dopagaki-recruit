/* ==========================================================================
   collect.js — ドパ玉コレクション / DP経済 / レベル / 踏破率
   保存は localStorage のみ（外部送信なし）
   ========================================================================== */

export const BALLS = [
  { id: 1, where: 'ローディング画面', hint: '最初に出る画面の、会社名のところ' },
  { id: 2, where: 'スロット筐体', hint: '筐体の右下、留めてあるもの' },
  { id: 3, where: '連打ランキング', hint: '最下位の人の名前' },
  { id: 4, where: 'WHYカードの裏', hint: '3枚目をめくった先の小さい文字' },
  { id: 5, where: '数字セクション', hint: '注釈の記号' },
  { id: 6, where: '募集要項', hint: '一番下の注釈の記号' },
  { id: 7, where: 'フッター', hint: '一番下の、いちばん大きい文字' },
  { id: 8, where: 'コナミコマンド', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
  { id: 9, where: '開発者コンソール', hint: 'F12 を開くと、何か書いてあります' },
  { id: 10, where: '押すなボタン', hint: '押すなと言われて、それでも押し続けると' },
];

const LEVELS = [
  { dp: 0, name: '無' },
  { dp: 500, name: 'ドパ見習い' },
  { dp: 2000, name: 'ドパガキ' },
  { dp: 6000, name: '常習ドパガキ' },
  { dp: 15000, name: '重度ドパガキ' },
  { dp: 40000, name: 'ドパ卿' },
  { dp: 90000, name: 'ドーパミン大臣' },
  { dp: 200000, name: '人間をやめた' },
];

/* 踏破率の分母 */
const SECTIONS = ['FV', 'BURST', 'REASONS', 'QUIZ', 'NUMBERS', 'PEOPLE', 'JOB', 'DONOT', 'LOG', 'ENTRY'];
const DEEDS = ['slot', 'burst', 'quiz', 'flip', 'number', 'people', 'donot', 'sound', 'hero', 'ball'];
const TOTAL = SECTIONS.length + DEEDS.length;

const LS = 'dopagaki.v1';

export class Progress {
  constructor(o) {
    this.o = o;                     // { audio, vfx }
    this.dp = 0;
    this.balls = new Set();
    this.deeds = new Set();
    this.secs = new Set();
    this.level = 0;
    this._load();

    this.el = {
      dp: document.getElementById('hudDp'),
      lv: document.getElementById('hudLv'),
      lvBar: document.getElementById('hudLvBar'),
      ball: document.getElementById('hudBall'),
      prog: document.getElementById('hudProg'),
      chipDp: document.getElementById('chipDp'),
      chipLv: document.getElementById('chipLv'),
      chipBall: document.getElementById('chipBall'),
      chipProg: document.getElementById('chipProg'),
    };

    this._panel();
    this.render(true);
  }

  _load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || '{}');
      if (Array.isArray(s.balls)) s.balls.forEach(b => this.balls.add(b));
      if (typeof s.dp === 'number') this.dp = Math.min(s.dp, 5_000_000);
    } catch (_) { /* 保存できない環境でも通常動作する */ }
  }
  _save() {
    try { localStorage.setItem(LS, JSON.stringify({ balls: [...this.balls], dp: this.dp })); } catch (_) {}
  }

  /* ------------------------------- DP / レベル */
  award(dp, label) {
    this.dp += dp;
    const next = LEVELS.reduce((acc, l, i) => this.dp >= l.dp ? i : acc, 0);
    const up = next > this.level;
    this.level = next;
    this.render();
    if (label) this.o.vfx?.toast('⚡', `${label} <b>+${dp.toLocaleString()} DP</b>`);
    if (up) this._levelUp();
    this._save();
  }

  _levelUp() {
    const L = LEVELS[this.level];
    this.o.audio?.fanfare();
    this.o.vfx?.flash(0.65, 260);
    this.o.vfx?.kick(24, 0.92);
    this.o.vfx?.confetti(120);
    this.o.vfx?.toast('🎉', `LEVEL UP! <b>Lv.${this.level + 1} ${L.name}</b>`, 4200);
    this.el.chipLv?.classList.remove('pop'); void this.el.chipLv?.offsetWidth;
    this.el.chipLv?.classList.add('pop');
  }

  get levelName() { return LEVELS[this.level].name; }

  /* ------------------------------- 踏破率 */
  markSection(name) {
    if (!SECTIONS.includes(name) || this.secs.has(name)) return;
    this.secs.add(name);
    this.render();
    this._checkFull();
  }
  markDeed(name) {
    if (!DEEDS.includes(name) || this.deeds.has(name)) return;
    this.deeds.add(name);
    this.render();
    this._checkFull();
  }
  get percent() {
    return Math.round((this.secs.size + this.deeds.size) / TOTAL * 100);
  }
  _checkFull() {
    if (this.percent >= 100 && !this._fullDone) {
      this._fullDone = true;
      this.award(5000, '踏破率100%');
      this.o.vfx?.toast('🏆', 'このサイト、<b>全部触りました</b>');
    }
  }

  /* ------------------------------- ドパ玉 */
  hasBall(id) { return this.balls.has(id); }

  collectBall(id, x, y) {
    if (this.balls.has(id)) return false;
    this.balls.add(id);
    this.markDeed('ball');
    const n = this.balls.size;

    this.o.audio?.achieve();
    this.o.vfx?.flash(0.45, 180);
    this.o.vfx?.kick(14, 0.9);
    if (x != null) {
      this.o.vfx?.ring(x, y, '#ffe500', 320, 4);
      this.o.vfx?.burst(x, y, 34, { speed: 460, color: '#ffe500', size: 7 });
      this.o.vfx?.text(x, y - 40, '🧠 GET', '#ffe500', 34);
    }
    this.o.vfx?.toast('🧠', `ドパ玉を見つけた <b>${n} / 10</b>`, 3800);
    this.award(800, null);
    this.el.chipBall?.classList.remove('pop'); void this.el.chipBall?.offsetWidth;
    this.el.chipBall?.classList.add('pop');
    this.renderPanel();
    this._save();

    if (n === 10) setTimeout(() => this.o.onComplete?.(), 900);
    return true;
  }

  /* ------------------------------- 描画 */
  render(silent) {
    const e = this.el;
    if (!e.dp) return;
    e.dp.textContent = this.dp.toLocaleString();
    e.lv.textContent = this.level + 1;
    const cur = LEVELS[this.level].dp, nxt = LEVELS[this.level + 1]?.dp ?? cur + 1;
    e.lvBar.style.width = Math.min(100, ((this.dp - cur) / (nxt - cur)) * 100) + '%';
    e.ball.textContent = this.balls.size;
    e.chipBall.classList.toggle('has', this.balls.size > 0);
    e.prog.textContent = this.percent;
    if (!silent) {
      e.chipDp.classList.remove('pop'); void e.chipDp.offsetWidth; e.chipDp.classList.add('pop');
    }
  }

  _panel() {
    this.panel = document.getElementById('ballPanel');
    this.list = document.getElementById('ballList');
    this.count = document.getElementById('ballPanelCount');
    document.getElementById('chipBall').addEventListener('click', () => {
      this.panel.hidden = false;
      this.o.audio?.ui();
      this.renderPanel();
    });
    document.getElementById('ballClose').addEventListener('click', () => { this.panel.hidden = true; });
    this.panel.addEventListener('click', (e) => { if (e.target === this.panel) this.panel.hidden = true; });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.panel.hidden = true; });
    this.renderPanel();
  }

  renderPanel() {
    if (!this.list) return;
    this.count.textContent = this.balls.size;
    // 未取得は場所を伏せる。ただし3個以上取ると徐々にヒントが開く
    const open = this.balls.size >= 3;
    this.list.innerHTML = BALLS.map(b => {
      const got = this.balls.has(b.id);
      const text = got ? b.where : (open ? `？？？（${b.hint}）` : '？？？');
      return `<li class="${got ? 'got' : ''}"><i>🧠</i><span>${String(b.id).padStart(2, '0')}　${text}</span></li>`;
    }).join('');
  }
}
