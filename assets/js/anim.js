/* 产品页动图: <div class="anim" data-anim="nest|shape|drill"><canvas></canvas></div> */
(function () {
  var FONT = getComputedStyle(document.body).fontFamily;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function en() { return document.documentElement.lang === 'en'; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(t) { return Math.max(0, Math.min(1, t)); }

  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function backdrop(c, W, H) {
    var g = c.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, W * 0.75);
    g.addColorStop(0, '#26303d'); g.addColorStop(1, '#121821');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1;
    for (var x = 0; x < W; x += 24) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke(); }
    for (var y = 0; y < H; y += 24) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
  }
  // 左上角 HUD: 标题 + 大数字
  function hud(c, W, cap, big, unit, accent) {
    var s = W / 820, x = 18 * s, y = 16 * s;
    c.font = '500 ' + 12 * s + 'px ' + FONT; var w1 = c.measureText(cap).width;
    c.font = '700 ' + 30 * s + 'px ' + FONT; var w2 = c.measureText(big).width;
    c.font = '500 ' + 13 * s + 'px ' + FONT; var w3 = c.measureText(unit).width;
    var w = Math.max(w1, w2 + w3 + 6 * s) + 28 * s, h = 64 * s;
    c.fillStyle = 'rgba(10,16,24,.82)'; rrect(c, x, y, w, h, 4 * s); c.fill();
    c.fillStyle = accent; c.fillRect(x, y, 3 * s, h);
    c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(255,255,255,.68)'; c.font = '500 ' + 12 * s + 'px ' + FONT; c.fillText(cap, x + 14 * s, y + 20 * s);
    c.fillStyle = '#fff'; c.font = '700 ' + 30 * s + 'px ' + FONT; c.fillText(big, x + 14 * s, y + 52 * s);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '500 ' + 13 * s + 'px ' + FONT; c.fillText(unit, x + 20 * s + w2, y + 52 * s);
  }
  // 右下角状态条
  function chips(c, W, H, items, accent) {
    var s = W / 820; c.font = '600 ' + 12 * s + 'px ' + FONT;
    var x = W - 18 * s, y = H - 18 * s - 26 * s;
    for (var i = items.length - 1; i >= 0; i--) {
      var t = items[i], w = c.measureText(t).width + 22 * s; x -= w;
      c.fillStyle = i === 0 ? accent : 'rgba(10,16,24,.82)'; rrect(c, x, y, w, 26 * s, 3 * s); c.fill();
      c.fillStyle = i === 0 ? '#0b1220' : '#e8edf3'; c.textBaseline = 'middle'; c.fillText(t, x + 11 * s, y + 13.5 * s);
      x -= 8 * s;
    }
  }

  // ---------------- SkNest: 矩形排样 + 刀路 ----------------
  var NEST = [
    { strips: [[560, [720, 720, 546, 300]], [400, [764, 764, 516]], [196, [600, 600, 600, 450]]], yield: 92.4 },
    { strips: [[520, [728, 728, 680]], [356, [716, 716, 716, 280]], [300, [546, 546, 546, 546]]], yield: 91.8 }
  ];
  function nestScene(c, W, H, T) {
    backdrop(c, W, H);
    var BW = 2440, BH = 1220, K = 4;
    var L = NEST[Math.floor(T / 11) % NEST.length], t = T % 11;
    var pad = W * 0.06, top = H * 0.2, sc = Math.min((W - pad * 2) / BW, (H - top - H * 0.14) / BH);
    var ox = (W - BW * sc) / 2, oy = top + ((H - top - H * 0.14) - BH * sc) / 2;
    var X = function (v) { return ox + v * sc; }, Y = function (v) { return oy + v * sc; };
    var fade = t > 10.4 ? 1 - (t - 10.4) / 0.6 : Math.min(1, t / 0.4);
    c.globalAlpha = fade;
    // 母板 + 余料斜纹
    c.fillStyle = '#f2ede2'; c.fillRect(X(0), Y(0), BW * sc, BH * sc);
    c.save(); c.beginPath(); c.rect(X(0), Y(0), BW * sc, BH * sc); c.clip();
    c.strokeStyle = 'rgba(184,154,102,.35)'; c.lineWidth = 1;
    for (var d = -BH; d < BW; d += 40) { c.beginPath(); c.moveTo(X(d), Y(0)); c.lineTo(X(d + BH), Y(BH)); c.stroke(); }
    c.restore();
    c.strokeStyle = '#b89a66'; c.lineWidth = 1.2; c.strokeRect(X(0), Y(0), BW * sc, BH * sc);
    // 零件
    var parts = [], cuts = [], y = 10;
    L.strips.forEach(function (st) {
      var h = st[0], x = 10, row = [];
      st[1].forEach(function (w) { row.push({ x: x, y: y, w: w, h: h }); x += w + K; });
      parts = parts.concat(row);
      cuts.push({ x0: 0, y0: y + h + K / 2, x1: BW, y1: y + h + K / 2 });
      row.forEach(function (p) { cuts.push({ x0: p.x + p.w + K / 2, y0: y, x1: p.x + p.w + K / 2, y1: y + h }); });
      y += h + K;
    });
    var placeEnd = 0.6 + parts.length * 0.16;
    var area = 0, s = W / 820, total = 0;
    parts.forEach(function (p, i) {
      var k = ease((t - 0.6 - i * 0.16) / 0.45);
      if (k <= 0) return;
      area += p.w * p.h * k;
      var dx = (1 - k) * 380;
      c.globalAlpha = fade * k;
      c.fillStyle = '#dce8fa'; c.strokeStyle = '#6f93d0'; c.lineWidth = 1;
      c.fillRect(X(p.x + dx), Y(p.y), p.w * sc, p.h * sc); c.strokeRect(X(p.x + dx), Y(p.y), p.w * sc, p.h * sc);
      if (p.h * sc > 20 * s && p.w * sc > 50 * s) {
        c.fillStyle = '#2c4f86'; c.font = '600 ' + 12 * s + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(p.w + '×' + p.h, X(p.x + dx + p.w / 2), Y(p.y + p.h / 2)); c.textAlign = 'left';
      }
    });
    c.globalAlpha = fade;
    // 刀路
    var cutStart = placeEnd + 0.5, per = (10 - cutStart) / cuts.length, done = 0;
    cuts.forEach(function (q, i) {
      var k = clamp01((t - cutStart - i * per) / (per * 0.8));
      if (k <= 0) return;
      if (k >= 1) done++;
      var x1 = q.x0 + (q.x1 - q.x0) * k, y1 = q.y0 + (q.y1 - q.y0) * k;
      c.strokeStyle = 'rgba(238,138,18,.35)'; c.lineWidth = 6 * s; c.beginPath(); c.moveTo(X(q.x0), Y(q.y0)); c.lineTo(X(x1), Y(y1)); c.stroke();
      c.strokeStyle = '#EE8A12'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(X(q.x0), Y(q.y0)); c.lineTo(X(x1), Y(y1)); c.stroke();
      if (k < 1) { c.fillStyle = '#ffd08a'; c.beginPath(); c.arc(X(x1), Y(y1), 5 * s, 0, 7); c.fill(); }
    });
    var yl = L.yield * area / total;
    hud(c, W, en() ? 'Board yield' : '本板利用率', Math.min(L.yield, yl).toFixed(1), '%', '#1F5FD6');
    chips(c, W, H, [en() ? 'Optimized' : '已优化', (en() ? 'Parts ' : '零件 ') + parts.filter(function (p, i) { return t > 0.9 + i * 0.16; }).length + ' / ' + parts.length,
      (en() ? 'Cuts ' : '刀数 ') + done + ' / ' + cuts.length], '#4f8cf0');
    c.globalAlpha = 1;
  }

  // ---------------- YxCut: 异形排版 + 刀路 ----------------
  function arcPts(cx, cy, r, a0, a1, n) { var p = []; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
  function circle(cx, cy, r) { return arcPts(cx, cy, r, 0, Math.PI * 2, 40); }
  var SHAPES = (function () {
    var s = [];
    // 拱形床头板
    s.push({ outer: [[40, 1180], [1040, 1180], [1040, 540]].concat(arcPts(540, 540, 500, 0, -Math.PI, 36)).concat([[40, 540]]), holes: [circle(200, 1040, 24), circle(880, 1040, 24)], col: '#e6d3f5' });
    // 带内孔的圆角面板 + 内孔小圆件
    var rr = [], x0 = 1080, y0 = 40, w = 700, h = 640, r = 90;
    rr = rr.concat(arcPts(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, 8), arcPts(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, 8),
      arcPts(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, 8), arcPts(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 8));
    s.push({ outer: circle(1430, 360, 140), holes: [], col: '#fde2c4', inner: true });
    s.push({ outer: rr, holes: [circle(1430, 360, 200)], col: '#d9e7fb' });
    // L 形
    s.push({ outer: [[1080, 720], [2400, 720], [2400, 1180], [1560, 1180], [1560, 980], [1080, 980]], holes: [circle(1200, 850, 24), circle(2280, 1060, 24)], col: '#d7f0df' });
    // 1/4 圆转角板
    s.push({ outer: [[1820, 680]].concat(arcPts(1820, 680, 580, -Math.PI / 2, 0, 18)), holes: [], col: '#fbe3e8' });
    return s;
  })();
  function pathLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  function partialPath(c, p, k, X, Y) {
    var total = pathLen(p) * k, acc = 0; c.beginPath(); c.moveTo(X(p[0][0]), Y(p[0][1]));
    for (var i = 1; i < p.length; i++) {
      var l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (acc + l >= total) { var f = (total - acc) / l; var px = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, py = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f; c.lineTo(X(px), Y(py)); return [px, py]; }
      acc += l; c.lineTo(X(p[i][0]), Y(p[i][1]));
    }
    return p[p.length - 1];
  }
  function shapeScene(c, W, H, T) {
    backdrop(c, W, H);
    var BW = 2440, BH = 1220, t = T % 12, s = W / 820;
    var pad = W * 0.06, top = H * 0.2, sc = Math.min((W - pad * 2) / BW, (H - top - H * 0.14) / BH);
    var ox = (W - BW * sc) / 2, oy = top + ((H - top - H * 0.14) - BH * sc) / 2;
    var X = function (v) { return ox + v * sc; }, Y = function (v) { return oy + v * sc; };
    var fade = t > 11.4 ? 1 - (t - 11.4) / 0.6 : Math.min(1, t / 0.4);
    c.globalAlpha = fade;
    c.fillStyle = '#efe6d6'; c.fillRect(X(0), Y(0), BW * sc, BH * sc);
    c.strokeStyle = '#b89a66'; c.lineWidth = 1.2; c.strokeRect(X(0), Y(0), BW * sc, BH * sc);
    // 落件
    SHAPES.forEach(function (sh, i) {
      var k = ease((t - 0.5 - i * 0.28) / 0.5); if (k <= 0) return;
      c.globalAlpha = fade * k;
      var dy = (1 - k) * -160;
      c.beginPath(); sh.outer.forEach(function (p, j) { j ? c.lineTo(X(p[0]), Y(p[1] + dy)) : c.moveTo(X(p[0]), Y(p[1] + dy)); }); c.closePath();
      sh.holes.forEach(function (hp) { hp.slice().reverse().forEach(function (p, j) { j ? c.lineTo(X(p[0]), Y(p[1] + dy)) : c.moveTo(X(p[0]), Y(p[1] + dy)); }); c.closePath(); });
      c.fillStyle = sh.col; c.fill('evenodd'); c.strokeStyle = 'rgba(40,60,90,.55)'; c.lineWidth = 1; c.stroke();
    });
    c.globalAlpha = fade;
    // 刀路: 先内孔与内孔件, 再外形
    var paths = [];
    SHAPES.forEach(function (sh) { sh.holes.forEach(function (h) { paths.push({ p: h, inner: true }); }); });
    SHAPES.forEach(function (sh) { if (sh.inner) paths.unshift({ p: sh.outer, inner: true }); });
    SHAPES.forEach(function (sh) { if (!sh.inner) paths.push({ p: sh.outer.concat([sh.outer[0]]) }); });
    var start = 0.5 + SHAPES.length * 0.28 + 0.6, per = (11 - start) / paths.length, done = 0, tool = null;
    paths.forEach(function (q, i) {
      var k = clamp01((t - start - i * per) / (per * 0.92)); if (k <= 0) return;
      if (k >= 1) done++;
      c.strokeStyle = 'rgba(140,90,255,.35)'; c.lineWidth = 6 * s; partialPath(c, q.p, k, X, Y); c.stroke();
      c.strokeStyle = '#9b6bff'; c.lineWidth = 2 * s; var end = partialPath(c, q.p, k, X, Y); c.stroke();
      if (k < 1) tool = end;
    });
    if (tool) {
      var p = [X(tool[0]), Y(tool[1])], g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 18 * s);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, 'rgba(180,140,255,.6)'); g.addColorStop(1, 'rgba(140,90,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], 18 * s, 0, 7); c.fill();
    }
    var placed = SHAPES.filter(function (sh, i) { return t > 0.8 + i * 0.28; }).length;
    hud(c, W, en() ? 'True-shape yield' : '异形排版利用率', (Math.min(1, placed / SHAPES.length) * 91.2).toFixed(1), '%', '#8B5CF6');
    chips(c, W, H, [en() ? 'Router program' : '开料机程序', (en() ? 'Parts ' : '零件 ') + placed + ' / ' + SHAPES.length, (en() ? 'Toolpaths ' : '刀路 ') + done + ' / ' + paths.length], '#a78bfa');
    c.globalAlpha = 1;
  }

  // ---------------- Drill6: 扫码 + 六面钻孔 ----------------
  var AX = 0.0988, BX = 0.0395, AY = -0.0215, BY = 0.064, CZ = 0.074;
  var HOLES = (function () {
    var h = [], i;
    for (i = 0; i < 6; i++) h.push({ f: 'top', x: 37, y: 60 + i * 96 * 0.9 });
    for (i = 0; i < 6; i++) h.push({ f: 'top', x: 683, y: 60 + i * 96 * 0.9 });
    h.push({ f: 'top', x: 360, y: 280, big: true });
    h.push({ f: 'top', x: 200, y: 100, big: true }); h.push({ f: 'top', x: 520, y: 460, big: true });
    for (i = 0; i < 4; i++) h.push({ f: 'front', x: 90 + i * 180 });
    for (i = 0; i < 3; i++) h.push({ f: 'left', y: 100 + i * 180 });
    return h;
  })();
  function drillScene(c, W, H, T) {
    backdrop(c, W, H);
    var t = T % 12, s = W / 820;
    var PW = 720, PD = 560, PT = 40;
    var k = Math.min(W * 0.0062, H * 0.0105);
    var cx = W * 0.5 - (PW / 2 * AX + PD / 2 * BX) * k * 1.0, cy = H * 0.58 - (PW / 2 * AY + PD / 2 * BY) * k;
    var P = function (x, v, z) { return [cx + k * (x * AX + v * BX), cy + k * (x * AY + v * BY - z * CZ)]; };
    var poly = function (pts, fill, stroke) { c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } };
    var fade = t > 11.4 ? 1 - (t - 11.4) / 0.6 : Math.min(1, t / 0.4);
    c.globalAlpha = fade;
    // 工作台
    poly([P(-160, -120, -20), P(PW + 160, -120, -20), P(PW + 160, PD + 160, -20), P(-160, PD + 160, -20)], '#2b3440', 'rgba(0,0,0,.4)');
    c.fillStyle = 'rgba(205,214,226,.35)';
    for (var gx = -120; gx < PW + 140; gx += 70) for (var gv = -80; gv < PD + 140; gv += 70) { var q = P(gx, gv, -20); c.fillRect(q[0] - 1, q[1] - 0.6, 2, 1.2); }
    // 夹钳
    [120, 600].forEach(function (x) { var a = P(x - 40, -90, 0), b = P(x + 40, -90, 0), d = P(x + 40, -10, 0), e = P(x - 40, -10, 0); poly([a, b, d, e], '#EE8A12'); });
    // 板件: 左面 / 前面 / 顶面
    poly([P(0, 0, 0), P(0, PD, 0), P(0, PD, PT), P(0, 0, PT)], '#c9b48e', 'rgba(70,45,15,.35)');
    poly([P(0, PD, 0), P(PW, PD, 0), P(PW, PD, PT), P(0, PD, PT)], '#d8c39c', 'rgba(70,45,15,.35)');
    poly([P(0, 0, PT), P(PW, 0, PT), P(PW, PD, PT), P(0, PD, PT)], '#f1e6cf', 'rgba(70,45,15,.35)');
    // 扫码阶段
    var scanEnd = 1.6, per = (10.6 - scanEnd) / HOLES.length, cur = -1, head = null;
    HOLES.forEach(function (h, i) {
      var t0 = scanEnd + i * per, kk = (t - t0) / per;
      var pos = h.f === 'top' ? P(h.x, h.y, PT) : h.f === 'front' ? P(h.x, PD, PT / 2) : P(0, h.y, PT / 2);
      if (kk >= 0 && kk < 1) { cur = i; head = { h: h, pos: pos, k: kk }; }
      if (kk >= 0.45) {
        var r = (h.big ? 15 : 5) * s * 1.2;
        c.fillStyle = '#3a2a16';
        c.beginPath();
        if (h.f === 'top') c.ellipse(pos[0], pos[1], r, r * 0.62, -0.25, 0, 7);
        else if (h.f === 'front') c.ellipse(pos[0], pos[1], r * 0.7, r * 0.9, 0, 0, 7);
        else c.ellipse(pos[0], pos[1], r * 0.45, r * 0.9, 0, 0, 7);
        c.fill();
      }
    });
    // 主轴头
    if (head) {
      var p = head.pos, lift = head.k < 0.3 ? (1 - head.k / 0.3) : head.k > 0.6 ? (head.k - 0.6) / 0.4 : 0;
      if (head.h.f === 'top') {
        var hz = 26 * s + lift * 40 * s;
        c.fillStyle = '#d3d9e1'; c.fillRect(p[0] - 14 * s, p[1] - hz - 44 * s, 28 * s, 34 * s);
        c.fillStyle = '#9aa4b1'; c.fillRect(p[0] - 14 * s, p[1] - hz - 10 * s, 28 * s, 6 * s);
        c.strokeStyle = '#c7ced8'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(p[0], p[1] - hz - 4 * s); c.lineTo(p[0], p[1] - lift * 40 * s); c.stroke();
      } else {
        var dir = head.h.f === 'front' ? [0.4, 1] : [-1, 0.25], off = 20 * s + lift * 40 * s;
        var hx = p[0] + dir[0] * off, hy = p[1] + dir[1] * off * 0.6;
        c.fillStyle = '#d3d9e1'; c.fillRect(hx - 14 * s, hy - 12 * s, 28 * s, 24 * s);
        c.strokeStyle = '#c7ced8'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(hx, hy); c.lineTo(p[0] + dir[0] * lift * 30 * s, p[1] + dir[1] * lift * 18 * s); c.stroke();
      }
      if (head.k > 0.3 && head.k < 0.6) {
        c.save(); c.globalCompositeOperation = 'lighter';
        var g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 22 * s);
        g.addColorStop(0, 'rgba(255,220,150,.9)'); g.addColorStop(1, 'rgba(255,140,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], 22 * s, 0, 7); c.fill(); c.restore();
      }
    }
    // 扫码提示
    if (t < scanEnd + 0.4) {
      var a = clamp01(t / 0.3) * (t > scanEnd ? 1 - (t - scanEnd) / 0.4 : 1);
      c.globalAlpha = fade * a;
      var bx = W * 0.5, by = H * 0.3, bw = 300 * s, bh = 56 * s;
      c.fillStyle = 'rgba(10,16,24,.9)'; rrect(c, bx - bw / 2, by - bh / 2, bw, bh, 5 * s); c.fill();
      c.fillStyle = '#fff'; for (var i = 0; i < 26; i++) { var w = (i % 3 === 0 ? 3 : 1.5) * s; c.fillRect(bx - bw / 2 + 16 * s + i * 4.2 * s, by - 16 * s, w, 32 * s); }
      var sl = clamp01(t / 1.0); c.fillStyle = '#ff4d4d'; c.fillRect(bx - bw / 2 + 12 * s, by - 18 * s + sl * 36 * s, 118 * s, 2 * s);
      c.font = '600 ' + 13 * s + 'px ' + FONT; c.textBaseline = 'middle'; c.fillStyle = t > 1.0 ? '#5ee09a' : 'rgba(255,255,255,.8)';
      c.fillText(t > 1.0 ? (en() ? '✓ Left side 720×560' : '✓ 左侧板 720×560') : (en() ? 'Scanning…' : '扫码中…'), bx - bw / 2 + 146 * s, by);
      c.globalAlpha = fade;
    }
    var n = Math.max(0, Math.min(HOLES.length, cur < 0 ? (t > scanEnd ? HOLES.length : 0) : cur + 1));
    hud(c, W, en() ? 'Drilling · current part' : '加工中 · 当前板件', n + ' / ' + HOLES.length, en() ? 'ops' : '项', '#EE8A12');
    chips(c, W, H, [en() ? 'Auto mode' : '自动加工', en() ? '6 faces · 1 setup' : '六面 · 一次装夹', en() ? 'Collision checked' : '碰撞已校验'], '#f5a623');
    c.globalAlpha = 1;
  }

  var SCENES = { nest: nestScene, shape: shapeScene, drill: drillScene };
  document.querySelectorAll('.anim[data-anim]').forEach(function (host) {
    var fn = SCENES[host.dataset.anim]; if (!fn) return;
    var cv = host.querySelector('canvas'), c = cv.getContext('2d'), W = 0, H = 0, dpr = 1, t0 = 0, raf = 0, vis = false;
    function resize() {
      var r = host.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function draw(T) { c.setTransform(dpr, 0, 0, dpr, 0, 0); fn(c, W, H, T); }
    var seek = /animT=([\d.]+)/.exec(location.hash);   // 调试/截图: #animT=秒 定帧
    function loop(now) { raf = 0; if (!vis) return; if (!t0) t0 = now; draw((now - t0) / 1000); raf = requestAnimationFrame(loop); }
    resize();
    var still = reduce || seek;
    draw(seek ? +seek[1] : host.dataset.anim === 'drill' ? 7.5 : 9.6);
    window.addEventListener('resize', function () { resize(); if (still) draw(seek ? +seek[1] : 9.6); });
    if (still) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }).observe(host);
    else { vis = true; raf = requestAnimationFrame(loop); }
  });
})();
