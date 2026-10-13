# Known limitations — IConcrete hardening v1

This file exists so nobody discovers a gap in production. Everything here is
either **not built**, **built but not wired**, or **not verified on this host**.
Nothing here is a guess: each line states how it was checked.

Last updated by the hardening-v1 pass. See `REQUIREMENTS.md` for the per-item
status table and `STATUS.md` for the baseline.

---

## 1. The Egyptian-code rule engine: verified logic, no screen yet

**Built and unit-tested** (`src/lib/quality/ecp203.ts` + `src/lib/exact.ts` +
`src/lib/quality/sampling.ts`, 39 of the 57 passing tests):

- the exact-arithmetic comparison layer (`src/lib/exact.ts`);
- R-PRE / R-FIN / R-SLUMP / R-CORE / R-EARLY / R-CS evaluation and the
  gating that refuses to judge without an approved, verified, in-force,
  fully-filled rule;
- the sampling plan and specimen scheduler (`src/lib/quality/sampling.ts`);
- the test vectors V1–V9 from the brief.

**Not built:** the Arabic rule-entry screen with the live preview calculation,
the approval action, and the wiring of the engine into the Quality screen. Today
`src/convex/quality.ts` stores `complianceStatus: "indicator_only"` on new rows —
it never asserts a code verdict. The `qualityRules` table exists with the right
shape and indexes, but nothing writes to it.

**Consequence:** no result in the running app currently reads «مطابق» or
«غير مطابق» against the code. That is the safe direction (no false compliance
claims), but it also means the feature is not usable until the screen exists.

**Also not built:** the seeded rules are never inserted into the database. They
live in `SEED_RULES` in code and must be loaded by the (unwritten) admin screen.

## 2. Branch isolation is enforced on the operational core only

Requirement 1.4 asked for per-user branch assignments enforced in **every** query
and mutation. That is not finished, but it is no longer true that nothing reads
the assignments.

**Enforced today** (`src/convex/branchScope.ts`, `requireBranchAccess` /
`mayUseBranch` on read *and* write):

| Module | Read | Create | Update | Delete |
|---|---|---|---|---|
| `production.ts` | ✔ scoped `list` | ✔ | ✔ + immutable branch | ✔ |
| `quality.ts` | ✔ scoped `overview` | ✔ | ✔ + immutable branch | ✔ |
| `inventory.ts` | ✔ scoped `overview` | ✔ material + movement | — | ✔ movement |

A record's branch is now immutable: moving a row between stations raises
`BRANCH_IMMUTABLE` (`assertBranchUnchanged`), tested.

**Still a UI filter, not enforced:** `imports.ts`, `sync.ts` `pull`,
`settings.ts`, `analytics.ts`, `forecast.ts`, and the token-based
`exportLayer.ts` (which is bounded by `ICONCRETE_EXPORT_BRANCHES` from phase 1.3
instead). **A member assigned to branch A can still reach branch B through those
paths** — most importantly through the Excel importer and the sync pull.

**There is no assignment screen yet.** No mutation writes a `userBranches` row,
so enforcement is currently **dormant**: `resolveBranchScope` always returns
`enforcementActive: false` because `assignmentCount` is 0. The gates are in place
and tested, but they only start working once an assignment-management mutation
exists. Until then, branch separation is still effectively a UI filter in
practice, even in the three modules above.

**Migration note.** Enforcement deliberately activates only once at least one
`userBranches` row exists anywhere. Before that, `resolveBranchScope` returns
`{ kind: "all", enforcementActive: false }` so a fresh deploy is not locked out
of its own data. The moment the owner makes the first assignment, every
non-owner is limited to their effective branches — including members who have no
assignment, who then see nothing. **Assign the whole team before, or at the same
time as, the first assignment.** Do not rely on branch separation for
confidentiality beyond the modules in the table above.

## 3. No four-eyes approval, no optimistic concurrency, no idempotency

- **Approval (4.3):** `BUSINESS_ERRORS` defines `APPROVAL_REQUIRED`,
  `SELF_APPROVAL_FORBIDDEN` and `APPROVAL_REASON_REQUIRED`, but there is **no**
  `approvalRequests` table and no approval flow. Sensitive actions are not gated.
- **Optimistic concurrency (4.2):** there is no `version` field on editable
  entities and no `expectedVersion` check. Concurrent edits of the same record
  still resolve last-write-wins.
- **Idempotency (4.1):** no `clientMutationId` storage. Replaying a queued write
  can duplicate a record. The offline queue does not yet protect against this.
- **Soft delete (4.4):** `materialMovements` still has a hard `removeMovement`
  mutation. `isDeleted` is not universal.

## 4. Commercial and financial core is not built

Requirement 3.1–3.6 asked for customers, projects, orders with lines, invoices
with lines, payments, integer minor units, VAT with snapshots, credit notes,
costing and credit limits.

**None of these tables or screens exist.** There is no `customers`, `orders`,
`invoices` or `payments` table, no VAT setting, and no general ledger. The only
money in the system is `pricePerM3`/`costPerM3` on a production entry, read from
the plant's `mixPrices` list.

**Practical consequence:** the system cannot raise an invoice, cannot take a
payment, and cannot compute VAT. It reports revenue, cost and margin per
production entry only. The 14% VAT default, the customer VAT-exempt flag and the
per-invoice VAT snapshot from the brief are **not implemented**.

## 5. Production → inventory is not linked

Requirement 2.5 asked that saving a production load create the theoretical
material issue in the same transaction, with a variance and a reason above a
tolerance. **This does not happen.** `production.ts` writes a production log and
`inventory.ts` writes movements independently; an operator can save a load
without any material being issued.

Also not built: negative-stock blocking, and compensating movements when a
production record is edited or deleted.

## 6. Inventory integrity is partial

- Movement kinds are still `receipt | issue | adjustment`. The brief asked for
  `opening_balance` (present as a field on `materials`, not as a movement),
  `wastage` and `returned_concrete`.
- Movements are **not append-only**: `removeMovement` hard-deletes.
- There is no reconciliation view and no automated
  `balance = Σ movements` invariant check in code.

## 7. Traceability is partial

- `qualityTests.productionLogId` is optional and not required for new rows.
- There is no `specimens` table, no specimen IDs, no curing records and no due
  dates stored (the scheduler computes them in memory; nothing persists them).
- There is no "Trace" screen and no non-conformity / complaint record.
- `ticketNo` is on the schema but no screen writes it.

## 8. Moisture correction is not built

No aggregate-moisture records and no advisory correction helper. Recipes are
manual mix designs; nothing adjusts for aggregate moisture.

## 9. Analytics honesty: partly addressed, not finished

- The maintenance module is meter-interval based. The Excel pack still contains
  assets named `ml_PredictiveMaintenance`, `Predictive_Maintenance_Alerts` and
  DAX measures such as `Predicted_Failure_Date` and
  `Failure_Risk_Exposure`. **These labels imply machine learning. There is no
  model.** The forecast screen's statistical model was not re-labelled or
  backtested in this pass.
- **Not verified:** any backtest error, any naive-baseline comparison, and the
  data-sufficiency warning. Do not quote a forecast accuracy figure.

## 10. Test coverage is real but narrow

- **57 unit tests pass** across 2 files, covering: exact decimal arithmetic, the
  rule gate, V1–V9, specimen basis (cube vs cylinder), the target-suggestion
  helper, the sampling plan/scheduler, and the branch-scope policy (effective-date
  boundaries, expiry, owner, un-migrated plant, immutable branch). Run:
  `bun run test`.
- **No integration tests.** There are no `convex-test` tests, so nothing checks
  the actual Convex functions against a real database. The "enumerate every
  public query and mutation and assert anonymous rejection" test from 1.1 is
  **not written** — the anonymous lockout is enforced in `access.ts` and verified
  by reading the code, not by a test.
- **No end-to-end scenario** (5.2). The full flow — mix design → price list →
  order → production → stock issue → specimens → cubes → trace → invoice → VAT →
  payment → balance — cannot be run because most of it does not exist.
- **No coverage measurement**, so no coverage number is claimed.

## 11. Not verified on this host

- **No screenshots.** The brief asked for before/after of the first screen at
  phone and desktop widths. This runtime has no browser automation, so **visual
  regression is unverified**. The palette is verified numerically
  (`docs/CONTRAST.md`, 62/62 pairs) but nobody has looked at a rendered pixel.
- **Contrast is only one part of WCAG.** Not measured: keyboard traversal,
  screen-reader labelling, `prefers-reduced-motion`, 200% zoom reflow, and
  touch-target size.
- **The desktop binary (.exe/.msi) was not built.** No Rust/Windows toolchain
  here. The Tauri configuration exists; the installer does not.
- **`git` is unavailable** on this host, so: no baseline commit hash, no
  `hardening-v1` branch, no `git rm --cached .env.keys`, and **no scan of git
  history for secrets**. The working-tree scan is clean (187 text files); history
  is unexamined.
- **Convex codegen needs credentials.** `bunx convex dev --once` succeeded here
  (functions ready), but on a fresh clone without Convex auth it will fail — that
  is the documented failure mode, not a code defect.

## 12. Platform-managed files that could not be edited

`src/convex/auth.ts` (and `auth.config.ts`, `auth/emailOtp.ts`) are read-only on
this platform. The Anonymous provider is still registered there, so the fix for
1.1 is enforcement, not removal: `convex/access.ts` rejects anonymous viewers with
`DEMO_MODE` off, and `permissions.can()` grants an anonymous viewer nothing.
Removing the provider from `auth.ts` would be a defence-in-depth improvement and
requires the owner to edit that file.

`vite.config.ts` is also platform-managed and was not touched. Note it does **not**
contain the `server.hmr: false` block the brief described; HMR is managed by the
platform.

## 13. What is genuinely safe to rely on today

- Sign-in with roles, and **no anonymous access** unless `DEMO_MODE` is on.
- Production entry priced only from the plant's own approved list; an unknown
  mix is refused (`UNKNOWN_MIX`) rather than guessed.
- A full audit trail: every create/update/delete/role-change with before/after.
- Excel import/export and CSV export with formula-injection guarding.
- The export HTTP layer: header-only token, constant-time compare, CORS
  allow-list, row limit, branch scope, 503 when unconfigured.
- The exact-arithmetic quality rule engine, as a library.
- A deterministic, CI-gated verification suite (secret scan, contrast, both
  typechecks, lint, unit tests, build).
