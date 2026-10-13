# Verification log — IConcrete hardening v1

Every line below is a **real command and its real output** on this host, run
against the final state of the files. Nothing is inferred.

Host: `/home/daytona/codebase` (Vly/Freebuff browser runtime, Linux).
`git` is unavailable on this host — see `STATUS.md` → Baseline.

---

## Final sweep (after the last source change)

```
=== convex dev --once ===
✔ 01:08:44 Convex functions ready! (6.89s)
exit=0

=== typecheck (client) ===
$ tsc -b --noEmit
exit=0

=== typecheck (convex) ===
$ tsc -p src/convex/tsconfig.json --noEmit
exit=0

=== lint ===
✖ 18 problems (0 errors, 18 warnings)
exit=0

=== tests ===
 Test Files  2 passed (2)
      Tests  57 passed (57)
exit=0

=== secret scan ===
Secret-scan self-test: 11 must-flag + 5 must-pass samples all correct.
Secret scan: no committed credentials found.
Scanned 187 text files (working tree; history not scanned).
exit=0

=== contrast ===
62/62 required pairs meet their WCAG AA target.
exit=0

=== build ===
✓ built in 12.06s
exit=0
```

Commands (from `package.json`):

| Check | Command |
|---|---|
| Convex codegen + deploy | `bunx convex dev --once` |
| Client types | `bun run typecheck` → `tsc -b --noEmit` |
| Convex types | `bun run typecheck:convex` → `tsc -p src/convex/tsconfig.json --noEmit` |
| Lint | `bun run lint` → `eslint .` |
| Unit tests | `bun run test` → `vitest run` |
| Secret scan | `bun run check:secrets` |
| Contrast | `bun run check:contrast` |
| Bundle | `bun run build` → `tsc -b && vite build` |

---

## Schema changes applied to the deployment

`bunx convex dev --once` reported the new indexes as added (the tables
themselves were created and are non-destructive — every new field is optional,
`schemaValidation` is `false`, and no existing column, table or row was changed):

```
✔ Added table indexes:
  [+] qualityRules.by_ruleKey   ruleKey, _creationTime
  [+] qualityRules.by_testType   testType, _creationTime
  [+] userBranches.by_branch   branchId, _creationTime
  [+] userBranches.by_user   userId, _creationTime
✔ Convex functions ready! (6.72s)
```

---

## Defects found and fixed by running the checks

Each of these was caught by a check, not by reading code, and each fix was
re-verified by re-running the same check.

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | `vitest` (V5) | The R-FIN share comparison mixed unit scales: `toUnits(5)` (5 000 000 micro-units) was compared against `below × 100`, so **7.5% of 40 results was reported as "within 5%"** — a failing batch would have passed the final evaluation. | Added `shareExceeds()` to `src/lib/exact.ts`, which cross-multiplies so the scale cancels. Re-run: V5 passes. |
| 2 | `vitest` (V7) | A single unreadable parameter (`toleranceAbove80Mm = null`) blocked **all** slump evaluation, so the well-defined <80 mm band could never be judged. | Made `ruleBlockers`/`isRuleUsable` path-aware (`requiredParams`), and added `canApproveRule()` so a rule with any empty parameter still cannot be approved. Re-run: V7's three cases pass. |
| 3 | `vitest` (dispatcher) | `evaluateCube28Preliminary` passed an already-scaled `bigint` back into `toUnits()`, throwing `value.trim is not a function`. | Sum the preceding values separately: `sum(preceding.map(toUnits)) + latest`. |
| 4 | `vitest` (exact arithmetic) | The assertion itself was wrong: `toUnits("0.30000000000000004")` correctly rounds to `0.3`, so it cannot be used to prove the float defect. | Assert the real defect instead: `0.1 + 0.2 === 0.3` is `false` in IEEE-754, while `toUnits(0.1) + toUnits(0.2) === toUnits(0.3)` is `true`. |
| 5 | `node scripts/contrast-check.mjs` | 10 of 35 token pairs failed WCAG AA: brand text 2.17:1, success text 3.29:1, input boundary 1.40:1, focus ring 2.98:1, dark destructive label 3.25:1, print border 2.50:1. | Re-derived the palette in `src/index.css` from measured candidates; dark-mode destructive uses the `dark:bg-destructive/60` overlay the button already applies. Re-run: **62/62 pass**, with two decorative hairlines reported as exempt and justified. |
| 6 | `node scripts/secret-scan.mjs --self-test` | The Google-API-key fixture was 34 characters after `AIza` instead of 35, so the rule never matched it — the self-test caught its own bad fixture. | Corrected the fixture length. Re-run: 11 must-flag + 5 must-pass all correct. |
| 7 | `bun run lint` | 3 pre-existing errors made `eslint` exit 1, which would have made the CI gate useless. | Fixed the causes (not suppressed): `use-mobile.ts` → `useSyncExternalStore`; `carousel.tsx` → microtask-deferred state sync and a properly detached `reInit` listener; `sidebar.tsx` → deterministic `useId()`-derived width instead of `Math.random()` during render. Re-run: `0 errors, 18 warnings`, exit 0. |
| 8 | `bun run typecheck` | `OcrConfidence` did not include `"low"`, which R-PRE's condition (b) parameter needs. | Added `"low"` to the union. |

---

## What could NOT be run here

| Check | Why | Consequence |
|---|---|---|
| `git diff` / `git log` / branch creation / `git rm --cached` | The platform refuses git commands ("Vly manages version control"). | No baseline hash, no `hardening-v1` branch, no history secret scan, `.env.keys` not removed from the index. |
| Reading `.env.keys`, `.env.local`, `.env.example` | "Direct env and sensitive-file access is blocked." | The working tree shows no `.env.keys`; its committed content could not be inspected, so the rotation list is written on the assumption that any dotenvx private key that was ever committed is compromised. |
| Building the Tauri `.exe` / `.msi` | No Rust/Windows toolchain on this Linux runtime. | The desktop installer does not exist yet. |
| Screenshots at phone/desktop widths | No browser automation available. | Visual regression is unverified; only the numeric contrast check exists. |
| `convex-test` integration suite, end-to-end scenario | Not installed / blocked by missing phases | No Convex function is exercised against a database; see `REQUIREMENTS.md` 5.1/5.2. |
