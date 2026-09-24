# KCPL customer app

A native Flutter app for KCPL's customers: the customer portal's read side, on a phone.
It covers:

- sign-in and password reset (the same email and password as the web portal)
- the overview (KPIs, free time running out, paperwork KCPL is waiting on, balances)
- shipments with search and filters, and each shipment's milestones, free time, checklist
  and documents
- documents, with download to the phone's viewer
- invoices and invoice detail, for logins with finance access
- switching customer, for agents linked to several
- English and Nepali

It talks to KCPL's own site (`/api/mobile/v1`, see *Mobile app API* in
`docs/customer-portal.md`). The server decides everything a customer can see, so the app
can never show more than the web portal does.

## Running it

```sh
cd mobile
flutter pub get

# Against production (or a preview deployment via KCPL_API_BASE):
flutter run --dart-define=KCPL_FIREBASE_API_KEY=<web API key> \
            --dart-define=KCPL_API_BASE=https://kapileshworcargo.com.np

# With built-in sample data and no network, for screenshots and design review:
flutter run --dart-define=KCPL_DEMO=true
```

The **web API key** is in Firebase console → Project settings → General. It's the same
key App Hosting injects into the website. It is not a secret: it identifies the Firebase
project, and KCPL's server decides access.

A build with neither define shows a "not configured" screen instead of guessing.

## Before the first real build

1. **Deploy the API first.** `/api/mobile/v1` must be live on the site the app points at.
   Until then, every call fails.
2. **Check the API key's restrictions.** If the web key is restricted to HTTP referrers
   in Google Cloud console → APIs & Services → Credentials, sign-in from the app fails.
   Create a separate key for the app that is restricted to the Android package
   (`np.com.kapileshworcargo.kcpl_customer` plus the signing SHA-1) and the iOS bundle
   id, allowing only *Identity Toolkit API* and *Token Service API*.
3. **Release signing.** Android needs an upload keystore and iOS needs an Apple
   developer team. Neither is in this repository, by design.

```sh
flutter build appbundle --release --dart-define=KCPL_FIREBASE_API_KEY=<key>   # Play Store
flutter build ipa --release --dart-define=KCPL_FIREBASE_API_KEY=<key>         # App Store
```

## How it is put together

| Path | What it holds |
|---|---|
| `lib/auth/` | Firebase Auth over its REST API: sign-in, refresh and reset. The refresh token sits in Keychain / Keystore (`flutter_secure_storage`). ID tokens live only in memory and are renewed five minutes before expiry. Parallel screens share one refresh. |
| `lib/api/` | `KcplApi` and its HTTP client. Each call carries the bearer token and the chosen customer. A `401` is retried once with a forced refresh; a second `401` signs out. |
| `lib/demo/` | Invented sample data for `KCPL_DEMO` builds, labelled on screen. |
| `lib/app_controller.dart` | Signed-in state, chosen customer and language. Switching customer bumps a generation counter, and every open screen refetches rather than show the previous customer's data. |
| `lib/ui/` | Screens and widgets. `AsyncPage` gives every screen the same large collapsing title, skeleton, failure, retry and pull-to-refresh behaviour. |
| `lib/l10n/` | Generated. **Don't edit the ARB files by hand.** |

### Design

Black and white, with greys only for hierarchy (`Palette` in `lib/ui/theme.dart`), and dark
mode is true black. KCPL crimson is kept for four things: the brand mark, journey
progress, whatever needs the customer to act or is costing them money, and Sign out.
Status is written as words, never shown as a coloured pill.

The patterns come from apps that do this well:

- **Flighty:** a shipment is drawn like a flight, with big endpoints and a journey line
  the vehicle travels along.
- **Uber and Cash App:** black buttons, oversized numbers, no decoration.
- **Apple's own apps:** large titles that collapse as you scroll, full-width rows with
  inset hairlines, settings-style checkmarks, and a red destructive action.

Tabs keep their state and scroll position, and selection changes give a light haptic
tick.

### Strings

The Nepali is the web portal's own (`app/portal/portal-i18n.ts`), which was written for
how Kathmandu freight desks actually talk. The app reuses it rather than keeping a second
translation that would drift. After changing either side:

```sh
node --experimental-strip-types mobile/tool/sync_portal_strings.mjs   # from the repo root
cd mobile && flutter gen-l10n
```

Strings only the app needs live in that script with both languages side by side.

Dates and amounts are records and read the same in either language, as on the web. Nepali
renders in the bundled Noto Sans Devanagari (SIL OFL), so it looks the same on every
handset.

## Checks

```sh
flutter analyze
flutter test
```

The widget tests sign in and walk every screen in English and Nepali at 1.6× system text
size. A layout overflow fails the test, so a long label can't clip on a real phone.

## Not in this version

- Uploads, payment receipts, delivery confirmation, freight requests and team
  management. These stay on the web portal.
- Native push notifications. These need Firebase Cloud Messaging and the project's
  `google-services.json` / `GoogleService-Info.plist`.
- Offline cache. Each screen fetches live and says so plainly when it can't.
