import "server-only";
import { createEmptySubmissionMemory } from "@/lib/form-memory";
import type { SubmissionDraft, SubmissionMemory } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUGGESTIONS_TABLE = "bon_pilotage_memory_values";
const PUBLIC_FIELDS = ["transporter", "departureCity", "arrivalCity"] as const;

export async function fetchSubmissionMemory(supabase: SupabaseClient): Promise<SubmissionMemory> {
  const memory = createEmptySubmissionMemory();
  await Promise.all(PUBLIC_FIELDS.map(async (field) => {
    const { data, error } = await supabase.from(SUGGESTIONS_TABLE)
      .select("value").eq("field", field).order("updated_at", { ascending: false }).limit(8);
    if (error) throw error;
    memory.suggestions[field] = data.map(({ value }) => value);
  }));
  return memory;
}

export async function persistSubmissionMemoryFromDraft(
  supabase: SupabaseClient,
  draft: Pick<SubmissionDraft, typeof PUBLIC_FIELDS[number] | "pilotNames" |
    "vehicleRegistration" | "convoyCategory" | "driverName">,
) {
  const now = new Date().toISOString();
  const memory = createEmptySubmissionMemory();
  const suggestions = PUBLIC_FIELDS.flatMap((field) => {
    const value = draft[field].trim();
    if (!value) return [];
    memory.suggestions[field] = [value];
    return [{ field, value, value_key: value.toLocaleLowerCase("fr-FR"), updated_at: now }];
  });
  const profiles = [...new Map(draft.pilotNames.map((name) => [
    name.trim().toLocaleLowerCase("fr-FR"), name.trim(),
  ])).entries()].map(([key, name]) => ({
    pilot_key: key,
    pilot_name: name,
    transporter: draft.transporter,
    vehicle_registration: draft.vehicleRegistration,
    convoy_category: draft.convoyCategory,
    driver_name: draft.driverName,
    departure_city: draft.departureCity,
    arrival_city: draft.arrivalCity,
    updated_at: now,
  }));
  const results = await Promise.all([
    supabase.from(SUGGESTIONS_TABLE).upsert(suggestions, { onConflict: "field,value_key" }),
    supabase.from("bon_pilotage_pilot_profiles").upsert(profiles, { onConflict: "pilot_key" }),
  ]);
  if (results.some(({ error }) => error)) console.error("Unable to update part of pilot memory");
  return memory;
}
