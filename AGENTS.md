# Welding Table Angle Finder — rules for coding agents

Binding for **every** coding tool in this repo (Copilot, Grok, Codex, Cursor, Claude
Code, anything else). If this file and your own judgement disagree, this file wins.
If a rule blocks you, **stop and ask** — never mock data, weaken a check, or work
around a blocker silently. Broader reasoning lives in [README.md](./README.md).

## What this project is

A single-page, zero-build, fully-offline tool that turns a target angle into which
two holes to pin on a modular welding table. Vanilla HTML/CSS/JS. It must keep
running by just opening `index.html` from disk — no server, no bundler, no npm
install, no framework, ever. That constraint is the product, not an accident.

## Never do these

- **Never run `git commit` or `git push`.** Leave changes in the working tree and
  hand over a ready-to-paste commit message. The maintainer commits.
- **Never add a build step, bundler, framework, or npm dependency.** There is no
  `package.json` and there should not be one. The app loads three plain `<script>`
  tags. Node is used only to run the tests headlessly (`node run-tests.js`) and has
  no dependencies. If you think something needs a library, stop and ask.
- **Never add a network call, analytics, telemetry, external font, CDN, or remote
  asset.** The app must work fully offline with no signal. Everything is
  self-contained and same-origin. This is a hard privacy/reliability requirement.
- **Never break `file://` operation.** No ES-module `import`/`export` in the files
  loaded by `index.html` (module scripts don't load from `file://`); `grid-math.js`
  uses a UMD-style wrapper so it works as a `<script>` global *and* via `require()`
  in Node. Service-worker registration is already guarded to `http(s)` only — keep
  it that way.
- **Never put geometry in `app.js` or DOM code in `grid-math.js`.** The split below
  is load-bearing.
- **Never delete, skip, or loosen a failing test to get to green.** A failing test
  is information — the acceptance values in `tests.js` were verified independently
  and are the spec. If the code disagrees with them, the code is wrong.
- **Never silently drop the diagonal-grid parity rule** (`(run + rise)` even in 50 mm
  units). It removes real, useful ratios and degrades accuracy near 45°; that is
  correct behaviour, not a bug to optimise away. See `gridAllows` / `minValidMultiple`.

## Architecture (keep this boundary)

- **`grid-math.js`** — ALL the geometry. Pure functions, no DOM, no `localStorage`,
  no I/O. This is the tested, reusable core (circle mode will reuse it untouched).
  Anything you can assert about angles/holes/errors belongs here and gets a test.
- **`app.js`** — UI only: read inputs, call `WeldGrid.solve(...)`, render, persist to
  `localStorage`. No maths beyond formatting.
- **`tests.js`** — assertions, shared verbatim by `tests.html` (browser) and
  `run-tests.js` (Node). Add a case here when you touch the maths.

## Verification (definition of "it works")

Run the real command, bare:

```bash
node run-tests.js
```

Exit code 0 and "N passed, 0 failed" is the bar. It is credential-free and
network-free by construction (pure module + Node's built-ins only). For UI changes,
also do a quick pass in a browser (`index.html` and `tests.html`) — but hand off UI
verification with a short checklist rather than driving a browser preview yourself
unless asked.

## Scope discipline

- Touch only the files the task needs. No drive-by refactors or formatting sweeps.
- Prefer the smallest diff that solves the problem completely. If the task grows
  mid-build, stop and say so.
- Reuse before writing: the helpers in `grid-math.js` (`gcd`, `gridAllows`,
  `holeSpans`, `evaluate`, `solve`, `worstCaseError`, `nearestAchievable`) already
  cover most geometry questions — search there before adding anything.

## Code style

- Plain ES5-compatible vanilla JS (`var`, function expressions, no arrow/`const` in
  the shipped files) so it runs everywhere off disk without transpilation. Match the
  surrounding style; comment the *why*, especially any geometry subtlety.
- No `innerHTML` from untrusted input — there is no untrusted input (no network), but
  keep the `esc()` helper on anything interpolated into markup anyway.
- Units discipline: `run`/`rise` are in **grid units**, not mm. A unit is 50 mm on
  `square50` and `diagonal100`, 100 mm on `square100`. Convert to mm only at the edge.

## UI hard rules

- **Mobile-first, workshop-first**: phone in one hand, gloves on, poor light, dirty
  screen. Big tap targets (≥48 px), high contrast, big numerals, dark by default.
- Keep input font size ≥16 px to avoid iOS zoom-on-focus.
- The two key numbers (run, rise) must be readable at arm's length.
- The permanent noise-floor note near the results is **non-dismissable by design** —
  do not make it collapsible or removable.
- Wide content (ladder tables, diagram) scrolls inside its own container; the page
  body never scrolls horizontally.

## Docs are part of the change

`README.md` is the durable engineering + user doc. Update it in the same change when
behaviour, the grid model, the file list, or the roadmap changes. Keep the
out-of-scope list current as things get built.

## Workflow

- Branch per non-trivial change. One coherent, committable piece at a time that
  leaves the tests green and the app working from `file://`. Stop after each piece
  and hand off a commit message.
