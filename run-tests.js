#!/usr/bin/env node
/* Headless test runner: `node run-tests.js`. Exits non-zero on any failure.
   Same assertions the browser page (tests.html) runs. No dependencies. */

globalThis.WeldGrid = require('./grid-math.js');
const tests = require('./tests.js');

const { results, passed, failed } = tests.run();

for (const r of results) {
  const mark = r.pass ? '  ok  ' : 'FAIL  ';
  console.log(mark + r.name + (r.detail ? '   [' + r.detail + ']' : ''));
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
