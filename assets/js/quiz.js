/* ==========================================================================
   quiz.js — ドパガキ検定（全8問）＋ 結果画像の生成
   ========================================================================== */

const Q = [
  { q: '動画の再生速度は？', a: [['等倍。じっくり派', 0], ['1.25倍', 2], ['1.5倍', 3], ['2倍以上。それでも遅い', 4]] },
  { q: '朝、目を開けてからスマホを触るまでの時間は？', a: [['10分以上', 0], ['3分くらい', 2], ['30秒', 3], ['目を開ける前から握っている', 4]] },
  { q: '動画を見ているとき、同時に何をしてる？', a: [['何も。集中して見る', 0], ['たまにスマホを見る', 2], ['だいたい別のことをしている', 3], ['動画を見ながら別の動画を見ている', 4]] },
  { q: '通知の赤いバッジ、どうする？', a: [['放置できる', 0], ['ちょっと気になる', 2], ['見つけたら即消す', 3], ['消したいので通知を全部ONにした', 4]] },
  { q: '「あと1本だけ」と思ってから寝るまで？', a: [['1本で寝る', 0], ['5本くらい', 2], ['気づいたら朝', 3], ['「あと1本」と思ったことがない。止める気がないので', 4]] },
  { q: '何か調べたいとき、最初に開くのは？', a: [['Google', 0], ['SNSで検索', 2], ['とりあえずおすすめ欄', 3], ['調べない。流れてくるのを待つ', 4]] },
  { q: 'このページのスロット、何回回しました？', a: [['0回。回してない', 0], ['1〜5回', 2], ['6〜20回', 3], ['まだ回してる', 4]], live: 'spins' },
  { q: '長い文章、どうしてます？', a: [['ちゃんと読む', 0], ['飛ばし読み', 2], ['最初の3行だけ', 3], ['ここまでの選択肢も読んでない', 4]] },
];

const TYPES = [
  { max: 6, name: '聖人', pct: 12, desc: 'あなたは健康です。夜もちゃんと眠れているはずです。<br>ただ、健康な人間にこの仕事は向いていません。', verdict: '診断：帰ってよく寝てください' },
  { max: 12, name: '一般人', pct: 38, desc: 'ごく普通の脳です。普通なので、普通のことしか思いつきません。<br>それは強みでもあり、弱みでもあります。', verdict: '診断：伸びしろしかありません' },
  { max: 18, name: 'ドパガキ見習い', pct: 61, desc: '入り口には立っています。<br>あと半年もSNSを見続ければ、無事に完成します。', verdict: '診断：まだ間に合います（何にかは不明）' },
  { max: 23, name: '正規ドパガキ', pct: 79, desc: '立派なドパガキです。日常生活に支障は……まだ出ていません。<br>その感覚、そのまま仕事にできます。', verdict: '診断：そのまま応募してください' },
  { max: 28, name: '重度ドパガキ', pct: 93, desc: 'かなり焼けています。ただしその脳、マーケティングでは<b>完全に資産</b>です。<br>あなたが溶かした時間は、うちでは実務経験として扱われます。', verdict: '診断：至急ご応募ください' },
  { max: 99, name: 'ドパ卿', pct: 108, desc: '計測限界を突破しました。<br>あなたはもう、はめられる側ではありません。<b>はめる側です。</b>', verdict: '診断：役員待遇の可能性があります（未確認）' },
];

export class Quiz {
  constructor(opts) {
    this.o = opts;                    // { audio, vfx, onDone, getSpins, award }
    this.box = document.getElementById('quizBox');
    this.stages = [...this.box.querySelectorAll('.quiz__stage')];
    this.elQ = document.getElementById('quizQ');
    this.elOpts = document.getElementById('quizOpts');
    this.elIdx = document.getElementById('quizIdx');
    this.elBar = document.getElementById('quizBar');
    this.retries = 0;
    this.result = null;

    document.getElementById('quizStart').addEventListener('click', () => this.start());
    document.getElementById('quizRetry').addEventListener('click', () => {
      this.retries++;
      if (this.retries === 3) this.o.onRetry3?.();
      this.start();
    });
    document.getElementById('quizShare').addEventListener('click', () => this.share());
    this._tweet = document.getElementById('quizTweet');
  }

  _stage(name) {
    this.stages.forEach(s => s.classList.toggle('is-active', s.dataset.stage === name));
  }

  start() {
    this.i = 0; this.score = 0;
    this._stage('q');
    this.o.audio?.ui();
    this.render();
  }

  render() {
    const q = Q[this.i];
    this.elIdx.textContent = this.i + 1;
    this.elBar.style.width = (this.i / Q.length * 100) + '%';
    this.elQ.textContent = q.q;
    this.elOpts.innerHTML = '';
    q.a.forEach(([label, pt], k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'qopt';
      b.dataset.k = 'ABCD'[k];
      b.textContent = label;
      b.addEventListener('click', (e) => this.pick(pt, b, e));
      this.elOpts.appendChild(b);
    });
  }

  pick(pt, el, e) {
    this.score += pt;
    el.classList.add('picked');
    this.o.audio?.tap(Math.min(this.i * 2, 12));
    const r = el.getBoundingClientRect();
    this.o.vfx?.burst(e.clientX || r.right - 20, e.clientY || r.top + r.height / 2, 12, { speed: 300, size: 5 });
    this.o.award?.(20, null);
    setTimeout(() => {
      this.i++;
      if (this.i >= Q.length) this.finish();
      else this.render();
    }, 240);
  }

  finish() {
    const t = TYPES.find(x => this.score <= x.max);
    let pct = Math.round(this.score / 32 * 100);
    if (this.score >= 29) pct = 100 + (this.score - 28) * 2;
    pct = Math.max(8, pct);
    this.result = { type: t.name, pct, score: this.score };

    this._stage('r');
    document.getElementById('resultType').innerHTML = t.name;
    document.getElementById('resultDesc').innerHTML = t.desc;
    document.getElementById('resultVerdict').textContent = t.verdict;

    // スコアが実際のスロット回数とズレていたら煽る
    const spins = this.o.getSpins?.() ?? 0;
    if (spins >= 6 && this.score <= 12) {
      document.getElementById('resultVerdict').textContent =
        `※ ただしスロットを${spins}回回した記録が残っています。嘘つきましたね`;
    }

    const arc = document.getElementById('resultArc');
    arc.style.strokeDashoffset = 540;
    const circ = 2 * Math.PI * 86;
    arc.style.strokeDasharray = circ;
    requestAnimationFrame(() => {
      arc.style.strokeDashoffset = circ * (1 - Math.min(pct, 100) / 100);
    });

    // カウントアップ
    const el = document.getElementById('resultPct');
    let v = 0;
    const iv = setInterval(() => {
      v += Math.max(1, Math.ceil((pct - v) / 8));
      if (v >= pct) { v = pct; clearInterval(iv); }
      el.textContent = v;
    }, 26);

    this.o.audio?.impact();
    this.o.audio?.fanfare();
    this.o.vfx?.flash(0.5, 200);
    this.o.vfx?.kick(18, 0.9);
    this.o.vfx?.confetti(pct > 75 ? 160 : 60);
    this.o.award?.(500, `検定クリア：${t.name}`);

    const txt = `ドパガキ検定の結果、私は「${t.name}」でした（ドパガキ度 ${pct}%）\n\n#ドパガキ検定 #株式会社next`;
    this._tweet.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(location.href)}`;

    this.o.onDone?.(this.result);
    this.draw();
  }

  /* ---------- 結果画像（1200×630） ---------- */
  draw() {
    const cv = document.getElementById('shareCanvas');
    const c = cv.getContext('2d');
    const W = 1200, H = 630;
    const { type, pct } = this.result;

    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#16021f'); g.addColorStop(0.55, '#0a0210'); g.addColorStop(1, '#2b0640');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // グロー
    const rg = c.createRadialGradient(W * .78, H * .3, 10, W * .78, H * .3, 460);
    rg.addColorStop(0, 'rgba(255,46,147,.55)'); rg.addColorStop(1, 'rgba(255,46,147,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    const rg2 = c.createRadialGradient(W * .12, H * .85, 10, W * .12, H * .85, 420);
    rg2.addColorStop(0, 'rgba(0,229,255,.35)'); rg2.addColorStop(1, 'rgba(0,229,255,0)');
    c.fillStyle = rg2; c.fillRect(0, 0, W, H);

    // グリッド
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    c.textBaseline = 'alphabetic';
    c.fillStyle = '#ff2e93';
    c.font = '600 22px "Zen Kaku Gothic New",sans-serif';
    c.fillText('ドパガキ検定  ／  株式会社next  MARKETING RECRUIT', 72, 96);

    c.fillStyle = 'rgba(255,255,255,.6)';
    c.font = '500 26px "Zen Kaku Gothic New",sans-serif';
    c.fillText('あなたの診断結果', 72, 190);

    c.fillStyle = '#fff';
    c.font = '400 96px "Dela Gothic One","Zen Kaku Gothic New",sans-serif';
    c.shadowColor = 'rgba(255,46,147,.85)'; c.shadowBlur = 44;
    c.fillText(type, 72, 296);
    c.shadowBlur = 0;

    // ゲージ
    const bx = 72, by = 372, bw = 640, bh = 26;
    c.fillStyle = 'rgba(255,255,255,.1)';
    c.beginPath(); c.roundRect(bx, by, bw, bh, 13); c.fill();
    const gg = c.createLinearGradient(bx, 0, bx + bw, 0);
    gg.addColorStop(0, '#00e5ff'); gg.addColorStop(.5, '#ffe500'); gg.addColorStop(1, '#ff2e93');
    c.fillStyle = gg;
    c.beginPath(); c.roundRect(bx, by, bw * Math.min(pct, 100) / 100, bh, 13); c.fill();

    c.fillStyle = '#ffe500';
    c.font = '400 120px "Anton","Zen Kaku Gothic New",sans-serif';
    c.fillText(String(pct), bx + bw + 34, by + 44);
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.font = '400 40px "Anton",sans-serif';
    c.fillText('%', bx + bw + 34 + c.measureText(String(pct)).width + 96, by + 44);

    c.fillStyle = 'rgba(255,255,255,.55)';
    c.font = '500 24px "Zen Kaku Gothic New",sans-serif';
    c.fillText('ドパガキ度', bx, by + 78);

    c.fillStyle = 'rgba(255,255,255,.85)';
    c.font = '700 30px "Zen Kaku Gothic New",sans-serif';
    c.fillText('ドパガキ、こっち側に来い。', 72, 552);
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.font = '500 22px "Zen Kaku Gothic New",sans-serif';
    c.fillText('#ドパガキ検定', 72, 590);

    c.font = '90px serif';
    c.fillText('🧠', 1060, 570);

    cv.classList.add('on');
  }

  share() {
    const cv = document.getElementById('shareCanvas');
    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dopagaki-${this.result.type}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
    this.o.audio?.ui();
    this.o.vfx?.toast('📸', '結果画像を保存しました');
  }
}
