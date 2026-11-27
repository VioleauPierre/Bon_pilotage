import { createEmptySubmissionMemory } from "@/lib/form-memory";
import { fetchSubmissionMemory } from "@/lib/submission-memory-store";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const memory = await fetchSubmissionMemory(getSupabaseAdminClient());
    return NextResponse.json({ ok: true, memory }, { headers });
  } catch {
    console.error("Unable to load bon pilotage suggestions");
    return NextResponse.json({
      ok: true,
      memory: createEmptySubmissionMemory(),
      warning: "Suggestions indisponibles temporairement.",
    }, { headers });
  }
}
