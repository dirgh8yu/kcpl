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

# Against production, on its App Hosting address
# (https://kcpl--kcpl-82574.asia-southeast1.hosted.app; point KCPL_API_BASE
# elsewhere for a preview deployment):
flutter run --dart-define=KCPL_FIREBASE_API_KEY=<web API key>

# With built-in sample data and no network, for screenshots and design review:
flutter run --dart-define=KCPL_DEMO=true
```

The **web API key** is in Firebase console → Project settings → General. It's the same
key App Hosting injects into the website. It is not a secret: it identifies the Firebase
project, and KCPL's server decides access.

A build with neither define shows a "not configured" screen instead of guessing.

## Getting the Android apps onto a phone

GitHub builds them: `.github/workflows/mobile-apps.yml` runs whenever the app changes
(or from the Actions tab → *KCPL apps (Android)* → *Run workflow*). Open the finished
run, download **kcpl-android-apps** under *Artifacts*, unzip it, copy an APK to the
phone and open it. Android asks once to allow installs from that source.

| File | What it is |
|---|---|
| `KCPL.apk`, `KCPL-Ops.apk` | The real apps, signing in against the live site |
| `KCPL-demo.apk`, `KCPL-Ops-demo.apk` | Sample data, no account needed (they replace the real app of the same name) |

The real builds need two repository secrets (Settings → Secrets and variables →
Actions). Neither is kept in the code:

- `KCPL_FIREBASE_API_KEY`: the Firebase **Web API key** (Firebase console → Project
  settings → General). Without it, only the demo apps are built.
- `GOOGLE_SERVICES_JSON`: the whole contents of `google-services.json` downloaded after
  adding both Android apps in Firebase. Without it, push notifications stay off.

These APKs are debug-signed, for installing directly. Store releases need the signing
key described below.

## Before the first real build

1. **Deploy the API first.** `/api/mobile/v1` must be live on the site the app points at.
   Until then, every call fails.
2. **Check the API key's restrictions.** If the web key is restricted to HTTP referrers
   in Google Cloud console → APIs & Services → Credentials, sign-in from the app fails.
   Create a separate key for the app that is restricted to the Android package
   (`np.com.kapileshworcargo.kcpl_customer` plus the signing SHA-1) and the iOS bundle
   id, allowing only *Identity Toolkit API* and *Token Service API*.
3. **Release signing.** Android needs an upload keystore and iOS needs an Apple
   developer team. Neither is in this repository, by design. For Android, put the
   keystore's details in `android/key.properties` (git-ignored):

   ```properties
   storeFile=/absolute/path/to/upload-keystore.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```

   Without that file a release build is signed with the debug key, which the Play
   Store rejects.
4. **Push notifications.** See *Push notifications* below. A build without the
   Firebase files runs normally and shows push as "Not available in this build".

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
| `lib/ui/` | Screens and widgets. `AsyncPage` gives every screen the same large collapsing title, skeleton, failure, retry and pull-to-refresh behaviour. `lib/ui/map/` holds the route map; its data is `assets/map/asia.kmap`. |
| `lib/l10n/` | Generated. **Don't edit the ARB files by hand.** |

### Design

Quiet, in the manner of the best ride-hailing and banking apps: white (true black in dark
mode), grey for hierarchy, and crimson only where something has gone wrong, on the sign-in
button and in the K. Status is written as words, never shown as a coloured pill.

- **Type:** Inter, bundled, on one small scale. Page titles are 28pt (17pt once collapsed),
  section titles 17pt, reading text 15pt and secondary text 13pt. Figures are 20pt.
  Hierarchy comes from weight and grey, not size.
- **The shipment card** (`lib/ui/widgets/shipment_card.dart`): the shipment or job that matters
  most leads each home screen as one white card. Its route is on the map at the top, and
  three lines sit below: from and to with the date, the reference, and the status. The
  same card heads the detail page and moves there as a shared element.
- **The map** (`lib/ui/map/`): drawn the way ride-hailing apps draw theirs. It shows pale
  land, soft water, white roads, rivers, borders and small grey town names. The route is
  in ink from origin (a dot) to destination (a square), grey behind the cargo, and the
  cargo is a small disc with its mode. Both ends carry an ink label. It is drawn from
  bundled data (about 480 KB), so it needs no map service, API key or network. Places are
  matched by the names desks write ("Birgunj ICD", "Kathmandu (TIA)"). When either end is
  unknown, the card shows a plain progress line instead of guessing.
- **Figures** (`lib/ui/widgets/stats.dart`): four small figures in one card, split by
  hairlines.
- **Chrome:** a plain frosted tab bar with grey outline icons and the chosen tab in ink.
  Detail pages open as sheets that you pull down from the top to close. Icons are 18pt
  in rows and 22pt in the tab bar, with nothing behind them. Cards have a hairline edge and
  no shadow.

Tabs keep their state and scroll position, and selection changes give a light haptic
tick.

### Motion

Motion follows Emil Kowalski's rules: every animation has a purpose, anything seen tens
of times a day barely moves, UI stays under 300ms, entrances and exits ease out, and data
people read never moves for style. Curves and durations live in `lib/ui/motion.dart`
(`easeOut` 0.23, 1, 0.32, 1; `drawer` 0.32, 0.72, 0, 1; press 100ms, release 160ms,
reveal 300ms, stagger 40ms).

| Where | What it does | Why |
|---|---|---|
| Launch | The K's strokes assemble, then a crimson charge cycles (1s) until the app is ready. | Status; rare |
| Sign-in | KCPL's lanes into Nepal move on the map behind the form. The crimson button presses in and its label becomes the charging K. A wrong password shakes the fields (400ms) with a haptic. | Rare, so it may delight; feedback |
| Sign-in ↔ app | A 400ms fade with a slight scale. | Prevents a jarring swap |
| Pages | Content fades up 8px over 300ms, 40ms apart; skeletons shimmer while loading. Refreshes update in place. | Prevents teleporting content |
| Pull to refresh | The K assembles with the pull, a tick says release will refresh, and it charges while loading, then leaves in 200ms. | Feedback during the gesture |
| Detail sheets | Rise in 420ms (drawer curve), leave in 300ms. The page behind scales back and rounds, as iOS does. Pull down to close: after 10px the sheet follows the finger 1:1. A flick (over 0.11 px/ms) decides by its direction. A slow release decides by distance. It springs back from the finger's own velocity. | Spatial consistency; direct manipulation |
| Push banner | Drops in from the top, leaves the same way (200ms), and flicks up to dismiss. It rubber-bands if pulled down, and settles back if let go part-way. | Spatial consistency |
| Presses | Buttons and cards scale to 0.97 (cards 0.985) on touch-down. | Feedback |
| Checks and downloads | Icons crossfade from 0.9 scale in 180ms. | State change |

**Deliberately not animated:**
- Figures (no count-up), progress lines, the route on the map, and branch load bars: these are data.
- Tab switches: no pop and no haptic.
- The ticked-task burst: tens a day.
- The loops behind live items.

Haptics mark only meaningful moments: a tick, a success, an error, arming a refresh, and
closing a sheet.

With the system's Reduce Motion setting on, nothing moves or loops, and short fades
remain. The flow tests run under that setting, so a looping animation that ignored it
would hang them. Two further tests run with full motion: the shared-element flight, and
the crimson button with its shake.

The map data is Natural Earth 1:10m (public domain): land, lakes, rivers, roads,
borders and towns, clipped to South, East and South-East Asia and the Gulf. To rebuild
it, download the `ne_10m_*.geojson` files named in `tool/build_map_data.mjs` from
github.com/nvkelso/natural-earth-vector (the `geojson` folder) and run:

```sh
node mobile/tool/build_map_data.mjs <folder with the geojson files>
```

### Keeping current

There is one copy of the data: the apps read and write the same database as the website,
through the server, and store none of it on the phone. What can lag is a screen, so every
screen refreshes itself:

- every **60 seconds** while it is on show, the web register's own interval;
- on **coming back** to it (switching back to its tab, returning from a detail page,
  reopening the app) unless it loaded in the last 5 seconds;
- **never** while hidden: background tabs, covered pages and a closed app make no requests.

A refresh updates the page in place: numbers glide to their new values, with no skeleton
and no scroll jump. A failed background refresh keeps what is shown. Only the newest request
may land, so a slow reply can never overwrite a newer one, including across a customer
switch. The Ops alert badge counts unread every minute on every tab. `test/refresh_test.dart`
holds all of this on a fake clock.

### Push notifications

Both apps receive pushes through Firebase Cloud Messaging. The server decides what is
sent. It sends exactly what the web already would, so push is only a second transport:

- **KCPL:** the customer notification sweep (arrivals, customs, free time running
  out). Each fact is claimed once per recipient, so a phone, a laptop and an email each
  get it once.
- **KCPL Ops:** the notification centre's direct alerts (assignments, overdue tasks,
  customs, exceptions). Categories muted on the web stay muted on the phone. Register
  transitions are not pushed.

The app never asks for permission at launch. A one-time card on Overview (Today in
Ops) offers "Turn on", and only that tap brings up the system dialog. The switch in
Account (Me in Ops) turns push off without touching the phone's permission. Signing out
unregisters the phone, so the next person to sign in on it never receives the previous
person's alerts.

A push that arrives while the app is open drops in as a frosted banner, which you can
flick away. Tapping it, or tapping the system notification, opens the shipment or job.

To turn it on for real builds:

1. In the Firebase console, add an Android app for each package
   (`np.com.kapileshworcargo.kcpl_customer` and `np.com.kapileshworcargo.kcpl_ops`).
   Download the combined `google-services.json`. For GitHub builds, paste its contents
   into the `GOOGLE_SERVICES_JSON` secret. For local builds, put it in `android/app/`,
   where it is git-ignored. The Gradle plugin is applied only when the file is present.
2. Add the iOS app in Firebase, drop `GoogleService-Info.plist` into `ios/Runner/`
   through Xcode, and turn on the *Push Notifications* capability. Then upload an APNs
   key under Firebase → Project settings → Cloud Messaging.
3. The server needs nothing new. It sends with the App Hosting service account it
   already uses. Devices are stored in `mobile_push_devices`, and dead tokens are removed
   on the first failed send.

In the demo build (`KCPL_DEMO=true`), "Turn on" sends a sample push after four seconds.

### Launch, display and glass

- **Launch:** the native splash is the K on white (black in dark mode), made with
  `flutter_native_splash`. The app then takes over with the animated K: its three strokes
  assemble, then a crimson charge runs through them until the app is ready. The same K
  runs inside the sign-in button while it signs in. Under Reduce Motion it is a still K.
- **Display:** Android phones with 90 or 120Hz screens are asked for their highest refresh
  rate (`lib/platform/display.dart`). iOS ProMotion is enabled in `Info.plist`.
- **Glass:** only floating chrome is frosted: the tab bar, the title bar once it collapses,
  the pull-to-refresh K and the push banner. Content scrolls under them. Cards stay solid because they carry
  reading, not chrome. With the system's high-contrast setting on, glass turns solid.

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
handset. Inter and Inter Tight are also SIL OFL, and Phosphor is MIT; the licences are in
`assets/fonts/`.

## Checks

```sh
flutter analyze
flutter test
dart format -l 140 $(git ls-files "lib/*.dart" "test/*.dart" | grep -v /l10n/)   # house line length; l10n is generated
```

The widget tests sign in and walk every screen in English and Nepali at 1.6× system text
size. A layout overflow fails the test, so a long label can't clip on a real phone.

## Not in this version

- Uploads, payment receipts, delivery confirmation, freight requests and team
  management. These stay on the web portal.
- Offline cache. Each screen fetches live and says so plainly when it can't.
