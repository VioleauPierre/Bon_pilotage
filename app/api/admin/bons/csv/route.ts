import { getAdminSession, privateError, privateHeaders } from "@/lib/admin-auth";
import { parseAdminFilters } from "@/lib/admin-filters";
import { listCsvSubmissions, pilotLabel, type CsvSubmission } from "@/lib/admin-submissions";
import { formatDateLabel } from "@/lib/format";

export const runtime = "nodejs";

const MAX_ROWS = 5_000;
const PAGE_SIZE = 500;
const MAX_BYTES = 4_000_000;
const head = [
  "Numéro de bon", "Date", "Pilotes", "Transporteur", "Chauffeur", "Immatriculation",
  "Départ", "Arrivée", "Kilométrage", "Heure de début", "Heure de fin", "Facturation",
];

function cell(input: string | number | null) {
  let value = String(input ?? "");
  // Excel peut ignorer les espaces et caractères de contrôle devant une formule.
  if (typeof input === "string" && /^[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value)) {
    value = "'" + value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function serialize(row: CsvSubmission) {
  return [
    row.bon_number, formatDateLabel(row.pickup_date), pilotLabel(row), row.transporter,
    row.driver_name, row.vehicle_registration, row.departure_city, row.arrival_city,
    row.total_km, row.pickup_time, row.end_time, row.invoiced ? "Facturé" : "Non facturé",
  ].map(cell).join(";");
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return privateError("Accès administrateur requis.", 401);
  const filters = parseAdminFilters(new URL(request.url).searchParams);
  if (filters.error) return privateError(filters.error, 400);
  try {
    const lines = [head.map(cell).join(";")];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const { rows, count } = await listCsvSubmissions(filters, offset, PAGE_SIZE);
      if (count > MAX_ROWS) return privateError("Réduisez la période à 5 000 bons au maximum.", 413);
      lines.push(...rows.map(serialize));
      if (rows.length < PAGE_SIZE || offset + rows.length >= count) break;
    }
    const content = "\uFEFF" + lines.join("\r\n") + "\r\n";
    if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
      return privateError("Le CSV dépasse la taille maximale. Réduisez la période.", 413);
    }
    return new Response(content, {
      headers: { ...privateHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="bons-pilotage.csv"' },
    });
  } catch {
    console.error("Unable to serve administrative CSV");
    return privateError("L’export CSV est temporairement indisponible.", 503);
  }
}
