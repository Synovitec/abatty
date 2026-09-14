export { analyze, renderMarkdown, renderSummary } from "./core/gap-analysis.mjs";
export { initRepo, TEMPLATES } from "./core/init.mjs";
export { doctor, drift, selfTest } from "./core/doctor.mjs";
export { runGate, pushRange, pendingPaths } from "./core/gate.mjs";
export { presets, presetById, detectPreset } from "./presets/index.mjs";
export { repoRoot, readAdoption, readPackage, dependencyNames } from "./core/repo.mjs";
