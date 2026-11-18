/* Interpolation methods. Pure functions, no DOM — usable in the browser and in Node.
 * Every builder takes an array of {x, y} points and returns f(x).
 * Outside [xmin, xmax] the returned function yields NaN (interpolation only). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Interp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function sorted(points) {
    return points.map(function (p) { return { x: p.x, y: p.y }; }).sort(function (a, b) { return a.x - b.x; });
  }

  function inRange(p, x) {
    return p.length > 0 && x >= p[0].x - 1e-12 && x <= p[p.length - 1].x + 1e-12;
  }

  /** Piecewise-linear interpolation. */
  function linear(points) {
    var p = sorted(points), n = p.length;
    return function (x) {
      if (!inRange(p, x)) return NaN;
      if (n === 1) return p[0].y;
      var i = 1;
      while (i < n - 1 && x > p[i].x) i++;
      var a = p[i - 1], b = p[i];
      return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    };
  }

  /** Lagrange form of the interpolating polynomial. */
  function lagrange(points) {
    var p = sorted(points), n = p.length;
    return function (x) {
      if (!inRange(p, x)) return NaN;
      var sum = 0;
      for (var i = 0; i < n; i++) {
        var term = p[i].y;
        for (var j = 0; j < n; j++) {
          if (i !== j) term *= (x - p[j].x) / (p[i].x - p[j].x);
        }
        sum += term;
      }
      return sum;
    };
  }

  /** Newton form with divided differences. Same polynomial as Lagrange, different arithmetic. */
  function newton(points) {
    var p = sorted(points), n = p.length;
    var c = p.map(function (q) { return q.y; });
    for (var j = 1; j < n; j++) {
      for (var i = n - 1; i >= j; i--) {
        c[i] = (c[i] - c[i - 1]) / (p[i].x - p[i - j].x);
      }
    }
    return function (x) {
      if (!inRange(p, x)) return NaN;
      var r = c[n - 1];
      for (var k = n - 2; k >= 0; k--) r = r * (x - p[k].x) + c[k];
      return r;
    };
  }

  /** Natural cubic spline (second derivative zero at both ends). */
  function spline(points) {
    var p = sorted(points), n = p.length;
    if (n < 3) return linear(points);
    var h = [], i;
    for (i = 0; i < n - 1; i++) h.push(p[i + 1].x - p[i].x);

    /* Solve the tridiagonal system for second derivatives M (Thomas algorithm). */
    var M = new Array(n).fill(0);
    var sub = new Array(n).fill(0), diag = new Array(n).fill(1), sup = new Array(n).fill(0), rhs = new Array(n).fill(0);
    for (i = 1; i < n - 1; i++) {
      sub[i] = h[i - 1];
      diag[i] = 2 * (h[i - 1] + h[i]);
      sup[i] = h[i];
      rhs[i] = 6 * ((p[i + 1].y - p[i].y) / h[i] - (p[i].y - p[i - 1].y) / h[i - 1]);
    }
    for (i = 1; i < n; i++) {
      var w = sub[i] / diag[i - 1];
      diag[i] -= w * sup[i - 1];
      rhs[i] -= w * rhs[i - 1];
    }
    M[n - 1] = rhs[n - 1] / diag[n - 1];
    for (i = n - 2; i >= 0; i--) M[i] = (rhs[i] - sup[i] * M[i + 1]) / diag[i];

    return function (x) {
      if (!inRange(p, x)) return NaN;
      var k = 0;
      while (k < n - 2 && x > p[k + 1].x) k++;
      var hk = h[k], a = p[k + 1].x - x, b = x - p[k].x;
      return M[k] * a * a * a / (6 * hk) + M[k + 1] * b * b * b / (6 * hk) +
        (p[k].y / hk - M[k] * hk / 6) * a + (p[k + 1].y / hk - M[k + 1] * hk / 6) * b;
    };
  }

  return { linear: linear, lagrange: lagrange, newton: newton, spline: spline };
});
