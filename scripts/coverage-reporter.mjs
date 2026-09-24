// A test reporter that writes one thing: the line coverage Node's own runner measured, per file,
// as JSON, for `scripts/coverage-changed.mjs` to read. Node prints its coverage as a table only;
// the numbers a changed-line check needs are in the `test:coverage` event, and a reporter is the
// dependency-free way to keep them.
//
//   node --test --experimental-test-coverage --test-reporter=./scripts/coverage-reporter.mjs \
//     --test-reporter-destination=.abatty/coverage/lines.json ...
import { relative } from "node:path";

/** @param {AsyncIterable<{ type: string, data: any }>} source */
export default async function* coverageLines(source) {
  /** @type {Record<string, { covered: number[], uncovered: number[] }>} */
  const files = {};
  for await (const event of source) {
    if (event.type !== "test:coverage") continue;
    for (const f of event.data?.summary?.files || []) {
      const path = relative(process.cwd(), String(f.path)).split("\\").join("/");
      /** @type {{ line: number, count: number }[]} */
      const lines = Array.isArray(f.lines) ? f.lines : [];
      files[path] = {
        covered: lines.filter((l) => l.count > 0).map((l) => l.line),
        uncovered: lines.filter((l) => l.count === 0).map((l) => l.line),
      };
    }
  }
  yield JSON.stringify({ measuredAt: new Date().toISOString(), files }) + "\n";
}
