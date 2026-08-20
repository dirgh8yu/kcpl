"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export function firebaseClientAuth() {
  const app = getApps().length ? getApp() : initializeApp();
  return getAuth(app);
}
