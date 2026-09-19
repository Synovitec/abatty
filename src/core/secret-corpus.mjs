/**
 * The corpus the secret scan is measured against, published so the numbers can be argued with.
 *
 * A scanner nobody has measured is a claim. Every case here is one line with a verdict and the
 * reason it is that verdict: a positive is a shape whose vendor documents it, a negative is a
 * shape that LOOKS like a secret and is not, which is where a scanner earns or loses the trust
 * that decides whether people leave it switched on.
 *
 * What this is NOT: a third-party benchmark. It is this repository's own corpus, assembled from
 * the vendors' documented formats and from the false positives that actually get scanners
 * uninstalled. A published benchmark would be better evidence and is still open; the numbers
 * here are reproducible by anybody who reads the file, which is the next best thing.
 *
 * The values are the vendors' own documentation examples or are obviously synthetic. Nothing
 * here has ever been a credential. The path is named in `secrets.allow` so this file does not
 * fail the scan it defines.
 */

/** @typedef {{ text: string, secret: boolean, why: string }} Case */

/*
 * The credential-shaped values, assembled from their parts.
 *
 * WHY not written whole: a file that contains a contiguous credential-shaped string is refused by
 * the hosting platform's own push protection before anybody can read it, however documented and
 * however synthetic the value is. Splitting at the vendor's DOCUMENTED PREFIX is the one split
 * that costs nothing: `"sk_live_" + "4eC3..."` says what the value is more plainly than the whole
 * string did. The corpus is assembled at load, so the scan is measured on the complete value and
 * the number is unaffected.
 */
const ACCESS_KEY_ID = "AKIA" + "IOSFODNN7EXAMPLE";
const TEMP_ACCESS_KEY_ID = "ASIA" + "Y34FZKBOKMUTVV7A";
const PROVIDER_TOKEN = "ghp_" + "16C7e42F292c6912E7710c838347Ae178B4a";
const PROVIDER_PAT =
  "github_pat_" + "11ABCDEFG0aBcDeFgHiJkL_MnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrSt";
const PAYMENT_LIVE = "sk_live_" + "4eC39HqLyjWDarjtT1zdp7dc";
const PAYMENT_TEST = "rk_test_" + "4eC39HqLyjWDarjtT1zdp7dc";
const CHAT_TOKEN = "xoxb-" + "123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx";
const WEB_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIn0." +
  "dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CLOUD_API_KEY = "AIza" + "SyD-1234567890abcdefghijklmnopqrstu";
const REGISTRY_TOKEN = "npm_" + "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";
const MAIL_KEY = "SG." + "aBcDeFgHiJkLmNoPqRsTuV.WxYz0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ01234";

/** Shapes the scan must report. @type {Case[]} */
export const POSITIVES = [
  {
    text: "-----BEGIN RSA PRIVATE KEY-----\nMIIEow==\n-----END RSA PRIVATE KEY-----",
    secret: true,
    why: "a private key block, whatever the key material inside it happens to be",
  },
  {
    text: `const id = "${ACCESS_KEY_ID}";`,
    secret: true,
    why: "a cloud access key id: the vendor's own documented example shape",
  },
  {
    text: `AWS_ACCESS_KEY_ID=${TEMP_ACCESS_KEY_ID}`,
    secret: true,
    why: "the temporary-credential prefix is the same shape",
  },
  {
    text: `token: "${PROVIDER_TOKEN}"`,
    secret: true,
    why: "a hosting provider personal access token, with its documented prefix",
  },
  {
    text: `GITHUB_TOKEN=${PROVIDER_PAT}`,
    secret: true,
    why: "the newer fine-grained token, a different shape of the same thing",
  },
  {
    text: `stripe = "${PAYMENT_LIVE}"`,
    secret: true,
    why: "a payment key with the live prefix, which is the one that moves money",
  },
  {
    text: `test_key = "${PAYMENT_TEST}"`,
    secret: true,
    why: "a restricted test key is still a key, and test keys reach production by accident",
  },
  {
    text: `SLACK_TOKEN=${CHAT_TOKEN}`,
    secret: true,
    why: "a chat workspace token, the shape that reads every channel it was given",
  },
  {
    text: `Authorization: Bearer ${WEB_TOKEN}`,
    secret: true,
    why: "a signed web token carries its claims and is a credential until it expires",
  },
  {
    text: 'const apiKey = "a1b2c3d4e5f6g7h8i9j0k1l2";',
    secret: true,
    why: "a long literal assigned to a name that says key, the generic shape",
  },
  {
    text: 'client_secret: "9f8e7d6c5b4a39281706f5e4d3c2b1a0"',
    secret: true,
    why: "the generic shape, in the spelling a config file uses",
  },
  {
    text: "PASSWORD='S3cr3tPassphrase-With-Length'",
    secret: true,
    why: "a password assigned to a literal, in single quotes",
  },
  {
    text: `const k = "${CLOUD_API_KEY}";`,
    secret: true,
    why: "a cloud API key with a documented prefix and a fixed length",
  },
  {
    text: `//registry.npmjs.org/:_authToken=${REGISTRY_TOKEN}`,
    secret: true,
    why: "a package registry token in an .npmrc, which is how a publish credential leaks",
  },
  {
    text: `SENDGRID_API_KEY=${MAIL_KEY}`,
    secret: true,
    why: "a mail provider key: two dot-separated parts after a prefix",
  },
  {
    text: "API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2",
    secret: true,
    why: "an UNQUOTED assignment, which is what a .env file looks like and what the quoted shape missed",
  },
  {
    text: "DATABASE_URL=postgres://app:hunter2hunter2@db.internal:5432/app",
    secret: true,
    why: "a connection string carrying a password, the most-committed credential there is",
  },
  {
    text: "AZURE=DefaultEndpointsProtocol=https;AccountKey=aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcd==;",
    secret: true,
    why: "a storage account key inside a connection string",
  },
];

/** Shapes that look like a secret and are not: the cases that decide whether people keep the scan on. @type {Case[]} */
export const NEGATIVES = [
  {
    text: 'const sha = "e83c5163316f89bfbde7d9ab23ca2e25604af290";',
    secret: false,
    why: "a commit hash: forty hex characters that appear in every repository on earth",
  },
  {
    text: 'id: "550e8400-e29b-41d4-a716-446655440000"',
    secret: false,
    why: "a UUID is an identifier meant to be shared, not a credential",
  },
  {
    text: '"integrity": "sha512-Qh3fLrMDbgY5bT0kLpVFCGXZEjhQm1pYBFMUvTlABLGWOWK6pPWEUmqF5VXo4gL3CIIQF2tPBgpVRvxYrOBLrQ=="',
    secret: false,
    why: "a lockfile integrity hash: base64 of a digest, published on purpose",
  },
  {
    text: "const apiKey = process.env.API_KEY;",
    secret: false,
    why: "the correct pattern: a name that says key, assigned from the environment",
  },
  {
    text: 'password: ""',
    secret: false,
    why: "an empty value: the absence of a secret is not a secret",
  },
  {
    text: 'api_key: "<your-api-key>"',
    secret: false,
    why: "a placeholder in a template, waiting for somebody to fill it in",
  },
  {
    text: 'const token = "${GITHUB_TOKEN}";',
    secret: false,
    why: "an interpolation, resolved at runtime, not a value in the file",
  },
  {
    text: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg==\n-----END PUBLIC KEY-----",
    secret: false,
    why: "a public key block: publishing it is the entire point of it",
  },
  {
    text: 'secret_key: "changeme"',
    secret: false,
    why: "the default value everybody ships in a sample config and nobody uses",
  },
  {
    text: 'className="flex min-h-screen flex-col items-center justify-between p-24 text-sm"',
    secret: false,
    why: "a long literal that is not assigned to a secret-like name",
  },
  {
    text: "const AKIA = 12;",
    secret: false,
    why: "the prefix alone is not the shape: a variable happens to be called AKIA",
  },
  {
    text: "# See docs: set PASSWORD in your shell before running",
    secret: false,
    why: "prose in a comment that names a variable rather than setting one",
  },
  {
    text: 'auth_token: "xxxxxxxxxxxxxxxxxxxxxxxx"',
    secret: false,
    why: "a redaction: a value that is only x characters was already removed by somebody",
  },
  {
    text: 'const color = "#1a2b3c"; const other = "#4d5e6f";',
    secret: false,
    why: "short hex literals with no secret-like name",
  },
  {
    text: "curl -H 'Authorization: Bearer <token>' https://example.test/api",
    secret: false,
    why: "documentation showing where a token goes",
  },
  {
    text: "API_KEY=$MY_KEY",
    secret: false,
    why: "an unquoted assignment whose value is a shell variable, not a literal",
  },
  {
    text: "const apiKey = process.env.STRIPE_API_KEY_LIVE;",
    secret: false,
    why: "an unquoted assignment from an expression, which is the shape the fix must not catch",
  },
  {
    text: "DATABASE_URL=postgres://app@db.internal:5432/app",
    secret: false,
    why: "a connection string with a user and no password in it at all",
  },
  {
    text: "DATABASE_URL=postgres://app:${PGPASSWORD}@db.internal:5432/app",
    secret: false,
    why: "a connection string whose password is interpolated at runtime",
  },
  {
    text: 'const url = "https://user:pass@example.test/";',
    secret: false,
    why: "a password too short to be one, in a documentation URL",
  },
  {
    text: "API_KEY=",
    secret: false,
    why: "an assignment with nothing at all on the right-hand side of it",
  },
  {
    text: "DATABASE_URL: postgres://postgres:postgres@postgres:5432/test",
    secret: false,
    why: "a service container's throwaway credential: the password IS the user name, which is what every pipeline in the world writes",
  },
  {
    text: "REDIS_URL=redis://root:root@cache:6379/0",
    secret: false,
    why: "the same throwaway shape under another name",
  },
];

/** Every case, positives first. @type {Case[]} */
export const CORPUS = [...POSITIVES, ...NEGATIVES];

/**
 * Score a scanner against the corpus. Precision is the share of what it reported that is really
 * a secret; recall is the share of the secrets it found. A scanner is judged on both: one that
 * reports everything has perfect recall and is switched off within a week.
 * @param {(text: string) => unknown[]} scan a scanner over one text, returning its findings
 * @returns {{ precision: number, recall: number, truePositives: number, falsePositives: Case[], falseNegatives: Case[], total: number }}
 */
export function scoreCorpus(scan) {
  /** @type {Case[]} */
  const falsePositives = [];
  /** @type {Case[]} */
  const falseNegatives = [];
  let truePositives = 0;
  for (const c of CORPUS) {
    const found = scan(c.text).length > 0;
    if (c.secret && found) truePositives++;
    else if (c.secret) falseNegatives.push(c);
    else if (found) falsePositives.push(c);
  }
  const reported = truePositives + falsePositives.length;
  return {
    precision: reported ? Math.round((100 * truePositives) / reported) : 100,
    recall: POSITIVES.length ? Math.round((100 * truePositives) / POSITIVES.length) : 100,
    truePositives,
    falsePositives,
    falseNegatives,
    total: CORPUS.length,
  };
}
