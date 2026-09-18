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
- The repository contains no `wrangler`, `open-next` or Cloudflare build configuration. The
  secondary pipeline is configured outside Git, and its stale repo-side binding
  (`.openai/hosting.json`, an OpenAI project id plus a D1 database) has been removed.

Consequences:

- A green `KCPL CI / quality` run and a successful hosting rollout are separate gates. A failing
  Cloudflare build is not an application regression.
- Firebase-injected environment variables do not exist on a non-Firebase host; do not assume they
  do when debugging anywhere else.
- `KCPL_ALLOWED_ORIGINS` and the application security configuration must name the Firebase App
  Hosting origin, not a second host.

Still outstanding, and only resolvable in the hosting dashboards: disconnect the Cloudflare
Workers build from the repository so a permanently red check stops masking real ones.

## Release controls in force

Recorded so the state is discoverable rather than tribal:

- `main` is protected. Pull requests are required before merge, and `KCPL CI / quality` must pass.
- Force-pushes and branch deletion are blocked on `main`.
- `enforce_admins` is off, so an administrator keeps a deliberate break-glass path; use it only
  for a rollback, and say so in the PR.
- No approving review is required, because a sole maintainer cannot approve their own pull
  request. Stale reviews are dismissed when new commits land.

## Verification sequence

1. Deploy the candidate commit to the intended production host.
2. Sign in as Management.
3. Request `/api/admin/readiness` from the same authenticated browser session.
4. Require `readiness.overall` to be `ready` for the core runtime.
5. Resolve any warning for an integration that KCPL expects to use in production.
6. Smoke-test authentication, Document Vault upload/download, automation, email, Places and Routes against that same host.
