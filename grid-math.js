/* =============================================================================
   grid-math.js — the whole geometry of a modular welding table, and nothing else.

   No DOM, no storage, no I/O. Loads as a classic <script> (works from file://
   as well as http://) and also via require() in Node so the tests can run
   headless. Everything the UI knows about grids comes from here; when circle
   mode gets built it should reuse this module untouched.

   ---------------------------------------------------------------------------
   THE IDEA
   ---------------------------------------------------------------------------
   You can only pin where there is a hole, so every straight edge you set up on
   the table runs between two grid points. The only angles the table can hold
   are therefore atan(rise / run) for whole numbers of holes. This module
   enumerates those and reports how far each one lands from what you wanted.

   ---------------------------------------------------------------------------
   UNITS
   ---------------------------------------------------------------------------
   `run` and `rise` are counted in GRID UNITS, not millimetres. A unit is the
   smallest step between holes along an axis:

     square50     unit = 50 mm   (pitch 50 mm)
     square100    unit = 100 mm  (pitch 100 mm)
     diagonal100  unit = 50 mm   (pitch 100 mm — see below)

   ---------------------------------------------------------------------------
   THE DIAGONAL GRID (the one that bites)
   ---------------------------------------------------------------------------
   A Siegmund-style "diagonal" table is a 100 mm grid PLUS a second 100 mm grid
   offset by 50 mm in both x and y. Counted in 50 mm units, a hole exists at
   (x, y) only where x and y are BOTH EVEN or BOTH ODD — never one of each.

   The vector between any two holes therefore always has (run + rise) even, so:

       on a diagonal grid a setup is possible only if run and rise are both odd
       or both even, measured in 50 mm units.

   1 across / 2 up does not exist on these tables. This rule removes a lot of
   useful ratios and noticeably degrades accuracy near 45°; it is never ignored.

   Note the knock-on effect on reduced fractions: 10/9 is impossible (sum odd)
   but 20/18 — the same angle, twice the reach — is fine. So "skip pairs where
   gcd > 1" is wrong on this grid; the rule is "skip a pair if a SHORTER pair at
   the same angle is also legal on this grid" (see minValidMultiple).
   ============================================================================= */

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WeldGrid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEG = 180 / Math.PI;
  var RAD = Math.PI / 180;

  /* --------------------------------------------------------------------- */
  /* Hardware                                                              */
  /* --------------------------------------------------------------------- */

  var GRIDS = {
    square50: {
      id: 'square50',
      label: '50 mm square',
      sub: 'D16 · 16 mm holes',
      holeMm: 16,
      unitMm: 50,
      pitchMm: 50,
      diagonal: false,
      blurb: '16 mm holes on a 50 mm square grid. Every whole-hole step is available.'
    },
    square100: {
      id: 'square100',
      label: '100 mm square',
      sub: 'D28 / D22 basic',
      holeMm: 28,
      unitMm: 100,
      pitchMm: 100,
      diagonal: false,
      blurb: '28 mm (or 22 mm) holes on a plain 100 mm grid. Every step is available, but each one is twice as long.'
    },
    diagonal100: {
      id: 'diagonal100',
      label: '100 mm diagonal',
      sub: 'D28 / D22 standard',
      holeMm: 28,
      unitMm: 50,
      pitchMm: 100,
      diagonal: true,
      blurb: '100 mm grid plus a second 100 mm grid offset by 50 mm. Counted in 50 mm units, run and rise must both be odd or both be even.'
    }
  };

  // Standard table sizes. 4000 x 2000 is the largest made; custom can go above.
  var TABLES = [
    { id: '1200x800',   label: '1200 × 800',   widthMm: 1200, lengthMm: 800,  grid: 'square50' },
    { id: '1200x1200',  label: '1200 × 1200',  widthMm: 1200, lengthMm: 1200, grid: 'square50' },
    { id: '1500x1000',  label: '1500 × 1000',  widthMm: 1500, lengthMm: 1000, grid: 'square50' },
    { id: '2000x1000',  label: '2000 × 1000',  widthMm: 2000, lengthMm: 1000, grid: 'square50' },
    { id: '2400x1200',  label: '2400 × 1200',  widthMm: 2400, lengthMm: 1200, grid: 'square50' },
    { id: '3000x1500',  label: '3000 × 1500',  widthMm: 3000, lengthMm: 1500, grid: 'diagonal100' },
    { id: '4000x2000',  label: '4000 × 2000',  widthMm: 4000, lengthMm: 2000, grid: 'diagonal100' }
  ];

  /* --------------------------------------------------------------------- */
  /* Small helpers                                                         */
  /* --------------------------------------------------------------------- */

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = b; b = a % b; a = t; }
    return a;
  }

  /** Does this grid physically have a hole at (run, rise) units from another hole? */
  function gridAllows(grid, run, rise) {
    if (!grid.diagonal) return true;
    return (run + rise) % 2 === 0;
  }

  /**
   * Smallest whole multiple k of the reduced ratio (r, s) that this grid can
   * actually hold. On a square grid that is always 1. On a diagonal grid a
   * ratio with an odd sum (e.g. 10/9) only becomes legal when doubled (20/18).
   */
  function minValidMultiple(grid, r, s) {
    if (!grid.diagonal) return 1;
    return (r + s) % 2 === 0 ? 1 : 2;
  }

  /**
   * Holes available along each axis.
   * Count in one direction is floor(dimension / unit) + 1; the usable SPAN is
   * one less than that. `useFullSurface` false (the default) drops one hole at
   * each edge so clamps have room to sit.
   */
  function holeSpans(widthMm, lengthMm, gridId, useFullSurface) {
    var grid = GRIDS[gridId];
    var u = grid.unitMm;
    var holesX = Math.floor(widthMm / u) + 1;
    var holesY = Math.floor(lengthMm / u) + 1;
    if (!useFullSurface) { holesX -= 2; holesY -= 2; }
    holesX = Math.max(holesX, 1);
    holesY = Math.max(holesY, 1);
    return {
      unitMm: u,
      holesX: holesX,
      holesY: holesY,
      maxX: holesX - 1,   // longest run in units
      maxY: holesY - 1    // longest rise in units
    };
  }

  /** Angular error (deg) converted to how far out the far end of a part lands. */
  function deviationMm(errorDeg, partLengthMm) {
    return partLengthMm * Math.tan(Math.abs(errorDeg) * RAD);
  }

  /* --------------------------------------------------------------------- */
  /* One candidate setup                                                   */
  /* --------------------------------------------------------------------- */

  /**
   * Describe the setup "pin a hole, count `run` units across and `rise` up,
   * pin that hole". Pure — knows nothing about the table it sits on.
   */
  function evaluate(gridId, run, rise, targetDeg, partLengthMm) {
    var grid = GRIDS[gridId];
    var g = gcd(run, rise);
    var r = run / g, s = rise / g;
    var k = minValidMultiple(grid, r, s);

    var trueAngle = Math.atan2(rise, run) * DEG;
    var errorDeg = trueAngle - targetDeg;          // signed: + means too steep
    var diagUnits = Math.sqrt(run * run + rise * rise);
    var diagRounded = Math.round(diagUnits);

    return {
      gridId: gridId,
      unitMm: grid.unitMm,
      run: run,
      rise: rise,
      span: Math.max(run, rise),                   // "how many holes long is this"
      trueAngle: trueAngle,
      errorDeg: errorDeg,
      absError: Math.abs(errorDeg),
      runMm: run * grid.unitMm,
      riseMm: rise * grid.unitMm,
      diagonalUnits: diagUnits,
      diagonalMm: diagUnits * grid.unitMm,
      // Both ends land on holes AND the diagonal is a whole number of units —
      // a Pythagorean triple, so a stop bar cut to that length seats perfectly.
      isExactDiagonal: Math.abs(diagUnits - diagRounded) < 1e-9,
      deviationMm: deviationMm(errorDeg, partLengthMm),
      partLengthMm: partLengthMm,
      reducedRun: r,
      reducedRise: s,
      multiple: g,
      // The shortest legal pair at this angle on this grid. Anything longer is
      // the same angle with more reach.
      isPrimary: g === k,
      shortestAtAngle: { run: r * k, rise: s * k }
    };
  }

  /* --------------------------------------------------------------------- */
  /* The solver                                                            */
  /* --------------------------------------------------------------------- */

  /**
   * Brute-force every (run, rise) that fits the table. Largest real case is
   * 80 × 40 = 3200 pairs, which is instant and trivial to verify by eye —
   * continued fractions would be faster and much harder to trust.
   *
   * opts: { targetDeg, gridId, maxX, maxY, partLengthMm }
   *   maxX / maxY are spans in grid units (see holeSpans).
   *
   * A pair can be laid out two ways: `run` along the table's X side (the frame
   * the user asked in), or with the table turned 90° so `run` goes along the Y
   * side. Those are different setups on the shop floor — you measure the angle
   * off a different edge — so `best`/`ladder` only ever contain the as-asked
   * orientation, and the turned-90° option is reported separately as
   * `bestRotated`. On a square table the two sets are identical.
   *
   * Returns { best, bestRotated, ladder, sameAngle, all, achievableCount, ... }
   *   best        — smallest error with run along X, ties broken by shortest setup
   *   bestRotated — smallest error that needs the table turned 90°, or null
   *   ladder      — the Pareto front: walking out from the shortest setup, every
   *                 option that beats everything shorter than it
   *   sameAngle   — longer setups at exactly the best angle (more reach, same result)
   */
  function solve(opts) {
    var targetDeg = opts.targetDeg;
    var gridId = opts.gridId;
    var grid = GRIDS[gridId];
    var maxX = opts.maxX;
    var maxY = opts.maxY;
    var partLengthMm = opts.partLengthMm != null ? opts.partLengthMm : 600;

    // A setup can lie along the table either way round, so a pair is usable if
    // it fits as-is OR with the table rotated (maxX and maxY swapped).
    var lim = Math.max(maxX, maxY);
    var all = [];

    for (var run = 1; run <= lim; run++) {
      for (var rise = 1; rise <= lim; rise++) {
        var alongX = run <= maxX && rise <= maxY;   // run down the long side
        var alongY = run <= maxY && rise <= maxX;   // table turned 90°
        if (!alongX && !alongY) continue;
        if (!gridAllows(grid, run, rise)) continue;

        var res = evaluate(gridId, run, rise, targetDeg, partLengthMm);
        res.alongX = alongX;
        res.alongY = alongY;
        res.needsRotation = !alongX;
        all.push(res);
      }
    }

    // Primary = shortest legal pair at its angle (see minValidMultiple).
    // Split by orientation: the answer in the frame the user asked in, and the
    // answer if they turn the work 90° and measure off the other edge.
    var primary = all.filter(function (r) { return r.isPrimary && r.alongX; });
    var primaryRotated = all.filter(function (r) { return r.isPrimary && !r.alongX; });

    function byError(a, b) {
      return (a.absError - b.absError) || (a.span - b.span);
    }
    var best = primary.slice().sort(byError)[0] || null;
    var bestRotated = primaryRotated.slice().sort(byError)[0] || null;
    // Only worth mentioning if turning the table actually buys accuracy.
    if (best && bestRotated && bestRotated.absError >= best.absError) bestRotated = null;

    // Pareto ladder: shortest first, keep anything strictly more accurate than
    // everything shorter. Ties on span go to the more accurate pair.
    var byLength = primary.slice().sort(function (a, b) {
      return (a.span - b.span) || (a.absError - b.absError) || (a.run - b.run);
    });
    var ladder = [];
    var bestSoFar = Infinity;
    for (var i = 0; i < byLength.length; i++) {
      if (byLength[i].absError < bestSoFar - 1e-12) {
        bestSoFar = byLength[i].absError;
        ladder.push(byLength[i]);
      }
    }

    // Same angle, longer reach — useful when the short setup doesn't physically
    // reach past the workpiece.
    var sameAngle = [];
    if (best) {
      sameAngle = all.filter(function (r) {
        return !r.isPrimary
          && r.alongX
          && r.reducedRun === best.reducedRun
          && r.reducedRise === best.reducedRise;
      }).sort(function (a, b) { return a.span - b.span; });
    }

    return {
      targetDeg: targetDeg,
      grid: grid,
      maxX: maxX,
      maxY: maxY,
      partLengthMm: partLengthMm,
      best: best,
      bestRotated: bestRotated,
      ladder: ladder,
      sameAngle: sameAngle,
      all: all,
      achievableCount: primary.length
    };
  }

  /* --------------------------------------------------------------------- */
  /* Honesty helpers                                                       */
  /* --------------------------------------------------------------------- */

  /**
   * Worst error this table can be forced into, over all targets in 0–90°.
   *
   * Every achievable pair gives an EXACT angle, so the error for an arbitrary
   * target is the distance to the nearest achievable angle. The worst target
   * sits midway between two neighbours, so the answer is half the largest gap
   * in the sorted list of achievable angles. 0° and 90° are included because
   * two holes in the same row or column give them exactly.
   *
   * Returns { worstDeg, atDeg, betweenLo, betweenHi }.
   */
  function worstCaseError(gridId, maxX, maxY) {
    var res = solve({ targetDeg: 0, gridId: gridId, maxX: maxX, maxY: maxY });
    var angles = [0, 90];
    for (var i = 0; i < res.all.length; i++) angles.push(res.all[i].trueAngle);
    angles.sort(function (a, b) { return a - b; });

    var worst = 0, lo = 0, hi = 0;
    for (var j = 1; j < angles.length; j++) {
      var gap = angles[j] - angles[j - 1];
      if (gap / 2 > worst) { worst = gap / 2; lo = angles[j - 1]; hi = angles[j]; }
    }
    return { worstDeg: worst, atDeg: (lo + hi) / 2, betweenLo: lo, betweenHi: hi };
  }

  /**
   * Achievable angles nearest to a target, for "the table can't hold that, but
   * it holds these exactly" advice. Returns up to `count` distinct angles.
   */
  function nearestAchievable(result, count) {
    count = count || 3;
    var seen = {};
    return result.all
      .filter(function (r) { return r.isPrimary && r.alongX; })
      .slice()
      .sort(function (a, b) { return (a.absError - b.absError) || (a.span - b.span); })
      .filter(function (r) {
        var key = r.trueAngle.toFixed(6);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .slice(0, count);
  }

  /* --------------------------------------------------------------------- */

  return {
    GRIDS: GRIDS,
    TABLES: TABLES,
    DEG: DEG,
    RAD: RAD,
    gcd: gcd,
    gridAllows: gridAllows,
    minValidMultiple: minValidMultiple,
    holeSpans: holeSpans,
    deviationMm: deviationMm,
    evaluate: evaluate,
    solve: solve,
    worstCaseError: worstCaseError,
    nearestAchievable: nearestAchievable
  };
});
