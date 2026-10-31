# Sweet Crumbs

An online bakery: browse the menu, fill a cart, and order for pickup or delivery. React + Vite frontend and a Node.js + Express API, run as **one process from one package**, with data stored in **Neon serverless Postgres**.

## Run

1. Create a Neon project at https://console.neon.tech and copy its connection string (Connect button).
2. Copy `.env.example` to `.env`, set `DATABASE_URL` to that string and `BETTER_AUTH_SECRET` to a random 32+ character value (the file shows a one-line command to generate one).
3. Start the app:

```
npm install
npm run dev          # development: http://localhost:3000, with hot reload
```

On first start the server creates the tables and loads the starter data.

```
npm run build        # builds the frontend into dist/
npm start            # serves the API and the built app on http://localhost:3000
npm run smoke        # API checks against the running server (BASE_URL=... to target a deployment)
```

## Deploy (Render + Neon)

1. Push this folder to a GitHub repository (`.env` is git-ignored).
2. In Render choose **New > Blueprint**, pick the repository; `render.yaml` defines the service.
3. Set `DATABASE_URL` (your Neon connection string) when prompted.
4. After the first deploy: `BASE_URL=https://<your-service>.onrender.com npm run smoke`.

Any host that runs Node 22.9+ works: the build is `npm install --include=dev && npm run build` and the start command is `npm start`. The app keeps no data on local disk. Render's free plan sleeps after inactivity, so the first request after a pause is slow.

| Variable       | Default         | Purpose                          |
|----------------|-----------------|----------------------------------|
| `DATABASE_URL` | none (required) | Neon Postgres connection string  |
| `BETTER_AUTH_SECRET` | none (required) | Signs session cookies, 32+ characters |
| `BETTER_AUTH_URL` | `RENDER_EXTERNAL_URL`, else `http://localhost:PORT` | Public URL; set it on hosts other than Render |
| `PORT`         | `3000`          | HTTP port (set by most hosts)    |


## How it fits together

```
server/
  index.js    Entry point. API at /api; dev: Vite inside Express; prod: serves dist/
  dev.js      Dev runner: restarts index.js when server/ or shared/ code changes
  routes.js   API endpoints and request validation
  db.js       All SQL: schema, queries, the order and cancel transactions
  seed.js     The starter menu, loaded into an empty database
shared/       Rules used by both browser and server (config, pricing, dates, validation)
src/
  api/api.js  The only place the frontend calls the server
  context/    CartContext (cart kept in localStorage)
  pages/      Home, ProductDetail, Cart, Checkout, Orders, Login
```

### API

| Method | Path                       | Notes                                                              |
|--------|----------------------------|--------------------------------------------------------------------|
| GET    | `/api/health`              | Health check (pings the database)                                  |
| GET    | `/api/categories`          |                                                                    |
| GET    | `/api/products`            | Whole menu with live `stock`                                       |
| GET    | `/api/products/:id`        | 404 if not found                                                   |
| GET    | `/api/orders`              | The caller's orders (sign-in required)                             |
| POST   | `/api/orders`              | `{ items: [{id, qty}], checkout: { fulfillment, date, payment, note, fullName, email, phone, address, city, zip } }` (address fields only for delivery) |
| POST   | `/api/orders/:id/cancel`   | Owner only; until the day before pickup/delivery; restocks         |

Prices, delivery fee, tax and totals come from the database and `shared/pricing.js`, never from the browser. Checkout locks the product rows and decrements stock in one transaction, so two customers can't both buy the last item (`CHECK (stock >= 0)` backs this up). Orders are scheduled for a day 1 to 7 days ahead in the bakery's timezone (`shared/config.js`); delivery needs an address, pickup does not.

Accounts use [Better Auth](https://www.better-auth.com) (email + password, cookie sessions; its endpoints live under `/api/auth/*`). Browsing and the cart are public; checkout, listing and cancelling orders need an account, and you only ever see your own orders. There is no email verification or password reset yet (that needs an email provider), and no real payment: the card option is a demo and nothing is charged.

Tables are prefixed `bakery_` (and `sweet_crumbs_` for auth) because the database may be shared with other apps. To reset the bakery's data, drop the tables in the Neon SQL editor and restart (the server recreates and reseeds them):

```sql
DROP TABLE bakery_order_items, bakery_orders, bakery_products;
```
