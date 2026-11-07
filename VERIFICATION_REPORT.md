# GRANTLY v1.4.0 — Verification report

Date: 7 November 2026

## Checks completed in this environment

| Check | Result | Notes |
|---|---|---|
| Deterministic engine/workflow suite | PASS — 36/36 | `npm run test:engine` |
| TS/TSX syntax transpilation | PASS — 8 source files | TypeScript `transpileModule` syntax diagnostics |
| Source structural type check | PASS | Ran against temporary React/Lucide type stubs; this is not a substitute for the installed framework type declarations |
| ZIP integrity | To be checked after packaging | Archive check is performed before delivery |

## Checks not completed

- `npm install --no-audit --no-fund --prefer-offline` timed out in this environment.
- `npm run build` could not complete because React, React DOM, their type declarations, Node type declarations, and Vite were not installed. The build command therefore remains unverified.
- No live browser end-to-end test or deployed-host smoke test was performed in this environment.

## Phase 4 changes

- Reject expired or invalid-deadline opportunities when creating a new application.
- Disable tracking in the discovery card and scholarship detail dialog for closed or invalid deadlines.
- Gate Ready/Applied stages on an open deadline, fully matched requirements, and a completed checklist.
- Prevent skipping from preparation directly to Under review or Completed.
- Prevent reopening submitted applications as preparation; allow corrections between submitted/outcome stages.
- Do not auto-promote expired preparation records to Ready.
- Add mobile navigation dialog semantics, focus containment, Escape-to-close, focus restoration, and background scroll locking.
- Add a skip-to-main-content link and clearer labels for document state actions.
- Validate LocalStorage data shape before loading it; unsupported or malformed data falls back to demo defaults.
- Add explicit warnings that profile and document metadata are stored unencrypted in browser LocalStorage and that only fictional demo values should be used.

## Required local verification

On a machine where dependencies install successfully:

```bash
npm install
npm run test:engine
npm run build
npm run dev
```

Then complete the manual browser checks in `QA_CHECKLIST.md` at 320px, 768px, 1024px, and desktop widths.


## Final handoff checks

- Re-ran `npm run test:engine` on 7 November 2026: PASS — 36/36 tests.
- Attempted `npm run build`: BLOCKED because dependencies are not installed in this environment (`react`, `react-dom`, `lucide-react`, Vite, and type declarations are unavailable).
- Attempted `npm install --no-audit --no-fund`: timed out in this environment.
- Added static-hosting configuration for Vercel and Netlify plus a Node 20 `.nvmrc`.
- No hosting account was connected, so no deployment was created and no live URL/browser smoke test is claimed.
- Validated `vercel.json` as JSON and `netlify.toml` as TOML, including the SPA fallback settings.
- Added `.nvmrc` and package engine metadata targeting Node.js 20+.
- Added `DEPLOYMENT.md` and `DEMO_SCRIPT.md` for hosting setup, production smoke tests, and a transparent judge walkthrough.
- Hosting configuration is prepared only; no Vercel/Netlify account was connected and no live deployment was performed.
