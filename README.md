# Wine Words frontend

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Cloudflare Workers previews

`wrangler.jsonc` targets the existing `wine-words` Worker, serves Vite's `dist`
output, and enables SPA route fallback. It includes the preview variables required
by the current Cloudflare preview configuration.

In Cloudflare Workers Builds, use this frontend directory as the root, with:

- Build command: `npm run build`
- Preview deploy command: `npx wrangler@4.149.0 preview`
- Production deploy command: `npx wrangler@4.149.0 deploy`

Set `VITE_API_BASE_URL=https://wine-words.com/api/v1` in the
Cloudflare **build environment** for the preview build. Vite embeds this value
while building; Wrangler's `previews.vars` does not rewrite the built browser
bundle. Set other public `VITE_*` login configuration there as needed.

To build and publish a branch preview locally, run from this directory:

```bash
VITE_API_BASE_URL=https://wine-words.com/api/v1 npm run build
npx wrangler@4.149.0 preview
```

TEST
Preview URLs have a different origin from the production frontend. Add the exact
preview origin to the Rails CORS allowlist and applicable OAuth provider settings
before testing API requests or social login. This preview API URL uses the existing
Render backend; use a staging API URL in both configurations if isolation is needed.

See [Cloudflare Previews](https://developers.cloudflare.com/workers/previews/).

## Full-stack Playwright tests

The browser suite starts the sibling Rails repository in its isolated `e2e`
environment, resets `wine_words_api_e2e`, starts Vite on port 4173, and
creates role-aware Admin, Reviewer, Reader, and Guest browser states. It never
uses development or production data.

Prerequisites: PostgreSQL, the sibling `../wine_words_api` checkout, Ruby/API
dependencies, Node dependencies, and browser binaries:

```bash
npm ci
npx playwright install chromium firefox
npm run test:e2e:chromium       # full functional suite
npm run test:e2e:firefox        # critical smoke coverage
npx playwright test --project=accessibility
npx playwright test --project=visual
```

Useful focused commands:

```bash
npm run test:e2e:smoke -- --project=chromium
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:update-snapshots
npm run test:e2e:report
```

Set `E2E_API_REPOSITORY` when the API is not at `../wine_words_api`. Optional
URL and credential overrides are `E2E_FRONTEND_URL`, `E2E_API_URL`,
`E2E_USER_PASSWORD`, and `E2E_TEST_ACCESS_PASSWORD`. Generated auth state,
reports, traces, videos, and screenshots are ignored; committed visual snapshots
live beside the visual spec.
