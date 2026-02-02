import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getLatestViewModel } from "@/lib/pipeline/storage";
import type { SubjectViewModel } from "@/lib/pipeline/types";

/** Static fallback for Vercel: show a snapshot without running refresh. */
function getStaticViewModel(subjectId: string): SubjectViewModel | null {
  if (subjectId !== "small_boats") return null;
  const base = process.cwd();
  const filePath = path.join(base, "public", "data", "view-model-small-boats.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SubjectViewModel;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") ?? "small_boats";
  if (subject !== "small_boats") {
    return NextResponse.json({ error: "Only small_boats supported" }, { status: 400 });
  }
  try {
    let viewModel = getLatestViewModel(subject);
    if (!viewModel) viewModel = getStaticViewModel(subject);
    if (!viewModel) {
      return NextResponse.json({ error: "No view model yet; run refresh first" }, { status: 404 });
    }
    return NextResponse.json(viewModel);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load view model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
