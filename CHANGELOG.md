# CHANGELOG

All notable changes to the IConcrete hardening work. One entry per phase.

## [Unreleased] — hardening-v1

### Added

**Process**
- `REQUIREMENTS.md` — one line per numbered prompt item with status and proof.
- `STATUS.md` — resume file (baseline, current phase, next step).
- `docs/VERIFICATION.md` — the real output of every check, plus the defects each check found.
- `docs/PHASE_REPORTS_AR.md` — Arabic per-phase reports.
- `docs/OWNER_GUIDE_AR.md` — plain-Arabic owner guide (roles, daily workflow, code-rule approval, backups, keys to rotate, what is not implemented).
- `docs/KNOWN_LIMITATIONS.md` — what is not built, not wired or not verified.
- `docs/CONTRAST.md` — the measured WCAG AA report for the design tokens.
- `docs/DEPLOYMENT.md` — environments table (Local / Preview-staging / Production), the exact Vercel settings, which variable belongs to which scope, how to push Convex functions to staging, the release checklist, rollback, and the owner's manual steps. Arabic first, English summary.

**Deployment & delivery**
- `scripts/vercel-build.sh` — the build entrypoint Vercel now runs. `VERCEL_ENV=production` pushes the Convex functions first (`npx convex deploy --typecheck enable --cmd "bun run build" --cmd-url-env-var-name VITE_CONVEX_URL`, with `--cmd-url-env-var-name` so the bundle can never disagree with the backend it was just deployed against); every other environment builds the frontend only, against the staging Convex deployment named by `VITE_CONVEX_URL`, and never deploys. Both paths exit non-zero instead of building silently against the wrong backend — verified by running all three guard paths (production without a deploy key, preview without `VITE_CONVEX_URL`, unset `VERCEL_ENV`), each returning `exit=1`.
- `vercel.json` — created (there was none); it sets `buildCommand` only, so the framework preset and output directory are left exactly as they were.
- `package.json` — added the `vercel-build` script.
- `.github/pull_request_template.md` — the merge checklist: checks green, preview actually tested, backward-compatible migration, Convex export taken, rollback plan, owner approval.

**Security**
- `src/convex/demoMode.ts` — `DEMO_MODE`, **off** unless the deployment explicitly enables it.
- `scripts/secret-scan.mjs` — dependency-free secret scanner with `--self-test` (11 must-flag + 5 must-pass fixtures).
- `.github/workflows/ci.yml` — 8 gating steps: install, secret scan, contrast, client types, convex types, lint, tests, build. No `continue-on-error`.
- `userBranches` and `qualityRules` tables with indexes.

**Branch isolation**
- `src/convex/branchScope.ts` — resolves a viewer's branch scope from `userBranches` (assignment + effective dates) and gates reads and writes: `requireBranchAccess`, `mayUseBranch`, `scopedBranchIds`, and `assertBranchUnchanged` for immutable record branches. Migration-safe: enforcement activates when the first assignment appears, so it cannot lock a plant out on deploy.
- `tests/branchScope.test.ts` — 18 tests over the pure policy (inclusive effective-date boundaries, expiry, owner, un-migrated plant, the unassigned bucket, immutability).
- Enforced on read and write in `production.ts`, `quality.ts` and `inventory.ts`.

**Concrete engineering**
- `src/lib/exact.ts` — exact `bigint` micro-unit arithmetic parsed from decimal text; `shareExceeds()` for exact share comparisons.
- `src/lib/quality/ecp203.ts` — the ECP 203-2007 rule engine: R-CS, R-PRE, R-FIN, R-SLUMP, R-CORE, R-EARLY seeded as **draft and unverified**, with the approve/verify/effective/complete gate and the five result statuses.
- `src/lib/quality/sampling.ts` — sampling plan (R-SAMP) and specimen scheduler.
- `src/lib/quality/ecp203.test.ts` — 39 tests: V1–V9, gating, cylinder rejection, exact boundaries, sampling.
- `src/lib/errors.ts` — 21 standard business error codes, each with an Arabic resolution-guide message and a `retryable` flag.
- `qualityTests.targetCubeMpa`, `specimenType`, `complianceStatus`, `complianceRuleKey`, `ticketNo`.

### Changed

- `src/convex/pricing.ts` — **removed the silent C30/37 fallback.** An unknown mix now raises `UNKNOWN_MIX` on every path (form, import, sync replay, offline queue). Demo prices are `isTestData: true`.
- `src/convex/quality.ts` — the test target is explicit (`targetCubeMpa`) and is **never** derived from the mix name; a cylinder is stored and never compared; early-age results are informational; the invented 7-day = 70% rule and the invented 25 mm slump-tolerance default are gone.
- `src/convex/access.ts` — anonymous viewers are rejected unless `DEMO_MODE` is on; added the `demoConfig` query.
- `src/convex/permissions.ts` — an anonymous viewer gets nothing when `DEMO_MODE` is off; the demo guest capability set is read-only (no financials, no export, no audit, no writes).
- `src/convex/http.ts` — export token from the `x-iconcrete-token` header only, constant-time comparison, CORS allow-list (no wildcard), row limit, branch scope, CSV formula-injection guarding, 503 preserved.
- `src/index.css` — cool blue-grey palette with measured WCAG AA compliance, dark counterpart, and a print/PDF layer that stays white.
- `src/pages/Landing.tsx`, `src/lib/i18n.tsx` — the intro is the exact required sentence; marketing fluff and unverified claims removed.
- `src/components/AskAIAgent.tsx` — rewritten: no longer claims to be AI, token-styled, and its help topics point at routes that exist.
- `src/components/ProductionFormDialog.tsx` — prefills price and cost from the plant's own approved list (`api.settings.get`) and warns on an unapproved mix.
- `src/pages/Quality.tsx`, `src/pages/Production.tsx` — dropped the name-derived targets, the 70% preview rule and the demo grade list.
- `README.md`, `docs/ARCHITECTURE.md` — updated for the new checks, scripts and invariants.

### Fixed

- `src/hooks/use-mobile.ts` — rewritten on `useSyncExternalStore` (removed the setState-in-effect error).
- `src/components/ui/carousel.tsx` — deferred state sync out of the effect body and detached the leaked `reInit` listener.
- `src/components/ui/sidebar.tsx` — deterministic `useId()`-derived skeleton width instead of `Math.random()` during render.
- R-FIN share comparison unit-scale bug (7.5% of 40 results read as "within 5%").
- R-SLUMP per-band gating so one unreadable parameter no longer blocks the readable band.
- `evaluateCube28Preliminary` double-scaling of the latest result.
- Apple/Google fixture length in the secret scanner's self-test.

### Notes

- `src/convex/` is the Convex **functions** directory: every file under it is
  typechecked by the Convex project (which has no `@/` alias) and bundled on
  deploy, so unit tests live in `tests/` or beside frontend modules — never in
  `src/convex/`.
- Version control is platform-managed on this host: `git` commands are refused, so
  the baseline commit hash and a local `hardening-v1` branch could not be created,
  `.env.keys` could not be removed from the index with `git rm --cached`, and git
  history could not be scanned for secrets. See `STATUS.md` → Baseline and
  `docs/KNOWN_LIMITATIONS.md` §11.
- Lint went from **3 errors** to **0 errors** by fixing causes, so the CI gate can
  actually fail a build.
- Test count is **39**. No coverage percentage is claimed because none was measured.
