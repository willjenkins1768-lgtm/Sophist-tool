import { NextResponse } from "next/server";

/**
 * Debug endpoint: confirms whether NEWS_API_KEY is visible to the server.
 * Call GET /api/env-check to verify env is loaded (e.g. after adding .env.local, restart dev server).
 */
export async function GET() {
  const keySet = !!process.env.NEWS_API_KEY?.trim();
  return NextResponse.json({
    NEWS_API_KEY_set: keySet,
    hint: keySet
      ? "Key is set; refresh pipeline will use News API for media."
      : "Key not set. Add NEWS_API_KEY to .env.local and restart the dev server (npm run dev).",
  });
}
