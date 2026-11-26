import "server-only";
import type { AdminFilters } from "@/lib/admin-filters";
import { documentTimestamp } from "@/lib/bon-pilotage-pdf";
import { getBonPilotageTableName, getSupabaseAdminClient } from "@/lib/supabase";
import type { BonPilotageDisplayData } from "@/lib/types";

const summaryColumns =
  "id,bon_number,created_at,pickup_date,pilot_name,pilot_names,transporter,driver_name,vehicle_registration,departure_city,arrival_city,total_km,viewed_at,status";
const documentColumns =
  "id,bon_number,created_at,pickup_date,pilot_name,pilot_names,transporter,driver_name,vehicle_registration,departure_city,arrival_city,total_km,viewed_at,status,pickup_time,end_date,end_time,convoy_category,decree_number,driver_signature,observations,itinerary,generated_at,pdf_template_version";
const csvColumns =
  "id,bon_number,pickup_date,pilot_name,pilot_names,transporter,driver_name,vehicle_registration,departure_city,arrival_city,total_km,invoiced,pickup_time,end_time";

export const PAGE_SIZE = 20;
export const ZIP_LIMIT = 8;

export type SubmissionSummary = {
  id: string;
  bon_number: string;
  created_at: string;
  pickup_date: string;
  pilot_name: string;
  pilot_names: unknown;
  transporter: string;
  driver_name: string;
  vehicle_registration: string;
  departure_city: string;
  arrival_city: string;
  total_km: number | null;
  viewed_at: string | null;
  status: string;
};

export type StoredSubmission = SubmissionSummary & {
  pickup_time: string | null;
  end_date: string | null;
  end_time: string | null;
  convoy_category: string;
  decree_number: string;
  driver_signature: string;
  observations: string;
  itinerary: unknown;
  generated_at: string | null;
  pdf_template_version: number;
};

export type CsvSubmission = Pick<SubmissionSummary, "bon_number" | "pickup_date" | "pilot_name" |
  "pilot_names" | "transporter" | "driver_name" | "vehicle_registration" | "departure_city" |
  "arrival_city" | "total_km"> & Pick<StoredSubmission, "pickup_time" | "end_time"> & {
    invoiced: boolean;
  };

function table() {
  return getSupabaseAdminClient().from(getBonPilotageTableName());
}

type Filterable<T> = {
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
  ilike(column: string, value: string): T;
  is(column: string, value: null): T;
  not(column: string, operator: string, value: null): T;
};

function applyFilters<T extends Filterable<T>>(query: T, filters: AdminFilters): T {
  if (filters.start) query = query.gte("pickup_date", filters.start);
  if (filters.end) query = query.lte("pickup_date", filters.end);
  if (filters.query) query = query.ilike("search_text", `%${filters.query.replace(/[\\%_]/g, "\\$&")}%`);
  if (filters.view === "unread") query = query.is("viewed_at", null);
  if (filters.view === "read") query = query.not("viewed_at", "is", null);
  return query;
}

export async function listSubmissions(filters: AdminFilters) {
  const from = (filters.page - 1) * PAGE_SIZE;
  const query = table().select(summaryColumns, { count: "exact" }).is("archived_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const { data, error, count } = await applyFilters(query, filters);
  if (error?.code === "PGRST103" && filters.page > 1) return { rows: [], count: count ?? 0 };
  if (error) throw error;
  return { rows: data as SubmissionSummary[], count: count ?? 0 };
}

export async function getMetrics(filters: AdminFilters) {
  const { data, error } = await getSupabaseAdminClient().rpc("bp_admin_metrics", {
    p_month_start: filters.monthStart, p_month_end: filters.nextMonth,
    p_start: filters.start, p_end: filters.end,
  }).single();
  if (error) throw error;
  return data as { total: number; unread: number; month_total: number; period_km: number };
}

export async function findSubmission(id: string) {
  const { data, error } = await table().select(documentColumns).eq("id", id).is("archived_at", null).maybeSingle();
  if (error) throw error;
  return data as StoredSubmission | null;
}

export async function listZipSubmissions(filters: AdminFilters, ids: string[]) {
  const query = table().select(documentColumns).is("archived_at", null).order("created_at", { ascending: false })
    .order("id", { ascending: false }).limit(ZIP_LIMIT + 1);
  const { data, error } = await (ids.length ? query.in("id", ids) : applyFilters(query, filters));
  if (error) throw error;
  return data as StoredSubmission[];
}

export async function listCsvSubmissions(filters: AdminFilters, from: number, size: number) {
  const query = table().select(csvColumns, { count: "exact" }).is("archived_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(from, from + size - 1);
  const { data, error, count } = await applyFilters(query, filters);
  if (error) throw error;
  return { rows: data as CsvSubmission[], count: count ?? 0 };
}

export function getPilotNames(row: Pick<SubmissionSummary, "pilot_names" | "pilot_name">) {
  return Array.isArray(row.pilot_names)
    ? row.pilot_names.filter((pilot): pilot is string => typeof pilot === "string" && pilot.trim().length > 0)
    : [];
}

export function pilotLabel(row: Pick<SubmissionSummary, "pilot_names" | "pilot_name">) {
  return getPilotNames(row).join(", ") || row.pilot_name;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function makeDocument(row: StoredSubmission) {
  const pilotNames = getPilotNames(row);
  const itinerary = Array.isArray(row.itinerary) ? row.itinerary.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    return [{
      date: text(item.date),
      departureCity: text(item.departureCity ?? item.departure_city),
      departureTime: text(item.departureTime ?? item.departure_time),
      arrivalCity: text(item.arrivalCity ?? item.arrival_city),
      arrivalTime: text(item.arrivalTime ?? item.arrival_time),
      km: typeof item.km === "number" ? item.km : text(item.km),
    }];
  }) : [];
  const generatedAt = documentTimestamp(row.generated_at);
  const inferredEnd = !row.generated_at && !row.end_time && row.end_date === row.pickup_date;
  const data: BonPilotageDisplayData = {
    bonNumber: row.bon_number, pilotNames, pilotName: text(row.pilot_name),
    transporter: text(row.transporter), vehicleRegistration: text(row.vehicle_registration),
    convoyCategory: text(row.convoy_category), decreeNumber: text(row.decree_number),
    driverName: text(row.driver_name), driverSignature: text(row.driver_signature),
    pickupDate: text(row.pickup_date), pickupTime: text(row.pickup_time),
    endDate: inferredEnd ? "" : text(row.end_date), endTime: text(row.end_time),
    departureCity: text(row.departure_city), arrivalCity: text(row.arrival_city),
    observations: text(row.observations), itinerary, totalKm: row.total_km ?? "",
    generatedAt,
    registeredAt: generatedAt ? undefined : documentTimestamp(row.created_at),
  };

  const missing = [
    !pilotLabel(row) && "pilote",
    !row.pickup_time && "heure de prise en charge",
    !data.endDate && "date de fin de convoi",
    !data.endTime && "heure de fin de convoi",
    !itinerary.length && "itinéraire",
    row.total_km == null && "kilométrage",
    !generatedAt && "date de génération d’origine",
  ].filter(Boolean);
  if (missing.length) data.archiveNote = `Données non archivées · ${missing.join(", ")}.`;
  return data;
}

export const mailStatusLabels: Record<string, string> = {
  queued: "Envoi en attente ou non confirmé",
  sent: "Mail accepté par Gmail",
  email_failed: "Échec d’envoi connu",
  email_not_requested: "Envoi automatique désactivé",
};

export function mailStatusLabel(status: string) {
  return mailStatusLabels[status] ?? "Statut d’envoi inconnu";
}
