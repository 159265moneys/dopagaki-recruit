/* ==========================================================================
   main.js — 全体制御
   ========================================================================== */
import { audio } from './audio.js';
import { VFX } from './vfx.js';
import { Slot } from './slot.js';
import { Quiz } from './quiz.js';
import { Tracker } from './tracker.js';
import { Progress } from './collect.js';
import { initNumbers, initPeople, initBurst, initDonot } from './content.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const vfx = new VFX($('#fx'));
const tracker = new Tracker(vfx);
let scene = null;
let slot = null, quiz = null;

/* ====================================================== 進行度 */
const prog = new Progress({
  audio, vfx,
  onComplete: () => {
    const sec = $('#secret');
    sec.hidden = false;
    vfx.confetti(300);
    vfx.flash(1, 400);
    audio.fanfare();
    setTimeout(() => audio.impact(), 300);
    vfx.toast('🏆', '<b>隠しページを解放しました</b>', 6000);
    setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 700);
  },
});
const award = (dp, label) => prog.award(dp, label);

/* ドパ玉はローダー表示中から拾えるよう、最初に配線する */
wireBalls();

/* ====================================================== ローダー */
const LOAD_MSG = [
  'ドーパミン供給ラインに接続中…',
  '報酬系のアドレスを解決中…',
  '前頭前野をバイパスしています…',
  'あなたの意志力を無効化しました',
  '……あと少しです（この待ち時間も演出です）',
  '準備完了',
];
(function loader() {
  const bar = $('#loaderBar'), pct = $('#loaderPct'), msg = $('#loaderMsg');
  const enter = $('#loaderEnter');
  // 経過時間ベース（タブが裏に回っても復帰時に追いつく）
  const DUR = 2300;
  const t0 = performance.now();
  let i = -1;
  const tick = () => {
    const k = Math.min((performance.now() - t0) / DUR, 1);
    // 序盤は速く、90%台でわざと粘るカーブ
    const p = k < 0.55 ? (k / 0.55) * 74 : 74 + Math.pow((k - 0.55) / 0.45, 0.62) * 26;
    bar.style.width = p + '%';
    pct.textContent = Math.floor(p);
    const ni = p < 20 ? 0 : p < 45 ? 1 : p < 70 ? 2 : p < 88 ? 3 : p < 99.5 ? 4 : 5;
    if (ni !== i) { i = ni; msg.textContent = LOAD_MSG[i]; }
    if (k < 1) requestAnimationFrame(tick);
    else { msg.textContent = LOAD_MSG[LOAD_MSG.length - 1]; enter.hidden = false; }
  };
  requestAnimationFrame(tick);

  enter.addEventListener('click', () => {
    audio.setOn(true);
    syncSoundBtn();
    prog.markDeed('sound');
    start();
  });
})();

function start() {
  $('#loader').classList.add('is-done');
  document.body.classList.remove('is-locked');
  setTimeout(() => { $('#hud').classList.add('on'); }, 320);
  audio.click();
  vfx.flash(0.5, 400);

  // 3D は起動後に読み込む（初期表示を軽くする）
  import('./scene3d.js').then(({ Scene3D }) => {
    scene = new Scene3D($('#bg3d'));
    if (slot) slot.o.scene = scene;
  }).catch(() => {});

  slot = new Slot({
    audio, vfx, scene,
    onSpinStart: () => { prog.markDeed('slot'); },
    onResult: (kind, stats, gain) => {
      award(gain, null);
      tracker.slotEvent(stats);
      if (kind === 'jackpot') vfx.toast('🧠', '<b>JACKPOT</b> 引きましたね', 5000);
    },
  });

  quiz = new Quiz({
    audio, vfx, award,
    getSpins: () => slot?.stats.spins ?? 0,
    onDone: (r) => { prog.markDeed('quiz'); window.__quiz = r; },
    onRetry3: () => vfx.toast('🔁', '3回もやり直しましたね。<b>納得いくまでどうぞ</b>'),
  });

  initNumbers({ audio, vfx, award: (d) => { award(d); prog.markDeed('number'); } });
  initPeople({
    audio, vfx,
    award: (d) => { award(d); prog.markDeed('people'); },
    onLongPress: (el, p) => {
      const r = el.getBoundingClientRect();
      vfx.burst(r.left + r.width / 2, r.top + 60, 26, { speed: 400, color: '#00e5ff' });
      vfx.text(r.left + r.width / 2, r.top + 40, '長押し発見', '#00e5ff', 24);
      audio.achieve();
      award(300, `${p.name} の裏設定`);
      vfx.toast('🔍', `<b>${p.name}</b> の隠しコメント：「${p.quote}」`, 6000);
    },
  });
  initBurst({
    audio, vfx,
    award: (d, l) => { award(d, l); prog.markDeed('burst'); },
    onBurstDone: (n) => { if (n >= 61) vfx.toast('⚡', `<b>${n}回</b>／社内2位を抜きました`); },
  });
  initDonot({
    audio, vfx,
    award: (d, l) => { award(d, l); prog.markDeed('donot'); },
    onDonot15: (e) => {
      const b = $('#donotBtn').getBoundingClientRect();
      prog.collectBall(10, b.left + b.width / 2, b.top + b.height / 2);
    },
  });

  wireHero();
  wireFlips();
  wireJobSkip();
  wireKonami();
  wireBrand();
  observers();
  tracker.observeSections();
  setTimeout(() => tracker.enableObserver(), 9000);
  consoleEgg();

  setTimeout(() => vfx.toast('🧠', 'このサイトのどこかに<b>ドパ玉が10個</b>あります'), 4200);
}

/* ====================================================== 音 */
function syncSoundBtn() {
  const b = $('#btnSound');
  b.setAttribute('aria-pressed', String(audio.on));
  $('#soundLabel').textContent = audio.on ? 'SOUND ON' : 'SOUND OFF';
}
$('#btnSound').addEventListener('click', () => {
  audio.toggle(); syncSoundBtn(); prog.markDeed('sound');
});

/* ====================================================== ドパ玉の配線 */
function wireBalls() {
  $$('.ballspot').forEach(el => {
    const id = Number(el.dataset.ball);
    if (prog.hasBall(id)) el.classList.add('found');
    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      if (prog.collectBall(id, r.left + r.width / 2, r.top + r.height / 2)) el.classList.add('found');
    });
  });
  // ローダー内のドパ玉は閉じた後も拾えるようにパネル側で案内する
}

/* ====================================================== ヒーロー文字 */
function wireHero() {
  $$('.hero__title .w').forEach((w, i) => {
    w.style.setProperty('--i', i);
    w.addEventListener('click', (e) => {
      w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit');
      audio.tap(i * 2);
      vfx.burst(e.clientX, e.clientY, 16, { speed: 380, size: 6 });
      vfx.kick(7, 0.85);
      scene?.hit(0.5);
      award(15, null);
      prog.markDeed('hero');
    });
  });
}

/* ====================================================== カードめくり */
function wireFlips() {
  $$('.flip').forEach(el => {
    const flip = () => {
      el.classList.toggle('on');
      audio.ui();
      award(30, null);
      prog.markDeed('flip');
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });
}

/* ====================================================== 読んだフリ */
function wireJobSkip() {
  let n = 0;
  const note = $('#jobSkipNote');
  const msgs = [
    'はい、読んだことにしました。',
    '2回目。もう完全に読んだ扱いです。',
    '……本当に読まなくて大丈夫ですか？',
    'では、面接で内容を聞きますね。',
    '読んでください。',
  ];
  $('#jobSkip').addEventListener('click', (e) => {
    note.textContent = msgs[Math.min(n, msgs.length - 1)];
    n++;
    audio.ui();
    vfx.burst(e.clientX, e.clientY, 10, { speed: 240, size: 4 });
    award(50, n === 1 ? '募集要項を読んだフリ' : null);
    if (n === 5) {
      $('#job').scrollIntoView({ behavior: 'smooth' });
      vfx.toast('📄', '<b>戻されました</b>');
    }
  });
}

/* ====================================================== コナミコマンド */
function wireKonami() {
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let p = 0;
  addEventListener('keydown', (e) => {
    p = (e.code === CODE[p]) ? p + 1 : (e.code === CODE[0] ? 1 : 0);
    if (p === CODE.length) {
      p = 0;
      document.body.classList.toggle('rave');
      const on = document.body.classList.contains('rave');
      vfx.confetti(240); vfx.flash(1, 300); audio.fanfare();
      vfx.toast('🕺', on ? '<b>RAVE MODE</b> 起動' : 'RAVE MODE 停止', 3000);
      audio.setIntensity(on ? 1 : 0);
      prog.collectBall(8, innerWidth / 2, innerHeight / 2);
    }
  });
}

/* ====================================================== ロゴ3連打 */
function wireBrand() {
  let n = 0, t = 0;
  $('#brandBtn').addEventListener('click', (e) => {
    const now = performance.now();
    n = (now - t < 700) ? n + 1 : 1;
    t = now;
    $('#brandBtn').classList.remove('knock'); void $('#brandBtn').offsetWidth; $('#brandBtn').classList.add('knock');
    audio.ui();
    if (n >= 3) {
      n = 0;
      e.preventDefault();
      vfx.toast('🎨', 'ロゴを3回叩きましたね。<b>+300 DP</b>', 3400);
      award(300, null);
      vfx.confetti(60);
    }
  });
}

/* ====================================================== コンソール */
function consoleEgg() {
  const css = 'background:linear-gradient(90deg,#ff2e93,#7b2bff);color:#fff;padding:10px 18px;border-radius:8px;font-size:15px;font-weight:bold';
  console.log('%c🧠 ここまで見に来たあなたへ', css);
  console.log(
    '%cわざわざ開発者ツールを開く人、うちが一番ほしい人材です。\n' +
    'コンソールに  dopa()  と打ってEnterを押してください。\n\n' +
    '株式会社next / マーケティング職 採用中',
    'color:#00e5ff;font-size:13px;line-height:1.8'
  );
  window.dopa = () => {
    prog.collectBall(9, innerWidth / 2, innerHeight * 0.4);
    vfx.toast('💻', '<b>コンソールのドパ玉</b>を回収しました', 5000);
    return '見つけましたね。面接でこの話をしてください。';
  };
}

/* ====================================================== 監視・スクロール系 */
function observers() {
  // reveal
  const io = new IntersectionObserver((es) => {
    es.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
      if (en.target.dataset.count !== undefined) countUp(en.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 6) * 0.06 + 's'; io.observe(el); });
  $$('[data-count]').forEach(el => io.observe(el));
  $$('.pcard__gauge-bar i').forEach(el => {
    const o2 = new IntersectionObserver((es) => {
      es.forEach(en => { if (en.isIntersecting) { el.style.width = el.dataset.w + '%'; o2.unobserve(el); } });
    }, { threshold: .4 });
    o2.observe(el);
  });

  // セクション到達
  const secIo = new IntersectionObserver((es) => {
    es.forEach(en => {
      if (!en.isIntersecting) return;
      const k = en.target.dataset.sec;
      prog.markSection(k);
      if (k === 'LOG') renderLog();
    });
  }, { threshold: 0.25 });
  $$('[data-sec]').forEach(el => secIo.observe(el));

  // スクロール進捗 & 3Dへの受け渡し
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const doc = document.documentElement.scrollHeight - innerHeight;
      const p = doc > 0 ? scrollY / doc * 100 : 0;
      $('#progressLine').style.width = p + '%';
      scene?.setScroll(scrollY);
      ticking = false;
    });
  }, { passive: true });

  // カーソル
  if (matchMedia('(hover:hover)').matches) {
    const cur = $('#cursor'), inner = cur.firstElementChild;
    let x = 0, y = 0, tx = 0, ty = 0;
    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY; cur.classList.add('on');
      const hot = e.target.closest('button,a,.flip,.ncard,.pcard,.ballspot,input');
      cur.classList.toggle('is-hot', !!hot);
    }, { passive: true });
    (function raf() {
      x += (tx - x) * 0.24; y += (ty - y) * 0.24;
      inner.style.transform = `translate(${x}px,${y}px)`;
      requestAnimationFrame(raf);
    })();
  }
}

function countUp(el) {
  const to = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const suf = el.dataset.suffix || '';
  const dur = 1500;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min((t - t0) / dur, 1);
    const e = 1 - Math.pow(1 - k, 3);
    const v = to * e;
    el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString()) + suf;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ====================================================== ログ描画 */
let logDone = false;
function renderLog() {
  if (logDone) return;
  logDone = true;
  const ul = $('#logList');
  ul.innerHTML = '';
  const rows = tracker.report({
    spins: slot?.stats.spins ?? 0,
    near: slot?.stats.near ?? 0,
    dp: prog.dp,
    quiz: window.__quiz ? `${window.__quiz.type} / ${window.__quiz.pct}%` : null,
  });
  rows.push(['集めたドパ玉', `${prog.balls.size} / 10`, prog.balls.size >= 5]);
  rows.push(['このサイトの踏破率', `${prog.percent}%`, prog.percent >= 80]);
  rows.push(['現在のレベル', `Lv.${prog.level + 1} ${prog.levelName}`, false]);

  rows.forEach(([k, v, alert], i) => {
    const li = document.createElement('li');
    if (alert) li.className = 'alert';
    li.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><em>${k}</em><b>${v}</b>`;
    ul.appendChild(li);
    setTimeout(() => {
      li.classList.add('in');
      if (i % 3 === 0) audio.ui();
    }, 90 + i * 85);
  });
  setTimeout(() => { audio.impact(); vfx.kick(10, 0.9); }, 90 + rows.length * 85 + 200);
}

/* ====================================================== 応募URL未設定の保険 */
$$('[data-need-url]').forEach(a => {
  a.addEventListener('click', (e) => {
    if (a.getAttribute('href') === '#') {
      e.preventDefault();
      vfx.toast('🔧', '応募フォームのURLが未設定です（README参照）', 4000);
    }
  });
});

/* ====================================================== reduced motion */
if (reduced) document.documentElement.style.scrollBehavior = 'auto';
