# TTSmart customer frontend

This frontend runs on Vite.

Use Node.js 22.13 or newer (Node 22 LTS or Node 24+) so the Vite and jsdom test environments use a supported runtime.

## Commands

- `npm run dev` (or `npm start`) starts the development server at http://localhost:3000.
- `npm run build` writes the production bundle to `dist/`.
- `npm run preview` serves the production bundle locally.
- `npm test` runs the existing Jest-compatible test suite with Vitest.

Copy `.env.example` to `.env` for local development. The development and preview servers proxy `/api` to `http://localhost:5000` and remove the `/api` prefix before forwarding. Use the production API prefix/URL supplied by the deployment environment when it differs.

## Deployment follow-up

The backend serves `fe/dist` and retains SPA fallback to `index.html`.
