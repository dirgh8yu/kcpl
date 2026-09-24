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
| `lib/ui/` | Screens and widgets. `AsyncPage` gives every screen the same large collapsing title, skeleton, failure, retry and pull-to-refresh behaviour. `lib/ui/map/` holds the route map and its generated land mask. |
| `lib/l10n/` | Generated. **Don't edit the ARB files by hand.** |

### Design

Black and white, with greys only for hierarchy (`Palette` in `lib/ui/theme.dart`), and dark
mode is true black. KCPL crimson is kept for the brand mark, the route a shipment has
travelled, whatever needs someone to act or is costing them money, and the glow of the
dark pass. Status is written as words, never shown as a coloured pill.

- **Type:** Inter for reading and Inter Tight for display, bundled, so both apps look
  the same on every phone. Figures use tabular digits. Nepali falls back to the bundled
  Noto Sans Devanagari.
- **Icons:** Phosphor. Its fonts are bundled directly and named in `lib/ui/icons.dart`.
  Outline icons by default; the filled one marks the chosen tab.
- **The pass** (`lib/ui/widgets/pass.dart`): the shipment or job that matters most leads
  each home screen as a dark, Wallet-style pass. It has a crimson glow, film grain, an
  edge that catches the light, and a perforated stub for the status and ETA. It stays
  dark in light mode, and tips back and recedes as you scroll away. The same pass heads
  the detail page, and it flies there as a shared element.
- **The route map** (`lib/ui/map/`): the pass draws the journey on the land it actually
  crosses. The land is dots, Nepal is outlined and a shade brighter, and a crimson arc
  glows where the cargo has already been. The vehicle sits where the cargo is. Places are
  matched by the names desks write ("Birgunj ICD", "Kathmandu (TIA)"). When either end
  is unknown, the pass falls back to the plain journey line rather than guessing. An end
  beyond the map (Rotterdam, say) is drawn at the frame's edge, pointing the right way.
- **Bento figures** (`lib/ui/widgets/bento.dart`): the figures are tiles, each with a
  small chart built from the same records as its number: shipments by stage, arrivals
  across the next seven days, and the share of jobs that are urgent. Nothing is charted
  that the server does not send.
- **Chrome:** a floating glass tab bar with an ink pill that slides to the chosen tab.
  Detail pages open as sheets that you pull down from the top to close. Rows lead with
  a tile showing the mode of transport (crimson when something has gone wrong).

The patterns come from apps that do this well: Flighty (a shipment drawn like a flight),
Apple Wallet and Maps (the pass, the sheets), Revolut and Cash App (bento figures, ink
buttons) and Apple's own apps (large titles that collapse as you scroll).

Tabs keep their state and scroll position, and selection changes give a light haptic
tick.

### Motion

Every animation has a job, and all of them draw on one set of curves and durations
(`lib/ui/motion.dart`):

| Where | What it does |
|---|---|
| Launch | The native splash hands over to the K, whose strokes assemble and then carry a crimson charge until the app is ready. |
| Sign-in | KCPL's lanes into Nepal run behind the form, each with a point of light arriving at its gateway. The form assembles top to bottom. The crimson button presses in, and its label becomes the charging K. A wrong password shakes the fields with a haptic buzz. |
| Every screen | Content fades up in a 40ms stagger when it arrives; the skeleton shimmers while loading. A refresh updates in place. |
| Pull to refresh | Pulling assembles the K stroke by stroke, a tick says it will refresh on release, and the K charges while the page reloads. |
| Home → detail | The pass flies into the sheet as it rises. Pull the sheet down to close it; it follows the finger. |
| Route map | The land fades in, then the route draws out to where the cargo is, and a soft ring breathes around the vehicle. |
| Figures | Count up when they first appear; the charts grow in. |
| Tab bar | The ink pill slides to the chosen tab and settles with a slight overshoot; the icon pops. |
| Tasks | Ticking one pops the check and throws a small crimson burst. |
| Empty states | One crimson point circles slowly on dashed orbits around the icon. |

Tab switching and language changes stay instant, as native apps keep them.

With the system's Reduce Motion setting on, nothing moves or loops and only short fades
remain. The flow tests run under that setting, so a looping animation that ignored it
would hang them. Two further tests run with full motion: the shared-element flight, and
the crimson button with its shake.

The route map's land comes from Natural Earth (public domain). To rebuild it:

```sh
npm pack world-atlas && tar xzf world-atlas-*.tgz
node mobile/tool/build_route_map.mjs package/countries-50m.json package/land-50m.json
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
   Put each `google-services.json` in `android/app/src/customer/` and
   `android/app/src/ops/`. The Gradle plugin is applied only when one is present.
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
dart format -l 140 lib test   # the house line length
```

The widget tests sign in and walk every screen in English and Nepali at 1.6× system text
size. A layout overflow fails the test, so a long label can't clip on a real phone.

## Not in this version

- Uploads, payment receipts, delivery confirmation, freight requests and team
  management. These stay on the web portal.
- Offline cache. Each screen fetches live and says so plainly when it can't.
