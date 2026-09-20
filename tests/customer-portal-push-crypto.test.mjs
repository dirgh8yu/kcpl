import assert from "node:assert/strict";
import test from "node:test";
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from "node:crypto";

import {
  base64UrlDecode,
  base64UrlEncode,
  encryptPushPayload,
  vapidAuthorization,
} from "../app/portal/portal-push-crypto.ts";

/*
 * The reader below is written from RFC 8188 and RFC 8291 rather than by
 * reusing anything from the module under test. If the encrypter drifts from
 * the spec, this decrypts to the wrong bytes or fails its authentication tag
 * -- which is the only check available without a real push service.
 */

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function expand(prk, label, length) {
  const info = Buffer.concat([Buffer.from(label, "ascii"), Buffer.from([0]), Buffer.from([1])]);
  return hmac(prk, info).subarray(0, length);
}

function decryptPush(body, { privateKey, authSecret }) {
  // RFC 8188 §2.1 header.
  const salt = body.subarray(0, 16);
  const recordSize = body.readUInt32BE(16);
  const keyIdLength = body[20];
  const serverPublic = body.subarray(21, 21 + keyIdLength);
  const ciphertext = body.subarray(21 + keyIdLength);

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKey);
  const uaPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(serverPublic);

  // RFC 8291 §3.3.
  const keyPrk = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info", "ascii"),
    Buffer.from([0]),
    uaPublic,
    serverPublic,
    Buffer.from([1]),
  ]);
  const ikm = hmac(keyPrk, keyInfo).subarray(0, 32);

  const prk = hmac(salt, ikm);
  const cek = expand(prk, "Content-Encoding: aes128gcm", 16);
  const nonce = expand(prk, "Content-Encoding: nonce", 12);

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const sealed = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const padded = Buffer.concat([decipher.update(sealed), decipher.final()]);

  return { text: padded.subarray(0, padded.length - 1).toString("utf8"), delimiter: padded[padded.length - 1], recordSize, serverPublic };
}

function subscriber() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const authSecret = randomBytes(16);
  return {
    privateKey: ecdh.getPrivateKey(),
    authSecret,
    keys: { p256dh: base64UrlEncode(ecdh.getPublicKey()), auth: base64UrlEncode(authSecret) },
  };
}

/* ------------------------------------------------------------------ *
 * Encryption
 * ------------------------------------------------------------------ */

test("a browser holding the subscription key can decrypt what we send", () => {
  const ua = subscriber();
  const payload = JSON.stringify({ title: "KCPL-S-1 · In transit", body: "The cargo is in transit." });
  const body = encryptPushPayload({ payload, keys: ua.keys });

  const decrypted = decryptPush(body, ua);
  assert.equal(decrypted.text, payload);
  // A single record ends with the 0x02 "last record" delimiter; 0x01 here
  // would tell the browser to expect another record that never arrives.
  assert.equal(decrypted.delimiter, 2);
  assert.equal(decrypted.recordSize, 4096);
  assert.equal(decrypted.serverPublic.length, 65);
});

test("Nepali survives the round trip", () => {
  const ua = subscriber();
  const payload = JSON.stringify({ title: "फ्री टाइम सकिँदै", body: "१ दिन फ्री टाइम बाँकी छ।" });
  const body = encryptPushPayload({ payload, keys: ua.keys });
  // Multi-byte UTF-8 is where a length computed in characters rather than
  // bytes would break, and the whole point of this feature is Nepali readers.
  assert.equal(decryptPush(body, ua).text, payload);
});

test("two sends of the same message differ, because the salt and key are fresh", () => {
  const ua = subscriber();
  const first = encryptPushPayload({ payload: "same", keys: ua.keys });
  const second = encryptPushPayload({ payload: "same", keys: ua.keys });
  assert.notDeepEqual(first, second);
  assert.equal(decryptPush(first, ua).text, "same");
  assert.equal(decryptPush(second, ua).text, "same");
});

test("a message encrypted for one subscription cannot be read by another", () => {
  const intended = subscriber();
  const other = subscriber();
  const body = encryptPushPayload({ payload: "private", keys: intended.keys });
  // The key material is bound to both public keys and the auth secret, so the
  // wrong recipient fails the authentication tag rather than reading plaintext.
  assert.throws(() => decryptPush(body, other));
});

test("a tampered payload fails its authentication tag", () => {
  const ua = subscriber();
  const body = encryptPushPayload({ payload: "honest", keys: ua.keys });
  const tampered = Buffer.from(body);
  tampered[tampered.length - 20] ^= 0xFF;
  assert.throws(() => decryptPush(tampered, ua));
});

test("a malformed subscription is refused before anything is encrypted", () => {
  const ua = subscriber();
  assert.throws(
    () => encryptPushPayload({ payload: "x", keys: { ...ua.keys, auth: base64UrlEncode(randomBytes(8)) } }),
    /auth secret must be 16 bytes/,
  );
  assert.throws(
    () => encryptPushPayload({ payload: "x", keys: { ...ua.keys, p256dh: base64UrlEncode(randomBytes(65)) } }),
    /uncompressed P-256 point/,
  );
});

test("the header lays out exactly as RFC 8188 describes", () => {
  const ua = subscriber();
  const salt = randomBytes(16);
  const body = encryptPushPayload({ payload: "x", keys: ua.keys, salt });
  assert.deepEqual(body.subarray(0, 16), salt);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(body[20], 65, "key id length must be the uncompressed point length");
  assert.equal(body[21], 0x04, "the key id is the server's uncompressed public point");
});

/* ------------------------------------------------------------------ *
 * VAPID
 * ------------------------------------------------------------------ */

const vapid = (() => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: base64UrlEncode(ecdh.getPublicKey()),
    privateKey: base64UrlEncode(ecdh.getPrivateKey()),
    subject: "mailto:ops@kcpl.example",
  };
})();

function parseVapid(header) {
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  assert.ok(match, `unexpected header shape: ${header}`);
  const [, token, key] = match;
  const [encodedHeader, encodedBody, encodedSignature] = token.split(".");
  return {
    key,
    token,
    header: JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")),
    body: JSON.parse(base64UrlDecode(encodedBody).toString("utf8")),
    signature: base64UrlDecode(encodedSignature),
    signingInput: Buffer.from(`${encodedHeader}.${encodedBody}`, "ascii"),
  };
}

test("the VAPID token is a valid ES256 JWT for this endpoint", () => {
  const header = vapidAuthorization({
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: vapid,
    now: Date.UTC(2026, 8, 20, 0, 0, 0),
  });
  const parsed = parseVapid(header);

  assert.deepEqual(parsed.header, { typ: "JWT", alg: "ES256" });
  // The audience is the endpoint's origin and nothing more, so a token minted
  // for one push service cannot be presented at another.
  assert.equal(parsed.body.aud, "https://fcm.googleapis.com");
  assert.equal(parsed.body.sub, "mailto:ops@kcpl.example");
  assert.equal(parsed.key, vapid.publicKey);

  // ES256 is the raw r||s pair; a DER signature would be rejected as invalid
  // by every push service, and is the easy mistake here.
  assert.equal(parsed.signature.length, 64);

  const publicPoint = base64UrlDecode(vapid.publicKey);
  const publicKey = createPublicKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(publicPoint.subarray(1, 33)),
      y: base64UrlEncode(publicPoint.subarray(33, 65)),
    },
  });
  assert.equal(
    verify("sha256", parsed.signingInput, { key: publicKey, dsaEncoding: "ieee-p1363" }, parsed.signature),
    true,
  );
});

test("the token expires inside the 24 hours push services allow", () => {
  const now = Date.UTC(2026, 8, 20, 0, 0, 0);
  const parsed = parseVapid(vapidAuthorization({ endpoint: "https://push.example/x", keys: vapid, now }));
  const seconds = parsed.body.exp - Math.floor(now / 1000);
  assert.ok(seconds > 0 && seconds <= 24 * 60 * 60, `expiry ${seconds}s is outside the permitted window`);
});

test("a different endpoint gets a different audience and a different signature", () => {
  const now = Date.UTC(2026, 8, 20, 0, 0, 0);
  const one = parseVapid(vapidAuthorization({ endpoint: "https://push.example/a", keys: vapid, now }));
  const two = parseVapid(vapidAuthorization({ endpoint: "https://other.example/b", keys: vapid, now }));
  assert.notEqual(one.body.aud, two.body.aud);
  assert.notEqual(one.token, two.token);
});

test("a VAPID value of the wrong shape is refused", () => {
  assert.throws(
    () => vapidAuthorization({ endpoint: "https://push.example/x", keys: { ...vapid, privateKey: base64UrlEncode(randomBytes(16)) } }),
    /private key must be 32 bytes/,
  );
  // Deterministically not an uncompressed point: the prefix must be 0x04, and
  // a random first byte would only be one 1 run in 256 of the time -- which is
  // exactly how this test flaked before it was pinned.
  const wrongPrefix = Buffer.concat([Buffer.from([0x02]), randomBytes(64)]);
  assert.throws(
    () => vapidAuthorization({ endpoint: "https://push.example/x", keys: { ...vapid, publicKey: base64UrlEncode(wrongPrefix) } }),
    /uncompressed P-256 point/,
  );
});

test("a VAPID value of the right shape that is not on the curve says so clearly", () => {
  // 65 bytes with the correct 0x04 prefix passes the shape check and fails
  // inside node, which reports only "Invalid JWK EC key" -- no help at all to
  // whoever is configuring KCPL.
  const offCurve = Buffer.concat([Buffer.from([0x04]), randomBytes(64)]);
  assert.throws(
    () => vapidAuthorization({ endpoint: "https://push.example/x", keys: { ...vapid, publicKey: base64UrlEncode(offCurve) } }),
    /matching pair/,
  );
});

test("a public and private value from different key pairs is refused", () => {
  const other = createECDH("prime256v1");
  other.generateKeys();
  // The likeliest real misconfiguration: two halves of two different runs of
  // the generator documented in .env.example.
  assert.throws(
    () => vapidAuthorization({ endpoint: "https://push.example/x", keys: { ...vapid, privateKey: base64UrlEncode(other.getPrivateKey()) } }),
    /matching pair/,
  );
});
