# KCPL customer app

A native Flutter app for KCPL's customers: the customer portal, on a phone. It covers:

- sign-in and password reset (the same email and password as the web portal)
- the overview (KPIs, free time running out, paperwork KCPL is waiting on, balances)
- shipments with search and filters, and each shipment's milestones, free time, checklist
  and documents
- documents, with download to the phone's viewer
- invoices and invoice detail, for logins with finance access
- switching customer, for agents linked to several
- requesting a quote, seeing the prices KCPL gives and asking to proceed with one
- paying an invoice online with Khalti, eSewa or connectIPS
- sending documents (scanned to PDF, or a photo), payment receipts, confirming receipt of
  a delivery, and managing the team's logins
- working offline from the last answers, Face ID, sharing a shipment's status or a
  tracking link anyone can open, a home and lock screen widget, and a Live Activity
- choosing which emails KCPL sends, and showing dates in Bikram Sambat
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
  customs steps you can tick, notes and photos from the field, what stands between the
  job and closeout, notes and details. Profitability appears only for roles that manage
  costs.
- **Add to job:** a note, a photo, or both, from wherever you are. The photo is filed in
  the job's Document Vault (as a photo, POD, customs document, packing list or delivery
  order) and the note is Job File activity, so both show on the web with your name.
  Saving goes straight back to the job.
- **Scan** (Today and Jobs): point at a barcode or QR code, read a container number off
  the door ("Read text" takes a photo and reads it on the phone; ISO 6346 numbers that
  pass their check digit are offered first), or type it. One match opens the job; only
  jobs in your branches can be found.
- **Delivery** (job detail): start an attempt ("Out for delivery", with who is taking it),
  then record how it went. Delivered takes who received it and their relation, a
  signature signed on a page of its own, photos, and the phone's location; not delivered
  or refused takes the reason and opens an exception for the desk. Proof goes to the desk
  as *received*: the app never verifies POD or marks the shipment Delivered.
- **Job actions:** add a task (title, due time, assignee, branch), give the job to a
  colleague from the web picker's own list, and close it, seeing what still stands in
  the way. Only Management may close over those, and only with a reason.
- **No signal:** a note written where KCPL can't be reached waits on the phone, marked
  "Waiting for signal", and sends itself when the signal returns (on coming back to the
  app, and every 45 seconds while anything waits). Only the login that wrote it sees or
  sends it; a note KCPL refuses is kept with the reason, to delete.
- **Deliveries without signal:** a delivery recorded out of reach (even one whose attempt
  couldn't be started) is kept on the phone with the time it happened, and sent step by
  step once KCPL can be reached: the attempt, the outcome, then each piece of proof. Each
  step that lands is written off, so a signal lost halfway resumes where it stopped.
- **Offline reading:** Today, jobs, a job, its delivery, alerts and the staff list open
  with no signal from the last answer, marked offline with its time.
- **Today's deliveries** (driver mode, from Today): today's stops in your branches, yours
  first, in the order you drag them into (kept for the day), with directions in Apple or
  Google Maps and the delivery screen one tap away.
- **Messages with the customer** (job detail): the shipment's conversation with the
  customer, the same one the web Job File shows. The customer sees your first name.
- **Nepali:** every Ops screen, chosen on sign-in or in Me. References, places, task
  titles and notes stay as KCPL holds them.
- **Alerts:** the web notification centre's feed. Opening an alert marks it read and
  goes to its job; the tab badge counts unread.
- **Me:** role, branches and sign-out.

Access is the web admin's own: a Firebase login that `isAuthorizedAdminUser` accepts, with
role, permissions and branch scope from `getStaffContext`. Every change the app makes (a
tick, a note or photo, an alert read, a task, a new owner, a closeout, a delivery attempt
and its proof) goes through the same server function the web Job File or Delivery
Control uses, after the same branch check. A tick shows at once and is saved behind it;
if the server refuses, it comes back off and says why. Costs stay on the web.

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

## Requesting a quote

Customers ask for a quote from home the way they would ask for a ride: "Where is your
cargo going?" opens a sheet with From and To on one card (places suggested as they type,
their own routes offered first, and the route drawn once both are known), then how it
should travel, the cargo and its weight, when, and one Request quote button. The
confirmation carries the KCPL-Q reference.

It is the web portal's enquiry, not a new kind of record: `POST /api/mobile/v1/requests`
and the portal's own route share `app/portal/portal-requests.server.ts`, so the rules are
one set: only an account owner may raise one, one rate limit covers both, the fields are
checked the same way, and the enquiry lands with a *suggested* customer match and no
price, for the KCPL desk to take up in the workflow it already uses. Requests from the app
are marked `source: "customer_app"`. Logins that may not raise requests do not see the
bar.

## Sending things to KCPL

Each of these is the web portal's own write, reached through the same shared server
function (see *Mobile app API* in `docs/customer-portal.md`), so the rules are one set.
They appear only to logins that may send things to KCPL.

- **A document:** from a checklist row KCPL is waiting on (its own **Send**), or "Send a
  document" under a shipment's documents. The file comes first, then what it is. **Scan
  document** opens the phone's own scanner (VisionKit on iPhone, Google's ML Kit on
  Android), which finds the page edges and flattens them; every page goes in one PDF. Photos
  are re-encoded as JPEG at up to 2400 px (an iPhone's HEIC is refused by the server) and
  named for what they are; PDFs come from Files. Only the papers a customer originates can
  be sent: a bill of lading, customs entry or POD is KCPL's to file. It arrives unreviewed.
- **A payment receipt:** from an unpaid invoice, with the balance filled in and the date on
  the iOS wheel. It is a claim for KCPL accounts to match, never a ledger entry; receipts
  sent are listed on the invoice with their state.
- **Confirm receipt:** a delivered shipment asks once, "Has it arrived?", with who took it,
  a note and an optional photo (filed as "other"). It tells the operator; it is not a POD.
- **Team** (account owners, in Account): invite a colleague as a member, and turn logins off
  and on. When KCPL has no mail provider, the one-time link comes back to share.
- **Share** (a shipment's title bar): its status as plain text for WhatsApp, or **a
  tracking link** anyone can open without a login for 30 days (a consignee, a driver).
  The page shows places and milestones, never the customer's name, prices or papers.
  **Stop sharing links** withdraws every link made for that shipment.

## Quotes and paying online

- **Quotes** (Account): the prices KCPL has given, with how long each holds, and the
  requests still being priced. **Ask to proceed** is the web's own booking request: the
  account manager confirms the booking; nothing is booked or charged by the tap.
- **Pay online** (an invoice with a balance, when KCPL has switched payments on; see
  *Paying online* in `docs/customer-portal.md`): the whole balance or part of it. KCPL
  works out the rupees; the phone sends only the amount, in the invoice's currency. The
  smallest payment is NPR 10, the gateways' floor, and never more than is owed.
- **An invoice in another currency** (USD, INR…) is paid in rupees at Nepal Rastra
  Bank's selling rate, shown before paying and fixed when the payment starts. The
  gateway's payment is verified as usual, but it is never converted into the ledger
  automatically: it arrives as *received* and KCPL accounts apply it, and any exchange
  difference, with the rate on record.
  Choose Khalti, eSewa or connectIPS; the gateway's own page opens in the browser, where
  the wallet login already is. The phone holds no merchant key and signs nothing. KCPL
  confirms the payment with the gateway before applying it, and the app waits for KCPL's
  answer (the return page's **Back to KCPL** opens the app). A paid amount that differs,
  or an invoice that changed meanwhile, is received and matched by accounts by hand.

## Messages, ratings and estimates

- **Message KCPL** (a shipment): one conversation per shipment with the person handling
  it, the same thread as the web portal and the Job File. The job's owner is told at once
  in KCPL Ops and the web notification centre; a reply comes as a push. It checks for a
  reply every 30 seconds while open, and a thread already read opens offline.
- **How did this delivery go?** (a delivered shipment): once per login. One tap on a star
  answers; a comment is optional. Three or fewer goes to the desk as a complaint. Four or
  five may offer KCPL's public review page (`KCPL_REVIEW_URL`, https only).
- **What will storage cost?** (a shipment with free time): days past free time if the cargo
  is collected on a chosen day, at the daily rate KCPL recorded. The carrier's invoice
  decides the charge.
- **Estimate customs duty** (a shipment): customs duty on the CIF value, excise on value
  plus duty, then 13% VAT on all three, at the bands the customer picks. A rough guide;
  the HS code decides the real rates.
- **Invoice reminders:** three days before an invoice is due and when it becomes overdue,
  by email and push to account owners who can see invoices. The push opens the invoice,
  where Pay online is.

## Proof, pickups, statements and text notices

- **Proof of delivery** (a delivered shipment KCPL has checked): who received it and
  when, and the signature and photos the desk chose to share. A tap opens a picture full
  screen to zoom. Never the recipient's phone, the driver or the location.
- **Pickup** (accepting a quote): switch on "KCPL picks up the cargo" and give the date
  (up to 90 days out), morning, afternoon or any time, the address and a contact. The
  pickup desk schedules it once the booking is confirmed.
- **Account statement** (Invoices): a PDF of what is owed, how overdue, and payments
  received over the last 12 months, opened in the phone's viewer.
- **SMS and WhatsApp** (Account, when KCPL has a channel switched on): the same updates as
  one short message, to a number the customer gives, with their agreement ticked.
- **"KCPL needs your packing list"**: the push opens the shipment with the send sheet on
  top; one tap on **Scan packing list** opens the document scanner.

## Shortcuts and the lock screen

- **Home screen:** long-press the KCPL icon for Track a shipment, Request a quote and Pay
  an invoice (each only when the login may do it).
- **Siri and Spotlight (iPhone, iOS 16+):** "Track a shipment with KCPL", "Request a
  quote from KCPL", "Pay a KCPL invoice", and the same three in the Shortcuts app, with
  nothing to set up. They are App Shortcuts in `AppDelegate.swift`.
- **Follow a shipment on Android:** the share button's **Follow in notifications** keeps
  the shipment as an ongoing progress notification. On Android 16 it is a Live Update: it
  can sit at the top of the lock screen and as a chip in the status bar. With push on,
  KCPL moves it as the shipment moves, as it moves the iPhone's Live Activity, even when
  the app is closed (a data message handled by the `kcpl_live_updates` plugin in
  `packages/`), and ends it on delivery. The app also moves it whenever it reads the
  shipment. A follow the person swipes away stays gone; a tap opens the shipment.

## Tablets

On an iPad (or any screen 740 points wide or more) every list shows the chosen item
beside it, as Mail does: Shipments, Documents (the document, with Open and its shipment)
and Invoices in KCPL, with Quotes and the team beside Account's settings; Today, Jobs
and Alerts (the job it is about) in KCPL Ops. On a phone a row opens its sheet as before.

## Settings

- **Email me about** (Account): the portal's topics (milestones, documents, free time,
  and invoices coming due for logins that see invoices), switched here or on the web;
  they are the same setting.
- **Dates:** Gregorian or Bikram Sambat ("9 Ashwin 2083 BS"). Kept on the phone. The
  instant is the same either way; BS times are Nepal time.

Uploads show real progress: the body is handed over in 32 KB pieces as the connection
takes them, and the crimson button fills with them.

## Continue with Google and Apple

Customers sign in with Apple or Google, in the app and on the web portal, with email and
password kept underneath as a quieter fallback. The provider only proves who the person
is: access is still decided by KCPL's server against the portal account provisioned for
that email, exactly as for a password. An address that already has a KCPL password is
not taken over: the person signs in with the password once, and the provider is linked
to that same login (the portal account's bound uid stays the same). An Apple user who
hides their email reaches KCPL as a relay address no account matches, and is told to
sign in again sharing it, or to use email.

The app exchanges the provider's token with Firebase over REST (`accounts:signInWithIdp`,
`lib/auth/firebase_rest_auth.dart`), like the password sign-in; the phone's own sheets
come from `google_sign_in` and `sign_in_with_apple` (`lib/auth/social_sign_in.dart`).
Each button appears only once its setup is done, so an unconfigured build shows the
email form as before.

**Firebase console → Authentication → Sign-in method**
- Enable **Google** (it creates a "Web client" OAuth ID; copy it from the Google
  provider's *Web SDK configuration*).
- Enable **Apple** once there is a paid Apple Developer account (below).
- Under **Settings → Authorized domains**, make sure the portal's domains are listed
  (`kcpl--kcpl-82574.asia-southeast1.hosted.app`, and the public domain when it points
  at App Hosting).

**Web portal:** `NEXT_PUBLIC_KCPL_SIGN_IN_PROVIDERS` in `apphosting.yaml` lists the
buttons (`google` now; `google,apple` once Apple is set up, which on the web also needs
an Apple *Services ID* and key entered in Firebase's Apple provider).

**Android (Google):**
1. Make one upload keystore and keep it:
   `keytool -genkeypair -v -keystore kcpl-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Register its SHA-1 (`keytool -list -v -keystore kcpl-upload.jks -alias upload`) on the
   KCPL Android app in Firebase → Project settings.
3. GitHub → Settings → Secrets and variables → Actions: secrets
   `ANDROID_KEYSTORE_BASE64` (`base64 -i kcpl-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; variable `KCPL_GOOGLE_SERVER_CLIENT_ID`
   (the Web client ID). CI then signs every build with that key and shows the button.
   Phones with an earlier, debug-signed build must uninstall it once first.

**iPhone (Google):**
1. Firebase → Project settings → Add app → iOS, bundle id
   `np.com.kapileshworcargo.kcplCustomer`. Its GoogleService-Info.plist carries
   `CLIENT_ID` and `REVERSED_CLIENT_ID` (public identifiers).
2. Create `ios/Flutter/Google.xcconfig` containing
   `GOOGLE_REVERSED_CLIENT_ID = <REVERSED_CLIENT_ID>`; it registers the URL scheme
   Google returns through.
3. Build with `--dart-define=KCPL_GOOGLE_IOS_CLIENT_ID=<CLIENT_ID>`.

**iPhone (Apple):** needs the paid Apple Developer Program; a free Apple ID cannot have
the capability, so it is off by default and free builds are unaffected. Once enrolled:
choose the paid team in Xcode, add **Sign in with Apple** under Signing & Capabilities,
enable Apple in Firebase, and build with `--dart-define=KCPL_APPLE_SIGN_IN=true`. Apple's
guidelines require it wherever Google sign-in is offered on iPhone, so switch it on
before an App Store release.

The sample-data build (`KCPL_DEMO=true`) shows both buttons, each signing straight in.

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

Apple-native, so the apps feel part of the phone: iOS's grouped look (a soft grey page with
white cards, black and graphite in dark mode), label greys for hierarchy, hairline
separators, and crimson only for the brand, the one primary button (sign in) and whatever
needs the customer to act. Status is written as words, never shown as a coloured pill. The
apps follow the phone's light or dark setting.

- **Type:** the platform's own face (SF Pro on iPhone, Roboto on Android), on Apple's text
  styles with Apple's tracking for each size: 32pt large titles (17pt once collapsed into the
  bar), 17pt rows and headlines, 15pt supporting text, 13pt footnotes. Nothing is bundled.
- **Icons:** Cupertino's set (`cupertino_icons`, drawn after SF Symbols), outline by default
  and filled for the chosen tab, plus two Phosphor glyphs Cupertino lacks (a boat and a
  truck). All live in `lib/ui/icons.dart`.
- **Lists:** inset grouped cards (`RowGroup`, `RowTile`, `DetailRow` in
  `lib/ui/widgets/common.dart`): 44pt minimum rows, separators that start where the text
  does, the press highlight on touch-down, and prominent section headers with a quiet action.
- **Chrome:** the standard tab bar (49pt, frosted, with a hairline) and a large title that
  slides under a 44pt bar, which frosts over only once content scrolls beneath it
  (`lib/ui/widgets/large_title.dart`). Detail pages open as sheets with a grabber and a round
  close button; in dark mode sheets lift to graphite, as iOS does.
- **Customer home** (`lib/ui/screens/overview_screen.dart`): the map fills the screen with
  every shipment on its way (`FleetMap`): the one that matters most is drawn in ink with
  its ends named, and the others are fine lines with their cargo on them. A sheet over the
  map (`lib/ui/widgets/detent_sheet.dart`) says how things stand ("4 shipments on the way ·
  1 needs attention") and lists what needs the customer, the active shipments, the balance
  and recent documents. Pull the sheet up for more.
- **KCPL Ops Today:** a list in the manner of Reminders, grouped into Needs action, Moving
  and Delivered, each with its count, and your own jobs first. Overdue-task and customs
  counts open Jobs with the matching filter already selected.
- **The map** (`lib/ui/map/`): pale land, soft water, white roads, rivers, borders and small
  grey town names, from bundled data (about 480 KB), so it needs no map service, API key or
  network. Places are matched by the names desks write ("Birgunj ICD", "Kathmandu (TIA)").
  When either end is unknown, a plain progress line stands in.

Tabs keep their state and scroll position.

To see every screen as an iPhone shows it, light and dark, on demo data:

```sh
flutter test tool/screenshots_test.dart --update-goldens   # PNGs in tool/screenshots/
```

(SF Pro exists only on Apple hardware, so Inter stands in for it there.)

### Motion

Motion follows Emil Kowalski's rules and Apple's fluid-interface ones: every animation has
a purpose, anything seen tens of times a day barely moves, UI stays under 300ms, entrances
and exits ease out, gestures track the finger 1:1 and hand their velocity to a spring, and
data people read never moves for style. Curves and durations live in
`lib/ui/motion.dart` (`easeOut` 0.23, 1, 0.32, 1; `drawer` 0.32, 0.72, 0, 1; press 100ms,
release 160ms, reveal 300ms, stagger 40ms).

| Where | What it does | Why |
|---|---|---|
| Home sheet | Rests at three heights and follows the finger 1:1. On release it goes where the flick's momentum projects (Apple's projection, deceleration 0.998) and springs there from the finger's own speed: critically damped, with a little bounce only after a real flick. A touch catches it mid-flight. Below the lowest height it rubber-bands, and a long pull there refreshes. The content scrolls once the sheet is fully up, and the map dims as the sheet covers it. | Direct manipulation; interruptible |
| Sign-in | On KCPL crimson, the gateway K assembles in white stroke by stroke, lifts, and "Kapileshwor Cargo" rises out from under it, then "Pvt. Ltd." settles (1.7s, once). The crimson button presses in and its label becomes the charging K. A wrong password shakes the fields (400ms) with a haptic. | Rare, so it may delight; feedback |
| Sign-in ↔ app | A 400ms fade with a slight scale. | Prevents a jarring swap |
| Pages | Content fades up 8px over 300ms, 40ms apart; skeletons shimmer while loading. Refreshes update in place. | Prevents teleporting content |
| Title bar | The large title slides under the bar; the small title fades in and the bar frosts over (150ms). | Wayfinding |
| Pull to refresh | The system spinner's ticks appear with the pull, a click says release will refresh, and it spins while loading. | Feedback during the gesture |
| Detail sheets | Rise in 420ms (drawer curve), leave in 300ms. The page behind scales back and rounds. Pull down to close: after 10px the sheet follows the finger 1:1. A flick (over 0.11 px/ms) decides by its direction, a slow release by distance, and it springs back from the finger's own velocity. | Spatial consistency; direct manipulation |
| Push banner | Drops in from the top, leaves the same way (200ms), and flicks up to dismiss. It rubber-bands if pulled down, and settles back if let go part-way. | Spatial consistency |
| Presses | Rows highlight on touch-down; buttons and cards scale to 0.97 (cards 0.985). | Feedback |
| Checks and downloads | Icons crossfade from 0.9 scale in 180ms. | State change |

**Deliberately not animated:**
- Figures (no count-up), progress lines, the routes on the map, and branch load bars: these are data.
- Tab switches: no pop and no haptic.
- The home sheet reaching a height: no haptic, since it happens tens of times a day.

Haptics mark only meaningful moments: a tick, a success, an error, arming a refresh, and
closing a sheet.

With the system's Reduce Motion setting on, nothing loops and nothing bounces; short fades
remain. The flow tests run under that setting, so a looping animation that ignored it
would hang them. Further tests run with full motion: the home sheet's gestures
(`test/detent_sheet_test.dart`), a detail sheet's flick, and the crimson button with its
shake.

The map data is Natural Earth 1:10m (public domain): land, lakes, rivers, roads,
borders and towns, clipped to South, East and South-East Asia and the Gulf. To rebuild
it, download the `ne_10m_*.geojson` files named in `tool/build_map_data.mjs` from
github.com/nvkelso/natural-earth-vector (the `geojson` folder) and run:

```sh
node mobile/tool/build_map_data.mjs <folder with the geojson files>
```

### Keeping current

There is one copy of the data: the apps read and write the same database as the website,
through the server. What can lag is a screen, so every screen refreshes itself:

- every **60 seconds** while it is on show, the web register's own interval;
- on **coming back** to it (switching back to its tab, returning from a detail page,
  reopening the app) unless it loaded in the last 5 seconds;
- **never** while hidden: background tabs, covered pages and a closed app make no requests.

A refresh updates the page in place: numbers glide to their new values, with no skeleton
and no scroll jump. A failed background refresh keeps what is shown. Only the newest request
may land, so a slow reply can never overwrite a newer one, including across a customer
switch. The Ops alert badge counts unread every minute on every tab. `test/refresh_test.dart`
holds all of this on a fake clock.

### Offline

The customer app keeps the last answer to each read (`lib/api/offline_cache.dart`), in the
app's private storage, keyed by customer and endpoint. When KCPL can't be reached, a screen
shows that answer with **"Offline · as of 10:42"** instead of an error; a background
refresh that fails does the same. A refusal (no access, not found) is never replaced by an
old answer. Signing out deletes everything kept.

### Face ID

Off until the person turns it on in Account → Privacy, and proven before it is. Then KCPL
asks for Face ID (Touch ID, a fingerprint, or the passcode as fallback) at launch and after
a minute away, never for a glance, and shows the K on crimson in the app switcher. Unlocking
returns exactly where the person was. Signing out ends it; the next person starts without.

### Home and lock screen widget

The shipment worth a glance (one in trouble first, then the next to arrive), in the
reader's language, refreshed whenever the overview loads live and emptied at sign-out. A
tap opens that shipment.

- **Android:** built in (the customer app only). Long-press the home screen → Widgets →
  KCPL.
- **iPhone:** the widget's code is in `ios/KCPLWidget/KCPLWidget.swift`. It needs a
  Widget Extension target, added once on a Mac, and an App Group, which needs a paid Apple
  Developer account:
  1. Xcode → File → New → Target → **Widget Extension**, named `KCPLWidget`, iOS 17 or
     later. Untick "Include Configuration App Intent" and "Include Live Activity".
  2. Delete the Swift files Xcode generates in the new folder and add
     `ios/KCPLWidget/KCPLWidget.swift` to the `KCPLWidget` target.
  3. On both the **Runner** and **KCPLWidget** targets: Signing & Capabilities → + →
     **App Groups** → `group.np.com.kapileshworcargo.kcpl`.
  4. For the **Live Activity** (a followed shipment on the Lock Screen and in the Dynamic
     Island, iOS 16.2+): on **Runner**, Signing & Capabilities → + → **Push
     Notifications**. `NSSupportsLiveActivities` is already in `Info.plist`, and the
     activity's view is in the same `KCPLWidget.swift`.
  Until then the app runs normally and simply has no widget or Live Activity.

  **Follow on Lock Screen** is in a shipment's share button. The app starts the activity
  and moves it whenever it shows that shipment. With push on, KCPL also moves it from the
  server (FCM, `apns.liveActivityToken`) as the shipment moves, and ends it on delivery.
  `ShipmentActivityAttributes` is declared in both `AppDelegate.swift` and
  `KCPLWidget.swift`; ActivityKit matches them by name and shape, so keep them identical.

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
handset. Phosphor's two glyphs are MIT; the licences are in `assets/fonts/`. Inter (SIL OFL,
`test/fonts/`) is used only by the screenshot tool.

## Checks

```sh
flutter analyze
flutter test
dart format -l 140 $(git ls-files "lib/*.dart" "test/*.dart" | grep -v /l10n/)   # house line length; l10n is generated
```

The widget tests sign in and walk every screen in English and Nepali at 2× system text
size, including a compact 320-point phone. A layout overflow fails the test.

`test/accessibility_test.dart` holds every screen of both apps to Flutter's
accessibility guidelines: every control named for VoiceOver and TalkBack, 44-point targets,
and text at WCAG AA contrast (4.5:1). The secondary grey is a shade darker than Apple's to
pass on every surface it sits on. `test/tablet_test.dart` covers the two-column layout.

## Not in this version

- The Swift code (the widget, the Live Activity, text recognition, the App Shortcuts) is
  compiled only on a Mac. CI builds Android; the iOS side has not been built since this
  change.
- Online payment has been tested against the gateways' published signature formats, not
  a live gateway: the first payment in `KCPL_PAYMENTS_ENV=test` is the first round trip.
