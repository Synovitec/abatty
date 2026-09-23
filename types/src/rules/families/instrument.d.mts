/**
 * The instrument: the ratchet and its baseline, the per-file floors, the control cases, the
 * gate, the pre-commit hook, CI and its steps. Standard §2.2-2.4, P.1, P.2, SEC.1.
 */
/**
 * The package scripts a pipeline's text invokes (`npm run x`, `pnpm run x`, `yarn x`, `bun run
 * x`, with or without `-s`/`--silent`), and which of them the package does not have. A pipeline
 * is credited for what it can run, not for what it names: the generated one on a trial repository
 * named five scripts the package lacked, was red from its first run, and still counted as
 * "present" for six points of score. A comment line runs nothing, so it is not read: a pipeline
 * whose comment said "yarn 1 comes with the runner images" was charged with a script named `1`.
 * A flag before `run` (`pnpm --filter web run build`, `bun --cwd apps/api run test`) is read
 * through, and the scripts a pipeline can reach are the whole tree's: a monorepo passes them
 * with {@link treeScripts}, because its steps run in a workspace's own folder.
 * @param {string} ciText @param {Record<string, string>} scripts
 */
export function phantomScripts(ciText: string, scripts: Record<string, string>): any[];
/**
 * Every script a pipeline could run: the root's, and those of each workspace the pipeline names
 * (its folder in a `working-directory:` or a `--cwd`, its package name in a `--filter`). An
 * adopter's steps ran `bun run typecheck` under `working-directory: apps/web`, and the root's
 * package.json alone called them phantom. A workspace the pipeline never names lends it nothing:
 * a root `npm run lint` is still phantom when only `packages/x` has a lint. The root's win a
 * name both define.
 * @param {import("../index.mjs").RepoContext} c
 * @returns {Record<string, string>}
 */
export function treeScripts(c: import("../index.mjs").RepoContext): Record<string, string>;
/** @type {import("../index.mjs").Rule[]} */
export const rules: import("../index.mjs").Rule[];
