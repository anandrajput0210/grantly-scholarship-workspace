# GRANTLY — Hackathon demonstration script

Suggested demo length: 2–3 minutes. Use the seeded fictional student and scholarship records. Do not present the sample scholarships as real funding offers.

## Opening (15–20 seconds)

“Students do not only struggle to find scholarships. They struggle to understand which opportunities fit their circumstances, what requirements remain unresolved, and what to do next. GRANTLY connects scholarship discovery, explainable requirement assessment, and application preparation in one workspace.”

## Live walkthrough (about 2 minutes)

1. **First-run onboarding:** In a fresh browser profile, complete the five short steps. Show the live potential-match count changing as study level, state, GPA, and optional income are updated. Applicant category is collected as optional context but does not affect the current sample rules.
2. **Overview / Today:** Start on the dashboard after onboarding. Point out the time-aware greeting, the Today action center's recommended next step, two follow-up actions, potential matches, active applications, upcoming deadlines, and document status. Explain that these values are derived from the saved demo profile, scholarship requirements, documents, and application records.
3. **Discover:** Open Discover Scholarships. Search or filter the sample opportunities. Explain that the profile-fit index describes alignment with listed requirements; it is not a guarantee of eligibility or an award probability.
4. **Compare:** Select up to three sample scholarships and open Compare. Highlight the award amounts, deadlines, matched requirements, unresolved requirements, missing documents, and independent comparison insights. Emphasize that GRANTLY does not declare a universal winner because students can prioritize different things.
5. **Explain eligibility:** Open a scholarship assessment. Show the distinction between `matched`, `not_matched`, `needs_verification`, and `document_missing`. Missing profile information is not treated as a hard mismatch.
6. **Resolve an action:** Open Document Center. Change the academic transcript from uploaded to verified. Return to Overview and show that the related verification action disappears because the shared assessment state has recalculated.
7. **Track an application:** Open My Applications. Show the preparation checklist and explain that eligibility and application readiness are separate. A student must meet the configured requirements and complete the checklist before advancing to Ready/Applied.
8. **Persistence:** Refresh the page and show that the browser-local demo state remains.

## Closing (15 seconds)

“GRANTLY does more than list opportunities. It explains where a student stands, identifies what is unresolved, and connects that information to a concrete next action—then keeps the preparation journey organized.”

## Be transparent about limitations

- All seeded scholarship names, providers, amounts, deadlines, and `example.org` source references are fictional demonstration data.
- Eligibility is a deterministic assessment of the profile and requirement rules included in the demo; it is not an awarding organization's decision.
- The app is frontend-only. Data is stored in browser LocalStorage, so it is browser/device-specific and not synced across users or devices.
- Document handling is simulated metadata/status only. No file contents are uploaded or stored.
- Do not enter actual personal, financial, identity, or bank information in the demo.
- Do not claim live scholarship verification, secure document storage, authentication, or cross-device synchronization.

## Likely judge questions

**How is eligibility assessed?**  
A deterministic TypeScript rules engine evaluates each listed requirement against the demo profile and document metadata. Each result includes a status and explanation. Missing data remains unresolved instead of being silently treated as failure.

**Why no generative AI?**  
The core assessment is rule-based so the result is repeatable and explainable. For a six-hour frontend challenge, that avoids unreliable or unsupported eligibility claims. AI could be considered later for extracting requirements from authoritative source material, but extracted claims would still need validation.

**Is the scholarship information real?**  
No. The included records are explicitly fictional seed data to demonstrate the product workflow. A real release would need verified opportunities, authoritative source links, update timestamps, and a reliable process for checking deadline and eligibility changes.

**Where is data stored?**  
In browser LocalStorage for this prototype. It is not encrypted and is not suitable for real sensitive documents or financial details.
