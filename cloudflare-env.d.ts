/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    DOCUMENTS?: R2Bucket;
    KCPL_ADMIN_PASSWORD?: string;
    KCPL_ADMIN_SESSION_SECRET?: string;
    KCPL_ADMIN_NAME?: string;
    KCPL_ADMIN_EMAIL?: string;
  }
}

export {};
