import { fetchSubmissionMemory } from "@/lib/submission-memory-store";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const memory = await fetchSubmissionMemory(getSupabaseAdminClient());

    return NextResponse.json({ ok: true, memory });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Impossible de charger les suggestions.",
      },
      { status: 500 },
    );
  }
}
