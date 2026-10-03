/**
 * The languages abatty has no preset for, read from the files that mark them. A Go service was
 * taken for documents, since its sources are none of the ones the checks read, and was handed the
 * docs preset without a word: a gate with no build, no test and no lint of its own language.
 */

/** A manifest or a source extension, and the language it says. */
const MARKS = /** @type {[RegExp, string][]} */ ([
  [/(^|\/)go\.mod$|\.go$/, "Go"],
  [/(^|\/)Cargo\.toml$|\.rs$/, "Rust"],
  [/(^|\/)(pom\.xml|build\.gradle(\.kts)?)$|\.(java|kt)$/, "a JVM language"],
  [/\.(csproj|fsproj|sln)$|\.cs$/, ".NET"],
  [/(^|\/)Gemfile$|\.rb$/, "Ruby"],
  [/(^|\/)composer\.json$|\.php$/, "PHP"],
  [/(^|\/)Package\.swift$|\.swift$/, "Swift"],
  [/(^|\/)mix\.exs$|\.exs?$/, "Elixir"],
  [/(^|\/)(CMakeLists\.txt|meson\.build)$|\.(c|cc|cpp|h|hpp)$/, "C or C++"],
]);

/**
 * The language a repository is written in that no preset covers, by the first mark found; ""
 * when none is there.
 * @param {(re: RegExp) => string[]} files the repository's tracked files matching a pattern
 * @returns {string}
 */
export function foreignLanguage(files) {
  for (const [re, name] of MARKS) if (files(re).length) return name;
  return "";
}
