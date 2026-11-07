# GRANTLY v1.4.0 — Scholarship discovery & application-readiness workspace

**Live demo:** https://grantly-scholarship-workspace.vercel.app/


A frontend-only React + TypeScript + Tailwind CSS single-page application. It uses a deterministic eligibility engine and persists the demo workspace in browser `localStorage`.

## Run locally

Requirements: Node.js 20 and npm.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

## What is implemented

- Student profile editor with editable study level, GPA, income, category, and state.
- Scholarship discovery with keyword search, category and study-level filters, explainable personalized ranking, and sorting.
- Side-by-side comparison of up to three opportunities, including award, deadlines, profile fit, requirement-by-requirement status differences, and criterion-specific decision highlights (strongest profile fit, highest award, soonest open deadline, and fewest requirements needing attention).
- Scholarship detail panel with requirement-by-requirement explanations.
- Deterministic eligibility evaluation supporting all operators in the supplied data model.
- Separate document-status evaluation: missing, uploaded/unverified, and verified.
- Application tracker with stages and editable preparation checklists.
- Next-best-action suggestions generated from structured requirement metadata and upcoming deadlines (not explanation-text heuristics).
- Document action lifecycle: missing → prepare, uploaded → verify, verified → no document action.
- Application-stage reconciliation: profile/document/checklist changes can demote a stale Ready stage back to Preparing, or promote a completed preparation workflow to Ready.
- Preparation and deadline actions are suppressed after an application is submitted, moves under review, or is completed.
- Document metadata center with simulated status changes; no files are uploaded or stored.
- Dashboard metrics derived from profile, documents, applications, and scholarship assessments.
- Core profile completeness score with missing identity/study fields surfaced; GPA, family income, and applicant category remain optional enrichment fields.
- Deadline urgency based on calendar dates: high (0–3 days), medium (4–14 days), low (more than 14 days), or closed.
- Application-level blocker summaries that keep eligibility blockers separate from checklist progress.
- LocalStorage persistence under `grantly-workspace-v1`, with runtime shape validation so malformed or unsupported saved data falls back to demo defaults.
- Responsive layouts, accessible search/filter labels, and keyboard-friendly native controls. Scholarship and comparison dialogs support Escape to close, focus containment, focus restoration, and background scroll locking. The mobile navigation drawer also traps focus, closes with Escape, restores focus, and locks background scrolling.

## Hackathon demo

Use [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for a reproducible 2–3 minute walkthrough and truthful answers to common judge questions.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for Vercel and Netlify instructions. The repository includes `vercel.json`, `netlify.toml`, and `.nvmrc` (Node 20). Build command: `npm run build`; publish directory: `dist`. A successful test suite is not a substitute for a successful production build.

## Engine tests

Run the deterministic eligibility and workflow tests with:

```bash
npm run test:engine
```

The 36 tests cover missing profile values, hard mismatches, all three document states, action routing, submitted-stage suppression, application-stage reconciliation, eligibility/checklist separation, core versus optional profile completeness, explainable ranking, deadline-urgency boundaries, comparison highlights and tie handling, clear requirement-attention summaries, deadline sorting, expired application gates, invalid dates, and legal application-stage transitions.

## Demo data notice

All six scholarship records, provider names, amounts, deadlines, and `example.org` source references are fictional demo data. They are not live or verified funding offers. Replace them with verified records and authoritative source links before any real-world use.

## Persistence and reset

The app stores JSON-serializable profile fields, document metadata/statuses, saved scholarship IDs, application stages, and checklist states in this browser only. It does not store document contents, identity numbers, or uploaded files. LocalStorage is not encrypted; use fictional profile information only and never enter real income, identity, or account details.

To reset to the original demo workspace, open the browser developer console and run:

```js
localStorage.removeItem('grantly-workspace-v1');
location.reload();
```

## Architecture

- `src/types/index.ts` — the requested exported domain types.
- `src/data/seed.ts` — fictional scholarship records and initial workspace state.
- `src/engine/eligibility.ts` — serializable requirement interpretation, eligibility assessment, next-action generation, deadline action priority, and application checklist readiness.
- `src/engine/recommendations.ts` — explainable profile-fit ranking, calendar-based deadline urgency, deadline sorting, and privacy-conscious profile completeness. Strong matches rank ahead of unresolved and mismatched opportunities; fit scores are not award probabilities.
- `src/engine/comparison.ts` — criterion-specific comparison highlights, tie-aware leader summaries, and grammatical requirement-attention summaries.
- `src/hooks/useLocalStorage.ts` — generic LocalStorage persistence hook.
- `src/App.tsx` — single-page workspace and page-level interactions.

Eligibility and application preparation are separate: an eligibility result describes whether profile facts and required supporting evidence satisfy listed conditions; application readiness reflects checklist completion. Neither value predicts an award or replaces the provider's final decision.


## Phase 4 hardening

- Closed or invalid scholarship deadlines cannot be added as new applications.
- Applications cannot move to Ready or Applied unless the deadline is open, all listed requirements match, and every preparation checklist item is complete. The stage selector also prevents skipping directly from preparation to review/completion or reopening a submitted application.
- Expired preparation records do not automatically become Ready when tasks are completed after the deadline. Existing Ready and submitted records remain historical records.
- Mobile navigation now has dialog semantics, keyboard focus containment, Escape-to-close, focus restoration, and background scroll locking.
- A skip-to-main-content link and clearer document action labels improve keyboard and assistive-technology navigation.
- LocalStorage data is shape-validated before it is used; malformed or unsupported data falls back to demo defaults.
- Profile and document data are explicitly described as unencrypted browser-local demo data. Use fictional information only.

## Phase 4 checks

Run `npm run test:engine` for the 36 deterministic engine and workflow checks. See `VERIFICATION_REPORT.md` for this environment's build and browser-test limitations. Run `npm run build` on a machine with dependencies installed. Then use `QA_CHECKLIST.md` for viewport and browser testing.
