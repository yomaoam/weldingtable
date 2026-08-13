# Welding Table Angle Finder

**Which two holes do I pin?**

A modular welding table is a steel slab with a precise grid of holes. You can only
pin where there is a hole, so **any straight edge you set up on the table runs
between two grid points** — which means the only angles the table can physically
hold are `atan(rise / run)` for whole numbers of holes. This app takes the angle you
want and tells you which two holes give it. Ask for 20° on a 50 mm grid and the
answer is 11 holes across, 4 holes up: 19.983°, off by 0.017°, which is 0.18 mm over
a 600 mm part — better than a protractor and repeatable to the hole.

Open [`index.html`](./index.html). That's it. No build step, no install, no accounts,
no network calls at any point.

## In plain language

*(No welding or maths knowledge needed.)*

**The setting.** A welding table is a heavy steel workbench with a neat grid of evenly
spaced holes across its top — like a giant sheet of graph paper made of steel. Welders
drop metal pins into those holes and push their workpiece up against them to hold it
still, the same way pegs hold things on a pegboard.

**The problem.** Say you want to weld two pieces together at a specific slant — 20
degrees, say. You'd hold the metal against two pins, and the line between those pins
sets the angle. But you can only put a pin where there's already a hole. You can't
drill a new one wherever you like. So the only angles the table can actually make are
the lines you can draw between two existing holes — and most "perfect" angles fall
between the holes, so you can only get *close*.

**The old way.** A welder grabs a protractor, eyeballs the angle, and nudges the metal
until it looks about right. It's slow, imprecise, and hard to reproduce tomorrow.

**What this does instead.** You type in the angle you want and pick which table you
have. The app quietly tries every combination of "go this many holes across and this
many holes up," works out the slant each one gives, and picks the closest. Then it
tells you in plain terms: for 20°, **"11 across, 4 up."** Count 11 holes to the side, 4
holes up, drop your pins in those two spots — done. Because the holes never move, you
get the exact same setup every time.

**The honest part.** The angle won't be *exactly* 20° — it'll be 19.983°, because
you're stuck with the holes you have. Instead of quoting a scary-looking decimal, the
app translates that into something you can picture: **"0.18 mm out at the end of a
600 mm part."** Over a piece of metal about 60 cm long, the far end is off by less than
the thickness of a couple of sheets of paper — far better than a protractor. And when
an angle genuinely *can't* be held well, the app says so and points you to a nearby
angle it can nail perfectly, rather than pretending.

**The picture.** It also draws the holes as dots, marks your two pins, and prints
numbers along the edges so you can count along with your finger — gloves on, in a dim
workshop. Flip buttons let you match whichever corner of the table you're working from.

**In one sentence:** you want a precise angle; the table can only make certain angles
because you can only pin where the holes are; this app tells you which two holes get
you closest, and honestly shows how close in millimetres you'd actually feel.

## What it does

- Brute-forces every `(run, rise)` pair that fits your table, filtered by what the
  grid can physically hold, and picks the closest to your target angle.
- **Leads with millimetres, not degrees** — degrees are meaningless on a shop floor.
  Everything is reported as "x mm out at the end of a y mm part".
- Shows the **accuracy ladder**: walking out from the shortest setup, every option
  that beats everything shorter than it, so the length/accuracy trade-off is visible
  rather than hidden behind one answer.
- Draws the actual holes, with counting ticks along both edges, so you can walk it
  out with a finger. Flip controls mirror the setup to whichever corner you're
  working from.
- Flags **exact diagonals** (Pythagorean triples) where a stop bar cut to a whole
  number of pitches seats on both pins.
- Says plainly when the table can't hold the angle well, and what it *can* hold.
- Installs to a home screen and works with no signal.

## The three grids

| Grid | Layout | Constraint |
|---|---|---|
| `square50` | 16 mm holes on a 50 mm square grid (D16) | none — every whole-hole step works |
| `square100` | 28/22 mm holes on a 100 mm square grid (D28/D22 basic) | none, but every setup is twice as long |
| `diagonal100` | 100 mm grid **plus a second 100 mm grid offset by 50 mm in x and y** (D28/D22 standard — Siegmund and most clones) | counted in 50 mm units, holes exist only where x and y are **both odd or both even** |

The diagonal grid is the one that bites. Because a hole only exists where x and y
share parity, the vector between any two holes always has `run + rise` even — so a
1-across-2-up setup does not exist on those tables, and accuracy near 45° is
noticeably worse than the hole count suggests. The app never silently ignores this.

A side effect worth knowing: 10/9 is impossible on a diagonal grid (odd sum), but
20/18 — the same angle, twice the reach — is fine. So the usual "skip any pair where
`gcd(run, rise) > 1`" shortcut is *wrong* here; the rule is "skip a pair only if a
shorter pair at the same angle is also legal on this grid".

## Honesty about accuracy

Holes are made to about ±0.05 mm, roughly ±0.006° over a 1 m span, and your pin has
clearance in the hole. About **0.01° is the noise floor** — below that you are
chasing numbers, not metal. The app says so permanently on screen, warns when the
best available setup is worse than 0.5°, and tells you the worst angular error the
selected table can be forced into (near 0° and 90°, where the ratios thin out badly).

## Files

```
index.html      the app
styles.css      workshop-first styling: dark, high contrast, big numerals
grid-math.js    ALL the geometry. Pure, no DOM, no I/O. Reusable and testable.
app.js          UI only: reads inputs, renders, remembers settings
tests.html      the acceptance tests, in the browser
tests.js        the assertions (shared by browser and Node)
run-tests.js    headless runner
sw.js           offline cache
manifest.webmanifest, icon.svg, icon-*.png
tools/make-icons.py   regenerates the PNG icons (stdlib Python, no deps)
```

## Tests

```bash
node run-tests.js
```

or open [`tests.html`](./tests.html) in a browser. 46 assertions, all of the
acceptance criteria from the brief: the eight reference targets and their complement
symmetry, the diagonal-grid parity rule checked across 53,400 returned pairs, exact
diagonals, error-to-millimetre conversion, ladder ordering, and hole-count
bookkeeping. No dependencies, no network, no credentials.

## Deploying to GitHub Pages

1. Push to GitHub.
2. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Done. Everything uses relative paths, so it works from a project subpath
   (`user.github.io/weldingtable/`) as well as a root domain.

`.nojekyll` is present so Pages serves the files as-is. When you change any file,
bump `CACHE` in [`sw.js`](./sw.js) — the old cache is deleted on activate, so a
version bump is the whole update mechanism.

## Not built (the roadmap)

Deliberately out of scope for this MVP:

- **Circle / bolt-hole patterns** — finding the holes that sit on a circle of a given
  radius. This is the obvious next one, and `grid-math.js` is kept separate and pure
  so it can be reused for it.
- Parallel-offset repeats of an angle.
- Printable cheat sheets.
- Miter and joint cut angles.
- Imperial units.
- Any 3D, CAD import, or file handling.
