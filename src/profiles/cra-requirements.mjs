/**
 * The regulation's essential requirements, and which rules of this catalog bear on each.
 *
 * READ THIS BEFORE THE TABLE. This is a MAPPING, not a conformity assessment, and it is not legal
 * advice. It says which engineering practices a repository holds that bear on a requirement; it
 * cannot say whether a product conforms, because conformity is a judgement about a product in a
 * market, made by people with the whole picture, against the regulation's own text. The wording
 * below is a PARAPHRASE for orientation, kept short on purpose so that nobody mistakes it for the
 * text: the article and annex references are there so a reader goes and reads the real thing.
 *
 * The value of the table is in its empty rows. Most of these requirements have nothing to do with
 * a source-code standard - unauthorised access control, data minimisation, denial-of-service
 * resilience, secure update distribution - and a mapping that quietly left those out, or stretched
 * a rule to cover one, would be the most dangerous document this package could produce. Each
 * requirement therefore records `covers` (what a rule here actually evidences, and only that) and
 * `gap` (what it does not, in words, always).
 */

/**
 * @typedef {{
 *   id: string,
 *   part: "I" | "II",
 *   title: string,
 *   rules: string[],
 *   covers: string,
 *   gap: string,
 * }} Requirement
 */

/** The source this paraphrases, named so the reader can go to it. */
export const REGULATION = {
  name: "Regulation (EU) 2024/2847 (the Cyber Resilience Act)",
  annex: "Annex I: Part I, the product's properties; Part II, vulnerability handling",
  warning:
    "A mapping is not a conformity assessment and is not legal advice. The wording here is a short paraphrase for orientation; conformity is judged against the regulation's own text, about a product in a market, by people with the whole picture.",
};

/** @type {Requirement[]} */
export const REQUIREMENTS = [
  {
    id: "I.1",
    part: "I",
    title: "An appropriate level of cybersecurity based on the risks",
    rules: ["SEC-SECRETS", "SEC-AUDIT", "SEC-LOCKFILE", "INST-CONTROLS", "INST-GATE"],
    covers:
      "that a written standard exists, that the checks enforcing it have been watched going red, and that the gate refuses work which breaks them",
    gap: "the risk assessment itself. Nothing here knows what this product is, who attacks it or what an appropriate level would be; a gate is evidence of discipline, never of a risk analysis",
  },
  {
    id: "I.2",
    part: "I",
    title: "Made available without known exploitable vulnerabilities",
    rules: ["SEC-AUDIT", "SEC-LOCKFILE"],
    covers:
      "that a scoped dependency audit runs in the gate and in CI, that the lockfile is committed and installs are frozen, and that an advisory carried on purpose is allowed by name with a reason and an expiry",
    gap: "vulnerabilities in the product's own code, which no dependency audit sees, and the judgement of which known vulnerability is exploitable in this product",
  },
  {
    id: "I.3.a",
    part: "I",
    title: "A secure default configuration, and a reset to the original state",
    rules: [],
    covers: "nothing",
    gap: "entirely outside a source-code standard: this is a property of the shipped product's configuration and its reset path",
  },
  {
    id: "I.3.b",
    part: "I",
    title: "Protection from unauthorised access, and reporting of it",
    rules: [],
    covers: "nothing",
    gap: "authentication, identity and access management are the product's design; no rule here inspects them",
  },
  {
    id: "I.3.c",
    part: "I",
    title: "Confidentiality of stored, transmitted and processed data",
    rules: ["SEC-SECRETS", "OBS-REDACTION"],
    covers:
      "one narrow slice: that credentials are not committed to the repository, and that the logger redacts by field path rather than at the call sites",
    gap: "encryption at rest and in transit, key management, and every other part of confidentiality. A secret scan is not a confidentiality control",
  },
  {
    id: "I.3.d",
    part: "I",
    title: "Integrity of data, commands, configuration and the product's structure",
    rules: ["SEC-LOCKFILE", "INST-GATE", "FLOW-COMMITS"],
    covers:
      "that the tree which was tested is the tree that ships, that a change is refused before it lands rather than after, and that the history is readable",
    gap: "runtime integrity: tamper detection, signed configuration, corruption reporting. None of that is a property of a source tree",
  },
  {
    id: "I.3.e",
    part: "I",
    title: "Data minimisation: only what is adequate, relevant and necessary",
    rules: ["OBS-REDACTION"],
    covers: "that the logger has a redaction list, which is one place data is over-collected",
    gap: "what the product collects, stores and transmits, which is a design question nothing here reads",
  },
  {
    id: "I.3.f",
    part: "I",
    title: "Availability of essential functions, and resilience to denial of service",
    rules: ["OBS-HEALTH", "OBS-SIGTERM"],
    covers:
      "that the service reports its health to a deploy and a load balancer, and that it drains work in flight rather than exiting on the spot",
    gap: "rate limiting, capacity, backpressure, and every deliberate attack on availability",
  },
  {
    id: "I.3.g",
    part: "I",
    title: "No negative impact on the availability of other devices or networks",
    rules: [],
    covers: "nothing",
    gap: "a property of the product's behaviour on a network, not of its source",
  },
  {
    id: "I.3.h",
    part: "I",
    title: "Limited attack surface, including external interfaces",
    rules: ["CODE-ARCH-GRAPH", "CODE-DEADCODE", "SEC-AGENT-PERMISSIONS"],
    covers:
      "that the module boundaries are declared and enforced, that code nothing reaches is removed rather than left, and that an agent's permissions are written down with the dangerous commands denied",
    gap: "the product's own external interfaces: its ports, its endpoints, its protocols. A dependency graph is not an attack surface",
  },
  {
    id: "I.3.i",
    part: "I",
    title: "Reduced impact of an incident, through exploitation mitigation",
    rules: [],
    covers: "nothing",
    gap: "compiler and runtime hardening, sandboxing of the product itself, privilege separation",
  },
  {
    id: "I.3.j",
    part: "I",
    title: "Security information recorded and monitored, with an opt-out",
    rules: ["OBS-STRUCTURED", "OBS-REDACTION", "OBS-TRACKER"],
    covers:
      "that logs are structured rather than lines on stdout, that they redact by field path, and that an error tracker is configured from the environment",
    gap: "what is recorded, whether it is monitored, and the opt-out the regulation asks for",
  },
  {
    id: "I.3.k",
    part: "I",
    title: "Secure and permanent deletion and transfer of user data",
    rules: [],
    covers: "nothing",
    gap: "a product feature, invisible to any source-code rule",
  },
  {
    id: "II.1",
    part: "II",
    title: "Vulnerabilities and components identified and documented, with a bill of materials",
    rules: ["SEC-LOCKFILE"],
    covers:
      "that the exact dependency tree is committed, which is the input a bill of materials is generated from",
    gap: "the bill of materials itself. This package produces none, in any format, and its attestation says so rather than pretending otherwise",
  },
  {
    id: "II.2",
    part: "II",
    title: "Vulnerabilities addressed without delay, with security updates provided",
    rules: ["SEC-AUDIT", "FLOW-VERSION"],
    covers:
      "that the audit fails the gate on an unaddressed advisory above the floor, that an advisory carried on purpose expires rather than persisting, and that releases are versioned",
    gap: "the delay itself, and whether a security update was separable from a functionality update",
  },
  {
    id: "II.3",
    part: "II",
    title: "Effective and regular tests and reviews of the security of the product",
    rules: ["TEST-UNIT", "TEST-COVERAGE", "TEST-MUTATION", "SEC-AUDIT", "INST-CONTROLS"],
    covers:
      "that tests exist and run in the gate, that coverage is gated on the change, that mutation testing measures the tests rather than the code, and - the part nothing else evidences - that every gate step has been watched going red, so a green run means something",
    gap: "security testing as such: penetration testing, fuzzing, threat modelling, and a review by somebody who was looking for attacks",
  },
  {
    id: "II.4",
    part: "II",
    title: "Fixed vulnerabilities disclosed publicly once an update exists",
    rules: ["DOC-CHANGELOG"],
    covers:
      "that every change is recorded in a changelog written for the reader, in the same commit",
    gap: "a security advisory: a changelog entry is not one, and nothing here checks that a fix was disclosed",
  },
  {
    id: "II.5",
    part: "II",
    title: "A policy on coordinated vulnerability disclosure, enforced",
    rules: ["SEC-DISCLOSURE"],
    covers: "that a disclosure policy is published where a reporter looks for it, with a contact",
    gap: "whether the policy is enforced, and whether anybody answers the contact",
  },
  {
    id: "II.6",
    part: "II",
    title: "Information about potential vulnerabilities shared, with a contact address",
    rules: ["SEC-DISCLOSURE"],
    covers: "that a contact address is published",
    gap: "the sharing itself, and the relationship with whoever reports",
  },
  {
    id: "II.7",
    part: "II",
    title: "Secure distribution of updates, so a fix reaches users in time",
    rules: [],
    covers: "nothing",
    gap: "the distribution channel, its signatures and its update mechanism, none of which is in a source tree",
  },
  {
    id: "II.8",
    part: "II",
    title: "Patches disseminated without delay, free of charge, with advisory messages",
    rules: [],
    covers: "nothing",
    gap: "a commercial and operational commitment, not an engineering practice",
  },
];

/**
 * How much of the mapping is even claimed. Reported next to any coverage figure, because a
 * requirement with no rule behind it is the most important thing this table has to say.
 */
export function mappingShape() {
  const claimed = REQUIREMENTS.filter((r) => r.rules.length);
  return {
    total: REQUIREMENTS.length,
    withRules: claimed.length,
    withoutRules: REQUIREMENTS.length - claimed.length,
    rules: [...new Set(REQUIREMENTS.flatMap((r) => r.rules))].sort(),
  };
}

/**
 * The mapping against a repository's findings: per requirement, what each named rule reads here.
 * A rule that is not in this repository's catalog is reported as absent rather than skipped, so
 * a profile that drops a rule cannot silently improve the coverage figure.
 * @param {import("../rules/index.mjs").Finding[]} findings
 */
export function mapRequirements(findings) {
  const by = new Map(findings.map((f) => [f.id, f]));
  return REQUIREMENTS.map((r) => {
    const evidence = r.rules.map((id) => {
      const f = by.get(id);
      return {
        rule: id,
        status: f ? f.status : "not in this catalog",
        evidence: f?.evidence || "",
      };
    });
    // A rule that does not apply to this repository (no service, no database, no browser) is
    // neither held nor broken, and counting it as broken would read as a failure where there is
    // nothing to fail. It leaves both sides of the fraction and is said out loud instead.
    const applies = evidence.filter((e) => e.status !== "n/a");
    const held = applies.filter((e) => e.status === "present").length;
    return {
      ...r,
      evidence,
      // None of these words is "met". Nothing here can say that.
      standing: !r.rules.length
        ? "nothing claimed"
        : !applies.length
          ? "no named rule applies to this repository"
          : held === applies.length
            ? "every applicable rule holds"
            : held
              ? "some applicable rules hold"
              : "no applicable rule holds",
    };
  });
}
