/* =============================================================================
   tests.js — the acceptance tests from the brief, verified independently.
   Runs in the browser (tests.html) and in Node (`node run-tests.js`).
   Expects WeldGrid to exist as a global.
   ============================================================================= */

(function (root, factory) {
  var api = factory(root.WeldGrid);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WeldTests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  function run() {
    var results = [];

    function ok(name, pass, detail) {
      results.push({ name: name, pass: !!pass, detail: detail || '' });
    }
    function near(a, b, tol) { return Math.abs(a - b) <= tol; }

    // Shorthand: best setup on a square 50 mm grid within `max` holes each way.
    function best(target, max, gridId, mx, my) {
      return W.solve({
        targetDeg: target,
        gridId: gridId || 'square50',
        maxX: mx != null ? mx : max,
        maxY: my != null ? my : max,
        partLengthMm: 600
      }).best;
    }

    /* ---------------------------------------------------------------- */
    /* 1. Best setup within 20 holes, square 50 mm grid                   */
    /* ---------------------------------------------------------------- */
    var table = [
      [10, 17, 3, 10.008, 0.008],
      [20, 11, 4, 19.983, 0.017],
      [30, 19, 11, 30.069, 0.069],
      [40, 19, 16, 40.101, 0.101],
      [50, 16, 19, 49.899, 0.101],
      [60, 11, 19, 59.931, 0.069],
      [70, 4, 11, 70.017, 0.017],
      [80, 3, 17, 79.992, 0.008]
    ];
    table.forEach(function (row) {
      var t = row[0], er = row[1], ri = row[2], ang = row[3], err = row[4];
      var b = best(t, 20);
      ok('best(' + t + '°, ≤20 holes) = ' + er + ' run / ' + ri + ' rise',
        b && b.run === er && b.rise === ri,
        b ? b.run + ' / ' + b.rise : 'no result');
      ok('  true angle ' + ang + '°',
        b && near(b.trueAngle, ang, 0.001), b ? b.trueAngle.toFixed(4) + '°' : '-');
      ok('  error ' + err + '°',
        b && near(b.absError, err, 0.001), b ? b.absError.toFixed(4) + '°' : '-');
    });

    /* Complement symmetry: 10/80, 20/70, 30/60, 40/50 are the same pair with
       run and rise swapped. Sanity check on the whole algorithm.            */
    var symOk = true, symDetail = '';
    for (var t = 1; t <= 89; t++) {
      var a = best(t, 20), b2 = best(90 - t, 20);
      if (!a || !b2 || a.run !== b2.rise || a.rise !== b2.run) {
        symOk = false;
        symDetail = 'fails at ' + t + '°: ' + (a ? a.run + '/' + a.rise : '-') +
          ' vs ' + (b2 ? b2.run + '/' + b2.rise : '-');
        break;
      }
    }
    ok('complement symmetry holds for every target 1–89°', symOk, symDetail);

    /* ---------------------------------------------------------------- */
    /* 2. Other required results                                          */
    /* ---------------------------------------------------------------- */
    var b12 = best(12.345, 40);
    ok('target 12.345°, ≤40 holes → 32 run / 7 rise',
      b12 && b12.run === 32 && b12.rise === 7,
      b12 ? b12.run + ' / ' + b12.rise : 'none');
    ok('  true 12.339°, error 0.006°',
      b12 && near(b12.trueAngle, 12.339, 0.001) && near(b12.absError, 0.006, 0.001),
      b12 ? b12.trueAngle.toFixed(4) + '° err ' + b12.absError.toFixed(4) + '°' : '-');

    var b3745 = best(36.87, 20);
    ok('target 36.87° → 4 run / 3 rise',
      b3745 && b3745.run === 4 && b3745.rise === 3,
      b3745 ? b3745.run + ' / ' + b3745.rise : 'none');
    ok('  isExactDiagonal true, diagonal 250 mm (3-4-5)',
      b3745 && b3745.isExactDiagonal === true && near(b3745.diagonalMm, 250, 1e-9),
      b3745 ? b3745.isExactDiagonal + ', ' + b3745.diagonalMm.toFixed(1) + ' mm' : '-');

    var b2656 = best(26.565, 20);
    ok('target 26.565° → 2 run / 1 rise, exact to 4 dp',
      b2656 && b2656.run === 2 && b2656.rise === 1 && b2656.absError < 1e-4,
      b2656 ? b2656.run + '/' + b2656.rise + ' err ' + b2656.absError.toExponential(2) + '°' : '-');

    /* ---------------------------------------------------------------- */
    /* 3. Diagonal grid constraint                                        */
    /* ---------------------------------------------------------------- */
    var parityOk = true, parityDetail = '', checked = 0;
    for (var d = 1; d <= 89; d++) {
      var r = W.solve({ targetDeg: d, gridId: 'diagonal100', maxX: 40, maxY: 20, partLengthMm: 600 });
      for (var i = 0; i < r.all.length; i++) {
        checked++;
        if ((r.all[i].run + r.all[i].rise) % 2 !== 0) {
          parityOk = false;
          parityDetail = d + '° returned ' + r.all[i].run + '/' + r.all[i].rise;
          break;
        }
      }
      if (!parityOk) break;
    }
    ok('diagonal100: every returned pair has (run + rise) even (' + checked + ' pairs checked)',
      parityOk, parityDetail);

    var d47 = W.solve({
      targetDeg: 47, gridId: 'diagonal100',
      maxX: Math.floor(2000 / 50), maxY: Math.floor(1000 / 50), partLengthMm: 600
    }).best;
    ok('diagonal100 2000×1000, target 47° → best error ≈ 1.01°',
      d47 && near(d47.absError, 1.01, 0.01),
      d47 ? d47.run + '/' + d47.rise + ' = ' + d47.trueAngle.toFixed(4) + '°, err ' +
        d47.absError.toFixed(4) + '°' : 'none');

    /* Turning the table 90° is a different setup (the angle is measured off the
       other edge), so it is reported separately, never folded into `best`.   */
    var d47full = W.solve({
      targetDeg: 47, gridId: 'diagonal100', maxX: 40, maxY: 20, partLengthMm: 600
    });
    ok('  turned 90° it does better (20/22) and is reported separately',
      d47full.bestRotated && d47full.bestRotated.run === 20 && d47full.bestRotated.rise === 22 &&
      d47full.bestRotated.absError < d47full.best.absError,
      d47full.bestRotated ? d47full.bestRotated.run + '/' + d47full.bestRotated.rise + ' err ' +
        d47full.bestRotated.absError.toFixed(4) + '°' : 'none');

    /* The same target on a square 50 grid must do far better — proof that the
       diagonal constraint is what is costing the accuracy, not a bad search. */
    var s47 = best(47, 0, 'square50', 40, 20);
    ok('  (square50 same table reaches ' + (s47 ? s47.absError.toFixed(3) : '?') +
      '° — diagonal really is the constraint)',
      s47 && s47.absError < 0.1, s47 ? s47.run + '/' + s47.rise : '-');

    /* 10/9 is illegal on a diagonal grid but 20/18 is legal: the "drop pairs
       with gcd > 1" shortcut must not apply here.                          */
    ok('diagonal100: 20/18 is primary even though gcd = 2 (10/9 is impossible)',
      W.evaluate('diagonal100', 20, 18, 47, 600).isPrimary === true &&
      W.gridAllows(W.GRIDS.diagonal100, 10, 9) === false);

    /* ---------------------------------------------------------------- */
    /* 4. Error conversion                                                */
    /* ---------------------------------------------------------------- */
    [[0.017, 0.178], [0.069, 0.723], [0.256, 2.681]].forEach(function (p) {
      var mm = W.deviationMm(p[0], 600);
      ok(p[0] + '° over 600 mm → ' + p[1] + ' mm', near(mm, p[1], 0.001), mm.toFixed(4) + ' mm');
    });

    /* ---------------------------------------------------------------- */
    /* 5. Ladder (worked example from the brief, target 30°, D16)         */
    /* ---------------------------------------------------------------- */
    var lad = W.solve({ targetDeg: 30, gridId: 'square50', maxX: 30, maxY: 30, partLengthMm: 600 }).ladder;
    var want = [[2, 1], [5, 3], [7, 4], [19, 11], [26, 15]];
    var ladderOk = want.every(function (p) {
      return lad.some(function (r) { return r.run === p[0] && r.rise === p[1]; });
    });
    ok('ladder for 30° contains 2/1, 5/3, 7/4, 19/11, 26/15 in order',
      ladderOk && isAscending(lad, want),
      lad.map(function (r) { return r.run + '/' + r.rise; }).join('  '));

    function isAscending(ladder, want) {
      var idx = want.map(function (p) {
        return ladder.findIndex(function (r) { return r.run === p[0] && r.rise === p[1]; });
      });
      for (var i = 1; i < idx.length; i++) if (idx[i] <= idx[i - 1]) return false;
      return true;
    }

    ok('ladder errors strictly improve as the setup gets longer',
      lad.every(function (r, i) { return i === 0 || r.absError < lad[i - 1].absError; }));

    /* ---------------------------------------------------------------- */
    /* 6. Grid bookkeeping                                                */
    /* ---------------------------------------------------------------- */
    var sp = W.holeSpans(1200, 800, 'square50', true);
    ok('1200×800 square50, full surface → 25 × 17 holes (span 24 × 16)',
      sp.holesX === 25 && sp.holesY === 17 && sp.maxX === 24 && sp.maxY === 16,
      sp.holesX + '×' + sp.holesY);

    var spm = W.holeSpans(1200, 800, 'square50', false);
    ok('  with one-hole edge margin → span 22 × 14',
      spm.maxX === 22 && spm.maxY === 14, spm.maxX + ' × ' + spm.maxY);

    var spd = W.holeSpans(4000, 2000, 'diagonal100', true);
    ok('4000×2000 diagonal100, full surface → span 80 × 40 units of 50 mm',
      spd.maxX === 80 && spd.maxY === 40 && spd.unitMm === 50,
      spd.maxX + ' × ' + spd.maxY);

    var pyth = W.evaluate('square50', 12, 5, 22.6, 600);
    ok('12/5 flagged as an exact diagonal (13 units = 650 mm)',
      pyth.isExactDiagonal === true && near(pyth.diagonalMm, 650, 1e-9),
      pyth.diagonalMm.toFixed(1) + ' mm');

    var notPyth = W.evaluate('square50', 11, 4, 20, 600);
    ok('11/4 is not an exact diagonal', notPyth.isExactDiagonal === false,
      notPyth.diagonalMm.toFixed(2) + ' mm');

    ok('error sign is signed: 11/4 at 20° reads slightly shallow',
      notPyth.errorDeg < 0, notPyth.errorDeg.toFixed(4) + '°');

    var passed = results.filter(function (r) { return r.pass; }).length;
    return { results: results, passed: passed, failed: results.length - passed };
  }

  return { run: run };
});
