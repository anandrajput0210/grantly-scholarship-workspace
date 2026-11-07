# GRANTLY v1.4.0 — Deployment guide

GRANTLY is a static Vite single-page application. It does not require a backend, database, environment variables, server functions, or secret keys.

## Before deploying

1. Use Node.js 20 (the repository includes `.nvmrc`).
2. In the project root, run:

   ```bash
   npm install
   npm run test:engine
   npm run build
   ```

3. Confirm that the `dist/` directory is generated.
4. Commit the generated `package-lock.json` after `npm install`. This makes later installs and hosted builds more reproducible.
5. Push the project to a GitHub repository.

Do not add real student identity, income, bank, or certificate data to the demo. Browser LocalStorage is not encrypted, and this prototype stores only demo profile values and document metadata.

## Deploy to Vercel

1. Sign in to Vercel and import the GitHub repository.
2. Set the project root to the directory containing this `package.json` (the repository root if GRANTLY is at the root).
3. Use these build settings:
   - Framework preset: Vite (or Other, if Vite is not detected)
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install` (or the platform's default)
4. Deploy. The included `vercel.json` rewrites application paths to `index.html` for SPA fallback behavior.
5. Open the deployed URL in a fresh browser tab and verify the smoke-test flow below.

Official routing reference: https://vercel.com/docs/routing/rewrites

## Deploy to Netlify

1. Sign in to Netlify and import the GitHub repository.
2. Set the base directory to the directory containing this `package.json`.
3. The included `netlify.toml` configures:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - SPA fallback: all application paths serve `/index.html` with status `200`.
4. Deploy and verify the published URL.

Official SPA routing reference: https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/

## Production smoke test

Run these checks against the actual hosted URL:

- The home page loads without a blank screen or console errors.
- Refreshing the page works.
- Discovery search, category filters, study-level filters, sorting, and reset work.
- Scholarship detail and comparison dialogs open and close with mouse and keyboard.
- The app never allows an expired opportunity to become a new application.
- Document status changes update assessments and Next Best Actions.
- Checklist and application-stage rules behave correctly.
- Browser refresh preserves the demo workspace.
- The interface works at 320px, 768px, 1024px, and desktop widths.
- The footer/demo notice makes clear that scholarship records are fictional examples.
- No real identity, income, bank, or document data is entered.

## Important LocalStorage behavior

LocalStorage is scoped to the exact origin (protocol + host + port). The data saved on `http://localhost:5173` does not automatically appear on the Vercel or Netlify domain. Each deployment starts with its own demo workspace in that browser. This is expected for this frontend-only prototype.

## Release limitation

A successful source test run does not prove that a production bundle was generated. Run `npm run build` after dependencies install successfully and confirm the `dist/` directory exists before presenting the project as deployed or production-build verified.
