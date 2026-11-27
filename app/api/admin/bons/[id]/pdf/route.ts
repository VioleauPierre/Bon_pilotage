import { z } from "zod";
import { getAdminSession, privateError, privateHeaders } from "@/lib/admin-auth";
import { findSubmission, makeDocument } from "@/lib/admin-submissions";
import { buildBonPilotagePdf } from "@/lib/bon-pilotage-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return privateError("Accès administrateur requis.", 401);
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return privateError("Bon introuvable.", 404);

  try {
    const row = await findSubmission(id.data);
    if (!row) return privateError("Bon introuvable.", 404);

    const { buffer, fileName } = await buildBonPilotagePdf(makeDocument(row), row.pdf_template_version);
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
      },
    });
  } catch {
    console.error("Unable to serve administrative PDF");
    return privateError("Le PDF est temporairement indisponible.", 503);
  }
}
