# IConcrete System — Architecture

This document explains how the pieces fit together for maintainers. For setup and
usage see the [README](../README.md).

> **Hardening v1 (current pass).** Five rules now hold across the codebase, and
> breaking one of them is a defect:
>
> 1. **No invented limits.** A quality result is compared with a limit only when
>    an approved, engineer-verified, in-force rule supplies it. Otherwise the
>    badge reads «بدون كود معتمد – مؤشر فقط» and no pass/fail appears
>    (`src/lib/quality/ecp203.ts`).
> 2. **No parsing a mix name for compliance.** The cube target is the explicit
>    `targetCubeMpa`; "C30/37"'s first number is a *cylinder* strength. See the
>    archived `testTargetValue`/`cubeTargetValue`/`strengthFromName` helpers noted
>    in `src/lib/concrete.ts`.
> 3. **No silent price.** `standardPricing` throws `UNKNOWN_MIX` rather than
>    falling back to another grade (`src/convex/pricing.ts`).
> 4. **No floating point at a boundary.** Comparisons and share tests go through
>    `src/lib/exact.ts` (bigint micro-units parsed from decimal text).
> 5. **No anonymous access.** `DEMO_MODE` is off unless explicitly enabled, and
>    `requireViewer` rejects an anonymous viewer regardless of the UI
>    (`src/convex/demoMode.ts`, `access.ts`, `permissions.ts`).
>
> Every check that enforces this runs in CI — see `.github/workflows/ci.yml` —
> and the measured evidence is in `docs/VERIFICATION.md` and `docs/CONTRAST.md`.
> What is **not** built yet is listed in `docs/KNOWN_LIMITATIONS.md`.

## 1. High-level shape

```
Browser (React 19 + Vite)
   │  ConvexReactClient  (reactive queries + mutations)
   ▼
Convex deployment  ──►  queries / mutations  ──►  database (Convex tables)
                   ──►  actions ("use node") ──►  external APIs (Knock, VLY gateway)
                   ──►  http router           ──►  live CSV/JSON export layer
                          (header-only token, constant-time compare,
                           CORS allow-list, branch scope, CSV injection guard)

Pure domain libraries (no Convex, no React — unit-tested by `bun run test`)
  src/lib/exact.ts             exact decimal arithmetic (bigint micro-units)
  src/lib/quality/ecp203.ts    ECP 203-2007 rule engine + gating + seed rules
  src/lib/quality/sampling.ts  sampling plan and specimen scheduler
  src/lib/errors.ts            business error codes + Arabic resolution text
  src/convex/pricing.ts        approved-mix pricing (throws UNKNOWN_MIX)
```

- **Frontend** is a single-page app. Routes are declared in `src/main.tsx`;
  screens live in `src/pages/`; reusable UI lives in `src/components/`
  (shadcn/ui primitives in `src/components/ui/`).
- **Backend** is Convex. `src/convex/schema.ts` defines all tables; each domain
  file (`production.ts`, `quality.ts`, `inventory.ts`, `forecast.ts`, ...) exposes
  its own queries and mutations. External calls use actions with `"use node"`.
- **Auth** is Convex Auth. The three auth files are platform-managed and read-only.

## 2. Request & data flow

1. A component calls `useQuery(api.<domain>.<fn>, args)`. Convex keeps the result
   live — the UI re-renders automatically when underlying data changes, so server
   state is not duplicated into client state.
2. Writes go through `useMutation(api.<domain>.<fn>, args)`. Mutations validate
   input, enforce permissions, price rows where relevant, write the document, and
   append an audit entry.
3. Actions handle anything needing external network access (e.g. dispatching
   threshold alerts through Knock).

## 3. Access control

- `src/convex/permissions.ts` defines roles, capabilities, and the `can()` helper.
- `GUEST_ROLE` / `GUEST_CAPABILITIES` grant anonymous visitors a safe, explorable
  read/write subset (currently `manager`).
- Every financial field is redacted server-side for roles lacking
  `viewFinancials` — redaction happens in the backend, never only in the UI.
- The frontend mirrors permissions via `src/hooks/use-access.ts` for affordances
  only; the server remains authoritative.

## 4. Domain model (Convex tables)

| Table | Purpose | Key relations |
| --- | --- | --- |
| `branches` | Plant locations. | parent of most records via `branchId` |
| `mixDesigns` | Concrete mix grades and reference prices. | referenced by production logs |
| `productionLogs` | One record per load/entry: date, shift, mix, quantity (m³), client, site, truck, status, pricing. | → `branches`, `mixDesigns` |
| `qualityTests` | Slump / temperature / strength results. | → `productionLogs` |
| `materials` | Raw materials with standard cost and supplier. | referenced by movements |
| `inventoryMovements` | Stock in/out with reference. | → `materials` |
| `equipment` | Fleet & machines with meter readings. | referenced by maintenance |
| `maintenanceRecords` | Service history and predictive status. | → `equipment` |
| `alerts` | Threshold rules and their notification config. | → `branches` |
| `auditLog` | Immutable trail of create/update/delete actions. | → user |
| `users` | App users, roles, and capability overrides. | auth identities |
| `settings` | Organization-level configuration and scope. | singleton-ish |

Quantities are cubic metres (m³); money is EGP (ج.م). Test/demo rows are flagged
with `isTestData` (sourced from `Test_Data_Flag`) so they can be cleared in bulk.

## 5. Derived analytics

- `src/convex/measures.ts` — shared helpers (`enrichLog`, `summarize`,
  `accumulate`, deterministic `mulberry32`, `weekdayIndex`, `MAX_ROWS`).
- `src/convex/analytics.ts` — `overview` dashboard aggregation with previous-window
  deltas and role-based redaction.
- `src/convex/forecast.ts` — de-seasonalised linear fit multiplied by a weekday
  factor, with backtested MAE/MAPE and maintenance-status prediction.
- `src/convex/imports.ts` — server-side validation and pricing for Excel imports.

These modules are reviewed and internally consistent; ratios, margins, and
forecast formulas were verified during the final review.

## 5b. Offline-first layer (desktop + web)

```
React screen ──► writeLocalFirst()
                     │
                     ├──► local DB (SQLite on desktop / memory+localStorage on web)
                     └──► sync_queue (pending)
                              │
              online  ──► flushPending() → existing Convex mutation → synced
              offline ──► stays pending until «مزامنة آخر اليوم»
```

| File | Responsibility |
| --- | --- |
| `src/lib/offline/schema.ts` | SQLite DDL mirroring `src/convex/schema.ts` with identical field names, plus `sync_queue` and `local_meta`. Tables flagged `localOnly` (`customers`, `suppliers`, `batches`, `invoices`, `expenses`, `warehouses`, `inventory`, `maintenanceRecords`) are stored on the device but have **no Convex counterpart yet**, so they are neither pushed nor pulled — their Excel sheets are aggregates of the real ledger. |
| `src/lib/offline/db.ts` | `LocalDb` adapter — `@tauri-apps/plugin-sql` on desktop, memory + `localStorage` in the browser. |
| `src/lib/offline/syncService.ts` | Queue, `writeLocalFirst`, `flushPending`, `pullAndMerge`, `syncAll` (merge → push), `probeCloud`. |
| `src/convex/sync.ts` | `pull` (cloud → client, money redacted by capability) and `reportConflicts` (LWW decisions → `auditLogs`). |
| `src/hooks/use-offline-sync.ts` | Connection, queue depth, last-sync timestamp and the sync action. |
| `src/components/SyncStatus.tsx` | Header indicator + «مزامنة آخر اليوم» button. |
| `src/pages/SyncCenter.tsx` | `/sync` — queue view, local mirror counts, engine and flow documentation. |

**Conflict rule:** Last-Write-Wins on `_updatedAt` (falling back to `_creationTime`). A dirty local row older than the cloud copy is dropped from the queue and the cloud value is kept; otherwise the local value is pushed. Both outcomes are written to `auditLogs`.

**Guarantee preserved:** the queue never writes to Convex directly. It replays the same guarded mutations the screens use (`production.create`, `inventory.createMaterial`, `settings.upsertMix`, `forecast.createEquipment`, …), so pricing, capability checks and audit entries apply identically offline and online.

---

## 5c. Section workbook (`iConcrete_Template.xlsx`)

`src/lib/excelSections.ts` is the single definition of the workbook: ten Arabic sheets in app order, each with the same column order as its screen. `buildIconcreteWorkbook(data)` builds it (empty template or live figures), `parseIconcreteWorkbook(file)` reads it back section by section.

| Sheet | App route | Source | Direction |
| --- | --- | --- | --- |
| `العملاء` | `/dashboard` | aggregate of `productionLogs` | export |
| `الموردين` | `/inventory` | `materials.supplier` + receipts | export |
| `المواد` | `/inventory` | `materials` | both |
| `الخلطات` | `/settings` | `mixPrices` | both |
| `الطلبيات` | `/production` | `productionLogs` | both |
| `الانتاج اليومي` | `/production` | aggregate by date + shift | export |
| `الفواتير` | `/dashboard` | aggregate by customer + month (VAT 14 %) | export |
| `المخازن` | `/inventory` | `materialMovements` (material resolved by name) | both |
| `المصروفات` | `/dashboard` | valued receipts | export |
| `الشاحنات والسائقين` | `/forecast` | `equipment` + driver fields | both |

---

## 6. Internationalisation

- `src/lib/i18n.tsx` provides `LanguageProvider` and `useI18n()`
  (`lang`, `dir`, `isRTL`, `setLang`, `toggle`, `t`, `pick`). The choice is stored
  in `localStorage["iconcrete.lang"]` and applied to `<html lang/dir>`.
- `index.html` reads that key before first paint to avoid a layout flash.
- The app shell, landing page, and auth screen are fully bilingual; operational
  pages are Arabic-first with English chrome.

## 7. Styling

- Tailwind CSS v4. The single source of colour truth is `src/index.css`
  (oklch tokens: `--brand` amber, `--success`, `--warning`, `--destructive`,
  `--chart-1..5`, plus `soft-card`, `bp-grid`, `no-scrollbar` utilities).
- Design rules: mobile responsive, no nested cards, no shadows, thin borders,
  `cursor-pointer` on interactive elements, `tracking-tight font-bold` titles,
  Framer Motion for animation, Sonner for toasts, dialogs preferred over pages,
  Loader2 instead of skeletons.

## 8. Read-only platform files

The following are managed by the hosting platform and must not be edited:
`src/convex/auth.config.ts`, `src/convex/auth.ts`, `src/convex/auth/emailOtp.ts`,
`vly-toolbar-readonly.tsx`, and the `server.hmr` block in `vite.config.ts`.
