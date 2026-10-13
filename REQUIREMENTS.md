# REQUIREMENTS — IConcrete hardening v1

One line per numbered item of the hardening prompt.
Status: `todo` · `in-progress` · `done` · `partial` · `blocked`.
**Proof** is the real command/output or artifact. Nothing is `done` without one.
Full limitation detail: `docs/KNOWN_LIMITATIONS.md`. Resume point: `STATUS.md`.

## Operating rules

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| OP-1 | Evidence over claims; run all checks after every phase and paste real output | done | `docs/PHASE_REPORTS_AR.md`; final sweep recorded in `docs/VERIFICATION.md` |
| OP-2 | REQUIREMENTS.md + STATUS.md, BLOCKED with reason, no silent skips, commit WIP | partial | This file + `STATUS.md` + `CHANGELOG.md` maintained. Commits: **BLOCKED** (see OP-5) |
| OP-3 | No paid services | done | New deps: `vitest@3.2.7` (MIT). Scripts use only Node built-ins. No paid tier added |
| OP-4 | No secrets/real data; synthetic data flagged `isTestData` | done | `bun run check:secrets` → `no committed credentials found` (187 files). `DEMO_SEED_MIX_PRICES` rows carry `isTestData: true` |
| OP-5 | Record baseline, create branch `hardening-v1`, commit per phase | blocked | `git` refused: *"Git and GitHub commands are blocked; Vly manages version control."* No commit hash, no branch, no `git rm --cached` obtainable. Baseline recorded descriptively in `STATUS.md` |
| OP-6 | Read-only platform files: enforce elsewhere and report | done | `convex/auth.ts` untouched; anonymous lockout enforced in `convex/access.ts` + `convex/permissions.ts`. Reported in `docs/KNOWN_LIMITATIONS.md` §12 |
| OP-7 | Arabic phase reports | done | `docs/PHASE_REPORTS_AR.md` |
| OP-8 | Exact arithmetic for money and boundary comparisons | partial | `src/lib/exact.ts` (bigint micro-units, decimal-text parsing) + `shareExceeds`; used by all rule comparisons and tested. **Money minor units (3.2): not built** |

## Phase 0 — Landing text and background

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 0.1 | Exact 1–2 sentence intro; remove fluff and unverified claims | done | `src/pages/Landing.tsx` (hero `h1` + paragraph are the exact required AR/EN strings), `src/lib/i18n.tsx` (`app.tagline`, `shell.coverage.body`), `src/components/AskAIAgent.tsx` no longer says "AI Agent" and its help topics point at routes that exist |
| 0.2 | Token palette, no hard-coded white, dark mode, WCAG AA measured, print white, theme-color + manifest | partial | `src/index.css` (canvas `#e9eef2`, surfaces `#f7f9fb`, ink `#1b2430`, amber kept), `index.html`, `public/manifest.webmanifest`, `scripts/contrast-check.mjs` → **62/62 required pairs pass**, `docs/CONTRAST.md`. Hard-coded whites removed from `AskAIAgent.tsx`, `ui/slider.tsx`, `instrumentation.tsx`. **Not done:** phone/desktop screenshot verification (no browser on this host) |

## Phase 1 — Security blockers

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 1.1 | `DEMO_MODE` (default OFF): anonymous gets nothing, guest button hidden, all queries/mutations reject; ON = read-only, no export/audit; enumeration test | partial | `src/convex/demoMode.ts` (OFF unless truthy), `permissions.can()` returns false for anonymous when off, `DEMO_GUEST_CAPABILITIES` is read-only (no `viewExport`/`viewAudit`/writes), `requireViewer` throws, `access.demoConfig` query, `Auth.tsx` hides the button via `useAccess().demoMode`, `use-access.ts`. **Missing: the automated enumeration test** (`convex-test` suite not written) |
| 1.2 | `.env.keys` removed from the index, .gitignore effective, repo scan, CI secret step, list keys to rotate | partial | `scripts/secret-scan.mjs` (13 rule families, self-test: 11 must-flag + 5 must-pass all correct) → clean over 187 files; wired into CI; `.gitignore` already ignores `.env.*`; `.env.keys` is absent from the working tree. **BLOCKED:** `git rm --cached` and history scanning need git; env-file access is refused by the platform. Rotation list in `docs/OWNER_GUIDE_AR.md` §7 |
| 1.3 | Header-only token, constant-time compare, CORS allow-list, row limit, branch scope, CSV injection guard, 503 when unset | done | `src/convex/http.ts`: `timingSafeEqual` (no early return, length folded into the XOR), token read from `x-iconcrete-token` only, `corsHeaders()` reflects an origin only from `ICONCRETE_CORS_ORIGINS` (no wildcard), `ROW_LIMIT_MAX` 20 000 / default 5 000, `ICONCRETE_EXPORT_BRANCHES` scope with 403 `BRANCH_NOT_ALLOWED`, `sanitizeCsvCell()` prefixes `= + - @ tab CR`, 503 `EXPORT_TOKEN_MISSING` preserved |
| 1.4 | Per-user branch assignments enforced server-side everywhere | partial | `src/convex/branchScope.ts` — pure `decideBranchAccess` / `mayUseBranch` / `effectiveBranchIds` / `scopedBranchIds` + the `requireBranchAccess` and `assertBranchUnchanged` gates, with **18 unit tests** in `tests/branchScope.test.ts` (inclusive effective-date boundaries, expiry, owner, un-migrated plant, immutable branch). Enforced on read **and** write in `production.ts`, `quality.ts` and `inventory.ts` (create/update/remove/list/overview). Migration-safe: enforcement activates as soon as the first assignment exists, so it cannot lock a plant out on deploy. **Not yet enforced in:** `imports.ts`, `sync.ts` pull, `settings.ts`, `analytics.ts`, `forecast.ts`, `exportLayer.ts`. See `docs/KNOWN_LIMITATIONS.md` §2 |
| 1.5 | Every mutation: capability, validation, audit, payload limit, server-managed fields | partial | Existing capability + audit coverage retained. Server-managed fields are not client-settable (`createdBy` is set from the viewer, never from args). **Missing:** a uniform payload-size limit and a systematic review of all 30+ mutations; `CLIENT_FIELD_IMMUTABLE` and `PAYLOAD_TOO_LARGE` codes are defined but not enforced |

## Phase 2 — Concrete-engineering correctness

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 2.1 | Cube basis: explicit `targetCubeMpa`, name never parsed, cylinder never compared, target shown | partial | Engine: `evaluateTest` returns indicator-only for `specimenType: "cylinder"` (test: *"a cylinder is never compared with a cube target (D1)"*); `suggestCubeTargetFromName` only suggests and warns it is the cylinder value. Convex: `qualityTests.targetCubeMpa` + `specimenType` added, `resolveTarget` throws `TARGET_STRENGTH_MISSING` instead of deriving a target, `strengthFromName`/`cubeTargetValue`/`testTargetValue` removed from the live path. **Missing:** a specimen-type selector on the Quality form (the column exists, the control does not) |
| 2.2 | Rule engine with gating, statuses, seeded draft rules, V1–V9, rule-entry screen, approval, permanent note | partial | `src/lib/quality/ecp203.ts` + `sampling.ts` + `ecp203.test.ts`: **39/39 green**, covering V1–V9, the approve/verify/effective/complete gate, per-band slump gating, the exact 22.5 / 70.0% / 5.0% boundaries, cylinder rejection, and the sampling plan. `qualityRules` table with indexes created. `INDICATOR_ONLY_LABEL` = «بدون كود معتمد – مؤشر فقط»; `NON_CERTIFICATION_NOTE` defined. **Missing:** the rule-entry screen with preview, the approval mutation, and inserting `SEED_RULES` — the engine is not reachable from the UI |
| 2.3 | Unknown mix = hard error in forms, import, sync replay, queue; demo prices flagged | done | `src/convex/pricing.ts`: `standardPricing` = `requireApprovedMix`, throws `UNKNOWN_MIX`, no `list[2]` fallback. All four call paths use it (`production.ts`, `imports.ts`, sync/queue). `DEMO_SEED_MIX_PRICES` is `isTestData: true`. UI: `ProductionFormDialog` now prefills from `api.settings.get` (the plant's own list) and warns when a typed mix is not approved; `Production.tsx` no longer seeds its filter from a demo grade list |
| 2.4 | Manual mix designs + ingredients, versioning, immutable approved, separate price list, cost per m³, per-load actuals | todo | Not built. No `mixDesigns`/`mixIngredients` tables. The price list (`mixPrices`) exists from v1 |
| 2.5 | Production creates theoretical issue movements in the same transaction, idempotent, variance + reason, negative-stock policy, compensating movements | todo | Not built. See `docs/KNOWN_LIMITATIONS.md` §5 |
| 2.6 | Movement types + append-only + reconciliation + invariant | todo | Not built. `removeMovement` still hard-deletes. See §6 |
| 2.7 | Ticket numbers, required `productionLogId`, specimens, Trace screen, non-conformity | todo | Only `qualityTests.ticketNo` added to the schema. See §7 |
| 2.8 | Moisture records + advisory correction helper | todo | Not built. See §8 |

## Phase 3 — Commercial and financial core

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 3.1 | customers / projects / orders / invoices / payments tables; production linked to orders | todo | No such tables exist. See `docs/KNOWN_LIMITATIONS.md` §4 |
| 3.2 | Integer minor units, documented rounding, EGP, multi-currency ready | todo | `src/lib/exact.ts` gives exact bigint micro-units and is used by the rule engine, but no money layer was built and no rounding rule is documented |
| 3.3 | VAT enable/rate/customer-exempt/override/snapshot | todo | Not built |
| 3.4 | Invoice draft→posted, immutable, credit notes, payments ≤ balance, duplicate protection, tests | todo | Not built |
| 3.5 | Costing per m³, profitability per order/customer/mix, estimates labelled | todo | Not built |
| 3.6 | Credit-limit warning on new orders | todo | Code `CREDIT_LIMIT_EXCEEDED` defined only |

## Phase 4 — Reliability

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 4.1 | `clientMutationId` idempotency incl. the offline queue, replay test | todo | Not built |
| 4.2 | Version-based optimistic concurrency, conflict UI, server time | todo | Not built. `VERSION_CONFLICT` code defined only |
| 4.3 | Configurable four-eyes approvals, strict vs single_user, tests | todo | Codes defined (`APPROVAL_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `APPROVAL_REASON_REQUIRED`); no table, no flow |
| 4.4 | Soft delete everywhere, no hard deletes, compensating undo/redo | todo | `removeMovement` still hard-deletes |
| 4.5 | Test-data isolation end to end | partial | `isTestData` exists on rows and every seed/export path sets it; demo prices are flagged. **No query-level enforcement and no test** |
| 4.6 | Standard error codes + Arabic resolution guidance | done | `src/lib/errors.ts`: 21 codes, each with `title`, an Arabic resolution-guide `message` and `retryable`; `businessError()`, `errorCode()`, `errorMessage()`; client-safe |
| 4.7 | Honest analytics: labelled statistical forecast, backtest vs naive baseline, "preventive maintenance reminders", no unmeasured claims | partial | Landing copy and the in-app helper were de-claimed (Phase 0.1) and the 7-day "70%" pseudo-rule was deleted. **Not done:** the Excel pack still ships `ml_PredictiveMaintenance` / `Predicted_Failure_Date` DAX, and no backtest was run |

## Phase 5 — Testing and CI

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 5.1 | Vitest + convex-test suite covering the listed behaviours | partial | Vitest added, `vitest.config.ts`, **57/57 tests pass** in 2 files (`bun run test`). Covered: exact arithmetic, cube-only comparison + cylinder rejection, V1–V9, rule gating (unapproved/unverified/empty/out-of-range → indicator_only), sampling scheduler, target suggestion, and the branch-scope policy (effective-date boundaries, expiry, owner, un-migrated plant, immutable branch). **Not covered:** ingredients/recipe maths, inventory invariant, invoice maths, idempotent replay, version conflicts, the permission matrix, anonymous rejection, export auth/CSV injection, test-data isolation, approvals. **`convex-test` not installed**, so no Convex function is exercised against a database |
| 5.2 | End-to-end scenario + failure cases | todo | Blocked by Phase 3 |
| 5.3 | GitHub Actions: install, typechecks, lint, tests, build, secret scan; fails on any error | done | `.github/workflows/ci.yml` — 8 gating steps, no `continue-on-error`. Lint was repaired from 3 errors to 0 so the gate can actually fail the build: `use-mobile.ts` rewritten on `useSyncExternalStore`, `carousel.tsx` cascading-render fixes (plus a leaked `reInit` listener), `sidebar.tsx` `Math.random()`-during-render replaced with a deterministic `useId()` hash |
| 5.4 | Report counts and real pass/fail output; no unmeasured coverage claims | done | `docs/PHASE_REPORTS_AR.md` + `docs/VERIFICATION.md`. Test count stated as **57** (2 files); no coverage percentage claimed because none was measured |

## Phase 6 — UX, accessibility, documentation

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| 6.1 | Arabic-first RTL + English toggle; new screens bilingual, responsive, keyboard-accessible, states, confirmations | partial | Not attempted for new screens (they do not exist). The rewritten helper is RTL-aware (`end-6`, logical padding), token-styled and keyboard-labelled (`aria-label` on controls) |
| 6.2 | Update README + ARCHITECTURE; add OWNER_GUIDE_AR and KNOWN_LIMITATIONS; never claim unfinished work is complete | done | `README.md`, `docs/ARCHITECTURE.md`, `docs/OWNER_GUIDE_AR.md`, `docs/KNOWN_LIMITATIONS.md` |
| 6.3 | Free data export/backup instruction | done | `docs/OWNER_GUIDE_AR.md` §5 |

## Final deliverable

| ID | Requirement | Status | Proof |
|----|-------------|--------|-------|
| F1 | Table of every item: status, files, proving command | done | This file |
| F2 | Real typecheck / lint / tests / build output | done | `docs/VERIFICATION.md` |
| F3 | Owner decisions list | done | `docs/OWNER_GUIDE_AR.md` §4 |
| F4 | Manual owner actions | done | `docs/OWNER_GUIDE_AR.md` §6, §7 |
| F5 | Remaining risks and unverified items stated directly | done | `docs/KNOWN_LIMITATIONS.md` |
