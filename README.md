# IConcrete System

**Concrete Ready-Mix Manager** — a premium, RTL-first (Arabic/English) operations platform for ready-mix concrete plants.

IConcrete covers the full plant workflow: daily production and quantities, mix pricing and profitability, quality control, raw-material inventory, fleet and equipment with predictive maintenance, demand forecasting, audit trails, and a role-based team workspace. Excel import/export with live cloud sync is built in.

> واجهة عربية أولاً (RTL) مع تبديل كامل إلى الإنجليزية (LTR). الأرقام والعملات تُعرض بصيغة `ar-EG`/`en-GB` والأموال بالجنيه المصري (ج.م) والكميات بالمتر المكعب (م³).

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Getting started](#getting-started)
5. [Environment variables](#environment-variables)
6. [Available scripts](#available-scripts)
7. [Offline-first desktop app (Tauri + SQLite)](#offline-first-desktop-app-tauri--sqlite)
8. [Authentication & roles](#authentication--roles)
9. [Data & Excel workflow](#data--excel-workflow)
10. [Deployment notes](#deployment-notes)
11. [License](#license)

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Revenue, cost, margin, produced/delivered volumes with gradient charts, previous-window deltas, and quick actions. |
| **Production** | Shift-level production log (morning / evening / night) with mix design, client, site, truck capacity (9 m³), and delivery status. |
| **Quality** | Slump / temperature / cube-strength test records tied to production entries. |
| **Inventory** | Materials, stock movements, suppliers, and standard costs. |
| **Fleet & Maintenance** | Equipment registry, meter readings, daily usage, and predictive maintenance status. |
| **Forecasting** | De-seasonalised linear fit × weekday factor with backtested MAE/MAPE. |
| **Alerts** | Threshold-based alerts with optional Knock notification workflow. |
| **Excel Pack** | 47 tables / 509 columns / 54 DAX measures exported as a ready-to-use workbook, plus live CSV/JSON export layer. |
| **Excel Import** | Drag-and-drop `.xlsx` import with Arabic/Latin header aliases, per-row validation, preview, and server-side pricing. |
| **Section workbook** | `iConcrete_Template.xlsx` — ten Arabic sheets, one per app section, in the same order and with the same columns as the screens. Five sheets import back (materials, mixes, orders, stores, trucks & drivers); the rest are reports built from the same ledger. |
| **Offline-first** | Every write lands in a local SQLite database first, then syncs to Convex. Works with the network cable unplugged, with an Online/Offline indicator, a pending-changes queue and a «مزامنة آخر اليوم — Sync End of Day» button. |
| **Conflict handling** | Last-Write-Wins on timestamps; every overwritten value is written to the audit trail. |
| **Audit & Team** | Immutable audit log and role-based team management. |
| **Access control** | Server-enforced permissions; roles without `viewFinancials` never receive money fields (redacted server-side). |

---

## Tech stack

- **Runtime/tooling:** [Bun](https://bun.sh), Vite 7, TypeScript 5.9
- **UI:** React 19, React Router v7 (imports from `react-router`), Tailwind CSS v4, shadcn/ui, Lucide icons, Framer Motion, Recharts
- **Backend & database:** [Convex](https://convex.dev) (queries/mutations/actions, `src/convex/`)
- **Auth:** Convex Auth (`@convex-dev/auth`) — email OTP + anonymous sessions
- **Excel:** `xlsx` (SheetJS) for read/write, custom CSV/JSON export layer
- **Quality:** ESLint 9 + Prettier

---

## Project structure

```
.
├── src/
│   ├── components/          # App shell, shared UI, and shadcn/ui primitives (components/ui)
│   ├── convex/              # Convex backend: schema, queries, mutations, actions, http, crons
│   │   ├── _generated/      # Convex codegen — COMMITTED so a clean clone builds; regenerate with `convex dev --once`
│   │   ├── sync.ts          # Offline sync: `pull` (cloud → SQLite) and `reportConflicts`
│   │   ├── auth.config.ts   # READ ONLY — platform auth configuration
│   │   ├── auth.ts          # READ ONLY — Convex auth setup
│   │   └── auth/emailOtp.ts # READ ONLY — email OTP provider
│   ├── hooks/               # use-auth, use-access, use-branch, use-auto-seed, use-offline-sync
│   ├── lib/
│   │   ├── offline/         # schema.ts (SQLite mirror), db.ts (engine), syncService.ts (queue + syncAll)
│   │   ├── excelSections.ts # iConcrete_Template.xlsx — the 10 section sheets
│   │   └── ...              # i18n, formatting, concrete math, CSV, xlsx, zip, excelPack/*
│   ├── pages/               # Route screens (Landing, Auth, Dashboard, Production, SyncCenter, ...)
│   ├── types/               # Ambient type declarations
│   ├── index.css            # Tailwind v4 theme tokens & utilities (single source of colour truth)
│   └── main.tsx             # App entry: providers + router
├── src-tauri/               # Desktop shell (Tauri v2): config, Rust crate, capabilities, icons
├── public/                  # Static assets (logo, web manifest)
├── docs/                    # Architecture & data-model documentation
├── index.html               # HTML shell (lang/dir are set pre-paint from localStorage)
├── convex.json              # Convex functions directory config
├── vite.config.ts           # Vite config (do not modify HMR settings)
├── tsconfig*.json           # TypeScript project references
└── LICENSE                  # MIT
```

> **Convention:** all app code lives under `src/`. Convex imports use the `@/convex/...` alias; shared client code uses `@/...`.

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- A [Convex](https://convex.dev) account (a deployment is provisioned automatically in the hosted environment)

### Install

```bash
bun install
```

### Configure environment

Copy the example file and fill in your deployment values (see [Environment variables](#environment-variables)):

```bash
cp .env.example .env.local
```

`VITE_CONVEX_URL` is the only value the frontend strictly needs to boot; the rest are set on the Convex deployment.

### Run

```bash
# In one terminal: push Convex functions and keep codegen in sync
bunx convex dev

# In another terminal: start the Vite dev server
bun run dev
```

Then open the dev server URL (default `http://localhost:5173`). The hosted Freebuff environment runs both processes for you automatically.

---

## Environment variables

Variables consumed on the **client** (prefix `VITE_`) and on the **Convex deployment** are listed below. Never commit real values — `.gitignore` excludes `.env*` except `.env.example`.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | Client | Yes | Convex deployment URL used to create the Convex client. |
| `CONVEX_SITE_URL` | Convex | Yes | Public site URL used by Convex Auth. |
| `JWT_PRIVATE_KEY` / `JWKS` / `SITE_URL` | Convex | Yes (auth) | Convex Auth signing keys and site URL. |
| `VLY_CONVEX_AUTH_ISSUER` | Client | No | Auth issuer override (defaults to `https://freebuff.com`). |
| `ICONCRETE_EXPORT_TOKEN` | Convex | No | Shared token for the live CSV/JSON export HTTP endpoint. **Header `x-iconcrete-token` only** — a `?token=` query parameter is deliberately refused. Returns `503` when unset. |
| `ICONCRETE_CORS_ORIGINS` | Convex | No | Comma-separated allow-list of origins for the export endpoint. **Unset means no cross-origin access at all** — there is no wildcard. |
| `ICONCRETE_EXPORT_BRANCHES` | Convex | No | Comma-separated branch *codes* the export token may read. Unset means every branch. |
| `DEMO_MODE` | Convex | No | `true` on a throwaway demo deployment only: anonymous visitors become read-only. **Leave unset on a live plant** — with it unset, anonymous access is rejected everywhere and the guest button is hidden. |
| `KNOCK_API_KEY` | Convex | No | Knock API key for threshold alert notifications. |
| `KNOCK_ALERT_WORKFLOW` | Convex | No | Knock workflow key used when dispatching alerts. |
| `KNOCK_API_BASE` | Convex | No | Knock API base URL override. |
| `VLY_INTEGRATION_KEY` | Convex | No | VLY integration gateway key (AI/email/payments). |
| `VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL` | Client | No | VLY app identity and monitoring endpoint. |
| `VLY_APP_NAME` | Convex | No | Display name used in auth email content. |

Secrets are managed through the project's Keys/API-keys UI in the hosted environment; do not edit `.env` files by hand there.

---

## Available scripts

| Script | Command | Description |
| --- | --- | --- |
| `bun run dev` | `vite` | Start the dev server. |
| `bun run build` | `tsc -b && vite build` | Type-check and build for production into `dist/`. |
| `bun run typecheck` | `tsc -b --noEmit` | Type-check the client project. |
| `bun run typecheck:convex` | `tsc -p src/convex/tsconfig.json --noEmit` | Type-check the Convex functions. |
| `bun run lint` | `eslint .` | Lint the project. Exits non-zero on any error. |
| `bun run test` | `vitest run` | Unit tests (**57 passing**: the ECP 203 rule engine, V1–V9, exact arithmetic, sampling, and the branch-scope policy). Never put a `.test.ts` under `src/convex/` — that directory is bundled and deployed. |
| `bun run test:watch` | `vitest` | Unit tests in watch mode. |
| `bun run check:secrets` | `node scripts/secret-scan.mjs --self-test && node scripts/secret-scan.mjs` | Self-test the scanner's rules, then scan the working tree for committed credentials. Exits non-zero on a finding. |
| `bun run check:contrast` | `node scripts/contrast-check.mjs` | Measure every design-token pair against its WCAG AA target; exits non-zero on a regression. |
| `bun run format` | `prettier --write .` | Format the project. |
| `bun run preview` | `vite preview` | Preview the production build. |
| `bun run vercel-build` | `bash scripts/vercel-build.sh` | The entrypoint Vercel runs. Production pushes the Convex functions first, then builds against that deployment; Preview/other builds the frontend only and never deploys Convex. |
| `bun run tauri` | `tauri` | Tauri CLI (`bun run tauri build`, `bun run tauri dev`). |
| `bun run desktop:dev` | `tauri dev` | Run the desktop app against the Vite dev server. |
| `bun run desktop:build` | `tauri build` | Build the desktop installers (`.exe` / `.msi` on Windows). |

> **Convex codegen:** after editing anything in `src/convex/`, run `bunx convex dev --once` to regenerate `src/convex/_generated/` before type-checking. Never hand-edit generated files — and never commit a hand-written replacement for them.

---

## Deployment

Vercel builds the frontend; Convex functions and the schema are pushed by the
Convex CLI and are **not** deployed by Vercel by default. `vercel.json` routes
the Vercel build through `scripts/vercel-build.sh`, which deploys Convex only
when `VERCEL_ENV=production` and otherwise builds the frontend against staging.
Never run `convex deploy` by hand against production — the owner promotes a
change by merging a reviewed pull request into `main`.

Environments, the exact Vercel settings, which variable belongs to which scope,
the release checklist, rollback and the owner's manual steps are in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The merge checklist is
`.github/pull_request_template.md`.

---

## Offline-first desktop app (Tauri + SQLite)

The same React bundle powers the Vercel deployment and the Windows desktop app, and both share the same Convex backend through `VITE_CONVEX_URL`. The desktop build adds one thing: a local SQLite database (`iconcrete.db`) that keeps the plant running with no internet.

```bash
bun install
bun run desktop:dev            # develop the desktop shell
bun run tauri build            # produce .exe / .msi installers (Windows)
```

Building installers requires the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the target OS (Rust toolchain, plus the WebView2 / WebKit runtime).

### How a write travels

```
UI action ──► SQLite (local row, _dirty = 1) ──► sync_queue (status = pending)
                                                     │
                        online?  ──► push through the normal Convex mutation ──► mark synced
                        offline? ──► stays pending until «مزامنة آخر اليوم»
```

- `src/lib/offline/schema.ts` — the SQLite mirror. Every mirrored table keeps the **exact same field names** as `src/convex/schema.ts`, plus `_creationTime`, `_updatedAt`, `_dirty`, `_deleted` and `_syncedAt`.
- `src/lib/offline/db.ts` — one API, two engines: real SQLite via `@tauri-apps/plugin-sql` on the desktop, and an in-memory + `localStorage` mirror in the browser, so the deployed web app behaves identically.
- `src/lib/offline/syncService.ts` — `sync_queue`, `writeLocalFirst`, `flushPending`, `pullAndMerge` and `syncAll`. Pushes reuse the plant's own mutations, so validation, pricing and auditing are never bypassed.
- `src/convex/sync.ts` — `pull` (cloud state of every mirrored table, with money redacted for roles without `viewFinancials`) and `reportConflicts` (Last-Write-Wins decisions written to `auditLogs`).
- `/sync` — the sync centre: connection state, storage engine, pending queue and the button.

**Sync order matters:** `syncAll()` merges first (so a stale local edit can never overwrite newer cloud data), then pushes everything still pending. Conflicts are resolved Last-Write-Wins on timestamps and logged.

---

## Authentication & roles

- Auth is fully wired through Convex Auth. **Do not modify** `src/convex/auth.config.ts`, `src/convex/auth.ts`, or `src/convex/auth/emailOtp.ts`.
- The first real email account becomes the **owner**; subsequent accounts get assigned roles by an owner/admin.
- Guests (anonymous sessions) receive the working `GUEST_ROLE` (`manager`) with a limited capability set so the app is fully explorable in demo mode.
- Protected routes use the `RequireAuth` wrapper, which sends signed-out users to `/auth?returnTo=<path>` and restores their destination after sign-in.
- Financial fields are redacted **server-side** for any role lacking the `viewFinancials` capability (see `src/convex/production.ts` and `src/convex/imports.ts`).

---

## Data & Excel workflow

- **Section workbook (`iConcrete_Template.xlsx`):** ten Arabic sheets in app order — `العملاء` · `الموردين` · `المواد` · `الخلطات` · `الطلبيات` · `الانتاج اليومي` · `الفواتير` · `المخازن` · `المصروفات` · `الشاحنات والسائقين` — each with the same columns the screen shows, plus a `دليل الأعمدة` guide and a `المزامنة` sheet. Download the empty template or export the plant's live figures into the same layout from `/import`.
- **Two-way sync:** the importable sheets (`المواد`, `الخلطات`, `الطلبيات`, `المخازن`, `الشاحنات والسائقين`) go Excel → SQLite → Convex through the same local-first queue, so an uploaded file is never lost if the machine is offline. The remaining sheets (`العملاء`, `الموردين`, `الانتاج اليومي`, `الفواتير`, `المصروفات`) are reports computed from the same ledger, so they can never disagree with the screens.
- **Export:** the Excel Pack page generates a multi-sheet workbook (tables, columns, DAX measures). The live export layer serves CSV/JSON over Convex HTTP and requires `ICONCRETE_EXPORT_TOKEN`.
- **Quick import:** `/import` also accepts a plain production file, maps Arabic/English headers, validates each row, shows a preview with issues, and commits valid rows with server-side pricing and audit entries.
- **Demo data:** the app auto-seeds a realistic demo dataset once per session when the database is empty and the viewer can `manageTestData`; test records are flagged from `Test_Data_Flag` and can be cleared via `production.clearTestData`.

---

## Deployment notes

- The app is a static SPA (`dist/`) plus a Convex backend. `main.ts` contains an optional Deno/Hono static server for self-hosting the built SPA.
- **Vercel:** set `VITE_CONVEX_URL` in the project's environment variables (Build & Development). Without it the bundle boots against an empty client and every table looks empty. `src/convex/_generated/` is committed, so the build does not need Convex credentials to type-check.
- **Desktop:** the Tauri build produces the same `dist/` inside a native shell and shares the same Convex deployment, so web and desktop users see the same data.
- Do not remove the GitHub → Vercel auto-deploy integration; pushing to the default branch is the release mechanism for the web build.
- Do not change the HMR settings in `vite.config.ts`; the hosted runtime requires them as configured.
- Keep an eye on the `dist/assets/chart-*` and `index-*` chunks when adding large dependencies — the build warns above 500 kB.

---

## License

Released under the [MIT License](./LICENSE).
