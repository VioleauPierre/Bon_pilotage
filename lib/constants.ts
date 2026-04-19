import type { ItineraryDraftRow } from "@/lib/types";

export const COMPANY_INFO = {
  name: "ELITE GUIDAGE",
  addressLine1: "7 RUE PHILIPPE LEBON",
  addressLine2: "VENANSAULT 85190",
  email: "eliteguidage@orange.fr",
  phone: "+33 7 63 18 29 07",
};

export const LIABILITY_NOTICE =
  "Le chauffeur déclare décharger de toute responsabilité la société de voiture pilote pour tout accident, incident ou dégât pouvant survenir pendant l'escorte de ce convoi.";

export const MAX_ITINERARY_ROWS = 6;
export const STORAGE_KEY = "bon-pilotage-form-v1";
export const MEMORY_KEY = "bon-pilotage-memory-v1";

export const EMPTY_ITINERARY_ROW: ItineraryDraftRow = {
  date: "",
  departureCity: "",
  departureTime: "",
  arrivalCity: "",
  arrivalTime: "",
  km: "",
};
