// Generate the secrets that pair with nothing outside KCPL, and print the
// commands that store them.
//
//   node scripts/generate-launch-secrets.mjs
//
// Three of the values the runtime wants have no counterpart to coordinate with:
// the automation bearer, the rate-limit salt and the VAPID keypair. They can be
// invented on the spot, which means nobody needs to send them to anybody, and
// they should be invented rather than chosen.
//
// Values are printed once, here, and never written to a file in the repository.
// The commands below read them from your clipboard or your shell history, so
// treat this output the way you would treat a password manager entry.
import { createECDH, randomBytes } from "node:crypto";

const base64url = (buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The portal wants an uncompressed P-256 point and its 32-byte scalar, both
 * base64url. Generating both halves from one curve object is what keeps them a
 * matching pair: two halves of two different runs sign happily and every push
 * service answers 401. */
function vapidKeypair() {
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  const publicKey = curve.getPublicKey();
  const privateKey = curve.getPrivateKey();
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new Error("generated public key is not an uncompressed P-256 point");
  // getPrivateKey can return fewer than 32 bytes when the scalar has leading
  // zeroes, and the reader requires exactly 32.
  const padded = Buffer.alloc(32);
  privateKey.copy(padded, 32 - privateKey.length);
  return { publicKey: base64url(publicKey), privateKey: base64url(padded) };
}

const contact = process.argv[2] || "admin@kapileshworcargo.com.np";
const vapid = vapidKeypair();
const values = {
  // 48 bytes of hex is 96 characters, comfortably past the 32 the readiness
  // probe requires and past anything worth guessing at.
  KCPL_AUTOMATION_SECRET: randomBytes(48).toString("hex"),
  KCPL_RATE_LIMIT_SALT: randomBytes(32).toString("hex"),
  KCPL_VAPID_PUBLIC_KEY: vapid.publicKey,
  KCPL_VAPID_PRIVATE_KEY: vapid.privateKey,
  KCPL_VAPID_SUBJECT: contact.startsWith("http") ? contact : `mailto:${contact}`,
};

console.log("Generated. Nothing here has been stored or sent anywhere.\n");
for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);

console.log(`
To store them in App Hosting, one per line, pasting the value when prompted:

${Object.keys(values).map((key) => `  firebase apphosting:secrets:set ${key} --project kcpl-82574`).join("\n")}

Or without the value ever touching your shell history:

${Object.keys(values).map((key) => `  printf %s "$${key}" | firebase apphosting:secrets:set ${key} --project kcpl-82574 --data-file -`).join("\n")}

Create the secrets BEFORE adding them to apphosting.yaml. A binding that names
a secret Secret Manager does not hold fails the rollout, which takes the site
down rather than leaving a feature off. The CLI offers to add the binding for
you once the secret exists; say yes, or add it by hand:

${Object.keys(values).map((key) => `  - variable: ${key}\n    secret: ${key}\n    availability: [RUNTIME]`).join("\n")}

KCPL_AUTOMATION_SECRET is the one with a second half. Whatever calls
POST /api/internal/automation on a schedule needs the same value as a bearer
token. Until both ends match the sweep stays unauthenticated, and no milestone
email or push notification is sent no matter how well SendGrid is configured.
`);
