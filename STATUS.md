# STATUS — IConcrete hardening v1

> Resume file. Read this first if the session ends.

## Baseline

| Item | Value |
|------|-------|
| Project root | `/home/daytona/codebase` (Vly-synced Freebuff browser runtime) |
| Git remote | `github` → `https://github.com/ahmedelkashash7/iconcrete` (public). Read from `.git/config`, not from a git command: the CLI refuses to run here. |
| Baseline branch | `main` (`.git/HEAD` → `refs/heads/main`) |
| Baseline commit | `184ae02f9311f920d436b4419c81959f6e238e90` — "Freebuff: ROLE", 2026-10-13T01:34:36Z. Confirmed identical on GitHub via the API. |
| Working branch `hardening-v1` | **DOES NOT EXIST** — not locally and not on GitHub. The platform commits and pushes **straight to `main`** (`freebuff-web[bot]`), so the hardening work is already on `main`. Owner action required; see `docs/DEPLOYMENT.md` §9. |
| Unpushed commits | None. Local `main` and the remote-tracking `github/main` are both `184ae02f`, and the working tree matches that commit (no modified, no deleted, no untracked source files). |
| CI on the delivered commit | `.github/workflows/ci.yml` run #1 on `main` @ `184ae02f`: **success** (2026-10-13T01:34:44Z → 01:35:22Z). |
| Convex deployments reached | **Dev only** — `freebuff:e7b49ee3-…:dev/vly-dev-service-account` → `https://famous-owl-975.convex.cloud`. `convex deploy` has never been run from here. |
| Baseline condition (recorded by reading, before any edit) | `concrete/pricing.ts` silently priced an unknown mix as C30/37 (`list[2]`); `permissions.ts` granted anonymous the manager capability set; `http.ts` accepted the export token from `?token=` with `Access-Control-Allow-Origin: *`; `quality.ts` derived the test target from the mix name ("C30/37" → 30, the cylinder value) and applied a 7-day = 70% rule; `carousel.tsx`/`sidebar.tsx`/`use-mobile.ts` had 3 eslint errors |
| Baseline checks | `typecheck` 0 · `typecheck:convex` 0 · `lint` 1 (3 errors, 18 warnings) · `build` 0 |

## Current phase

All phases attempted. Phase 5 (tests/CI) is partial; phases 3 and 4 are not
implemented beyond the error-code catalogue; Phase 2.4–2.8 are not implemented.
Per-item status and proof: `REQUIREMENTS.md`. What is missing and why:
`docs/KNOWN_LIMITATIONS.md`.

## Last completed step

**Phase A — deployment reality check (2026-10-13).** Git could not be used, so
the state was established by reading `.git/` on disk and the public GitHub API:
the repo is `ahmedelkashash7/iconcrete`, `main` = `184ae02f` ("Freebuff: ROLE",
pushed by `freebuff-web[bot]`, CI green), there are **no unpushed commits**, no
`hardening-v1` branch exists anywhere, and the hardening work is already on
`main`. Added `scripts/vercel-build.sh`, `vercel.json`,
`.github/pull_request_template.md` and `docs/DEPLOYMENT.md`. Full detail and the
list of what could not be verified: `docs/DEPLOYMENT.md` §3 and §12.

Before that, final verification sweep of the hardening code, all green:

```
convex dev --once   exit=0   ✔ Convex functions ready!
typecheck           exit=0
typecheck:convex    exit=0
lint                exit=0   18 problems (0 errors, 18 warnings)
test                exit=0   Tests 57 passed (57)   [2 files]
check:secrets       exit=0   no committed credentials found (187 files)
check:contrast      exit=0   62/62 required pairs pass
build               exit=0   ✓ built in 12.06s
```

Full log: `docs/VERIFICATION.md`. Arabic report: `docs/PHASE_REPORTS_AR.md`.

## Next step (highest value first)

1. **2.2 rule-entry screen** — the engine is tested but unreachable. Build the
   Arabic rule screen (explanation line per field + preview calculation) and the
   approval mutation that writes `qualityRules`, then wire `evaluateTest` into
   the Quality screen so a verdict can appear and be traced to a clause.
2. **1.4 branch isolation (partly done)** — the scope module, the gates and 18
   tests exist, and production/quality/inventory enforce them on read and write.
   Still to wire: `imports.ts`, `sync.ts` pull, `settings.ts`, `analytics.ts`,
   `forecast.ts`, and an assignment-management screen (nothing can create a
   `userBranches` row yet, so enforcement is currently dormant).
3. **3.1–3.4 commercial core** — customers, orders, invoices, payments, VAT
   snapshots. Nothing financial beyond the production ledger exists today.
4. **5.1 `convex-test`** — install it and write the anonymous-enumeration,
   permission-matrix and branch-isolation tests that currently do not exist.

## Files in flight

Documentation only: `README.md`, `docs/ARCHITECTURE.md`,
`docs/OWNER_GUIDE_AR.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/CONTRAST.md`,
`docs/VERIFICATION.md`, `docs/PHASE_REPORTS_AR.md`, plus `REQUIREMENTS.md`,
`STATUS.md`, `CHANGELOG.md`.
