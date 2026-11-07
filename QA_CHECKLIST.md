# GRANTLY Phase 4 — QA checklist

## Automated checks

Run:

```bash
npm run test:engine
npm run build
```

The engine suite validates eligibility, document status transitions, action generation, deadline boundaries, profile-fit ranking, comparison highlights, tie handling, attention-summary grammar, and deadline sorting.

## Manual browser checks

- [ ] Overview metrics reflect the current profile, documents, and applications.
- [ ] Search matches scholarship title, provider, and description.
- [ ] Category, study-level, saved-only, and sort controls work together.
- [ ] Reset filters clears the query, all filters, sorting, and saved-only mode.
- [ ] Deadline sorting places upcoming deadlines before closed opportunities.
- [ ] The three-column discovery layout collapses to two and then one column at narrower widths.
- [ ] Saving and tracking a scholarship update their visible states.
- [ ] Comparison accepts two or three opportunities and prevents a fourth selection.
- [ ] Comparison highlights show independent criteria, not an overall winner.
- [ ] Ties are represented as ties; no false single winner is shown.
- [ ] A requirement absent from a scholarship is described as not part of its listed criteria, not as a failed requirement.
- [ ] The profile-fit explanation states that the index is not an award probability or eligibility guarantee.
- [ ] Comparison table can be scrolled horizontally on small screens.
- [ ] Comparison and scholarship dialogs close with Escape and return focus to the invoking control.
- [ ] Tab navigation remains inside an open dialog; page scrolling is locked while it is open.
- [ ] Application readiness remains separate from eligibility assessment.
- [ ] Updating a profile field or document recalculates affected assessments and actions.
- [ ] LocalStorage state survives refresh.
- [ ] The UI remains usable at 320px, 768px, 1024px, and wide desktop widths.
- [ ] All seeded scholarship data remains visibly labeled as fictional demonstration data.

- [ ] On mobile, the navigation drawer opens, traps keyboard focus, closes with Escape, restores focus, and locks background scrolling.
- [ ] The main content can be reached with the keyboard skip link.
- [ ] Expired or invalid-deadline opportunities cannot be added as new applications, including through the detail dialog.
- [ ] Applications cannot move to Ready or Applied after the deadline, or while requirements/checklist items remain unresolved.
- [ ] Application stage controls prevent skipping directly from preparation to review/completion and prevent reopening submitted applications.
- [ ] Completing a preparation checklist after the deadline does not auto-promote an application to Ready.
- [ ] Corrupt or unsupported LocalStorage data falls back safely to demo defaults.
- [ ] Profile and document screens warn that LocalStorage is unencrypted and that only fictional demo details should be used.

## Known limitations

- Scholarship records are fictional demo records, not verified funding offers.
- Document records store metadata and simulated status only; no file bytes are stored.
- LocalStorage is browser/device-local and is not secure document storage or cross-device sync.
- Full production build and browser-level QA must be run on a machine where npm dependencies install successfully. No end-to-end browser automation was run in this environment.
