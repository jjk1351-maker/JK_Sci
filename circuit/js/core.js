/* =====================================================================
   전기회로 실험실 · core  (모델 · 연결 · 회로 해석)
   ===================================================================== */
'use strict';
const PI = Math.PI;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* 부품 반길이(단자까지의 거리, px) */
const HW = { battery: 70, bulb: 60, resistor: 60, switch: 50, ammeter: 60 };
const NAMES = { wire: '전선', battery: '건전지', bulb: '꼬마전구', resistor: '저항', switch: '스위치', ammeter: '전류계', voltmeter: '전압계', clamp: '집게 전류계' };

const S = { comps: [], links: [], nextId: 1, selId: null, ver: 0, res: null };
const UI = { view: '2d', flow: 'current', style: 'real', showVal: true, pan: false };

/* ---------- 기본 조회 ---------- */
const byId = id => S.comps.find(c => c.id === id);
const mk = (id, k) => id + ':' + k;
const parse = r => { const i = r.indexOf(':'); return { c: byId(+r.slice(0, i)), k: +r.slice(i + 1) }; };
const isFree = c => c.type === 'wire' || c.type === 'voltmeter';   // 끝점이 자유롭게 움직이는 부품
/* (−)단자 눈금: 단자 번호 → 최대 측정값 (0번은 (+)단자) */
const RANGES = { ammeter: [0, 5, 0.5], voltmeter: [0, 15, 5] };
const RNAME = { ammeter: ['+', '5A', '500mA'], voltmeter: ['+', '15V', '5V'] };
const nTerms = c => (c.type === 'clamp' ? 0 : (RANGES[c.type] ? RANGES[c.type].length : 2));
/* 실제로 쓰이는 (−)단자: 연결된 것 중 가장 큰 눈금(앞 번호), 없으면 1번 */
function useTerm(c) {
  const n = nTerms(c);
  for (let k = 1; k < n; k++) if (linked(mk(c.id, k))) return k;
  return 1;
}

function newComp(type, x, y, props) {
  const c = { id: S.nextId++, type, x, y, rot: 0 };
  switch (type) {
    case 'wire': c.a = { x: x - 50, y }; c.b = { x: x + 50, y }; break;
    case 'battery': c.V = 10; c.flip = false; break;
    case 'ammeter': c.flip = false; break;
    case 'bulb': c.R = 10; break;
    case 'resistor': c.R = 10; break;
    case 'switch': c.closed = false; break;
    case 'voltmeter': c.pa = { x: x - 32, y: y + 100 }; c.pb = { x: x + 32, y: y + 100 }; c.pc = { x: x + 98, y: y + 62 }; break;
  }
  if (props) Object.assign(c, props);
  S.comps.push(c);
  return c;
}

function tpos(c, k) {
  if (c.type === 'wire') return k === 0 ? c.a : c.b;
  if (c.type === 'voltmeter') return k === 0 ? c.pa : (k === 1 ? c.pb : c.pc);
  const hw = HW[c.type];
  let lx = k === 0 ? -hw : hw, ly = 0;
  if (c.type === 'ammeter') { lx = [36, 0, -36][k]; ly = 36; }   /* 단자(검은 2개, 빨간 1개)가 아래쪽에 한 줄로 */
  else if (c.type === 'battery' && c.flip) lx = -lx;
  const a = c.rot * PI / 180;
  return { x: c.x + lx * Math.cos(a) - ly * Math.sin(a), y: c.y + lx * Math.sin(a) + ly * Math.cos(a) };
}
const posOf = r => { const { c, k } = parse(r); return tpos(c, k); };
function moveFree(c, k, x, y) {
  const p = tpos(c, k); p.x = x; p.y = y;
}
function allTerms() {
  const out = [];
  for (const c of S.comps) for (let k = 0; k < nTerms(c); k++) { const p = tpos(c, k); out.push({ ref: mk(c.id, k), c, k, x: p.x, y: p.y }); }
  return out;
}

/* ---------- 연결(link) ---------- */
function hasLink(a, b) { return S.links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a)); }
function addLink(a, b) { if (a !== b && !hasLink(a, b)) S.links.push({ a, b }); }
const linksOf = r => S.links.filter(l => l.a === r || l.b === r).map(l => (l.a === r ? l.b : l.a));
const linked = r => S.links.some(l => l.a === r || l.b === r);
function removeLinksOf(r) { S.links = S.links.filter(l => l.a !== r && l.b !== r); }
function removeLinksOfComp(c) { S.links = S.links.filter(l => parse(l.a).c !== c && parse(l.b).c !== c); }

/* 같은 위치에 있는 단자들을 모두 하나의 접속점으로 연결 */
function connectAt(ref, targetRef, tol = 5) {
  const tp = posOf(targetRef), me = parse(ref).c;
  addLink(ref, targetRef);
  for (const t of allTerms()) {
    if (t.c === me || t.ref === targetRef) continue;
    if (Math.hypot(t.x - tp.x, t.y - tp.y) <= tol) { addLink(ref, t.ref); addLink(targetRef, t.ref); }
  }
}
function autoLink(tol = 3) {
  const T = allTerms();
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    if (T[i].c === T[j].c) continue;
    if (Math.hypot(T[i].x - T[j].x, T[i].y - T[j].y) <= tol) addLink(T[i].ref, T[j].ref);
  }
}

/* 고정 부품(건전지·전구 등) 단자에 붙은 '자유 끝점'(전선·집게)이 따라오도록 위치 동기화 */
function syncLinks() {
  const adj = new Map();
  for (const l of S.links) {
    if (!adj.has(l.a)) adj.set(l.a, []); if (!adj.has(l.b)) adj.set(l.b, []);
    adj.get(l.a).push(l.b); adj.get(l.b).push(l.a);
  }
  const seen = new Set(), q = [];
  for (const r of adj.keys()) { const { c } = parse(r); if (c && !isFree(c)) { seen.add(r); q.push(r); } }
  while (q.length) {
    const r = q.shift(), p = posOf(r);
    for (const n of adj.get(r) || []) {
      if (seen.has(n)) continue;
      const { c, k } = parse(n);
      if (c && isFree(c)) { moveFree(c, k, p.x, p.y); seen.add(n); q.push(n); }
    }
  }
}

/* ---------- 실행 취소 ---------- */
const undoStack = [];
const snapJSON = () => JSON.stringify({ comps: S.comps, links: S.links, nextId: S.nextId }, (k, v) => (k[0] === '_' ? undefined : v));
const redoStack = [];
function pushUndo() { undoStack.push(snapJSON()); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; }
function undo() {
  if (typeof CH !== 'undefined' && CH.saved) return false;
  const s = undoStack.pop(); if (!s) return false;
  redoStack.push(snapJSON());
  const o = JSON.parse(s);
  S.comps = o.comps; S.links = o.links; S.nextId = o.nextId;
  if (!byId(S.selId)) S.selId = null;
  touch(); return true;
}
function redo() {
  if (typeof CH !== 'undefined' && CH.saved) return false;
  const s = redoStack.pop(); if (!s) return false;
  undoStack.push(snapJSON());
  const o = JSON.parse(s);
  S.comps = o.comps; S.links = o.links; S.nextId = o.nextId;
  if (!byId(S.selId)) S.selId = null;
  touch(); return true;
}
function touch() { S.ver++; recompute(); if (window.onModelChange) window.onModelChange(); }

/* =====================================================================
   회로 해석 (수정 절점 해석법 · 이상적인 소자에 매우 가까운 값 사용)
   ===================================================================== */
const G_WIRE = 1e5, G_METER = 1e-7, R_BAT = 1e-3;

function gauss(A, B, n) {
  for (let i = 0; i < n; i++) {
    let p = i, m = Math.abs(A[i][i]);
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > m) { m = Math.abs(A[r][i]); p = r; }
    if (m < 1e-30) continue;
    if (p !== i) { const t = A[p]; A[p] = A[i]; A[i] = t; const tb = B[p]; B[p] = B[i]; B[i] = tb; }
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i]; if (!f) continue;
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = B[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = Math.abs(A[i][i]) < 1e-30 ? 0 : s / A[i][i];
  }
  return x;
}

function solve(skipMeterId, shortMeter) {
  const par = new Map(), refs = [];
  for (const c of S.comps) for (let k = 0; k < nTerms(c); k++) { const r = mk(c.id, k); par.set(r, r); refs.push(r); }
  const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  for (const l of S.links) if (par.has(l.a) && par.has(l.b)) par.set(find(l.a), find(l.b));
  const nid = new Map(); let N = 0;
  const node = r => { const f = find(r); if (!nid.has(f)) nid.set(f, N++); return nid.get(f); };
  refs.forEach(node);

  const els = [];
  for (const c of S.comps) {
    if (!nTerms(c)) continue;
    const a = node(mk(c.id, 0)), b = node(mk(c.id, RANGES[c.type] ? useTerm(c) : 1));
    switch (c.type) {
      case 'wire': case 'ammeter': els.push({ t: 'g', a, b, g: G_WIRE }); break;
      case 'bulb': case 'resistor': els.push({ t: 'g', a, b, g: 1 / c.R }); break;
      case 'switch': if (c.closed) els.push({ t: 'g', a, b, g: G_WIRE }); break;
      case 'voltmeter': if (c.id !== skipMeterId) els.push({ t: 'g', a, b, g: G_METER }); else if (shortMeter) els.push({ t: 'g', a, b, g: G_WIRE }); break;
      case 'battery': els.push({ t: 'v', a, b, E: c.V, c }); break;
    }
  }
  /* 연결된 덩어리(cluster)마다 기준 절점 하나를 접지 */
  const cp = Array.from({ length: N }, (_, i) => i);
  const cf = x => { while (cp[x] !== x) { cp[x] = cp[cp[x]]; x = cp[x]; } return x; };
  for (const e of els) cp[cf(e.a)] = cf(e.b);
  const grounded = new Set(), uidx = new Array(N).fill(-1); let nu = 0;
  for (let i = 0; i < N; i++) { const r = cf(i); if (!grounded.has(r)) grounded.add(r); else uidx[i] = nu++; }
  const vs = els.filter(e => e.t === 'v');
  const n = nu + vs.length;
  const A = Array.from({ length: n }, () => new Float64Array(n)), B = new Float64Array(n);
  const add = (i, j, v) => { if (i >= 0 && j >= 0) A[i][j] += v; };
  for (const e of els) if (e.t === 'g') {
    const ia = uidx[e.a], ib = uidx[e.b];
    add(ia, ia, e.g); add(ib, ib, e.g); add(ia, ib, -e.g); add(ib, ia, -e.g);
  }
  vs.forEach((e, j) => {
    const m = nu + j, ip = uidx[e.a], inn = uidx[e.b];
    add(ip, m, -1); add(inn, m, 1); add(m, ip, 1); add(m, inn, -1);
    A[m][m] += R_BAT; B[m] = e.E;
  });
  const x = n ? gauss(A, B, n) : new Float64Array(0);
  const V = new Float64Array(N);
  for (let i = 0; i < N; i++) V[i] = uidx[i] >= 0 ? x[uidx[i]] : 0;
  const Ib = new Map(); vs.forEach((e, j) => Ib.set(e.c.id, x[nu + j]));
  return { V, N, node, cf, Ib };
}

function recompute() {
  const sol = solve(null);
  const res = { short: false, hints: [], V: 0, I: 0, P: 0, on: false };
  const clus = {};
  /* 부품별 값 */
  for (const c of S.comps) {
    if (!nTerms(c)) continue;
    c._u = RANGES[c.type] ? useTerm(c) : 1;
    const v0 = sol.V[sol.node(mk(c.id, 0))], v1 = sol.V[sol.node(mk(c.id, c._u))];
    c._dV = v0 - v1; c._v0 = v0; c._v1 = v1;
    switch (c.type) {
      case 'battery': c._I = -sol.Ib.get(c.id); break;
      case 'bulb': case 'resistor': c._I = (v0 - v1) / c.R; break;
      case 'switch': c._I = c.closed ? (v0 - v1) * G_WIRE : 0; break;
      case 'wire': case 'ammeter': c._I = (v0 - v1) * G_WIRE; break;
      case 'voltmeter': c._I = (v0 - v1) * G_METER; break;
    }
    c._P = (c.type === 'bulb' || c.type === 'resistor') ? c._dV * c._dV / c.R : 0;
    if (c.type === 'bulb') c._br = c._P < 0.003 ? 0 : Math.min(1, Math.sqrt(c._P / 10));
  }
  /* 합선 판정 */
  for (const c of S.comps) if (c.type === 'battery' && Math.abs(c._I) > 40) res.short = true;
  /* 덩어리별 전압·전력 → 패널 값 */
  const cl = id => sol.cf(sol.node(id));
  for (const c of S.comps) {
    if (c.type === 'battery') { const k = cl(mk(c.id, 0)); (clus[k] = clus[k] || { hasB: true, mx: -1e9, mn: 1e9, P: 0 }).hasB = true; }
  }
  for (const c of S.comps) {
    if (!nTerms(c)) continue;
    const k = cl(mk(c.id, 0)); const o = clus[k]; if (!o) continue;
    for (let t = 0; t < 2; t++) { const v = t ? c._v1 : c._v0; if (c.type !== 'voltmeter') { o.mx = Math.max(o.mx, v); o.mn = Math.min(o.mn, v); } }
    o.P += c._P || 0;
  }
  let best = null;
  for (const k in clus) { const o = clus[k], dv = o.mx - o.mn; if (!best || dv > best.dv) best = { dv, P: o.P }; }
  if (best) { res.V = best.dv; res.P = best.P; res.I = best.dv > 1e-6 ? best.P / best.dv : 0; }
  if (res.short) {   /* 합선: 전류가 우회하는 부품은 꺼진 것으로 표시 */
    const E = Math.max(0, ...S.comps.filter(c => c.type === 'battery').map(c => c.V));
    for (const c of S.comps) if ((c.type === 'bulb' || c.type === 'resistor') && Math.abs(c._dV) < 0.25 * E) { c._dV = 0; c._I = 0; c._P = 0; if (c.type === 'bulb') c._br = 0; }
    res.V = E; res.P = 0; res.I = 0;
  }
  res.on = res.I > 1e-3 || res.short;
  /* 전압계 · 전류계 · 집게 전류계 */
  const hints = res.hints;
  const sumP = () => S.comps.reduce((s, c) => s + (c._P || 0), 0);
  const P1 = sumP();
  for (const c of S.comps) {
    if (c.type === 'voltmeter') {
      const ra = mk(c.id, 0), rb = mk(c.id, 1);
      c._linkedA = linked(ra); c._linkedB = linked(rb);
      c._linkedB = c._linkedB || linked(mk(c.id, 2));
      c._valid = c._linkedA && c._linkedB;
      c._read = c._valid ? c._v0 - c._v1 : 0;
      c._series = false;
      if (c._valid) {
        const s2 = solve(c.id, true);   /* 전압계를 전선으로 바꿨을 때의 회로 */
        let P0 = 0;
        for (const d of S.comps) if (d.type === 'bulb' || d.type === 'resistor') {
          const dv = s2.V[s2.node(mk(d.id, 0))] - s2.V[s2.node(mk(d.id, 1))]; P0 += dv * dv / d.R;
        }
        if (P0 > 0.05 && P1 < 0.2 * P0) c._series = true;
      }
    } else if (c.type === 'ammeter') {
      c._read = c._I;
    }
    if (c.type === 'ammeter' || c.type === 'voltmeter') {
      c._rng = RANGES[c.type][c._u]; c._rn = RNAME[c.type][c._u];
      c._over = Math.abs(c._read) > c._rng * 1.0005;
    }
  }
  for (const c of S.comps) if (c.type === 'clamp') {
    let best2 = null;
    for (const d of S.comps) {
      if (d === c || !nTerms(d) || d.type === 'voltmeter') continue;
      const p0 = tpos(d, 0), p1 = tpos(d, 1);
      const dx = p1.x - p0.x, dy = p1.y - p0.y, L2 = dx * dx + dy * dy || 1;
      const t = clamp(((c.x - p0.x) * dx + (c.y - p0.y) * dy) / L2, 0, 1);
      const dist = Math.hypot(c.x - (p0.x + t * dx), c.y - (p0.y + t * dy));
      if (dist < 30 && (!best2 || dist < best2.dist)) best2 = { d, dist };
    }
    c._target = best2 ? best2.d.id : null;
    c._read = best2 ? best2.d._I : 0;
  }
  /* 학습 도우미 힌트 */
  if (res.short) hints.push({ lvl: 'bad', msg: '⚠ 합선(단락)! 전지의 두 극이 저항 없이 연결되어 매우 큰 전류가 흘러요. 전류계는 반드시 회로에 직렬로 연결해야 해요.' });
  for (const c of S.comps) {
    if (c.type === 'voltmeter') {
      if (!c._linkedA && !c._linkedB) hints.push({ lvl: 'info', msg: '전압계의 빨간(+) 집게와 검은(−) 집게를 측정할 부품의 양쪽 단자에 연결해 보세요. (병렬연결)' });
      else if (c._linkedA !== c._linkedB) hints.push({ lvl: 'info', msg: '전압계의 집게 한 쪽만 연결되어 있어요. 나머지 한 쪽도 부품의 반대쪽 단자에 연결하세요.' });
      else if (c._series) hints.push({ lvl: 'bad', msg: '전압계가 회로에 직렬로 연결되었어요! 전압계는 저항이 매우 커서 전류가 거의 흐르지 않아 전구가 꺼져요. 전압계는 부품과 병렬로 연결해야 해요.' });
      else if (c._read < -0.005) hints.push({ lvl: 'warn', msg: '전압계 값이 (−)로 나와요. 빨간(+) 집게는 전지의 (+)극 쪽(전위가 높은 쪽)에 연결해야 해요.' });
      else if (c._over) hints.push({ lvl: 'bad', msg: '전압계 바늘이 눈금 끝을 넘었어요! (−)단자 ' + c._rn + ' 의 최대 측정값은 ' + c._rng + ' V 예요. 처음에는 가장 큰 눈금(15V) (−)단자에 연결하세요.' });
      else if (Math.abs(c._read) > 0.005) hints.push({ lvl: 'ok', msg: '전압계가 병렬로 연결되어 ' + c._read.toFixed(2) + ' V 를 측정해요. (−)' + c._rn + ' 단자: ' + scaleInfo(c).where + ' 눈금(' + scaleInfo(c).maxTxt + ')을 읽어요. 한 칸은 ' + scaleInfo(c).tickTxt + ' 예요.' + (Math.abs(c._read) < 5 && c._u === 1 ? ' 바늘이 조금만 움직이면 (−)5V 단자로 옮겨 보세요.' : '') });
    } else if (c.type === 'ammeter') {
      const a = linked(mk(c.id, 0)), b = [1, 2, 3].some(k => linked(mk(c.id, k)));
      if (!a || !b) hints.push({ lvl: 'info', msg: '전류계는 회로의 한 곳을 끊고 그 사이에 직렬로 연결해야 해요. 양쪽 단자를 모두 연결해 보세요.' });
      else if (!res.short && c._read < -0.005) hints.push({ lvl: 'warn', msg: '전류계 값이 (−)로 나와요. 전류는 (+)단자로 들어가 (−)단자로 나와야 해요. (+)와 (−)에 연결된 전선을 서로 바꿔 연결해 보세요.' });
      else if (!res.short && c._over) hints.push({ lvl: 'bad', msg: '전류계 바늘이 눈금 끝을 넘었어요! (−)' + c._rn + ' 단자의 최대 측정값은 ' + c._rng + ' A 예요. 전류가 이보다 크면 전류계가 망가질 수 있어요. 더 큰 눈금의 (−)단자에 연결하세요.' });
      else if (!res.short && c._read > 0.0005) hints.push({ lvl: 'ok', msg: '전류계가 직렬로 연결되어 ' + c._read.toFixed(2) + ' A 를 측정해요. (−)' + c._rn + ' 단자: ' + scaleInfo(c).where + ' 눈금(' + scaleInfo(c).maxTxt + ')을 읽어요. 한 칸은 ' + scaleInfo(c).tickTxt + ' 예요.' + (c._u < 2 && Math.abs(c._read) < RANGES.ammeter[c._u + 1] ? ' 바늘이 조금만 움직이면 (−)500mA 단자로 옮겨 보세요.' : '') });
    }
  }
  S.res = res;
}

/* ---------- 표시용 포맷 ---------- */
const fV = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
const fA = i => { const a = Math.abs(i); if (a > 99) return 'OVER'; return (a < 0.005 ? 0 : i).toFixed(2); };
const fVal = v => (Math.abs(v - Math.round(v)) < 1e-9 ? v.toFixed(1) : v.toFixed(1));

/* ---------- 편집 동작 ---------- */
function deleteComp(c) {
  removeLinksOfComp(c);
  S.comps = S.comps.filter(x => x !== c);
  if (S.selId === c.id) S.selId = null;
  touch();
}
/* 연결점에서 연결 끊기: 끊은 뒤 눈에 보이게 살짝 떼어 놓는다 */
function detachAt(ref) {
  const { c, k } = parse(ref);
  if (!c) return;
  if (isFree(c)) {
    removeLinksOf(ref);
    if (c.type === 'wire') {
      const me = tpos(c, k), ot = tpos(c, 1 - k);
      let dx = ot.x - me.x, dy = ot.y - me.y; const L = Math.hypot(dx, dy);
      if (L < 40) { dx = 0; dy = 1; moveFree(c, k, me.x + 0, me.y + 42); }
      else { const m = Math.min(46, L * 0.45); moveFree(c, k, me.x + dx / L * m, me.y + dy / L * m); }
    } else {  /* 전압계 집게: 아래로 */
      const me = tpos(c, k); moveFree(c, k, me.x + (k === 0 ? -26 : 26), me.y + 46);
    }
  } else {
    const tp = tpos(c, k);
    removeLinksOf(ref);
    let dx = c.x - tp.x, dy = c.y - tp.y; const L = Math.hypot(dx, dy) || 1;
    moveGroup(c, dx / L * 46, dy / L * 46);
  }
  syncLinks(); touch();
}
/* 부품 하나에 붙은 모든 연결 분리 */
function separateComp(c) {
  const mine = [];
  for (let k = 0; k < nTerms(c); k++) mine.push(mk(c.id, k));
  const hadLinks = mine.some(linked);
  if (!hadLinks) return;
  if (isFree(c)) {
    for (const r of mine) if (linked(r)) detachAt(r);
  } else {
    const partners = [];
    for (const r of mine) for (const o of linksOf(r)) partners.push(o);
    for (const r of mine) removeLinksOf(r);
    let cx = 0, cy = 0, n = 0;
    for (const o of partners) { const p = posOf(o); cx += p.x; cy += p.y; n++; }
    let dx = 0, dy = 55;
    if (n) { dx = c.x - cx / n; dy = c.y - cy / n; const L = Math.hypot(dx, dy); if (L < 1) { dx = 0; dy = 55; } else { dx = dx / L * 55; dy = dy / L * 55; } }
    moveGroup(c, dx, dy);
  }
  syncLinks(); touch();
}
/* 직접 연결된(전선 없이 붙은) 부품 덩어리 */
function rigidGroup(c) {
  const set = new Set(), st = [c];
  while (st.length) {
    const x = st.pop(); if (set.has(x)) continue; set.add(x);
    if (isFree(x)) continue;
    for (const l of S.links) {
      const A = parse(l.a), B = parse(l.b);
      if (A.c === x && !isFree(B.c)) st.push(B.c);
      if (B.c === x && !isFree(A.c)) st.push(A.c);
    }
  }
  return Array.from(set);
}
function moveGroup(c, dx, dy) {
  for (const g of rigidGroup(c)) shiftComp(g, dx, dy);
  syncLinks();
}
function shiftComp(c, dx, dy) {
  c.x += dx; c.y += dy;
  if (c.type === 'wire') { c.a.x += dx; c.a.y += dy; c.b.x += dx; c.b.y += dy; }
  if (c.type === 'voltmeter') {
    if (!linked(mk(c.id, 0))) { c.pa.x += dx; c.pa.y += dy; }
    if (!linked(mk(c.id, 1))) { c.pb.x += dx; c.pb.y += dy; }
    if (!linked(mk(c.id, 2))) { c.pc.x += dx; c.pc.y += dy; }
  }
}
function rotateComp(c, deg) {
  if (!HW[c.type]) return;
  for (let k = 0; k < nTerms(c); k++) {
    const r = mk(c.id, k);
    for (const o of linksOf(r)) if (!isFree(parse(o).c)) { removeLinksOf(r); break; }
  }
  c.rot = ((c.rot + deg) % 360 + 360) % 360;
  syncLinks(); touch();
}

/* (+)(−) 단자를 맞바꾼다: 전선은 물리적 끝에 그대로 붙어 있고, 전기적 극성만 반대가 된다 */
function flipComp(c) {
  for (let k = 2; k < nTerms(c); k++) removeLinksOf(mk(c.id, k));
  const r0 = mk(c.id, 0), r1 = mk(c.id, 1);
  for (const l of S.links) {
    if (l.a === r0) l.a = r1; else if (l.a === r1) l.a = r0;
    if (l.b === r0) l.b = r1; else if (l.b === r1) l.b = r0;
  }
  c.flip = !c.flip; syncLinks(); touch();
}
