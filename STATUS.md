# STATUS — IConcrete hardening v1

> Resume file. Read this first if the session ends.

## Baseline

| Item | Value |
|------|-------|
| Project root | `/home/daytona/codebase` (Vly-synced Freebuff browser runtime) |
| Baseline branch | **BLOCKED** — `git rev-parse --abbrev-ref HEAD` refused: *"Git and GitHub commands are blocked; Vly manages version control."* |
| Baseline commit | **BLOCKED** — same reason; no hash is obtainable from this host |
| Working branch `hardening-v1` | **BLOCKED** — cannot create a local branch. Version control is platform-managed. |
| Baseline condition (recorded by reading, before any edit) | `concrete/pricing.ts` silently priced an unknown mix as C30/37 (`list[2]`); `permissions.ts` granted anonymous the manager capability set; `http.ts` accepted the export token from `?token=` with `Access-Control-Allow-Origin: *`; `quality.ts` derived the test target from the mix name ("C30/37" → 30, the cylinder value) and applied a 7-day = 70% rule; `carousel.tsx`/`sidebar.tsx`/`use-mobile.ts` had 3 eslint errors |
| Baseline checks | `typecheck` 0 · `typecheck:convex` 0 · `lint` 1 (3 errors, 18 warnings) · `build` 0 |

## Current phase

All phases attempted. Phase 5 (tests/CI) is partial; phases 3 and 4 are not
implemented beyond the error-code catalogue; Phase 2.4–2.8 are not implemented.
Per-item status and proof: `REQUIREMENTS.md`. What is missing and why:
`docs/KNOWN_LIMITATIONS.md`.

## Last completed step

Final verification sweep, all green:

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
