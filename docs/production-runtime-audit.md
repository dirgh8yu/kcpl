# KCPL production runtime audit

## Purpose

KCPL now has a management-only runtime readiness probe at `GET /api/admin/readiness`. It reports configuration state only and never returns secret values, API keys, Firebase project identifiers, or bucket names.

## Core blockers

The deployed runtime is considered blocked when any of these controls are missing or invalid:

- Firebase Admin runtime configuration.
- A default Firebase Storage bucket for Document Vault and Paper Archive workflows.
- `NEXT_PUBLIC_SITE_URL` set to the canonical HTTPS production origin, without a path.
- `KCPL_AUTOMATION_SECRET` with at least 32 characters.

## Integration warnings

These integrations are operationally useful but do not make the whole KCPL runtime unavailable when absent:

- Google Places autocomplete.
- Google Routes road estimates.
- SendGrid transactional email.
- Bootstrap/recovery admin allowlist when active Firestore staff profiles already exist.

## Canonical production runtime — decided

**Firebase App Hosting is the single canonical production runtime.** The OpenAI/Cloudflare
deployment path is demoted: it is not a second opinion on the same application, and it must not
be read as one.

Evidence for the decision:

- `apphosting.yaml` is committed and the runtime is written to consume Firebase-injected
  configuration (Admin SDK, Storage bucket, Secret Manager).
- Firebase App Hosting rollouts succeed — `App Hosting - Rollout (kcpl-82574/asia-southeast1/kcpl)`
  is green on every commit in the available history.
- The Cloudflare Workers build has **failed on every commit**, including commits whose
  `KCPL CI / quality` check passed. It has never been green, so it has never been a signal.
- Vercel **also deploys this repository, including to a `Production` environment on every push
  to `main`** (deployment records exist for `dd18274`, `5651e94`, `79c1584`, `8ab499d3` — all
  `main` commits — alongside `Preview` deployments on PR heads). It is green, so unlike
  Cloudflare it is *currently serving*. Two successful production deployers is the drift this
  document exists to prevent, and it is not what "single canonical runtime" means in practice.
- The repository contains no `wrangler`, `open-next`, `vercel.json` or Cloudflare/Vercel build
  configuration. Both secondary pipelines are configured outside Git, and the stale repo-side
  binding (`.openai/hosting.json`, an OpenAI project id plus a D1 database) has been removed.

Consequences:

- A green `KCPL CI / quality` run and a successful hosting rollout are separate gates. A failing
  Cloudflare build is not an application regression.
- Firebase-injected environment variables do not exist on a non-Firebase host; do not assume they
  do when debugging anywhere else.
- `KCPL_ALLOWED_ORIGINS` and the application security configuration must name the Firebase App
  Hosting origin, not a second host.

Still outstanding, and only resolvable in the hosting dashboards — this is the one item in this
document that cannot be completed from the repository:

1. **Vercel** — decide whether it is the canonical runtime or a demoted one. If Firebase App
   Hosting stays canonical, disconnect the Vercel project's production branch (or demote it to
   preview-only) so `main` is not deployed twice. Whichever wins, the other must be demoted
   *before* `NEXT_PUBLIC_SITE_URL` and `KCPL_ALLOWED_ORIGINS` are pointed at an origin.
2. **Cloudflare Workers** — disconnect the build so a permanently red check stops masking real
   ones. It has never been green and carries no application signal.

Until (1) is settled, "the canonical origin" is ambiguous, so setting `NEXT_PUBLIC_SITE_URL` to
it would be a guess rather than a configuration step.

## Release controls in force

Recorded so the state is discoverable rather than tribal:

- `main` is protected. Pull requests are required before merge, and `KCPL CI / quality` must pass.
- Force-pushes and branch deletion are blocked on `main`.
- `enforce_admins` is off, so an administrator keeps a deliberate break-glass path; use it only
  for a rollback, and say so in the PR.
- No approving review is required, because a sole maintainer cannot approve their own pull
  request. Stale reviews are dismissed when new commits land.

## Public endpoint abuse controls

`POST /api/quotes` is the only endpoint the public internet can write to. Three layers
protect it, in this order: field validation and a honeypot, an attestation check, then a
durable rate limit. The first and third are always on; the attestation is opt-in.

| Setting | Where | Effect when absent |
|---|---|---|
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | App Hosting runtime | The attestation step reports `not_configured` and is skipped. No third-party call is made. |
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Build-time public env | The form asks for no token and loads no third-party script. Set it together with the secret. |
| `KCPL_RATE_LIMIT_SALT` | App Hosting runtime | Counters are still hashed, but a fixed default label is used. Setting it makes the stored keys useless to anyone hashing a known address to confirm a guess. |

Rate-limit subjects are stored hashed in the `quote_rate_limits` collection, so no raw IP or
email address is kept. Give `quote_rate_limits.expires_at` a Firestore TTL policy and the
counters expire without a scheduled job.

The attestation fails open if Cloudflare cannot be reached, and refuses only on an explicit
rejection: provider unavailability is not evidence that a customer is a bot, and the rate limit
still bounds abuse either way. The rate limiter fails open for the same reason — it shares
Firestore with the write it guards, so an unreachable store already means the enquiry cannot be
saved, and refusing it would only break the sales funnel.

## Management export data integrity

`GET /api/admin/management/export` hands Management a CSV that is opened in Excel or Sheets,
which makes every field inside it a potential spreadsheet formula. Quoting commas and quotes is
not sufficient: a cell beginning with `=`, `+`, `-`, `@`, a tab or a carriage return is treated
as a formula, so a customer name or an origin supplied by a user could execute on the machine
of whoever opens the export.

The cell policy in `app/admin/management/csv-export-policy.ts` neutralises a text cell with a
leading apostrophe, which spreadsheet software reads as "this is text". Numeric columns stay
numeric — a genuine number is emitted bare, so `-1234.5` in a revenue column still sums — while
a *string* that merely looks numeric is treated as text, because a string reaching the export
came from data KCPL does not control. Behaviour is pinned by
`tests/csv-export-policy.test.mjs`.

## Verification sequence

1. Deploy the candidate commit to the intended production host.
2. Sign in as Management.
3. Request `/api/admin/readiness` from the same authenticated browser session.
4. Require `readiness.overall` to be `ready` for the core runtime.
5. Resolve any warning for an integration that KCPL expects to use in production.
6. Smoke-test authentication, Document Vault upload/download, automation, email, Places and Routes against that same host.
