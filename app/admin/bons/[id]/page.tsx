import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminHref, parseAdminFilters, searchParams as toSearchParams } from "@/lib/admin-filters";
import { findSubmission, mailStatusLabel, makeDocument } from "@/lib/admin-submissions";
import { formatDateLabel, formatTimeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const row = await findSubmission(id.data);
  if (!row) notFound();

  const data = makeDocument(row);
  const filters = parseAdminFilters(toSearchParams(await searchParams));
  const pdf = `/api/admin/bons/${row.id}/pdf`;
  const fields = [
    ["Pilotes", data.pilotNames.join(", ") || data.pilotName],
    ["Transporteur", data.transporter],
    ["Chauffeur", data.driverName],
    ["Immatriculation", data.vehicleRegistration],
    ["Catégorie", data.convoyCategory],
    ["Prise en charge", [formatDateLabel(data.pickupDate), formatTimeLabel(data.pickupTime)].filter(Boolean).join(" · ")],
    ["Fin de convoi", [formatDateLabel(data.endDate), formatTimeLabel(data.endTime)].filter(Boolean).join(" · ")],
    ["Départ", data.departureCity],
    ["Arrivée", data.arrivalCity],
    ["Kilométrage", row.total_km == null ? "" : `${row.total_km} km`],
    ["Mail", mailStatusLabel(row.status)],
    ["Facturation", row.invoiced ? "Facturé" : "Non facturé"],
  ];

  return (
    <article className="admin-panel admin-detail">
      <Link className="admin-back" href={getAdminHref(filters)} prefetch={false}>← Retour aux bons</Link>
      <div className="admin-page-heading">
        <div><h1>Bon {data.bonNumber}</h1><p className="admin-muted">Enregistré · {row.viewed_at ? "Consulté" : "Non consulté"}</p></div>
        <div className="admin-inline-actions">
          <a href={pdf} target="_blank" rel="noopener noreferrer" className="admin-button">Ouvrir le PDF</a>
          <a href={pdf + "?download=1"} className="admin-button admin-primary">Télécharger le PDF</a>
        </div>
      </div>
      {data.archiveNote && <p className="admin-banner">{data.archiveNote}</p>}
      <dl className="admin-detail-fields">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
      </dl>
      {data.observations && <section><h2>Observations</h2><p className="admin-observations">{data.observations}</p></section>}
    </article>
  );
}
