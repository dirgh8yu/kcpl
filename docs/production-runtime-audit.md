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

## Hosting finding

The repository contains Firebase App Hosting configuration and the application runtime is written to consume Firebase-injected configuration. A separate OpenAI/Cloudflare hosting project is also attached to the repository, and the Cloudflare Workers deployment for the Document Vault 3E2 commit failed while KCPL CI passed.

Until one production host is explicitly designated as canonical, treat a green application CI run and a successful hosting rollout as separate gates. Do not interpret a Cloudflare deployment failure as an application regression when Firebase App Hosting is the intended runtime, and do not assume Firebase-injected environment variables exist on a non-Firebase host.

## Verification sequence

1. Deploy the candidate commit to the intended production host.
2. Sign in as Management.
3. Request `/api/admin/readiness` from the same authenticated browser session.
4. Require `readiness.overall` to be `ready` for the core runtime.
5. Resolve any warning for an integration that KCPL expects to use in production.
6. Smoke-test authentication, Document Vault upload/download, automation, email, Places and Routes against that same host.
