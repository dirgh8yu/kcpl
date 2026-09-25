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

/** App-only strings: [key, English, Nepali, placeholder types if not String]. */
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
  ["homeOnTheWay", "{count, plural, =0{Nothing on the way} =1{1 shipment on the way} other{{count} shipments on the way}}", "{count, plural, =0{बाटोमा केही छैन} other{{count} ढुवानी बाटोमा}}", { count: "int" }],
  ["homeNeedsAttention", "{count, plural, =1{1 needs attention} other{{count} need attention}}", "{count} मा ध्यान चाहिन्छ", { count: "int" }],
  ["homeArriving", "{count} arriving this week", "{count} यो हप्ता आइपुग्दै", { count: "int" }],
  ["homeAllClear", "Everything is moving as planned", "सबै योजनाअनुसार चलिरहेको छ"],
  ["homeNeedsYou", "Needs you", "तपाईंको काम"],
  ["quoteWhereTo", "Where is your cargo going?", "तपाईंको कार्गो कहाँ जाँदैछ?"],
  ["quoteTitle", "Get a quote", "कोटेसन माग्नुहोस्"],
  ["quoteFrom", "From", "कहाँबाट"],
  ["quoteFromHint", "Pickup city, port or border", "उठाउने सहर, बन्दरगाह वा नाका"],
  ["quoteTo", "To", "कहाँसम्म"],
  ["quoteToHint", "Where it should arrive", "कहाँ पुग्नुपर्छ"],
  ["quoteYourRoutes", "Your routes", "तपाईंका रुटहरू"],
  ["quoteModeTitle", "How should it travel?", "कसरी ढुवानी गर्ने?"],
  ["quoteModeRoad", "Road", "सडक"],
  ["quoteModeRoadDetail", "Overland, through the India and China borders", "भारत र चीन नाका हुँदै स्थलमार्ग"],
  ["quoteModeSea", "Sea", "समुद्री"],
  ["quoteModeSeaDetail", "Via Kolkata, Haldia or Vizag, for the largest loads", "कोलकाता, हल्दिया वा विशाखापत्तनम हुँदै, ठूला मालका लागि"],
  ["quoteModeAir", "Air", "हवाई"],
  ["quoteModeAirDetail", "Fastest, into Kathmandu (TIA)", "सबैभन्दा छिटो, काठमाडौं (TIA) सम्म"],
  ["quoteModeUnsure", "Let KCPL advise", "KCPL लाई सल्लाह दिन दिनुहोस्"],
  ["quoteModeUnsureDetail", "We will suggest the best way for your cargo", "तपाईंको कार्गोका लागि उत्तम उपाय हामी सुझाउनेछौं"],
  ["quoteCargoTitle", "Cargo", "कार्गो"],
  ["quoteCargoHint", "What is it? Garments, machinery…", "के हो? कपडा, मेसिनरी…"],
  ["quoteWeightHint", "Weight (optional)", "तौल (ऐच्छिक)"],
  ["quoteWhenTitle", "When", "कहिले"],
  ["quoteWhenSoon", "As soon as possible", "सकेसम्म छिटो"],
  ["quoteWhenWeeks", "Within 2 weeks", "२ हप्ताभित्र"],
  ["quoteWhenMonth", "This month", "यो महिना"],
  ["quoteWhenFlexible", "Flexible", "लचिलो"],
  ["quoteNotesTitle", "Anything else", "अरू केही"],
  ["quoteNotesHint", "Dimensions, packaging, Incoterms, special handling", "नाप, प्याकेजिङ, इन्कोटर्म्स, विशेष ह्यान्डलिङ"],
  ["quoteSubmit", "Request quote", "कोटेसन माग्नुहोस्"],
  ["quoteSending", "Sending…", "पठाउँदै…"],
  ["quoteNeedsRoute", "Add where it is coming from and going to.", "कहाँबाट र कहाँसम्म भन्ने थप्नुहोस्।"],
  ["quoteSentTitle", "Quote requested", "कोटेसन माग गरियो"],
  ["quoteSentBody", "KCPL will reply with a price for {route}.", "KCPL ले {route} को मूल्य पठाउनेछ।"],
  ["quoteDone", "Done", "सकियो"],
  ["continueWithApple", "Continue with Apple", "Apple बाट जारी राख्नुहोस्"],
  ["continueWithGoogle", "Continue with Google", "Google बाट जारी राख्नुहोस्"],
  ["signInWithEmail", "Sign in with email", "इमेलबाट साइन इन गर्नुहोस्"],
  ["orWithEmail", "or with your email", "वा आफ्नो इमेलबाट"],
  ["linkProvider", "This email already has a KCPL password. Sign in with it once and {provider} will be connected for next time.", "यो इमेलमा पहिले नै KCPL पासवर्ड छ। एक पटक त्यसबाट साइन इन गर्नुहोस्, अर्को पटकका लागि {provider} जोडिनेछ।"],
  ["providerOff", "{provider} sign-in is not switched on for KCPL yet. Use your email and password.", "KCPL मा {provider} साइन इन अझै सुरु गरिएको छैन। आफ्नो इमेल र पासवर्ड प्रयोग गर्नुहोस्।"],
  ["sendDocTitle", "Send a document", "कागजात पठाउनुहोस्"],
  ["sendDocKind", "What is it?", "यो के हो?"],
  ["sendDocFile", "The document", "कागजात"],
  ["sendDocFor", "For {reference}", "{reference} का लागि"],
  ["captureTakePhoto", "Take photo", "फोटो खिच्नुहोस्"],
  ["captureChoosePhoto", "Choose photo", "फोटो छान्नुहोस्"],
  ["captureChooseFile", "Choose file", "फाइल छान्नुहोस्"],
  ["captureReplace", "Replace", "बदल्नुहोस्"],
  ["captureCameraDenied", "KCPL can't use the camera. Allow it in your phone's Settings.", "KCPL ले क्यामेरा प्रयोग गर्न सक्दैन। फोनको सेटिङमा अनुमति दिनुहोस्।"],
  ["captureUnsupported", "Send a PDF, JPEG, PNG or WEBP file.", "PDF, JPEG, PNG वा WEBP फाइल पठाउनुहोस्।"],
  ["captureTooLarge", "Files must be {size} MB or smaller.", "फाइल {size} MB वा सोभन्दा सानो हुनुपर्छ।"],
  ["captureHint", "Lay the paper flat in good light, with all four corners in view.", "कागज समतल राखी राम्रो उज्यालोमा चारै कुना देखिने गरी खिच्नुहोस्।"],
  ["sendToKcpl", "Send to KCPL", "KCPL लाई पठाउनुहोस्"],
  ["sending", "Sending…", "पठाउँदै…"],
  ["sendingPercent", "Sending… {percent}%", "पठाउँदै… {percent}%"],
  ["sendDocFootnote", "KCPL checks every document before it counts. Bills of lading, customs entries and proofs of delivery are filed by KCPL.", "KCPL ले जाँचेपछि मात्र कागजात मान्य हुन्छ। बिल अफ लेडिङ, भन्सार प्रविष्टि र डेलिभरी प्रमाण KCPL आफैँ राख्छ।"],
  ["sentTitle", "Sent to KCPL", "KCPL लाई पठाइयो"],
  ["sendChooseKind", "Choose what the document is.", "कागजात के हो छान्नुहोस्।"],
  ["sendChooseFile", "Add a photo or a file first.", "पहिले फोटो वा फाइल थप्नुहोस्।"],
  ["sendAction", "Send", "पठाउनुहोस्"],
  ["confirmPrompt", "Has it arrived?", "सामान आइपुग्यो?"],
  ["confirmPromptBody", "Let KCPL know the cargo reached you.", "सामान तपाईंकहाँ आइपुगेको KCPL लाई जानकारी दिनुहोस्।"],
  ["confirmTitle", "Confirm receipt", "प्राप्ति पुष्टि गर्नुहोस्"],
  ["confirmReceivedBy", "Received by", "बुझ्ने व्यक्ति"],
  ["confirmReceivedByHint", "Who took delivery", "सामान बुझ्ने व्यक्तिको नाम"],
  ["confirmNote", "Anything KCPL should know", "KCPL लाई थाहा हुनुपर्ने कुरा"],
  ["confirmNoteHint", "Condition, missing pieces, damage…", "अवस्था, नपुगेका टुक्रा, क्षति…"],
  ["confirmPhoto", "Photo of the delivery", "डेलिभरीको फोटो"],
  ["confirmPhotoOptional", "Optional. It is filed on the shipment for KCPL to see.", "ऐच्छिक। यो KCPL ले हेर्न ढुवानीमा राखिन्छ।"],
  ["confirmFootnote", "This tells KCPL the cargo arrived. It isn't a proof of delivery: KCPL still files that.", "यसले सामान आइपुगेको KCPL लाई जानकारी दिन्छ। यो डेलिभरी प्रमाण होइन; त्यो KCPL ले नै राख्छ।"],
  ["confirmedTitle", "Thank you", "धन्यवाद"],
  ["confirmedOn", "You confirmed receipt on {date}", "तपाईंले {date} मा प्राप्ति पुष्टि गर्नुभयो"],
  ["confirmedBy", "Received by {name}", "बुझ्ने: {name}"],
  ["receiptSend", "Send payment receipt", "भुक्तानी रसिद पठाउनुहोस्"],
  ["receiptTitle", "Payment receipt", "भुक्तानी रसिद"],
  ["receiptFile", "Bank receipt or advice", "बैंक रसिद वा सूचना"],
  ["receiptAmount", "Amount paid", "तिरेको रकम"],
  ["receiptPaidOn", "Paid on", "तिरेको मिति"],
  ["receiptNote", "Note for KCPL accounts", "KCPL लेखाका लागि टिप्पणी"],
  ["receiptNoteHint", "Bank, reference number…", "बैंक, सन्दर्भ नम्बर…"],
  ["receiptFootnote", "KCPL accounts match every receipt with the bank before the invoice changes.", "बिल परिवर्तन हुनुअघि KCPL लेखाले हरेक रसिद बैंकसँग मिलाउँछ।"],
  ["receiptsTitle", "Receipts you sent", "तपाईंले पठाएका रसिद"],
  ["receiptWithAccounts", "With KCPL accounts", "KCPL लेखामा"],
  ["receiptAcknowledged", "Acknowledged", "स्वीकार गरियो"],
  ["receiptInvalidAmount", "Enter the amount as a number.", "रकम अङ्कमा लेख्नुहोस्।"],
  ["receiptPaidOnDate", "Paid {date}", "{date} मा तिरेको"],
  ["teamTitle", "Team", "टोली"],
  ["teamInvite", "Invite a colleague", "सहकर्मीलाई निम्तो दिनुहोस्"],
  ["teamInviteBody", "They'll see your shipments and documents. Invoices stay with account owners.", "उहाँले तपाईंका ढुवानी र कागजात हेर्न सक्नुहुन्छ। बिल खाता मालिकसँग मात्र रहन्छ।"],
  ["teamSendInvite", "Send invitation", "निम्तो पठाउनुहोस्"],
  ["teamInvited", "Invitation sent", "निम्तो पठाइयो"],
  ["teamInviteSentBody", "{email} will get an email to set a password.", "{email} ले पासवर्ड राख्न इमेल पाउनुहुनेछ।"],
  ["teamInviteLinkBody", "Email isn't set up for KCPL yet, so pass this link to {email} yourself. It works once.", "KCPL को इमेल अझै सेटअप छैन, त्यसैले यो लिङ्क {email} लाई आफैँ पठाउनुहोस्। यो एक पटक मात्र चल्छ।"],
  ["teamShareLink", "Share link", "लिङ्क सेयर गर्नुहोस्"],
  ["teamStateActive", "Active", "सक्रिय"],
  ["teamStateInvited", "Invited", "निम्तो पठाइएको"],
  ["teamStateOff", "Turned off", "बन्द"],
  ["teamStateLinked", "Linked by KCPL", "KCPL ले जोडेको"],
  ["teamYou", "You", "तपाईं"],
  ["teamLastSeen", "Last signed in {date}", "अन्तिम साइन इन {date}"],
  ["teamNeverSignedIn", "Hasn't signed in yet", "अहिलेसम्म साइन इन गर्नुभएको छैन"],
  ["teamTurnOff", "Turn off login", "लगइन बन्द गर्नुहोस्"],
  ["teamTurnOn", "Turn login back on", "लगइन फेरि खोल्नुहोस्"],
  ["teamTurnOffBody", "{email} won't be able to sign in until you turn it back on.", "तपाईंले फेरि नखोलेसम्म {email} ले साइन इन गर्न सक्नुहुने छैन।"],
  ["cancel", "Cancel", "रद्द गर्नुहोस्"],
  ["teamFootnote", "Members see shipments and documents. Only KCPL can add another account owner.", "सदस्यले ढुवानी र कागजात हेर्न सक्छन्। अर्को खाता मालिक KCPL ले मात्र थप्न सक्छ।"],
  ["teamLinkedFootnote", "A login linked by KCPL belongs to another account. Ask KCPL to remove it.", "KCPL ले जोडेको लगइन अर्को खाताको हो। हटाउन KCPL लाई भन्नुहोस्।"],
  ["offlineAsOf", "Offline · as of {time}", "अफलाइन · {time} सम्मको"],
  ["lockSection", "Privacy", "गोपनीयता"],
  ["lockRequire", "Require {method}", "{method} आवश्यक"],
  ["lockFootnote", "KCPL asks for {method} when you come back to it after a minute away, and hides its content in the app switcher.", "एक मिनेटभन्दा बढी बाहिर रहेर फर्कंदा KCPL ले {method} माग्छ, र एप स्विचरमा विवरण लुकाउँछ।"],
  ["lockTitle", "KCPL is locked", "KCPL लक छ"],
  ["lockUnlock", "Unlock", "खोल्नुहोस्"],
  ["lockReason", "Unlock your KCPL account", "आफ्नो KCPL खाता खोल्नुहोस्"],
  ["lockFaceId", "Face ID", "Face ID"],
  ["lockTouchId", "Touch ID", "Touch ID"],
  ["lockFingerprint", "fingerprint", "औंठाछाप"],
  ["lockPasscode", "your passcode", "पासकोड"],
  ["shareStatus", "Share status", "स्थिति सेयर गर्नुहोस्"],
  ["shareExpected", "Expected {date}", "अपेक्षित मिति {date}"],
  ["shareDeliveredOn", "Delivered {date}", "{date} मा डेलिभर भयो"],
  ["shareFooter", "Kapileshwor Cargo · shared from the KCPL app", "कपिलेश्वर कार्गो · KCPL एपबाट सेयर गरिएको"],
  ["shareCarrierRef", "Carrier reference {reference}", "ढुवानी कम्पनीको सन्दर्भ {reference}"],
];

const camel = (key) => key.replace(/[._](\w)/g, (_, c) => c.toUpperCase());

function placeholders(text, types = {}) {
  const names = [...text.matchAll(/\{(\w+)[},]/g)].map((match) => match[1]);
  return Object.fromEntries([...new Set(names)].map((name) => [name, { type: types[name] ?? "String" }]));
}

for (const locale of ["en", "ne"]) {
  const arb = { "@@locale": locale };
  const add = (name, text, types) => {
    if (name in arb) throw new Error(`duplicate ARB key ${name}`);
    arb[name] = text;
    const vars = placeholders(text, types);
    if (locale === "en" && Object.keys(vars).length) arb[`@${name}`] = { placeholders: vars };
  };
  for (const key of portalKeys) {
    const text = portalText(locale, key);
    if (text === key) throw new Error(`portal key ${key} is missing`);
    add(camel(key), text);
  }
  for (const [name, en, ne, types] of appStrings) add(name, locale === "en" ? en : ne, types);
  writeFileSync(new URL(`../lib/l10n/app_${locale}.arb`, import.meta.url), `${JSON.stringify(arb, null, 2)}\n`);
}
console.log(`wrote ${portalKeys.length + appStrings.length} strings per locale`);
