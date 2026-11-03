/* =====================================================================
   UI : 상단 도구, 부품 상자, 선택 도구, 학습 도우미, 도움말
   ===================================================================== */
let toastT = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ---------- 부품 상자 ---------- */
const PAL = [
  ['wire', '전선', '<svg viewBox="0 0 60 34"><line x1="13" y1="17" x2="47" y2="17" stroke="#7d93b2" stroke-width="5" stroke-linecap="round"/><circle cx="11" cy="17" r="6" fill="#ffb020" stroke="#e53030" stroke-width="3"/><circle cx="49" cy="17" r="6" fill="#ffb020" stroke="#e53030" stroke-width="3"/></svg>'],
  ['battery', '건전지', '<svg viewBox="0 0 60 34"><rect x="9" y="8" width="42" height="18" rx="4" fill="#2f72e8"/><rect x="9" y="8" width="12" height="18" rx="4" fill="#f4a21b"/><rect x="5" y="13" width="4" height="8" fill="#e3a21a"/><text x="37" y="21" font-size="9" font-weight="800" fill="#fff" text-anchor="middle">10V</text></svg>'],
  ['bulb', '꼬마전구', '<svg viewBox="0 0 60 34"><circle cx="30" cy="12" r="9" fill="#eef4fb" stroke="#9fb0c6" stroke-width="1.6"/><rect x="25" y="20" width="10" height="9" rx="2" fill="#e0a526"/><path d="M26 13 q4 -6 8 0" stroke="#c28a2c" fill="none" stroke-width="1.6"/></svg>'],
  ['resistor', '저항', '<svg viewBox="0 0 60 34"><line x1="6" y1="17" x2="54" y2="17" stroke="#8d9db3" stroke-width="3"/><rect x="14" y="9" width="32" height="16" rx="7" fill="#e9d2a6" stroke="#a98350"/><rect x="21" y="9.5" width="3.5" height="15" fill="#22a047"/><rect x="28" y="9.5" width="3.5" height="15" fill="#111"/><rect x="35" y="9.5" width="3.5" height="15" fill="#7b3f00"/></svg>'],
  ['switch', '스위치', '<svg viewBox="0 0 60 34"><rect x="8" y="22" width="44" height="6" rx="2" fill="#3c5079"/><circle cx="14" cy="21" r="3.5" fill="#d4a21c"/><line x1="14" y1="21" x2="44" y2="8" stroke="#d9a62a" stroke-width="3.4" stroke-linecap="round"/><circle cx="46" cy="7" r="4.5" fill="#e0504a"/></svg>'],
  ['ammeter', '직렬 전류계', '<svg viewBox="0 0 60 34"><rect x="12" y="6" width="36" height="22" rx="6" fill="#1fa070"/><circle cx="30" cy="17" r="8" fill="#0d6b4b" stroke="#bff0d9" stroke-width="1.5"/><text x="30" y="21" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">A</text></svg>'],
  ['voltmeter', '전압계', '<svg viewBox="0 0 60 34"><rect x="12" y="4" width="36" height="22" rx="5" fill="#25a6e0"/><rect x="17" y="8" width="26" height="9" rx="2" fill="#06182a"/><text x="30" y="16" font-size="8" font-weight="800" fill="#36e0ff" text-anchor="middle">0.00V</text><circle cx="22" cy="23" r="2.2" fill="#e02424"/><circle cx="38" cy="23" r="2.2" fill="#111"/></svg>'],
  ['clamp', '집게 전류계', '<svg viewBox="0 0 60 34"><path d="M20 20 a10 10 0 1 1 20 0" fill="none" stroke="#5b6678" stroke-width="5"/><rect x="21" y="19" width="18" height="12" rx="3" fill="#3b4658"/><rect x="24" y="22" width="12" height="5" fill="#7dff9a"/></svg>']
];
function buildPalette() {
  const box = $('#palette');
  box.innerHTML = PAL.map(p => `<button class="pitem" data-type="${p[0]}" title="${p[1]} — 끌어다 놓거나 눌러서 추가">${p[2]}<span>${p[1]}</span></button>`).join('');
  $$('.pitem', box).forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (UI.view !== '2d') return; startPaletteDrag(b.dataset.type, e); });
  });
}

/* ---------- 선택된 부품 도구 ---------- */
const ctxBar = $('#ctx');
let sliderUndone = false;
function buildCtx() {
  const c = byId(S.selId);
  if (!c || UI.view !== '2d') { ctxBar.classList.remove('on'); return; }
  const parts = [];
  const rot = HW[c.type] ? '<button data-act="rotL" title="왼쪽으로 90° 회전 (Shift+R)">↺</button><button data-act="rotR" title="오른쪽으로 90° 회전 (R)">↻</button>' : '';
  if (c.type === 'battery') {
    parts.push(`<span class="lab">🔋 전압</span><button data-act="step" data-d="-5">−5</button><button data-act="step" data-d="-1">−1</button><input type="range" id="ctxSl" min="1" max="24" step="1" value="${Math.round(c.V)}"><button data-act="step" data-d="1">+1</button><button data-act="step" data-d="5">+5</button><b id="ctxVal" class="val">${Math.round(c.V)} V</b>`,
      '<button data-act="flip">⇄ 극성 반전</button>');
  } else if (c.type === 'resistor' || c.type === 'bulb') {
    const mn = 1, mx = c.type === 'bulb' ? 50 : 100;
    parts.push(`<span class="lab">${c.type === 'bulb' ? '💡 전구 저항' : '🟫 저항값'}</span><button data-act="step" data-d="-5">−5</button><button data-act="step" data-d="-1">−1</button><input type="range" id="ctxSl" min="${mn}" max="${mx}" step="1" value="${c.R}"><button data-act="step" data-d="1">+1</button><button data-act="step" data-d="5">+5</button><b id="ctxVal" class="val">${c.R} Ω</b>`);
  } else if (c.type === 'switch') {
    parts.push(`<span class="lab">🔘 스위치</span><button data-act="sw" class="${c.closed ? 'on' : ''}">${c.closed ? '닫힘 → 열기' : '열림 → 닫기'}</button>`);
  } else if (c.type === 'ammeter') {
    parts.push(`<span class="lab">Ⓐ 전류계 · (−)단자 5A / 500mA</span>`);
  } else if (c.type === 'voltmeter') {
    parts.push(`<span class="lab">Ⓥ 전압계 · (−)단자 15V / 5V</span>`);
  } else {
    parts.push(`<span class="lab">${NAMES[c.type]}</span>`);
  }
  parts.push(rot);
  const hasLink = (() => { for (let k = 0; k < nTerms(c); k++) if (linked(mk(c.id, k))) return true; return false; })();
  if (nTerms(c)) parts.push(`<button data-act="sep" class="warn" ${hasLink ? '' : 'disabled'}>✂ 연결 분리</button>`);
  parts.push('<button data-act="del" class="danger">🗑 삭제</button>');
  ctxBar.innerHTML = parts.join('');
  ctxBar.classList.add('on');
  const sl = $('#ctxSl');
  if (sl) {
    sl.addEventListener('pointerdown', () => { sliderUndone = false; });
    sl.addEventListener('input', () => {
      if (!sliderUndone) { pushUndo(); sliderUndone = true; }
      const v = Math.round(parseFloat(sl.value)); if (c.type === 'battery') c.V = v; else c.R = v; const cv_ = $('#ctxVal'); if (cv_) cv_.textContent = v + (c.type === 'battery' ? ' V' : ' Ω'); touch();
    });
  }
}
ctxBar.addEventListener('pointerdown', e => e.stopPropagation());
ctxBar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const c = byId(S.selId); if (!c) return;
  const act = b.dataset.act; pushUndo();
  if (act === 'del') deleteComp(c);
  else if (act === 'sep') { separateComp(c); toast('연결을 분리했어요'); }
  else if (act === 'rotL') rotateComp(c, -90);
  else if (act === 'rotR') rotateComp(c, 90);
  else if (act === 'flip') flipComp(c);
  else if (act === 'step') {
    const d = parseInt(b.dataset.d, 10);
    if (c.type === 'battery') c.V = clamp(Math.round(c.V) + d, 1, 24);
    else c.R = clamp(Math.round(c.R) + d, 1, c.type === 'bulb' ? 50 : 100);
    touch();
  }
  else if (act === 'v') { c.V = parseFloat(b.dataset.v); touch(); }
  else if (act === 'r') { c.R = parseFloat(b.dataset.v); touch(); }
  else if (act === 'sw') { c.closed = !c.closed; touch(); }
  buildCtx();
});
window.onSelect = () => { buildCtx(); panelKey = ''; updateMeasure(); };

/* ---------- 측정 패널 · 학습 도우미 ---------- */
/* ---- 오른쪽 계기 확대 창: 실제 전압계·전류계(선택한 것 또는 첫 번째)의 눈금판을 크게 보여 준다 ---- */
function panelMeter(kind) {
  const list = S.comps.filter(x => x.type === kind), sel = byId(S.selId);
  const c = sel && sel.type === kind ? sel : list[0];
  if (c) return { c, real: true, idx: list.indexOf(c) + 1, n: list.length };
  const r = S.res;   /* 계기가 없으면 회로 전체 값을 가상 계기로 보여 준다 */
  return { c: { type: kind, _u: 1, _valid: true, _rng: RANGES[kind][1], _read: kind === 'voltmeter' ? r.V : (r.short ? 0 : r.I) }, real: false };
}
let panelKey = '';
function drawPanelFace(cvEl, kind, c) {
  const w = cvEl.clientWidth || 264, h = Math.round(w * 60 / 104), dpr = Math.min(2.5, window.devicePixelRatio || 1);
  if (cvEl.width !== Math.round(w * dpr)) { cvEl.width = Math.round(w * dpr); cvEl.height = Math.round(h * dpr); cvEl.style.height = h + 'px'; }
  const g = cvEl.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cvEl.width, cvEl.height);
  g.setTransform(cvEl.width / 104, 0, 0, cvEl.height / 60, 0, 0); paintMeterFace(g, kind, c);
}
function updateMeasure() {
  const r = S.res; if (!r || !$('#fcV')) return;
  const st = $('#mState');
  st.textContent = r.short ? '합선!' : (r.on ? '닫힘 (ON)' : '열림 (OFF)');
  st.className = 'state ' + (r.short ? 'short' : (r.on ? 'on' : 'off'));
  const pv = panelMeter('voltmeter'), pi = panelMeter('ammeter');
  const key = [pv.c.id, pv.c._read, pv.c._u, pv.c._valid, pi.c.id, pi.c._read, pi.c._u, UI.showVal, r.P, r.short].join('|');
  if (key === panelKey) return; panelKey = key;
  drawPanelFace($('#fcV'), 'voltmeter', pv.c); drawPanelFace($('#fcI'), 'ammeter', pi.c);
  const show = (kind, p, srcId, infoId, valId, unitDigits, val, bad) => {
    const c = p.c, si = scaleInfo(c);
    $('#' + srcId).textContent = p.real ? '(' + p.idx + '/' + p.n + '번 계기' + (S.selId === c.id ? ' · 선택됨' : '') + ')' : '(계기 없음 → 회로 전체 값)';
    $('#' + valId).textContent = !UI.showVal ? '?' : (bad ? 'OVER' : val.toFixed(unitDigits));
    $('#' + infoId).innerHTML = (p.real && kind === 'voltmeter' && !c._valid) ? '집게를 부품 양쪽에 연결하세요' :
      '(−)<b>' + RNAME[kind][c._u || 1] + '</b> 단자 → <b>' + si.where + ' 눈금</b> (' + si.maxTxt + ')<br>한 칸 = <b>' + si.tickTxt + '</b>' + (c._over ? ' <i>· 눈금 초과!</i>' : '');
  };
  show('voltmeter', pv, 'vSrc', 'vInfo', 'mV', 2, pv.real ? (pv.c._read || 0) : r.V, false);
  show('ammeter', pi, 'iSrc', 'iInfo', 'mI', 2, pi.real ? (pi.c._read || 0) : r.I, r.short && !pi.real);
  $('#mP').textContent = r.short ? 'OVER' : r.P.toFixed(2);
}
let lastHints = '';
function updateDiag() {
  const r = S.res; if (!r) return;
  const h = r.hints.slice(0, 4);
  const key = JSON.stringify(h);
  if (key === lastHints) return; lastHints = key;
  $('#lDiag').innerHTML = h.map(x => `<div class="dg ${x.lvl}">${x.msg}</div>`).join('');
}
window.onModelChange = () => { updateMeasure(); updateDiag(); if (UI.view === '2d') { const c = byId(S.selId); if (!c) ctxBar.classList.remove('on'); } };
function setLearn(ex) {
  $('#lTitle').textContent = ex.title;
  $('#lDesc').textContent = ex.desc;
  $('#lSteps').innerHTML = ex.steps.map(s => `<li>${s}</li>`).join('');
  $('#lKey').innerHTML = '<b>핵심</b> ' + ex.key;
  lastHints = ''; updateDiag();
}
window.onExample = ex => { setLearn(ex); buildCtx(); };

/* ---------- 화면 크기에 맞춘 배치 ---------- */
function applyLayout() {
  const short = innerHeight < 560, narrow = innerWidth < 700;
  document.body.classList.toggle('short', short); document.body.classList.toggle('narrow', narrow);
  return short + '|' + narrow;
}
/* ---------- 예제 메뉴 ---------- */
function buildExMenu() {
  const m = $('#exMenu');
  m.innerHTML = EXAMPLES.map(e => `<button data-id="${e.id}"><i>${e.icon}</i><span>${e.title}</span></button>`).join('');
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; m.classList.remove('on'); loadExample(b.dataset.id, true); toast('예제 회로를 불러왔어요'); });
  $('#exBtn').addEventListener('click', e => { e.stopPropagation(); const r = $('#exBtn').getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, innerWidth - 340)) + 'px'; m.classList.toggle('on'); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#exMenu') && !e.target.closest('#exBtn')) m.classList.remove('on'); });
}

/* ---------- 상단 버튼 ---------- */
function setActive(sel, on) { $$(sel).forEach(b => b.classList.toggle('on', on(b))); }
function setView(v) {
  if (v === '3d' && !window.THREE) { toast('3D를 불러오지 못했어요'); return; }
  UI.view = v; hideBubble();
  const lp = $('#learn');
  if (v === '3d') { UI.learnWasOpen = lp.classList.contains('open'); lp.classList.remove('open'); }
  else if (UI.learnWasOpen) lp.classList.add('open');
  document.body.classList.toggle('v3d', v === '3d');
  setActive('[data-view]', b => b.dataset.view === v);
  if (v === '3d') { init3D(); setTimeout(() => { resize3D(); enter3D(); }, 0); ctxBar.classList.remove('on'); }
  else { setTimeout(() => { resize2d(); buildCtx(); }, 0); leave3D && leave3D(); }
}
function bindTop() {
  const mm = $('#mMin'), mp = $('#measure');
  applyLayout(); UI.lay = applyLayout(); if (window.innerWidth < 1200 || window.innerHeight < 560) mp.classList.add('min');
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) $('#fsBtn').style.display = 'none';
  mm.addEventListener('click', () => { mp.classList.toggle('min'); });
  $('#mHead').addEventListener('click', e => { if (e.target.id !== 'mMin') mp.classList.toggle('min'); });
  $$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-flow]').forEach(b => b.addEventListener('click', () => { UI.flow = b.dataset.flow; setActive('[data-flow]', x => x.dataset.flow === UI.flow); if (UI.view === '3d') mark3D(); }));
  $$('[data-style]').forEach(b => b.addEventListener('click', () => { if (UI.view === '3d') { toast('3D에서는 실물 모습으로 보여요'); return; } UI.style = b.dataset.style; setActive('[data-style]', x => x.dataset.style === UI.style); }));
  $('#valBtn').addEventListener('click', () => { UI.showVal = !UI.showVal; $('#valBtn').textContent = '값:' + (UI.showVal ? 'ON' : 'OFF'); $('#valBtn').classList.toggle('on', UI.showVal); });
  $('#centerBtn').addEventListener('click', () => { if (UI.view === '2d') fitView(); else setCam('iso'); });
  $('#panBtn').addEventListener('click', () => { UI.pan = !UI.pan; $('#panBtn').classList.toggle('on', UI.pan); $('#panTxt').textContent = '이동 ' + (UI.pan ? '켜짐' : '꺼짐'); cv.style.cursor = UI.pan ? 'grab' : 'default'; });
  $('#undoBtn').addEventListener('click', () => { if (!undo()) toast('되돌릴 작업이 없어요'); buildCtx(); });
  $('#palBtn').addEventListener('click', () => { const o = document.body.classList.toggle('palopen'); $('#palBtn').classList.toggle('on', o); });
  $('#resetBtn').addEventListener('click', () => { if (CH.on) { if (CH.saved) return; pushUndo(); S.comps = []; S.links = []; S.nextId = 1; S.selId = null; touch(); toast('빈 화면으로 되돌렸어요'); return; } loadExample(currentExample, true); toast('처음 상태로 되돌렸어요 (취소로 복구 가능)'); });
  $('#helpBtn').addEventListener('click', () => $('#modal').classList.add('on'));
  $('#modalClose').addEventListener('click', () => $('#modal').classList.remove('on'));
  $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') $('#modal').classList.remove('on'); });
  $('#fsBtn').addEventListener('click', () => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { toast('전체 화면을 지원하지 않는 기기예요'); } });
  $('#zIn').addEventListener('click', () => zoomAt(V2.w / 2, V2.h / 2, 1.2));
  $('#zOut').addEventListener('click', () => zoomAt(V2.w / 2, V2.h / 2, 1 / 1.2));
  $('#lToggle').addEventListener('click', () => $('#learn').classList.toggle('open'));
  $$('[data-cam]').forEach(b => b.addEventListener('click', () => setCam(b.dataset.cam)));
}

/* ---------- 메인 루프 ---------- */
let lastT = performance.now(), frame = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; simTime += dt; frame++;
  if (UI.view === '2d') draw2d(dt); else render3D(dt);
  updateMeasure();
  requestAnimationFrame(loop);
}
function boot() {
  buildPalette(); buildExMenu(); bindTop(); initChallenge();
  const ro = new ResizeObserver(() => { const lay = applyLayout(); resize2d(); if (UI.view === '3d') resize3D(); else if (lay !== UI.lay) { UI.lay = lay; fitView(); } }); ro.observe($('#view'));
  resize2d();
  loadExample('basic', false);
  if (window.innerWidth >= 900 && window.innerHeight >= 560) $('#learn').classList.add('open');
  setActive('[data-flow]', x => x.dataset.flow === UI.flow);
  requestAnimationFrame(loop);
}
window.addEventListener('load', boot);
