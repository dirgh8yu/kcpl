# Kapileshwor Cargo Pvt. Ltd.

Production website for KCPL, a freight-forwarding and logistics company established in Kathmandu, Nepal.

## Stack

- Next.js App Router via Vinext
- React and TypeScript
- Tailwind CSS
- Motion
- Lucide icons
- Cloudflare/Sites hosting
- Cloudflare D1 for freight quote enquiries and internal quote workflow
- Sign in with ChatGPT for protected KCPL admin access

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

## Environment

Copy `.env.example` to the appropriate local or hosting environment and set values there. Do not commit real secrets.

- `NEXT_PUBLIC_SITE_URL`: canonical production origin without a trailing slash.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID. Analytics loads only in production and only after visitor consent.
- `KCPL_ADMIN_EMAILS`: required for `/admin`. Comma-separated ChatGPT account emails authorised to access the KCPL operations dashboard. The dashboard denies access when this value is empty.

## Quote backend

The `/quote` form submits JSON to `POST /api/quotes`. The route validates the request server-side, generates a reference in the form `KCPL-Q-YYYYMMDD-XXXXXXXX`, and stores the enquiry in Cloudflare D1.

The hosting manifest requests the database as the `DB` D1 binding. The API also creates the quote table and indexes if they do not yet exist. The equivalent schema is kept in `migrations/0001_quote_enquiries.sql` for review and future database management.

Stored quote fields include route, freight mode, cargo details, requested timing, handling notes and customer contact information. New records start with the status `new`.

If the database binding is unavailable or submission fails, the public quote page keeps a pre-filled email fallback so the customer is not trapped by an infrastructure problem.

## KCPL operations dashboard

`/admin` is the private quote desk for KCPL staff. Authentication uses the hosting platform's Sign in with ChatGPT flow, followed by an explicit email allowlist from `KCPL_ADMIN_EMAILS`. A signed-in account that is not allowlisted cannot access quote data or the protected admin API.

The dashboard provides:

- Searchable quote inbox with status filters
- Full route, cargo and customer details
- Workflow states: `new`, `reviewing`, `quoted`, `won`, `lost`
- Assignment to a staff member or branch
- Timestamped private notes recording the signed-in admin who added each note

Admin workflow metadata and notes are stored in D1 tables defined by `migrations/0002_admin_workspace.sql`. The protected `/api/admin/quotes/[reference]` endpoint reads and updates these records after checking admin authorisation.
