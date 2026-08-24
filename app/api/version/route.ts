import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "kcpl",
      release: "v4-rollout-2026-08-24",
      runtime_revision: process.env.K_REVISION ?? null,
      runtime_service: process.env.K_SERVICE ?? null,
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
