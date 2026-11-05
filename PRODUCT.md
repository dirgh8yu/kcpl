# Product

<!-- impeccable:product-schema 1 -->

Scope: the public website only. Admin and the customer portal are separate surfaces with their own design rules; only the portal sign-in page is restyled with the public site.

Source: the owner's answers to a 150-question interview, November 2026.

## Platform

web

## Users

Everyone who arrives matters, in this order: importers in Nepal, then project and engineering procurement teams. The most common visitor is a logistics or purchasing manager checking KCPL after a referral. They read English, know some freight terms, and use phones and desktops equally, on connections that vary. First-timers matter only when they have commercial cargo.

Their main fear is cargo stuck at customs or at the border. People who only want the lowest price are not the audience, and the site should not chase them.

## Product Purpose

The site turns referred visitors and search visitors into quote requests from recurring shippers, and makes KCPL look credible enough to put in a tender. Most business comes through referrals and starts at the quote form.

Success: more quote requests of better quality, credibility in tenders, and better Google ranking. The owner's target is five times as many enquiries. There is no baseline yet, so the target cannot be measured until analytics is on and the last 12 months of enquiries are counted.

## Positioning

One team plans the whole route into and out of landlocked Nepal. An ocean movement to Nepal is really two movements and a border, and KCPL plans all of it. KCPL has staff in Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata.

Imports and exports carry equal weight. Rivals the owner measures against: DHL and Shanker agency. Tone: an established senior specialist, plain and practical. Nepal stays present but subtle.

## Operating Context

A visitor's path: hears about KCPL, checks the site, requests a quote with origin, destination and a way to reply. KCPL replies within one working day. There is one phone line for the office. There is no general contact form, and `admin@kapileshworcargo.com.np` stays the email address. WhatsApp is wanted but has no number yet.

The site runs in English, Nepali, Hindi and Chinese. English is the default and is designed first, and someone at KCPL checks every translation.

## Capabilities and Constraints

Seven services: air freight, ocean freight, road freight, customs and documentation, project and specialist cargo, warehousing and packaging, delivery and proof.

Frozen, and never changed by design work:
- the logo and the company name
- the backend, including `app/api/quotes/route.ts`, which requires origin, destination, contact name and contact email, accepts JSON only, and has no file uploads
- every page address
- Firebase, authentication and URL state

Not live and never to be claimed: real-time tracking, a customer app, published binding rates, owned ships, aircraft or fleets, guaranteed clearance or transit.

Undecided or not supplied yet: WhatsApp number, Google Analytics ID, transit ranges and price ranges per service, careers content.

## Brand Commitments

- Name: Kapileshwor Cargo Pvt. Ltd., KCPL.
- Logo: the Gateway K master at `public/images/brand/kcpl-gateway-k.svg`, never redrawn or recoloured.
- Crimson `#DC143C` is exact. Crimson bands stay. A second accent is allowed only for charts and status.
- Manrope everywhere, Noto Sans Devanagari for Nepali and Hindi, mono only for real data, Phosphor icons.
- Tagline, footer only: "From Nepal. To the world."
- Existing words stay unless they clash with the new design. New sections are drafted and checked by the owner, and no factual claim goes live without approval.
- No AI-generated images, ever. No video. No other companies' branding in photographs. People appear as hands and cargo, not faces, with one exception: Ramesh Mishra's portrait.
- The owner alone approves design decisions.

## Evidence on Hand

- Client names, permission confirmed: the list in `app/components/client-rail.tsx`.
- Export Excellence Award, Lalitpur Chamber of Commerce, 2022 to 2025: certificates in `public/images/awards/`, shown as they are.
- Memberships, current and with logo permission: `affiliations` in `app/company-data.ts`.
- Storage, confirmed as KCPL's own: over 1,000 sqm air cargo, over 6,000 sqm road cargo.
- Three anonymous movement stories in `app/site-i18n.ts`. They stay anonymous. Four to six more are expected within three months.
- Established 2015. Managing Director Ramesh Mishra.
- Photographs: illustrative Unsplash pictures listed in `docs/public-photo-sources.md`. They do not show KCPL's cargo, staff or facilities. Real KCPL photographs exist in mixed quality, taken on phones, and have not been supplied yet.

Not on hand, and not to be invented: shipment volumes or any other company numbers, testimonials, exact NEA project names and KCPL's role on each, Ramesh Mishra's portrait.

## Product Principles

- Prove the route. Show how a movement actually gets to Nepal rather than claiming reliability.
- The next step is always the quote, and it asks for the least that lets KCPL reply.
- Facts only. A claim KCPL cannot back with a document does not go on the page.
- A referred reader decides in minutes, so the proof comes early and reads plainly.

## Accessibility & Inclusion

Four languages, with Devanagari that does not clip. WCAG AA contrast, 44px touch targets, and 16px form fields. Motion respects reduced-motion settings. Pages stay fast on slower connections: the working floor is a 2.5 second largest paint on a phone.
