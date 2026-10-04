# IConcrete System — Architecture

This document explains how the pieces fit together for maintainers. For setup and
usage see the [README](../README.md).

## 1. High-level shape

```
Browser (React 19 + Vite)
   │  ConvexReactClient  (reactive queries + mutations)
   ▼
Convex deployment  ──►  queries / mutations  ──►  database (Convex tables)
                   ──►  actions ("use node") ──►  external APIs (Knock, VLY gateway)
                   ──►  http router           ──►  live CSV/JSON export layer
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
