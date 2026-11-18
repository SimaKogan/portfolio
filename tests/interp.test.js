/* Run with: node tests/interp.test.js  (no dependencies) */
'use strict';
const assert = require('node:assert/strict');
const I = require('../js/interp.js');

const close = (a, b, eps = 1e-9, msg = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${msg} expected ${b}, got ${a}`);

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok  ' + name); }

const pts = [-4, -2.5, -1, 0.5, 2, 3.5, 5].map((x) => ({ x, y: Math.sin(x) * 2 }));

test('every method passes through the given nodes', () => {
  for (const name of ['linear', 'lagrange', 'newton', 'spline']) {
    const f = I[name](pts);
    pts.forEach((p) => close(f(p.x), p.y, 1e-8, name + ' @ ' + p.x));
  }
});

test('Lagrange and Newton give the same polynomial', () => {
  const L = I.lagrange(pts), N = I.newton(pts);
  for (let x = -4; x <= 5; x += 0.37) close(L(x), N(x), 1e-8, 'x=' + x);
});

test('polynomial methods reproduce a polynomial of lower degree exactly', () => {
  const g = (x) => 0.5 * x * x * x - x + 2;
  const p = [-3, -1, 0, 2, 4].map((x) => ({ x, y: g(x) }));
  const L = I.lagrange(p), N = I.newton(p);
  for (let x = -3; x <= 4; x += 0.5) { close(L(x), g(x), 1e-8); close(N(x), g(x), 1e-8); }
});

test('linear interpolates the midpoint of a segment', () => {
  const f = I.linear([{ x: 0, y: 0 }, { x: 2, y: 10 }]);
  close(f(1), 5);
  close(f(0.5), 2.5);
});

test('methods are order-independent (points may arrive unsorted)', () => {
  const shuffled = [pts[3], pts[0], pts[6], pts[1], pts[5], pts[2], pts[4]];
  const a = I.spline(pts), b = I.spline(shuffled);
  for (let x = -4; x <= 5; x += 0.5) close(a(x), b(x), 1e-12);
});

test('natural spline reproduces collinear data exactly', () => {
  const line = [0, 1, 2.5, 4, 7].map((x) => ({ x, y: 3 * x - 1 }));
  const f = I.spline(line);
  for (let x = 0; x <= 7; x += 0.3) close(f(x), 3 * x - 1, 1e-9);
});

test('spline with fewer than 3 points falls back to linear', () => {
  const f = I.spline([{ x: 0, y: 0 }, { x: 4, y: 8 }]);
  close(f(1), 2);
});

test('spline is C1-continuous across interior nodes', () => {
  const f = I.spline(pts), e = 1e-5;
  for (let i = 1; i < pts.length - 1; i++) {
    const x = pts[i].x;
    const left = (f(x) - f(x - e)) / e, right = (f(x + e) - f(x)) / e;
    close(left, right, 1e-3, 'node ' + x);
  }
});

test('all methods return NaN outside the data range', () => {
  for (const name of ['linear', 'lagrange', 'newton', 'spline']) {
    const f = I[name](pts);
    assert.ok(Number.isNaN(f(-4.5)), name + ' left');
    assert.ok(Number.isNaN(f(5.5)), name + ' right');
  }
});

test('single point: constant; empty: NaN', () => {
  close(I.linear([{ x: 1, y: 7 }])(1), 7);
  assert.ok(Number.isNaN(I.linear([])(0)));
});

test("Runge's phenomenon: polynomial is much worse than the spline near the edge", () => {
  const f = (x) => 2.5 / (1 + x * x);
  const nodes = Array.from({ length: 11 }, (_, i) => { const x = -5 + i; return { x, y: f(x) }; });
  const P = I.lagrange(nodes), S = I.spline(nodes);
  const x = 4.5;
  const errP = Math.abs(P(x) - f(x)), errS = Math.abs(S(x) - f(x));
  assert.ok(errP > 5 * errS, `poly err ${errP.toFixed(3)} vs spline err ${errS.toFixed(3)}`);
});

console.log(`\n${passed} tests passed`);
