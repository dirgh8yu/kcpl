/*
 * Generates lib/l10n/app_{en,ne}.arb from the web portal's dictionary.
 *
 * The portal's Nepali was written with care for how Kathmandu freight desks
 * actually talk (see app/portal/portal-i18n.ts). The app reuses it rather than
 * keeping a second translation that drifts. Strings only the app needs are
 * kept below, with both languages side by side.
 *
 * Run from the repo root after changing either:
 *   node --experimental-strip-types mobile/tool/sync_portal_strings.mjs
 */
import { writeFileSync } from "node:fs";
import { portalText } from "../../app/portal/portal-i18n.ts";

const portalKeys = `
chrome.overview chrome.shipments chrome.documents chrome.invoices chrome.settings chrome.account
chrome.account_switch_failed chrome.public_site
common.shipment common.route common.status common.documents common.updated common.download common.loading
common.unavailable_title common.unavailable_detail
status.booking_confirmed status.preparing status.in_transit status.customs_clearance
status.out_for_delivery status.delivered status.exception status.unknown
mode.air mode.sea mode.road mode.unsure
invoice.issued invoice.partially_paid invoice.paid invoice.overdue invoice.open
free_time.label free_time.deadline free_time.consequence
fts.not_set fts.expired_yesterday fts.expired_yesterday_at fts.expired_days fts.expired_days_at
fts.last_day fts.last_day_at fts.one_day fts.one_day_at fts.days fts.days_at
role.owner role.member
doc.air_waybill doc.bill_of_lading doc.road_consignment_note doc.shipping_instruction doc.cargo_manifest
doc.pickup_order doc.commercial_invoice doc.packing_list doc.customs_document doc.certificate_of_origin
doc.import_permit doc.export_permit doc.dangerous_goods_declaration doc.insurance_certificate
doc.delivery_order doc.proof_of_delivery doc.other doc.unknown
overview.description overview.kpi_active overview.kpi_in_transit overview.kpi_arriving
overview.kpi_free_time overview.kpi_documents overview.kpi_attention
overview.free_time_title overview.free_time_description
overview.outstanding_title overview.outstanding_description
overview.account_title overview.open_invoices_one overview.open_invoices overview.overdue_count
overview.currency_outstanding overview.amount_overdue overview.nothing_overdue
overview.movements_title overview.all_shipments overview.now_at
overview.empty_delivered_title overview.empty_delivered_description
overview.empty_none_title overview.empty_none_description
overview.paperwork_title overview.all_documents overview.no_documents_title overview.no_documents_description
overview.view_invoices overview.origin overview.destination overview.col_eta
ships.focus_all ships.focus_active ships.focus_in_transit ships.focus_attention ships.focus_delivered
ships.search_placeholder ships.empty_filtered_title ships.empty_filtered_description
ships.empty_title ships.empty_description
docs.coverage docs.all docs.from_kcpl docs.sent_by_you docs.state_confirmed docs.state_resend docs.state_with_kcpl
docs.empty_filtered_title docs.empty_title docs.empty_description docs.search_placeholder
inv.position_title inv.position_description inv.invoiced_receipted inv.billing_title
inv.col_issued inv.col_due inv.col_total inv.col_paid inv.col_balance inv.opening_balance
inv.empty_title inv.empty_description inv.footnote
invd.statement invd.col_charge invd.col_quantity invd.col_unit_price invd.no_lines_title invd.no_lines_description
invd.subtotal invd.tax invd.receipted invd.balance_due invd.issued_on invd.due_on
invd.not_found_title invd.not_found_description invd.no_access_title invd.no_access_description
ship.not_found_title ship.not_found_description ship.opened ship.last_update
ship.free_time_expired_description ship.free_time_description ship.location ship.as_advised
ship.days_overdue ship.days_remaining ship.charge_after_expiry ship.per_day ship.allowance ship.allowance_days
ship.free_time_footnote ship.movement_title ship.mode ship.current_location ship.not_reported ship.eta
ship.carrier_reference ship.to_be_confirmed ship.milestones_title ship.no_milestones_title
ship.no_milestones_description ship.documents_description ship.no_documents_title ship.no_documents_description
ships.col_carrier
xchg.title xchg.state_needed xchg.state_resend xchg.state_with_kcpl xchg.state_confirmed
settings.language settings.signed_in_as settings.account settings.access_level settings.provisioning_note
`.trim().split(/\s+/);

/** App-only strings: [key, English, Nepali]. */
const appStrings = [
  ["appTitle", "KCPL", "KCPL"],
  ["signInTitle", "Sign in to KCPL", "KCPL मा साइन इन गर्नुहोस्"],
  ["signInSubtitle", "Your shipments, documents and invoices with Kapileshwor Cargo.", "कपिलेश्वर कार्गोसँगका तपाईंका ढुवानी, कागजात र बिल।"],
  ["emailLabel", "Email address", "इमेल ठेगाना"],
  ["passwordLabel", "Password", "पासवर्ड"],
  ["showPassword", "Show password", "पासवर्ड देखाउनुहोस्"],
  ["hidePassword", "Hide password", "पासवर्ड लुकाउनुहोस्"],
  ["signIn", "Sign in", "साइन इन"],
  ["signingIn", "Signing in…", "साइन इन हुँदैछ…"],
  ["forgotPassword", "Forgot password?", "पासवर्ड बिर्सनुभयो?"],
  ["resetNeedsEmail", "Enter your email address first, then choose Forgot password.", "पहिले इमेल ठेगाना लेख्नुहोस्, त्यसपछि पासवर्ड बिर्सनुभयो? छान्नुहोस्।"],
  ["resetSent", "If that address has KCPL portal access, a password reset link is on its way.", "त्यो ठेगानामा KCPL पोर्टल पहुँच छ भने पासवर्ड रिसेट लिङ्क पठाइँदैछ।"],
  ["signInFailed", "Sign-in failed. Check your details and try again.", "साइन इन हुन सकेन। विवरण जाँचेर फेरि प्रयास गर्नुहोस्।"],
  ["tooManyAttempts", "Too many attempts. Wait a few minutes and try again.", "धेरै पटक प्रयास भयो। केही मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।"],
  ["networkError", "KCPL could not be reached. Check your connection and try again.", "KCPL सम्म पुग्न सकिएन। इन्टरनेट जडान जाँचेर फेरि प्रयास गर्नुहोस्।"],
  ["sessionEnded", "Your session has ended. Sign in again.", "तपाईंको सत्र सकियो। फेरि साइन इन गर्नुहोस्।"],
  ["signOut", "Sign out", "साइन आउट"],
  ["retry", "Try again", "फेरि प्रयास गर्नुहोस्"],
  ["switchAccount", "Switch account", "खाता बदल्नुहोस्"],
  ["downloading", "Downloading…", "डाउनलोड हुँदैछ…"],
  ["downloadFailed", "The document could not be downloaded.", "कागजात डाउनलोड हुन सकेन।"],
  ["documentSaved", "Saved {filename}", "{filename} सुरक्षित भयो"],
  ["helpContact", "Need help? Contact your KCPL account manager.", "सहयोग चाहियो? आफ्नो KCPL खाता प्रबन्धकलाई सम्पर्क गर्नुहोस्।"],
  ["demoBanner", "Demo data, not a real account", "नमुना विवरण, वास्तविक खाता होइन"],
  ["appVersion", "Version {version}", "संस्करण {version}"],
  ["modeRail", "Rail freight", "रेल ढुवानी"],
  ["modeCourier", "Courier", "कुरियर"],
  ["modeMultimodal", "Multimodal", "बहुमाध्यम ढुवानी"],
  ["pushPrimerTitle", "Know the moment your cargo moves", "सामान सर्ने बित्तिकै थाहा पाउनुहोस्"],
  ["pushPrimerBody", "Get a notification when a shipment moves, a document is ready or free time is running out.", "ढुवानी अघि बढ्दा, कागजात तयार हुँदा वा फ्री टाइम सकिन लाग्दा सूचना पाउनुहोस्।"],
  ["pushTurnOn", "Turn on", "खोल्नुहोस्"],
  ["pushNotNow", "Not now", "अहिले होइन"],
  ["pushSection", "Notifications", "सूचना"],
  ["pushSetting", "Push notifications", "पुस सूचना"],
  ["pushOn", "On", "खुला"],
  ["pushOff", "Off", "बन्द"],
  ["pushBlocked", "Blocked in your phone's Settings", "फोनको सेटिङमा रोकिएको"],
  ["pushUnavailable", "Not available in this build", "यो संस्करणमा उपलब्ध छैन"],
  ["pushBlockedHelp", "Allow notifications for KCPL in your phone's Settings.", "फोनको सेटिङमा KCPL का लागि सूचना अनुमति दिनुहोस्।"],
];

const camel = (key) => key.replace(/[._](\w)/g, (_, c) => c.toUpperCase());

function placeholders(text) {
  const names = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  return Object.fromEntries([...new Set(names)].map((name) => [name, { type: "String" }]));
}

for (const locale of ["en", "ne"]) {
  const arb = { "@@locale": locale };
  const add = (name, text) => {
    if (name in arb) throw new Error(`duplicate ARB key ${name}`);
    arb[name] = text;
    const vars = placeholders(text);
    if (locale === "en" && Object.keys(vars).length) arb[`@${name}`] = { placeholders: vars };
  };
  for (const key of portalKeys) {
    const text = portalText(locale, key);
    if (text === key) throw new Error(`portal key ${key} is missing`);
    add(camel(key), text);
  }
  for (const [name, en, ne] of appStrings) add(name, locale === "en" ? en : ne);
  writeFileSync(new URL(`../lib/l10n/app_${locale}.arb`, import.meta.url), `${JSON.stringify(arb, null, 2)}\n`);
}
console.log(`wrote ${portalKeys.length + appStrings.length} strings per locale`);
