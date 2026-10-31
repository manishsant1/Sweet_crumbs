# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # dev server on http://localhost:3000 (API + Vite with HMR, one process)
npm run build    # build the frontend into dist/
npm start        # production: serves the API and dist/ on PORT (default 3000)
npm run smoke    # end-to-end API checks against a RUNNING server (BASE_URL to target a deployment)
```

There is no unit-test suite, linter or formatter. Verify changes with `npm run build`, `npm run smoke`, and curl against a running server.

Requires Node >= 22.9 (uses `--env-file-if-exists` and the global `WebSocket` that Neon's Pool needs). `DATABASE_URL` (a Neon Postgres connection string) must be set in `.env` or the environment, otherwise the server exits on startup. See `.env.example`.

## Architecture

A single deployable package: one Express process serves both the JSON API and the React app. There is no separate frontend server and no CORS. The browser calls same-origin `/api/*`.

- `server/index.js` mounts the API at `/api`, then either runs Vite in middleware mode (dev) or serves `dist/` with an `index.html` fallback for client-side routes (prod, chosen with `--prod` or `NODE_ENV=production`). It runs `db.init()` before listening. Vite is only imported in dev mode.
- `server/dev.js` is the dev runner. It spawns `index.js` and restarts it when a `.js` file under `server/` or `shared/` changes. **Do not replace it with `node --watch` / `--watch-path`.** On Windows these react to Vite writing `node_modules/.vite/deps_temp_*` and loop forever. For the same reason `index.js` imports `vite.config.js` itself and passes `configFile: false` to Vite.
- `server/db.js` is the only place with SQL. It uses `Pool` from `@neondatabase/serverless` (WebSocket, so interactive transactions work). The schema is idempotent `CREATE ... IF NOT EXISTS` run on every start (tables `bakery_products`, `bakery_orders`, `bakery_order_items`, prefixed because the database is shared with other apps), and `server/seed.js` is inserted only when `bakery_products` is empty. There is no migration tool, so schema changes to existing tables need a manual `ALTER` (and the same change in `SCHEMA` for fresh databases). Postgres `numeric` columns come back as strings and are converted with `Number()` in `toProduct` / `toOrder`; `fulfil_date` is selected as text.
- `createOrder` is the core invariant. In one transaction it checks the date window, locks the product rows (`FOR UPDATE`, ordered by id), checks stock, enforces the per-user cap of upcoming orders, reprices from the database (`shared/pricing.js`), inserts the order and its lines and decrements stock. The client sends only `{items: [{id, qty}], checkout}`; prices it sends are ignored. Orders snapshot name, emoji and price per line. `cancelOrder` (owner only, until the day before fulfilment) puts the stock back in the same locked order and is idempotent.
- Fulfilment dates are plain `YYYY-MM-DD` strings in the bakery's timezone (`TIMEZONE` in `shared/config.js`); "today" is computed with `Intl` there, not from the server or visitor clock. No date library.
- `server/routes.js` handles request validation, and `HttpError` (`server/errors.js`) becomes `{error, details}` JSON. Express 5 forwards async throws to the error handler, so handlers simply `throw`.
- `shared/` is imported by both the server and the browser so the two can't disagree: `config.js` (vocabulary + business constants), `pricing.js` (totals, delivery fee, tax), `dates.js` (fulfilment window), `validation.js` (checkout fields). Keep it dependency-free. The frontend imports it as `../../shared/...`.

### Authentication (Better Auth)

Email + password accounts with cookie sessions, using `better-auth`. `server/auth.js` builds the instance on db.js's Neon Pool; `initAuth()` (called from `server/index.js` after `db.init()`) creates its four tables, prefixed `sweet_crumbs_` so they can share a database with other apps. `server/index.js` mounts `toNodeHandler(auth)` at `/api/auth/*splat` **before** `express.json()` (Better Auth needs the raw body; Express 5 needs the named wildcard). Browsing is public; `requireUser` in `server/routes.js` resolves the session to `user.id` (401 otherwise) and every order is scoped by it (`bakery_orders.user_id`). Another user's order is a 404.

Needs `BETTER_AUTH_SECRET` (32+ chars; the server exits without it). The public URL comes from `BETTER_AUTH_URL`, else Render's `RENDER_EXTERNAL_URL`, else `http://localhost:PORT`; it must match the address in the browser or Better Auth rejects writes. There is no email provider, so no email verification or password reset (account deletion with password is enabled, and the smoke test uses it to clean up).

Client side: `src/api/auth.js` wraps `createAuthClient` (`useSession`, `signIn`, `signUp`, `signOut`); `RequireAuth` guards `/checkout` and `/orders` and returns the visitor (with router state) after `/login`.

### Frontend (`src/`)

- `src/api/api.js` is the only module that calls the server. It throws `ApiError` with `status` and `details` (per-field errors the form displays).
- The cart lives in `CartContext` (localStorage). Cart lines are product snapshots, so stock can be stale: the server is the authority at checkout and its 409 message is shown. Checkout does not reset `submitting` on success, so clearing the cart can't bounce the user to /cart before navigation. Effects that fetch on user input use an `off` flag so stale responses are dropped.
- Routing uses react-router v6 (`src/App.jsx`). Styling is a single global `src/index.css` with CSS variables, no CSS framework. Images are emoji.

## Windows environment notes

- Stopping a background `npm run dev` can leave `node ... server\index.js` / `server/dev.js` processes holding port 3000 (and Vite's HMR port 24678). Kill them before restarting.
- PowerShell `Invoke-WebRequest` to `localhost` can hang. Use `curl` from Bash.

## Deploy

See `README.md`. Render needs `npm install --include=dev` for the build step because Vite is a devDependency (`render.yaml` does this).

## Production

Live at https://sweet-crumbs-itwx.onrender.com (Render service `srv-dbj11n5g1s2s73eg1hog`, workspace "My Workspace", free plan, region ohio; repo https://github.com/manishsant1/Sweet_crumbs, auto-deploys on push to `main`). It uses the same Neon database as local development. The first request after idle can take 10-30 s (Render sleeps, Neon suspends).
