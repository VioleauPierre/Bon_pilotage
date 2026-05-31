import {
  SUGGESTION_FIELDS,
  createEmptySubmissionMemory,
  updateSubmissionMemory,
} from "@/lib/form-memory";
import type {
  PilotProfile,
  SubmissionDraft,
  SubmissionMemory,
  SuggestionField,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUGGESTIONS_TABLE = "bon_pilotage_memory_values";
const PILOT_PROFILES_TABLE = "bon_pilotage_pilot_profiles";

function normalizeValue(value: string) {
  return value.trim();
}

function normalizeKey(value: string) {
  return normalizeValue(value).toLocaleLowerCase();
}

function isSuggestionField(value: string): value is SuggestionField {
  return SUGGESTION_FIELDS.includes(value as SuggestionField);
}

export async function fetchSubmissionMemory(
  supabase: SupabaseClient,
): Promise<SubmissionMemory> {
  const memory = createEmptySubmissionMemory();

  const [{ data: suggestions, error: suggestionsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from(SUGGESTIONS_TABLE)
        .select("field,value")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from(PILOT_PROFILES_TABLE)
        .select(
          "pilot_name,transporter,vehicle_registration,convoy_category,driver_name,driver_signature,departure_city,arrival_city,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(12),
    ]);

  if (suggestionsError) {
    throw new Error(suggestionsError.message);
  }

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  for (const entry of suggestions ?? []) {
    if (!isSuggestionField(entry.field)) {
      continue;
    }

    const value = normalizeValue(entry.value ?? "");
    if (value && memory.suggestions[entry.field].length < 8) {
      memory.suggestions[entry.field].push(value);
    }
  }

  memory.pilotProfiles = (profiles ?? [])
    .map<PilotProfile>((profile) => ({
      pilotName: normalizeValue(profile.pilot_name ?? ""),
      transporter: normalizeValue(profile.transporter ?? ""),
      vehicleRegistration: normalizeValue(profile.vehicle_registration ?? ""),
      convoyCategory: normalizeValue(profile.convoy_category ?? ""),
      driverName: normalizeValue(profile.driver_name ?? ""),
      driverSignature: normalizeValue(profile.driver_signature ?? ""),
      departureCity: normalizeValue(profile.departure_city ?? ""),
      arrivalCity: normalizeValue(profile.arrival_city ?? ""),
      updatedAt: profile.updated_at ?? new Date(0).toISOString(),
    }))
    .filter((profile) => profile.pilotName !== "");

  return memory;
}

export async function persistSubmissionMemoryFromDraft(
  supabase: SupabaseClient,
  draft: Pick<SubmissionDraft, SuggestionField>,
) {
  const currentMemory = await fetchSubmissionMemory(supabase);
  const nextMemory = updateSubmissionMemory(currentMemory, draft);

  const suggestionRows = SUGGESTION_FIELDS.flatMap((field) =>
    nextMemory.suggestions[field].map((value) => ({
      field,
      value,
      value_key: normalizeKey(value),
      updated_at: new Date().toISOString(),
    })),
  );

  if (suggestionRows.length > 0) {
    const { error } = await supabase
      .from(SUGGESTIONS_TABLE)
      .upsert(suggestionRows, { onConflict: "field,value_key" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const profileRows = nextMemory.pilotProfiles.map((profile) => ({
    pilot_name: profile.pilotName,
    pilot_key: normalizeKey(profile.pilotName),
    transporter: profile.transporter,
    vehicle_registration: profile.vehicleRegistration,
    convoy_category: profile.convoyCategory,
    driver_name: profile.driverName,
    driver_signature: profile.driverSignature,
    departure_city: profile.departureCity,
    arrival_city: profile.arrivalCity,
    updated_at: profile.updatedAt,
  }));

  if (profileRows.length > 0) {
    const { error } = await supabase
      .from(PILOT_PROFILES_TABLE)
      .upsert(profileRows, { onConflict: "pilot_key" });

    if (error) {
      throw new Error(error.message);
    }
  }

  return nextMemory;
}
