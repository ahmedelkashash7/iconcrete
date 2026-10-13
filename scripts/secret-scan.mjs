#!/usr/bin/env node
/**
 * IConcrete System — secret scan.
 *
 * Dependency-free (no paid service, nothing to install) so it can run in CI and
 * in a pre-commit hook. It walks the working tree, skips build output and
 * dependencies, and flags anything that looks like a committed credential.
 *
 *   node scripts/secret-scan.mjs            # report
 *   node scripts/secret-scan.mjs --staged   # only files staged in git (pre-commit)
 *
 * Exits 1 when a high-confidence secret is found, 0 otherwise.
 *
 * What it does NOT do: read git history. Scanning history needs `git log -p`,
 * which the platform blocks on this host (see STATUS.md). The owner must run a
 * history scan once from a machine with git access — see docs/OWNER_GUIDE_AR.md.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-ssr",
  "build",
  "coverage",
  ".nyc_output",
  ".vscode",
  "target",
  "gen",
]);

const SKIP_FILE = /(^|\/)(package-lock\.json|bun\.lock|pnpm-lock\.yaml|yarn\.lock)$/;

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".rs",
  ".toml",
  ".sh",
  ".env",
  ".example",
  ".txt",
  ".xml",
  ".properties",
  ".pem",
  ".key",
]);

/**
 * High-confidence patterns. Each `id` is what the owner is told to rotate when
 * it fires, so keep the ids recognisable.
 */
const RULES = [
  { id: "dotenvx-private-key", re: /DOTENV_PRIVATE_KEY[A-Z_]*\s*[:=]\s*["']?[\w+/=-]{20,}/ },
  { id: "private-key-block", re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "aws-secret", re: /aws_secret_access_key["'\s:=]+[\w/+=]{40}/i },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "stripe-secret", re: /\b(sk|rk)_(live|test)_[0-9A-Za-z]{16,}\b/ },
  { id: "slack-token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: "github-token", re: /\b(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}\b|\bgithub_pat_[0-9A-Za-z_]{22,}\b/ },
  { id: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}\b/ },
  { id: "resend-key", re: /\bre_[0-9A-Za-z]{20,}\b/ },
  { id: "sendgrid-key", re: /\bSG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}\b/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: "convex-deploy-key", re: /\b(prod|dev):[a-z0-9-]+\|[A-Za-z0-9+/=]{40,}/ },
  {
    id: "generic-api-key",
    re: /(api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token)["'\s]*[:=]\s*["'][A-Za-z0-9_\-./+]{24,}["']/i,
  },
  {
    id: "hardcoded-password",
    re: /(password|passwd|pwd)["'\s]*[:=]\s*["'][^"'{}$][^"']{7,}["']/i,
  },
];

/**
 * Values that look like a secret but are obviously placeholders / documentation.
 * Keeping this list tight matters: a scanner that cries wolf gets switched off.
 */
const ALLOWLIST = [
  /process\.env\./,
  /import\.meta\.env\./,
  /your[_-]?[a-z]*[_-]?(key|token|secret)/i,
  /<[a-z_-]+>/i,
  /\b(example|placeholder|changeme|dummy|sample|redacted|xxx+)\b/i,
  /\$\{/,
  /"",?\s*$/,
  /VLY_INTEGRATION/,
];

function isTextual(file) {
  const ext = extname(file).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  const base = file.split("/").pop() ?? "";
  return base.startsWith(".env");
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(ROOT, full);
    if (SKIP_FILE.test(rel)) continue;
    if (!isTextual(rel)) continue;
    yield rel;
  }
}

/**
 * `--self-test` proves the rules actually fire. Without it a scan reporting
 * "0 findings" is indistinguishable from a scanner that never matches anything.
 */
if (process.argv.includes("--self-test")) {
  // secret-scan-fixtures:start
  const MUST_FLAG = [
    'DOTENV_PRIVATE_KEY_PRODUCTION="abc123def456ghi789jkl012mno345pqr678"',
    "-----BEGIN RSA PRIVATE KEY-----",
    "aws key AKIAIOSFODNN7EXAMPLE",
    "google AIzaSyA1234567890abcdefghijklmnopqrstuv", // AIza + exactly 35 chars, like a real key
    "stripe sk_live_51H8xYzABCDEFGHIJKLMNOP",
    "slack xoxb-123456789012-abcdefghijklmnop",
    "github ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "resend re_1234567890abcdefghijklmnopqrstuv",
    "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    'apiKey: "0123456789abcdefghijklmnopqrstuv"',
    'password: "sup3rSecretValue"',
  ];
  // secret-scan-fixtures:end
  const MUST_PASS = [
    'apiKey: process.env.MY_API_KEY',
    'const token = "your-api-key-here"',
    'apiKey: "<your-key>"',
    'secretKey: "example-placeholder-value"',
    'DOTENV_PRIVATE_KEY="${MY_KEY}"',
  ];
  let bad = 0;
  for (const sample of MUST_FLAG) {
    if (!RULES.some((rule) => rule.re.test(sample))) {
      bad += 1;
      console.error(`  MISS  should have been flagged: ${sample.slice(0, 40)}…`);
    }
  }
  for (const sample of MUST_PASS) {
    const flagged = RULES.some(
      (rule) => rule.re.test(sample) && !ALLOWLIST.some((p) => p.test(sample)),
    );
    if (flagged) {
      bad += 1;
      console.error(`  FALSE POSITIVE: ${sample}`);
    }
  }
  console.log(
    bad === 0
      ? `Secret-scan self-test: ${MUST_FLAG.length} must-flag + ${MUST_PASS.length} must-pass samples all correct.`
      : `Secret-scan self-test FAILED with ${bad} problem(s).`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

const findings = [];

for (const file of walk(ROOT)) {
  // Env files are managed through the platform's keys UI; never read them here.
  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example")) continue;

  let content;
  try {
    content = readFileSync(join(ROOT, file), "utf8");
  } catch {
    continue;
  }
  if (content.length > 2_000_000) continue;

  const lines = content.split(/\r?\n/);
  let inFixtureBlock = false;
  lines.forEach((line, index) => {
    // The scanner's own self-test fixtures live between these markers.
    if (line.includes("secret-scan-fixtures:start")) {
      inFixtureBlock = true;
      return;
    }
    if (line.includes("secret-scan-fixtures:end")) {
      inFixtureBlock = false;
      return;
    }
    if (inFixtureBlock) return;
    if (line.endsWith("secret-scan:allow")) return;
    if (line.length > 2000) return;
    if (ALLOWLIST.some((pattern) => pattern.test(line))) return;
    for (const rule of RULES) {
      const match = line.match(rule.re);
      if (!match) continue;
      // Never echo the secret itself — only enough to locate and identify it.
      const excerpt = match[0].replace(/["'][^"']*$/, "").slice(0, 24);
      findings.push({ file, line: index + 1, rule: rule.id, excerpt });
      break;
    }
  });
}

if (findings.length === 0) {
  console.log("Secret scan: no committed credentials found.");
  console.log(`Scanned ${[...walk(ROOT)].length} text files (working tree; history not scanned — see docs/OWNER_GUIDE_AR.md).`);
  process.exit(0);
}

console.error(`Secret scan: ${findings.length} potential secret(s) found.\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  [${finding.rule}]  near: ${finding.excerpt}…`);
}
console.error(
  "\nRemove the value from the file, rotate the credential, and (if it was ever\n" +
    "committed) purge it from git history — see docs/OWNER_GUIDE_AR.md.",
);
process.exit(1);
