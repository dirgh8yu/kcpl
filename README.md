# Kapileshwor Cargo Pvt. Ltd.

Production website for KCPL, a freight-forwarding and logistics company established in Kathmandu, Nepal.

## Stack

- Next.js App Router via Vinext
- React and TypeScript
- Tailwind CSS
- Motion
- Lucide icons
- Cloudflare/Sites hosting
- Cloudflare D1 for freight quote enquiries

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

`npm test` performs a production build and verifies the rendered homepage, company information, service routes, quote experience, launch metadata, privacy content and not-found response.

## Environment

Copy `.env.example` to the appropriate local or hosting environment and set values there. Do not commit real secrets.

- `NEXT_PUBLIC_SITE_URL`: canonical production origin without a trailing slash.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID. Analytics loads only in production and only after visitor consent.

## Quote backend

The `/quote` form submits JSON to `POST /api/quotes`. The route validates the request server-side, generates a reference in the form `KCPL-Q-YYYYMMDD-XXXXXXXX`, and stores the enquiry in Cloudflare D1.

The hosting manifest requests the database as the `DB` D1 binding. The API also creates the quote table and indexes if they do not yet exist. The equivalent schema is kept in `migrations/0001_quote_enquiries.sql` for review and future database management.

Stored quote fields include route, freight mode, cargo details, requested timing, handling notes and customer contact information. New records start with the status `new`.

If the database binding is unavailable or submission fails, the public quote page keeps a pre-filled email fallback so the customer is not trapped by an infrastructure problem.
