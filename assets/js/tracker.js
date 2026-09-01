/* ==========================================================================
   tracker.js — 訪問者の行動計測 & リアルタイム観測
   ★重要★ 計測結果は一切外部送信しない。すべてこのブラウザ内で完結する。
           「見られている感」は演出であり、実際の収集・送信は行わない。
   ========================================================================== */

const now = () => performance.now();
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const TITLES = ['👀 戻ってきて', '👀 まだ見てます', '👀 どこ行ったんですか'];

export class Tracker {
  constructor(vfx) {
    this.vfx = vfx;
    this.t0 = now();
    this.origTitle = document.title;

    this.d = {
      clicks: 0,
      rageClicks: 0,
      scrollPx: 0,
      scrollMax: 0,          // 最高スクロール速度 px/s
      scrollSamples: 0,
      scrollSpeedSum: 0,
      backtracks: 0,
      deepest: 0,            // 到達率 %
      mousePx: 0,
      blurCount: 0,
      awayMs: 0,
      hiddenMs: 0,
      pauses: 0,             // 3秒以上スクロールが止まった回数
      longestPause: 0,
      exitIntent: 0,
      titleHijacks: 0,
      keys: 0,
      firstScrollAt: null,
      reachedBottomAt: null,
      sections: {},          // name -> ms
    };

    this._lastY = scrollY;
    this._lastYTime = now();
    this._lastMove = null;
    this._lastScrollAt = now();
    this._clickTimes = [];
    this._awayFrom = null;
    this._titleTimer = null;

    this.obsQueue = [];
    this.obsLastAt = 0;
    this.obsCount = 0;
    this.obsFired = new Set();
    this.obsEnabled = false;

    this._bind();
    this._tick();
  }

  /* ------------------------------------------------ 計測 */
  _bind() {
    addEventListener('scroll', () => this._onScroll(), { passive: true });
    addEventListener('pointermove', (e) => this._onMove(e), { passive: true });
    addEventListener('pointerdown', () => this._onClick(), { passive: true });
    addEventListener('keydown', () => { this.d.keys++; }, { passive: true });
    document.addEventListener('visibilitychange', () => this._onVis());
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget && e.clientY <= 4) this._onExitIntent();
    });
  }

  _onScroll() {
    const t = now();
    const y = scrollY;
    const dy = y - this._lastY;
    const dt = Math.max(t - this._lastYTime, 1);
    const v = Math.abs(dy) / dt * 1000;

    this.d.scrollPx += Math.abs(dy);
    if (v < 30000) {                       // 異常値を除く
      this.d.scrollMax = Math.max(this.d.scrollMax, v);
      this.d.scrollSpeedSum += v;
      this.d.scrollSamples++;
    }
    if (dy < -80) this.d.backtracks++;
    if (this.d.firstScrollAt === null && Math.abs(dy) > 4) this.d.firstScrollAt = t - this.t0;

    const doc = document.documentElement.scrollHeight - innerHeight;
    const pct = doc > 0 ? Math.min(100, (y / doc) * 100) : 0;
    if (pct > this.d.deepest) this.d.deepest = pct;
    if (pct > 97 && this.d.reachedBottomAt === null) this.d.reachedBottomAt = t - this.t0;

    // 一時停止の判定
    const gap = t - this._lastScrollAt;
    if (gap > 3000) {
      this.d.pauses++;
      this.d.longestPause = Math.max(this.d.longestPause, gap);
      this._pauseEvent(gap);
    }

    this._lastScrollAt = t;
    this._lastY = y;
    this._lastYTime = t;

    if (v > 3500) this._fastEvent(v);
    if (dy < -200) this._backEvent();
  }

  _onMove(e) {
    if (this._lastMove) {
      const dx = e.clientX - this._lastMove.x, dy = e.clientY - this._lastMove.y;
      this.d.mousePx += Math.hypot(dx, dy);
    }
    this._lastMove = { x: e.clientX, y: e.clientY };
  }

  _onClick() {
    this.d.clicks++;
    const t = now();
    this._clickTimes.push(t);
    this._clickTimes = this._clickTimes.filter(x => t - x < 1200);
    if (this._clickTimes.length >= 6) {
      this.d.rageClicks++;
      this._clickTimes = [];
      this._push('rage', 'そのクリック、少し強くないですか。<b>連打を検知しました。</b>');
    }
  }

  _onVis() {
    if (document.hidden) {
      this._awayFrom = now();
      this.d.blurCount++;
      this._hijackTitle();
    } else {
      if (this._awayFrom) {
        const away = now() - this._awayFrom;
        this.d.awayMs += away;
        this._awayFrom = null;
        this._restoreTitle();
        if (away > 2500) {
          this._push('return',
            `おかえりなさい。<u>${(away / 1000).toFixed(1)}秒</u>、離れていましたね。<br>` +
            `<b>その間、タブのタイトルを書き換えて呼び戻しました。</b>`, true);
        }
      }
    }
  }

  _hijackTitle() {
    this.d.titleHijacks++;
    let i = 0;
    document.title = TITLES[0];
    clearInterval(this._titleTimer);
    this._titleTimer = setInterval(() => {
      i = (i + 1) % TITLES.length;
      document.title = TITLES[i];
    }, 2600);
  }
  _restoreTitle() {
    clearInterval(this._titleTimer);
    document.title = this.origTitle;
  }

  _onExitIntent() {
    this.d.exitIntent++;
    if (this.d.exitIntent === 1) {
      this._push('exit', 'カーソルが画面の外に向かいました。<br><b>閉じようとしましたね。</b>', true);
    }
  }

  /* ------------------------------------------------ セクション滞在 */
  observeSections() {
    this.sectionEls = [...document.querySelectorAll('[data-sec]')];
  }

  _tick() {
    const step = 250;
    setInterval(() => {
      if (document.hidden) { this.d.hiddenMs += step; return; }
      // 画面中央にあるセクションに時間を加算
      if (this.sectionEls) {
        const mid = innerHeight / 2;
        for (const el of this.sectionEls) {
          const r = el.getBoundingClientRect();
          if (r.top <= mid && r.bottom >= mid) {
            const k = el.dataset.sec;
            this.d.sections[k] = (this.d.sections[k] || 0) + step;
            break;
          }
        }
      }
      this._drain();
      this._idleCheck();
    }, step);
  }

  _idleCheck() {
    const idle = now() - Math.max(this._lastScrollAt, this._lastMoveAt || 0);
    if (idle > 45000 && !this.obsFired.has('idle') && this.d.deepest > 5) {
      this._push('idle', '45秒、何も動いていません。<br><b>まだ、見ていますか？</b>');
    }
  }

  /* ------------------------------------------------ 観測イベント */
  _pauseEvent(gap) {
    if (gap > 4000 && !this.obsFired.has('pause')) {
      this._push('pause', `スクロールが <u>${(gap / 1000).toFixed(1)}秒</u> 止まりました。<br><b>ここ、ちゃんと読んでますね。</b>`);
    }
  }
  _fastEvent(v) {
    if (this.obsFired.has('fast')) return;
    const avg = this.d.scrollSamples ? this.d.scrollSpeedSum / this.d.scrollSamples : 1;
    const x = Math.max(1.2, v / Math.max(avg, 200));
    this._push('fast', `いま平均の <u>${x.toFixed(1)}倍</u> の速さでスクロールしました。<br><b>飛ばしましたね。</b>`);
  }
  _backEvent() {
    if (this.obsFired.has('back') || this.d.backtracks < 3) return;
    this._push('back', `<u>${this.d.backtracks}回</u> 上に戻っています。<br><b>さっきの、何が気になりましたか。</b>`);
  }

  lateNight() {
    const h = new Date().getHours();
    if (h >= 0 && h < 5) {
      this._push('night', `いま <u>${h}時台</u> です。<br><b>寝る前にこれを見ているの、完全にドパガキです。</b>`);
    } else if (h >= 9 && h < 18 && [1, 2, 3, 4, 5].includes(new Date().getDay())) {
      this._push('work', `平日の <u>${h}時台</u> にご覧いただいています。<br><b>仕事中ですよね。ありがとうございます。</b>`);
    }
  }

  slotEvent(stats) {
    if (stats.spins === 10 && !this.obsFired.has('slot10')) {
      this._push('slot10', `スロットを <u>10回</u> 引きました。<br><b>景品は無いと書いてあったのに。</b>`);
    }
    if (stats.spins === 30 && !this.obsFired.has('slot30')) {
      this._push('slot30', `<u>30回</u>。もう完全にこちらの手の内です。<br><b>ありがとうございます。</b>`);
    }
    if (stats.near === 5 && !this.obsFired.has('near5')) {
      this._push('near5', `「おしい」が <u>5回</u> 出ました。<br><b>あれ、偶然だと思いますか？</b>`);
    }
  }

  /** 観測メッセージをキューに積む（連発しないよう間引く） */
  _push(key, html, priority = false) {
    if (this.obsFired.has(key)) return;
    this.obsFired.add(key);
    if (priority) this.obsQueue.unshift(html); else this.obsQueue.push(html);
  }

  _drain() {
    if (!this.obsEnabled || !this.obsQueue.length) return;
    const t = now();
    if (t - this.obsLastAt < 14000) return;
    if (this.obsCount >= 9) return;
    this.obsLastAt = t;
    this.obsCount++;
    this.vfx.observe(this.obsQueue.shift());
  }

  enableObserver() {
    this.obsEnabled = true;
    setTimeout(() => this.lateNight(), 12000);
  }

  /* ------------------------------------------------ 出力 */
  get elapsed() { return now() - this.t0; }

  topSection() {
    const e = Object.entries(this.d.sections).sort((a, b) => b[1] - a[1])[0];
    return e ? { name: e[0], ms: e[1] } : null;
  }

  /** LOGセクション用の行データ */
  report(extra = {}) {
    const d = this.d;
    const avg = d.scrollSamples ? d.scrollSpeedSum / d.scrollSamples : 0;
    const top = this.topSection();
    const swipes = Math.round(d.scrollPx / 800);
    const mouseM = (d.mousePx * 0.2646 / 1000);
    const SEC_JP = {
      FV: 'ドパミンスロット', MESSAGE: 'メッセージ', REASONS: 'なぜドパガキか',
      QUIZ: 'ドパガキ検定', NUMBERS: '数字で見るnext', PEOPLE: '社員紹介',
      JOB: '募集要項', LOG: 'この行動ログ', ENTRY: 'エントリー',
    };

    const rows = [
      ['滞在時間', fmtTime(this.elapsed), false],
      ['うち、タブを離れていた時間', `${(d.awayMs / 1000).toFixed(1)}秒 / ${d.blurCount}回`, d.blurCount > 0],
      ['クリック・タップ数', `${d.clicks.toLocaleString()}回`, false],
      ['スロットを回した回数', `${extra.spins ?? 0}回`, (extra.spins ?? 0) >= 10],
      ['「おしい」が出た回数', `${extra.near ?? 0}回`, (extra.near ?? 0) > 0],
      ['獲得ドーパミン', `${(extra.dp ?? 0).toLocaleString()} DP`, false],
      ['スクロール総距離', `${Math.round(d.scrollPx).toLocaleString()}px（ショート動画 約${swipes}本ぶんの指の動き）`, false],
      ['最高スクロール速度', `${Math.round(d.scrollMax).toLocaleString()}px/秒（平均の${(avg ? d.scrollMax / avg : 1).toFixed(1)}倍）`, d.scrollMax > 6000],
      ['マウスの総移動距離', `${mouseM.toFixed(1)}m`, false],
      ['読むために止まった回数', `${d.pauses}回（最長 ${(d.longestPause / 1000).toFixed(1)}秒）`, false],
      ['上にスクロールし直した回数', `${d.backtracks}回`, false],
      ['ページ到達率', `${d.deepest.toFixed(1)}%`, false],
      ['最も長く見たセクション', top ? `${SEC_JP[top.name] || top.name}（${(top.ms / 1000).toFixed(1)}秒）` : '—', true],
      ['タブのタイトルを書き換えた回数', `${d.titleHijacks}回`, d.titleHijacks > 0],
      ['閉じようとした回数', `${d.exitIntent}回`, d.exitIntent > 0],
      ['連打（イライラ）検知', `${d.rageClicks}回`, d.rageClicks > 0],
      ['診断結果', extra.quiz || '未受検', !!extra.quiz],
      ['アクセス時刻', new Date().toLocaleString('ja-JP', { hour12: false }), false],
      ['画面サイズ', `${innerWidth}×${innerHeight} / DPR ${devicePixelRatio}`, false],
      ['外部への送信', '0件（このページはあなたの端末の外に何も出していません）', true],
    ];
    return rows;
  }
}
