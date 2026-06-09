import {
  SUGGESTION_FIELDS,
  createEmptySubmissionMemory,
} from "@/lib/form-memory";
import type {
  SubmissionDraft,
  SubmissionMemory,
  SuggestionField,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUGGESTIONS_TABLE = "bon_pilotage_memory_values";

function normalizeValue(value: string) {
  return value.trim();
}

function normalizeKey(value: string) {
  return normalizeValue(value).toLocaleLowerCase();
}

function isSuggestionField(value: string): value is SuggestionField {
  return SUGGESTION_FIELDS.includes(value as SuggestionField);
}

function buildMemoryFromDraft(
  draft: Pick<SubmissionDraft, SuggestionField>,
): SubmissionMemory {
  const memory = createEmptySubmissionMemory();

  for (const field of SUGGESTION_FIELDS) {
    const value = normalizeValue(draft[field] ?? "");

    if (value) {
      memory.suggestions[field] = [value];
    }
  }

  return memory;
}

export async function fetchSubmissionMemory(
  supabase: SupabaseClient,
): Promise<SubmissionMemory> {
  const memory = createEmptySubmissionMemory();

  const { data: suggestions, error: suggestionsError } = await supabase
    .from(SUGGESTIONS_TABLE)
    .select("field,value")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (suggestionsError) {
    throw new Error(suggestionsError.message);
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

  return memory;
}

export async function persistSubmissionMemoryFromDraft(
  supabase: SupabaseClient,
  draft: Pick<SubmissionDraft, SuggestionField>,
) {
  const now = new Date().toISOString();
  const suggestionRows = SUGGESTION_FIELDS.map((field) => {
    const value = normalizeValue(draft[field] ?? "");

    if (!value) {
      return null;
    }

    return {
      field,
      value,
      value_key: normalizeKey(value),
      updated_at: now,
    };
  }).filter((row): row is {
    field: SuggestionField;
    value: string;
    value_key: string;
    updated_at: string;
  } => row !== null);

  if (suggestionRows.length > 0) {
    const { error } = await supabase
      .from(SUGGESTIONS_TABLE)
      .upsert(suggestionRows, { onConflict: "field,value_key" });

    if (error) {
      throw new Error(error.message);
    }
  }

  return buildMemoryFromDraft(draft);
}
