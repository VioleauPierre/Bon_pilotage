import { EMPTY_ITINERARY_ROW, MAX_ITINERARY_ROWS } from "@/lib/constants";
import type {
  BonPilotageDisplayData,
  ItineraryDraftRow,
  SubmissionDraft,
} from "@/lib/types";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDateInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeInput(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createBonNumber(date = new Date()) {
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `BP-${datePart}-${timePart}`;
}

export function createEmptyItineraryRow(
  overrides: Partial<ItineraryDraftRow> = {},
): ItineraryDraftRow {
  return {
    ...EMPTY_ITINERARY_ROW,
    ...overrides,
  };
}

export function createInitialDraft(): SubmissionDraft {
  const now = new Date();
  const date = formatDateInput(now);
  const time = formatTimeInput(now);

  return {
    bonNumber: createBonNumber(now),
    pilotNames: [],
    pilotName: "",
    transporter: "",
    vehicleRegistration: "",
    convoyCategory: "",
    decreeNumber: "",
    driverName: "",
    driverSignature: "",
    pickupDate: date,
    pickupTime: time,
    endDate: date,
    endTime: "",
    departureCity: "",
    arrivalCity: "",
    observations: "",
    itinerary: [createEmptyItineraryRow({ date, departureTime: time })],
    website: "",
  };
}

export function resetDraftAfterSuccess(current: SubmissionDraft): SubmissionDraft {
  const fresh = createInitialDraft();

  return {
    ...fresh,
    pilotNames: current.pilotNames,
    pilotName: current.pilotNames.join(", "),
    transporter: current.transporter,
    vehicleRegistration: current.vehicleRegistration,
    convoyCategory: current.convoyCategory,
    driverName: current.driverName,
    departureCity: current.departureCity,
    arrivalCity: current.arrivalCity,
  };
}

export function filterFilledItineraryRows(rows: ItineraryDraftRow[]) {
  return rows.filter((row) =>
    [row.date, row.departureCity, row.departureTime, row.arrivalCity, row.arrivalTime, row.km]
      .some((value) => value.trim() !== ""),
  );
}

export function getDraftTotalKm(rows: Array<{ km: string | number }>) {
  return rows.reduce((sum, row) => {
    const numericValue =
      typeof row.km === "number" ? row.km : Number.parseInt(row.km, 10) || 0;
    return sum + numericValue;
  }, 0);
}

export function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTimeLabel(value: string) {
  if (!value) {
    return "";
  }

  const [hours, minutes] = value.split(":");
  if (!hours || !minutes) {
    return value;
  }

  return `${hours}h${minutes}`;
}

export function sanitizeFilePart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "bon-pilotage";
}

export function buildPreviewData(draft: SubmissionDraft): BonPilotageDisplayData {
  return {
    ...draft,
    pilotName: draft.pilotNames.join(", "),
    itinerary: filterFilledItineraryRows(draft.itinerary),
    totalKm: getDraftTotalKm(draft.itinerary),
    generatedAt: new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date()),
  };
}

export function fillDisplayRows<T>(rows: T[], factory: () => T) {
  const filledRows = [...rows];

  while (filledRows.length < MAX_ITINERARY_ROWS) {
    filledRows.push(factory());
  }

  return filledRows.slice(0, MAX_ITINERARY_ROWS);
}
