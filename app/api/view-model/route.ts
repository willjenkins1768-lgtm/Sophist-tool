import { NextResponse } from "next/server";
import { getLatestViewModel } from "@/lib/pipeline/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") ?? "small_boats";
  if (subject !== "small_boats") {
    return NextResponse.json({ error: "Only small_boats supported" }, { status: 400 });
  }
  try {
    const viewModel = getLatestViewModel(subject);
    if (!viewModel) {
      return NextResponse.json({ error: "No view model yet; run refresh first" }, { status: 404 });
    }
    return NextResponse.json(viewModel);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load view model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
