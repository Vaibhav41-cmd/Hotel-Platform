# Serein Stays — Hotel booking & front-desk platform

A full-stack boutique-hotel discovery, booking and enquiry platform for a fictional 14-property Mumbai group. It includes a guest-facing React website, an Express REST API, a PostgreSQL/Prisma production data layer, a runnable in-memory demo mode, role-based front-desk tools, API documentation, tests and deployment blueprints.

> **Deployment status:** the repository and deploy configurations are ready. I have not provisioned public Vercel/Render resources or pushed this repository to a GitHub account because this workspace has no deployment/repository credentials. Run the local preview here, then follow **Deploy** below to publish it under your accounts.

## What’s here

- **Guest website:** property discovery and filtering, date-aware room availability, property details and reviews, sign-up/sign-in, secure booking, guest trips/cancellation, and concierge enquiries.
- **Front desk:** role-protected dashboard with occupancy, ADR, RevPAR and room revenue; 7/30/90-day views; booking status management; property and room inventory CRUD; enquiry inbox; image upload; and import-quality review.
- **14 seeded Mumbai properties:** 28 room types, legacy bookings/guest stays, reviews, enquiries and auditable data cleanup cases.
- **Production-oriented API:** Express, Prisma/PostgreSQL, short-lived JWT access tokens, rotating hashed opaque refresh tokens in an HttpOnly cookie, RBAC, Zod validation, rate limiting, consistent request-ID errors, event logs and an atomic inventory guard.
- **Optional notifications:** BullMQ + Redis and SMTP for booking/enquiry emails. The core flows work without the optional services.
- **CI:** GitHub Actions runs API/unit tests and a production frontend build on every push and pull request.

## Run it locally

### Fast demo (no database required)

Requirements: Node.js 20.19+ (or 22+) and npm 10+.

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The API listens on `http://localhost:4000`; Vite proxies `/api` and `/uploads` to it. With no `DATABASE_URL`, the API starts with an in-memory dataset. It resets to the seed when the API process restarts.

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Guest | `guest@sereinstays.demo` | `Welcome!2026` |
| Front desk admin | `admin@sereinstays.demo` | `Harbor!2026` |

The sign-in panel has one-click demo fill buttons. Use **Front desk** in the header after signing in as admin.

### PostgreSQL-backed local setup

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a random secret of at least 32 characters. Refresh tokens are random opaque values stored only as SHA-256 hashes.
2. Start Postgres (and optional Redis):

   ```bash
   docker compose up -d postgres redis
   ```

3. Set `DATABASE_URL` in `.env` to the Postgres URL in the example, then generate the Prisma client, apply migrations and seed an **empty** database:

   ```bash
   npm install
   npm run db:generate
   npm run db:deploy
   SEED_ADMIN_EMAIL=admin@yourhotel.com SEED_ADMIN_PASSWORD='use-a-unique-password-of-14-plus-chars' npm run db:seed
   npm run dev
   ```

   On Windows PowerShell, set environment variables with `$env:SEED_ADMIN_EMAIL=...` and `$env:SEED_ADMIN_PASSWORD=...` before `npm run db:seed`.

The seed command refuses to run if the database already contains properties; it will not erase live data. For the PostgreSQL seed, the administrator email/password come from environment variables. A throwaway, unloginable guest identity is created for imported stay links.

## Tests and build

```bash
npm test                       # Node unit + API tests
npm run build                  # Vite production build
npm run db:generate            # regenerate Prisma client after schema changes
```

The API tests cover public search, login/refresh, guest/admin authorization, booking totals and date validation, enquiry intake, admin metrics, and property/room-type create-update-delete. Unit tests cover room-label normalization, stay dates, currency provenance, quarantine behavior, and KPI math.

## Data cleanup and reporting

No source-system export was attached to the brief, so the seed uses fictional, synthetic fixtures that model the requested legacy patterns; it is not a claim to have imported a real hotel group’s records. The importer deliberately exercises source-system messiness rather than pretending the data is clean:

- **14 properties** in Mumbai neighbourhoods, with room inventory, guest stays, reviews and enquiry records.
- **Renamed room types:** e.g. `Classic Queen Room`, `Queen Classic` and `Heritage Queen` are mapped to canonical names. The original `sourceLabel` remains stored for audit.
- **Mixed INR/USD rates:** each imported room retains its native `basePrice` and `currency`. `priceInr` is normalized using `FX_USD_INR` (demo default **₹83.50 per USD**) for search and analytics. A new conversion rate is a deployment/import setting, not a claim about a live FX quote.
- **Invalid stays:** two source records have check-out before check-in. They are placed in `ImportIssue`, excluded from availability and revenue/occupancy math, and can be marked reviewed in the front desk.
- **KPI definitions:** occupancy = occupied room-nights / available room-nights; ADR = room revenue / occupied room-nights; RevPAR = room revenue / available room-nights. The dashboard uses trailing 7, 30 or 90 days, reports INR, and excludes cancelled and quarantined stays.

## API documentation

- OpenAPI 3.1 specification: [`openapi.yaml`](./openapi.yaml)
- Architecture and request flow: [`docs/architecture.md`](./docs/architecture.md)
- Health check: `GET /api/health`

All JSON API responses use `{ "data": ... }`; errors use `{ "error": { "code", "message", "details?", "requestId" } }`.

### Main endpoints

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/signup`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me` |
| Catalog | `GET /api/properties`, `GET /api/properties/:slug`, `POST /api/properties/reviews` |
| Guest stays | `POST /api/bookings`, `GET /api/bookings/mine`, `PATCH /api/bookings/:id/cancel` |
| Enquiries | `POST /api/inquiries` |
| Front desk | `/api/admin/metrics`, `/properties`, `/room-types`, `/bookings`, `/inquiries`, `/import-issues`, `/upload` |

Admin endpoints require an access JWT with the `admin` role. Property, room-type and booking mutations are protected; booking totals are derived from the server’s current rate, never trusted from the browser.

## Deploy

### Render API + PostgreSQL

1. Push the repository to your GitHub account.
2. In Render, create a Blueprint from the repository. [`render.yaml`](./render.yaml) provisions the API service and managed PostgreSQL database, generates `JWT_SECRET`, generates Prisma Client, and applies database migrations before deploy.
3. Set `CLIENT_ORIGIN` to the exact Vercel site origin (for example `https://serein-stays.vercel.app`). Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` for the initial admin.
4. After the first service deploy, run **once** in the Render Shell:

   ```bash
   npm run db:seed --workspace=server
   ```

   The seed is intentionally a one-time action and refuses to overwrite an existing property set. If you want the optional email queue, provision Redis, set `REDIS_URL`, SMTP credentials, `EMAIL_FROM`, and optionally `FRONT_DESK_EMAIL`. Without Redis/SMTP, bookings and enquiries still complete normally.
5. Verify `https://<your-render-service>/api/health` reports `mode: "postgres"`.

### Vercel frontend

1. Import the same repository into Vercel. The root `vercel.json` configures the `client/dist` output; the root `api/[...path].js` function proxies `/api/*` to Render so the browser uses one origin.
2. Add the Vercel server-side environment variable `API_ORIGIN=https://<your-render-service>.onrender.com` (origin only). Set the build-time `VITE_API_URL=/api` or leave it unset. This keeps refresh cookies first-party on the Vercel site while forwarding API calls to Render.
3. Deploy and copy the exact site origin into the Render service’s `CLIENT_ORIGIN`, then redeploy the API. HTTPS is required for the production `Secure` refresh cookie. If you bypass the Vercel proxy and call Render directly from a `vercel.app` domain, some browsers may block third-party cookies; use the proxy or same-site custom domains.

`.env`, uploads and dependency/build directories are git-ignored. Do not commit secrets, production admin passwords, database URLs or SMTP credentials. The Render upload directory is ephemeral by default: for durable property media, replace the local upload adapter with S3/R2 or another object store before production use.

## Scaling the weakest part

The first bottleneck is **read-side aggregation**, not React rendering. The demo and current repository abstraction load properties, rooms, reviews and bookings into Node before filtering/search/KPI calculations. That keeps the initial build easy to inspect and works for 14 properties, but the cost grows with every stay record.

I would scale it in this order:

1. Move search, availability and date-window KPI aggregation into indexed PostgreSQL queries; add indexes on `(propertyId)`, `(roomTypeId, status, checkIn, checkOut)`, `checkIn`, `checkOut`, and booking creation time. Paginate admin lists.
2. Add a daily per-property/per-room-type fact table or materialized view for room-nights, revenue, occupancy, ADR and RevPAR. Refresh incrementally from stay events; use Redis for hot search filters, not as the inventory source of truth.
3. The current per-room-type advisory lock guarantees no oversell but serializes same-room-type bookings across all dates. For high traffic, replace it with per-night inventory rows/counters (transactional conditional decrements or row locks on `(roomTypeId, stayDate)`), and make temporary holds expire. Keep the final commit in PostgreSQL.
4. Put uploads in object storage + CDN, run BullMQ workers as a separate service, and use a transactional outbox for reliable booking/email events. Add tracing and database pool limits before horizontal API autoscaling.

## Project layout

```text
client/                 React + Vite guest and front-desk experience
server/src/             Express API, auth, routes, memory/Postgres stores, jobs
server/prisma/           PostgreSQL schema, migration and seed command
server/tests/            Unit and API tests
.github/workflows/       Push/PR CI
openapi.yaml             OpenAPI 3.1 endpoint contract
docs/architecture.md    Mermaid architecture and request path
render.yaml              Render API/database blueprint
api/[...path].js         Same-origin Vercel proxy (keeps refresh cookies first-party)
vercel.json              Vercel static frontend build configuration
```
