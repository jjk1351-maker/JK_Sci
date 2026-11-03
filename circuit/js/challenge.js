/* =====================================================================
   도전 모드: 예제 회로도를 보고 빈 화면에서 직접 만들기
   - 시간은 성공했을 때만, 팝업으로 보여 준다.
   - 힌트·정답 보기를 쓰면 성공해도 시간은 표시·저장하지 않는다.
   ===================================================================== */
const CH = { on: false, id: null, t0: 0, tick: null, hinted: false, peeked: false, sig: null, parts: '', saved: null, showTimer: true, done: false };
const CH_LIST = ['basic', 'ammeter', 'voltmeter', 'bat-series', 'bat-parallel', 'res-series', 'res-parallel'];
const CH_TYPES = ['battery', 'bulb', 'resistor', 'switch', 'ammeter', 'voltmeter'];
const CH_ORDERED = { battery: 1, ammeter: 1, voltmeter: 1 };

/* ---- 기록 저장(이 기기 안에서만, 최고 기록) ---- */
function chBest(id) { try { return (JSON.parse(localStorage.getItem('jkcl_best') || '{}'))[id] || 0; } catch (e) { return 0; } }
function chSaveBest(id, ms) { try { const o = JSON.parse(localStorage.getItem('jkcl_best') || '{}'); if (!o[id] || ms < o[id]) { o[id] = ms; localStorage.setItem('jkcl_best', JSON.stringify(o)); return true; } } catch (e) { } return false; }
const chFmt = ms => { const t = Math.floor(ms / 100) / 10, m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

/* ---- 회로 구조(전선으로 이어진 점을 하나의 접점으로 묶은 그래프) ---- */
function circuitSig() {
  const par = new Map();
  for (const c of S.comps) for (let k = 0; k < nTerms(c); k++) { const r = mk(c.id, k); par.set(r, r); }
  const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  const uni = (a, b) => { if (par.has(a) && par.has(b)) par.set(find(a), find(b)); };
  for (const l of S.links) uni(l.a, l.b);
  for (const c of S.comps) if (c.type === 'wire') uni(mk(c.id, 0), mk(c.id, 1));
  const elems = [], nodes = new Set();
  for (const c of S.comps) {
    if (!CH_TYPES.includes(c.type)) continue;
    const a = find(mk(c.id, 0)), b = find(mk(c.id, RANGES[c.type] ? useTerm(c) : 1));
    nodes.add(a); nodes.add(b);
    elems.push({ type: c.type, val: c.type === 'battery' ? c.V : (c.type === 'bulb' || c.type === 'resistor' ? c.R : ''), a, b });
  }
  return { elems, nodes: Array.from(nodes) };
}
function chMatch(A, B, o) {
  o = o || {};
  if (A.elems.length !== B.elems.length || A.nodes.length !== B.nodes.length) return false;
  const n = A.nodes.length; if (n > 9) return false;
  const fmt = (e, m) => {
    const a = m.get(e.a), b = m.get(e.b), v = o.noVal ? '' : e.val;
    return (CH_ORDERED[e.type] && !o.noPol) ? e.type + v + ':' + a + '>' + b : e.type + v + ':' + Math.min(a, b) + '-' + Math.max(a, b);
  };
  const ai = new Map(A.nodes.map((x, i) => [x, i])), sa = A.elems.map(e => fmt(e, ai)).sort().join('|');
  const used = Array(n).fill(false), map = new Map();
  const rec = i => {
    if (i === n) return B.elems.map(e => fmt(e, map)).sort().join('|') === sa;
    for (let j = 0; j < n; j++) if (!used[j]) { used[j] = true; map.set(B.nodes[i], j); if (rec(i + 1)) return true; used[j] = false; }
    return false;
  };
  return rec(0);
}
function chCounts(sig) { const o = {}; for (const e of sig.elems) o[e.type] = (o[e.type] || 0) + 1; return o; }
function chPartsText(sig) {
  const cnt = chCounts(sig), vals = t => sig.elems.filter(e => e.type === t).map(e => e.val);
  return CH_TYPES.filter(t => cnt[t]).map(t => NAMES[t] + ' ' + cnt[t] + '개' + (t === 'battery' ? ' (각 ' + vals(t).join('·') + ' V)' : (t === 'bulb' || t === 'resistor') ? ' (각 ' + vals(t).join('·') + ' Ω)' : '')).join(' · ');
}

/* ---- 진단: 지금 회로가 정답과 어떻게 다른지 ---- */
function chDiagnose() {
  const A = CH.sig, B = circuitSig();
  if (!B.elems.length) return { ok: false, msg: '필요한 부품: ' + CH.parts + '. 아래 부품 상자에서 꺼내 보세요.' };
  const ca = chCounts(A), cb = chCounts(B), allT = Array.from(new Set(CH_TYPES.concat(Object.keys(cb))));
  for (const t of CH_TYPES) {
    const d = (ca[t] || 0) - (cb[t] || 0);
    if (d > 0) return { ok: false, msg: NAMES[t] + '이(가) ' + d + '개 더 필요해요.' };
    if (d < 0) return { ok: false, msg: NAMES[t] + '이(가) ' + (-d) + '개 남아요. 목표 회로도에는 없는 부품이에요.' };
  }
  if (S.comps.some(c => c.type === 'clamp')) return { ok: false, msg: '집게 전류계는 이 도전에 필요 없어요. 지워 주세요.' };
  for (const t of ['battery', 'bulb', 'resistor']) {
    const va = A.elems.filter(e => e.type === t).map(e => e.val).sort((x, y) => x - y).join(','), vb = B.elems.filter(e => e.type === t).map(e => e.val).sort((x, y) => x - y).join(',');
    if (va !== vb) return { ok: false, msg: (t === 'battery' ? '건전지 전압' : NAMES[t] + ' 저항값') + '을(를) ' + va.split(',').join(', ') + (t === 'battery' ? ' V' : ' Ω') + '로 맞춰 보세요. (부품을 누르면 값을 바꿀 수 있어요)' };
  }
  for (const c of S.comps) {
    if (!CH_TYPES.includes(c.type)) continue;
    const u = RANGES[c.type] ? useTerm(c) : 1;
    if (!linked(mk(c.id, 0))) return { ok: false, msg: NAMES[c.type] + '의 ' + (CH_ORDERED[c.type] ? '(+)' : '한쪽') + ' 단자가 아직 연결되지 않았어요.' };
    if (!linked(mk(c.id, u))) return { ok: false, msg: NAMES[c.type] + '의 ' + (CH_ORDERED[c.type] ? '(−)' : '다른 쪽') + ' 단자가 아직 연결되지 않았어요.' };
  }
  if (!chMatch(A, B)) {
    if (chMatch(A, B, { noPol: true })) return { ok: false, msg: '연결 방법은 맞아요! 그런데 (+)(−) 방향이 반대인 부품이 있어요. 건전지·전류계·전압계의 (+)(−)를 확인해 보세요.' };
    return { ok: false, msg: '부품의 연결 방법이 목표 회로도와 달라요. 직렬·병렬, 전류계(직렬)와 전압계(병렬) 위치를 다시 살펴보세요.' };
  }
  const r = S.res;
  if (r.short) return { ok: false, msg: '합선이 되었어요! 전지의 두 극이 저항 없이 이어졌는지 확인해 보세요.' };
  if (S.comps.some(c => (c.type === 'ammeter' || c.type === 'voltmeter') && c._over)) return { ok: false, msg: '계기 바늘이 눈금 끝을 넘었어요. (−)단자를 더 큰 눈금(15V, 5A)으로 옮겨 연결해 보세요.' };
  if (S.comps.some(c => c.type === 'switch' && !c.closed)) return { ok: false, msg: '회로는 맞게 만들었어요! 스위치를 눌러 닫아서 전류를 흘려 보세요.' };
  if (!r.on) return { ok: false, msg: '전류가 흐르지 않아요. 연결을 다시 확인해 보세요.' };
  return { ok: true, msg: '' };
}

/* ---- 목표 회로도 그림 ---- */
function chMakeThumb(id) {
  const keep = { k: V2.k, ox: V2.ox, oy: V2.oy, style: UI.style, flow: UI.flow, showVal: UI.showVal, thumb: UI.thumb };
  loadExample(id, false);
  const sig = circuitSig();
  UI.style = 'symbol'; UI.flow = 'off'; UI.showVal = true; UI.thumb = true; S.selId = null;
  const b = contentBounds(), m = 24, bw = b.x1 - b.x0 + m * 2, bh = b.y1 - b.y0 + m * 2;
  const k = Math.min((V2.w - 20) / bw, (V2.h - 20) / bh, 1.3);
  V2.k = k; V2.ox = (V2.w - (b.x1 + b.x0) * k) / 2; V2.oy = (V2.h - (b.y1 + b.y0) * k) / 2;
  draw2d(0);
  const d = V2.dpr, sx = Math.max(0, Math.floor((V2.ox + (b.x0 - m) * k) * d)), sy = Math.max(0, Math.floor((V2.oy + (b.y0 - m) * k) * d));
  const sw = Math.min(cv.width - sx, Math.ceil(bw * k * d)), sh = Math.min(cv.height - sy, Math.ceil(bh * k * d));
  const t = document.createElement('canvas'); t.width = sw; t.height = sh; t.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
  const url = t.toDataURL('image/png');
  Object.assign(UI, { style: keep.style, flow: keep.flow, showVal: keep.showVal, thumb: keep.thumb }); V2.k = keep.k; V2.ox = keep.ox; V2.oy = keep.oy;
  return { sig, url };
}

/* ---- 진행 ---- */
function chClearBoard() { S.comps = []; S.links = []; S.nextId = 1; S.selId = null; undoStack.length = 0; redoStack.length = 0; touch(); fitView(); }
function chUpdateTimer() {
  const el = $('#chTime'); if (!el) return;
  if (!CH.on || CH.done) return;
  if (CH.hinted || CH.peeked) { el.textContent = '기록 안 됨'; el.className = 'chTime off'; return; }
  el.className = 'chTime'; el.textContent = CH.showTimer ? '⏱ ' + chFmt(performance.now() - CH.t0).slice(0, 5) : '⏱ --:--';
}
function chStart(id) {
  if (UI.view !== '2d') setView('2d');
  const ex = EXAMPLES.find(e => e.id === id), th = chMakeThumb(id);
  if (document.body.classList.contains('short') || document.body.classList.contains('narrow')) document.body.classList.add('palopen');
  CH.on = true; CH.id = id; CH.sig = th.sig; CH.parts = chPartsText(th.sig); CH.hinted = false; CH.peeked = false; CH.saved = null; CH.done = false;
  chClearBoard();
  document.body.classList.add('challenge');
  $('#chTT').textContent = ex.title; $('#chImg').src = th.url; $('#chParts').textContent = '필요한 부품: ' + CH.parts;
  chMsg('목표 회로도와 똑같이 만들고 [채점]을 눌러요. 스위치는 닫아야 해요.', 'info');
  chSetColl(UI.chColl !== undefined ? UI.chColl : (innerWidth < 1280 || innerHeight < 700));
  $('#chPeekBar').classList.remove('on'); $('#chPop').classList.remove('on'); $('#chMenu').classList.remove('on');
  $('#chTitle').textContent = '도전 ' + (CH_LIST.indexOf(id) + 1) + '/' + CH_LIST.length;
  CH.t0 = performance.now(); clearInterval(CH.tick); CH.tick = setInterval(chUpdateTimer, 200); chUpdateTimer();
  buildCtx();
}
function chSetColl(v) { $('#chTarget').classList.toggle('min', v); $('#chTog').textContent = v ? '▾' : '▴'; }
function chMsg(t, lvl) { const m = $('#chMsg'); m.textContent = t; m.className = 'dg ' + (lvl || 'info'); }
function chGrade() {
  if (!CH.on || CH.done) return;
  if (CH.saved) { chMsg('지금은 정답을 보는 중이에요. [내 회로로 돌아가기]를 눌러 주세요.', 'warn'); return; }
  const d = chDiagnose();
  if (!d.ok) { chMsg('아직이에요! ' + d.msg, 'warn'); toast('아직 목표 회로와 달라요'); return; }
  CH.done = true; clearInterval(CH.tick);
  const ms = performance.now() - CH.t0, valid = !CH.hinted && !CH.peeked;
  let extra = '';
  if (valid) { const prev = chBest(CH.id), isNew = chSaveBest(CH.id, ms); extra = isNew ? (prev ? '🏅 새 최고 기록이에요! (이전 ' + chFmt(prev) + ')' : '🏅 첫 기록이에요!') : '내 최고 기록 ' + chFmt(prev); }
  $('#chPopTime').innerHTML = valid ? '⏱ ' + chFmt(ms) : '<small>' + (CH.peeked ? '정답 보기' : '힌트') + '를 사용해서<br>시간 기록은 나오지 않아요</small>';
  $('#chPopSub').textContent = extra;
  const idx = CH_LIST.indexOf(CH.id); $('#chNext').style.display = idx < CH_LIST.length - 1 ? '' : 'none';
  $('#chPop').classList.add('on'); chMsg('성공!', 'ok');
}
function chHint() {
  if (!CH.on || CH.done || CH.saved) return;
  CH.hinted = true; chUpdateTimer();
  const d = chDiagnose(); chMsg('💡 ' + (d.ok ? '완성이에요! [채점]을 눌러 보세요.' : d.msg), 'info');
}
function chPeek() {
  if (!CH.on || CH.done || CH.saved) return;
  CH.peeked = true; CH.saved = snapJSON(); chUpdateTimer();
  loadExample(CH.id, false); S.selId = null; buildCtx();
  $('#chPeekBar').classList.add('on');
}
function chBack() {
  if (!CH.saved) return;
  const o = JSON.parse(CH.saved); CH.saved = null;
  S.comps = o.comps; S.links = o.links; S.nextId = o.nextId; S.selId = null; touch(); fitView(); buildCtx();
  $('#chPeekBar').classList.remove('on'); chMsg('내 회로로 돌아왔어요. 시간 기록은 나오지 않아요.', 'warn');
}
function chExit() {
  CH.on = false; clearInterval(CH.tick); document.body.classList.remove('challenge');
  ['#chPop', '#chPeekBar', '#chMenu'].forEach(s => $(s).classList.remove('on'));
  loadExample('basic', false);
}
function chBuildMenu() {
  $('#chList').innerHTML = CH_LIST.map((id, i) => {
    const ex = EXAMPLES.find(e => e.id === id), b = chBest(id);
    return `<button data-id="${id}"><i>${ex.icon}</i><span><b>${i + 1}단계</b> ${ex.title}</span><em class="${b ? 'done' : ''}">${b ? '⏱ ' + chFmt(b) : '미도전'}</em></button>`;
  }).join('');
}
function initChallenge() {
  $('#chBtn').addEventListener('click', () => { chBuildMenu(); $('#chMenu').classList.add('on'); });
  $('#chClose').addEventListener('click', () => $('#chMenu').classList.remove('on'));
  $('#chList').addEventListener('click', e => { const b = e.target.closest('button'); if (b) chStart(b.dataset.id); });
  $('#chGrade').addEventListener('click', chGrade); $('#chHint').addEventListener('click', chHint);
  $('#chPeek').addEventListener('click', chPeek); $('#chBack').addEventListener('click', chBack);
  $('#chExit').addEventListener('click', chExit);
  $('#chTog').addEventListener('click', () => { UI.chColl = !$('#chTarget').classList.contains('min'); chSetColl(UI.chColl); });
  const chUR = f => () => { if (CH.saved) { toast('정답을 보는 중에는 쓸 수 없어요'); return; } if (!f()) toast(f === undo ? '되돌릴 작업이 없어요' : '다시 할 작업이 없어요'); buildCtx(); };
  $('#chUndo').addEventListener('click', chUR(undo)); $('#chRedo').addEventListener('click', chUR(redo));
  setInterval(() => { if (!CH.on) return; $('#chUndo').disabled = !undoStack.length || !!CH.saved; $('#chRedo').disabled = !redoStack.length || !!CH.saved; }, 200);
  $('#chEye').addEventListener('click', () => { CH.showTimer = !CH.showTimer; $('#chEye').classList.toggle('on', CH.showTimer); chUpdateTimer(); });
  $('#chEye').classList.add('on');
  $('#chAgain').addEventListener('click', () => chStart(CH.id));
  $('#chNext').addEventListener('click', () => { const i = CH_LIST.indexOf(CH.id); chStart(CH_LIST[Math.min(CH_LIST.length - 1, i + 1)]); });
  $('#chEnd').addEventListener('click', chExit);
}
