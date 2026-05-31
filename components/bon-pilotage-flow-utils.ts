import { MAX_ITINERARY_ROWS } from "@/lib/constants";
import {
  createEmptyItineraryRow,
  filterFilledItineraryRows,
  formatDateInput,
} from "@/lib/format";
import type { ItineraryDraftRow, SubmissionDraft } from "@/lib/types";

export type StepId =
  | "pilots"
  | "convoy"
  | "timing"
  | "itinerary"
  | "observations"
  | "review";

export const flowSteps: Array<{
  id: StepId;
  title: string;
  description: string;
}> = [
  { id: "pilots", title: "Choix du pilote", description: "Coche un ou plusieurs pilotes." },
  { id: "convoy", title: "Convoi", description: "Transporteur, catégorie et chauffeur." },
  { id: "timing", title: "Dates et trajet", description: "Départ, arrivée, prise en charge et fin." },
  { id: "itinerary", title: "Trajets", description: "Les bornes du trajet sont reprises automatiquement." },
  { id: "observations", title: "Observation", description: "Ajoute une note si nécessaire." },
  { id: "review", title: "Résumé", description: "Vérifie les blocs avant l'envoi." },
];

export const CONVOY_CATEGORIES = ["2ème catégorie", "3ème catégorie"] as const;

function isEmpty(value: string) {
  return value.trim() === "";
}

function toDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function normalizeOption(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    const key = normalizeOption(value);

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

export function getPrefixSuggestions(values: string[], currentValue: string) {
  const needle = normalizeOption(currentValue);

  return values
    .filter((value) => !needle || normalizeOption(value).startsWith(needle))
    .filter((value) => normalizeOption(value) !== needle)
    .slice(0, 8);
}

export function pilotCountLabel(count: number) {
  return count <= 1
    ? `${count} pilote sélectionné`
    : `${count} pilotes sélectionnés`;
}

export function dateTimeSummary(date: string, time: string) {
  return [date, time].filter(Boolean).join(" à ") || "-";
}

export function submitError(message: string) {
  return `Impossible d'envoyer le bon. ${message}`;
}

export function syncItineraryBoundaries(draft: SubmissionDraft): SubmissionDraft {
  const rows =
    draft.itinerary.length > 0
      ? draft.itinerary.map((row) => ({ ...row }))
      : [createEmptyItineraryRow({ date: draft.pickupDate || formatDateInput() })];
  const lastIndex = rows.length - 1;

  rows[0] = {
    ...rows[0],
    date: draft.pickupDate || rows[0].date || formatDateInput(),
    departureCity: draft.departureCity,
    departureTime: draft.pickupTime,
  };

  rows[lastIndex] = {
    ...rows[lastIndex],
    date:
      rows.length === 1
        ? draft.pickupDate || rows[lastIndex].date
        : draft.endDate || rows[lastIndex].date,
    arrivalCity: draft.arrivalCity,
    arrivalTime: draft.endTime,
  };

  return { ...draft, itinerary: rows };
}

export function createNextItineraryRow(current: SubmissionDraft) {
  return createEmptyItineraryRow({
    date: current.endDate || current.pickupDate || formatDateInput(),
    arrivalCity: current.arrivalCity,
    arrivalTime: current.endTime,
  });
}

export function validateFlowStep(stepId: StepId, draft: SubmissionDraft) {
  switch (stepId) {
    case "pilots":
      return draft.pilotNames.length === 0
        ? "Veuillez sélectionner au moins un pilote."
        : null;
    case "convoy":
      if (isEmpty(draft.transporter)) {
        return "Veuillez renseigner le transporteur.";
      }
      if (
        !CONVOY_CATEGORIES.includes(
          draft.convoyCategory as (typeof CONVOY_CATEGORIES)[number],
        )
      ) {
        return "Veuillez choisir la 2ème ou la 3ème catégorie.";
      }
      if (isEmpty(draft.driverName)) {
        return "Veuillez renseigner le chauffeur.";
      }
      return null;
    case "timing": {
      if (isEmpty(draft.pickupDate) || isEmpty(draft.pickupTime)) {
        return "Veuillez renseigner la date et l'heure de prise en charge.";
      }
      if (isEmpty(draft.endDate) || isEmpty(draft.endTime)) {
        return "Veuillez renseigner la date et l'heure de fin de convoi.";
      }
      const start = toDateTime(draft.pickupDate, draft.pickupTime);
      const end = toDateTime(draft.endDate, draft.endTime);
      if (!start || !end) {
        return "Veuillez vérifier le format des dates et heures.";
      }
      if (end <= start) {
        return "La date de fin de convoi doit être postérieure à la date de prise en charge.";
      }
      if (isEmpty(draft.departureCity) || isEmpty(draft.arrivalCity)) {
        return "Veuillez renseigner la ville de départ et la ville d'arrivée.";
      }
      return null;
    }
    case "itinerary": {
      const rows = filterFilledItineraryRows(draft.itinerary);
      if (rows.length === 0) {
        return "Veuillez ajouter au moins une ligne de trajet.";
      }

      for (const [index, row] of rows.entries()) {
        const requiredValues: Array<keyof ItineraryDraftRow> = [
          "date",
          "departureCity",
          "departureTime",
          "arrivalCity",
          "arrivalTime",
          "km",
        ];
        if (requiredValues.some((field) => isEmpty(row[field]))) {
          return `Veuillez compléter tous les champs de la ligne ${index + 1}.`;
        }

        const km = Number.parseInt(row.km, 10);
        if (Number.isNaN(km) || km < 0) {
          return `Le kilométrage de la ligne ${index + 1} est invalide.`;
        }
      }
      return null;
    }
    default:
      return null;
  }
}
