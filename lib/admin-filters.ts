export const PERIODS = {
  all: "Tout l’historique",
  month: "Mois en cours",
  previous: "Mois précédent",
  year: "Année en cours",
  custom: "Période personnalisée",
} as const;

export const VIEW_FILTERS = {
  all: "Tous les bons",
  unread: "Non consultés",
  read: "Consultés",
} as const;

const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
});

function firstOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

function endOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function validDate(value: string | null) {
  if (!value || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function searchParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  return params;
}

export function parseAdminFilters(params: URLSearchParams, now = new Date()) {
  const dateParts = monthFormatter.formatToParts(now);
  const year = Number(dateParts.find((part) => part.type === "year")?.value);
  const month = Number(dateParts.find((part) => part.type === "month")?.value);
  const monthStart = firstOfMonth(year, month);
  const nextMonth = firstOfMonth(year, month + 1);

  const periodParam = params.get("period") ?? "all";
  const period = Object.hasOwn(PERIODS, periodParam) ? periodParam as keyof typeof PERIODS : "all";
  const viewParam = params.get("view") ?? "all";
  const view = Object.hasOwn(VIEW_FILTERS, viewParam) ? viewParam as keyof typeof VIEW_FILTERS : "all";
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const customStart = validDate(params.get("from"));
  const customEnd = validDate(params.get("to"));
  const pageParam = Number(params.get("page"));
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 && pageParam <= 100_000 ? pageParam : 1;

  let start: string | null = null;
  let end: string | null = null;
  let error = "";
  switch (period) {
    case "month":
      start = monthStart;
      end = endOfMonth(year, month);
      break;
    case "previous":
      start = firstOfMonth(year, month - 1);
      end = endOfMonth(year, month - 1);
      break;
    case "year":
      start = firstOfMonth(year, 1);
      end = endOfMonth(year, 12);
      break;
    case "custom":
      if (!customStart || !customEnd || customStart > customEnd) {
        error = "Choisissez une date de début et une date de fin dans l’ordre.";
      } else {
        start = customStart;
        end = customEnd;
      }
      break;
  }

  return { period, view, query, page, start, end, customStart, customEnd, monthStart, nextMonth, error };
}

export type AdminFilters = ReturnType<typeof parseAdminFilters>;

export function filterParams(filters: AdminFilters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.view !== "all") params.set("view", filters.view);
  if (filters.query) params.set("q", filters.query);
  if (filters.period === "custom") {
    if (filters.customStart) params.set("from", filters.customStart);
    if (filters.customEnd) params.set("to", filters.customEnd);
  }
  if (page > 1) params.set("page", String(page));
  return params;
}

export function getAdminHref(filters: AdminFilters, notice?: string, page = filters.page) {
  const params = filterParams(filters, page);
  if (notice) params.set("notice", notice);
  return params.size ? `/admin?${params}` : "/admin";
}
