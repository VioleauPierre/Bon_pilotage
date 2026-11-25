import { PERIODS, VIEW_FILTERS, type AdminFilters } from "@/lib/admin-filters";

export function DashboardFilters({ filters }: { filters: AdminFilters }) {
  return (
    <form action="/admin" method="get" className="admin-filters">
      <label className="admin-search">Recherche
        <input name="q" type="search" defaultValue={filters.query} maxLength={100}
          placeholder="Bon, pilote, transporteur, chauffeur, plaque ou ville" />
      </label>
      <label>Période
        <select name="period" defaultValue={filters.period}>
          {Object.entries(PERIODS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>Consultation
        <select name="view" defaultValue={filters.view}>
          {Object.entries(VIEW_FILTERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <button className="admin-button admin-primary">Appliquer</button>
      <div className="admin-date-range">
        <label>Début personnalisé
          <input type="date" name="from" defaultValue={filters.customStart ?? ""} />
        </label>
        <label>Fin personnalisée
          <input type="date" name="to" defaultValue={filters.customEnd ?? ""} />
        </label>
      </div>
    </form>
  );
}
