# Deploy to Cloudflare (Workers)

This project builds to a Cloudflare Worker (SSR) + static assets, ready to deploy directly.

## One-time
```bash
bun install          # or npm install
npx wrangler login   # authenticate with your Cloudflare account
```

## Deploy
```bash
bun run deploy       # builds, then `wrangler deploy`
```
The build generates `dist/server/wrangler.json` (Worker entry + `dist/client` assets) and
`.wrangler/deploy/config.json`, so `wrangler deploy` from the project root picks up the
correct config automatically. The Worker name comes from `package.json` -> `name`
(`lerma-santiago-water-dashboard`); rename it there to change the `*.workers.dev` subdomain.

## Test the production build locally
```bash
bun run cf:dev       # builds, then runs the Worker locally via wrangler dev
```

## Preview deployment (no traffic)
```bash
bun run cf:versions:upload
```

## Cloudflare Pages / Git-connected builds
- Build command: `bun run build` (or `npm run build`)
- Deploy command: `npx wrangler deploy`
- Node version: 20+
