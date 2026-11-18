/* Interpolation Lab UI: draggable points, four methods, live readout. */
(function () {
  'use strict';
  var cv = document.getElementById('plot');
  if (!cv || !window.Interp) return;
  var ctx = cv.getContext('2d');
  var root = document.documentElement;
  var SK = window.SK || { t: function (k) { return k; } };

  /* ----- world <-> pixel mapping ----- */
  var XMIN = -5, XMAX = 5, YMIN = -3, YMAX = 3;
  var CLIP = 3.4;               /* curves leaving this |y| are cut so blow-ups stay readable */
  var MIN_DX = 0.12;            /* minimum x-distance between two points */
  var HIT = 16;                 /* pointer hit radius (px) */
  var W = 900, H = 520, dpr = 1, PAD = 28;

  function px(x) { return PAD + (x - XMIN) / (XMAX - XMIN) * (W - 2 * PAD); }
  function py(y) { return H - PAD - (y - YMIN) / (YMAX - YMIN) * (H - 2 * PAD); }
  function wx(p) { return XMIN + (p - PAD) / (W - 2 * PAD) * (XMAX - XMIN); }
  function wy(p) { return YMIN + (H - PAD - p) / (H - 2 * PAD) * (YMAX - YMIN); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ----- state ----- */
  var points = [];
  var truth = null;             /* function or null */
  var hoverX = null;
  var drag = null;              /* {i} while dragging */
  var history = [];             /* for Undo: snapshots of points */
  var enabled = { linear: true, lagrange: true, newton: false, spline: true };
  var COLORS = {};

  function snapshot() { history.push(JSON.stringify(points)); if (history.length > 50) history.shift(); }

  /* ----- presets ----- */
  function setPreset(name) {
    snapshot();
    var i, x;
    points = [];
    if (name === 'sin') {
      truth = function (x) { return 2 * Math.sin(x); };
      for (i = 0; i < 8; i++) { x = -4.5 + i * (9 / 7); points.push({ x: x, y: truth(x) }); }
    } else if (name === 'runge') {
      truth = function (x) { return 2.5 / (1 + x * x); };
      for (i = 0; i < 11; i++) { x = -5 + i; points.push({ x: x, y: truth(x) }); }
    } else {
      truth = null;
      var n = 6 + Math.floor(Math.random() * 3);
      for (i = 0; i < n; i++) {
        x = -4.4 + i * (8.8 / (n - 1)) + (Math.random() - .5) * .5;
        points.push({ x: clamp(x, XMIN + .1, XMAX - .1), y: (Math.random() - .5) * 4.4 });
      }
    }
    updateTruthToggle();
    draw();
  }

  function updateTruthToggle() {
    var t = document.getElementById('truth');
    if (!t) return;
    t.disabled = !truth;
    t.closest('.toggle').style.opacity = truth ? '1' : '.4';
  }

  /* ----- colors / sizing ----- */
  function readColors() {
    var cs = getComputedStyle(root);
    function v(n, f) { return cs.getPropertyValue(n).trim() || f; }
    COLORS = {
      linear: v('--b', '#5eead4'), lagrange: v('--c', '#f0abfc'), newton: v('--d', '#fbbf24'), spline: v('--a', '#a78bfa'),
      truth: v('--muted', '#9a9ab3'), fg: v('--fg', '#ececf6'), line: v('--line', 'rgba(255,255,255,.1)'), bg: v('--bg2', '#0d0d1a')
    };
    /* expose method colors as CSS variables for the toggles and the readout */
    root.style.setProperty('--lin', COLORS.linear);
    root.style.setProperty('--lag', COLORS.lagrange);
    root.style.setProperty('--new', COLORS.newton);
    root.style.setProperty('--spl', COLORS.spline);
    root.style.setProperty('--tru', COLORS.truth);
  }

  function resize() {
    var r = cv.parentElement.getBoundingClientRect();
    var cssW = Math.max(300, Math.floor(r.width - 20));
    var cssH = Math.round(cssW * (cssW < 520 ? .8 : .58));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    W = cssW; H = cssH; PAD = cssW < 520 ? 18 : 28;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  /* ----- drawing ----- */
  function drawGrid() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.line;
    ctx.fillStyle = COLORS.truth;
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    var x, y;
    ctx.globalAlpha = .7;
    for (x = XMIN; x <= XMAX; x += 1) {
      ctx.beginPath(); ctx.moveTo(px(x) + .5, py(YMAX)); ctx.lineTo(px(x) + .5, py(YMIN)); ctx.stroke();
      if (x !== 0 && W > 420) ctx.fillText(String(x), px(x), py(0) + 14);
    }
    for (y = YMIN; y <= YMAX; y += 1) {
      ctx.beginPath(); ctx.moveTo(px(XMIN), py(y) + .5); ctx.lineTo(px(XMAX), py(y) + .5); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.truth;
    ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.moveTo(px(XMIN), py(0) + .5); ctx.lineTo(px(XMAX), py(0) + .5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(0) + .5, py(YMIN)); ctx.lineTo(px(0) + .5, py(YMAX)); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function curve(f, color, width, dash, from, to) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD - 2, py(YMAX) - 2, W - 2 * PAD + 4, H - 2 * PAD + 4);
    ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    var pen = false, step = 2;
    for (var p = Math.max(px(from), PAD); p <= Math.min(px(to), W - PAD) + .01; p += step) {
      var y = f(wx(p));
      if (!isFinite(y) || Math.abs(y) > CLIP) { pen = false; continue; }
      if (!pen) { ctx.moveTo(p, py(y)); pen = true; } else ctx.lineTo(p, py(y));
    }
    ctx.stroke();
    ctx.restore();
  }

  function sortedPoints() { return points.slice().sort(function (a, b) { return a.x - b.x; }); }

  var fns = {};
  function build() {
    fns = {};
    if (points.length < 1) return;
    ['linear', 'lagrange', 'newton', 'spline'].forEach(function (m) { fns[m] = Interp[m](points); });
  }

  function draw() {
    if (!COLORS.fg) readColors();
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    build();
    var sp = sortedPoints();
    var from = sp.length ? sp[0].x : 0, to = sp.length ? sp[sp.length - 1].x : 0;

    var tcb = document.getElementById('truth');
    if (truth && tcb && tcb.checked) curve(truth, COLORS.truth, 1.6, [6, 6], XMIN, XMAX);

    if (points.length > 1) {
      if (enabled.linear) curve(fns.linear, COLORS.linear, 2, null, from, to);
      if (enabled.lagrange) curve(fns.lagrange, COLORS.lagrange, 2.4, null, from, to);
      if (enabled.newton) curve(fns.newton, COLORS.newton, 2, [2, 5], from, to);
      if (enabled.spline) curve(fns.spline, COLORS.spline, 3, null, from, to);
    }

    /* hover guide + dots on every enabled curve */
    if (hoverX !== null && points.length > 1 && hoverX >= from && hoverX <= to) {
      ctx.strokeStyle = COLORS.fg; ctx.globalAlpha = .35; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(px(hoverX), py(YMAX)); ctx.lineTo(px(hoverX), py(YMIN)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ['linear', 'lagrange', 'newton', 'spline'].forEach(function (m) {
        if (!enabled[m]) return;
        var y = fns[m](hoverX);
        if (!isFinite(y) || Math.abs(y) > CLIP) return;
        ctx.fillStyle = COLORS[m]; ctx.strokeStyle = COLORS.bg; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px(hoverX), py(y), 4.5, 0, 6.2832); ctx.fill(); ctx.stroke();
      });
    }

    /* control points */
    for (var i = 0; i < points.length; i++) {
      var p = points[i], active = drag && drag.i === i;
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), active ? 9 : 7, 0, 6.2832);
      ctx.fillStyle = COLORS.bg; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.fg; ctx.stroke();
      if (active) { ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 14, 0, 6.2832); ctx.globalAlpha = .25; ctx.fillStyle = COLORS.spline; ctx.fill(); ctx.globalAlpha = 1; }
    }
    renderReadout();
  }

  /* ----- readout ----- */
  function fmt(v) {
    if (!isFinite(v)) return '—';
    return Math.abs(v) >= 100 ? v.toExponential(1) : v.toFixed(3);
  }
  var NAMES = { linear: 'lab.m.linear', lagrange: 'lab.m.lagrange', newton: 'lab.m.newton', spline: 'lab.m.spline' };
  function renderReadout() {
    var box = document.getElementById('readout');
    if (!box) return;
    var sp = sortedPoints();
    if (hoverX === null || sp.length < 2 || hoverX < sp[0].x || hoverX > sp[sp.length - 1].x) {
      box.innerHTML = '';
      var p = document.createElement('p'); p.className = 'hint'; p.textContent = SK.t('lab.hint'); box.appendChild(p);
      return;
    }
    box.innerHTML = '';
    var head = document.createElement('div'); head.className = 'row x';
    head.innerHTML = '<span>x</span><b></b>'; head.lastChild.textContent = hoverX.toFixed(3); box.appendChild(head);
    ['linear', 'lagrange', 'newton', 'spline'].forEach(function (m) {
      if (!enabled[m]) return;
      var row = document.createElement('div'); row.className = 'row'; row.style.setProperty('--dot', COLORS[m]);
      var l = document.createElement('span'); var dot = document.createElement('i'); l.appendChild(dot);
      l.appendChild(document.createTextNode(SK.t(NAMES[m])));
      var b = document.createElement('b'); b.textContent = fmt(fns[m](hoverX));
      row.appendChild(l); row.appendChild(b); box.appendChild(row);
    });
    var tcb = document.getElementById('truth');
    if (truth && tcb && tcb.checked) {
      var r = document.createElement('div'); r.className = 'row'; r.style.setProperty('--dot', COLORS.truth);
      var l2 = document.createElement('span'); l2.appendChild(document.createElement('i')); l2.appendChild(document.createTextNode(SK.t('lab.truth')));
      var b2 = document.createElement('b'); b2.textContent = fmt(truth(hoverX));
      r.appendChild(l2); r.appendChild(b2); box.appendChild(r);
    }
  }

  /* ----- pointer interaction ----- */
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function hit(m) {
    var best = -1, bd = HIT * HIT;
    for (var i = 0; i < points.length; i++) {
      var dx = px(points[i].x) - m.x, dy = py(points[i].y) - m.y, d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }
  function xFree(x, skip) {
    for (var i = 0; i < points.length; i++) if (i !== skip && Math.abs(points[i].x - x) < MIN_DX) return false;
    return true;
  }

  cv.addEventListener('pointerdown', function (e) {
    if (e.button === 2) return;
    var m = pos(e), i = hit(m);
    if (i < 0) {
      var x = clamp(wx(m.x), XMIN, XMAX), y = clamp(wy(m.y), YMIN, YMAX);
      if (!xFree(x, -1)) return;
      snapshot();
      points.push({ x: x, y: y }); i = points.length - 1;
      truth = null; updateTruthToggle();
    } else { snapshot(); }
    drag = { i: i };
    cv.setPointerCapture(e.pointerId);
    hoverX = points[i].x;
    draw();
  });

  cv.addEventListener('pointermove', function (e) {
    var m = pos(e);
    if (drag) {
      var x = clamp(wx(m.x), XMIN, XMAX), y = clamp(wy(m.y), YMIN, YMAX);
      var p = points[drag.i];
      if (xFree(x, drag.i)) p.x = x;
      p.y = y;
      hoverX = p.x;
      truth = null; updateTruthToggle();
    } else {
      hoverX = clamp(wx(m.x), XMIN, XMAX);
      cv.style.cursor = hit(m) >= 0 ? 'grab' : 'crosshair';
    }
    draw();
  });

  function endDrag() { if (drag) { drag = null; draw(); } }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', function () { if (!drag) { hoverX = null; draw(); } });

  function removeAt(e) {
    var i = hit(pos(e));
    if (i >= 0) { snapshot(); points.splice(i, 1); drag = null; truth = null; updateTruthToggle(); draw(); }
  }
  cv.addEventListener('dblclick', removeAt);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); removeAt(e); });

  /* ----- controls ----- */
  document.querySelectorAll('[data-m]').forEach(function (cb) {
    cb.addEventListener('change', function () { enabled[cb.getAttribute('data-m')] = cb.checked; draw(); });
  });
  var truthCb = document.getElementById('truth');
  if (truthCb) truthCb.addEventListener('change', draw);
  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () { setPreset(b.getAttribute('data-preset')); });
  });
  document.getElementById('undo').addEventListener('click', function () {
    if (!history.length) return;
    points = JSON.parse(history.pop()); drag = null; truth = null; updateTruthToggle(); draw();
  });
  document.getElementById('clear').addEventListener('click', function () {
    if (!points.length) return;
    snapshot(); points = []; truth = null; updateTruthToggle(); draw();
  });

  document.addEventListener('themechange', function () { readColors(); draw(); });
  document.addEventListener('langchange', function () { renderReadout(); });
  window.addEventListener('resize', resize);

  readColors();
  setPreset('sin');
  history = [];
  resize();
})();
