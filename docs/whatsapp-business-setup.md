# WhatsApp for KCPL customers

Working notes for setting up WhatsApp Business for Kapileshwor Cargo Pvt. Ltd., and
for wiring it into the portal's existing notification sweep.

**Status: nothing here is built or applied for.** This is the plan, the documents to
gather, and the message templates already written against the copy the portal sends
today.

## Two different products with the same name

| | WhatsApp Business app | WhatsApp Business Platform (Cloud API) |
|---|---|---|
| What it is | A phone app, like WhatsApp with a catalogue and a business profile | An API Meta hosts; no phone involved |
| Who types | A person at KCPL | KCPL's systems |
| Cost | Free | Per message, by category |
| Setup | Minutes | Verification, ~1–2 weeks |
| Good for | A human answering customer chats | Shipment milestones, document releases, free-time warnings |

KCPL probably wants **both**, in that order. The app is the front door a customer
messages; the Platform is what lets the portal send the notifications it already
sends by email. They can share one number through Meta's **Coexistence** feature,
or use separate numbers — see the decision below.

## The critical path

Steps 1–4 are prerequisites and can start today. Nothing can be sent until 5 and 6
are done.

1. **Meta Business Portfolio** (formerly Business Manager) for Kapileshwor Cargo
   Pvt. Ltd. Use a company email, not a personal one, and add a second admin
   immediately — a portfolio with one admin is one lost phone away from being
   unrecoverable.
2. **A phone number KCPL controls** that is not currently on a personal WhatsApp
   account. It needs to receive an SMS or call once. A number already on the
   WhatsApp Business app must either be deregistered first or enrolled through
   Coexistence.
3. **Business verification** in Meta's Security Centre. For Nepal this means the
   Office of the Company Registrar registration certificate, the PAN certificate,
   and a document showing the registered address — a utility bill or bank statement.
   The legal name on all three must match the name entered in Meta exactly.
4. **Display name.** What customers see. Meta reviews it and rejects names that are
   not clearly the business. "Kapileshwor Cargo" is safe; "KCPL Updates" is the kind
   of thing that gets refused.
5. **Message templates approved** — anything sent outside a 24-hour reply window must
   be a pre-approved template. Drafts below.
6. **Customer opt-in recorded.** Meta requires customers to have agreed to receive
   WhatsApp from KCPL, and to be able to stop. This is a real gap: see *What the
   codebase needs*.

Reported timings are roughly 2–5 working days for business verification, 1–2 days
for display name, 1–2 days per template, so about 7–10 working days from a clean
start. Budget longer if a document is rejected for a name mismatch, which is the
usual cause.

## The one decision that matters: direct or through a BSP

**Cloud API direct from Meta.** No reseller margin, full control, and KCPL holds the
account. Costs engineering time: webhook endpoint, token rotation, template
management, and Meta support is self-serve.

**Through a BSP** (Business Solution Provider — 360dialog, Twilio, Wati, Gupshup and
others, several with Nepal/India presence). Faster onboarding, often partner-led
verification, a dashboard for non-engineers, and human support. Costs a markup per
message on top of Meta's rate, and some BSPs hold the WABA rather than KCPL.

**Recommendation: direct Cloud API.** KCPL already has the hard part — a dispatcher
that separates *deciding* to notify from *delivering* it, with a delivery record and
an idempotency key per fact. The BSP value is mostly the dashboard and the
onboarding hand-holding, and the margin is recurring. If KCPL goes BSP anyway, make
the WABA sit under KCPL's own Business Portfolio, not the BSP's, so the number and
templates can be moved later.

## Cost shape

Meta bills per delivered template message, by category. Shipment notifications are
**utility**, which is the cheap tier — an order of magnitude below marketing. The
distinction matters and is worth getting right in the template submission: a
milestone update is utility, "here are our new rates" is marketing.

Rates move and vary by country, and Meta announced further changes through 2026, so
treat any figure quoted here as indicative and read the current rate card in the
dashboard. The shape to plan around: utility messages are cheap per message, and
KCPL's volume is small — a few messages per shipment.

## Templates

Written to mirror what the portal already emails, so a customer gets the same facts
in either channel. All three are **utility**. None of them state a charge amount, for
the same reason the emails do not: the rate KCPL records is a carrier quote, not an
invoice.

Meta's rules these are written against: no placeholder at the very start or end of
the body, no two placeholders adjacent, footers take no variables, and a URL button
may take one variable appended to a fixed prefix.

WhatsApp templates carry a language code, and the portal already stores each
account's language on `portal_accounts.locale`. So the Nepali work is directly
reusable: submit each template twice, `en` and `ne_NP`, under the same template name,
and send the variant matching the recipient's stored locale.

### 1. `shipment_status_update` — utility

**English (en)**

> Body:
> ```
> Shipment {{1}} has an update: {{2}}
>
> Route: {{3}}
> Status: {{4}}
> Estimated arrival: {{5}}
>
> Open the shipment in your KCPL portal for full details.
> ```
> Footer: `You can turn these off in your portal settings.`
> Button: URL, "View shipment" → `https://<portal-host>/portal/shipments/{{1}}`
>
> Samples: `KCPL-S-20260820-DF5D`, `The cargo is in transit, last reported at Kolkata.`, `Shanghai → Birgunj`, `In transit`, `2026-10-01`

**Nepali (ne_NP)**

> Body:
> ```
> ढुवानी {{1}} को अद्यावधिक: {{2}}
>
> मार्ग: {{3}}
> अवस्था: {{4}}
> अनुमानित आगमन: {{5}}
>
> पूरा विवरणका लागि आफ्नो KCPL पोर्टल खोल्नुहोस्।
> ```
> Footer: `पोर्टल सेटिङबाट यी सूचना बन्द गर्न सकिन्छ।`

### 2. `document_released` — utility

**English (en)**

> Body:
> ```
> KCPL has released a document for shipment {{1}}.
>
> Document: {{2}}
> Route: {{3}}
>
> You can download it from your portal now.
> ```
> Footer: `You can turn these off in your portal settings.`
> Button: URL, "Download" → `https://<portal-host>/portal/shipments/{{1}}`
>
> Samples: `KCPL-S-20260820-DF5D`, `Bill of lading (BL)`, `Shanghai → Birgunj`

**Nepali (ne_NP)**

> Body:
> ```
> KCPL ले ढुवानी {{1}} को कागजात जारी गरेको छ।
>
> कागजात: {{2}}
> मार्ग: {{3}}
>
> तपाईं अहिले नै आफ्नो पोर्टलबाट डाउनलोड गर्न सक्नुहुन्छ।
> ```
> Footer: `पोर्टल सेटिङबाट यी सूचना बन्द गर्न सकिन्छ।`

### 3. `free_time_warning` — utility

**English (en)**

> Body:
> ```
> Free time is running out on shipment {{1}}.
>
> Remaining: {{2}}
> Location: {{3}}
> Last free day: {{4}}
>
> Once free time ends, the carrier or terminal may charge storage and demurrage for each day the cargo stays. Contact your KCPL account manager if you need an extension.
> ```
> Footer: `You can turn these off in your portal settings.`
> Button: URL, "See the shipment" → `https://<portal-host>/portal/shipments/{{1}}`
>
> Samples: `KCPL-S-20260820-DF5D`, `1 free day`, `Birgunj ICD`, `2026-09-20`

**Nepali (ne_NP)**

> Body:
> ```
> ढुवानी {{1}} को फ्री टाइम सकिँदै छ।
>
> बाँकी: {{2}}
> स्थान: {{3}}
> अन्तिम फ्री दिन: {{4}}
>
> फ्री टाइम सकिएपछि क्यारियर वा टर्मिनलले सामान रहेको प्रत्येक दिनको भण्डारण र डेमरेज शुल्क लगाउन सक्छ। थप समय चाहिए आफ्नो KCPL खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।
> ```
> Footer: `पोर्टल सेटिङबाट यी सूचना बन्द गर्न सकिन्छ।`

## What the codebase needs

The dispatcher was built for this: `portal-notifications.ts` decides *whether* a
customer hears about a fact and `portal-notifications.server.ts` delivers it, with a
deterministic key per fact per recipient and a delivery row claimed before the
provider call. Push was added as a second transport without touching the rules, and
WhatsApp would be a third the same way.

What does not exist yet, in order of blocking:

1. **A phone number on `portal_accounts`, and a WhatsApp opt-in flag.** Today an
   account has an email and nothing else. Meta requires recorded opt-in and a way to
   stop, so this is not optional and it is not merely a column: it needs a place in
   portal settings for the customer to enter a number, confirm it, and turn it off.
2. **A fourth notification topic, or reuse of the existing three.** The topics
   (`shipment_updates`, `documents`, `free_time`) map one-to-one onto the templates
   above, so the cleaner design is a per-channel preference — this topic, by email
   and/or WhatsApp — rather than a parallel set of topics.
3. **`portal-whatsapp.server.ts`**, mirroring `portal-push.server.ts`: send one
   template to one number, treat a permanent failure as a dead subscription, and
   never fail the sweep.
4. **Template name and language constants**, so the code cannot send a template that
   was never submitted.

Estimated at a similar size to the push transport, and it can be built and tested
against the sandbox number before verification completes.

## Sources

Meta's own developer documentation is not reachable from the environment these notes
were written in, so the process details came from secondary sources and should be
confirmed in the Meta dashboard:

- <https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started>
- <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing>
- <https://docs.360dialog.com/docs/resources/meta-business-verification>
