/* ==========================================================================
   scene3d.js — three.js 背景
   ・ドーパミン C8H11NO2 の分子構造を実際の結合どおりに組む
   ・GPUパーティクルフィールド
   ・UnrealBloom
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* --- ドーパミン（4-(2-アミノエチル)ベンゼン-1,2-ジオール）--------------
   ベンゼン環 + カテコール(OH×2) + エチルアミン鎖。
   座標は概ねの分子形状（単位 = Å 相当のスケール）
------------------------------------------------------------------------ */
const R = 1.4;                       // 芳香環の半径
const ring = [];                     // C1..C6
for (let i = 0; i < 6; i++) {
  const a = (Math.PI / 3) * i + Math.PI / 6;
  ring.push([Math.cos(a) * R, Math.sin(a) * R, 0]);
}
const ATOMS = [
  { el: 'C', p: ring[0] }, { el: 'C', p: ring[1] }, { el: 'C', p: ring[2] },
  { el: 'C', p: ring[3] }, { el: 'C', p: ring[4] }, { el: 'C', p: ring[5] },
  // カテコールの水酸基（C1, C2 に付く）
  { el: 'O', p: [ring[1][0] * 1.95, ring[1][1] * 1.95, 0.18] },
  { el: 'O', p: [ring[2][0] * 1.95, ring[2][1] * 1.95, -0.18] },
  // エチルアミン鎖（C4 から伸びる）
  { el: 'C', p: [ring[4][0] * 1.9 + 0.35, ring[4][1] * 1.9 - 0.5, 0.5] },
  { el: 'C', p: [ring[4][0] * 2.2 + 1.5, ring[4][1] * 2.2 - 0.9, 0.1] },
  { el: 'N', p: [ring[4][0] * 2.4 + 2.6, ring[4][1] * 2.4 - 0.4, 0.6] },
];
const BONDS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],  // 芳香環
  [1, 6], [2, 7],                                  // C–OH
  [4, 8], [8, 9], [9, 10],                         // 側鎖 C–C–N
];
const EL_COLOR = { C: 0xffffff, O: 0xff2e93, N: 0x00e5ff };
const EL_SIZE = { C: 0.30, O: 0.36, N: 0.38 };

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ok = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { this._init(); this.ok = true; } catch (e) {
      console.warn('[scene3d] WebGL unavailable, falling back', e);
      canvas.style.display = 'none';
    }
  }

  _init() {
    const mobile = innerWidth < 760;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.7));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050507, 0.038);

    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 200);
    this.camera.position.set(0, 0, 15);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._lights();
    this._molecule();
    this._field(mobile ? 1800 : 3800);
    this._grid();
    this._post(mobile);

    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2();
    this.mouseT = new THREE.Vector2();
    this.pulse = 0;
    this.spin = 0;
    this.scrollY = 0;
    this.visible = true;

    addEventListener('resize', () => this._resize(), { passive: true });
    addEventListener('pointermove', (e) => {
      this.mouseT.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { this.visible = !document.hidden; });

    this.renderer.setAnimationLoop(() => this._tick());
  }

  _lights() {
    this.scene.add(new THREE.AmbientLight(0x404060, 1.6));
    const l1 = new THREE.PointLight(0xff2e93, 260, 60); l1.position.set(6, 5, 8);
    const l2 = new THREE.PointLight(0x00e5ff, 200, 60); l2.position.set(-7, -4, 6);
    const l3 = new THREE.PointLight(0x7b2bff, 180, 60); l3.position.set(0, 8, -6);
    this.scene.add(l1, l2, l3);
    this.lights = [l1, l2, l3];
  }

  _molecule() {
    const g = new THREE.Group();
    this.mol = g;

    // 原子
    const geoCache = {};
    this.atomMeshes = [];
    ATOMS.forEach((a) => {
      const s = EL_SIZE[a.el];
      geoCache[a.el] ||= new THREE.IcosahedronGeometry(s, 3);
      const m = new THREE.MeshPhysicalMaterial({
        color: EL_COLOR[a.el],
        emissive: EL_COLOR[a.el],
        emissiveIntensity: a.el === 'C' ? 0.25 : 0.9,
        roughness: 0.18, metalness: 0.1,
        clearcoat: 1, clearcoatRoughness: 0.15,
        transmission: a.el === 'C' ? 0.15 : 0,
      });
      const mesh = new THREE.Mesh(geoCache[a.el], m);
      mesh.position.fromArray(a.p);
      mesh.userData.base = mesh.position.clone();
      g.add(mesh);
      this.atomMeshes.push(mesh);
    });

    // 結合（円柱）
    const bondGeo = new THREE.CylinderGeometry(0.062, 0.062, 1, 10, 1, true);
    const bondMat = new THREE.MeshPhysicalMaterial({
      color: 0xdfe4ff, emissive: 0x6d78ff, emissiveIntensity: 0.35,
      roughness: 0.3, metalness: 0.35, transparent: true, opacity: 0.85,
    });
    const up = new THREE.Vector3(0, 1, 0);
    BONDS.forEach(([i, j]) => {
      const a = new THREE.Vector3().fromArray(ATOMS[i].p);
      const b = new THREE.Vector3().fromArray(ATOMS[j].p);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const mesh = new THREE.Mesh(bondGeo, bondMat);
      mesh.position.copy(mid);
      mesh.scale.y = dir.length();
      mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      g.add(mesh);
    });

    // 電子雲っぽいハロー
    const halo = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.7, 2),
      new THREE.MeshBasicMaterial({ color: 0xff2e93, wireframe: true, transparent: true, opacity: 0.045 })
    );
    g.add(halo);
    this.halo = halo;

    g.position.set(0, 0.4, 0);
    g.scale.setScalar(1.05);
    this.root.add(g);
  }

  _field(count) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const C = [new THREE.Color(0xff2e93), new THREE.Color(0x00e5ff), new THREE.Color(0xffe500), new THREE.Color(0x7b2bff)];
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.pow(Math.random(), 0.6) * 26;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
      pos[i * 3 + 2] = r * Math.cos(ph) * 0.8 - 4;
      const c = C[(Math.random() * C.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uSize: { value: innerWidth < 760 ? 1.0 : 1.35 } },
      vertexShader: /* glsl */`
        attribute float aSeed;
        varying vec3 vColor; varying float vA;
        uniform float uTime, uPulse, uSize;
        void main(){
          vColor = color;
          vec3 p = position;
          float t = uTime * (0.15 + aSeed * 0.25);
          p.x += sin(t + aSeed * 8.0) * 1.1;
          p.y += cos(t * 1.3 + aSeed * 5.0) * 0.9;
          p.z += sin(t * 0.7 + aSeed * 3.0) * 1.1;
          // 中心から押し出される衝撃波
          float d = length(p);
          p += normalize(p) * uPulse * (2.6 / max(d, 2.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          gl_PointSize = uSize * (300.0 / max(dist, 1.0)) * (0.5 + aSeed);
          vA = smoothstep(44.0, 8.0, dist) * (0.14 + aSeed * 0.34);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if(d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a * a * vA);
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.root.add(this.points);
  }

  _grid() {
    const grid = new THREE.GridHelper(70, 40, 0xff2e93, 0x2a1240);
    grid.material.transparent = true;
    grid.material.opacity = 0.09;
    grid.position.y = -9;
    this.root.add(grid);
    this.grid = grid;
  }

  _post(mobile) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      mobile ? 0.42 : 0.58,  // strength
      0.55,                  // radius
      0.50                   // threshold
    );
    this.bloomBase = this.bloom.strength;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.2 : 1.5));
    this.composer.setSize(innerWidth, innerHeight);
  }

  _resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setSize(innerWidth, innerHeight);
  }

  /* --------------- 外部から叩く --------------- */
  /** スロットを回した瞬間などの衝撃波 */
  hit(power = 1) {
    this.pulse = Math.max(this.pulse, power);
    this.spin += 0.28 * power;
  }
  /** 大当たり */
  jackpot() {
    this.pulse = 3.2;
    this.spin += 2.4;
    if (this.bloom) this.bloom.strength = 1.9;
  }
  setScroll(y) { this.scrollY = y; }

  _tick() {
    if (!this.visible) return;
    const t = this.clock.getElapsedTime();
    const dt = Math.min(this.clock.getDelta ? 0.016 : 0.016, 0.05);

    // マウス追従（イージング）
    this.mouse.lerp(this.mouseT, 0.045);

    // 分子
    if (this.mol) {
      this.spin *= 0.94;
      this.mol.rotation.y += 0.0022 + this.spin * 0.05;
      this.mol.rotation.x = Math.sin(t * 0.23) * 0.22 + this.mouse.y * 0.22;
      this.mol.rotation.z = Math.cos(t * 0.17) * 0.1;
      const s = 1.05 + this.pulse * 0.16 + Math.sin(t * 1.6) * 0.012;
      this.mol.scale.setScalar(s);
      this.halo.rotation.y -= 0.004;
      this.halo.rotation.x += 0.002;
      this.atomMeshes.forEach((m, i) => {
        const b = m.userData.base;
        const o = Math.sin(t * 2.2 + i) * 0.035;
        m.position.set(b.x + o, b.y + Math.cos(t * 1.9 + i) * 0.035, b.z + o * 0.5);
        m.material.emissiveIntensity = (i < 6 ? 0.25 : 0.9) + this.pulse * 0.9;
      });
    }

    // パーティクル
    if (this.points) {
      this.points.material.uniforms.uTime.value = t;
      this.points.material.uniforms.uPulse.value = this.pulse;
      this.points.rotation.y = t * 0.018 + this.mouse.x * 0.18;
      this.points.rotation.x = this.mouse.y * 0.1;
    }
    if (this.grid) this.grid.position.z = ((t * 1.6) % 3.5) - 1.75;

    // ライト
    this.lights[0].position.x = Math.sin(t * 0.4) * 8;
    this.lights[0].position.y = Math.cos(t * 0.33) * 6;
    this.lights[1].position.x = Math.cos(t * 0.27) * -9;
    this.lights[1].intensity = 200 + this.pulse * 260;

    // カメラ：スクロールでゆっくり引き＆パララックス
    const target = 15 + Math.min(this.scrollY / innerHeight, 4) * 3.4;
    this.camera.position.z += (target - this.camera.position.z) * 0.04;
    this.camera.position.x += (this.mouse.x * 1.5 - this.camera.position.x) * 0.03;
    this.camera.position.y += (-this.mouse.y * 1.0 + Math.min(this.scrollY / innerHeight, 4) * -0.6 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, 0);

    // 減衰
    this.pulse *= 0.9;
    if (this.bloom && this.bloom.strength > this.bloomBase) this.bloom.strength += (this.bloomBase - this.bloom.strength) * 0.08;

    this.composer.render();
  }
}
