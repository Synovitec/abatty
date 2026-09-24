---
title: "The secret scan, measured"
description: "The secret scan run against a published corpus of 52 cases - 20 documented credential shapes and 32 look-alikes that are not secrets - with the precision and recall it scores, the six shapes it was found to miss, and what the corpus is not. Reproducible with abatty secrets --benchmark."
category: reference
status: living
audience: ["developer", "architect", "reviewer"]
tags: ["secrets", "benchmark", "measurement", "security"]
related: ["./CATALOG.md", "./STANDARDS_PROGRESS.md"]
source_truth: ["../src/core/secret-corpus.mjs", "../src/core/secrets.mjs"]
scope: synovitec
last_verified: "2026-09-24"
---

# The secret scan, measured

A scanner nobody has measured is a claim. This is the measurement, the corpus it was taken on,
and what the number does not say.

```bash
abatty secrets --benchmark          # the numbers, and every case it gets wrong by name
abatty secrets --benchmark --json   # the same, for a pipeline
```

## The numbers

|                                  |                                                  |
| -------------------------------- | ------------------------------------------------ |
| Cases                            | 52                                               |
| Documented credential shapes     | 20                                               |
| Look-alikes that are not secrets | 32                                               |
| **Precision**                    | **100%** of what it reported was really a secret |
| **Recall**                       | **100%** of the secrets in the corpus were found |

Both are held as a floor by a test: they may rise and never fall, and the test also refuses a
corpus whose look-alikes stop outnumbering its secrets, because a corpus of things the scanner
already catches measures nothing.

## What the measurement found

The corpus was written before the scan was changed, and the first run scored **100% precision and
67% recall**. It missed six shapes, every one of them a credential somebody commits:

| Missed                                           | Why it matters                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| An unquoted assignment (`API_KEY=a1b2...`)       | This is what a `.env` file looks like. The scan read quoted literals only, so the most common shape of all was the one shape it could not see |
| A connection string carrying a password          | The most-committed credential there is, and it was invisible                                                                                  |
| A cloud API key (`AIza...`)                      | A documented prefix and a fixed length                                                                                                        |
| A package registry token (`npm_...`)             | How a publish credential leaks                                                                                                                |
| A mail provider key (`SG....`)                   | A documented two-part shape                                                                                                                   |
| A storage account key inside a connection string | The name `AccountKey` was not among the names the generic shape knew                                                                          |

All six are now shapes the scan carries, which is what took recall to 100%. The measurement is
the reason they were found; without it the scan would still be reporting nothing and looking
healthy.

The corpus then found one false positive in this repository's own tree: the generated pipeline
writes `postgres://postgres:postgres@postgres:5432/test` for a service container. That is a
throwaway credential every pipeline in the world writes, and flagging it is how a scan teaches its
reader to scroll past it - so that the day a real one appears, they scroll past that too. A
password equal to its own user name, or one of the well-known service defaults, is not a finding.

The first adopter's repository then reported twenty-six findings, and none was a secret. Two
shapes caused them, and both are now cases, which each carry the path of the file they sit in:

- **A variable read in source code** (`accessToken: settings.token`). In code a literal is
  quoted, so the unquoted shape, the one a `.env` file needs, is not read in a source file.
- **A readable sample in a fixture, a test or a fake** (`mp_access_xyz789`). There a match on a
  secret-like name is skipped only when the value reads as written by a person: a lowercase
  word in it and low entropy, both. Entropy alone was the first reading, and a review found it
  let every hex key through, since sixteen symbols never reach four bits a character; the hex
  key in a test is now a case. A vendor's own key format is still reported wherever it appears, fixtures included.

## What this is not

**It is not a third-party benchmark.** The corpus is this repository's own, assembled from the
vendors' documented formats and from the false positives that actually get scanners uninstalled.
A corpus written by the same hands as the scanner is weaker evidence than one written by somebody
else, and saying so is part of publishing the number.

**The values are assembled from named parts**, split at each vendor's documented prefix, because
the hosting platform's push protection refuses a file containing a contiguous credential-shaped
string - which it did, on five cases, the first time this corpus was pushed. The corpus is built
at load, so the scan is measured on the complete value; the split is on the page, not in the
measurement. It is also a small piece of evidence that the shapes are the right ones.

What it is instead: reproducible. The corpus is a file in the package
(`src/core/secret-corpus.mjs`), every case carries the reason it is the verdict it is, and anybody
who disagrees with a case can read it and argue with it. Running the benchmark against a published
corpus remains open, and this page will say so until it is done.

**A number on 52 cases is a number on 52 cases.** It says the scan handles the shapes people
document and the look-alikes people trip over. It does not say what the scan does on a million
lines of somebody else's repository, and nothing here should be read as if it did.
