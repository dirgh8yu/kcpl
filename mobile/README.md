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

## Two apps, one codebase

This project builds two apps that share their sign-in, design system and motion:

| App | Who | Entry point | Android flavour | Package |
|---|---|---|---|---|
| **KCPL** | Customers | `lib/main.dart` | `customer` | `np.com.kapileshworcargo.kcpl_customer` |
| **KCPL Ops** | KCPL staff | `lib/ops/main.dart` | `ops` | `np.com.kapileshworcargo.kcpl_ops` |

Android needs both `--flavor` and `-t`:

```sh
flutter run   --flavor customer -t lib/main.dart     --dart-define=KCPL_FIREBASE_API_KEY=<key>
flutter run   --flavor ops      -t lib/ops/main.dart --dart-define=KCPL_FIREBASE_API_KEY=<key>
flutter build appbundle --release --flavor ops -t lib/ops/main.dart --dart-define=KCPL_FIREBASE_API_KEY=<key>
```

iOS has no flavours configured yet. Building KCPL Ops for iOS needs an Xcode scheme and
bundle id of its own, which is a one-time setup on a Mac. Until then `-t lib/ops/main.dart`
builds it under the customer bundle id, for testing only.

### KCPL Ops

The staff app is the operations desk in a pocket. It talks to `/api/mobile/ops/v1`:

- **Today:** the command centre. Your most pressing job leads, drawn as a journey card,
  followed by the day's figures and your jobs. Anything in trouble comes next, and each
  branch's load is a bar with its urgent share in crimson.
- **Jobs:** every active job in your branches. It starts on your own work, with the web's
  filters (Mine, All, Urgent, Overdue, Customs, Exceptions) and search.
- **Job detail:** the journey, the owner with one-tap call and WhatsApp, tasks and
  customs steps you can tick, what stands between the job and closeout, notes and
  details. Profitability appears only for roles that manage costs.
- **Alerts:** the web notification centre's feed. Opening an alert marks it read and
  goes to its job; the tab badge counts unread.
- **Me:** role, branches and sign-out.

Access is the web admin's own: a Firebase login that `isAuthorizedAdminUser` accepts, with
role, permissions and branch scope from `getStaffContext`. The app can change three things:
tick a task, tick a customs step, and mark an alert read. Ticking goes through the same
guarded function the web Job File uses. A tick shows at once and is saved behind it; if the
server refuses, it comes back off and says why. Anything else (assigning, closing,
costs) stays on the web for now.

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

### Motion

Every animation has a job, and all of them draw on one set of curves and durations
(`lib/ui/motion.dart`):

| Where | What it does |
|---|---|
| Sign-in | Assembles top to bottom on launch. The crimson button presses in, and its label morphs into a spinner. A wrong password shakes the fields with a haptic buzz. |
| Sign-in → app | Fades up with a slight settle instead of cutting. |
| Every screen | Content fades up in a 40ms stagger when it arrives; the skeleton shimmers while loading. A refresh updates in place. |
| Overview → shipment | The journey card flies into the detail page (a shared element), and the detail page draws its journey on the first frame from what the list already knew. |
| Journey line | Fills to the current stage once per shipment per session; a soft ring pulses around the moving vehicle. |
| Figures and balances | Count up when they first appear. |
| Controls | Checkmarks pop, the download arrow turns into a spinner and then a tick, the chosen tab's icon pops, and lists crossfade on a filter change. |

Tab switching and language changes stay instant, as native apps keep them.

With the system's Reduce Motion setting on, nothing moves or loops and only short fades
remain. The flow tests run under that setting, so a looping animation that ignored it
would hang them. Two further tests run with full motion: the shared-element flight, and
the crimson button with its shake.

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
