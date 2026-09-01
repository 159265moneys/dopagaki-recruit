/* ==========================================================================
   content.js — 数字カード / 社員カード / 連打耐久 / 押すなボタン
   ★ 数字・社員情報は掲載サンプルです（README参照・要差し替え）
   ========================================================================== */

const NUMBERS = [
  { v: 217, suf: '本', label: '月あたりの施策実行数', back: 'うち183本は3日以内に打ち切りました。<b>やめる速さも実力です。</b>' },
  { v: 18, suf: '分', label: '会議の平均時間', back: '30分を超える会議は、前日までに理由の共有が必要です。<b>本当にあります。</b>' },
  { v: 0.5, dec: 1, suf: '日', label: '施策の意思決定にかかる日数', back: 'Slackに「やります」と書けば始まります。<b>稟議はありません。</b>' },
  { v: 8, suf: 'h12m', label: '社員の平均スクリーンタイム', back: '一番短いのが代表（4h03m）で、社内でやや肩身が狭いそうです。' },
  { v: 892341, suf: '回', label: '年間Slack絵文字リアクション数', back: '最多スタンプは <b>:草:</b> でした。2位は :え: です。' },
  { v: 27.4, dec: 1, suf: '歳', label: 'メンバーの平均年齢', back: '最年少22歳、最年長41歳。<b>年次で発言権は変わりません。</b>' },
  { v: 1104, suf: '回', label: '年間「バズった」発言回数', back: '実際に伸びたのは31本。<b>打率2.8%。</b>それでも回し続けます。' },
  { v: 100, suf: '%', label: '「とりあえずやってみよう」が通った割合', back: '通ったあとが本番です。<b>数字が出なければ即やめます。</b>' },
];

const PEOPLE = [
  {
    av: '🔥', name: 'R.A', role: 'CREATIVE DIRECTOR', idx: 97,
    spec: [['スクリーンタイム', '11h04m'], ['得意', 'ショート動画'], ['最高連打', '78回/5秒']],
    quote: '面接で「1.75倍速で喋れます」と言ったら受かりました',
    backT: '入社前はコンビニのバイトとTikTok',
    backP: '今は月40本のクリエイティブを見ています。<br>経歴は本当に関係ないです。',
  },
  {
    av: '📈', name: 'M.S', role: 'GROWTH MANAGER', idx: 88,
    spec: [['スクリーンタイム', '9h21m'], ['得意', '広告運用'], ['通知の数', '1日412件']],
    quote: '通知が来ないと不安なので、自分に通知を送っています',
    backT: 'SQLは入社後に覚えました',
    backP: '数字が面白くなったのは<br>「自分の施策の数字」を見てからです。',
  },
  {
    av: '📱', name: 'K.T', role: 'MARKETING LEAD', idx: 94,
    spec: [['スクリーンタイム', '9h42m'], ['得意', 'SNS運用'], ['開いてるアプリ', '常時7個']],
    quote: 'TikTokを仕事だと言い張って5年目です',
    backT: '言い張り続けたら本当に仕事になりました',
    backP: 'うちはそういう会社です。<br>言い張る力も、採用要件のひとつです。',
  },
  {
    av: '🧠', name: 'Y.N', role: 'CEO', idx: 71,
    spec: [['スクリーンタイム', '4h03m'], ['得意', '意思決定'], ['社内順位', '最下位']],
    quote: '一番ドパガキ度が低いのが私なのは、この会社の課題です',
    backT: 'なので、採用しています',
    backP: '私より脳が焼けている人を探しています。<br>心当たりがあれば、下のボタンから。',
  },
];

const DONOT = [
  '押すなって言いましたよね',
  'もう1回押したら怒りますよ',
  '……',
  'なんで押すんですか',
  'そういうところですよ、ドパガキ',
  '何も出ません。本当に何も出ません',
  '……出しましょうか？',
  'ほら +1,000 DP',
  '味を占めましたね',
  'もう出ません',
  '押すな',
  '押すな',
  '押すな',
  'わかりました。降参です',
  '<b style="color:#ffe500">ドパ玉、差し上げます</b>',
  'もう本当に何もないです',
  'まだ押すんですか',
  '……',
  'あなたのような人を探しています',
  '面接で「押すなボタンを20回押した」と言ってください。<b>伝わります。</b>',
];

export function initNumbers(o) {
  const grid = document.getElementById('numbersGrid');
  NUMBERS.forEach((n, i) => {
    const li = document.createElement('li');
    li.className = 'ncard reveal';
    li.tabIndex = 0;
    li.innerHTML =
      `<b data-count="${n.v}" ${n.dec ? `data-dec="${n.dec}"` : ''} data-suffix="${n.suf}">0</b>` +
      `<span>${n.label}</span><em>タップで裏</em>` +
      `<div class="ncard__back">${n.back}</div>`;
    const toggle = () => {
      li.classList.toggle('open');
      o.audio?.ui();
      if (li.classList.contains('open')) {
        const r = li.getBoundingClientRect();
        o.vfx?.burst(r.left + r.width / 2, r.top + r.height / 2, 10, { speed: 220, size: 4 });
        o.award?.(30, null);
      }
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    grid.appendChild(li);
  });
}

export function initPeople(o) {
  const grid = document.getElementById('peopleGrid');
  PEOPLE.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'pcard reveal';
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="pcard__in">
        <div class="pcard__f">
          <div class="pcard__av">${p.av}</div>
          <div class="pcard__name">${p.name}</div>
          <div class="pcard__role">${p.role}</div>
          <div class="pcard__gauge">
            <div class="pcard__gauge-top"><span>ドパガキ指数</span><b>${p.idx}</b></div>
            <div class="pcard__gauge-bar"><i data-w="${p.idx}"></i></div>
          </div>
          <div class="pcard__spec">${p.spec.map(([k, v]) => `<div><span>${k}</span><em>${v}</em></div>`).join('')}</div>
          <div class="pcard__more">タップで裏 ／ 長押しでもう1個</div>
        </div>
        <div class="pcard__b">
          <h4>${p.backT}</h4>
          <p>${p.backP}</p>
          <small>「${p.quote}」</small>
        </div>
      </div>`;

    let timer = null, longed = false;
    const flip = () => {
      if (longed) { longed = false; return; }
      el.classList.toggle('on');
      o.audio?.ui();
      o.award?.(30, null);
    };
    el.addEventListener('click', flip);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') flip(); });
    el.addEventListener('pointerdown', () => {
      timer = setTimeout(() => {
        longed = true;
        o.onLongPress?.(el, p);
      }, 700);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      el.addEventListener(ev, () => clearTimeout(timer)));
    grid.appendChild(el);
  });
}

/* ------------------------------------------------ 5秒連打耐久 */
export function initBurst(o) {
  const sec = document.getElementById('burst');
  const btn = document.getElementById('burstBtn');
  const label = document.getElementById('burstLabel');
  const elCount = document.getElementById('burstCount');
  const elCps = document.getElementById('burstCps');
  const elTime = document.getElementById('burstTime');
  const elMine = document.getElementById('burstMine');
  const note = document.getElementById('burstNote');
  const DUR = 5000;

  let state = 'idle', count = 0, t0 = 0, raf = 0, best = 0;

  const finish = () => {
    state = 'done';
    sec.classList.remove('playing');
    sec.classList.add('done');
    cancelAnimationFrame(raf);
    elTime.style.transform = 'scaleX(0)';
    label.textContent = 'もう一回';
    best = Math.max(best, count);
    elMine.textContent = best + '回';

    const cps = count / 5;
    let msg, gain;
    if (count >= 78) { msg = '社内最速を抜きました。<b>今すぐ応募してください。</b>'; gain = 3000; }
    else if (count >= 61) { msg = '代表を抜きました。<b>役員面接からで結構です。</b>'; gain = 2000; }
    else if (count >= 45) { msg = '普通に速い。<b>指が仕上がっています。</b>'; gain = 1200; }
    else if (count >= 30) { msg = '平均くらいです。<b>まだ焼けきってません。</b>'; gain = 600; }
    else if (count >= 10) { msg = '落ち着いていますね。<b>健康です。</b>'; gain = 300; }
    else { msg = 'やる気ありますか？'; gain = 100; }
    note.innerHTML = `${count}回（${cps.toFixed(1)} CPS）　${msg}`;

    o.award?.(gain, `連打耐久 ${count}回`);
    o.audio?.fanfare();
    o.vfx?.confetti(Math.min(200, count * 2));
    o.vfx?.flash(0.4, 160);
    o.vfx?.kick(16, 0.9);
    o.onBurstDone?.(count);
  };

  const tick = () => {
    const p = Math.max(0, 1 - (performance.now() - t0) / DUR);
    elTime.style.transform = `scaleX(${p})`;
    elCps.textContent = (count / Math.max(0.2, (performance.now() - t0) / 1000)).toFixed(1);
    if (p <= 0) return finish();
    raf = requestAnimationFrame(tick);
  };

  btn.addEventListener('click', (e) => {
    if (state === 'idle' || state === 'done') {
      state = 'run'; count = 0; t0 = performance.now();
      elCount.textContent = '0'; elCps.textContent = '0.0';
      sec.classList.add('playing'); sec.classList.remove('done');
      label.textContent = '連打!!';
      note.textContent = '止めるな。';
      o.audio?.click();
      raf = requestAnimationFrame(tick);
      return;
    }
    if (state === 'run') {
      count++;
      elCount.textContent = count;
      o.audio?.tap(count % 26);
      o.vfx?.burst(e.clientX, e.clientY, 6, { speed: 260, size: 4, ttl: 0.5 });
      if (count % 10 === 0) {
        o.vfx?.text(e.clientX, e.clientY - 30, `${count}!`, '#ffe500', 30);
        o.vfx?.kick(8, 0.84);
      }
      o.award?.(5, null);
    }
  });
}

/* ------------------------------------------------ 押すなボタン */
export function initDonot(o) {
  const btn = document.getElementById('donotBtn');
  const msg = document.getElementById('donotMsg');
  const cnt = document.getElementById('donotCount');
  let n = 0;

  btn.addEventListener('click', (e) => {
    n++;
    cnt.textContent = n;
    const text = DONOT[Math.min(n - 1, DONOT.length - 1)];
    msg.innerHTML = `<span>${text}</span>`;

    o.audio?.tap(Math.min(n, 20));
    o.vfx?.burst(e.clientX, e.clientY, 16, { speed: 340, color: '#ff3b3b', size: 6 });
    o.vfx?.kick(8 + Math.min(n, 20), 0.86);
    o.award?.(20, null);

    if (n === 8) { o.award?.(1000, '押すなを8回押した'); o.vfx?.confetti(80); o.audio?.fanfare(); }
    if (n === 15) o.onDonot15?.();
    if (n === 20) { o.vfx?.confetti(160); o.audio?.fanfare(); o.award?.(2000, '押すな20連打'); }
    if (n >= 20) btn.style.filter = `hue-rotate(${(n - 20) * 25}deg)`;
    o.onDonot?.(n);
  });
}

export { NUMBERS, PEOPLE };
