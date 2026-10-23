/* SlwControl 2.5D 加工仿真示意 — canvas 绘制。坐标约定:
   X = 锯梁方向(左右), V = 送料方向(V<0 锯线后方推手区, V=0 锯线, V>0 前方气浮台), Z = 高度。 */
(function () {
  var host = document.getElementById('sawSim');
  if (!host) return;
  var cv = host.querySelector('canvas');
  var ctx = cv.getContext('2d');
  var hud = {};
  host.querySelectorAll('[data-k]').forEach(function (el) { hud[el.dataset.k] = el; });

  // ---------- 投影 (3/4 斜投影, mm -> 设计像素) ----------
  var AX = 0.0988, BX = 0.0395, AY = -0.0215, BY = 0.064, CZ = 0.074;   // 略俯视, 让锯线前后都看得见
  var k = 1, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;
  function P(x, v, z) { return [ox + k * (x * AX + v * BX), oy + k * (x * AY + v * BY - z * CZ)]; }

  // ---------- 机台尺寸 ----------
  var FLOOR = -820, LAYER = 30, LAYERS = 3, T = LAYER * LAYERS;
  var BL = -2000, BR = 800;                 // 大板 2800 宽, 贴左基准
  var BOARD_LEN = 2070;
  var CUTS = [10, 560, 560, 560];           // 修边 + 3 条, 尾部 380 余料
  var TABLES = [1650, 550, -550, -1650];    // 气浮台中心 X(远 -> 近)

  var C = {
    bodyTop: '#eef1f5', bodyFront: '#d3d9e1', bodySide: '#b9c1cc',
    darkTop: '#2b3440', darkFront: '#1d242d', darkSide: '#171d25',
    woodTop: '#e6bf86', woodFront: '#c99b5e', woodSide: '#b08348',
    doneTop: '#e9c48c', remTop: '#b9c6d3', remFront: '#98a7b6', remSide: '#8696a6',
    accent: '#EE8A12', green: '#17A05D'
  };

  // ---------- 状态 ----------
  var S = {
    front: -1250, remain: BOARD_LEN, beam: 0, sawX: BR + 300, cutting: false, cutStart: BR + 300,
    pusher: -1250 - BOARD_LEN, grip: 1, strips: [], parts: 0, cutIdx: 0, round: 1, curLen: CUTS[1],
    phase: 'load', dims: 0
  };
  var dust = [];

  // ---------- 时间线 ----------
  var steps = [], si = 0, st = 0;
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function step(dur, phase, fn, start) { steps.push({ d: dur, phase: phase, fn: fn, start: start }); }

  function buildBoard() {
    steps = []; si = 0; st = 0;
    var f0;
    step(1.5, 'load', function (t) {
      S.front = lerp(-1250, -180, ease(t)); S.pusher = S.front - S.remain;
    }, function () {
      S.remain = BOARD_LEN; S.grip = 1; S.cutIdx = 0; S.beam = 0; S.sawX = BR + 300; S.cutting = false;
    });
    CUTS.forEach(function (w, i) {
      step(0.55 + (w + 180) / 2200, 'feed', function (t) {
        S.front = lerp(f0, w, ease(t)); S.pusher = S.front - S.remain; S.dims = t;
      }, function () { f0 = S.front; S.curLen = w; S.cutIdx = i + 1; });
      step(0.35, 'clamp', function (t) { S.beam = ease(t); });
      step(1.7, 'cut', function (t) {
        S.cutting = t > 0.02 && t < 0.98; S.sawX = lerp(BR + 300, BL - 300, ease(t));
      }, function () { S.cutStart = BR + 300; });
      step(0.3, 'release', function (t) { S.beam = 1 - ease(t); S.cutting = false; }, function () {
        S.strips.forEach(function (s) { s.retire = true; });
        S.strips.push({ v0: 0, base: 0, w: w, z: 0, a: 1, kind: i === 0 ? 'waste' : 'part', n: i, sx: 0 });
        S.remain -= w; S.front = 0; S.pusher = -S.remain;
        if (i > 0) S.parts += LAYERS;
      });
      step(0.8, 'eject', function (t) { moveStrips(t); });
    });
    // 尾部余料: 推手送出, 夹钳松开
    step(1.0, 'feed', function (t) {
      S.front = lerp(0, S.remain + 40, ease(t)); S.pusher = S.front - S.remain; S.dims = t;
    }, function () { S.curLen = S.remain; S.cutIdx = CUTS.length + 1; });
    step(0.25, 'release', function (t) { S.grip = 1 - t; }, function () {
      S.strips.forEach(function (s) { s.retire = true; });
      S.strips.push({ v0: 40, base: 40, w: S.remain, z: 0, a: 1, kind: 'rem', n: 9, sx: 0 });
      S.front = 9999; S.remain = 0;
    });
    step(0.9, 'eject', function (t) { moveStrips(t); S.pusher = lerp(-420, -2600, ease(t)); });
    step(0.7, 'eject', function (t) { moveStrips(t); }, function () { S.strips.forEach(function (s) { s.retire = true; }); });
    step(0.01, 'load', function () {
      S.strips = S.strips.filter(function (s) { return !s.retire; });
      S.round = S.round % 3 + 1; if (S.round === 1) S.parts = 0;
      S.remain = BOARD_LEN;
    });
  }
  function moveStrips(t) {
    S.strips.forEach(function (s) {
      if (s.retire) { s.v0 = s.base + 1500 * ease(t); s.a = 1 - t; }
      else if (s.kind === 'waste') { s.v0 = s.base + 120 * t; s.z = -260 * t * t; s.a = 1 - t; }
      else s.v0 = lerp(s.base, s.base + (s.base < 100 ? 680 : 0), ease(t));
    });
    if (t >= 1) {
      S.strips = S.strips.filter(function (s) { return !s.retire && s.a > 0.02; });
      S.strips.forEach(function (s) { s.base = s.v0; });
    }
  }

  function advance(dt) {
    var s = steps[si];
    if (!s) { buildBoard(); s = steps[0]; }
    if (st === 0 && s.start) s.start();
    st += dt;
    var t = Math.min(1, st / s.d);
    S.phase = s.phase;
    s.fn(t);
    if (t >= 1) { si++; st = 0; if (si >= steps.length) buildBoard(); }
  }

  // ---------- 绘制基元 ----------
  function poly(pts, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.6, k * 0.012); ctx.stroke(); }
  }
  // 可见面: 顶(+Z) / 前(+V) / 左(-X)
  function box(x0, x1, v0, v1, z0, z1, top, front, side, edge) {
    var e = edge === undefined ? 'rgba(10,16,24,.28)' : edge;
    poly([P(x0, v0, z0), P(x0, v1, z0), P(x0, v1, z1), P(x0, v0, z1)], side, e);
    poly([P(x0, v1, z0), P(x1, v1, z0), P(x1, v1, z1), P(x0, v1, z1)], front, e);
    poly([P(x0, v0, z1), P(x1, v0, z1), P(x1, v1, z1), P(x0, v1, z1)], top, e);
  }
  function grad(p0, p1, a, b) {
    var g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); g.addColorStop(0, a); g.addColorStop(1, b); return g;
  }
  function shadow(x0, x1, v0, v1, alpha) {
    ctx.save();
    ctx.filter = 'blur(' + Math.round(6 * k) + 'px)';
    poly([P(x0, v0, FLOOR), P(x1, v0, FLOOR), P(x1, v1, FLOOR), P(x0, v1, FLOOR)], 'rgba(0,0,0,' + alpha + ')');
    ctx.restore();
  }
  function px(n) { return n * W / 1000; }
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'zh'; }

  function tag(wp, text, dx, dy) {
    if (W < 560) return;
    var p = P(wp[0], wp[1], wp[2]), q = [p[0] + px(dx), p[1] + px(dy)];
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], px(2.6), 0, 7); ctx.fill();
    ctx.font = '600 ' + px(12.5) + 'px ' + FONT;
    var tw = ctx.measureText(text).width, h = px(22), pad = px(8);
    var bx = dx < 0 ? q[0] - tw - pad * 2 : q[0];
    ctx.fillStyle = 'rgba(10,20,32,.86)'; rrect(bx, q[1] - h / 2, tw + pad * 2, h, px(3)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(bx, q[1] - h / 2, px(2), h);
    ctx.fillStyle = '#e8edf3'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + pad, q[1] + px(0.5));
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  var FONT = getComputedStyle(document.body).fontFamily;
  var L = {
    zh: { beam: '压梁', pusher: '推手 · 夹钳', saw: '锯车', table: '气浮台', aligner: '侧靠轮', rem: '余料', label: '自动贴标' },
    en: { beam: 'Pressure beam', pusher: 'Pusher · grippers', saw: 'Saw carriage', table: 'Air table', aligner: 'Side aligner', rem: 'Remnant', label: 'Auto label' }
  };

  // ---------- 场景 ----------
  function drawFloor() {
    var g = ctx.createRadialGradient(W * 0.52, H * 0.62, 0, W * 0.52, H * 0.62, W * 0.75);
    g.addColorStop(0, '#3a4554'); g.addColorStop(0.55, '#232b36'); g.addColorStop(1, '#141a22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    for (var x = -5000; x <= 5000; x += 500) { var a = P(x, -5000, FLOOR), b = P(x, 4000, FLOOR); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (var v = -5000; v <= 4000; v += 500) { var c = P(-5000, v, FLOOR), d = P(5000, v, FLOOR); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
  }

  function drawRear() {
    // 后方托料杆 + 推手导轨
    [-1750, -1050, -350, 350, 1050, 1750].forEach(function (x) {
      box(x - 30, x + 30, -3300, -140, -60, 0, '#c9d0d9', '#a7b0bc', '#98a2ae');
      box(x - 25, x + 25, -3150, -3080, FLOOR, -60, C.bodyFront, C.bodySide, C.bodySide);
    });
    [2250, -2250].forEach(function (x) {
      box(x - 80, x + 80, -3150, -3050, FLOOR, 330, C.bodyTop, C.bodyFront, C.bodySide);
      box(x - 70, x + 70, -3450, -330, 240, 360, C.bodyTop, C.bodyFront, C.bodySide);
      ctx.strokeStyle = 'rgba(40,50,62,.35)'; ctx.lineWidth = Math.max(1, k * 0.02);
      var a = P(x, -3420, 360), b = P(x, -360, 360); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
  }

  function drawCabinet() {
    box(2250, 2750, -380, 260, FLOOR, 1060, C.bodyTop, C.bodyFront, C.bodySide);
    // 柜门缝 + 把手
    var e = 'rgba(40,50,62,.3)';
    poly([P(2330, 260, FLOOR + 60), P(2680, 260, FLOOR + 60), P(2680, 260, 990), P(2330, 260, 990)], null, e);
    box(2600, 2625, 255, 275, 420, 700, '#8d97a4', '#7a8592', '#6c7683', 'transparent');
  }

  function drawLowerBody() {
    box(-2250, 2250, -140, 120, FLOOR, -20, C.bodyTop, grad(P(0, 120, -20), P(0, 120, FLOOR), '#c7ced8', '#9aa4b1'), C.bodySide);
    // 锯车槽
    poly([P(-2200, 120, -60), P(2200, 120, -60), P(2200, 120, -420), P(-2200, 120, -420)], '#151b23');
    // 锯车
    var xc = Math.max(-2050, Math.min(2050, S.sawX));
    box(xc - 220, xc + 220, 80, 150, -400, -80, '#ffb04a', C.accent, '#c66f08', 'rgba(0,0,0,.25)');
    box(xc - 150, xc + 150, 140, 152, -330, -150, '#ffd08a', '#2a2f36', '#2a2f36', 'transparent');
  }

  function drawTables() {
    TABLES.forEach(function (x) {
      box(x - 230, x + 230, 1820, 1980, FLOOR, -50, C.bodyTop, C.bodyFront, C.bodySide);
      var x0 = x - 350, x1 = x + 350;
      box(x0, x1, 130, 2050, -50, 0, C.darkTop, C.darkFront, C.darkSide, 'rgba(0,0,0,.4)');
      var g = grad(P(x, 130, 0), P(x, 2050, 0), 'rgba(255,255,255,.0)', 'rgba(255,255,255,.07)');
      poly([P(x0, 130, 0), P(x1, 130, 0), P(x1, 2050, 0), P(x0, 2050, 0)], g);
      ctx.fillStyle = 'rgba(205,214,226,.55)';
      var r = Math.max(0.7, k * 0.009);
      for (var v = 210; v < 2000; v += 110) for (var xx = x0 + 60; xx < x1 - 30; xx += 105) {
        var p = P(xx, v, 0); ctx.fillRect(p[0] - r, p[1] - r * 0.6, r * 2, r * 1.2);
      }
      // 前沿圆角封边
      box(x0, x1, 2050, 2090, -55, 5, '#cfd6df', '#aab3bf', '#98a2ae', 'transparent');
    });
  }

  function slab(x0, x1, v0, v1, z0, z1, kind, a) {
    if (v1 <= v0) return;
    ctx.globalAlpha = a === undefined ? 1 : a;
    var top, front, side;
    if (kind === 'rem') { top = C.remTop; front = C.remFront; side = C.remSide; }
    else if (kind === 'waste') { top = '#a3a8b0'; front = '#868c95'; side = '#7a8089'; }
    else { top = grad(P(x0, v0, z1), P(x1, v1, z1), '#edca92', '#d9ab6d'); front = C.woodFront; side = C.woodSide; }
    box(x0, x1, v0, v1, z0, z1, top, front, side, 'rgba(70,45,15,.35)');
    // 叠切层线
    var n = Math.round((z1 - z0) / LAYER);
    ctx.strokeStyle = 'rgba(80,50,18,.45)'; ctx.lineWidth = Math.max(0.6, k * 0.012);
    for (var i = 1; i < n; i++) {
      var z = z0 + i * LAYER, p0 = P(x0, v0, z), p1 = P(x0, v1, z), p2 = P(x1, v1, z);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    // 木纹
    if (kind !== 'rem' && kind !== 'waste') {
      ctx.strokeStyle = 'rgba(150,100,40,.13)';
      for (var gx = x0 + 140; gx < x1; gx += 190) {
        var g0 = P(gx, v0 + 20, z1), g1 = P(gx + 60, v1 - 20, z1);
        ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.quadraticCurveTo((g0[0] + g1[0]) / 2 + px(2), (g0[1] + g1[1]) / 2, g1[0], g1[1]); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function sticker(x, v, z, a) {
    ctx.globalAlpha = a;
    var w = 150, d = 110;
    poly([P(x, v, z + 1), P(x + w, v, z + 1), P(x + w, v + d, z + 1), P(x, v + d, z + 1)], '#ffffff', 'rgba(0,0,0,.2)');
    ctx.strokeStyle = '#1b2330'; ctx.lineWidth = Math.max(0.6, k * 0.012);
    for (var i = 0; i < 9; i++) {
      var xx = x + 18 + i * 13 + (i % 3) * 2, p0 = P(xx, v + 20, z + 1), p1 = P(xx, v + 70, z + 1);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawStrips() {
    S.strips.slice().sort(function (a, b) { return a.v0 - b.v0; }).forEach(function (s) {
      var z0 = s.z, z1 = s.z + (s.kind === 'waste' ? T : T);
      slab(BL, BR, s.v0, s.v0 + s.w, z0, z1, s.kind, s.a);
      if (s.kind === 'part') {
        sticker(BL + 260, s.v0 + 90, z1, s.a);
        if (W >= 560) {
          var c = P((BL + BR) / 2 + 200, s.v0 + s.w / 2, z1);
          ctx.globalAlpha = s.a; ctx.font = '700 ' + px(13) + 'px ' + FONT; ctx.fillStyle = 'rgba(70,42,12,.9)';
          ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
          ctx.fillText('S' + s.n + (lang() === 'en' ? ' done ×' : ' 已切 ×') + LAYERS, c[0], c[1] - px(7));
          ctx.font = '500 ' + px(11) + 'px ' + FONT; ctx.fillStyle = 'rgba(70,42,12,.7)';
          ctx.fillText((BR - BL) + ' × ' + s.w, c[0], c[1] + px(9));
          ctx.textAlign = 'left'; ctx.globalAlpha = 1;
        }
      } else if (s.kind === 'rem' && W >= 560) {
        var c2 = P((BL + BR) / 2, s.v0 + s.w / 2, T);
        ctx.globalAlpha = s.a; ctx.font = '700 ' + px(12.5) + 'px ' + FONT; ctx.fillStyle = '#33455a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(L[lang()].rem + ' ' + (BR - BL) + ' × ' + s.w, c2[0], c2[1]);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
    });
  }

  function drawBoard() {
    if (S.remain <= 0) return;
    var rear = S.front - S.remain;
    shadowBoard(rear, S.front);
    slab(BL, BR, rear, S.front, 0, T, 'part');
    // 锯线 / 锯路
    if (S.front > 0) {
      var a = P(BL, 0, T), b = P(BR, 0, T);
      ctx.setLineDash([px(5), px(4)]); ctx.strokeStyle = 'rgba(238,138,18,' + (S.phase === 'feed' || S.phase === 'clamp' ? 0.95 : 0.5) + ')';
      ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (S.phase === 'cut' || S.phase === 'release') {
      var x = Math.max(BL, Math.min(BR, S.sawX));
      var c = P(x, 0, T + 1), d = P(BR, 0, T + 1);
      ctx.strokeStyle = 'rgba(40,22,6,.85)'; ctx.lineWidth = px(2.2);
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
  }
  function shadowBoard() { /* 板材平躺在托料杆/台面上, 不投地影 */ }

  function drawPusher() {
    var rear = S.pusher, top = T + 40;
    box(-2250, 2250, rear - 210, rear - 60, 230, 380, C.bodyTop, grad(P(0, rear - 60, 380), P(0, rear - 60, 230), '#e2e7ed', '#c3cad4'), C.bodySide);
    poly([P(-2250, rear - 60, 260), P(2250, rear - 60, 260), P(2250, rear - 60, 275), P(-2250, rear - 60, 275)], C.green);
    var drop = (1 - S.grip) * 60;
    [-1850, -1400, -950, -500, -50, 400, 700].forEach(function (x) {
      box(x - 45, x + 45, rear - 90, rear - 20, top + drop, 240, '#8e99a7', '#6f7a88', '#5f6a78');
      box(x - 55, x + 55, rear - 40, rear + 80, top - 30 + drop, top + 10 + drop, '#ffb04a', C.accent, '#c66f08', 'rgba(0,0,0,.3)');
    });
    tag([-2250, rear - 135, 380], L[lang()].pusher, -40, -34);
  }

  function drawBeams() {
    // 主梁
    box(-2250, 2250, -330, -110, 700, 960, C.bodyTop, grad(P(0, -110, 960), P(0, -110, 700), '#e7ebf0', '#c5ccd6'), C.bodySide);
    box(-2620, -2250, -380, 260, FLOOR, 960, C.bodyTop, grad(P(-2620, 260, 960), P(-2620, 260, FLOOR), '#dfe4ea', '#b5bdc8'), C.bodySide);
    poly([P(-2250, -110, 760), P(2250, -110, 760), P(2250, -110, 785), P(-2250, -110, 785)], C.green);
    // 压梁 (按压下程度)
    var zb = lerp(T + 170, T + 2, S.beam);
    box(-2250, 2250, -110, 70, zb, zb + 120, '#dfe4ea', grad(P(0, 70, zb + 120), P(0, 70, zb), '#cbd2db', '#a9b2bf'), '#9ea8b4');
    // 压梁吊杆
    [-1900, -950, 0, 950, 1900].forEach(function (x) {
      box(x - 35, x + 35, -60, 20, zb + 120, 700, '#c2c9d3', '#a8b1bd', '#97a1ad');
    });
    // 刻度
    ctx.strokeStyle = 'rgba(30,40,52,.45)'; ctx.lineWidth = 1;
    for (var x = -2200; x <= 2200; x += 100) {
      var a = P(x, 70, zb + 120), b = P(x, 70, zb + (x % 500 === 0 ? 70 : 95));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // 锯车位置游标
    var sx = Math.max(-2150, Math.min(2150, S.sawX));
    box(sx - 60, sx + 60, 70, 95, zb + 10, zb + 110, '#ffcf8a', C.accent, '#c66f08', 'rgba(0,0,0,.25)');
    S._saw = [sx, 95, zb + 110];
    tag([2000, 70, zb + 120], L[lang()].beam, 40, -36);
  }

  function drawBlade(now) {
    if (!S.cutting && S.phase !== 'cut') return;
    var x = S.sawX;
    // 锯片 (锯线竖直平面内的圆, 透视为椭圆, 发光叠加)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var c = P(x, 0, -60), R = 230;
    var pts = [];
    for (var i = 0; i <= 40; i++) { var a = Math.PI * i / 40; pts.push(P(x + Math.cos(a) * R, 0, -60 + Math.sin(a) * R)); }
    var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R * k * 0.1);
    g.addColorStop(0, 'rgba(255,190,90,.75)'); g.addColorStop(1, 'rgba(238,138,18,.05)');
    poly(pts, g);
    var spot = P(x, 0, T);
    var g2 = ctx.createRadialGradient(spot[0], spot[1], 0, spot[0], spot[1], px(34));
    g2.addColorStop(0, 'rgba(255,220,150,.9)'); g2.addColorStop(0.4, 'rgba(255,150,40,.35)'); g2.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(spot[0], spot[1], px(34), 0, 7); ctx.fill();
    ctx.restore();
    if (S.cutting && x > BL && x < BR) for (var j = 0; j < 3; j++) dust.push({ x: x + 40, v: 10, z: T, vx: 300 + Math.random() * 500, vv: 200 + Math.random() * 700, vz: 300 + Math.random() * 500, life: 0 });
  }
  function drawDust(dt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    dust = dust.filter(function (d) { return d.life < 0.6; });
    dust.forEach(function (d) {
      d.life += dt; d.x += d.vx * dt; d.v += d.vv * dt; d.z += d.vz * dt; d.vz -= 1400 * dt;
      var p = P(d.x, d.v, Math.max(0, d.z)), a = 1 - d.life / 0.6;
      ctx.fillStyle = 'rgba(255,200,120,' + (a * 0.8) + ')';
      ctx.fillRect(p[0], p[1], px(1.8), px(1.8));
    });
    ctx.restore();
  }

  function drawDims() {
    if (S.remain <= 0 || S.front <= 0 || !(S.phase === 'feed' || S.phase === 'clamp' || S.phase === 'cut')) return;
    var x = BR + 170, a = P(x, 0, T), b = P(x, S.front, T), e0 = P(BR + 40, 0, T), e1 = P(BR + 40, S.front, T);
    ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = px(1.4);
    ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(a[0], a[1]); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(b[0], b[1]);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    if (S.front < 60 || W < 420) return;
    var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], txt = Math.round(S.front).toLocaleString('en-US') + ' mm';
    ctx.font = '700 ' + px(13) + 'px ' + FONT;
    var tw = ctx.measureText(txt).width + px(14), h = px(22);
    rrect(m[0] + px(10), m[1] - h / 2, tw, h, px(3)); ctx.fill();
    ctx.fillStyle = '#1b1206'; ctx.textBaseline = 'middle'; ctx.fillText(txt, m[0] + px(17), m[1] + px(0.5));
  }

  function drawConsole() {
    box(-2700, -2640, 420, 480, FLOOR, 520, '#c8cfd8', '#a9b2be', '#98a2ae');
    box(-2760, -2580, 300, 620, 520, 900, '#2a313b', '#3a434f', '#242a33', 'rgba(0,0,0,.4)');
    // 屏幕 (前面朝向操作员)
    var s0 = P(-2745, 620, 540), s1 = P(-2595, 620, 540), s2 = P(-2595, 620, 885), s3 = P(-2745, 620, 885);
    poly([s0, s1, s2, s3], '#0f1a14');
    poly([P(-2740, 620, 860), P(-2600, 620, 860), P(-2600, 620, 880), P(-2740, 620, 880)], C.green);
    ctx.fillStyle = 'rgba(23,160,93,.55)';
    for (var i = 0; i < 4; i++) { var p = P(-2730, 620, 820 - i * 70), q = P(-2640, 620, 820 - i * 70); ctx.fillRect(p[0], p[1], Math.max(1, q[0] - p[0]), px(2)); }
  }

  function drawAligner() {
    if (S.remain <= 0) return;
    var p = P(BL - 70, -260, T * 0.5);
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.ellipse(p[0], p[1], px(7), px(4.5), 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(p[0], p[1], px(2.4), px(1.6), 0, 0, 7); ctx.fill();
  }

  function frame(dt, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFloor();
    shadow(-2700, 2800, -420, 300, 0.45);
    TABLES.forEach(function (x) { shadow(x - 330, x + 330, 300, 2100, 0.32); });
    drawRear();
    drawCabinet();
    drawLowerBody();
    drawTables();
    drawStrips();
    drawBoard();
    drawAligner();
    drawPusher();
    drawBeams();
    drawBlade(now);
    drawDust(dt);
    drawDims();
    drawConsole();
    if (S._saw) tag(S._saw, L[lang()].saw, 26, -46);
    tag([-1650, 1500, 0], L[lang()].table, -60, 30);
    updateHud();
  }

  // ---------- HUD ----------
  var last = '';
  function updateHud() {
    var en = lang() === 'en';
    var ph = {
      load: en ? 'Loading board' : '上料定位', feed: en ? 'Feeding' : '推手送料', clamp: en ? 'Beam clamping' : '压梁压紧',
      cut: en ? 'Cutting' : '锯切中', release: en ? 'Beam release' : '压梁抬起', eject: en ? 'Parts out' : '出料'
    }[S.phase];
    var cuts = CUTS.length + 1;
    var key = [en, ph, S.round, S.curLen, S.cutIdx, S.parts].join('|');
    if (key === last) return; last = key;
    var set = function (k, v) { if (hud[k]) hud[k].textContent = v; };
    set('cap', (en ? 'Stack ' : '第 ') + S.round + ' / 3' + (en ? ' · cut length' : ' 叠 · 本刀长度'));
    set('len', S.curLen.toLocaleString('en-US'));
    set('phase', ph);
    set('stackL', en ? 'Stack' : '叠切');
    set('stack', LAYERS);
    set('cutL', en ? 'Cut' : '刀次');
    set('cut', Math.max(1, S.cutIdx) + ' / ' + cuts);
    set('partsL', en ? 'Parts out' : '已下料');
    set('parts', S.parts + ' / 27');
    set('demo', en ? 'SIMULATION' : '仿真演示');
  }

  // ---------- 尺寸 / 循环 ----------
  function resize() {
    var r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // 用关键点包围盒适配画布
    k = 1; ox = 0; oy = 0;
    var pts = [[-2760, 620, 900], [-2700, -380, 960], [2750, -380, 1060], [2250, -3450, 360], [-2250, -3450, 360],
      [-2000, 2090, FLOOR], [2000, 2090, FLOOR], [-2760, 620, FLOOR], [2750, 260, FLOOR]];
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (q) { var p = P(q[0], q[1], q[2]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    var sm = W < 560, padX = W * 0.035, padT = H * (sm ? 0.25 : 0.16), padB = H * (sm ? 0.12 : 0.05);
    k = Math.min((W - padX * 2) / (x1 - x0), (H - padT - padB) / (y1 - y0));
    ox = (W - (x1 - x0) * k) / 2 - x0 * k + W * 0.03;
    oy = padT + ((H - padT - padB) - (y1 - y0) * k) / 2 - y0 * k;
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = false, prev = 0, raf = 0;
  function loop(now) {
    raf = 0;
    if (!visible) return;
    var dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0.016; prev = now;
    advance(dt);
    frame(dt, now);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduce) { prev = 0; raf = requestAnimationFrame(loop); } }

  buildBoard();
  resize();
  var seek = /simT=([\d.]+)/.exec(location.hash);   // 调试: #simT=秒 直接跳到该时刻并定帧
  var at = window.SAW_SIM_AT;   // 截图用: {round, cut, phase, p} 定帧到指定状态
  if (at) {
    for (var n = 0; n < 20000 && !(S.round === at.round && S.cutIdx === at.cut && S.phase === at.phase && st / steps[si].d >= at.p); n++) advance(0.02);
    reduce = true;
    for (var f = 0; f < 24; f++) frame(0.016, 0);   // 让锯屑铺开
  } else if (seek) {
    for (var j = 0; j < +seek[1] / 0.02; j++) advance(0.02);
    reduce = true; frame(0, 0);
  } else if (reduce) {
    // 静帧: 跳到第二刀锯切中段
    for (var i = 0; i < 2000 && !(S.cutIdx === 2 && S.phase === 'cut' && st > 0.8); i++) advance(0.02);
    frame(0, 0);
  } else frame(0, 0);

  window.addEventListener('resize', function () { resize(); frame(0, 0); });
  document.querySelectorAll('.lang-switch button').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(function () { last = ''; frame(0, 0); }, 0); });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting; if (visible) start();
    }).observe(host);
  } else { visible = true; start(); }
})();
