import { MAX_ITINERARY_ROWS } from "@/lib/constants";
import { z } from "zod";

const requiredString = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .max(max, `${label} est trop long.`);

const optionalString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, "Valeur trop longue.")
    .optional()
    .transform((value) => value ?? "");

const itineraryRowSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date d'itinéraire est invalide."),
  departureCity: requiredString("La ville de départ"),
  departureTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "L'heure de départ est invalide."),
  arrivalCity: requiredString("La ville d'arrivée"),
  arrivalTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "L'heure d'arrivée est invalide."),
  km: z.coerce
    .number()
    .int("Le kilométrage doit être un entier.")
    .min(0, "Le kilométrage doit être positif.")
    .max(5000, "Le kilométrage semble incohérent."),
});

export const submissionSchema = z.object({
  bonNumber: requiredString("Le numéro de bon", 40),
  pilotName: requiredString("Le nom du pilote"),
  transporter: requiredString("Le transporteur"),
  vehicleRegistration: optionalString(80),
  convoyCategory: requiredString("La catégorie du convoi"),
  decreeNumber: optionalString(80),
  driverName: requiredString("Le nom du chauffeur"),
  driverSignature: optionalString(120),
  pickupDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de prise en charge est invalide."),
  pickupTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "L'heure de prise en charge est invalide."),
  departureCity: requiredString("La ville de départ"),
  arrivalCity: requiredString("La ville d'arrivée"),
  observations: optionalString(2000),
  itinerary: z
    .array(itineraryRowSchema)
    .min(1, "Au moins une ligne d'itinéraire est nécessaire.")
    .max(MAX_ITINERARY_ROWS, "Trop de lignes d'itinéraire."),
  website: optionalString(200),
});

export type ParsedSubmission = z.infer<typeof submissionSchema> & {
  totalKm: number;
};

export function parseSubmission(input: unknown):
  | { success: true; data: ParsedSubmission }
  | { success: false; message: string } {
  const result = submissionSchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      message: issue?.message ?? "Le formulaire est invalide.",
    };
  }

  const totalKm = result.data.itinerary.reduce((sum, row) => sum + row.km, 0);

  return {
    success: true,
    data: {
      ...result.data,
      totalKm,
    },
  };
}
