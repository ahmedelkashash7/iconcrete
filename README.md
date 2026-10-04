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
7. [Authentication & roles](#authentication--roles)
8. [Data & Excel workflow](#data--excel-workflow)
9. [Deployment notes](#deployment-notes)
10. [License](#license)

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
│   │   ├── _generated/      # Convex codegen (git-ignored, regenerate with `convex dev`)
│   │   ├── auth.config.ts   # READ ONLY — platform auth configuration
│   │   ├── auth.ts          # READ ONLY — Convex auth setup
│   │   └── auth/emailOtp.ts # READ ONLY — email OTP provider
│   ├── hooks/               # use-auth, use-access, use-branch, use-auto-seed, use-mobile
│   ├── lib/                 # i18n, formatting, concrete math, CSV, xlsx, zip, excelPack/*
│   ├── pages/               # Route screens (Landing, Auth, Dashboard, Production, ...)
│   ├── types/               # Ambient type declarations
│   ├── index.css            # Tailwind v4 theme tokens & utilities (single source of colour truth)
│   └── main.tsx             # App entry: providers + router
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
| `ICONCRETE_EXPORT_TOKEN` | Convex | No | Bearer token for the live CSV/JSON export HTTP endpoint; endpoint returns `503` when unset. |
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
| `bun run typecheck` | `tsc -b --noEmit` | Type-check only. |
| `bun run lint` | `eslint .` | Lint the project. |
| `bun run format` | `prettier --write .` | Format the project. |
| `bun run preview` | `vite preview` | Preview the production build. |

> **Convex codegen:** after editing anything in `src/convex/`, run `bunx convex dev --once` to regenerate `src/convex/_generated/` before type-checking. Never hand-edit generated files.

---

## Authentication & roles

- Auth is fully wired through Convex Auth. **Do not modify** `src/convex/auth.config.ts`, `src/convex/auth.ts`, or `src/convex/auth/emailOtp.ts`.
- The first real email account becomes the **owner**; subsequent accounts get assigned roles by an owner/admin.
- Guests (anonymous sessions) receive the working `GUEST_ROLE` (`manager`) with a limited capability set so the app is fully explorable in demo mode.
- Protected routes use the `RequireAuth` wrapper, which sends signed-out users to `/auth?returnTo=<path>` and restores their destination after sign-in.
- Financial fields are redacted **server-side** for any role lacking the `viewFinancials` capability (see `src/convex/production.ts` and `src/convex/imports.ts`).

---

## Data & Excel workflow

- **Export:** the Excel Pack page generates a multi-sheet workbook (tables, columns, DAX measures). The live export layer serves CSV/JSON over Convex HTTP and requires `ICONCRETE_EXPORT_TOKEN`.
- **Import:** `/import` accepts `.xlsx` files, maps Arabic/English headers, validates each row, shows a preview with issues, and commits valid rows to `productionLogs` with server-side pricing and audit entries.
- **Demo data:** the app auto-seeds a realistic demo dataset once per session when the database is empty and the viewer can `manageTestData`; test records are flagged from `Test_Data_Flag` and can be cleared via `production.clearTestData`.

---

## Deployment notes

- The app is a static SPA (`dist/`) plus a Convex backend. `main.ts` contains an optional Deno/Hono static server for self-hosting the built SPA.
- `vite.config.ts` intentionally keeps `server.hmr` configured for the hosted runtime — do not change the HMR settings.
- Vite manual chunking splits React, Convex, Radix, Framer Motion, Recharts, and forms into separate vendor chunks for faster loads.

---

## License

Released under the [MIT License](./LICENSE).
