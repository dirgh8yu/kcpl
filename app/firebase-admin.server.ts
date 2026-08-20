import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function adminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {}),
  });
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

export function firebaseStorageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
}
