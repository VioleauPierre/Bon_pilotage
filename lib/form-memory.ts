import type {
  PilotProfile,
  SubmissionDraft,
  SubmissionMemory,
  SuggestionField,
} from "@/lib/types";

export const SUGGESTION_FIELDS: SuggestionField[] = [
  "pilotName",
  "transporter",
  "vehicleRegistration",
  "convoyCategory",
  "decreeNumber",
  "driverName",
  "driverSignature",
  "departureCity",
  "arrivalCity",
];

function normalizeValue(value: string) {
  return value.trim();
}

function compareValues(left: string, right: string) {
  return left.localeCompare(right, "fr", { sensitivity: "base" });
}

function uniqueValues(values: string[], limit = 8) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = normalizeValue(rawValue);
    if (!value) {
      continue;
    }

    const key = value.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function createEmptySubmissionMemory(): SubmissionMemory {
  return {
    suggestions: {
      pilotName: [],
      transporter: [],
      vehicleRegistration: [],
      convoyCategory: [],
      decreeNumber: [],
      driverName: [],
      driverSignature: [],
      departureCity: [],
      arrivalCity: [],
    },
    pilotProfiles: [],
  };
}

export function parseSubmissionMemory(raw: string | null) {
  if (!raw) {
    return createEmptySubmissionMemory();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SubmissionMemory>;
    const memory = createEmptySubmissionMemory();

    for (const field of SUGGESTION_FIELDS) {
      memory.suggestions[field] = uniqueValues(parsed.suggestions?.[field] ?? []);
    }

    memory.pilotProfiles = (parsed.pilotProfiles ?? [])
      .map((profile) => ({
        pilotName: normalizeValue(profile.pilotName ?? ""),
        transporter: normalizeValue(profile.transporter ?? ""),
        vehicleRegistration: normalizeValue(profile.vehicleRegistration ?? ""),
        convoyCategory: normalizeValue(profile.convoyCategory ?? ""),
        driverName: normalizeValue(profile.driverName ?? ""),
        driverSignature: normalizeValue(profile.driverSignature ?? ""),
        departureCity: normalizeValue(profile.departureCity ?? ""),
        arrivalCity: normalizeValue(profile.arrivalCity ?? ""),
        updatedAt: profile.updatedAt ?? new Date(0).toISOString(),
      }))
      .filter((profile) => profile.pilotName !== "")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 12);

    return memory;
  } catch {
    return createEmptySubmissionMemory();
  }
}

export function getFieldSuggestions(
  memory: SubmissionMemory,
  field: SuggestionField,
  currentValue: string,
) {
  const needle = normalizeValue(currentValue).toLocaleLowerCase();

  const matches = memory.suggestions[field].filter((entry) => {
    if (!needle) {
      return true;
    }

    return entry.toLocaleLowerCase().includes(needle);
  });

  return uniqueValues(matches.filter((entry) => entry !== normalizeValue(currentValue)), 6);
}

export function getFilteredPilotProfiles(
  memory: SubmissionMemory,
  currentValue: string,
) {
  const needle = normalizeValue(currentValue).toLocaleLowerCase();

  const filtered = memory.pilotProfiles.filter((profile) => {
    if (!needle) {
      return true;
    }

    return [
      profile.pilotName,
      profile.transporter,
      profile.convoyCategory,
      profile.departureCity,
      profile.arrivalCity,
    ].some((entry) => entry.toLocaleLowerCase().includes(needle));
  });

  return filtered.sort((left, right) => {
    const leftExact =
      left.pilotName.toLocaleLowerCase() === needle ||
      left.pilotName.toLocaleLowerCase().startsWith(needle);
    const rightExact =
      right.pilotName.toLocaleLowerCase() === needle ||
      right.pilotName.toLocaleLowerCase().startsWith(needle);

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1;
    }

    return compareValues(left.pilotName, right.pilotName);
  });
}

export function applyPilotProfile(
  draft: SubmissionDraft,
  profile: PilotProfile,
): SubmissionDraft {
  return {
    ...draft,
    pilotName: profile.pilotName,
    transporter: profile.transporter,
    vehicleRegistration: profile.vehicleRegistration,
    convoyCategory: profile.convoyCategory,
    driverName: profile.driverName,
    driverSignature: profile.driverSignature,
    departureCity: profile.departureCity,
    arrivalCity: profile.arrivalCity,
  };
}

export function updateSubmissionMemory(
  currentMemory: SubmissionMemory,
  draft: Pick<SubmissionDraft, SuggestionField>,
) {
  const memory = createEmptySubmissionMemory();

  for (const field of SUGGESTION_FIELDS) {
    memory.suggestions[field] = uniqueValues([
      normalizeValue(draft[field]),
      ...currentMemory.suggestions[field],
    ]);
  }

  const normalizedPilotName = normalizeValue(draft.pilotName);
  const nextProfiles = [...currentMemory.pilotProfiles];

  if (normalizedPilotName) {
    const nextProfile: PilotProfile = {
      pilotName: normalizedPilotName,
      transporter: normalizeValue(draft.transporter),
      vehicleRegistration: normalizeValue(draft.vehicleRegistration),
      convoyCategory: normalizeValue(draft.convoyCategory),
      driverName: normalizeValue(draft.driverName),
      driverSignature: normalizeValue(draft.driverSignature),
      departureCity: normalizeValue(draft.departureCity),
      arrivalCity: normalizeValue(draft.arrivalCity),
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = nextProfiles.findIndex(
      (profile) =>
        profile.pilotName.toLocaleLowerCase() ===
        normalizedPilotName.toLocaleLowerCase(),
    );

    if (existingIndex >= 0) {
      nextProfiles.splice(existingIndex, 1);
    }

    nextProfiles.unshift(nextProfile);
  }

  memory.pilotProfiles = nextProfiles.slice(0, 12);

  return memory;
}
