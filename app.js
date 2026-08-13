/* =============================================================================
   app.js — UI only. All geometry lives in grid-math.js; this file reads inputs,
   renders, and remembers settings. No network calls, ever.
   ============================================================================= */

(function () {
  'use strict';

  var W = window.WeldGrid;
  var STORE_KEY = 'weld-angle-finder.v1';

  var el = function (id) { return document.getElementById(id); };

  var ui = {
    angle: el('angle'),
    table: el('table'),
    grid: el('grid'),
    part: el('part'),
    customBox: el('custom-size'),
    customW: el('custom-w'),
    customL: el('custom-l'),
    fullSurface: el('full-surface'),
    gridHint: el('grid-hint'),
    tableHint: el('table-hint'),
    answer: el('answer'),
    warnings: el('warnings'),
    diagram: el('diagram'),
    diagramCard: el('diagram-card'),
    diagramLegend: el('diagram-legend'),
    ladder: el('ladder'),
    ladderCard: el('ladder-card'),
    sameCard: el('same-card'),
    sameAngle: el('same-angle'),
    sameNote: el('same-note'),
    flipX: el('flip-x'),
    flipY: el('flip-y')
  };

  var state = {
    angle: 20,
    tableId: '1200x800',
    customW: 1200,
    customL: 800,
    gridId: 'square50',
    part: 600,
    fullSurface: false,
    flipX: false,
    flipY: false
  };

  /* --------------------------------------------------------------------- */
  /* Persistence                                                           */
  /* --------------------------------------------------------------------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(state).forEach(function (k) {
        if (saved[k] !== undefined && saved[k] !== null) state[k] = saved[k];
      });
    } catch (e) { /* private mode, or corrupt — defaults are fine */ }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { }
  }

  /* --------------------------------------------------------------------- */
  /* Formatting                                                            */
  /* --------------------------------------------------------------------- */

  function fmtDeg(v, dp) { return v.toFixed(dp === undefined ? 3 : dp) + '°'; }
  function fmtMm(v) { return (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)) + ' mm'; }
  function fmtLen(v) { return Math.round(v) + ' mm'; }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --------------------------------------------------------------------- */
  /* Setup of the controls                                                 */
  /* --------------------------------------------------------------------- */

  function fillSelects() {
    var html = '';
    W.TABLES.forEach(function (t) {
      html += '<option value="' + t.id + '">' + esc(t.label) + ' mm</option>';
    });
    html += '<option value="custom">Custom size…</option>';
    ui.table.innerHTML = html;

    var g = '';
    Object.keys(W.GRIDS).forEach(function (k) {
      var grid = W.GRIDS[k];
      g += '<option value="' + k + '">' + esc(grid.label + '  ·  ' + grid.sub) + '</option>';
    });
    ui.grid.innerHTML = g;
  }

  function syncControls() {
    ui.angle.value = state.angle;
    ui.table.value = state.tableId;
    ui.grid.value = state.gridId;
    ui.part.value = state.part;
    ui.customW.value = state.customW;
    ui.customL.value = state.customL;
    ui.fullSurface.checked = state.fullSurface;
    ui.customBox.hidden = state.tableId !== 'custom';
    ui.flipX.setAttribute('aria-pressed', String(state.flipX));
    ui.flipY.setAttribute('aria-pressed', String(state.flipY));
  }

  function currentTable() {
    if (state.tableId === 'custom') {
      return { widthMm: state.customW, lengthMm: state.customL, label: state.customW + ' × ' + state.customL };
    }
    var t = W.TABLES.filter(function (x) { return x.id === state.tableId; })[0] || W.TABLES[0];
    return { widthMm: t.widthMm, lengthMm: t.lengthMm, label: t.label };
  }

  /* --------------------------------------------------------------------- */
  /* Rendering                                                             */
  /* --------------------------------------------------------------------- */

  function holeWord(grid, n) {
    return grid.diagonal ? (n + ' steps') : (n + ' holes');
  }

  function render() {
    var grid = W.GRIDS[state.gridId];
    var tbl = currentTable();
    var spans = W.holeSpans(tbl.widthMm, tbl.lengthMm, state.gridId, state.fullSurface);

    ui.gridHint.textContent = grid.blurb;

    var res = W.solve({
      targetDeg: state.angle,
      gridId: state.gridId,
      maxX: spans.maxX,
      maxY: spans.maxY,
      partLengthMm: state.part
    });

    var worst = W.worstCaseError(state.gridId, spans.maxX, spans.maxY);
    ui.tableHint.innerHTML =
      spans.holesX + ' × ' + spans.holesY + ' holes usable (' +
      fmtLen(spans.maxX * spans.unitMm) + ' × ' + fmtLen(spans.maxY * spans.unitMm) + ' of grid)' +
      (grid.diagonal ? ', counted in 50 mm steps' : '') + '. ' +
      'Worst angle this table can be asked for is ' + fmtDeg(worst.worstDeg, 2) +
      ' out (' + fmtMm(1000 * Math.tan(worst.worstDeg * W.RAD)) + ' over a metre), near ' +
      fmtDeg(worst.atDeg, 1) + '.';

    renderAnswer(res, grid, tbl);
    renderWarnings(res, grid, tbl, worst);
    renderDiagram(res, grid);
    renderLadder(res, grid);
    renderSameAngle(res, grid);
  }

  function renderAnswer(res, grid, tbl) {
    var b = res.best;
    if (!b) {
      ui.answer.innerHTML = '<div class="answer"><p class="kicker">No setup possible</p>' +
        '<p class="headline-error">This table is too small to hold any angle at this grid.</p></div>';
      return;
    }

    var dev = Math.abs(b.deviationMm);
    var sev = dev <= 1 ? '' : (dev <= 5 ? ' is-warn' : ' is-bad');
    var dir = b.errorDeg === 0 ? 'exactly on target'
      : (b.errorDeg > 0 ? fmtDeg(b.absError) + ' steeper than ' + fmtDeg(state.angle)
        : fmtDeg(b.absError) + ' shallower than ' + fmtDeg(state.angle));

    var badges = '';
    if (b.isExactDiagonal) {
      badges += '<span class="badge exact">Exact diagonal — a stop bar of ' +
        fmtLen(b.diagonalMm) + ' seats on both pins</span>';
    }
    if (b.absError <= 0.01) badges += '<span class="badge exact">Inside the noise floor</span>';
    badges += '<span class="badge">Run along the ' + fmtLen(tbl.widthMm) + ' side</span>';
    if (grid.diagonal) badges += '<span class="badge">Steps of 50 mm (half pitch)</span>';
    if (res.sameAngle.length) {
      badges += '<span class="badge">' + res.sameAngle.length + ' longer setups at this exact angle</span>';
    }

    var html = '<div class="answer">' +
      '<p class="kicker">Pin these two holes</p>' +
      '<div class="numbers">' +
      '<div class="num"><span class="n">' + b.run + '</span>' +
      '<span class="lbl">across</span><span class="mm">' + fmtLen(b.runMm) + '</span></div>' +
      '<div class="num"><span class="n">' + b.rise + '</span>' +
      '<span class="lbl">up</span><span class="mm">' + fmtLen(b.riseMm) + '</span></div>' +
      '</div>' +
      '<p class="headline-error' + sev + '"><span class="mmval">' + fmtMm(dev) + '</span> out at the end of a ' +
      fmtLen(state.part) + ' part</p>' +
      '<p class="secondary">True angle ' + fmtDeg(b.trueAngle) + ' — ' + dir +
      ' · pin-to-pin ' + fmtMm(b.diagonalMm) + '</p>' +
      '<div class="badges">' + badges + '</div>' +
      '</div>';

    // Turning the work 90° measures the angle off the other edge — a different
    // setup, so it gets its own card rather than quietly replacing the answer.
    var r = res.bestRotated;
    if (r && r.absError < b.absError - 1e-9) {
      html += '<div class="card"><div class="card-head"><h2>Or turn it 90°</h2></div>' +
        '<p style="margin:0 0 6px"><strong>' + r.run + ' across × ' + r.rise + ' up</strong>' +
        ' measured off the ' + fmtLen(tbl.lengthMm) + ' side — ' +
        fmtLen(r.runMm) + ' × ' + fmtLen(r.riseMm) + '.</p>' +
        '<p class="hint" style="margin:0">' + fmtDeg(r.trueAngle) + ', ' +
        fmtMm(Math.abs(r.deviationMm)) + ' out over ' + fmtLen(state.part) +
        ' — better than the setup above, but only if you can work off that edge.</p></div>';
    }

    ui.answer.innerHTML = html;
  }

  function renderWarnings(res, grid, tbl, worst) {
    var b = res.best;
    var out = '';

    if (b && b.absError > 0.5) {
      var near = W.nearestAchievable(res, 3).map(function (n) {
        return '<strong>' + fmtDeg(n.trueAngle) + '</strong> (' + n.run + ' × ' + n.rise + ')';
      }).join(', ');
      out += '<div class="warn bad"><strong>This table cannot hold ' + fmtDeg(state.angle, 3) + ' well.</strong> ' +
        'The best it can do is ' + fmtDeg(b.absError) + ' out — ' + fmtMm(Math.abs(b.deviationMm)) +
        ' at the end of a ' + fmtLen(state.part) + ' part. ' +
        'Angles it does hold exactly near here: ' + near + '. ' +
        'If the design can move to one of those, the setup is perfect rather than approximate.';
      if (grid.diagonal) {
        var sq = W.solve({
          targetDeg: state.angle, gridId: 'square50',
          maxX: Math.floor(tbl.widthMm / 50), maxY: Math.floor(tbl.lengthMm / 50),
          partLengthMm: state.part
        });
        if (sq.best && sq.best.absError < b.absError / 3) {
          out += ' <br>The diagonal grid is what is costing you here: a 50 mm square grid on the same' +
            ' table would reach ' + fmtDeg(sq.best.absError) + '.';
        }
      }
      out += '</div>';
    }

    if (state.angle <= 3 || state.angle >= 87) {
      out += '<div class="warn"><strong>Shallow and steep angles are the table\'s weak spot.</strong> ' +
        'Near 0° and 90° the available ratios thin out badly — this table\'s worst case is ' +
        fmtDeg(worst.worstDeg, 2) + ', about ' + fmtMm(1000 * Math.tan(worst.worstDeg * W.RAD)) +
        ' over a metre. 0° and 90° themselves are exact: pin any two holes in the same row or column.</div>';
    }

    ui.warnings.innerHTML = out;
  }

  /* --------------------------------------------------------------------- */
  /* The diagram                                                           */
  /* --------------------------------------------------------------------- */

  function renderDiagram(res, grid) {
    var b = res.best;
    if (!b) { ui.diagramCard.hidden = true; return; }
    ui.diagramCard.hidden = false;
    ui.diagram.innerHTML = buildSvg(b, grid, state.flipX, state.flipY);
    ui.diagramLegend.innerHTML = grid.diagonal
      ? 'Large dots are the 100 mm grid, small rings are the 50 mm offset holes. ' +
        'Ticks count 50 mm steps from START. (Start on an offset hole and the two swap over.)'
      : 'Ticks count holes from START. Flip to match the corner you are actually working from.';
  }

  /**
   * SVG dot grid of the region around the setup: the two holes, the line
   * between them, and counting ticks so the user can walk it with a finger.
   * Coordinates are grid units scaled by `step`; the viewBox does the zooming
   * so nothing here depends on screen size.
   */
  function buildSvg(b, grid, flipX, flipY) {
    var M = 2;                            // holes of margin around the setup
    var spanX = b.run + 2 * M;
    var spanY = b.rise + 2 * M;
    var step = 10;

    // Keep on-screen text and dots roughly constant however far we zoom out.
    var s = Math.max(spanX, spanY) * step / 170;
    var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
    var fs = clamp(5.4 * s, 4.8, 13);
    var dot = clamp(1.5 * s, 1.2, 2.3);
    var sw = clamp(1.0 * s, 0.85, 2.2);

    var padL = 8 + fs * 1.8, padB = 6 + fs * 1.9, padT = fs * 0.9, padR = fs * 0.9;
    var Wd = spanX * step + padL + padR;
    var Hd = spanY * step + padT + padB;

    var px = function (c) { return padL + c * step; };
    var py = function (r) { return padT + (spanY - r) * step; };

    var ox = flipX ? b.run + M : M;
    var tx = flipX ? M : b.run + M;
    var oy = flipY ? b.rise + M : M;
    var ty = flipY ? M : b.rise + M;

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      Wd.toFixed(1) + ' ' + Hd.toFixed(1) + '" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="Grid diagram: from the start hole, ' + b.run +
      ' across and ' + b.rise + ' up">');

    // --- holes -----------------------------------------------------------
    var parity = (ox + oy) % 2;
    for (var c = 0; c <= spanX; c++) {
      for (var r = 0; r <= spanY; r++) {
        if (grid.diagonal && (c + r) % 2 !== parity) continue;   // no hole here
        var onBase = !grid.diagonal ||
          (Math.abs(c - ox) % 2 === 0 && Math.abs(r - oy) % 2 === 0);
        if (onBase) {
          parts.push('<circle cx="' + px(c).toFixed(1) + '" cy="' + py(r).toFixed(1) +
            '" r="' + dot.toFixed(2) + '" fill="#5b6773"/>');
        } else {
          parts.push('<circle cx="' + px(c).toFixed(1) + '" cy="' + py(r).toFixed(1) +
            '" r="' + (dot * 0.85).toFixed(2) + '" fill="none" stroke="#414c58" stroke-width="' +
            (sw * 0.7).toFixed(2) + '"/>');
        }
      }
    }

    // --- across-then-up guide -------------------------------------------
    parts.push('<path d="M' + px(ox).toFixed(1) + ' ' + py(oy).toFixed(1) +
      ' L' + px(tx).toFixed(1) + ' ' + py(oy).toFixed(1) +
      ' L' + px(tx).toFixed(1) + ' ' + py(ty).toFixed(1) +
      '" fill="none" stroke="#6f7d8c" stroke-width="' + (sw * 0.8).toFixed(2) +
      '" stroke-dasharray="' + (sw * 2.5).toFixed(1) + ' ' + (sw * 2.5).toFixed(1) + '"/>');

    // --- the setup line --------------------------------------------------
    var line = 'x1="' + px(ox).toFixed(1) + '" y1="' + py(oy).toFixed(1) +
      '" x2="' + px(tx).toFixed(1) + '" y2="' + py(ty).toFixed(1) + '"';
    parts.push('<line ' + line + ' stroke="#ffb020" stroke-opacity="0.22" stroke-width="' +
      (sw * 5).toFixed(2) + '" stroke-linecap="round"/>');
    parts.push('<line ' + line + ' stroke="#ffb020" stroke-width="' +
      (sw * 1.7).toFixed(2) + '" stroke-linecap="round"/>');

    // --- the two pins ----------------------------------------------------
    parts.push('<circle cx="' + px(ox).toFixed(1) + '" cy="' + py(oy).toFixed(1) +
      '" r="' + (dot * 2.2).toFixed(2) + '" fill="#ffb020"/>');
    parts.push('<circle cx="' + px(tx).toFixed(1) + '" cy="' + py(ty).toFixed(1) +
      '" r="' + (dot * 2.2).toFixed(2) + '" fill="#0a0c0f" stroke="#ffb020" stroke-width="' +
      (sw * 1.4).toFixed(2) + '"/>');

    // Labels sit in the empty margin, away from the other pin.
    var lx = px(ox) + (tx > ox ? -1 : 1) * step * 1.15;
    var ly = py(oy) + (ty > oy ? 1 : -1) * step * 1.15;
    parts.push(pill('START', lx, ly, fs, '#ffb020', Wd, Hd));
    var rx = px(tx) + (tx > ox ? 1 : -1) * step * 1.15;
    var ry = py(ty) + (ty > oy ? -1 : 1) * step * 1.15;
    parts.push(pill(b.run + ', ' + b.rise, rx, ry, fs, '#ffb020', Wd, Hd));

    // --- counting ticks --------------------------------------------------
    var everyX = b.run <= 16 ? 1 : 5;
    var everyY = b.rise <= 16 ? 1 : 5;
    var cLo = Math.min(ox, tx), cHi = Math.max(ox, tx);
    for (var cc = cLo; cc <= cHi; cc++) {
      var n = Math.abs(cc - ox);
      var show = (n % everyX === 0) || n === b.run;
      parts.push('<line x1="' + px(cc).toFixed(1) + '" y1="' + (py(0) + fs * 0.4).toFixed(1) +
        '" x2="' + px(cc).toFixed(1) + '" y2="' + (py(0) + fs * (show ? 1.0 : 0.75)).toFixed(1) +
        '" stroke="#6f7d8c" stroke-width="' + (sw * 0.6).toFixed(2) + '"/>');
      if (show) {
        parts.push('<text x="' + px(cc).toFixed(1) + '" y="' + (py(0) + fs * 2.2).toFixed(1) +
          '" font-size="' + fs.toFixed(1) + '" fill="#a6b0bc" text-anchor="middle" ' +
          'font-family="sans-serif">' + n + '</text>');
      }
    }
    var rLo = Math.min(oy, ty), rHi = Math.max(oy, ty);
    for (var rr = rLo; rr <= rHi; rr++) {
      var m = Math.abs(rr - oy);
      var showY = (m % everyY === 0) || m === b.rise;
      parts.push('<line x1="' + (px(0) - fs * 0.4).toFixed(1) + '" y1="' + py(rr).toFixed(1) +
        '" x2="' + (px(0) - fs * (showY ? 1.0 : 0.75)).toFixed(1) + '" y2="' + py(rr).toFixed(1) +
        '" stroke="#6f7d8c" stroke-width="' + (sw * 0.6).toFixed(2) + '"/>');
      if (showY) {
        parts.push('<text x="' + (px(0) - fs * 1.3).toFixed(1) + '" y="' + (py(rr) + fs * 0.36).toFixed(1) +
          '" font-size="' + fs.toFixed(1) + '" fill="#a6b0bc" text-anchor="end" ' +
          'font-family="sans-serif">' + m + '</text>');
      }
    }

    parts.push('</svg>');
    return parts.join('');
  }

  /** A label on a solid plate so it stays readable over the dot grid. */
  function pill(text, cx, cy, fs, colour, boundW, boundH) {
    var w = text.length * fs * 0.62 + fs * 0.9;
    var h = fs * 1.7;
    // Keep the plate inside the viewBox — short setups leave little margin.
    cx = Math.min(boundW - w / 2 - 1, Math.max(w / 2 + 1, cx));
    cy = Math.min(boundH - h / 2 - 1, Math.max(h / 2 + 1, cy));
    return '<g>' +
      '<rect x="' + (cx - w / 2).toFixed(1) + '" y="' + (cy - h / 2).toFixed(1) +
      '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (h / 2).toFixed(1) +
      '" fill="#0a0c0f" stroke="' + colour + '" stroke-width="' + (fs * 0.09).toFixed(2) + '"/>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (cy + fs * 0.36).toFixed(1) +
      '" font-size="' + fs.toFixed(1) + '" fill="' + colour + '" text-anchor="middle" ' +
      'font-weight="700" font-family="sans-serif">' + esc(text) + '</text></g>';
  }

  /* --------------------------------------------------------------------- */
  /* Ladder + alternatives                                                 */
  /* --------------------------------------------------------------------- */

  function renderLadder(res, grid) {
    var b = res.best;
    var rows = '<thead><tr><th>Setup</th><th>Angle</th><th>Error</th><th>Out over ' +
      fmtLen(state.part) + '</th><th>Length</th></tr></thead><tbody>';

    res.ladder.forEach(function (r) {
      var isBest = b && r.run === b.run && r.rise === b.rise;
      rows += '<tr class="' + (isBest ? 'is-best' : '') + '">' +
        '<td class="pair">' + r.run + ' × ' + r.rise +
        (r.isExactDiagonal ? ' <span class="tick" title="exact diagonal">◆</span>' : '') + '</td>' +
        '<td>' + fmtDeg(r.trueAngle) + '</td>' +
        '<td>' + (r.errorDeg > 0 ? '+' : '−') + r.absError.toFixed(3) + '°</td>' +
        '<td>' + fmtMm(Math.abs(r.deviationMm)) + '</td>' +
        '<td>' + fmtLen(r.runMm) + ' × ' + fmtLen(r.riseMm) + '</td>' +
        '</tr>';
    });
    rows += '</tbody>';
    ui.ladder.innerHTML = rows;
    ui.ladderCard.hidden = res.ladder.length === 0;
  }

  function renderSameAngle(res, grid) {
    var list = res.sameAngle;
    ui.sameCard.hidden = list.length === 0;
    if (!list.length) return;

    ui.sameNote.textContent = 'same ' + fmtDeg(res.best.trueAngle) + ', more reach';
    var rows = '<thead><tr><th>Setup</th><th>Length</th><th>Pin to pin</th><th></th></tr></thead><tbody>';
    list.slice(0, 12).forEach(function (r) {
      rows += '<tr>' +
        '<td class="pair">' + r.run + ' × ' + r.rise + '</td>' +
        '<td>' + fmtLen(r.runMm) + ' × ' + fmtLen(r.riseMm) + '</td>' +
        '<td>' + fmtMm(r.diagonalMm) + '</td>' +
        '<td>' + (r.isExactDiagonal ? '<span class="tick">◆ exact diagonal</span>' : '') + '</td>' +
        '</tr>';
    });
    rows += '</tbody>';
    ui.sameAngle.innerHTML = rows;
  }

  /* --------------------------------------------------------------------- */
  /* Wiring                                                                */
  /* --------------------------------------------------------------------- */

  function readAngle() {
    var v = parseFloat(ui.angle.value);
    if (isNaN(v)) return null;
    return Math.min(90, Math.max(0, v));
  }

  function update() { save(); render(); }

  function bind() {
    ui.angle.addEventListener('input', function () {
      var v = readAngle();
      if (v === null) return;
      state.angle = v;
      update();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-nudge]'), function (btn) {
      btn.addEventListener('click', function () {
        var d = parseFloat(btn.getAttribute('data-nudge'));
        var v = Math.min(90, Math.max(0, Math.round((state.angle + d) * 1000) / 1000));
        state.angle = v;
        ui.angle.value = v;
        update();
      });
    });

    ui.table.addEventListener('change', function () {
      state.tableId = ui.table.value;
      // Presets carry the grid their manufacturer ships; still fully overridable.
      var preset = W.TABLES.filter(function (t) { return t.id === state.tableId; })[0];
      if (preset) { state.gridId = preset.grid; ui.grid.value = preset.grid; }
      ui.customBox.hidden = state.tableId !== 'custom';
      update();
    });

    ui.grid.addEventListener('change', function () { state.gridId = ui.grid.value; update(); });

    ui.part.addEventListener('input', function () {
      var v = parseFloat(ui.part.value);
      if (isNaN(v) || v <= 0) return;
      state.part = v;
      update();
    });

    [['customW', 'customW'], ['customL', 'customL']].forEach(function (pair) {
      ui[pair[0]].addEventListener('input', function () {
        var v = parseFloat(ui[pair[0]].value);
        if (isNaN(v) || v < 100) return;
        state[pair[1]] = v;
        update();
      });
    });

    ui.fullSurface.addEventListener('change', function () {
      state.fullSurface = ui.fullSurface.checked;
      update();
    });

    ui.flipX.addEventListener('click', function () {
      state.flipX = !state.flipX;
      ui.flipX.setAttribute('aria-pressed', String(state.flipX));
      update();
    });
    ui.flipY.addEventListener('click', function () {
      state.flipY = !state.flipY;
      ui.flipY.setAttribute('aria-pressed', String(state.flipY));
      update();
    });
  }

  /* --------------------------------------------------------------------- */

  load();
  fillSelects();
  syncControls();
  bind();
  render();

  // Offline support. file:// has no service workers, and that's fine — the app
  // already works from disk there.
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { });
    });
  }
})();
