/* =====================================================================
   3D 실물 화면 (Three.js) : 입체도 · 평면도 · 정면도 · 중앙
   ===================================================================== */
const T3 = { inited: false, ver: -1, flow: '', s: 0.02, off: { x: 0, y: 0 }, board: { w: 16, d: 11 }, parts: [], pick: [], particles: [], tween: null,
  cam: { az: 0, pol: 0.92, r: 14, tx: 0, tz: 0 }, ptr: new Map(), downInfo: null, active: false };
const wrap3 = $('#c3dWrap');
const P3 = (x, y, h) => new THREE.Vector3((x - T3.off.x) * T3.s, h || 0, (y - T3.off.y) * T3.s);
const stdMat = (color, rough, metal, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough === undefined ? 0.55 : rough, metalness: metal || 0 }, extra || {}));
function mkCanvasTex(w, h) { const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const t = new THREE.CanvasTexture(cvs); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return { cvs, g: cvs.getContext('2d'), tex: t }; }

function init3D() {
  if (T3.inited || !window.THREE) return;
  if (THREE.ColorManagement) THREE.ColorManagement.enabled = true;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputEncoding = THREE.sRGBEncoding; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  wrap3.appendChild(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef2fb);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab6d4, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.62); key.position.set(6, 14, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 40; key.shadow.bias = -0.0006;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.25); fill.position.set(-8, 6, -6); scene.add(fill);
  const group = new THREE.Group(); scene.add(group);
  Object.assign(T3, { renderer: r, scene, camera: cam, group, key, inited: true });
  /* 입력 */
  const el = r.domElement;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); T3.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); T3.downInfo = { x: e.clientX, y: e.clientY, moved: false, n: T3.ptr.size }; });
  el.addEventListener('pointermove', e => {
    const p = T3.ptr.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (T3.downInfo && Math.hypot(e.clientX - T3.downInfo.x, e.clientY - T3.downInfo.y) > 6) T3.downInfo.moved = true;
    T3.tween = null;
    if (T3.ptr.size === 2) {
      const arr = Array.from(T3.ptr.values()); const o = arr.find(q => q !== p);
      const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      T3.cam.r = clamp(T3.cam.r * (d0 / Math.max(10, d1)), 3, 60); panCam(dx / 2, dy / 2);
    } else if (p.b === 2 || e.shiftKey) panCam(dx, dy);
    else { T3.cam.az -= dx * 0.008; T3.cam.pol = clamp(T3.cam.pol - dy * 0.006, 0.02, 1.52); }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    const had = T3.ptr.delete(e.pointerId);
    if (had && T3.downInfo && !T3.downInfo.moved && T3.downInfo.n === 1 && e.type === 'pointerup') pick3D(e);
    if (!T3.ptr.size) T3.downInfo = null;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); T3.tween = null; T3.cam.r = clamp(T3.cam.r * Math.exp(e.deltaY * 0.0012), 3, 60); }, { passive: false });
}
function panCam(dx, dy) {
  const c = T3.cam, k = c.r * 0.0016;
  const cx = Math.cos(c.az), sx = Math.sin(c.az);
  c.tx -= (dx * cx) * k; c.tz += (dx * sx) * k;
  c.tx -= (dy * sx) * k * (c.pol < 0.5 ? 1 : 0.6); c.tz -= (dy * cx) * k * (c.pol < 0.5 ? 1 : 0.6);
}
function resize3D() {
  if (!T3.inited) return;
  const r = wrap3.getBoundingClientRect(); if (r.width < 10) return;
  T3.renderer.setSize(r.width, r.height, false); T3.camera.aspect = r.width / r.height; T3.camera.updateProjectionMatrix();
}
function enter3D() { T3.active = true; T3.ver = -1; resize3D(); setCam('iso', true); }
function leave3D() { T3.active = false; }
function mark3D() { T3.ver = -1; }

/* ---------- 카메라 ---------- */
function fitDist() {
  const fov = T3.camera.fov * PI / 180, asp = T3.camera.aspect;
  const dW = (T3.board.w / 2) / (Math.tan(fov / 2) * asp), dD = (T3.board.d / 2) / Math.tan(fov / 2);
  return Math.max(dW, dD) * 1.02 + 1.0;
}
function setCam(name, instant) {
  if (!T3.inited) return;
  const r = fitDist();
  const target = name === 'plan' ? { az: 0, pol: 0.025, r: r * 0.98, tx: 0, tz: 0 }
    : name === 'front' ? { az: 0, pol: 1.4, r: r * 0.95, tx: 0, tz: 0 }
    : { az: 0, pol: 0.95, r: r * 1.02, tx: 0, tz: 0 };
  setActive('[data-cam]', b => b.dataset.cam === name);
  if (instant) { Object.assign(T3.cam, target); T3.tween = null; return; }
  T3.tween = { from: Object.assign({}, T3.cam), to: target, t: 0 };
}
function applyCam() {
  const c = T3.cam, sp = Math.sin(c.pol), cp = Math.cos(c.pol), cam = T3.camera;
  cam.position.set(c.tx + c.r * sp * Math.sin(c.az), c.r * cp + 0.25, c.tz + c.r * sp * Math.cos(c.az));
  cam.lookAt(c.tx, 0.25, c.tz);
}

/* ---------- 모델 만들기 ---------- */
function disposeTree(o) {
  o.traverse(m => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) { const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); }
  });
}
function tubeMesh(curve, r, color, seg) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 24, r, 8, false), stdMat(color, 0.45, 0.05));
  m.castShadow = true; return m;
}
function addMesh(parent, geo, mat, x, y, z, shadow) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; }
const WIRE_COL = 0x5aa0e0;

function makePost(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  addMesh(g, new THREE.CylinderGeometry(0.24, 0.27, 0.07, 20), stdMat(0x7f93ab, 0.6, 0.2), 0, 0.035, 0);
  addMesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16), stdMat(0x15161a, 0.4), 0, 0.17, 0);
  addMesh(g, new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), stdMat(0x15161a, 0.4), 0, 0.29, 0);
  return g;
}
function leadTo(grp, from, to, color, r) {
  const mid = from.clone().lerp(to, 0.5); mid.y = Math.max(from.y, to.y) + 0.04;
  grp.add(tubeMesh(new THREE.QuadraticBezierCurve3(from, mid, to), r || 0.055, color, 10));
}
function compGroup(c) { const g = new THREE.Group(); g.position.copy(P3(c.x, c.y, 0)); g.rotation.y = -c.rot * PI / 180; return g; }

function buildBattery(c) {
  const g = compGroup(c), nav = stdMat(0x2c4268, 0.6);
  addMesh(g, new THREE.BoxGeometry(2.3, 0.16, 1.0), nav, 0, 0.08, 0);
  [-1, 1].forEach(sx => {
    addMesh(g, new THREE.BoxGeometry(0.14, 0.82, 1.0), nav, sx * 1.1, 0.41, 0);
    [-1, 1].forEach(sz => addMesh(g, new THREE.BoxGeometry(0.62, 0.52, 0.12), nav, sx * 0.64, 0.42, sz * 0.44));
  });
  const cell = new THREE.Group(); cell.position.y = 0.52; cell.rotation.z = PI / 2;
  const tx = mkCanvasTex(256, 256), q = tx.g;
  q.fillStyle = '#35b394'; q.fillRect(0, 0, 256, 256); q.fillStyle = '#d6f5ea'; q.font = '800 70px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
  [64, 192].forEach(x => { q.save(); q.translate(x, 128); q.rotate(PI / 2); q.fillText('AA', 0, -30); q.font = '700 44px sans-serif'; q.fillText(fVal(c.V) + 'V', 0, 40); q.restore(); q.font = '800 70px sans-serif'; });
  tx.tex.needsUpdate = true;
  const body = addMesh(cell, new THREE.CylinderGeometry(0.36, 0.36, 1.35, 28), new THREE.MeshStandardMaterial({ map: tx.tex, roughness: 0.35, metalness: 0.25 }), 0, -0.275, 0);
  addMesh(cell, new THREE.CylinderGeometry(0.36, 0.36, 0.55, 28), stdMat(0xe0a526, 0.3, 0.6), 0, 0.675, 0);
  addMesh(cell, new THREE.CylinderGeometry(0.13, 0.13, 0.09, 16), stdMat(0xe0a526, 0.3, 0.6), 0, 0.99, 0);
  addMesh(cell, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), stdMat(0xc7ccd4, 0.3, 0.8), 0, -0.97, 0);
  if (c.flip) cell.rotation.y = PI;
  g.add(cell);
  const sp = c.flip ? 1 : -1;   /* (+)쪽이 -x (뒤집히면 +x) */
  leadTo(g, new THREE.Vector3(sp * 1.15, 0.5, 0), new THREE.Vector3(sp * 1.4, 0.2, 0), 0xe33a3a);
  leadTo(g, new THREE.Vector3(-sp * 1.15, 0.5, 0), new THREE.Vector3(-sp * 1.4, 0.2, 0), 0x1c2333);
  return { g, c, h: 0.55, half: 1.0 };
}
function glowTex() {
  const t = mkCanvasTex(128, 128), q = t.g, gr = q.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,90,1)'); gr.addColorStop(0.3, 'rgba(255,184,40,.6)'); gr.addColorStop(1, 'rgba(255,160,20,0)');
  q.fillStyle = gr; q.fillRect(0, 0, 128, 128); t.tex.needsUpdate = true; return t.tex;
}
let GLOW = null;
function buildBulb(c) {
  const g = compGroup(c);
  addMesh(g, new THREE.CylinderGeometry(0.62, 0.66, 0.16, 32), stdMat(0x7d8da3, 0.45, 0.35), 0, 0.08, 0);
  addMesh(g, new THREE.CylinderGeometry(0.34, 0.36, 0.5, 24), stdMat(0xd9a21f, 0.3, 0.7), 0, 0.41, 0);
  [0.24, 0.4, 0.56].forEach(y => { const t = addMesh(g, new THREE.TorusGeometry(0.36, 0.05, 8, 24), stdMat(0xf0bd3c, 0.25, 0.8), 0, y, 0); t.rotation.x = PI / 2; });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.4, emissive: 0xffb300, emissiveIntensity: 0 });
  const glass = addMesh(g, new THREE.SphereGeometry(0.62, 32, 24), glassM, 0, 1.22, 0, false);
  const fil = addMesh(g, new THREE.TorusGeometry(0.16, 0.025, 8, 20, PI * 1.5), stdMat(0xc79a3a, 0.3, 0.6), 0, 1.16, 0); fil.rotation.z = -0.4;
  [-0.1, 0.1].forEach(x => addMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), stdMat(0xc79a3a, 0.3, 0.6), x, 0.9, 0, false));
  if (!GLOW) GLOW = glowTex();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  sprite.position.set(0, 1.22, 0); sprite.scale.set(3, 3, 1); g.add(sprite);
  const light = new THREE.PointLight(0xffc860, 0, 9, 2); light.position.set(0, 1.4, 0); g.add(light);
  [-1, 1].forEach(s => { addMesh(g, new THREE.BoxGeometry(0.34, 0.05, 0.3), stdMat(0xd9a21f, 0.3, 0.7), s * 0.66, 0.15, 0); leadTo(g, new THREE.Vector3(s * 0.72, 0.18, 0), new THREE.Vector3(s * 1.2, 0.2, 0), WIRE_COL); });
  return { g, c, glassM, sprite, light, h: 0.3, half: 0.62 };
}
function buildResistor(c) {
  const g = compGroup(c);
  const body = addMesh(g, new THREE.CylinderGeometry(0.22, 0.22, 1.2, 24), stdMat(0xe7cc9a, 0.7), 0, 0.32, 0); body.rotation.z = PI / 2;
  [-1, 1].forEach(s => addMesh(g, new THREE.SphereGeometry(0.25, 20, 14), stdMat(0xe7cc9a, 0.7), s * 0.6, 0.32, 0));
  const bs = bandsFor(c.R);
  [[-0.38, bs[0]], [-0.18, bs[1]], [0.02, bs[2]], [0.42, '#d4af37']].forEach(([x, col]) => {
    const b = addMesh(g, new THREE.CylinderGeometry(0.235, 0.235, 0.1, 24), stdMat(new THREE.Color(col), 0.55), x, 0.32, 0); b.rotation.z = PI / 2;
  });
  [-1, 1].forEach(s => leadTo(g, new THREE.Vector3(s * 0.82, 0.32, 0), new THREE.Vector3(s * 1.2, 0.2, 0), 0xaeb6c2, 0.045));
  return { g, c, h: 0.32, half: 0.85 };
}
function buildSwitch(c) {
  const g = compGroup(c);
  addMesh(g, new THREE.BoxGeometry(2.0, 0.16, 0.8), stdMat(0x2c4268, 0.6), 0, 0.08, 0);
  addMesh(g, new THREE.BoxGeometry(0.32, 0.3, 0.34), stdMat(0xd4a21c, 0.3, 0.7), -0.7, 0.3, 0);
  addMesh(g, new THREE.BoxGeometry(0.32, 0.3, 0.34), stdMat(0xd4a21c, 0.3, 0.7), 0.7, 0.3, 0);
  const lever = new THREE.Group(); lever.position.set(-0.7, 0.5, 0); g.add(lever);
  const arm = addMesh(lever, new THREE.BoxGeometry(1.4, 0.11, 0.15), stdMat(0xe6b02a, 0.25, 0.8), 0.7, 0, 0);
  const ball = addMesh(lever, new THREE.SphereGeometry(0.2, 20, 16), stdMat(0xff6a64, 0.3), 1.52, 0, 0);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.set(0.2, 0.5, 0); g.add(hit);
  [arm, ball, hit, ...g.children.filter(m => m.isMesh)].forEach(m => { m.userData.sw = c.id; });
  addMesh(lever, new THREE.CylinderGeometry(0.14, 0.14, 0.2, 16), stdMat(0xd4a21c, 0.3, 0.7), 0, 0, 0).rotation.x = PI / 2;
  [-1, 1].forEach(s => leadTo(g, new THREE.Vector3(s * 0.85, 0.3, 0), new THREE.Vector3(s * 1.0, 0.2, 0), WIRE_COL));
  return { g, c, lever, ang: c.closed ? 0 : 0.95, h: 0.42, half: 0.9, hit };
}
function dispTex(w, h) { return mkCanvasTex(w, h); }
function paintDisp(d, text, col, bg) {
  const q = d.g, w = d.cvs.width, h = d.cvs.height;
  q.fillStyle = bg || '#06182a'; q.fillRect(0, 0, w, h); q.fillStyle = col; q.font = '800 ' + Math.round(h * 0.6) + 'px monospace'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, w / 2, h / 2 + 4);
  d.tex.needsUpdate = true;
}
/* 교과서 실험용 계기: 주황 케이스 + 비스듬한 흰 눈금판 + 단자(검은 2개, 빨간 1개) */
function meterBody3D(g, kind, c, jx) {
  addMesh(g, new THREE.BoxGeometry(2.4, 0.5, 2.2), stdMat(0xe8761a, 0.45), 0, 0.25, 0.06);
  const d = mkCanvasTex(416, 240);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 1.2), new THREE.MeshBasicMaterial({ map: d.tex, side: THREE.DoubleSide }));
  pl.rotation.x = -PI / 2 + 0.55; pl.position.set(0, 0.8, -0.35); g.add(pl);
  const rim = addMesh(g, new THREE.BoxGeometry(2.3, 0.07, 0.07), stdMat(0xc9600d, 0.5), 0, 0.5, 0.2); rim.rotation.x = 0;
  const pts = jx.map((x, k) => {
    const p = new THREE.Vector3(x * 0.02, 0.5, 0.72);
    addMesh(g, new THREE.CylinderGeometry(0.15, 0.17, 0.2, 18), stdMat(k === 0 ? 0xc4161c : 0x16161a, 0.4), p.x, 0.6, p.z);
    addMesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), stdMat(0xcfd6e2, 0.3, 0.8), p.x, 0.72, p.z);
    return p;
  });
  return { d, pts };
}
function buildAmmeter(c) {
  const g = compGroup(c);
  const { d } = meterBody3D(g, 'ammeter', c, [36, 0, -36]);
  return { g, c, disp: d, last: '', h: 0.5, half: 1.2, kind: 'ammeter' };
}
function buildVoltmeter(c) {
  const g = new THREE.Group(); g.position.copy(P3(c.x, c.y, 0));
  const { d, pts } = meterBody3D(g, 'voltmeter', c, VJX);
  const jacks = pts.map(p => new THREE.Vector3(p.x, 0.72, p.z));
  const probes = [];
  for (let k = 0; k < 3; k++) {
    const tp = tpos(c, k), w = P3(tp.x, tp.y, 0), col = k ? 0x15161a : 0xe33a3a;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 14), stdMat(col, 0.4)); handle.position.copy(w).setY(0.75); handle.castShadow = true; T3.group.add(handle);
    const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), stdMat(0xdfe3ea, 0.3, 0.8)); tipM.position.copy(w).setY(0.3); T3.group.add(tipM);
    const start = jacks[k].clone().add(g.position), end = w.clone().setY(1.15);
    const mid = start.clone().lerp(end, 0.5); mid.y = 1.5;
    const lead = tubeMesh(new THREE.CatmullRomCurve3([start, new THREE.Vector3(start.x, 1.0, start.z + 0.3), mid, end]), 0.045, col, 30); T3.group.add(lead);
    probes.push(handle, tipM, lead);
  }
  return { g, c, disp: d, last: '', probes, h: 0, half: 0, kind: 'voltmeter' };
}
function buildClamp(c) {
  const g = new THREE.Group(); g.position.copy(P3(c.x, c.y, 0));
  const tg = c._target ? byId(c._target) : null; let dir = new THREE.Vector3(1, 0, 0);
  if (tg) { const a = tpos(tg, 0), b = tpos(tg, 1); dir = new THREE.Vector3(b.x - a.x, 0, b.y - a.y).normalize(); }
  const ring = addMesh(g, new THREE.TorusGeometry(0.5, 0.11, 12, 28), stdMat(0x5b6678, 0.4, 0.4), 0, 0.3, 0);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(1.2);
  addMesh(g, new THREE.BoxGeometry(1.1, 0.6, 0.9), stdMat(0x3b4658, 0.5), side.x, 0.3, side.z);
  const d = dispTex(256, 96); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.4), new THREE.MeshBasicMaterial({ map: d.tex })); pl.rotation.x = -PI / 2; pl.position.set(side.x, 0.62, side.z); g.add(pl);
  return { g, c, disp: d, last: '', h: 0, half: 0 };
}
function buildWire(c) {
  const a = P3(c.a.x, c.a.y, 0.28), b = P3(c.b.x, c.b.y, 0.28);
  const L = a.distanceTo(b); const grp = new THREE.Group();
  if (L < 0.05) return { g: grp, c, curve: null, len: 0 };
  const mid = a.clone().lerp(b, 0.5); mid.y += 0.06 + Math.min(0.3, L * 0.035);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  grp.add(tubeMesh(curve, 0.075, WIRE_COL, Math.max(12, Math.round(L * 8))));
  return { g: grp, c, curve, len: L };
}

function rebuild3D() {
  const gr = T3.group;
  while (gr.children.length) { const o = gr.children[0]; gr.remove(o); disposeTree(o); }
  T3.parts = []; T3.pick = []; T3.particles = [];
  const b = contentBounds();
  T3.off = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  const bw = Math.max(11, (b.x1 - b.x0) * T3.s + 3.5), bd = Math.max(8, (b.y1 - b.y0) * T3.s + 3.5);
  T3.board = { w: bw, d: bd };
  /* 판 */
  const slab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.5, bd), stdMat(0xdfe6f5, 0.85)); slab.position.y = -0.25; slab.receiveShadow = true; gr.add(slab);
  const gt = mkCanvasTex(64, 64), q = gt.g; q.fillStyle = '#e4eaf8'; q.fillRect(0, 0, 64, 64); q.strokeStyle = '#b9c6e6'; q.lineWidth = 3; q.strokeRect(0, 0, 64, 64);
  gt.tex.wrapS = gt.tex.wrapT = THREE.RepeatWrapping; gt.tex.repeat.set(bw, bd); gt.tex.offset.set(0.5, 0.5); gt.tex.needsUpdate = true;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.5, bd - 0.5), new THREE.MeshStandardMaterial({ map: gt.tex, roughness: 0.9 })); top.rotation.x = -PI / 2; top.position.y = 0.003; top.receiveShadow = true; gr.add(top);
  gt.tex.repeat.set(bw - 0.5, bd - 0.5);
  /* 부품 */
  const seen = new Set();
  for (const c of S.comps) {
    let part = null;
    switch (c.type) {
      case 'wire': part = buildWire(c); break; case 'battery': part = buildBattery(c); break; case 'bulb': part = buildBulb(c); break;
      case 'resistor': part = buildResistor(c); break; case 'switch': part = buildSwitch(c); break; case 'ammeter': part = buildAmmeter(c); break;
      case 'voltmeter': part = buildVoltmeter(c); break; case 'clamp': part = buildClamp(c); break;
    }
    if (!part) continue;
    gr.add(part.g); T3.parts.push(part);
    if (c.type === 'switch') part.g.traverse(m => { if (m.userData.sw) T3.pick.push(m); });
    if (c.type !== 'voltmeter' && c.type !== 'ammeter') for (let k = 0; k < nTerms(c); k++) {
      const tp = tpos(c, k), key = Math.round(tp.x) + ',' + Math.round(tp.y);
      if (seen.has(key)) continue; seen.add(key);
      const p = P3(tp.x, tp.y, 0); gr.add(makePost(p.x, p.z));
    }
  }
  /* 흐름 입자 */
  if (UI.flow !== 'off') {
    const mat = UI.flow === 'electron' ? new THREE.MeshBasicMaterial({ color: 0x1f6bff }) : new THREE.MeshBasicMaterial({ color: 0xff8a00 });
    const geo = UI.flow === 'electron' ? new THREE.SphereGeometry(0.085, 12, 10) : new THREE.ConeGeometry(0.09, 0.26, 10);
    for (const part of T3.parts) {
      const c = part.c; if (!nTerms(c) || c.type === 'voltmeter' || c.type === 'ammeter') continue;
      const a = tpos(c, 0), b2 = tpos(c, 1);
      let path;
      if (c.type === 'wire') { if (!part.curve) continue; path = { len: part.len, at: t => part.curve.getPointAt(t) }; }
      else { const h = part.h, pa = P3(a.x, a.y, h), pb = P3(b2.x, b2.y, h); path = { len: pa.distanceTo(pb), at: t => pa.clone().lerp(pb, t), mid: true }; }
      if (path.len < 0.3) continue;
      const n = Math.max(2, Math.floor(path.len / 0.55)), meshes = [];
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; gr.add(m); meshes.push(m); }
      T3.particles.push({ part, path, meshes, n, ph: Math.random() });
    }
  }
  T3.ver = S.ver; T3.flow = UI.flow;
  T3.key.shadow.camera.left = -bw / 2 - 2; T3.key.shadow.camera.right = bw / 2 + 2; T3.key.shadow.camera.top = bd / 2 + 2; T3.key.shadow.camera.bottom = -bd / 2 - 2; T3.key.shadow.camera.updateProjectionMatrix();
}

/* ---------- 매 프레임 갱신 ---------- */
function update3D(dt) {
  const up = new THREE.Vector3(0, 1, 0);
  for (const p of T3.parts) {
    const c = p.c;
    if (c.type === 'bulb') {
      const br = c._br || 0;
      p.glassM.emissiveIntensity = br * 0.95; p.sprite.material.opacity = Math.min(0.62, br * 0.7); p.sprite.scale.setScalar(0.7 + 1.9 * br); p.light.intensity = br * 1.4;
    } else if (c.type === 'switch') {
      const tgt = c.closed ? 0 : 0.95; p.ang += (tgt - p.ang) * Math.min(1, dt * 12); p.lever.rotation.z = p.ang;
    } else if (c.type === 'ammeter') {
      const s = (c._read || 0).toFixed(3) + '|' + c._u + '|' + c._rng; if (s !== p.last) { p.last = s; paintFace3D(p.disp, 'ammeter', c); }
    } else if (c.type === 'voltmeter') {
      const s = (c._read || 0).toFixed(3) + '|' + c._u + '|' + c._valid; if (s !== p.last) { p.last = s; paintFace3D(p.disp, 'voltmeter', c); }
    } else if (c.type === 'clamp') {
      const s = (c._target ? Math.abs(c._read) : 0).toFixed(2) + ' A'; if (s !== p.last) { p.last = s; paintDisp(p.disp, s, '#7dff9a'); }
    }
  }
  for (const q of T3.particles) {
    const c = q.part.c, I = c._I || 0, a = Math.abs(I);
    if (a < 0.004) { q.meshes.forEach(m => (m.visible = false)); continue; }
    const dirI = I > 0 ? 1 : -1, dir = UI.flow === 'current' ? dirI : -dirI;
    const speed = (0.35 + 1.1 * Math.min(1, a / 1.5)) / q.path.len;
    q.ph = ((q.ph + dir * speed * dt) % 1 + 1) % 1;
    for (let i = 0; i < q.n; i++) {
      const t = ((q.ph + i / q.n) % 1 + 1) % 1, m = q.meshes[i];
      if (q.path.mid && Math.abs(t * q.path.len - q.path.len / 2) < q.part.half) { m.visible = false; continue; }
      m.visible = true; const pt = q.path.at(t); m.position.copy(pt);
      if (UI.flow === 'current') {
        const t2 = clamp(t + 0.01 * dirI, 0, 1), t1 = clamp(t - 0.01 * dirI, 0, 1), tg = q.path.at(t2).sub(q.path.at(t1));
        if (tg.lengthSq() > 1e-9) { tg.normalize().multiplyScalar(dir * dirI >= 0 ? 1 : -1); m.quaternion.setFromUnitVectors(up, tg); }
      }
    }
  }
}
function render3D(dt) {
  if (!T3.inited || !T3.active) return;
  if (T3.ver !== S.ver || T3.flow !== UI.flow) rebuild3D();
  if (T3.tween) {
    const tw = T3.tween; tw.t = Math.min(1, tw.t + dt / 0.55); const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
    for (const k of ['az', 'pol', 'r', 'tx', 'tz']) T3.cam[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    if (tw.t >= 1) T3.tween = null;
  }
  applyCam(); update3D(dt);
  T3.renderer.render(T3.scene, T3.camera);
}
function pick3D(e) {
  const r = T3.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, T3.camera);
  const hit = rc.intersectObjects(T3.pick, false)[0];
  if (hit) {
    const c = byId(hit.object.userData.sw);
    if (c) { c.closed = !c.closed; recompute(); if (window.onModelChange) window.onModelChange(); toast('스위치 ' + (c.closed ? 'ON (닫힘)' : 'OFF (열림)')); }
  }
}
