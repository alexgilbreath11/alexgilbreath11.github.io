import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.js';

/* ---------- 3D value noise (gradient/Perlin) ---------- */
const P = new Uint8Array(512);
(() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y, z) {
  switch (h & 15) {
    case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
    case 4: return x + z; case 5: return -x + z; case 6: return x - z; case 7: return -x - z;
    case 8: return y + z; case 9: return -y + z; case 10: return y - z; case 11: return -y - z;
    case 12: return y + x; case 13: return -y + z; case 14: return y - x; default: return -y - z;
  }
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
  const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const lerp = (t, a, b) => a + t * (b - a);
  return lerp(w,
    lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)),
      lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)),
      lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1))));
}
/* ridged fbm — rounded ridges with narrow deep grooves = gyri / sulci */
function ridged(x, y, z, oct = 3) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise(x * freq, y * freq, z * freq)) * 2.1;
    sum += Math.max(0, n) * amp; norm += amp; amp *= 0.5; freq *= 2.07;
  }
  return sum / norm;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- anatomy ---------- */
const REGIONS = [
  { id: 'frontal', label: 'Frontal lobe', anchor: [0.52, 0.26, 0.66], core: '#bcd3e7' },
  { id: 'parietal', label: 'Parietal lobe', anchor: [0.40, 0.60, -0.14], core: '#7ba2c6' },
  { id: 'temporal', label: 'Temporal lobe', anchor: [0.66, -0.34, 0.10], core: '#4d7597' },
  { id: 'occipital', label: 'Occipital lobe', anchor: [0.34, 0.16, -0.86], core: '#325274' },
  { id: 'cerebellum', label: 'Cerebellum', anchor: [0.24, -0.44, -0.86], core: '#284660' }
];
const RINDEX = {}; REGIONS.forEach((r, i) => (RINDEX[r.id] = i));

/* cerebrum surface: direction on unit sphere -> sculpted, gyrified point.
   returns { p, sulc } where sulc is 0 on a gyral crest, 1 in a sulcal groove */
function cerebrum(d) {
  const f = Math.max(d.z, 0), b = Math.max(-d.z, 0);
  let sx = 0.74, sy = 0.66, sz = 1.0;
  sx *= 1 - 0.26 * f * f; sy *= 1 - 0.14 * f * f;
  sx *= 1 - 0.30 * b * b; sy *= 1 - 0.26 * b * b;
  if (d.y < 0) sy *= 0.70;
  let x = d.x * sx, y = d.y * sy, z = d.z * sz;
  // temporal lobe: lateral-inferior bulge, mid-anterior
  const t = Math.exp(-(Math.pow((Math.abs(x) - 0.58) / 0.40, 2) + Math.pow((y + 0.28) / 0.34, 2) + Math.pow((z - 0.02) / 0.70, 2)));
  x += Math.sign(x) * 0.16 * t; y -= 0.19 * t;
  // underside rises under the frontal pole and under the occipital (where the cerebellum sits)
  const fu = smooth(0.30, 0.95, z) * smooth(0.02, -0.42, y);
  y += 0.20 * fu;
  const ou = smooth(-0.40, -0.95, z) * smooth(0.02, -0.40, y);
  y += 0.17 * ou;
  // pre-occipital / temporal-pole notch
  const notch = Math.exp(-(Math.pow((z - 0.40) / 0.13, 2) + Math.pow((y + 0.34) / 0.16, 2)));
  y += 0.09 * notch;
  // occipital pole pulled back and down a touch
  z -= 0.06 * b * b; y -= 0.05 * b * b;

  const len = Math.hypot(x, y, z);
  // gyri: rounded crests along the zero-contours of a smooth field, narrow sulci between
  // gyri: wandering ridges — sinusoidal bands whose phase is warped by noise
  const w1 = noise(x * 1.9 + 3, y * 1.1 - 2, z * 1.9 + 5);
  const w2 = noise(x * 4.1 - 6, y * 2.4 + 8, z * 4.1 - 1);
  const w3 = noise(x * 8.0 + 2, y * 5.0 + 1, z * 8.0 + 4);
  const ph1 = y * 30.0 + 13.0 * w1 + 6.0 * w2 + 2.2 * w3;
  const ph2 = (0.5 * y + 0.86 * z) * 26.0 + 11.0 * noise(x * 2.3 - 4, y * 1.5 + 6, z * 2.3 - 7) + 5.0 * w2;
  const band = 0.62 * Math.sin(ph1) + 0.62 * Math.sin(ph2);
  const ridge = smooth(-0.40, 0.55, band);
  const groove = 1 - ridge;
  let disp = 0.055 * Math.pow(ridge, 0.7);
  // lateral (Sylvian) fissure — runs up and back on the lateral face
  const lat = smooth(0.30, 0.62, Math.abs(x));
  const line = -0.07 - 0.20 * z;
  disp -= 0.105 * lat * Math.exp(-Math.pow((y - line) / 0.060, 2)) * smooth(-0.75, -0.5, z) * (1 - smooth(0.62, 0.86, z));
  // central sulcus — a deeper oblique groove over the vertex
  const cs = Math.exp(-Math.pow((z - 0.30 + 0.42 * Math.abs(x)) / 0.055, 2)) * smooth(-0.1, 0.35, y);
  disp -= 0.045 * cs;
  // interhemispheric fissure
  disp -= 0.13 * Math.exp(-Math.pow(x / 0.05, 2)) * smooth(-0.55, 0.1, y);

  const k = (len + disp) / len;
  return { p: new THREE.Vector3(x * k, y * k, z * k), sulc: groove };
}

function regionOf(c) {
  const j = 0.055 * noise(c.x * 2.3, c.y * 2.3, c.z * 2.3);
  if (c.y < -0.16 + j && c.z > -0.42 && Math.abs(c.x) > 0.20) return 'temporal';
  if (c.z > 0.28 + j) return 'frontal';
  if (c.z < -0.46 + j) return 'occipital';
  if (c.y > -0.02 + j) return 'parietal';
  return 'temporal';
}

const XRAY_VERT = `
  attribute float aSulc;
  varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vP;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vS = aSulc; vP = position;
    gl_Position = projectionMatrix * mv;
  }`;
const XRAY_FRAG = `
  uniform vec3 uBase; uniform vec3 uAccent; uniform float uGlow; uniform float uBoost; uniform float uDim;
  uniform vec3 cF; uniform vec3 cP; uniform vec3 cT; uniform vec3 cO;
  uniform float uLobes; uniform float uLobeId;
  varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vP;
  void main(){
    vec3 N = normalize(vN), V = normalize(vV);
    // smooth lobe fields, so the boundaries read as soft anatomical borders
    float wob = 0.035 * sin(vP.y * 7.0 + vP.x * 5.0);
    float aT = smoothstep(-0.12, -0.20, vP.y + wob) * smoothstep(-0.48, -0.40, vP.z) * smoothstep(0.16, 0.24, abs(vP.x));
    float wF = smoothstep(0.26, 0.33, vP.z + wob);
    float wO = smoothstep(-0.42, -0.50, vP.z + wob);
    float aF = wF * (1.0 - aT);
    float aO = wO * (1.0 - aT) * (1.0 - wF);
    float aP = max(0.0, 1.0 - aT - aF - aO);
    vec3 lobe = (cF*aF + cP*aP + cT*aT + cO*aO) / max(0.0001, aF + aP + aT + aO);
    vec3 tint = mix(uBase, lobe, uLobes);
    float own = uLobes < 0.5 ? 1.0
      : (uLobeId < 0.5 ? aF : uLobeId < 1.5 ? aP : uLobeId < 2.5 ? aT : aO);

    vec3 L1 = normalize(vec3(-0.42, 0.78, 0.55));
    vec3 L2 = normalize(vec3(0.72, -0.10, 0.42));
    vec3 L3 = normalize(vec3(0.15, 0.35, -0.90));
    float d1 = max(dot(N, L1), 0.0);
    float d2 = max(dot(N, L2), 0.0);
    float d3 = max(dot(N, L3), 0.0);
    float groove = smoothstep(0.25, 0.95, vS);
    float ao = mix(1.0, 0.30, groove);
    vec3 base = mix(tint, tint * 0.34, groove);
    vec3 col = base * (0.34 + 0.60*d1 + 0.30*d2 + 0.16*d3) * ao;
    vec3 H = normalize(L1 + V);
    col += vec3(1.0) * pow(max(dot(N, H), 0.0), 34.0) * 0.16 * ao;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float g = uGlow * own;
    col += uAccent * fres * (0.26 + 0.45*g);
    col = mix(col, mix(col, uAccent, 0.30) * 1.40, g);
    col *= 1.0 + 0.10*uBoost;
    col *= 1.0 - 0.42*uDim*own;
    col = col / (col + 0.82) * 1.62;
    gl_FragColor = vec4(col, 1.0);
  }`;

/* boundary edges of a triangle soup — the seams where one lobe meets the next */
function seamEdges(arr) {
  const cnt = new Map();
  const q = n => { const r = Math.round(n * 1e4); return (r === 0 ? 0 : r).toString(); };
  const key = (x, y, z) => q(x) + '_' + q(y) + '_' + q(z);
  for (let i = 0; i < arr.length; i += 9) {
    const t = [[arr[i], arr[i + 1], arr[i + 2]], [arr[i + 3], arr[i + 4], arr[i + 5]], [arr[i + 6], arr[i + 7], arr[i + 8]]];
    for (let e = 0; e < 3; e++) {
      const A = t[e], B = t[(e + 1) % 3];
      const ka = key(A[0], A[1], A[2]), kb = key(B[0], B[1], B[2]);
      const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const rec = cnt.get(k);
      if (rec) rec.n++; else cnt.set(k, { n: 1, A, B });
    }
  }
  const out = [];
  for (const r of cnt.values()) if (r.n === 1) out.push(r.A[0], r.A[1], r.A[2], r.B[0], r.B[1], r.B[2]);
  return out;
}

const SPARK_VERT = `
  attribute float aSeed; attribute float aRegion;
  uniform float uTime; uniform float uActive; uniform float uSize;
  varying float vHot;
  void main(){
    vec3 p = position;
    p.x += sin(uTime*0.7 + aSeed*17.0)*0.012;
    p.y += cos(uTime*0.6 + aSeed*23.0)*0.012;
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    float tw = pow(sin(uTime*1.9 + aSeed*31.0)*0.5+0.5, 3.0);
    float hot = (abs(aRegion - uActive) < 0.5) ? 1.0 : 0.0;
    vHot = mix(0.22 + 0.60*tw, 0.55 + 0.45*tw, hot) * mix(0.26, 1.0, hot);
    gl_PointSize = uSize * (1.1 + 2.2*tw + 2.0*hot) * (1.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = `
  uniform vec3 uColor; uniform vec3 uHotColor; varying float vHot;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 c = mix(uColor, uHotColor, clamp(vHot*1.1-0.35, 0.0, 1.0));
    gl_FragColor = vec4(c, a * vHot * 0.75);
  }`;

class BrainStage extends HTMLElement {
  connectedCallback() {
    if (this._up) return; this._up = true;
    this.style.display = 'block'; this.style.position = 'absolute';
    this.style.inset = '0'; this.style.width = '100%'; this.style.height = '100%';
    this._paused = false; this._hover = null; this._selected = null;
    this._spin = 0.16; this._spinNow = 0.16; this._boost = 0; this._mx = 0; this._my = 0;
    this._init();
  }

  _init() {
    const w = this.clientWidth || 800, h = this.clientHeight || 600;
    const renderer = this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearAlpha(0);
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    this.appendChild(renderer.domElement);

    const scene = this._scene = new THREE.Scene();
    const cam = this._cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 40);
    cam.position.set(0.15, 0.16, 3.9);
    cam.lookAt(0, -0.03, 0);

    const root = this._root = new THREE.Group();
    const brain = this._brain = new THREE.Group();
    root.add(brain); scene.add(root);
    root.rotation.set(-0.06, -1.32, 0);

    const edge = new THREE.Color('#cfe4f5');
    const CORES = {};
    REGIONS.forEach(r => (CORES[r.id] = r.core));
    CORES.stem = '#1d3448';
    const FILLS = { frontal: 0.17, parietal: 0.145, temporal: 0.115, occipital: 0.09, cerebellum: 0.09 };
    const mkMat = (lobeId = -1, baseHex = '#5980a6') => new THREE.ShaderMaterial({
      uniforms: {
        uBase: { value: new THREE.Color(baseHex) }, uAccent: { value: new THREE.Color('#9dc2e0') },
        uGlow: { value: 0 }, uBoost: { value: 0 }, uDim: { value: 0 },
        cF: { value: new THREE.Color(CORES.frontal) }, cP: { value: new THREE.Color(CORES.parietal) },
        cT: { value: new THREE.Color(CORES.temporal) }, cO: { value: new THREE.Color(CORES.occipital) },
        uLobes: { value: lobeId >= 0 ? 1 : 0 }, uLobeId: { value: Math.max(0, lobeId) }
      },
      vertexShader: XRAY_VERT, fragmentShader: XRAY_FRAG,
      side: THREE.FrontSide, transparent: false, depthWrite: true
    });

    /* ---- cerebrum, split into anatomical regions ---- */
    const sphere = new THREE.SphereGeometry(1, 340, 230);
    const sp = sphere.attributes.position;
    const sulc = new Float32Array(sp.count);
    const v = new THREE.Vector3();
    for (let i = 0; i < sp.count; i++) {
      v.set(sp.getX(i), sp.getY(i), sp.getZ(i)).normalize();
      const q = cerebrum(v);
      sp.setXYZ(i, q.p.x, q.p.y, q.p.z);
      sulc[i] = q.sulc;
    }
    sphere.setAttribute('aSulc', new THREE.Float32BufferAttribute(sulc, 1));
    sphere.computeVertexNormals();
    const tri = sphere.toNonIndexed();
    const tp = tri.attributes.position, tn = tri.attributes.normal, ts = tri.attributes.aSulc;
    const buckets = {}; REGIONS.forEach(r => (buckets[r.id] = { p: [], n: [], s: [] }));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ctr = new THREE.Vector3();
    for (let i = 0; i < tp.count; i += 3) {
      a.fromBufferAttribute(tp, i); b.fromBufferAttribute(tp, i + 1); c.fromBufferAttribute(tp, i + 2);
      ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      const bk = buckets[regionOf(ctr)];
      for (let k = 0; k < 3; k++) {
        bk.p.push(tp.getX(i + k), tp.getY(i + k), tp.getZ(i + k));
        bk.n.push(tn.getX(i + k), tn.getY(i + k), tn.getZ(i + k));
        bk.s.push(ts.getX(i + k));
      }
    }
    this._regionMeshes = {};
    for (const r of REGIONS) {
      const bk = buckets[r.id]; if (!bk.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
      g.setAttribute('aSulc', new THREE.Float32BufferAttribute(bk.s, 1));
      const m = new THREE.Mesh(g, mkMat(['frontal', 'parietal', 'temporal', 'occipital'].indexOf(r.id)));
      m.name = r.id; m.userData.region = r.id;
      brain.add(m); this._regionMeshes[r.id] = [m];
    }
    sphere.dispose();

    /* ---- cerebellum: foliated ellipsoid ---- */
    const cb = new THREE.SphereGeometry(1, 180, 130);
    const cbp = cb.attributes.position;
    const cbs = new Float32Array(cbp.count);
    for (let i = 0; i < cbp.count; i++) {
      v.set(cbp.getX(i), cbp.getY(i), cbp.getZ(i)).normalize();
      let x = v.x * 0.32, y = v.y * 0.195, z = v.z * 0.255;
      const len = Math.hypot(x, y, z);
      // horizontal foliation + vermis groove at the midline
      const fl = clamp(Math.abs(noise(x * 9, y * 52, z * 9)) * 1.5, 0, 1);
      let disp = 0.017 * (1 - fl);
      disp -= 0.022 * Math.exp(-Math.pow(x / 0.028, 2));
      const k = (len + disp) / len;
      cbp.setXYZ(i, x * k, y * k, z * k);
      cbs[i] = fl;
    }
    cb.setAttribute('aSulc', new THREE.Float32BufferAttribute(cbs, 1));
    cb.computeVertexNormals();
    const cbMesh = new THREE.Mesh(cb, mkMat(-1, CORES.cerebellum));
    cbMesh.position.set(0, -0.34, -0.66); cbMesh.rotation.x = 0.24;
    cbMesh.name = 'cerebellum'; cbMesh.userData.region = 'cerebellum';
    brain.add(cbMesh);
    this._regionMeshes.cerebellum = (this._regionMeshes.cerebellum || []).concat(cbMesh);

    /* ---- brainstem (pons + medulla), not selectable ---- */
    const stemMat = mkMat(-1, CORES.stem);
    const pons = new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), stemMat);
    pons.scale.set(0.8, 1.45, 0.85); pons.position.set(0, -0.34, -0.26);
    const med = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 26), stemMat);
    med.scale.set(0.85, 1.7, 0.85); med.position.set(0, -0.52, -0.31);
    brain.add(pons, med);
    this._stemMat = stemMat;

    /* ---- synapse sparks inside the volume ---- */
    const N = 620, pos = new Float32Array(N * 3), seed = new Float32Array(N), reg = new Float32Array(N);
    let n = 0, guard = 0;
    while (n < N && guard++ < N * 40) {
      const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (d.length() > 1) continue;
      const dir = d.clone().normalize();
      const hull = cerebrum(dir).p;
      const t = 0.30 + Math.pow(Math.random(), 0.8) * 0.55;
      const p = hull.multiplyScalar(t);
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      seed[n] = Math.random();
      reg[n] = RINDEX[regionOf(hull.clone().multiplyScalar(1 / t))];
      n++;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    sg.setAttribute('aRegion', new THREE.Float32BufferAttribute(reg, 1));
    this._sparkMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uActive: { value: -1 }, uSize: { value: 20 * Math.min(devicePixelRatio, 2) },
        uColor: { value: new THREE.Color('#9dc2e0') }, uHotColor: { value: new THREE.Color('#ffffff') }
      },
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    brain.add(new THREE.Points(sg, this._sparkMat));

    /* ---- interaction ---- */
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2(-2, -2);
    this._pick = Object.values(this._regionMeshes).flat();
    this._onMove = e => {
      const r = this.getBoundingClientRect();
      this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this._mx = (e.clientX - r.left) / r.width - 0.5;
      this._my = (e.clientY - r.top) / r.height - 0.5;
      this._cx = e.clientX; this._cy = e.clientY;
    };
    this._onLeave = () => { this._ndc.set(-2, -2); this._mx = this._my = 0; this._setHover(null); };
    this._onClick = () => {
      if (this._hover) this.selectRegion(this._hover);
      else this.clearSelection();
    };
    this.addEventListener('pointermove', this._onMove);
    this.addEventListener('pointerleave', this._onLeave);
    this.addEventListener('click', this._onClick);

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._buildLabels();

    // skip rendering while scrolled out of view (e.g. embedded above a long page) --
    // keeps the rAF loop alive so it resumes the instant this comes back into view
    this._visible = true;
    this._io = new IntersectionObserver(entries => { this._visible = entries[0].isIntersecting; }, { threshold: 0 });
    this._io.observe(this);

    this._clock = new THREE.Clock();
    this._loop = () => {
      this._raf = requestAnimationFrame(this._loop);
      if (this._visible) this._frame();
    };
    this._loop();
  }

  _resize() {
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this._renderer.setSize(w, h);
    this._cam.aspect = w / h; this._cam.updateProjectionMatrix();
    const s = Math.min(1, Math.max(0.62, w / 1200));
    this._root.scale.setScalar(w < 760 ? 0.78 : 1);
    this._sparkMat.uniforms.uSize.value = 20 * Math.min(devicePixelRatio, 2) * s;
  }

  _setHover(id) {
    if (this._hover === id) return;
    this._hover = id;
    this.style.cursor = id ? 'pointer' : 'default';
    const r = REGIONS.find(x => x.id === id);
    this.dispatchEvent(new CustomEvent('brain-hover', {
      detail: { id, label: r ? r.label : null, x: this._cx || 0, y: this._cy || 0 }
    }));
  }

  _buildLabels() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = this._svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible');
    this.appendChild(svg);
    this._labels = REGIONS.map(r => {
      const g = document.createElementNS(NS, 'g');
      const line = document.createElementNS(NS, 'polyline');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', '#9dc2e0');
      line.setAttribute('stroke-width', '1');
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '2');
      dot.setAttribute('fill', '#cfe4f5');
      const plate = document.createElementNS(NS, 'rect');
      plate.setAttribute('fill', '#0b0e11');
      plate.setAttribute('opacity', '0.72');
      plate.setAttribute('height', '17');
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('fill', '#dce9f4');
      text.setAttribute('style', 'font-family:"Barlow Condensed",system-ui,sans-serif;font-size:13px;letter-spacing:.18em;text-transform:uppercase');
      text.textContent = r.label.toUpperCase();
      g.append(line, dot, plate, text);
      svg.appendChild(g);
      return { r, g, line, dot, plate, text, o: 0, w: r.label.length * 8.2 + 10 };
    });
  }

  _keepOuts() {
    if (this._koFrame === undefined) this._koFrame = 0;
    if (this._koFrame-- <= 0) {
      this._koFrame = 8;
      const host = this.getBoundingClientRect();
      const w = host.width, h = host.height;
      const nodes = document.querySelectorAll('[data-keepout]');
      this._ko = Array.from(nodes).map(n => {
        const r = n.getBoundingClientRect();
        return { x0: r.left - host.left - 8, x1: r.right - host.left + 8, y0: r.top - host.top - 8, y1: r.bottom - host.top + 8 };
      });
      // page chrome: name block, nav, figure caption, readout
      this._ko.push(
        { x0: 0, x1: w * 0.30, y0: 0, y1: h * 0.40 },
        { x0: w * 0.60, x1: w, y0: 0, y1: h * 0.16 },
        { x0: 0, x1: w * 0.30, y0: h - 44, y1: h },
        { x0: w * 0.30, x1: w * 0.70, y0: h - 56, y1: h }
      );
    }
    return this._ko || [];
  }

  _updateLabels(dt) {
    if (!this._labels) return;
    const w = this.clientWidth, h = this.clientHeight;
    const camPos = this._cam.position;
    const p = new THREE.Vector3(), nrm = new THREE.Vector3();
    const active = this._selected || this._hover;
    for (const L of this._labels) {
      p.set(L.r.anchor[0], L.r.anchor[1], L.r.anchor[2]);
      nrm.copy(p).normalize().transformDirection(this._brain.matrixWorld);
      let toCamT = camPos.clone().sub(p.clone().applyMatrix4(this._brain.matrixWorld)).normalize();
      // mirror to whichever hemisphere currently faces the camera
      if (nrm.dot(toCamT) < 0.12) {
        p.x = -p.x;
        nrm.copy(p).normalize().transformDirection(this._brain.matrixWorld);
      }
      p.applyMatrix4(this._brain.matrixWorld);
      const toCam = camPos.clone().sub(p).normalize();
      const facing = nrm.dot(toCam);
      const want = facing > 0.10 ? 1 : 0;
      L.o += (want - L.o) * Math.min(1, dt * 5);
      const s = p.clone().project(this._cam);
      const sx = (s.x * 0.5 + 0.5) * w, sy = (-s.y * 0.5 + 0.5) * h;
      const cen = new THREE.Vector3().setFromMatrixPosition(this._brain.matrixWorld).project(this._cam);
      const cx = (cen.x * 0.5 + 0.5) * w, cy = (-cen.y * 0.5 + 0.5) * h;
      let dx = sx - cx, dy = sy - cy;
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      let ex = sx + dx * 96, ey = sy + dy * 96;
      ey = clamp(ey, 104, h - 78);
      ex = clamp(ex, 96, w - 96);
      // keep out of the name block (top-left) and the nav (top-right)
      // keep clear of page chrome and the drifting photo frames
      const blocks = this._keepOuts();
      let side = ex >= cx ? 1 : -1;
      let blocked = false;
      if (blocks.length) {
        const plateW = L.w;
        const hits = (yy, sgn) => {
          const x0 = sgn > 0 ? ex + 32 : ex - 32 - plateW;
          const r0 = { x0, x1: x0 + plateW, y0: yy - 10, y1: yy + 8 };
          return blocks.some(b => r0.x1 > b.x0 && r0.x0 < b.x1 && r0.y1 > b.y0 && r0.y0 < b.y1);
        };
        if (hits(ey, side)) {
          let found = false;
          for (const sgn of [side, -side]) {
            for (const off of [0, 40, -40, 80, -80, 120, -120, 160, -160]) {
              const cand = clamp(ey + off, 104, h - 78);
              if (!hits(cand, sgn)) { ey = cand; side = sgn; found = true; break; }
            }
            if (found) break;
          }
          blocked = !found;
        }
      }
      if (blocked) L.o = Math.max(0, L.o - dt * 4);
      const right = side > 0;
      L.ey = (L.ey === undefined) ? ey : L.ey + (ey - L.ey) * Math.min(1, dt * 6);
      ey = L.ey;
      const tick = right ? 30 : -30;
      L.line.setAttribute('points', `${sx.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${(ex + tick).toFixed(1)},${ey.toFixed(1)}`);
      L.dot.setAttribute('cx', sx.toFixed(1)); L.dot.setAttribute('cy', sy.toFixed(1));
      L.text.setAttribute('x', (ex + tick + (right ? 7 : -7)).toFixed(1));
      L.text.setAttribute('y', (ey + 4).toFixed(1));
      L.text.setAttribute('text-anchor', right ? 'start' : 'end');
      const px0 = ex + tick + (right ? 7 : -7);
      L.plate.setAttribute('x', (right ? px0 - 5 : px0 - L.w + 5).toFixed(1));
      L.plate.setAttribute('y', (ey - 9).toFixed(1));
      L.plate.setAttribute('width', L.w.toFixed(1));
      const on = active === L.r.id;
      L.g.setAttribute('opacity', (L.o * (active ? (on ? 1 : 0.30) : 0.78)).toFixed(3));
      L.line.setAttribute('stroke', on ? '#e9f3fb' : '#9dc2e0');
      L.text.setAttribute('fill', on ? '#ffffff' : '#dce9f4');
    }
  }

  _frame() {
    const dt = Math.min(0.05, this._clock.getDelta()), t = this._clock.elapsedTime;
    // hover pick
    if (this._ndc.x > -1.5) {
      this._ray.setFromCamera(this._ndc, this._cam);
      const hit = this._ray.intersectObjects(this._pick, false)[0];
      this._setHover(hit ? hit.object.userData.region : null);
    }
    const idleSpin = (this._paused || this._noSpin) ? 0 : 0.16;
    // pointer position steers the rotation: right/left spins about Y, top/bottom tilts about X
    const dz = v => (Math.abs(v) < 0.05 ? 0 : Math.sign(v) * (Math.abs(v) - 0.05) / 0.45);
    const steerY = this._paused ? 0 : dz(this._mx) * 1.5;
    const steerX = this._paused ? 0 : dz(this._my) * 1.1;
    this._velY = (this._velY || 0) + ((idleSpin + steerY) - (this._velY || 0)) * Math.min(1, dt * 3.0);
    this._velX = (this._velX || 0) + (steerX - (this._velX || 0)) * Math.min(1, dt * 3.0);
    this._driftAmt = (this._driftAmt === undefined) ? 1 : this._driftAmt + ((this._paused ? 0 : 1) - this._driftAmt) * Math.min(1, dt * 1.8);
    const d = this._driftAmt;

    this._root.rotation.y += this._velY * dt;
    this._tilt = clamp((this._tilt || 0) + this._velX * dt, -0.72, 0.72);
    if (Math.abs(steerX) < 0.002) this._tilt += (0 - this._tilt) * Math.min(1, dt * 0.8);
    this._root.rotation.x = this._tilt - 0.06 + Math.sin(t * 0.47) * 0.035 * d;
    this._tz = (this._tz || 0) + ((Math.sin(t * 0.33) * 0.05 * d) - (this._tz || 0)) * Math.min(1, dt * 2.2);
    this._root.rotation.z = this._tz;
    this._brain.position.y = Math.sin(t * 0.62) * 0.035 * d;
    this._brain.position.x = Math.sin(t * 0.41 + 1.1) * 0.022 * d;

    const wantBoost = this._hover ? 1 : 0;
    this._boost += (wantBoost - this._boost) * Math.min(1, dt * 4.5);
    const active = this._selected || this._hover;
    for (const r of REGIONS) {
      const on = r.id === active ? 1 : 0;
      const dim = active && !on ? 1 : 0;
      for (const m of (this._regionMeshes[r.id] || [])) {
        const u = m.material.uniforms;
        u.uGlow.value += (on - u.uGlow.value) * Math.min(1, dt * 5.5);
        u.uBoost.value = this._boost;
        u.uDim.value += (dim - u.uDim.value) * Math.min(1, dt * 4.0);
      }
      const lm = this._seams && this._seams[r.id];
      if (lm) {
        const want = on ? 0.95 : (active ? 0.16 : 0.30 + 0.12 * this._boost);
        lm.opacity += (want - lm.opacity) * Math.min(1, dt * 5.0);
      }
    }
    this._stemMat.uniforms.uBoost.value = this._boost;
    this._sparkMat.uniforms.uTime.value = t;
    this._sparkMat.uniforms.uActive.value = active ? RINDEX[active] : -1;
    this._renderer.render(this._scene, this._cam);
    this._updateLabels(dt);
  }

  /* ---- public API ---- */
  selectRegion(id) {
    if (!REGIONS.some(r => r.id === id)) return;
    this._selected = id; this._paused = true; this._pauseT = this._clock.elapsedTime;
    this.dispatchEvent(new CustomEvent('brain-select', { detail: { id, label: REGIONS.find(r => r.id === id).label } }));
  }
  clearSelection() {
    if (!this._selected) return;
    this._selected = null; this._paused = false;
    this.dispatchEvent(new CustomEvent('brain-select', { detail: { id: null, label: null } }));
  }
  get regions() { return REGIONS.slice(); }
  set autoSpin(v) { this._noSpin = !v; }
  get autoSpin() { return !this._noSpin; }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    this._ro && this._ro.disconnect();
    this._io && this._io.disconnect();
  }
}
if (!customElements.get('brain-stage')) customElements.define('brain-stage', BrainStage);
