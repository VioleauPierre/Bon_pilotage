export type ItineraryDraftRow = {
  date: string;
  departureCity: string;
  departureTime: string;
  arrivalCity: string;
  arrivalTime: string;
  km: string;
};

export type ItineraryRow = Omit<ItineraryDraftRow, "km"> & {
  km: number;
};

export type SubmissionDraft = {
  bonNumber: string;
  pilotName: string;
  transporter: string;
  vehicleRegistration: string;
  convoyCategory: string;
  decreeNumber: string;
  driverName: string;
  driverSignature: string;
  pickupDate: string;
  pickupTime: string;
  departureCity: string;
  arrivalCity: string;
  observations: string;
  itinerary: ItineraryDraftRow[];
  website: string;
};

export type SuggestionField =
  | "pilotName"
  | "transporter"
  | "vehicleRegistration"
  | "convoyCategory"
  | "decreeNumber"
  | "driverName"
  | "driverSignature"
  | "departureCity"
  | "arrivalCity";

export type PilotProfile = {
  pilotName: string;
  transporter: string;
  vehicleRegistration: string;
  convoyCategory: string;
  driverName: string;
  driverSignature: string;
  departureCity: string;
  arrivalCity: string;
  updatedAt: string;
};

export type SubmissionMemory = {
  suggestions: Record<SuggestionField, string[]>;
  pilotProfiles: PilotProfile[];
};

export type BonPilotageDisplayData = {
  bonNumber: string;
  pilotName: string;
  transporter: string;
  vehicleRegistration: string;
  convoyCategory: string;
  decreeNumber: string;
  driverName: string;
  driverSignature: string;
  pickupDate: string;
  pickupTime: string;
  departureCity: string;
  arrivalCity: string;
  observations: string;
  itinerary: Array<
    Omit<ItineraryDraftRow, "km"> & {
      km: string | number;
    }
  >;
  totalKm?: string | number;
  generatedAt?: string;
};
