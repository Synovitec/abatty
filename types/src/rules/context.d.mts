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
 */
/**
 * Build the context of a repository. @param {string} repoDir @param {{ today?: string }} [o]
 * @returns {RepoContext}
 */
export function buildContext(repoDir: string, o?: {
    today?: string;
}): RepoContext;
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
};
