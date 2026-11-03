/* =====================================================================
   2D 회로 화면 : 그리기 + 입력(연결·이동·회전·끊기)
   ===================================================================== */
const INK = '#1a2233';
const cv = $('#c2d'), ctx = cv.getContext('2d');
const V2 = { ox: 0, oy: 0, k: 1, w: 0, h: 0, dpr: 1 };
const toWorld = (sx, sy) => ({ x: (sx - V2.ox) / V2.k, y: (sy - V2.oy) / V2.k });
const toScreen = (x, y) => ({ x: x * V2.k + V2.ox, y: y * V2.k + V2.oy });
let hoverRef = null, snapCand = null, bubbleRef = null, simTime = 0;

function resize2d() {
  const r = cv.parentElement.getBoundingClientRect();
  V2.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  V2.w = Math.max(10, r.width); V2.h = Math.max(10, r.height);
  cv.width = Math.round(V2.w * V2.dpr); cv.height = Math.round(V2.h * V2.dpr);
  cv.style.width = V2.w + 'px'; cv.style.height = V2.h + 'px';
}
function contentBounds() {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const P = (x, y, m = 0) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); };
  for (const c of S.comps) {
    if (c.type === 'wire') { P(c.a.x, c.a.y, 8); P(c.b.x, c.b.y, 8); }
    else if (c.type === 'voltmeter') { P(c.x, c.y, 80); P(c.pa.x, c.pa.y, 30); P(c.pb.x, c.pb.y, 30); P(c.pc.x, c.pc.y, 30); }
    else if (c.type === 'clamp') { P(c.x, c.y, 60); }
    else if (c.type === 'ammeter') { P(c.x, c.y, 80); }
    else { P(c.x, c.y, HW[c.type] + 20); }
  }
  if (x0 > 1e8) return { x0: -200, y0: -150, x1: 200, y1: 150 };
  return { x0, y0, x1, y1 };
}
function fitView(animate) {
  const b = contentBounds(), lp = $('#learn'), mp = $('#measure'), pal = $('#palette'), bd = document.body.classList;
  const short = bd.contains('short'), narrow = bd.contains('narrow');
  const palH = pal ? pal.getBoundingClientRect().height : 0;
  const padT = CH.on ? (short ? 74 : 104) : (short ? 40 : 56);
  const padB = (palH > 0 ? palH + 16 : (short ? 14 : 86)) + (narrow ? 44 : 0);
  let padL = narrow ? 8 : (short ? 56 : 84), padR = 10;
  if (!narrow && mp && !mp.classList.contains('min')) padR = mp.offsetWidth + 20;
  const sideOpen = !narrow && (CH.on || (lp && lp.classList.contains('open')));
  if (sideOpen && V2.w - padL - 300 - padR >= 420) padL += 300;
  const W = Math.max(120, V2.w - padL - padR), H = Math.max(100, V2.h - padT - padB);
  const bw = b.x1 - b.x0 + 80, bh = b.y1 - b.y0 + (short ? 90 : 130);
  const k = clamp(Math.min(W / bw, H / bh), 0.3, 1.5);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  V2.k = k; V2.ox = padL + W / 2 - cx * k; V2.oy = padT + H / 2 - cy * k;
  updateZoomLabel();
}
function updateZoomLabel() { const z = $('#zoomPct'); if (z) z.textContent = Math.round(V2.k * 100) + '%'; }
function zoomAt(sx, sy, f) {
  const nk = clamp(V2.k * f, 0.3, 3);
  const w = toWorld(sx, sy); V2.k = nk; V2.ox = sx - w.x * nk; V2.oy = sy - w.y * nk; updateZoomLabel();
}

/* ---------- 작은 그리기 도우미 ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function ln(x1, y1, x2, y2, col, w, cap) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap || 'round'; ctx.stroke();
}
const FONT = "'Pretendard','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
function txt(s, x, y, size, col, align, weight) {
  ctx.font = (weight || '700') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
function chip(lines, x, y, col, align) {
  ctx.save();
  let w = 0; lines.forEach(l => { ctx.font = '700 ' + (l.s || 12) + 'px ' + FONT; w = Math.max(w, ctx.measureText(l.t).width); });
  w += 14; const h = lines.length * 16 + 6 + (lines[0].s > 12 ? 4 : 0);
  if (align === 'r') x -= w / 2; else if (align === 'l') x += w / 2;
  ctx.shadowColor = 'rgba(30,50,100,.2)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = '#ffffff'; rr(x - w / 2, y - h / 2, w, h, 8); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#c3cfea'; ctx.lineWidth = 1.2; ctx.stroke();
  const lh = h / lines.length;
  lines.forEach((l, i) => { txt(l.t, x, y - h / 2 + lh / 2 + i * lh, l.s || 12, l.c || col || '#3763e8'); });
  ctx.restore();
}
function trans(c) { ctx.translate(c.x, c.y); ctx.rotate(c.rot * PI / 180); }
const real = () => UI.style === 'real';

/* ---------- 부품 그리기 ---------- */
function drawBattery(c) {
  ctx.save(); trans(c);
  if (real()) {
    ln(-70, 0, -50, 0, '#8d9db3', 6); ln(50, 0, 70, 0, '#8d9db3', 6);
    ctx.save(); if (c.flip) ctx.scale(-1, 1);
    ctx.fillStyle = '#e3a21a'; rr(-58, -6, 10, 12, 2); ctx.fill();
    ctx.save(); rr(-50, -16, 100, 32, 7); ctx.clip();
    const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#6a7a98'); g.addColorStop(.45, '#34415c'); g.addColorStop(1, '#1a2236');
    ctx.fillStyle = g; ctx.fillRect(-50, -16, 100, 32);
    const g2 = ctx.createLinearGradient(0, -16, 0, 16); g2.addColorStop(0, '#6cf5d2'); g2.addColorStop(1, '#15a98a');
    ctx.fillStyle = g2; ctx.fillRect(-50, -16, 22, 32);
    ctx.fillStyle = '#0d5a4a'; ctx.fillRect(42, -16, 8, 32);
    ctx.restore(); ctx.restore();
    txt(fVal(c.V) + 'V', 6, 0, 13, '#fff');
    const px = c.flip ? 40 : -39, mx = c.flip ? -46 : 46;
    txt('+', px, 0, 15, '#fff'); txt('−', mx - (c.flip ? -3 : 3), 0, 13, '#cfe0ff');
  } else {
    const pxp = c.flip ? 7 : -7, pxm = c.flip ? -7 : 7;
    const lo = Math.min(pxp, pxm), hi = Math.max(pxp, pxm);
    ln(-70, 0, lo, 0, INK, 2.5); ln(hi, 0, 70, 0, INK, 2.5);
    ln(pxp, -20, pxp, 20, INK, 2.5); ln(pxm, -11, pxm, 11, INK, 6);
    txt('+', pxp + (c.flip ? 12 : -12), -20, 15, '#d02020'); txt('−', pxm + (c.flip ? -12 : 12), -20, 15, '#2060d0');
  }
  ctx.restore();
}
function drawBulb(c) {
  const b = c._br || 0;
  ctx.save(); trans(c);
  if (real()) {
    ln(-60, 0, -14, 0, '#8d9db3', 6); ln(14, 0, 60, 0, '#8d9db3', 6);
    if (b > 0.01) {
      const R = 34 + 70 * b, g = ctx.createRadialGradient(0, -26, 4, 0, -26, R);
      g.addColorStop(0, 'rgba(255,214,70,' + (0.85 * b + 0.1) + ')'); g.addColorStop(1, 'rgba(255,200,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -26, R, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,40,' + (0.75 * b) + ')'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, r1 = 29, r2 = 29 + 14 + 16 * b; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, -26 + Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, -26 + Math.sin(a) * r2); ctx.stroke(); }
    }
    ctx.fillStyle = '#c58b1d'; rr(-13, -6, 26, 22, 3); ctx.fill();
    ctx.fillStyle = '#f3c04a'; for (let i = 0; i < 3; i++) { rr(-14, -4 + i * 7, 28, 4, 2); ctx.fill(); }
    ctx.fillStyle = '#6b6f78'; rr(-8, 14, 16, 5, 2); ctx.fill();
    const g = ctx.createRadialGradient(-6, -32, 2, 0, -26, 24);
    const lit = Math.round(255 * Math.min(1, 0.55 + b)), gc = Math.round(215 + 40 * b);
    g.addColorStop(0, b > 0.01 ? 'rgb(255,' + gc + ',' + Math.round(110 + 80 * b) + ')' : '#fdfdff'); g.addColorStop(1, b > 0.01 ? 'rgb(255,' + Math.round(170 + 40 * b) + ',40)' : '#d6e2f2');
    ctx.fillStyle = g; ctx.globalAlpha = b > 0.01 ? 1 : 0.85; ctx.beginPath(); ctx.arc(0, -26, 21, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = b > 0.01 ? '#f0a020' : '#9fb0c6'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = b > 0.01 ? '#fff6c0' : '#c28a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -20, 6, PI, PI * 2 + 0.2); ctx.stroke();
    ln(-6, -20, -6, -4, ctx.strokeStyle, 1.6); ln(6, -20, 6, -4, ctx.strokeStyle, 1.6);
  } else {
    ln(-60, 0, -19, 0, INK, 2.5); ln(19, 0, 60, 0, INK, 2.5);
    if (b > 0.01) { ctx.fillStyle = 'rgba(255,214,70,' + (0.2 + 0.7 * b) + ')'; ctx.beginPath(); ctx.arc(0, 0, 19 + 6 * b, 0, 7); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.stroke();
    ln(-13.4, -13.4, 13.4, 13.4, INK, 2.5); ln(-13.4, 13.4, 13.4, -13.4, INK, 2.5);
  }
  ctx.restore();
}
const CC = [INK, '#7b3f00', '#e11d1d', '#f58220', '#f5d90a', '#22a047', '#2563eb', '#8b3fe0', '#888', '#fff'];
function bandsFor(R) {
  if (R < 10) { const d1 = Math.floor(R), d2 = Math.round(R * 10) % 10; return [CC[d1], CC[d2], '#d4af37']; }
  const s = String(Math.round(R)), mult = s.length - 2;
  return [CC[+s[0]], CC[+s[1]], CC[clamp(mult, 0, 9)]];
}
function drawResistor(c) {
  ctx.save(); trans(c);
  if (real()) {
    ln(-60, 0, -36, 0, '#8d9db3', 5); ln(36, 0, 60, 0, '#8d9db3', 5);
    const g = ctx.createLinearGradient(0, -11, 0, 11); g.addColorStop(0, '#c6ecf7'); g.addColorStop(1, '#82bdd6');
    ctx.fillStyle = g; rr(-34, -11, 68, 22, 10); ctx.fill(); ctx.strokeStyle = '#4f8ba3'; ctx.lineWidth = 1.5; ctx.stroke();
    const bs = bandsFor(c.R);
    [[-20, bs[0]], [-9, bs[1]], [2, bs[2]], [22, '#d4af37']].forEach(([x, col]) => { ctx.fillStyle = col; ctx.fillRect(x, -10.5, 6, 21); });
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-36, 0);
    const n = 6, w = 72 / n; for (let i = 0; i < n; i++) ctx.lineTo(-36 + w * (i + 0.5), i % 2 ? 11 : -11);
    ctx.lineTo(36, 0); ctx.lineTo(60, 0); ctx.stroke();
  }
  ctx.restore();
}
function drawSwitch(c) {
  ctx.save(); trans(c);
  if (real()) {
    ln(-50, 0, -34, 0, '#8d9db3', 5); ln(34, 0, 50, 0, '#8d9db3', 5);
    ctx.fillStyle = '#2a3a5c'; rr(-42, 3, 84, 13, 3); ctx.fill();
    ctx.fillStyle = '#d4a21c'; ctx.beginPath(); ctx.arc(-32, 0, 6, 0, 7); ctx.fill(); rr(26, -4, 12, 9, 2); ctx.fill();
    const ang = c.closed ? 0 : -0.62;
    ctx.save(); ctx.translate(-32, -2); ctx.rotate(ang);
    ln(0, 0, 58, 0, '#b8860b', 6); ln(0, 0, 58, 0, '#f0c040', 2.5);
    const g = ctx.createRadialGradient(60, -2, 1, 62, 0, 9); g.addColorStop(0, '#ffb3ae'); g.addColorStop(1, '#e0504a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(62, 0, 8, 0, 7); ctx.fill();
    ctx.restore();
  } else {
    ln(-50, 0, -30, 0, INK, 2.5); ln(30, 0, 50, 0, INK, 2.5);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-30, 0, 4, 0, 7); ctx.arc(30, 0, 4, 0, 7); ctx.fill();
    if (c.closed) ln(-30, 0, 30, 0, INK, 2.5); else ln(-30, 0, 24, -24, INK, 2.5);
  }
  ctx.restore();
}
function drawAmmeter(c) {
  ctx.save(); trans(c);
  if (real()) drawMeterCase('ammeter', c, [36, 0, -36]);
  else {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    [36, 0, -36].forEach(x => ln(x, 36, x * 0.55, 21, INK, 2.2));
    txt('A', 0, 1, 20, INK, 'center', '800');
    [36, 0, -36].forEach((x, k) => { txt(k === 0 ? '+' : RNAME.ammeter[k === 1 ? 1 : 2], x, 50, k === 0 ? 12 : 9, k === 0 ? '#d42a2a' : '#2a5bd4', 'center', '800'); });
  }
  ctx.restore();
}
function drawProbe(c, k) {
  const p = tpos(c, k), col = k === 0 ? '#e02424' : '#1a1a1a', used = k === 0 || k === c._u;
  ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = used ? 1 : 0.55;
  ln(0, 0, 0, -16, '#d9dde4', 2.5);
  ctx.fillStyle = col; rr(-7, -52, 14, 38, 4); ctx.fill();
  if (k > 0) { ctx.strokeStyle = '#8ea3cc'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(-5, -50, 4, 34, 2); ctx.fill();
  txt(k === 0 ? '+' : '−', 0, -38, 13, '#fff'); if (k > 0) txt(RNAME.voltmeter[k], 0, -24, 8.5, '#ffd27f', 'center', '800');
  ctx.restore();
}
const VJX = [-36, 0, 36];
function drawVoltmeter(c) {
  const jacks = VJX.map(x => ({ x: c.x + x, y: c.y + 36 }));
  for (let k = 0; k < 3; k++) {
    const p = tpos(c, k), j = jacks[k], top = { x: p.x, y: p.y - 52 };
    const sag = Math.max(24, Math.hypot(top.x - j.x, top.y - j.y) * 0.35);
    ctx.save(); ctx.globalAlpha = (k === 0 || k === c._u) ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(j.x, j.y); ctx.bezierCurveTo(j.x, j.y + sag, top.x, top.y - sag, top.x, top.y);
    ctx.strokeStyle = k === 0 ? '#d32020' : '#1d1d1d'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(c.x, c.y);
  if (real()) drawMeterCase('voltmeter', c, VJX);
  else {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    txt('V', 0, -8, 24, INK); if (UI.showVal) txt((c._read < 0 ? '-' : '') + fV(Math.abs(c._read || 0)) + ' V', 0, 16, 12, '#3763e8');
    VJX.forEach((x, k) => { ctx.fillStyle = k === 0 ? '#e02424' : '#1a2233'; ctx.beginPath(); ctx.arc(x * 0.8, 36, 4, 0, 7); ctx.fill(); });
  }
  ctx.restore();
  drawProbe(c, 2); drawProbe(c, 1); drawProbe(c, 0);
}
function drawClamp(c) {
  const tg = c._target ? byId(c._target) : null;
  if (tg) {
    const p0 = tpos(tg, 0), p1 = tpos(tg, 1);
    ctx.save(); ln(p0.x, p0.y, p1.x, p1.y, 'rgba(255,200,40,.55)', 14); ctx.restore();
  }
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = '#3b4658'; rr(-34, 20, 68, 52, 8); ctx.fill();
  ctx.fillStyle = '#06182a'; rr(-28, 26, 56, 24, 4); ctx.fill();
  txt((tg ? Math.abs(c._read) : 0).toFixed(2) + ' A', 0, 38, 16, tg ? '#7dff9a' : '#3a8a60', 'center', '800');
  txt('CLAMP', 0, 62, 9, '#cfd8e6');
  ctx.strokeStyle = '#5b6678'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 24, PI * 0.62, PI * 2.38); ctx.stroke();
  ctx.strokeStyle = '#8a97ad'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24, PI * 0.62, PI * 2.38); ctx.stroke();
  ctx.restore();
}
function drawWire(c) {
  const a = c.a, b = c.b;
  if (real()) {
    ln(a.x, a.y, b.x, b.y, '#0a5a41', 8); ln(a.x, a.y, b.x, b.y, '#12b886', 5.5); ln(a.x - .5, a.y - 1.5, b.x - .5, b.y - 1.5, 'rgba(255,255,255,.45)', 1.5);
  } else ln(a.x, a.y, b.x, b.y, INK, 2.8);
}

function drawTerminals() {
  for (const c of S.comps) for (let k = 0; k < nTerms(c); k++) {
    const p = tpos(c, k), r = mk(c.id, k), lk = linked(r);
    if (c.type === 'voltmeter') {
      ctx.beginPath(); ctx.arc(p.x, p.y, lk ? 4.5 : 6.5, 0, 7); ctx.fillStyle = lk ? '#2b8cff' : '#ffb020'; ctx.fill(); ctx.lineWidth = lk ? 2 : 2.5; ctx.strokeStyle = lk ? '#fff' : '#e02020'; ctx.stroke(); continue;
    }
    if (lk) { ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, 7); ctx.fillStyle = '#2b8cff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, 7); ctx.fillStyle = '#ffb020'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#e53030'; ctx.stroke(); }
    if (hoverRef === r) { ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 7); ctx.strokeStyle = 'rgba(43,140,255,.7)'; ctx.lineWidth = 3; ctx.stroke(); }
    if (c.type === 'battery') {
      txt(k === 0 ? '+' : '−', p.x, p.y - 17, 15, k === 0 ? '#d42a2a' : '#2a5bd4');
    }
  }
}
const BODY_HALF = { battery: 53, bulb: 17, resistor: 38, switch: 44, ammeter: 34 };
/* 전류 · 전자 흐름 */
function drawFlow(dt) {
  if (UI.flow === 'off') return;
  for (const c of S.comps) {
    if (!nTerms(c) || c.type === 'voltmeter' || c.type === 'ammeter') continue;
    const I = c._I || 0, a = Math.abs(I);
    if (a < 0.004) continue;
    const p0 = tpos(c, 0), p1 = tpos(c, 1), L = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (L < 8) continue;
    const ux = (p1.x - p0.x) / L, uy = (p1.y - p0.y) / L;
    const dirI = I > 0 ? 1 : -1;                       /* 전류의 방향: 단자0 → 단자1 이 +1 */
    const dir = UI.flow === 'current' ? dirI : -dirI;  /* 전자는 반대 방향 */
    const speed = 22 + 70 * Math.min(1, a / 1.5);
    c._ph = ((c._ph || 0) + dir * speed * dt);
    const sp = 24, n = Math.max(1, Math.floor(L / sp)), step = L / n;
    for (let i = 0; i < n; i++) {
      let s = (((c._ph + i * step) % L) + L) % L;
      if (BODY_HALF[c.type] && Math.abs(s - L / 2) < BODY_HALF[c.type]) continue;   /* 부품 몸통 위에서는 숨김 */
      const x = p0.x + ux * s, y = p0.y + uy * s;
      if (c.type === 'wire' || true) {
        if (UI.flow === 'current') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(uy * dir, ux * dir));
          ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5.5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 5.5); ctx.closePath();
          ctx.fillStyle = '#ff7a00'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(x, y, 5.2, 0, 7); ctx.fillStyle = '#1f6bff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillRect(x - 2.6, y - 0.7, 5.2, 1.4);
        }
      }
    }
  }
}
function chipPos(c) {
  const a = c.rot * PI / 180, sn = Math.sin(a), cs = Math.cos(a);
  if (Math.abs(sn) > 0.6) return { x: c.x - Math.sign(sn) * 30, y: c.y, align: sn > 0 ? 'r' : 'l' };
  return { x: c.x, y: c.y + (cs >= 0 ? 42 : -42), align: 'c' };
}
/* 전류계 칩: 눈금판 바깥쪽(회전해도 겹치지 않게) */
function chipAt(c) {
  const a = c.rot * PI / 180, nx = Math.sin(a), ny = -Math.cos(a);   /* 단자의 반대쪽 */
  if (Math.abs(nx) > 0.6) return { x: c.x + Math.sign(nx) * 74, y: c.y, align: nx > 0 ? 'l' : 'r' };
  return { x: c.x, y: c.y + (ny >= 0 ? 90 : -90), align: 'c' };
}
function drawLabels() {
  for (const c of S.comps) {
    if (!HW[c.type]) continue;
    const pos = chipPos(c);
    if (c.type === 'ammeter') continue;
    if (!UI.showVal) continue;
    const lines = [];
    if (c.type === 'battery') lines.push({ t: fVal(c.V) + ' V' });
    else if (c.type === 'resistor' || c.type === 'bulb') {
      lines.push({ t: c.R + ' Ω' });
      if (!UI.thumb && Math.abs(c._I) > 0.0005) { lines.push({ t: fV(Math.abs(c._dV)) + 'V · ' + fA(c._I) + 'A', s: 10.5, c: '#b8770a' }); lines.push({ t: 'P ' + (c._P || 0).toFixed(2) + ' W', s: 10.5, c: '#0a8a5c' }); }
    }
    else if (c.type === 'switch') lines.push({ t: c.closed ? '닫힘' : '열림', c: c.closed ? '#0a8a5c' : '#e0463f' });
    if (lines.length) chip(lines, pos.x, pos.y, null, pos.align);
  }
}
function drawSelection() {
  const c = byId(S.selId); if (!c) return;
  if (c.type === 'wire') { ln(c.a.x, c.a.y, c.b.x, c.b.y, 'rgba(255,200,40,.5)', 15); return; }
  ctx.save();
  if (c.type === 'voltmeter') { ctx.translate(c.x, c.y); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#2f80ff'; ctx.lineWidth = 2; rr(-67, -57, 134, 120, 10); ctx.stroke(); ctx.restore(); return; }
  if (c.type === 'clamp') { ctx.translate(c.x, c.y); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#2f80ff'; ctx.lineWidth = 2; rr(-40, -34, 80, 112, 10); ctx.stroke(); ctx.restore(); return; }
  trans(c); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#2f80ff'; ctx.lineWidth = 2;
  const top = c.type === 'bulb' ? -56 : (c.type === 'ammeter' ? -58 : -28);
  if (c.type === 'ammeter') rr(-66, -58, 132, 122, 10); else rr(-HW[c.type] + 8, top, 2 * HW[c.type] - 16, 28 - top + 4, 9); ctx.stroke(); ctx.setLineDash([]);
  /* 회전 손잡이 */
  const hy = top - 24; ln(0, top, 0, hy + 14, '#2f80ff', 2);
  ctx.beginPath(); ctx.arc(0, hy, 14, 0, 7); ctx.fillStyle = '#2f80ff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  const aa = c.rot * PI / 180;
  txt('⟳', c.x - hy * Math.sin(aa), c.y + hy * Math.cos(aa) + 1, 18, '#fff');
}

function draw2d(dt) {
  ctx.setTransform(V2.dpr, 0, 0, V2.dpr, 0, 0);
  ctx.fillStyle = '#eef2fb'; ctx.fillRect(0, 0, V2.w, V2.h);
  ctx.save(); ctx.translate(V2.ox, V2.oy); ctx.scale(V2.k, V2.k);
  /* 격자 */
  const x0 = -V2.ox / V2.k, y0 = -V2.oy / V2.k, x1 = x0 + V2.w / V2.k, y1 = y0 + V2.h / V2.k, gs = 25;
  ctx.lineWidth = 1 / V2.k;
  if (!UI.thumb) for (let x = Math.floor(x0 / gs) * gs; x <= x1; x += gs) { ctx.strokeStyle = (x % 100 === 0) ? 'rgba(20,30,60,.14)' : 'rgba(20,30,60,.06)'; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  if (!UI.thumb) for (let y = Math.floor(y0 / gs) * gs; y <= y1; y += gs) { ctx.strokeStyle = (y % 100 === 0) ? 'rgba(20,30,60,.14)' : 'rgba(20,30,60,.06)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  for (const c of S.comps) if (c.type === 'wire') drawWire(c);
  for (const c of S.comps) switch (c.type) {
    case 'battery': drawBattery(c); break; case 'bulb': drawBulb(c); break; case 'resistor': drawResistor(c); break;
    case 'switch': drawSwitch(c); break; case 'ammeter': drawAmmeter(c); break; case 'clamp': drawClamp(c); break;
  }
  drawFlow(dt);
  for (const c of S.comps) if (c.type === 'voltmeter') drawVoltmeter(c);
  drawSelection();
  drawLabels();
  if (!UI.thumb) drawTerminals();
  if (snapCand) {
    const p = posOf(snapCand.t), pul = 1 + 0.12 * Math.sin(simTime * 10);
    ctx.beginPath(); ctx.arc(p.x, p.y, 13 * pul, 0, 7); ctx.fillStyle = 'rgba(24,194,100,.28)'; ctx.fill(); ctx.strokeStyle = '#18c264'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fillStyle = '#18c264'; ctx.fill();
  }
  ctx.restore();
  if (bubbleRef) positionBubble();
}

/* =====================================================================
   입력 처리
   ===================================================================== */
const bubble = $('#bubble');
function showBubble(ref) { bubbleRef = ref; bubble.classList.add('on'); positionBubble(); }
function hideBubble() { bubbleRef = null; bubble.classList.remove('on'); }
function positionBubble() {
  const p = posOf(bubbleRef), s = toScreen(p.x, p.y), r = cv.getBoundingClientRect(), pr = bubble.offsetParent.getBoundingClientRect();
  bubble.style.left = (s.x + r.left - pr.left) + 'px'; bubble.style.top = (s.y + r.top - pr.top - 30) + 'px';
}
bubble.addEventListener('pointerdown', e => { e.stopPropagation(); });
bubble.addEventListener('click', e => { e.stopPropagation(); if (bubbleRef) { pushUndo(); detachAt(bubbleRef); toast('연결을 끊었어요'); } hideBubble(); });

function evPt(e) { const r = cv.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }
const hitR = () => Math.max(13, 17 / V2.k);
function hitTerm(p) {
  let best = null; const R = hitR();
  for (const c of S.comps) for (let k = 0; k < nTerms(c); k++) {
    const q = tpos(c, k); let d = Math.hypot(q.x - p.x, q.y - p.y);
    if (c.type === 'voltmeter') {  /* 집게 손잡이도 잡히게 */
      if (Math.abs(p.x - q.x) < 11 && p.y > q.y - 54 && p.y < q.y + 4) d = Math.min(d, 6);
    }
    if (d <= R) {
      const score = d - (c.type === 'voltmeter' ? 10 : (isFree(c) ? 4 : 0));
      if (!best || score < best.score) best = { ref: mk(c.id, k), c, k, score };
    }
  }
  return best;
}
function localPt(c, p) { const a = -c.rot * PI / 180, dx = p.x - c.x, dy = p.y - c.y; return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }; }
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
function bodyHit(c, p) {
  if (c.type === 'wire') return segDist(p, c.a, c.b) <= Math.max(9, 11 / V2.k);
  if (c.type === 'voltmeter') return Math.abs(p.x - c.x) <= 62 && p.y >= c.y - 54 && p.y <= c.y + 60;
  if (c.type === 'clamp') return Math.hypot(p.x - c.x, p.y - c.y) <= 34 || (Math.abs(p.x - c.x) <= 34 && p.y > c.y + 18 && p.y < c.y + 74);
  const l = localPt(c, p);
  switch (c.type) {
    case 'battery': return Math.abs(l.x) <= 54 && Math.abs(l.y) <= 19;
    case 'bulb': return Math.abs(l.x) <= 30 && l.y >= -50 && l.y <= 20;
    case 'resistor': return Math.abs(l.x) <= 40 && Math.abs(l.y) <= 15;
    case 'switch': return l.x >= -44 && l.x <= 74 && l.y >= -34 && l.y <= 18;
    case 'ammeter': return Math.abs(l.x) <= 62 && l.y >= -54 && l.y <= 60;
  }
  return false;
}
function hitBody(p) {
  for (let i = S.comps.length - 1; i >= 0; i--) { const c = S.comps[i]; if (c.type !== 'wire' && bodyHit(c, p)) return c; }
  for (let i = S.comps.length - 1; i >= 0; i--) { const c = S.comps[i]; if (c.type === 'wire' && bodyHit(c, p)) return c; }
  return null;
}
function hitHandle(p) {
  const c = byId(S.selId); if (!c || !HW[c.type]) return null;
  const top = c.type === 'bulb' ? -56 : (c.type === 'ammeter' ? -58 : -28), hy = top - 24, a = c.rot * PI / 180;
  const hx = c.x - hy * Math.sin(a), hyy = c.y + hy * Math.cos(a);
  return Math.hypot(p.x - hx, p.y - hyy) <= Math.max(20, 28 / V2.k) ? c : null;
}

let drag = null; const ptrs = new Map(); let pinch = null, spaceDown = false;

function select(id) { S.selId = id; if (window.onSelect) window.onSelect(); }
function snapRadius() { return Math.max(16, 26 / V2.k); }

function findSnap(moving, excludeComps, excludeRefs) {
  const R = snapRadius(); let best = null;
  const T = allTerms();
  for (const m of moving) {
    for (const t of T) {
      if (excludeComps.has(t.c) || excludeRefs.has(t.ref)) continue;
      if (hasLink(m.ref, t.ref)) continue;
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      if (d <= R && (!best || d < best.d)) best = { d, m, t: t.ref, tx: t.x, ty: t.y };
    }
  }
  return best;
}

/* 이동 시작: 연결된 부품 덩어리 + 따라오는 끝점 정보 수집 */
function beginMove(c) {
  const group = c.type === 'wire' ? [c] : rigidGroup(c);
  /* 전선을 직접 끌 때는 연결을 모두 떼고 이동 */
  if (c.type === 'wire') { removeLinksOf(mk(c.id, 0)); removeLinksOf(mk(c.id, 1)); }
  const starts = group.map(g => ({ g, x: g.x, y: g.y, a: g.a && { ...g.a }, b: g.b && { ...g.b }, pa: g.pa && { ...g.pa }, pb: g.pb && { ...g.pb }, pc: g.pc && { ...g.pc } }));
  /* 따라오는(follower) 끝점 */
  const gset = new Set(group), followers = new Set();
  const adj = new Map();
  for (const l of S.links) { (adj.get(l.a) || adj.set(l.a, []).get(l.a)).push(l.b); (adj.get(l.b) || adj.set(l.b, []).get(l.b)).push(l.a); }
  const q = [];
  for (const g of group) for (let k = 0; k < nTerms(g); k++) if (!isFree(g)) q.push(mk(g.id, k));
  const seen = new Set(q);
  while (q.length) { const r = q.shift(); for (const n of adj.get(r) || []) { if (seen.has(n)) continue; seen.add(n); const { c: cc } = parse(n); if (cc && isFree(cc) && !gset.has(cc)) { followers.add(n); q.push(n); } } }
  /* 움직이는 단자 목록 */
  const movers = [];
  for (const g of group) for (let k = 0; k < nTerms(g); k++) {
    const r = mk(g.id, k);
    if (g.type === 'voltmeter' && linked(r)) continue;
    movers.push(r);
  }
  return { group, starts, followers, movers, gset };
}
function applyMove(m, dx, dy) {
  for (const s of m.starts) {
    const g = s.g; g.x = s.x + dx; g.y = s.y + dy;
    if (g.type === 'wire') { g.a.x = s.a.x + dx; g.a.y = s.a.y + dy; g.b.x = s.b.x + dx; g.b.y = s.b.y + dy; }
    if (g.type === 'voltmeter') {
      if (!linked(mk(g.id, 0))) { g.pa.x = s.pa.x + dx; g.pa.y = s.pa.y + dy; }
      if (!linked(mk(g.id, 1))) { g.pb.x = s.pb.x + dx; g.pb.y = s.pb.y + dy; }
      if (!linked(mk(g.id, 2))) { g.pc.x = s.pc.x + dx; g.pc.y = s.pc.y + dy; }
    }
  }
  syncLinks();
}

function onDown(e) {
  const { sx, sy } = evPt(e), p = toWorld(sx, sy);
  hideBubble();
  if (UI.pan || e.button === 1 || spaceDown) { drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: V2.ox, oy: V2.oy }; return; }
  const t = hitTerm(p);
  if (t) {
    drag = { kind: 'term', t, sx: e.clientX, sy: e.clientY, p0: p, moved: false };
    return;
  }
  const hc = hitHandle(p);
  if (hc) { pushUndo(); drag = { kind: 'rot', c: hc }; return; }
  const c = hitBody(p);
  if (c) { select(c.id); drag = { kind: 'body', c, sx: e.clientX, sy: e.clientY, p0: p, moved: false }; return; }
  select(null);
  drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: V2.ox, oy: V2.oy };
}
function onMove(e) {
  if (UI.view !== '2d') return;
  const { sx, sy } = evPt(e), p = toWorld(sx, sy);
  if (!drag) {
    const t = hitTerm(p); const r = t ? t.ref : null;
    if (r !== hoverRef) hoverRef = r;
    cv.style.cursor = UI.pan ? 'grab' : (t ? 'pointer' : (hitBody(p) || hitHandle(p) ? 'move' : 'default'));
    return;
  }
  switch (drag.kind) {
    case 'pan': V2.ox = drag.ox + (e.clientX - drag.sx); V2.oy = drag.oy + (e.clientY - drag.sy); break;
    case 'rot': {
      const c = drag.c; let ang = Math.atan2(p.y - c.y, p.x - c.x) * 180 / PI + 90;
      ang = Math.round(ang / 15) * 15; ang = ((ang % 360) + 360) % 360;
      if (ang !== c.rot) {
        for (let k = 0; k < 2; k++) { const r = mk(c.id, k); for (const o of linksOf(r)) if (!isFree(parse(o).c)) { removeLinksOf(r); break; } }
        c.rot = ang; syncLinks(); touch();
      }
      break;
    }
    case 'term': {
      const d = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
      if (d > 7) {
        const { c, k, ref } = drag.t;
        pushUndo();
        if (isFree(c)) {            /* 전선 끝 · 집게 끝을 끌어 이동 */
          removeLinksOf(ref); drag.kind = 'end'; drag.end = { ref, c, k, exclude: new Set([c]) }; drag.moved = true; select(c.id);
        } else {                    /* 부품 단자에서 끌면 새 전선이 나온다 */
          const pt = tpos(c, k), w = newComp('wire', pt.x, pt.y);
          w.a.x = pt.x; w.a.y = pt.y; w.b.x = p.x; w.b.y = p.y;
          addLink(mk(w.id, 0), ref); connectAt(mk(w.id, 0), ref);
          drag.kind = 'end'; drag.fresh = true; drag.end = { ref: mk(w.id, 1), c: w, k: 1, exclude: new Set([w]) }; drag.moved = true; select(w.id); touch();
        }
      }
      if (drag.kind !== 'end') break;
    }   /* fallthrough */
    case 'end': {
      const en = drag.end; moveFree(en.c, en.k, p.x, p.y);
      const cand = findSnap([{ ref: en.ref, x: p.x, y: p.y }], en.exclude, new Set());
      snapCand = cand;
      if (cand) moveFree(en.c, en.k, cand.tx, cand.ty);
      touch(); break;
    }
    case 'body': {
      const d = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
      if (!drag.moved && d > 5) { pushUndo(); drag.moved = true; drag.m = beginMove(drag.c); if (drag.c.type === 'wire') { touch(); } }
      if (drag.moved) {
        let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
        const m = drag.m; applyMove(m, dx, dy);
        const moving = m.movers.map(r => { const q = posOf(r); return { ref: r, x: q.x, y: q.y }; });
        const cand = findSnap(moving, m.gset, m.followers);
        snapCand = cand;
        if (cand) { dx += cand.tx - cand.m.x; dy += cand.ty - cand.m.y; applyMove(m, dx, dy); }
        touch();
      }
      break;
    }
    case 'palette': break;
  }
}
function onUp(e) {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'term' && !d.moved) {
    const { ref, c } = d.t;
    if (linked(ref)) showBubble(ref); else select(c.id);
    snapCand = null; return;
  }
  if (d.kind === 'end') {
    const en = d.end;
    if (snapCand) { connectAt(en.ref, snapCand.t); }
    /* 완전히 겹쳐 있는 단자도 함께 연결 */
    autoLinkRef(en.ref);
    snapCand = null; if (en.c.type === 'wire' && Math.hypot(en.c.a.x - en.c.b.x, en.c.a.y - en.c.b.y) < 6 && d.fresh) deleteComp(en.c);
    touch(); return;
  }
  if (d.kind === 'body') {
    if (!d.moved) { if (d.c.type === 'switch') { pushUndo(); d.c.closed = !d.c.closed; touch(); } return; }
    const m = d.m;
    if (snapCand) { connectAt(snapCand.m.ref, snapCand.t); }
    for (const r of m.movers) autoLinkRef(r);
    snapCand = null; touch(); return;
  }
  snapCand = null;
}
function autoLinkRef(ref) {
  const me = parse(ref).c, p = posOf(ref);
  for (const t of allTerms()) { if (t.c === me) continue; if (Math.hypot(t.x - p.x, t.y - p.y) <= 4) connectAt(ref, t.ref); }
}

/* 포인터 이벤트 연결 */
cv.addEventListener('pointerdown', e => {
  if (UI.view !== '2d') return;
  cv.setPointerCapture(e.pointerId);
  const { sx, sy } = evPt(e); ptrs.set(e.pointerId, { sx, sy });
  if (ptrs.size === 2) { drag = null; snapCand = null; const [a, b] = Array.from(ptrs.values()); pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), cx: (a.sx + b.sx) / 2, cy: (a.sy + b.sy) / 2 }; return; }
  if (ptrs.size > 2) return;
  onDown(e);
});
window.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) { const { sx, sy } = evPt(e); ptrs.set(e.pointerId, { sx, sy }); }
  if (pinch && ptrs.size === 2) {
    const [a, b] = Array.from(ptrs.values()), d = Math.hypot(a.sx - b.sx, a.sy - b.sy), cx = (a.sx + b.sx) / 2, cy = (a.sy + b.sy) / 2;
    V2.ox += cx - pinch.cx; V2.oy += cy - pinch.cy; zoomAt(cx, cy, d / pinch.d); pinch.d = d; pinch.cx = cx; pinch.cy = cy; return;
  }
  if (drag && drag.kind === 'palette') { paletteMove(e); return; }
  onMove(e);
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) pinch = null; return; }
  if (drag && drag.kind === 'palette') { paletteUp(e); return; }
  onUp(e);
}
window.addEventListener('pointerup', endPtr);
window.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; drag = null; snapCand = null; });
cv.addEventListener('wheel', e => { if (UI.view !== '2d') return; e.preventDefault(); const { sx, sy } = evPt(e); zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Space') spaceDown = true;
  if (UI.view !== '2d') return;
  const c = byId(S.selId);
  if ((e.key === 'Delete' || e.key === 'Backspace') && c) { e.preventDefault(); pushUndo(); deleteComp(c); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key.toLowerCase() === 'r' && c && HW[c.type]) { pushUndo(); rotateComp(c, e.shiftKey ? -90 : 90); }
  else if (e.key === 'Escape') { select(null); hideBubble(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });

/* ---------- 팔레트에서 부품 꺼내기 ---------- */
function makeFromPalette(type, x, y) {
  const c = newComp(type, x, y);
  if (type === 'wire') { c.a = { x: x - 50, y }; c.b = { x: x + 50, y }; }
  return c;
}
function startPaletteDrag(type, e) {
  drag = { kind: 'palette', type, created: false, sx: e.clientX, sy: e.clientY };
}
function overCanvas(e) { const r = cv.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
function paletteMove(e) {
  if (!drag.created && overCanvas(e) && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
    const { sx, sy } = evPt(e), p = toWorld(sx, sy);
    pushUndo();
    const c = makeFromPalette(drag.type, p.x, p.y);
    select(c.id); touch();
    drag = { kind: 'body', c, sx: e.clientX, sy: e.clientY, p0: p, moved: true, m: beginMove(c) };
    if (c.type === 'wire') { drag.m = beginMove(c); }
  }
}
function paletteUp(e) {
  const d = drag; drag = null;
  if (!d.created) addAtCenter(d.type);
}
function addAtCenter(type) {
  pushUndo();
  const off = (S.comps.length % 5) * 18;
  const p = toWorld(V2.w / 2, V2.h / 2);
  const c = makeFromPalette(type, p.x + off - 30, p.y + off - 40);
  select(c.id); touch(); toast(NAMES[type] + ' 추가');
  return c;
}
