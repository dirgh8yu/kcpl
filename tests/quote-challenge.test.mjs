import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TURNSTILE_VERIFY_URL,
  configuredChallengeSecret,
  evaluateQuoteChallenge,
  quoteChallengeRequired,
} from "../app/api/quotes/quote-challenge-policy.ts";

// Rate limiting bounds how much one client may send; it cannot tell a script from
// a customer. This is the attestation half, and the branches that matter are the
// ones that decide whether a real enquiry gets through: unconfigured, missing
// token, provider rejection, provider success, and provider unreachable.

function verifyingFetch(result, { status = 200, throws = false } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    if (throws) throw new Error("network down");
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return result;
      },
    };
  };
  return { impl, calls };
}

test("an unconfigured challenge lets the enquiry through and calls nothing", async () => {
  const { impl, calls } = verifyingFetch({ success: true });
  const verdict = await evaluateQuoteChallenge({ token: "", secret: null, fetchImpl: impl });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, "not_configured");
  assert.equal(calls.length, 0, "no provider call when the feature is off");
  assert.equal(quoteChallengeRequired({}), false);
  assert.equal(quoteChallengeRequired({ CLOUDFLARE_TURNSTILE_SECRET_KEY: "   " }), false);
  assert.equal(quoteChallengeRequired({ CLOUDFLARE_TURNSTILE_SECRET_KEY: "secret" }), true);
  assert.equal(configuredChallengeSecret({ CLOUDFLARE_TURNSTILE_SECRET_KEY: " secret " }), "secret");
});

test("a configured challenge refuses a submission that carries no token", async () => {
  const { impl, calls } = verifyingFetch({ success: true });
  const verdict = await evaluateQuoteChallenge({ token: "   ", secret: "s", fetchImpl: impl });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "missing_token");
  assert.equal(calls.length, 0, "nothing to verify means no provider call");
});

test("a token the provider rejects refuses the submission and keeps the reason for logs", async () => {
  const { impl } = verifyingFetch({ success: false, "error-codes": ["invalid-input-response"] });
  const verdict = await evaluateQuoteChallenge({ token: "bad", secret: "s", fetchImpl: impl });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "rejected");
  assert.equal(verdict.detail, "invalid-input-response");
});

test("a verified token lets the enquiry through", async () => {
  const { impl, calls } = verifyingFetch({ success: true });
  const verdict = await evaluateQuoteChallenge({
    token: "good",
    secret: "the-secret",
    remoteAddress: "203.0.113.9",
    fetchImpl: impl,
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, "verified");

  // The wire format is the part that silently breaks if it drifts: Turnstile
  // wants a form-encoded POST, not JSON, and the field names are fixed.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TURNSTILE_VERIFY_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.match(String(calls[0].init.headers["content-type"]), /x-www-form-urlencoded/);
  const body = calls[0].init.body;
  assert.equal(body.get("secret"), "the-secret");
  assert.equal(body.get("response"), "good");
  assert.equal(body.get("remoteip"), "203.0.113.9");
});

test("the address is omitted rather than sent empty when the runtime exposes none", async () => {
  const { impl, calls } = verifyingFetch({ success: true });
  await evaluateQuoteChallenge({ token: "good", secret: "s", remoteAddress: null, fetchImpl: impl });
  assert.equal(calls[0].init.body.get("remoteip"), null);
});

test("an unreachable provider fails open, and only after an explicit rejection has not happened", async () => {
  const { impl } = verifyingFetch({}, { throws: true });
  const verdict = await evaluateQuoteChallenge({ token: "good", secret: "s", fetchImpl: impl });

  // Turnstile being unreachable is not evidence a customer is a bot, and the
  // rate limit still bounds abuse, so the enquiry is allowed through.
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, "transport_error");
});

test("a provider HTTP error is treated as unavailable, not as a rejection", async () => {
  const { impl } = verifyingFetch({ success: false }, { status: 502 });
  const verdict = await evaluateQuoteChallenge({ token: "good", secret: "s", fetchImpl: impl });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, "transport_error");
});

test("the quote route checks attestation before it does CRM or Firestore work", () => {
  const route = readFileSync(new URL("../app/api/quotes/route.ts", import.meta.url), "utf8");

  assert.match(route, /evaluateQuoteChallenge/, "the route must verify the token");
  assert.match(route, /challengeToken/, "the token has to come from the submitted payload");
  assert.match(route, /403/, "an unattested submission is refused, not accepted");
  assert.match(route, /transport_error/, "degradation is detected so it can be logged");

  const challengeIndex = route.indexOf("evaluateQuoteChallenge({");
  const limitIndex = route.indexOf("checkQuoteRateLimit({");
  const crmIndex = route.indexOf("findCrmDuplicates(");
  const writeIndex = route.indexOf(".doc(reference).create(");
  assert.ok(challengeIndex > 0, "the challenge call must be present");
  assert.ok(
    challengeIndex < limitIndex,
    "attestation runs first so a script cannot spend a shared address budget",
  );
  assert.ok(challengeIndex < crmIndex && challengeIndex < writeIndex);

  // The challenge is optional, so it must not become a hard requirement in code.
  assert.doesNotMatch(route, /CLOUDFLARE_TURNSTILE_SECRET_KEY/, "the route reads policy, not env");
});

test("the form only asks for a token when a site key is configured", () => {
  const form = readFileSync(new URL("../app/components/quote-enquiry.tsx", import.meta.url), "utf8");
  const helper = readFileSync(
    new URL("../app/components/turnstile-challenge.ts", import.meta.url),
    "utf8",
  );

  assert.match(form, /turnstileSiteKey\(\)/, "the form has to know whether the challenge is on");
  assert.match(form, /requestChallengeToken/, "the token is requested on submit");
  assert.match(form, /challengeToken/, "the token is sent with the enquiry");
  assert.match(form, /siteKey \?/, "no site key must mean no challenge work");

  // Invisible mode and lazy loading keep this from changing the form's layout or
  // costing a third-party request on page load.
  assert.match(helper, /size: "invisible"/, "the widget must not add a visible box");
  assert.match(helper, /NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY/);
  assert.match(helper, /render=explicit/, "explicit rendering is what allows invisible mode");
});
