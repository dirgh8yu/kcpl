import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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
process.env.FIREBASE_PROJECT_ID ||= automaticConfig.projectId;
process.env.FIREBASE_STORAGE_BUCKET ||= automaticConfig.storageBucket;

function adminApp() {
  return getApps().length ? getApp() : initializeApp();
}

export function firebaseRuntimeConfigured() {
  return Boolean(
    process.env.FIREBASE_CONFIG ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID,
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
  return process.env.FIREBASE_STORAGE_BUCKET || automaticConfig.storageBucket || "";
}
