/* ==========================================================================
   vfx.js — 2D パーティクル / スクリーンシェイク / フラッシュ / トースト
   ========================================================================== */

const PAL = ['#ff2e93', '#00e5ff', '#ffe500', '#7b2bff', '#b6ff2e', '#ffffff'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

class Particle {
  constructor(o) { Object.assign(this, o); this.life = 1; }
  step(dt) {
    this.vy += this.g * dt;
    this.vx *= this.drag; this.vy *= this.drag;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.vr * dt;
    this.life -= dt / this.ttl;
    return this.life > 0;
  }
  draw(c) {
    const a = Math.max(0, Math.min(1, this.life * 1.6));
    c.globalAlpha = a;
    c.fillStyle = this.color;
    if (this.shape === 'rect') {
      c.save(); c.translate(this.x, this.y); c.rotate(this.rot);
      c.fillRect(-this.r, -this.r * .45, this.r * 2, this.r * .9);
      c.restore();
    } else {
      c.beginPath(); c.arc(this.x, this.y, this.r * this.life, 0, 6.2832); c.fill();
    }
  }
}

class Ring {
  constructor(x, y, color, max = 220, w = 3) {
    this.x = x; this.y = y; this.color = color; this.max = max; this.w = w; this.life = 1;
  }
  step(dt) { this.life -= dt / 0.62; return this.life > 0; }
  draw(c) {
    const t = 1 - this.life;
    const r = this.max * (1 - Math.pow(1 - t, 3));
    c.globalAlpha = this.life * 0.75;
    c.strokeStyle = this.color; c.lineWidth = this.w * this.life;
    c.beginPath(); c.arc(this.x, this.y, r, 0, 6.2832); c.stroke();
  }
}

class FloatText {
  constructor(x, y, text, color, size = 30) {
    this.x = x; this.y = y; this.text = text; this.color = color; this.size = size;
    this.vy = -110; this.life = 1; this.vx = rnd(-38, 38);
  }
  step(dt) {
    this.y += this.vy * dt; this.x += this.vx * dt;
    this.vy += 130 * dt; this.life -= dt / 1.05;
    return this.life > 0;
  }
  draw(c) {
    const e = Math.min(1, (1 - this.life) * 7);
    c.globalAlpha = Math.min(1, this.life * 1.5);
    c.font = `900 ${this.size * (0.7 + 0.3 * e)}px "Anton","Zen Kaku Gothic New",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)';
    c.strokeText(this.text, this.x, this.y);
    c.fillStyle = this.color;
    c.fillText(this.text, this.x, this.y);
  }
}

export class VFX {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.items = [];
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.shake = 0; this.shakeDecay = 0;
    this.last = performance.now();
    this._resize();
    addEventListener('resize', () => this._resize(), { passive: true });
    requestAnimationFrame((t) => this._loop(t));

    this.flashEl = document.getElementById('flash');
    this.toastEl = document.getElementById('toasts');
    this.obsEl = document.getElementById('obs');
    this.shakeTargets = [document.querySelector('main'), document.querySelector('.hud')].filter(Boolean);
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.cv.width = w * this.dpr; this.cv.height = h * this.dpr;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _loop(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const c = this.c;
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.step(dt)) { this.items.splice(i, 1); continue; }
      it.draw(c);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // shake
    if (this.shake > 0.1) {
      this.shake *= this.shakeDecay;
      const a = this.shake;
      const x = rnd(-a, a), y = rnd(-a, a), r = rnd(-a, a) * 0.06;
      this.shakeTargets.forEach(el => { el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`; });
    } else if (this.shake !== 0) {
      this.shake = 0;
      this.shakeTargets.forEach(el => { el.style.transform = ''; });
    }
    requestAnimationFrame((t) => this._loop(t));
  }

  /* ---------------- public ---------------- */

  burst(x, y, n = 18, opt = {}) {
    const spd = opt.speed || 340;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.2832), s = rnd(spd * .25, spd);
      this.items.push(new Particle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        g: opt.g ?? 620, drag: opt.drag ?? 0.965,
        r: rnd(2, opt.size || 6), color: opt.color || pick(PAL),
        ttl: rnd(0.45, opt.ttl || 1.0), rot: rnd(0, 6.28), vr: rnd(-9, 9),
        shape: opt.shape || 'circle',
      }));
    }
  }

  ring(x, y, color = '#ff2e93', max = 230, w = 3) {
    this.items.push(new Ring(x, y, color, max, w));
  }

  text(x, y, txt, color = '#ffe500', size = 32) {
    this.items.push(new FloatText(x, y, txt, color, size));
  }

  confetti(n = 130) {
    for (let i = 0; i < n; i++) {
      this.items.push(new Particle({
        x: rnd(0, this.w), y: rnd(-this.h * 0.3, -10),
        vx: rnd(-90, 90), vy: rnd(140, 420),
        g: 240, drag: 0.995, r: rnd(4, 11), color: pick(PAL),
        ttl: rnd(2.2, 4.2), rot: rnd(0, 6.28), vr: rnd(-11, 11), shape: 'rect',
      }));
    }
  }

  /** 画面外周から中心へ吸い込まれる収束エフェクト（当たり前兆） */
  converge(x, y, n = 40, color = '#ffe500') {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.2832), d = rnd(260, Math.max(this.w, this.h) * .7);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      const s = 620;
      this.items.push(new Particle({
        x: px, y: py, vx: (x - px) / d * s, vy: (y - py) / d * s,
        g: 0, drag: 0.995, r: rnd(2, 5), color, ttl: rnd(.5, .85),
        rot: 0, vr: 0, shape: 'circle',
      }));
    }
  }

  kick(power = 14, decay = 0.9) {
    this.shake = Math.max(this.shake, power);
    this.shakeDecay = decay;
  }

  flash(alpha = 0.85, ms = 130) {
    if (!this.flashEl) return;
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = alpha;
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
      this.flashEl.style.opacity = 0;
    });
  }

  /* ---------------- toasts ---------------- */
  toast(icon, html, ms = 3400) {
    if (!this.toastEl) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<em>${icon}</em><span>${html}</span>`;
    this.toastEl.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 420);
    }, ms);
  }

  /** 監視トースト（右下・👁） */
  observe(html, ms = 5200) {
    if (!this.obsEl) return;
    const el = document.createElement('div');
    el.className = 'obs__item';
    el.innerHTML = `<i>👁</i><span>${html}</span>`;
    this.obsEl.appendChild(el);
    while (this.obsEl.children.length > 3) this.obsEl.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 460);
    }, ms);
  }
}
