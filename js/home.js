/* Home page: embedding-space background, typing roles, tilt cards, contribution-snake art. */
(function () {
  'use strict';
  var SK = window.SK || { t: function (k) { return k; }, lang: function () { return 'en'; }, reduce: false };
  var reduce = SK.reduce;
  var root = document.documentElement;

  /* =====================================================
     Background: a drifting "embedding space".
     Points float and link to close neighbours. The pointer
     acts as a query vector and lights up its k nearest points
     — the same idea as vector search.
     ===================================================== */
  (function bg() {
    var cv = document.getElementById('bg');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, pts = [], colA = '#a78bfa', colB = '#5eead4', colC = '#f0abfc';
    var mouse = { x: -9999, y: -9999, on: false };
    var K = 5, LINK = 140;

    function css(n, fallback) {
      var v = getComputedStyle(root).getPropertyValue(n).trim();
      return v || fallback;
    }
    function readColors() { colA = css('--a', colA); colB = css('--b', colB); colC = css('--c', colC); }

    function seed(n) {
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
          r: Math.random() * 1.6 + 1.1, c: i % 3
        });
      }
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(28, Math.min(95, Math.round(W * H / 15000)));
      if (pts.length !== n) seed(n);
      if (reduce) draw();
    }

    function step() {
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (mouse.on) {
          var dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 22000 && d2 > 1) { var f = .00002 * (22000 - d2) / 220; p.vx += dx * f * .02; p.vy += dy * f * .02; }
        }
        p.vx *= .995; p.vy *= .995;
        var sp = Math.abs(p.vx) + Math.abs(p.vy);
        if (sp < .08) { p.vx += (Math.random() - .5) * .02; p.vy += (Math.random() - .5) * .02; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b, dx, dy, d;
      ctx.lineWidth = 1;
      ctx.strokeStyle = colA;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          b = pts[j]; dx = a.x - b.x; dy = a.y - b.y;
          if (dx > LINK || dx < -LINK || dy > LINK || dy < -LINK) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.globalAlpha = (1 - d / LINK) * .28;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        ctx.fillStyle = a.c === 0 ? colA : a.c === 1 ? colB : colC;
        ctx.globalAlpha = .75;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* the pointer as a query: connect to its k nearest points */
      if (mouse.on) {
        var near = pts.map(function (p) { var ex = p.x - mouse.x, ey = p.y - mouse.y; return { p: p, d: ex * ex + ey * ey }; })
          .sort(function (m, n) { return m.d - n.d; }).slice(0, K);
        ctx.lineWidth = 1.3;
        for (i = 0; i < near.length; i++) {
          var q = near[i].p, fade = 1 - i / (K + 1);
          ctx.globalAlpha = .55 * fade;
          ctx.strokeStyle = colB;
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          ctx.globalAlpha = .9 * fade;
          ctx.fillStyle = colB;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r + 2.2, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = .9;
        ctx.strokeStyle = colB; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 6, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    var raf = 0;
    function loop() { step(); draw(); raf = requestAnimationFrame(loop); }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.on = false; });
    document.addEventListener('themechange', function () { readColors(); if (reduce) draw(); });
    document.addEventListener('visibilitychange', function () {
      if (reduce) return;
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { raf = requestAnimationFrame(loop); }
    });

    readColors();
    resize();
    if (!reduce) raf = requestAnimationFrame(loop);
  })();

  /* =====================================================
     Typing roles in the hero
     ===================================================== */
  (function typer() {
    var el = document.getElementById('typed');
    if (!el) return;
    var i = 0, j = 0, del = false, timer = 0;

    function roles() { var r = SK.t('hero.roles'); return Array.isArray(r) && r.length ? r : ['']; }

    function tick() {
      var list = roles();
      var word = list[i % list.length];
      if (reduce) { el.textContent = word; timer = setTimeout(function () { i++; tick(); }, 2600); return; }
      if (!del) {
        j++; el.textContent = word.slice(0, j);
        if (j >= word.length) { del = true; timer = setTimeout(tick, 1700); return; }
        timer = setTimeout(tick, 70);
      } else {
        j--; el.textContent = word.slice(0, j);
        if (j <= 0) { del = false; i++; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, 35);
      }
    }
    function restart() { clearTimeout(timer); i = 0; j = 0; del = false; el.textContent = ''; tick(); }
    document.addEventListener('langchange', restart);
    /* common.js already fired langchange once before this script ran */
    restart();
  })();

  /* =====================================================
     Tilt + spotlight on cards
     ===================================================== */
  (function tilt() {
    var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    document.querySelectorAll('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    if (!fine || reduce) return;
    document.querySelectorAll('.tilt').forEach(function (el) {
      var base = '';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        el.style.transition = 'transform .08s linear';
        el.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateZ(0)' + base;
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1)';
        el.style.transform = '';
      });
    });
  })();

  /* =====================================================
     "Profile README" card art: a contribution grid with a
     little snake crawling over it.
     ===================================================== */
  (function snake() {
    var g = document.querySelector('.p-cells');
    if (!g) return;
    var NS = 'http://www.w3.org/2000/svg';
    var COLS = 20, ROWS = 7, S = 9, GAP = 2, ox = 0, oy = (110 - (ROWS * (S + GAP) - GAP)) / 2;
    var cells = [], seed = 7;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    var i, c, r, rect;
    for (c = 0; c < COLS; c++) {
      for (r = 0; r < ROWS; r++) {
        rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', ox + c * (S + GAP));
        rect.setAttribute('y', oy + r * (S + GAP));
        rect.setAttribute('width', S); rect.setAttribute('height', S);
        var lvl = rnd(); lvl = lvl < .5 ? 0 : lvl < .75 ? .25 : lvl < .9 ? .5 : .8;
        rect.setAttribute('fill', 'var(--a)');
        rect.setAttribute('fill-opacity', String(.09 + lvl * .5));
        g.appendChild(rect);
        cells.push(rect);
      }
    }
    /* snake path: down a column, up the next, and so on */
    var path = [];
    for (c = 0; c < COLS; c++) {
      for (i = 0; i < ROWS; i++) path.push(c * ROWS + (c % 2 === 0 ? i : ROWS - 1 - i));
    }
    var LEN = 6, head = 0, timer = 0, visible = false, active = [];
    function paint() {
      active.forEach(function (idx) { cells[idx].setAttribute('fill', 'var(--a)'); cells[idx].setAttribute('fill-opacity', cells[idx].dataset.o); });
      active = [];
      for (var k = 0; k < LEN; k++) {
        var idx = path[(head - k + path.length) % path.length], cell = cells[idx];
        if (!cell.dataset.o) cell.dataset.o = cell.getAttribute('fill-opacity');
        cell.setAttribute('fill', 'var(--b)');
        cell.setAttribute('fill-opacity', String(1 - k * .14));
        active.push(idx);
      }
    }
    cells.forEach(function (cell) { cell.dataset.o = cell.getAttribute('fill-opacity'); });
    function tick() { head = (head + 1) % path.length; paint(); }
    paint();
    if (reduce || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      clearInterval(timer);
      if (visible) timer = setInterval(tick, 120);
    }).observe(g.closest('.project'));
  })();
})();
