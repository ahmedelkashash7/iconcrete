# Pull request

<!--
Main is the production branch: merging this PR is what promotes the change to
Vercel Production and (through scripts/vercel-build.sh) to the production Convex
deployment. Fill the checklist in honestly — an unticked box is a reason not to
merge, not a formality.
-->

## What changed

<!-- One short paragraph. Name the phase/requirement IDs from REQUIREMENTS.md. -->

## Why

<!-- The problem this solves. Link the requirement ID, issue or owner decision. -->

---

## Merge checklist

### 1. Tests and checks are green

- [ ] CI (`verify`) is green on this branch — install, secret scan, contrast, client types, Convex types, lint, tests, build.
- [ ] Local run of the same gates pasted below (`bun run test`, `bun run lint`, `bun run typecheck`, `bun run typecheck:convex`, `bun run check:secrets`, `bun run check:contrast`, `bun run build`).
- [ ] Any check that could **not** run is listed here with the reason, and is not described as passing.

```
<paste the real command output here>
```

### 2. The preview deployment was actually tested

- [ ] I opened the Vercel **Preview** URL for this branch (not the local dev server).
- [ ] Sign-in works, and I checked the specific screens this change touches at phone **and** desktop width, in Arabic and in English.
- [ ] The preview talks to a **dev/staging** Convex deployment, not production.
- [ ] Any feature that the checklist cannot cover in a preview is named here:

### 3. Schema migration is safe and backward compatible

- [ ] New fields are **optional** (or have a default), so old rows still validate and an old frontend still reads new rows.
- [ ] No field was renamed, retyped or removed in this PR. (If one was: the two-step migration plan is written below.)
- [ ] No destructive operation (no table drop, no data wipe, no index removal that a live query still needs).
- [ ] Backfill script/plan (if needed) is idempotent and was run on the staging deployment first:

### 4. A Convex data export was taken

- [ ] `npx convex export --prod --path ./backups/<date>.zip` was run before merging, and the file is stored **outside** the repository.
- [ ] Backup date and location:

### 5. Rollback plan

- [ ] Vercel rollback target identified (previous production deployment URL / commit SHA):
- [ ] Convex rollback understood: reverting the frontend does **not** revert the backend. The plan if the pushed functions are the problem is:
- [ ] Any data written by the new code that older code cannot understand is listed here:

### 6. Owner approval

- [ ] The owner (or the named approver) has reviewed this PR.
- [ ] Approver name and date:
- [ ] Sensitive items from `docs/DEPLOYMENT.md` (keys, `DEMO_MODE`, CORS allow-list, export token, branch assignments) that this change depends on are listed below, and none of them is a secret value pasted into this PR:

---

## Notes for the reviewer

<!-- Anything surprising, any known limitation, any follow-up promised. Do not
     describe unfinished work as complete. -->
