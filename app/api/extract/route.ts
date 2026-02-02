import { NextResponse } from "next/server";
import { runPriorityExtraction } from "@/lib/extract-run";
import type { ExtractRequest } from "@/lib/extract-types";

function parseAndValidateBody(body: unknown): ExtractRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.partyId !== "string" || typeof b.manifestoText !== "string" || !Array.isArray(b.subjectIds)) return null;
  const subjectIds = b.subjectIds as string[];
  if (!subjectIds.every((id) => typeof id === "string")) return null;
  return { partyId: b.partyId, manifestoText: b.manifestoText, subjectIds, docId: b.docId as string | undefined };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseAndValidateBody(body);
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: "Invalid body: need partyId (string), manifestoText (string), subjectIds (string[])" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is not set. Add it in .env.local." },
      { status: 500 }
    );
  }

  const subjects = (body.subjects as { id: string; label: string }[] | undefined) ?? parsed.subjectIds.map((id) => ({ id, label: id }));
  const docId = parsed.docId ?? "manifesto_extract";
  const partyLabel = body.partyLabel ?? parsed.partyId;

  try {
    const positions = await runPriorityExtraction({
      partyId: parsed.partyId,
      partyLabel: typeof partyLabel === "string" ? partyLabel : parsed.partyId,
      manifestoText: parsed.manifestoText,
      subjects,
      docId,
    });
    return NextResponse.json({ success: true, positions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
