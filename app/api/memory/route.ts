import { createEmptySubmissionMemory } from "@/lib/form-memory";
import { fetchSubmissionMemory } from "@/lib/submission-memory-store";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const memory = await fetchSubmissionMemory(getSupabaseAdminClient());

    return NextResponse.json({ ok: true, memory });
  } catch (error) {
    console.error("Unable to load bon pilotage memory", error);

    return NextResponse.json({
      ok: true,
      memory: createEmptySubmissionMemory(),
      warning: "Suggestions indisponibles temporairement.",
    });
  }
}
