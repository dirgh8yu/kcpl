# Kapileshwor Cargo Pvt. Ltd.

Production website for KCPL, a freight-forwarding and logistics company established in Kathmandu, Nepal.

## Stack

- Next.js App Router via Vinext
- React and TypeScript
- Tailwind CSS
- Motion
- Lucide icons
- Cloudflare Workers hosting
- Cloudflare D1 for freight quote enquiries and internal quote workflow
- Secure KCPL admin session authentication

## Local development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
```

The local site is served at `http://localhost:3000`.

## Quality checks

```bash
npm run lint
npx tsc --noEmit
npm test
```

`npm test` performs a production build and verifies the rendered homepage, company information, service routes, quote experience, protected admin route, launch metadata, privacy content and not-found response.

## Cloudflare Workers deployment

The root `wrangler.jsonc` is the source of truth for the free Cloudflare deployment. It enables the public `workers.dev` route and declares a D1 database binding named `DB`. Cloudflare can automatically provision that D1 resource on the first deployment because the binding intentionally has no account-specific database ID committed to Git.

Build the Vinext app, then deploy the generated Worker configuration:

```bash
npm run deploy
```

For Cloudflare Git integration, connect the GitHub repository and use `main` as the production branch. A successful deployment receives an address in the form:

```text
https://kapileshwor-cargo.<cloudflare-account-subdomain>.workers.dev
```

Set `NEXT_PUBLIC_SITE_URL` to that final origin in the Cloudflare build environment. A custom domain can be attached later without changing the application architecture.

## Environment and secrets

Do not commit real secrets. Configure sensitive values in Cloudflare Worker settings.

- `NEXT_PUBLIC_SITE_URL`: canonical production origin without a trailing slash.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID. Analytics loads only in production and only after visitor consent.
- `KCPL_ADMIN_PASSWORD`: required private password for `/admin`.
- `KCPL_ADMIN_SESSION_SECRET`: required high-entropy secret used to sign short-lived admin session cookies.
- `KCPL_ADMIN_NAME`: optional administrator display name used in the operations dashboard and private note attribution.
- `KCPL_ADMIN_EMAIL`: optional administrator email used for private note attribution.

The admin password and session secret should be configured as encrypted Worker secrets rather than plaintext repository variables.

## Quote backend

The `/quote` form submits JSON to `POST /api/quotes`. The route validates the request server-side, generates a reference in the form `KCPL-Q-YYYYMMDD-XXXXXXXX`, and stores the enquiry in Cloudflare D1.

The Worker requests the database as the `DB` D1 binding. The API also creates the quote table and indexes if they do not yet exist. The equivalent schema is kept in `migrations/0001_quote_enquiries.sql` for review and future database management.

Stored quote fields include route, freight mode, cargo details, requested timing, handling notes and customer contact information. New records start with the status `new`.

If the database binding is unavailable or submission fails, the public quote page keeps a pre-filled email fallback so the customer is not trapped by an infrastructure problem.

## KCPL operations dashboard

`/admin` is the private quote desk for KCPL staff. Authentication uses a KCPL administrator password stored only in the Cloudflare runtime. A successful login creates a signed, `HttpOnly`, `Secure`, `SameSite=Strict` session cookie with a 12-hour lifetime. The protected admin API checks the same signed session before returning or modifying quote data.

The dashboard provides:

- Searchable quote inbox with status filters
- Full route, cargo and customer details
- Workflow states: `new`, `reviewing`, `quoted`, `won`, `lost`
- Assignment to a staff member or branch
- Timestamped private notes with configured administrator attribution

Admin workflow metadata and notes are stored in D1 tables defined by `migrations/0002_admin_workspace.sql`. The protected `/api/admin/quotes/[reference]` endpoint reads and updates these records only after checking admin authorisation.
