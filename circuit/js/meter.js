/* =====================================================================
   교과서 실험용 전류계 · 전압계 (주황 케이스, 흰 눈금판, 바깥/안쪽 이중 눈금)
   - (−)단자에 따라 읽어야 할 눈금이 달라진다.
     전압계: 15V 단자 → 바깥 눈금(0~15, 한 칸 0.5 V) / 5V 단자 → 안쪽 눈금(0~5, 한 칸 0.2 V)
     전류계: 500mA 단자 → 바깥 눈금(0~500 mA, 한 칸 20 mA) / 5A 단자 → 안쪽 눈금(0~5 A, 한 칸 0.2 A)
   ===================================================================== */
const METER_CFG = {
  voltmeter: { label: 'V', outer: { max: 15, mul: 1, n: 3, m: 10, idx: 1 }, inner: { max: 5, mul: 1, n: 5, m: 5, idx: 2 } },
  ammeter: { label: 'mA-A', outer: { max: 0.5, mul: 1000, n: 5, m: 5, idx: 2 }, inner: { max: 5, mul: 1, n: 5, m: 5, idx: 1 } }
};
/* 지금 연결된 단자에서 읽는 눈금 정보 */
function scaleInfo(c) {
  const cfg = METER_CFG[c.type], u = c._u || 1, outer = u === cfg.outer.idx, sc = outer ? cfg.outer : cfg.inner;
  const tick = sc.max / (sc.n * sc.m);
  const isMA = c.type === 'ammeter' && outer;
  return { where: outer ? '바깥쪽' : '안쪽', max: sc.max, tick, tickTxt: isMA ? Math.round(tick * 1000) + ' mA' : (+tick.toFixed(2)) + (c.type === 'voltmeter' ? ' V' : ' A'),
    maxTxt: isMA ? '0~500 mA' : '0~' + sc.max + (c.type === 'voltmeter' ? ' V' : ' A') };
}
/* 눈금판 하나(104×60, 왼쪽 위가 원점)를 그린다 — 2D 캔버스와 3D 텍스처가 함께 쓴다 */
function paintMeterFace(g, kind, c) {
  const cfg = METER_CFG[kind], u = c._u || 1, A0 = 58 * PI / 180, px = 52, py = 55;
  const ang = f => -PI / 2 + (f * 2 - 1) * A0;
  g.save();
  g.fillStyle = '#fbfaf2'; g.beginPath(); g.moveTo(5, 0); g.arcTo(104, 0, 104, 60, 5); g.arcTo(104, 60, 0, 60, 5); g.arcTo(0, 60, 0, 0, 5); g.arcTo(0, 0, 104, 0, 5); g.closePath(); g.fill();
  g.strokeStyle = '#c9c2a8'; g.lineWidth = 1; g.stroke();
  const scale = (sc, R, on, lr) => {
    const col = on ? '#161616' : '#a8a398', tot = sc.n * sc.m;
    g.strokeStyle = col; g.lineWidth = on ? 1.3 : 0.9; g.beginPath(); g.arc(px, py, R, ang(0), ang(1)); g.stroke();
    for (let i = 0; i <= tot; i++) {
      const f = i / tot, a = ang(f), major = i % sc.m === 0, r2 = R - (major ? 6 : 3);
      g.beginPath(); g.moveTo(px + Math.cos(a) * R, py + Math.sin(a) * R); g.lineTo(px + Math.cos(a) * r2, py + Math.sin(a) * r2);
      g.lineWidth = major ? 1.2 : 0.7; g.stroke();
      if (major) {
        const v = sc.max * sc.mul * (i / tot), t = String(+v.toFixed(1));
        g.fillStyle = col; g.font = '700 7px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(t, px + Math.cos(a) * lr, py + Math.sin(a) * lr);
      }
    }
  };
  scale(cfg.outer, 47, u === cfg.outer.idx, 36.5);
  scale(cfg.inner, 29, u === cfg.inner.idx, 20);
  /* 눈금 이름 */
  g.fillStyle = '#222'; g.font = '800 8.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(cfg.label, px + 14, 49);
  /* 바늘 */
  const rng = c._rng || cfg.outer.max, val = (kind === 'voltmeter' && !c._valid) ? 0 : (c._read || 0);
  const f = clamp(val / rng, -0.04, 1.04), a = ang(f), over = Math.abs(val) > rng * 1.0005;
  g.strokeStyle = over ? '#d3122b' : '#161616'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 45, py + Math.sin(a) * 45); g.stroke();
  g.fillStyle = '#161616'; g.beginPath(); g.arc(px, py, 2.6, 0, PI * 2); g.fill();
  g.restore();
}
/* 케이스 + 눈금판 + 단자(검은색 2개, 빨간색 1개). 호출 전에 부품 좌표계(회전 포함)로 이동해 둔다. */
function drawMeterCase(kind, c, jx) {
  const grd = ctx.createLinearGradient(0, -52, 0, 58); grd.addColorStop(0, '#ffb760'); grd.addColorStop(1, '#e8741a');
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(-58, -48, 120, 110, 12); ctx.fill();
  ctx.fillStyle = grd; rr(-60, -52, 120, 110, 12); ctx.fill(); ctx.strokeStyle = '#a84a00'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.translate(-52, -46); paintMeterFace(ctx, kind, c); ctx.restore();
  ctx.fillStyle = '#fdfcf6'; rr(-54, 18, 108, 36, 5); ctx.fill(); ctx.strokeStyle = '#d6cfb6'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#c0391b'; ctx.font = '800 7px ' + FONT;
  const names = RNAME[kind];
  for (let k = 0; k < 3; k++) {
    const x = jx[k], used = (k === 0) || (k === c._u);
    ctx.fillStyle = '#111'; if (k === 0) ctx.fillStyle = '#c4161c';
    ctx.beginPath(); ctx.arc(x, 36, 8.5, 0, 7); ctx.fill();
    ctx.strokeStyle = used ? '#ffc94d' : '#6b6b6b'; ctx.lineWidth = used ? 2 : 1.2; ctx.beginPath(); ctx.arc(x, 36, 8.5, 0, 7); ctx.stroke();
    ctx.fillStyle = k === 0 ? '#ff6a6a' : '#555'; ctx.beginPath(); ctx.arc(x, 36, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, 36, 1.8, 0, 7); ctx.fill();
    txt(k === 0 ? '+' : names[k], x, 49, k === 0 ? 11 : 8.5, k === 0 ? '#c4161c' : '#222', 'center', '800');
  }
}
/* 3D 텍스처용: 눈금판만 그려 준다 */
function paintFace3D(d, kind, c) {
  const q = d.g, W = d.cvs.width, H = d.cvs.height;
  q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H);
  q.setTransform(W / 104, 0, 0, H / 60, 0, 0);
  paintMeterFace(q, kind, c);
  q.setTransform(1, 0, 0, 1, 0, 0);
  d.tex.needsUpdate = true;
}
