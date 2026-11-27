import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { filterParams, getAdminHref, parseAdminFilters, searchParams } from "@/lib/admin-filters";
import { getMailConfiguration, getSendEmailSetting } from "@/lib/admin-settings";
import { getMetrics, listSubmissions, mailStatusLabel, PAGE_SIZE, pilotLabel, ZIP_LIMIT } from "@/lib/admin-submissions";
import { formatDateLabel } from "@/lib/format";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { changeMailSetting, revokeOtherSessions, signOut } from "./actions";
import { DashboardFilters } from "./filters";
import { LoginForm } from "./login-form";
import { ZipSelection } from "./selection";
import { SubmissionAction } from "./submission-actions";

export const dynamic = "force-dynamic";

const formatNumber = new Intl.NumberFormat("fr-FR");
const formatTransmission = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris",
});

const notices: Record<string, string> = {
  update: "La modification n’a pas pu être enregistrée.",
  "mail-config": "Renseignez les paramètres Gmail sur Vercel avant d’activer l’envoi.",
  "mail-saved": "Paramètre d’envoi enregistré.",
  revoked: "Les autres appareils ont été déconnectés.",
  "revoke-error": "Impossible de déconnecter les autres appareils. Réessayez.",
  "sign-out": "La déconnexion a échoué. Réessayez.",
};

export default async function AdminPage({ searchParams: raw }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams(await raw);
  if (!(await getAdminSession())) return <LoginForm passwordSet={params.get("notice") === "password-set"} />;
  const filters = parseAdminFilters(params);
  const encoded = filterParams(filters).toString();
  const exportParams = filterParams(filters, 1);
  const csvHref = `/api/admin/bons/csv?${exportParams}`;
  exportParams.set("mode", "filtered");
  const zipHref = `/api/admin/bons/zip?${exportParams}`;
  const [list, metrics, mailSetting] = await Promise.allSettled([
    filters.error ? Promise.resolve({ rows: [], count: 0 }) : listSubmissions(filters),
    getMetrics(filters),
    getSendEmailSetting(getSupabaseAdminClient()),
  ]);
  const mail = mailSetting.status === "fulfilled" ? mailSetting.value : null;
  const noticeCode = params.get("notice") ?? "";
  const notice = Object.hasOwn(notices, noticeCode) ? notices[noticeCode] : "";
  const count = list.status === "fulfilled" ? list.value.count : 0;
  const rows = list.status === "fulfilled" ? list.value.rows : [];
  const pageCount = Math.ceil(count / PAGE_SIZE);
  const indicators = metrics.status === "fulfilled" ? [
    ["Bons non consultés", formatNumber.format(metrics.value.unread)],
    ["Bons du mois", formatNumber.format(metrics.value.month_total)],
    ["Total des bons", formatNumber.format(metrics.value.total)],
    ["Kilométrage sur la période", filters.error ? "—" : formatNumber.format(metrics.value.period_km) + " km"],
  ] : [];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Bons de pilotage</h1>
          <p className="admin-muted">Consultez et téléchargez les bons transmis par les pilotes.</p>
        </div>
        <form action={signOut}><button className="admin-button">Se déconnecter</button></form>
      </div>

      {notice && <p role="status" className="admin-banner">{notice}</p>}
      {indicators.length > 0 ? (
        <dl className="admin-metrics">
          {indicators.map(([label, value]) => (
            <div key={label} className="admin-panel"><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      ) : <p role="alert" className="admin-error">Indicateurs temporairement indisponibles.</p>}

      <section className="admin-panel admin-list" aria-labelledby="history-title">
        <h2 id="history-title">Historique des bons</h2>
        <DashboardFilters filters={filters} />
        {filters.error && <p role="alert" className="admin-error">{filters.error}</p>}

        {list.status === "rejected" ? (
          <p role="alert" className="admin-error">La liste est temporairement indisponible.</p>
        ) : !filters.error && (
          <>
            <div className="admin-list-toolbar">
              <p className="admin-muted">{formatNumber.format(count)} {count === 1 ? "bon" : "bons"}</p>
              {count > 0 && <div className="admin-inline-actions">
                <a href={csvHref} className="admin-button">Exporter le CSV</a>
                {count <= ZIP_LIMIT && <a href={zipHref} className="admin-button">ZIP des résultats</a>}
                {rows.length > 0 && <ZipSelection limit={ZIP_LIMIT} />}
              </div>}
            </div>
            {count > ZIP_LIMIT && <p className="admin-muted admin-zip-limit">
              Jusqu’à {ZIP_LIMIT} bons par ZIP. Affinez la période ou cochez les bons à télécharger.
            </p>}

            {rows.length > 0 ? (
              <table className="admin-table" role="table" aria-label="Bons transmis">
                <thead role="rowgroup"><tr role="row">
                  <th scope="col" aria-label="Sélection" />
                  <th scope="col">Bon</th>
                  <th scope="col">Pilotes et convoi</th>
                  <th scope="col">Trajet</th>
                  <th scope="col">Statuts</th>
                  <th scope="col">Actions</th>
                </tr></thead>
                <tbody role="rowgroup">{rows.map((row) => {
                  const pdf = `/api/admin/bons/${row.id}/pdf`;
                  return (
                    <tr key={row.id} role="row">
                      <td className="admin-row-check" role="cell">
                        <label className="admin-checkbox">
                          <input type="checkbox" name="id" value={row.id} form="zip-selection" aria-label={`Sélectionner le bon ${row.bon_number}`} />
                        </label>
                      </td>
                      <td className="admin-row-date" role="cell">
                        <strong>{row.bon_number}</strong>
                        <small>Prestation · {formatDateLabel(row.pickup_date) || "—"}</small>
                        <small>Transmis · {formatTransmission.format(new Date(row.created_at))}</small>
                      </td>
                      <td role="cell">
                        <strong>{pilotLabel(row) || "—"}</strong>
                        <span>{row.transporter || "—"}</span>
                        <small>Chauffeur · {row.driver_name || "—"}</small>
                      </td>
                      <td role="cell">
                        <strong>{row.departure_city || "—"} → {row.arrival_city || "—"}</strong>
                        <small>{row.total_km == null ? "—" : formatNumber.format(row.total_km) + " km"}</small>
                      </td>
                      <td role="cell">
                        <span className={`admin-status${row.viewed_at ? "" : " admin-status-new"}`}>{row.viewed_at ? "Consulté" : "Nouveau"}</span>
                        <small>{mailStatusLabel(row.status)}</small>
                      </td>
                      <td className="admin-row-actions" role="cell">
                        <div className="admin-inline-actions">
                          <SubmissionAction id={row.id} operation="open" filters={encoded}>Consulter</SubmissionAction>
                          <a className="admin-button" href={pdf + "?download=1"}>PDF</a>
                        </div>
                        {row.viewed_at && (
                          <div className="admin-inline-actions">
                            <SubmissionAction id={row.id} operation="unread" filters={encoded}>Marquer non lu</SubmissionAction>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : (
              <p className="admin-empty">
                {filters.page > 1 ? "Aucun bon sur cette page." : "Aucun bon ne correspond à ces filtres."}
                {filters.page > 1 && <Link href={getAdminHref(filters, undefined, 1)}> Revenir à la première page</Link>}
              </p>
            )}

            {rows.length > 0 && pageCount > 1 && (
              <nav className="admin-pagination" aria-label="Pagination des bons">
                {filters.page > 1 && <Link href={getAdminHref(filters, undefined, filters.page - 1)} className="admin-button" prefetch={false}>Précédent</Link>}
                <span>Page {filters.page} / {pageCount}</span>
                {filters.page < pageCount && <Link href={getAdminHref(filters, undefined, filters.page + 1)} className="admin-button" prefetch={false}>Suivant</Link>}
              </nav>
            )}
          </>
        )}
      </section>

      <details className="admin-panel admin-settings">
        <summary>Paramètres</summary>
        <div className="admin-settings-row">
          <div>
            <h2>Envoi automatique par e-mail</h2>
            <p className="admin-muted">{mail === null ? "Paramètre temporairement indisponible."
              : mail ? "Activé. Chaque nouveau bon déclenche un envoi par Gmail."
                : "Désactivé. Les nouveaux bons restent accessibles dans l’administration."}</p>
          </div>
          {mail !== null && <form action={changeMailSetting}>
            <input type="hidden" name="enabled" value={String(!mail)} />
            <button className="admin-button" disabled={!mail && !getMailConfiguration()}>{mail ? "Désactiver" : "Activer"}</button>
          </form>}
        </div>
        <div className="admin-settings-row">
          <div><h2>Sessions des autres appareils</h2><p className="admin-muted">En cas de perte d’un appareil, fermez ses sessions. Cet appareil reste connecté.</p></div>
          <form action={revokeOtherSessions}><button className="admin-button">Déconnecter les autres appareils</button></form>
        </div>
      </details>
    </>
  );
}
