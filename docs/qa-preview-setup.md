# Admin QA preview

How to bring up the staff product so its rendered markup can be read without
Firebase credentials, and what that unlocks.

## 1. Enable the bypass

Add one variable to the environment the dev server runs with — the workspace
`.env.local`, or **Settings → Environment** in Freebuff:

| Key | Value | Notes |
|---|---|---|
| `KCPL_QA_AUTH_BYPASS` | `true` | Exact string. Nothing else enables it (`1`, `TRUE`, `" true"` all do not.) |
| `KCPL_QA_EMAIL` | `qa@kcpl.local` | Optional; this is already the default. |

`app/admin/qa-auth-bypass.ts` then resolves a synthetic principal —
`KCPL QA` / `qa@kcpl.local` — and both authorization paths
(`getAdminAccess()` in `admin-auth.ts`, `getStaffContext()` in
`staff-directory.server.ts`) return a full Management context for it **before**
they check Firebase. `role: "management"`, `branch_scope: "all"`, every
capability. No Firebase project is needed to render the shell.

## 2. Start the server

```bash
npm run dev
```

`next dev` sets `NODE_ENV=development`, which is the second half of the guard.
No other configuration is required.

If the preview runs the way the platform starts it, the exact command is:

```bash
PORT=3000 sh -lc 'npm run dev'
```

## 2a. The preview must be served through the proxy origin

The hosted preview is reached at a proxy host like
`3000-<workspace-uuid>.daytonaproxy01.net`, not at `localhost:3000`. Next.js blocks
cross-origin requests to dev-only resources by default, so without an allowlist
entry the HTML arrives but every `_next/static/chunks/*.js` request is answered
`403 Unauthorized` — the page never hydrates and the sidebar, command palette and
accordions are inert.

`next.config.ts` therefore sets:

```ts
allowedDevOrigins: ["*.daytonaproxy01.net"]
```

This is development-only; `next build` and `next start` never consult it. If Next
logs `Blocked cross-origin request ... from "<some other host>"`, add that host to
the array — the warning prints the exact string to use.

## 3. Read what actually renders

```bash
npm run qa:render                      # auto-detects the port
npm run qa:render -- --routes /admin/command-centre
npm run qa:render -- --out .qa/render.json
```

The harness walks every route in `app/admin/workflow-navigation.ts`, fetches each
one, and reports the class names that reached the DOM — including which raw
utility literals (`bg-[#091624]`, `text-[#d4ad62]`, …) are actually rendered, and
whether `.kcpl-ops-overview` ever appears.

It exits non-zero if no route rendered the admin shell, which usually means the
bypass variable is not set on the server.

It is read-only: it issues GETs and writes nothing except the optional `--out`
report (`.qa/` is gitignored). It is deliberately not part of `npm test`, which
must stay offline.

## Why the bypass is safe to enable


- It is **structurally impossible in production**. `qaAuthBypassEnabled()` returns
  false unless `NODE_ENV === "development"`, and when `VERCEL_ENV` is present it is
  authoritative — only `preview` or `development` pass.
- The identity is fixed, not configurable: `KCPL_QA_EMAIL` can only change an email
  string, never the uid the bypass matches on.
- `tests/qa-auth-bypass.test.mjs` pins both the flag semantics and the **ordering**
  in both authorization paths, so a future refactor that moves the bypass below the
  Firebase check fails the suite instead of silently disabling preview QA.

## Verified 2026-09-18

Ran against a live preview with the bypass on:

- **28 of 30 routes** rendered the admin shell with the QA Management identity (all six branches, `isManagement: true`).
- `/admin` 307-redirects to `/admin/command-centre`; the inventory follows it.
- The proxy-origin fix was confirmed directly: a chunk request carrying the proxy `Origin` returns **200** (it was **403** before `allowedDevOrigins`), while an unrelated origin still returns **403**, so the dev-origin protection is intact.

### Known gaps this run exposed

**`/admin/staff` and `/admin/migration/recovery` return 500.** Both fail on the same Firebase
Admin initialisation error (`Unable to detect a Project Id in the current environment`), while
the other 26 routes degrade to a gate or empty state. So two routes cannot be inventoried.

- `app/admin/staff/page.tsx` already has the right fallback (`listStaffProfiles()` returning
  `null` renders "Staff directory unavailable"), but the throw happens inside
  `listStaffProfiles()` *before* that guard can apply.
- `app/admin/migration/recovery/page.tsx` has no guard at all.
- This is a resilience gap rather than a production bug: a configured runtime supplies the
  project id, so it only surfaces when Firebase is absent or briefly unavailable.

## Limits

The harness reads markup, not pixels. It can prove a class renders or does not, and
it can locate every raw literal by route, but it cannot judge colour. The
`bg-[#…]` → token migration still needs a human looking at one screen at a time,
because those compat rules sit in `@layer kcpl-legacy` and lose to Tailwind's own
arbitrary-value utilities — so swapping a literal for a token re-skins the element
rather than being a no-op. See `plans/admin-css-consolidation.md`.
