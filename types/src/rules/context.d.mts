/**
 * @typedef {object} RepoContext
 * @property {string} repo the absolute root
 * @property {string} name the folder name (package.json's name wins in the report)
 * @property {string} today YYYY-MM-DD
 * @property {string} agentRoot the agent's settings folder name, relative to the root
 * @property {string[]} allFiles every kept file, repository-relative, forward slashes
 * @property {(re: RegExp) => string[]} files the kept files whose path matches
 * @property {(re: RegExp) => string | undefined} firstFile the first of those
 * @property {(p: string) => boolean} exists
 * @property {(p: string) => string} read the file's text, "" when unreadable
 * @property {(p: string) => any} readJson the parsed JSON, null when unreadable or invalid
 * @property {(...args: string[]) => string} git trimmed stdout, "" on failure
 * @property {(text: string) => number} codeLines lines that are neither blank nor a full-line comment
 * @property {Set<string>} deps every dependency name of the root and first-level workspaces
 * @property {(dep: string) => boolean} has
 * @property {Record<string, any>} pkg the root package.json, {} when absent
 * @property {Record<string, string>} scripts its scripts
 * @property {(re: RegExp) => [string, string] | undefined} script the first script whose name or command matches
 * @property {string[]} eslintFiles
 * @property {string} eslintText every ESLint flat config, joined
 * @property {string} tsconfigText every tsconfig, joined
 * @property {string[]} ciFiles the CI pipelines (Woodpecker, GitHub Actions)
 * @property {string} ciText
 * @property {string[]} ghWorkflows the GitHub workflows
 * @property {string[]} sourceFiles source files outside the agent folder, migrations and tests
 * @property {string[]} docFiles the Markdown files under docs/
 * @property {string[]} tsSources
 * @property {string[]} jsSources
 * @property {boolean} isTs more TypeScript than JavaScript sources
 * @property {string | null} contextFile the agent's context file at the root or in its folder
 * @property {Record<string, any> | null} adoption the repository's adoption config
 * @property {StackFacts} stack what the repository is, for a rule's `applies`
 */
/**
 * The facts a rule's `applies` reads: booleans, each read once. A rule that needs one of them
 * returns n/a with the reason instead of missing on a repository that has no such surface.
 * @typedef {object} StackFacts
 * @property {boolean} package a package.json at the root
 * @property {boolean} js JavaScript or TypeScript sources
 * @property {boolean} ts TypeScript sources
 * @property {boolean} ui a browser application: a UI framework dependency or component sources
 * @property {boolean} server an HTTP server or API surface
 * @property {boolean} database an ORM, a query builder or a database driver
 * @property {boolean} i18n translation catalogues or an i18n library
 * @property {boolean} pwa a service worker or a web manifest
 * @property {boolean} docsOnly no sources and no package: documents, decisions, a schema, a mockup
 */
/**
 * Build the context of a repository. @param {string} repoDir @param {{ today?: string }} [o]
 * @returns {RepoContext}
 */
export function buildContext(repoDir: string, o?: {
    today?: string;
}): RepoContext;
/**
 * @param {{ has: (d: string) => boolean, deps: Set<string>, files: (re: RegExp) => string[], sourceFiles: string[], tsSources: string[], exists: (p: string) => boolean }} c
 * @returns {StackFacts}
 */
export function stackFacts(c: {
    has: (d: string) => boolean;
    deps: Set<string>;
    files: (re: RegExp) => string[];
    sourceFiles: string[];
    tsSources: string[];
    exists: (p: string) => boolean;
}): StackFacts;
export type RepoContext = {
    /**
     * the absolute root
     */
    repo: string;
    /**
     * the folder name (package.json's name wins in the report)
     */
    name: string;
    /**
     * YYYY-MM-DD
     */
    today: string;
    /**
     * the agent's settings folder name, relative to the root
     */
    agentRoot: string;
    /**
     * every kept file, repository-relative, forward slashes
     */
    allFiles: string[];
    /**
     * the kept files whose path matches
     */
    files: (re: RegExp) => string[];
    /**
     * the first of those
     */
    firstFile: (re: RegExp) => string | undefined;
    exists: (p: string) => boolean;
    /**
     * the file's text, "" when unreadable
     */
    read: (p: string) => string;
    /**
     * the parsed JSON, null when unreadable or invalid
     */
    readJson: (p: string) => any;
    /**
     * trimmed stdout, "" on failure
     */
    git: (...args: string[]) => string;
    /**
     * lines that are neither blank nor a full-line comment
     */
    codeLines: (text: string) => number;
    /**
     * every dependency name of the root and first-level workspaces
     */
    deps: Set<string>;
    has: (dep: string) => boolean;
    /**
     * the root package.json, {} when absent
     */
    pkg: Record<string, any>;
    /**
     * its scripts
     */
    scripts: Record<string, string>;
    /**
     * the first script whose name or command matches
     */
    script: (re: RegExp) => [string, string] | undefined;
    eslintFiles: string[];
    /**
     * every ESLint flat config, joined
     */
    eslintText: string;
    /**
     * every tsconfig, joined
     */
    tsconfigText: string;
    /**
     * the CI pipelines (Woodpecker, GitHub Actions)
     */
    ciFiles: string[];
    ciText: string;
    /**
     * the GitHub workflows
     */
    ghWorkflows: string[];
    /**
     * source files outside the agent folder, migrations and tests
     */
    sourceFiles: string[];
    /**
     * the Markdown files under docs/
     */
    docFiles: string[];
    tsSources: string[];
    jsSources: string[];
    /**
     * more TypeScript than JavaScript sources
     */
    isTs: boolean;
    /**
     * the agent's context file at the root or in its folder
     */
    contextFile: string | null;
    /**
     * the repository's adoption config
     */
    adoption: Record<string, any> | null;
    /**
     * what the repository is, for a rule's `applies`
     */
    stack: StackFacts;
};
/**
 * The facts a rule's `applies` reads: booleans, each read once. A rule that needs one of them
 * returns n/a with the reason instead of missing on a repository that has no such surface.
 */
export type StackFacts = {
    /**
     * a package.json at the root
     */
    package: boolean;
    /**
     * JavaScript or TypeScript sources
     */
    js: boolean;
    /**
     * TypeScript sources
     */
    ts: boolean;
    /**
     * a browser application: a UI framework dependency or component sources
     */
    ui: boolean;
    /**
     * an HTTP server or API surface
     */
    server: boolean;
    /**
     * an ORM, a query builder or a database driver
     */
    database: boolean;
    /**
     * translation catalogues or an i18n library
     */
    i18n: boolean;
    /**
     * a service worker or a web manifest
     */
    pwa: boolean;
    /**
     * no sources and no package: documents, decisions, a schema, a mockup
     */
    docsOnly: boolean;
};
