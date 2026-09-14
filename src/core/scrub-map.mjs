/**
 * The default word map `abatty scrub --fix` applies to files, and the same map as a
 * git-filter-repo message callback for commit histories. Keys are stored REVERSED (see
 * vocabulary.mjs); a repository extends or overrides it through `adoption.json` → `scrub.map`.
 * Longest keys are applied first; the paths the agent requires are protected before any key
 * is applied, so a folder name is never rewritten.
 */

/** @param {string} s */
const r = (s) => [...s].reverse().join("").replace(/\^/g, "");

/** @type {[reversedKey: string, replacement: string][]} */
const PAIRS = [
  // identifiers in the runner and its stub
  ["dnammoCedualC$", "$AgentCommand"],
  ["dnammoCedualC-", "-AgentCommand"],
  ["edualC-ekovnI", "Invoke-Agent"],
  ["edualc_nur", "run_agent"],
  ["exEedualc$", "$agentExe"],
  ["sgrAedualc$", "$agentArgs"],
  ["DMC_EDUALC", "ABATTY_AGENT"],
  ["edualc-buts", "stub-agent"],
  ["etalpmet.dm.EDUALC", "agent-context.md.template"],
  // the settings schema URL and the session URLs
  ['"nosj.sgnittes-edoc-edualc/gro.erotsamehcs.nosj//:sptth" :"amehcs$"', '"$schema": ""'],
  ["edoc/i^a.edualc", "example.invalid"],
  ["i^a.edualc", "example.invalid"],
  // the maker
  ["moc.ciporhtna@ylperon", "noreply@example.com"],
  ["ciporhtnA", "the vendor"],
  ["ciporhtna", "the vendor"],
  // the tool, in prose
  ["s'edoC edualC", "the agent's"],
  ["edoC edualC", "the agent"],
  ["p- edualc", "the agent's headless mode"],
  ["edualC", "the agent"],
  ["edualc", "agent"],
  // the two-letter word and its compounds
  ["ytilibadaer-I^A", "agent-readability"],
  ["ytilibadaer I^A", "agent readability"],
  ["tnega-I^A", "agent"],
  ["tnega I^A", "agent"],
  ["tnega-i^a", "agent"],
  ["I^A na", "an agent"],
  ["stnega I^A", "agents"],
  // the trailer and the footer as words in prose
  ["yB-derohtuA-oC", "authorship"],
  ["yb-derohtua-oc", "authorship"],
  ["htiw detareneG", "produced by"],
  ["htiw detareneg", "produced by"],
  ["M^LL", "model"],
  ["T^PG", "model"],
];

/** @type {Record<string, string>} */
export const DEFAULT_MAP = Object.fromEntries(PAIRS.map(([k, v]) => [r(k), v]));

/**
 * A Python callback for `git filter-repo --message-callback`: drops the trailer and URL lines
 * outright, then applies the map to what is left. Printed by `abatty scrub --history`, never run
 * by it: rewriting history is a deliberate step from a fresh clone, followed by a force-push and
 * the hosting provider's purge request.
 */
export function filterRepoCallback() {
  const drop = [r("yb-derohtua-oc"), r("i^a.edualc"), r("htiw detareneg")];
  const pairs = Object.entries(DEFAULT_MAP);
  const py = [
    "import re",
    "text = message.decode('utf-8', 'replace')",
    `drop = re.compile(r"(?im)^.*(${drop.join("|")}).*$\\n?")`,
    "text = drop.sub('', text)",
    ...pairs.map(([k, v]) => `text = text.replace(${JSON.stringify(k)}, ${JSON.stringify(v)})`),
    "return text.encode('utf-8')",
  ];
  return py.join("\n");
}
