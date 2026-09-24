import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

type InjectedFirebaseConfig = {
  projectId?: string;
  storageBucket?: string;
};

function injectedConfig(): InjectedFirebaseConfig {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw || !raw.trim().startsWith("{")) return {};
  try {
    return JSON.parse(raw) as InjectedFirebaseConfig;
  } catch {
    return {};
  }
}

const automaticConfig = injectedConfig();

// Only real strings may reach process.env: Node coerces every other value to a string,
// so `process.env.X ||= undefined` stores the literal "undefined". That single assignment
// made firebaseRuntimeConfigured() report a configured runtime on hosts without
// FIREBASE_CONFIG, which pushed Firestore and Storage calls into an admin SDK that had no
// resolvable project id instead of degrading to the unavailable states the UI already has.
function applyAutomaticConfig(key: string, value: string | undefined) {
  const usable = configuredValue(value);
  if (usable) process.env[key] ||= usable;
}

applyAutomaticConfig("FIREBASE_PROJECT_ID", automaticConfig.projectId);
applyAutomaticConfig("FIREBASE_STORAGE_BUCKET", automaticConfig.storageBucket);

// Blank placeholders and the stringified "undefined"/"null" are treated as absent so a
// misconfigured environment still degrades to the UI's unavailable states.
function configuredValue(value: string | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "undefined" || trimmed === "null" ? "" : trimmed;
}

function adminApp() {
  return getApps().length ? getApp() : initializeApp();
}

export function firebaseRuntimeConfigured() {
  return Boolean(
    configuredValue(process.env.FIREBASE_CONFIG) ||
    configuredValue(process.env.GOOGLE_CLOUD_PROJECT) ||
    configuredValue(process.env.GCLOUD_PROJECT) ||
    configuredValue(process.env.FIREBASE_PROJECT_ID),
  );
}

export function firebaseAdminAuth() {
  return getAuth(adminApp());
}

export function firebaseAdminDb() {
  return getFirestore(adminApp());
}

export function firebaseAdminStorage() {
  return getStorage(adminApp());
}

export function firebaseAdminBucket() {
  return getStorage(adminApp()).bucket();
}

export function firebaseStorageBucketName() {
  return configuredValue(process.env.FIREBASE_STORAGE_BUCKET) || configuredValue(automaticConfig.storageBucket);
}

/** Firebase Cloud Messaging, for push to the KCPL apps. */
export function firebaseAdminMessaging() {
  return getMessaging(adminApp());
}
