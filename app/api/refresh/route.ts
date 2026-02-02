import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { refresh_small_boats } from "@/lib/pipeline/refresh";

/** Allow up to 60s for refresh (RSS + optional LLM classification can be slow). */
export const maxDuration = 60;
import { validateDRCMData } from "@/lib/validate";
import type { DRCMData } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") ?? "small_boats";
  if (subject !== "small_boats") {
    return NextResponse.json({ error: "Only subject=small_boats supported" }, { status: 400 });
  }
  return runRefresh();
}

export async function POST() {
  return runRefresh();
}

async function runRefresh() {
  try {
    const base = process.cwd();
    const drcmPath = path.join(base, "public", "data", "drcm-sample.json");
    if (!fs.existsSync(drcmPath)) {
      return NextResponse.json({ error: "DRCM data file not found" }, { status: 500 });
    }
    const raw = JSON.parse(fs.readFileSync(drcmPath, "utf-8"));
    const result = validateDRCMData(raw);
    if (!result.valid) {
      return NextResponse.json(
        { error: "Invalid DRCM data", details: result.errors },
        { status: 400 }
      );
    }
    const drcmData = raw as DRCMData;
    const viewModel = await refresh_small_boats(drcmData);
    return NextResponse.json(viewModel);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
