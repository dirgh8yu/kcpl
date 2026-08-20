# Kapileshwor Cargo Pvt. Ltd. (KCPL)

KCPL's public website and private freight operations system. The application is a Next.js App Router project with Firebase-backed authentication, operational data and private document storage.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Motion
- Lucide icons
- Firebase Authentication for KCPL staff sign-in
- Cloud Firestore for enquiries, CRM, shipments, Digital Job Files, finance and operational records
- Firebase Storage for private shipment/customer documents
- Firebase App Hosting as the intended production web runtime

## Local development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
```

The local app is served at `http://localhost:3000`.

## Quality gate

Before a production merge:

```bash
npm run lint
npx tsc --noEmit
npm test
```

GitHub Actions runs the same lint, type-check and production-build gate for pull requests and pushes to `main`.

## Firebase App Hosting

This repository is prepared for Firebase App Hosting with `apphosting.yaml`. The file contains only portable Cloud Run runtime limits; it intentionally contains no Firebase project ID, API key or secret.

### One-time Firebase Console setup

1. Open the Firebase project that already contains KCPL Authentication / Firestore / Storage.
2. Go to **Hosting & Serverless → App Hosting**.
3. Create an App Hosting backend and connect GitHub repository `dirgh8yu/kcpl`.
4. Use `/` as the app root because `package.json` is at the repository root.
5. Use `main` as the live branch.
6. Keep automatic rollouts enabled.
7. Create/select the Firebase Web App for this backend.
8. Add the KCPL environment values required by the deployment, especially `NEXT_PUBLIC_SITE_URL` and `KCPL_ADMIN_EMAILS`.
9. Finish the backend setup and deploy.

After that one-time connection, a successful push/merge to the configured live branch can trigger a Firebase App Hosting build and rollout automatically. Rollout/build history is visible in the App Hosting backend dashboard.

Do **not** add `.firebaserc` with a guessed project ID. Project association should come from the real Firebase backend connection.

## App Hosting runtime configuration

`apphosting.yaml` currently uses a low-idle-cost baseline:

- `minInstances: 0`
- `maxInstances: 10`
- `concurrency: 80`
- `memoryMiB: 512`

These values can be adjusted later from source control if KCPL traffic or workload changes.

## Firebase resources

`firebase.json` remains the source configuration for Firestore and Storage security rules:

- `firestore.rules`
- `storage.rules`

The hosted Next.js app uses Firebase SDK configuration provided by the App Hosting environment. Sensitive credentials and service-account JSON must not be committed to Git.

## Environment variables

See `.env.example` for the portable environment contract.

Important values include:

- `NEXT_PUBLIC_SITE_URL`: canonical production origin without a trailing slash.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID.
- `KCPL_ADMIN_EMAILS`: comma-separated Firebase Authentication emails allowed to bootstrap KCPL admin access.
- `SEARATES_FREIGHT_INDEX_API_KEY`: dormant/optional legacy adapter variable; no live market-rate feature should depend on it unless the integration is deliberately re-enabled.

Firebase App Hosting injects Firebase runtime configuration for the hosted environment. Local development outside Google infrastructure may require explicit local Firebase configuration / Application Default Credentials.

## KCPL Operations

`/admin` is the private operations product for authorised KCPL staff. Role and branch permissions are enforced server-side after Firebase Authentication.

Core workspaces include:

- Operations Home
- Enquiries and quote pricing
- Shipments and tracking
- Digital Job Files
- Tasks & operational alerts
- Customer CRM / Customer 360
- Partners & vendors
- Accounts Receivable
- Accounts Payable
- Job profitability
- Management analytics
- Staff & branch access

The UI is intentionally one light, warm operations system rather than separate dark dashboards. Record IDs, shipment references, AWBs/BL-style references and system keys use monospace treatment for fast scanning.

## Security notes

- Never commit production secrets, private keys or service-account JSON.
- Authentication is Firebase-backed; passwords are not stored in this repository.
- Role/branch access must be checked server-side, not only hidden in the UI.
- Commercial, credit and job-cost data are redacted for roles that are not permitted to view them.
- Private documents are served through protected admin APIs rather than public tracking routes.
