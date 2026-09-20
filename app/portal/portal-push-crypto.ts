import { createCipheriv, createECDH, createHash, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

/*
 * Web Push encryption and VAPID signing.
 *
 * Implemented directly on node:crypto rather than pulled in as a dependency,
 * for the same reason this repository renders invoices by printing the page
 * instead of adding a PDF library: anything added here has to clear the
 * `npm audit` gate forever afterwards, and the primitives are all in the
 * standard library.
 *
 * What that buys and what it costs. RFC 8291 encrypts *to* the browser's own
 * public key, so getting this wrong cannot leak anything -- the failure mode
 * is that the browser cannot decrypt and drops the message, or the push
 * service answers 400. Both are loud. What it does not buy is a guarantee
 * against a misreading of the spec, which is why the tests decrypt a real
 * payload back with an independently written reader rather than only checking
 * that encryption produced bytes.
 *
 * References: RFC 8188 (aes128gcm content coding), RFC 8291 (message
 * encryption for Web Push), RFC 8292 (VAPID).
 */

/**
 * The Firestore id for one subscription.
 *
 * Endpoints are long and carry characters a document id cannot, so they are
 * hashed. Keying by the endpoint means a browser re-subscribing refreshes its
 * row rather than accumulating a duplicate that would push twice to one phone.
 */
export function pushSubscriptionId(endpoint: string) {
  return createHash("sha256").update(endpoint.trim()).digest("hex").slice(0, 48);
}

export function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

export function base64UrlEncode(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmac(key: Buffer, data: Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

/** HKDF with a one-byte counter: every expansion here is a single block. */
function hkdfExpandOnce(prk: Buffer, info: Buffer, length: number) {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

function infoLabel(label: string) {
  // RFC 8188 labels are the ASCII string followed by a single zero byte.
  return Buffer.concat([Buffer.from(label, "ascii"), Buffer.from([0])]);
}

export type PushSubscriptionKeys = {
  /** The browser's public key, uncompressed P-256 point, 65 bytes. */
  p256dh: string;
  /** The subscription's shared authentication secret, 16 bytes. */
  auth: string;
};

/**
 * Encrypt one push message body.
 *
 * `salt` and `serverKey` are injectable so a test can reproduce a known
 * result; production always takes the random defaults.
 */
export function encryptPushPayload(input: {
  payload: string;
  keys: PushSubscriptionKeys;
  salt?: Buffer;
  serverPrivateKey?: Buffer;
}) {
  const uaPublic = base64UrlDecode(input.keys.p256dh);
  const authSecret = base64UrlDecode(input.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("Subscription key is not an uncompressed P-256 point.");
  if (authSecret.length !== 16) throw new Error("Subscription auth secret must be 16 bytes.");

  const ecdh = createECDH("prime256v1");
  if (input.serverPrivateKey) {
    ecdh.setPrivateKey(input.serverPrivateKey);
  } else {
    ecdh.generateKeys();
  }
  const serverPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublic);

  // RFC 8291 §3.3: the auth secret salts the ECDH output, and the combined
  // key material is bound to both public keys so a message encrypted for one
  // subscription cannot be replayed at another.
  const keyPrk = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([infoLabel("WebPush: info"), uaPublic, serverPublic]);
  const ikm = hkdfExpandOnce(keyPrk, keyInfo, 32);

  const salt = input.salt ?? randomBytes(16);
  const prk = hmac(salt, ikm);
  const contentEncryptionKey = hkdfExpandOnce(prk, infoLabel("Content-Encoding: aes128gcm"), 16);
  const nonce = hkdfExpandOnce(prk, infoLabel("Content-Encoding: nonce"), 12);

  // A single record, so the padding delimiter is 0x02 ("last record").
  const plaintext = Buffer.concat([Buffer.from(input.payload, "utf8"), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  // RFC 8188 §2.1 header: salt | record size | key id length | key id.
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic]);

  return Buffer.concat([header, ciphertext]);
}

export type VapidKeys = {
  /** Uncompressed P-256 public point, base64url, 65 bytes decoded. */
  publicKey: string;
  /** Private scalar, base64url, 32 bytes decoded. */
  privateKey: string;
  /** A mailto: or https: contact the push service can reach. */
  subject: string;
};

function vapidPrivateKeyObject(keys: VapidKeys) {
  const publicKey = base64UrlDecode(keys.publicKey);
  const privateKey = base64UrlDecode(keys.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new Error("VAPID public key is not an uncompressed P-256 point.");
  if (privateKey.length !== 32) throw new Error("VAPID private key must be 32 bytes.");
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(publicKey.subarray(1, 33)),
      y: base64UrlEncode(publicKey.subarray(33, 65)),
      d: base64UrlEncode(privateKey),
    },
  });
}

/**
 * The VAPID Authorization header for one push endpoint.
 *
 * The audience is the endpoint's origin and nothing more: a token minted for
 * one push service must not be presentable at another.
 */
export function vapidAuthorization(input: { endpoint: string; keys: VapidKeys; now?: number; expiresInSeconds?: number }) {
  const audience = new URL(input.endpoint).origin;
  const issuedAt = Math.floor((input.now ?? Date.now()) / 1000);
  // Push services reject tokens valid for more than 24 hours; 12 is the
  // conventional half of that and leaves room for clock skew either way.
  const expiry = issuedAt + (input.expiresInSeconds ?? 12 * 60 * 60);

  const header = base64UrlEncode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = base64UrlEncode(Buffer.from(JSON.stringify({ aud: audience, exp: expiry, sub: input.keys.subject })));
  const signingInput = Buffer.from(`${header}.${body}`, "ascii");

  // ES256 signatures are the raw r||s pair, not the DER structure node
  // produces by default.
  const signature = sign("sha256", signingInput, {
    key: vapidPrivateKeyObject(input.keys),
    dsaEncoding: "ieee-p1363",
  });

  const token = `${header}.${body}.${base64UrlEncode(signature)}`;
  return `vapid t=${token}, k=${input.keys.publicKey}`;
}
