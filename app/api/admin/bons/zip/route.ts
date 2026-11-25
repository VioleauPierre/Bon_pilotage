import { zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { getAdminSession, privateError, privateHeaders } from "@/lib/admin-auth";
import { parseAdminFilters } from "@/lib/admin-filters";
import { listZipSubmissions, makeDocument, ZIP_LIMIT } from "@/lib/admin-submissions";
import { buildBonPilotagePdf } from "@/lib/bon-pilotage-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4_000_000;

export async function GET(request: Request) {
  if (!(await getAdminSession())) return privateError("Accès administrateur requis.", 401);

  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");
  const selected = z.array(z.uuid()).max(ZIP_LIMIT).safeParse([...new Set(params.getAll("id"))]);
  if (!selected.success) return privateError(`Sélectionnez au maximum ${ZIP_LIMIT} bons valides.`, 400);
  if (mode !== "selected" && mode !== "filtered") return privateError("Choisissez un mode de téléchargement.", 400);
  if (mode === "selected" && selected.data.length === 0) return privateError("Sélectionnez au moins un bon.", 400);
  const filters = parseAdminFilters(params);
  if (mode === "filtered" && filters.error) return privateError(filters.error, 400);

  try {
    const ids = mode === "selected" ? selected.data : [];
    const rows = await listZipSubmissions(filters, ids);
    if (!rows.length || (ids.length && rows.length !== ids.length)) {
      return privateError("Aucun bon disponible ou sélection modifiée.", 404);
    }
    if (rows.length > ZIP_LIMIT) return privateError(`Réduisez la période ou sélectionnez jusqu’à ${ZIP_LIMIT} bons.`, 413);

    const archive: Zippable = Object.create(null);
    let size = 0;
    for (const row of rows) {
      const { buffer, fileName } = await buildBonPilotagePdf(makeDocument(row), row.pdf_template_version);
      size += buffer.length;
      if (size > MAX_BYTES) return privateError("Archive trop volumineuse. Réduisez la sélection.", 413);
      const name = fileName in archive ? `${fileName.slice(0, -4)} (${row.id}).pdf` : fileName;
      archive[name] = [buffer, { level: 0 }];
    }

    const zip = zipSync(archive, { level: 0 });
    if (zip.length > MAX_BYTES) return privateError("Archive trop volumineuse. Réduisez la sélection.", 413);
    return new Response(new Uint8Array(zip), {
      headers: { ...privateHeaders, "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="bons-pilotage.zip"' },
    });
  } catch {
    console.error("Unable to serve administrative ZIP");
    return privateError("L’archive est temporairement indisponible.", 503);
  }
}
