import { isTrustedSameOriginRequest } from "../../request-security.ts";
import { evaluateQuoteChallenge } from "./quote-challenge-policy.ts";
import { checkQuoteRateLimit, clientAddress, quoteRateLimitPolicies, type RateLimitStore } from "./quote-rate-limit-policy.ts";
import { sanitizeQuoteAttribution } from "../../quote-attribution.ts";
import { buildQuoteRecord, type CleanQuote, type QuoteCrmMatch } from "./quote-record.ts";

/*
 * The public quote submission endpoint, with its three I/O collaborators
 * (the record store, the CRM duplicate lookup and the rate-limit store) passed
 * in rather than imported. `route.ts` wires the Firestore-backed ones; the
 * factory exists so the whole request path — validation, storage guard,
 * challenge, rate limit, CRM matching, the write and the response — can be
 * driven by `tests/quote-endpoint-lane.test.mjs` without Firebase.
 *
 * The setter below is the test-only override. It is module-level so a test that
 * imports the real `POST` from `route.ts` can replace the store for that one
 * process; nothing in the application calls it.
 *
 * The storage guard keeps its production behaviour: with no injected store and
 * no Firebase configuration the endpoint answers 503 before it does any CRM or
 * challenge work, exactly as it did when the guard read the environment
 * directly.
 */

export type QuoteRecordStore = {
  create(reference: string, record: Record<string, unknown>): Promise<void>;
};

export type QuoteCrmMatcher = (input: {
  displayName: string;
  primaryEmail: string;
  primaryPhone: string;
  taxId: string;
}) => Promise<QuoteCrmMatch[]>;

export type QuoteEndpointDeps = {
  firestoreStore: () => Promise<QuoteRecordStore>;
  crmMatcher: QuoteCrmMatcher;
  rateLimitStore: () => Promise<RateLimitStore>;
};

type QuoteEndpointTestHooks = {
  store?: QuoteRecordStore | null;
  crmMatcher?: QuoteCrmMatcher;
  rateLimitStore?: RateLimitStore;
};

const noHooks: QuoteEndpointTestHooks = {};
let testHooks: QuoteEndpointTestHooks = noHooks;

/** Test-only: replace the endpoint's I/O for this process. Not used by the app. */
export function setQuoteEndpointTestHooks(hooks: QuoteEndpointTestHooks) {
  testHooks = hooks;
}

/** Test-only: put the real wiring back. */
export function clearQuoteEndpointTestHooks() {
  testHooks = noHooks;
}

const allowedModes = new Set(["air", "sea", "road", "unsure"]);
const allowedWeightUnits = new Set(["kg", "tonnes", "lb"]);
const allowedDimensionUnits = new Set(["cm", "m", "in"]);

const fieldLimits = {
  origin: 120,
  destination: 120,
  cargoType: 160,
  weight: 40,
  length: 40,
  width: 40,
  height: 40,
  timing: 120,
  requirements: 3000,
  contactName: 120,
  contactEmail: 254,
  companyName: 160,
  phone: 80,
} as const;

type QuotePayload = {
  origin?: unknown;
  destination?: unknown;
  mode?: unknown;
  cargoType?: unknown;
  weight?: unknown;
  weightUnit?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  dimensionUnit?: unknown;
  timing?: unknown;
  requirements?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  companyName?: unknown;
  phone?: unknown;
  website?: unknown;
  challengeToken?: unknown;
  attribution?: unknown;
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validate(payload: QuotePayload): { data?: CleanQuote; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values = {
    origin: text(payload.origin),
    destination: text(payload.destination),
    mode: text(payload.mode),
    cargoType: text(payload.cargoType),
    weight: text(payload.weight),
    weightUnit: text(payload.weightUnit) || "kg",
    length: text(payload.length),
    width: text(payload.width),
    height: text(payload.height),
    dimensionUnit: text(payload.dimensionUnit) || "cm",
    timing: text(payload.timing),
    requirements: text(payload.requirements),
    contactName: text(payload.contactName),
    contactEmail: text(payload.contactEmail).toLowerCase(),
    companyName: text(payload.companyName),
    phone: text(payload.phone),
  };

  for (const [field, max] of Object.entries(fieldLimits)) {
    const value = values[field as keyof typeof values];
    if (value.length > max) errors[field] = `Must be ${max} characters or fewer.`;
  }

  if (!values.origin) errors.origin = "Origin is required.";
  if (!values.destination) errors.destination = "Destination is required.";
  if (!values.contactName) errors.contactName = "Name is required.";
  if (!values.contactEmail) errors.contactEmail = "Email is required.";
  if (!allowedModes.has(values.mode)) errors.mode = "Choose a valid freight mode.";
  if (!allowedWeightUnits.has(values.weightUnit)) errors.weightUnit = "Choose a valid weight unit.";
  if (!allowedDimensionUnits.has(values.dimensionUnit)) errors.dimensionUnit = "Choose a valid dimension unit.";
  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) errors.contactEmail = "Enter a valid email address.";

  if (Object.keys(errors).length) return { errors };
  return { data: values };
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `KCPL-Q-${date}-${suffix}`;
}

/** The guard's rule, unchanged: storage exists only where Firebase is configured. */
function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export function createQuoteEndpoint(deps: QuoteEndpointDeps) {
  return async function POST(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "Send the enquiry as JSON." }, 415);
    }

    if (!isTrustedSameOriginRequest(request)) {
      return json({ ok: false, error: "Cross-origin submissions are not accepted." }, 403);
    }

    let payload: QuotePayload;
    try {
      payload = await request.json() as QuotePayload;
    } catch {
      return json({ ok: false, error: "The enquiry could not be read." }, 400);
    }

    if (text(payload.website)) {
      return json({ ok: false, error: "The enquiry could not be submitted." }, 400);
    }

    const validated = validate(payload);
    if (!validated.data) {
      return json({ ok: false, error: "Please check the highlighted details.", fields: validated.errors }, 400);
    }

    // The guard, unchanged: an injected store is the test seam, otherwise the
    // same environment check as before.
    const store = testHooks.store !== undefined
      ? testHooks.store
      : firebaseConfigured() ? await deps.firestoreStore() : null;
    if (!store) {
      return json({ ok: false, error: "Quote storage is not configured yet. Please email KCPL instead." }, 503);
    }

    const quote = validated.data;
    const reference = createReference();
    const createdAt = new Date().toISOString();
    const remoteAddress = clientAddress(request);
    const attribution = sanitizeQuoteAttribution(payload.attribution);

    // Attestation first: a scripted client is refused before it can spend a shared
    // address budget that a legitimate customer behind the same NAT also needs.
    // Unconfigured challenges return immediately, so this costs nothing until the
    // keys exist.
    const challenge = await evaluateQuoteChallenge({
      token: text(payload.challengeToken),
      remoteAddress,
    });
    if (challenge.reason === "transport_error") {
      console.warn("Quote challenge verification was degraded for this submission");
    }
    if (!challenge.ok) {
      console.warn("Quote submission failed its challenge", { reference, reason: challenge.reason, detail: challenge.detail });
      return json(
        {
          ok: false,
          error: "KCPL could not verify this submission as a genuine enquiry. Please try again, or email us directly.",
        },
        403,
      );
    }

    // Abuse control before any Firestore or CRM work is done on KCPL's behalf.
    // A scripted client reaching this route otherwise costs a duplicate scan plus
    // a write per request.
    const limit = await checkQuoteRateLimit({
      subjects: [
        { policy: quoteRateLimitPolicies.address, value: remoteAddress },
        { policy: quoteRateLimitPolicies.contact, value: quote.contactEmail },
      ],
      store: testHooks.rateLimitStore ?? await deps.rateLimitStore(),
    });
    if (limit.degraded) {
      console.warn("Quote rate limiting was degraded for this submission");
    }
    if (!limit.allowed) {
      console.warn("Quote submission rate limited", { reference, policy: limit.blockedBy });
      return json(
        {
          ok: false,
          error: "Too many enquiries from this connection. Please try again shortly, or email KCPL directly.",
        },
        429,
        { "retry-after": String(limit.retryAfterSeconds) },
      );
    }

    const crmMatcher = testHooks.crmMatcher ?? deps.crmMatcher;
    let crmMatches: QuoteCrmMatch[] = [];

    try {
      crmMatches = await crmMatcher({
        displayName: quote.companyName || quote.contactName,
        primaryEmail: quote.contactEmail,
        primaryPhone: quote.phone,
        taxId: "",
      });
    } catch (error) {
      console.error("CRM matching skipped for quote", reference, error);
    }

    try {
      await store.create(reference, buildQuoteRecord({
        reference,
        createdAt,
        quote,
        attribution,
        crmMatches,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to save KCPL Firestore quote enquiry", { message });
      return json({ ok: false, error: "KCPL could not save the enquiry. Please try again or email us directly." }, 500);
    }

    return json({
      ok: true,
      reference,
      message: "Your freight enquiry has been received by KCPL.",
    }, 201);
  };
}
