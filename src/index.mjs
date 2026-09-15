export {
  analyze,
  measure,
  renderMarkdown,
  renderSummary,
  stdIds,
  todoOf,
} from "./core/gap-analysis.mjs";
export {
  RULES,
  FAMILIES,
  ruleById,
  loadCatalog,
  runCatalog,
  scoreOf,
  enforcedOf,
  validate,
} from "./rules/index.mjs";
export { buildContext } from "./rules/context.mjs";
export {
  PROFILES,
  DEFAULT_PROFILES,
  profileById,
  loadProfile,
  loadProfiles,
  validateProfile,
  catalogOf,
  phasesOf,
  phasesFor,
} from "./profiles/index.mjs";
export { STAGES, stageOf } from "./rules/stage.mjs";
export { buildReport, latestReport, allReports } from "./core/report.mjs";
export { initRepo, TEMPLATES } from "./core/init.mjs";
export { doctor, drift, selfTest } from "./core/doctor.mjs";
export { runGate, pushRange, pendingPaths } from "./core/gate.mjs";
export { presets, presetById, detectPreset } from "./presets/index.mjs";
export { repoRoot, readAdoption, readPackage, dependencyNames } from "./core/repo.mjs";
