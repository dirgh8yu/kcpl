# Kapileshwor Cargo Pvt. Ltd.

Production website for KCPL, a freight-forwarding and logistics company established in Kathmandu, Nepal.

## Stack

- Next.js App Router via Vinext
- React and TypeScript
- Tailwind CSS
- Motion
- Lucide icons
- Cloudflare/Sites hosting

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

`npm test` performs a production build and verifies the rendered homepage, company information, service routes, launch metadata, privacy content and not-found response.

## Environment

Copy `.env.example` to the appropriate local or hosting environment and set values there. Do not commit real secrets.

- `NEXT_PUBLIC_SITE_URL`: canonical production origin without a trailing slash.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID. Analytics loads only in production and only after visitor consent.

The website currently uses an email-draft enquiry flow and has no form-submission backend or database.
