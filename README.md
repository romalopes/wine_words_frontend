# React + Vite

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

Set `VITE_API_BASE_URL=https://wine-words-api.onrender.com/api/v1` in the
Cloudflare **build environment** for the preview build. Vite embeds this value
while building; Wrangler's `previews.vars` does not rewrite the built browser
bundle. Set other public `VITE_*` login configuration there as needed.

To build and publish a branch preview locally, run from this directory:

```bash
VITE_API_BASE_URL=https://wine-words-api.onrender.com/api/v1 npm run build
npx wrangler@4.149.0 preview
```

Preview URLs have a different origin from the production frontend. Add the exact
preview origin to the Rails CORS allowlist and applicable OAuth provider settings
before testing API requests or social login. This preview API URL uses the existing
Render backend; use a staging API URL in both configurations if isolation is needed.

See [Cloudflare Previews](https://developers.cloudflare.com/workers/previews/).
