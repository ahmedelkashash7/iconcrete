#!/usr/bin/env bash
#
# IConcrete — Vercel build entrypoint.
#
# Why this file exists
# --------------------
# A Convex app has two halves that must travel together: the frontend bundle
# (built by Vite, hosted by Vercel) and the backend functions + schema (pushed
# by the Convex CLI). If only the frontend is deployed, the browser talks to a
# backend that still runs the old functions.
#
# The rule implemented here:
#
#   VERCEL_ENV=production  -> push the Convex functions FIRST, then build the
#                             frontend so it is compiled against the URL of the
#                             deployment that was just pushed.
#                             Requires CONVEX_DEPLOY_KEY in the Vercel
#                             *Production* scope ONLY (production deploy key).
#
#   anything else (preview / development)
#                          -> NEVER deploy Convex. Build the frontend only, and
#                             point VITE_CONVEX_URL at a DEV/staging Convex
#                             deployment through the Vercel *Preview* scope.
#                             There is deliberately no deploy key in Preview,
#                             so a preview branch cannot touch real data.
#
# This is the free alternative to Convex preview deployments: Convex preview
# deployments need a preview deploy key and are still documented as beta, so on
# a free plan we reuse one staging deployment for every preview instead of
# provisioning a deployment per branch. See docs/DEPLOYMENT.md.
#
# Safety: both branches fail loudly (non-zero exit) instead of building
# something that silently points at the wrong backend. Vercel then keeps the
# previous production deployment live, because a failed build is never
# promoted.

set -euo pipefail

echo "──────────────────────────────────────────────────────────────"
echo "IConcrete build"
echo "  VERCEL_ENV          = ${VERCEL_ENV:-<unset>}"
echo "  VERCEL_GIT_COMMIT   = ${VERCEL_GIT_COMMIT_REF:-<unset>}"
echo "  CONVEX_DEPLOY_KEY   = $(if [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then echo '<set>'; else echo '<unset>'; fi)"
echo "  VITE_CONVEX_URL     = ${VITE_CONVEX_URL:-<unset>}"
echo "──────────────────────────────────────────────────────────────"

# Prefer bun (the repo has a bun.lock and CI uses bun), but do not hard-fail if
# the build image only has node/npm.
if command -v bun >/dev/null 2>&1; then
  BUILD_CMD="bun run build"
else
  echo "note: bun not found on PATH — falling back to npm"
  BUILD_CMD="npm run build"
fi

if [ "${VERCEL_ENV:-}" = "production" ]; then
  if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
    echo "" >&2
    echo "FATAL: VERCEL_ENV=production but CONVEX_DEPLOY_KEY is not set." >&2
    echo "Refusing to build: the frontend would ship against whatever URL is" >&2
    echo "baked into VITE_CONVEX_URL while the backend stays at the old" >&2
    echo "revision. Add a *production* Convex deploy key to the Production" >&2
    echo "environment scope in Vercel. See docs/DEPLOYMENT.md." >&2
    exit 1
  fi

  # --typecheck enable   : never push functions that fail tsc.
  # --cmd-url-env-var-name: hand the freshly deployed URL to the frontend build
  #                        as VITE_CONVEX_URL, so the bundle and the backend
  #                        can never disagree about which deployment they use.
  exec npx convex deploy \
    --typecheck enable \
    --cmd "${BUILD_CMD}" \
    --cmd-url-env-var-name VITE_CONVEX_URL
fi

# Preview / development: frontend only.
if [ -z "${VITE_CONVEX_URL:-}" ]; then
  echo "" >&2
  echo "FATAL: VITE_CONVEX_URL is not set for VERCEL_ENV=${VERCEL_ENV:-<unset>}." >&2
  echo "Set it in the matching Vercel environment scope and make it point at a" >&2
  echo "DEV/staging Convex deployment (never the production one)." >&2
  echo "See docs/DEPLOYMENT.md." >&2
  exit 1
fi

exec ${BUILD_CMD}
