"use client";

import { MAX_ITINERARY_ROWS, MEMORY_KEY, STORAGE_KEY } from "@/lib/constants";
import {
  applyPilotProfile,
  createEmptySubmissionMemory,
  getFieldSuggestions,
  getFilteredPilotProfiles,
  parseSubmissionMemory,
  updateSubmissionMemory,
} from "@/lib/form-memory";
import {
  buildPreviewData,
  createBonNumber,
  createEmptyItineraryRow,
  createInitialDraft,
  filterFilledItineraryRows,
  formatDateInput,
  formatTimeInput,
  resetDraftAfterSuccess,
} from "@/lib/format";
import type {
  ItineraryDraftRow,
  SubmissionDraft,
  SubmissionMemory,
  SuggestionField,
} from "@/lib/types";
import { useEffect, useState } from "react";

type SubmissionStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type StepId =
  | "pilotName"
  | "bonNumber"
  | "transporter"
  | "vehicleRegistration"
  | "convoyCategory"
  | "decreeNumber"
  | "pickupDate"
  | "pickupTime"
  | "driverName"
  | "driverSignature"
  | "departureCity"
  | "arrivalCity"
  | "itinerary"
  | "observations"
  | "review";

type StepDefinition = {
  id: StepId;
  title: string;
  description: string;
};

const initialDraft = createInitialDraft();
const initialMemory = createEmptySubmissionMemory();

const steps: StepDefinition[] = [
  {
    id: "pilotName",
    title: "Quel pilote intervient aujourd hui ?",
    description:
      "Choisis un pilote deja memorise ou saisis un nouveau profil.",
  },
  {
    id: "bonNumber",
    title: "Quel numero de bon utiliser ?",
    description: "Le numero est pre-rempli et peut etre corrige si besoin.",
  },
  {
    id: "transporter",
    title: "Quel est le transporteur ?",
    description: "Selection rapide possible depuis les valeurs deja vues.",
  },
  {
    id: "vehicleRegistration",
    title: "Quelle immatriculation TR ou SR ?",
    description: "Champ optionnel, utile si tu veux le faire apparaitre sur le PDF.",
  },
  {
    id: "convoyCategory",
    title: "Quelle categorie de convoi ?",
    description: "Exemple : 1ere categorie, 2eme categorie, exceptionnel.",
  },
  {
    id: "decreeNumber",
    title: "Quel numero d arrete ?",
    description: "Laisse vide si la valeur doit rester a neant.",
  },
  {
    id: "pickupDate",
    title: "Quelle date de prise en charge ?",
    description: "La date du jour est deja selectionnee.",
  },
  {
    id: "pickupTime",
    title: "Quelle heure de prise en charge ?",
    description: "Tu peux reprendre automatiquement l heure actuelle.",
  },
  {
    id: "driverName",
    title: "Quel chauffeur est concerne ?",
    description: "Le nom peut etre repris depuis les dernieres saisies.",
  },
  {
    id: "driverSignature",
    title: "Quelle signature afficher ?",
    description: "Champ facultatif. Tu peux reprendre un nom deja utilise.",
  },
  {
    id: "departureCity",
    title: "Quelle est la ville de depart ?",
    description: "Le trajet principal servira aussi de base pour l itineraire detaille.",
  },
  {
    id: "arrivalCity",
    title: "Quelle est la ville d arrivee ?",
    description: "Tu peux choisir rapidement une destination frequente.",
  },
  {
    id: "itinerary",
    title: "Quels trajets faut-il enregistrer ?",
    description:
      "Ajoute une ou plusieurs lignes. Le total kilometrique est calcule automatiquement.",
  },
  {
    id: "observations",
    title: "Souhaites-tu ajouter une observation ?",
    description: "Ajoute ici les remarques ou informations de circulation.",
  },
  {
    id: "review",
    title: "Verification finale",
    description:
      "Controle le recapitulatif ci-dessous avant de generer le PDF et envoyer l e-mail.",
  },
];

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{value || "-"}</span>
    </div>
  );
}

function SuggestionChips({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: string[];
  onSelect: (value: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="suggestion-stack">
      <span className="suggestion-title">{title}</span>
      <div className="suggestion-row">
        {items.map((item) => (
          <button
            key={item}
            className="suggestion-chip"
            type="button"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function setDraftField<K extends keyof SubmissionDraft>(
  draft: SubmissionDraft,
  field: K,
  value: SubmissionDraft[K],
) {
  return {
    ...draft,
    [field]: value,
  };
}

function hasEmptyValue(value: string) {
  return value.trim() === "";
}

function validateStep(stepId: StepId, draft: SubmissionDraft) {
  switch (stepId) {
    case "pilotName":
      return hasEmptyValue(draft.pilotName)
        ? "Renseigne ou selectionne un pilote."
        : null;
    case "bonNumber":
      return hasEmptyValue(draft.bonNumber)
        ? "Renseigne le numero de bon."
        : null;
    case "transporter":
      return hasEmptyValue(draft.transporter)
        ? "Renseigne le transporteur."
        : null;
    case "vehicleRegistration":
    case "decreeNumber":
    case "driverSignature":
    case "observations":
      return null;
    case "convoyCategory":
      return hasEmptyValue(draft.convoyCategory)
        ? "Renseigne la categorie du convoi."
        : null;
    case "pickupDate":
      return hasEmptyValue(draft.pickupDate)
        ? "Renseigne la date de prise en charge."
        : null;
    case "pickupTime":
      return hasEmptyValue(draft.pickupTime)
        ? "Renseigne l heure de prise en charge."
        : null;
    case "driverName":
      return hasEmptyValue(draft.driverName)
        ? "Renseigne le chauffeur."
        : null;
    case "departureCity":
      return hasEmptyValue(draft.departureCity)
        ? "Renseigne la ville de depart."
        : null;
    case "arrivalCity":
      return hasEmptyValue(draft.arrivalCity)
        ? "Renseigne la ville d arrivee."
        : null;
    case "itinerary": {
      const rows = filterFilledItineraryRows(draft.itinerary);

      if (rows.length === 0) {
        return "Ajoute au moins une ligne d itineraire.";
      }

      for (const [index, row] of rows.entries()) {
        if (
          hasEmptyValue(row.date) ||
          hasEmptyValue(row.departureCity) ||
          hasEmptyValue(row.departureTime) ||
          hasEmptyValue(row.arrivalCity) ||
          hasEmptyValue(row.arrivalTime) ||
          hasEmptyValue(row.km)
        ) {
          return `Complete tous les champs de la ligne ${index + 1}.`;
        }

        const km = Number.parseInt(row.km, 10);
        if (Number.isNaN(km) || km < 0) {
          return `Le kilometrage de la ligne ${index + 1} est invalide.`;
        }
      }

      return null;
    }
    case "review":
      return null;
    default:
      return null;
  }
}

export function BonPilotageApp() {
  const [draft, setDraft] = useState<SubmissionDraft>(initialDraft);
  const [memory, setMemory] = useState<SubmissionMemory>(initialMemory);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>({ type: "idle" });
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(STORAGE_KEY);
      const rawMemory = window.localStorage.getItem(MEMORY_KEY);

      if (rawDraft) {
        const parsedDraft = JSON.parse(rawDraft) as Partial<SubmissionDraft>;
        setDraft((current) => ({
          ...current,
          ...parsedDraft,
          itinerary:
            parsedDraft.itinerary && parsedDraft.itinerary.length > 0
              ? parsedDraft.itinerary
              : current.itinerary,
        }));
      }

      setMemory(parseSubmissionMemory(rawMemory));
    } catch {
      setMemory(createEmptySubmissionMemory());
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  }, [memory, hasHydrated]);

  const previewData = buildPreviewData(draft);
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const pilotProfiles = getFilteredPilotProfiles(memory, draft.pilotName);
  const selectedPilotKey = draft.pilotName.trim().toLocaleLowerCase();

  function clearStatus() {
    setStatus((current) => (current.type === "idle" ? current : { type: "idle" }));
  }

  function handleInputChange<K extends keyof SubmissionDraft>(
    field: K,
    value: SubmissionDraft[K],
  ) {
    clearStatus();
    setDraft((current) => setDraftField(current, field, value));
  }

  function setFieldFromSuggestion<K extends keyof SubmissionDraft>(
    field: K,
    value: SubmissionDraft[K],
  ) {
    clearStatus();
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleItineraryChange(
    index: number,
    field: keyof ItineraryDraftRow,
    value: string,
  ) {
    clearStatus();
    setDraft((current) => {
      const nextItinerary = [...current.itinerary];
      nextItinerary[index] = {
        ...nextItinerary[index],
        [field]: value,
      };

      return {
        ...current,
        itinerary: nextItinerary,
      };
    });
  }

  function addItineraryRow() {
    clearStatus();
    setDraft((current) => {
      if (current.itinerary.length >= MAX_ITINERARY_ROWS) {
        return current;
      }

      return {
        ...current,
        itinerary: [
          ...current.itinerary,
          createEmptyItineraryRow({
            date: current.pickupDate || formatDateInput(),
            departureCity: current.departureCity,
            arrivalCity: current.arrivalCity,
          }),
        ],
      };
    });
  }

  function removeItineraryRow(index: number) {
    clearStatus();
    setDraft((current) => {
      if (current.itinerary.length === 1) {
        return {
          ...current,
          itinerary: [
            createEmptyItineraryRow({
              date: current.pickupDate || formatDateInput(),
            }),
          ],
        };
      }

      return {
        ...current,
        itinerary: current.itinerary.filter((_, rowIndex) => rowIndex !== index),
      };
    });
  }

  function useMainRouteForFirstRow() {
    clearStatus();
    setDraft((current) => {
      const nextItinerary = [...current.itinerary];
      nextItinerary[0] = {
        ...nextItinerary[0],
        date: current.pickupDate,
        departureCity: current.departureCity,
        departureTime: current.pickupTime,
        arrivalCity: current.arrivalCity,
      };

      return {
        ...current,
        itinerary: nextItinerary,
      };
    });
  }

  function jumpToStep(stepId: StepId) {
    clearStatus();
    const nextIndex = steps.findIndex((entry) => entry.id === stepId);
    if (nextIndex >= 0) {
      setCurrentStep(nextIndex);
    }
  }

  function resetForm() {
    setDraft(createInitialDraft());
    setCurrentStep(0);
    setStatus({ type: "idle" });
  }

  function goToPreviousStep() {
    clearStatus();
    setCurrentStep((index) => Math.max(index - 1, 0));
  }

  function goToNextStep() {
    const error = validateStep(step.id, draft);

    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }

    clearStatus();
    setCurrentStep((index) => Math.min(index + 1, steps.length - 1));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    for (const entry of steps) {
      if (entry.id === "review") {
        break;
      }

      const error = validateStep(entry.id, draft);
      if (error) {
        jumpToStep(entry.id);
        setStatus({ type: "error", message: error });
        return;
      }
    }

    setIsSubmitting(true);
    setStatus({ type: "idle" });

    const payload = {
      ...draft,
      itinerary: filterFilledItineraryRows(draft.itinerary),
    };

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        bonNumber?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "La soumission a echoue.");
      }

      setMemory((current) => updateSubmissionMemory(current, draft));
      setDraft((current) => resetDraftAfterSuccess(current));
      setCurrentStep(0);
      setStatus({
        type: "success",
        message: `Le bon ${result.bonNumber || draft.bonNumber} a ete genere et envoye par e-mail.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d envoyer le bon de pilotage.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFieldQuestion(options: {
    field: Exclude<keyof SubmissionDraft, "itinerary" | "website">;
    inputType?: "text" | "date" | "time";
    placeholder?: string;
    optional?: boolean;
    suggestionField?: SuggestionField;
    helper?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) {
    const value = draft[options.field] as string;
    const suggestions = options.suggestionField
      ? getFieldSuggestions(memory, options.suggestionField, value)
      : [];

    return (
      <section className="question-card">
        <span className="question-kicker">Question {currentStep + 1}</span>
        <h2 className="question-title">{step.title}</h2>
        <p className="question-description">{step.description}</p>

        <label className="question-label" htmlFor={options.field}>
          {options.optional ? "Reponse facultative" : "Ta reponse"}
        </label>

        <input
          id={options.field}
          className="question-input"
          type={options.inputType ?? "text"}
          value={value}
          onChange={(event) => handleInputChange(options.field, event.target.value)}
          placeholder={options.placeholder}
        />

        {(options.helper || options.actionLabel) && (
          <div className="helper-row">
            {options.helper ? (
              <span className="question-helper">{options.helper}</span>
            ) : (
              <span />
            )}
            {options.actionLabel && options.onAction ? (
              <button
                className="inline-action"
                type="button"
                onClick={options.onAction}
              >
                {options.actionLabel}
              </button>
            ) : null}
          </div>
        )}

        <SuggestionChips
          title="Suggestions memorisees"
          items={suggestions}
          onSelect={(item) => setFieldFromSuggestion(options.field, item)}
        />
      </section>
    );
  }

  function renderStep() {
    switch (step.id) {
      case "pilotName":
        return (
          <section className="question-card">
            <span className="question-kicker">Profil pilote</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>

            <label className="question-label" htmlFor="pilotName">
              Rechercher ou saisir un pilote
            </label>
            <input
              id="pilotName"
              className="question-input"
              value={draft.pilotName}
              onChange={(event) =>
                handleInputChange("pilotName", event.target.value)
              }
              placeholder="Ex. Christophe"
              autoComplete="off"
            />

            <div className="helper-row">
              <span className="question-helper">
                Selectionne un bloc pour reappliquer les habitudes d un pilote.
              </span>
            </div>

            <div className="pilot-section">
              <span className="suggestion-title">Pilotes enregistres</span>
              {pilotProfiles.length > 0 ? (
                <div className="pilot-grid">
                  {pilotProfiles.map((profile) => {
                    const isActive =
                      profile.pilotName.toLocaleLowerCase() === selectedPilotKey;

                    return (
                      <button
                        key={profile.pilotName}
                        className={`pilot-card${isActive ? " pilot-card-active" : ""}`}
                        type="button"
                        onClick={() => {
                          clearStatus();
                          setDraft((current) => applyPilotProfile(current, profile));
                        }}
                      >
                        <span className="pilot-name">{profile.pilotName}</span>
                        <span className="pilot-meta">
                          {profile.transporter || "Transporteur non renseigne"}
                        </span>
                        <span className="pilot-meta">
                          {profile.convoyCategory || "Categorie non renseignee"}
                        </span>
                        <span className="pilot-route">
                          {profile.departureCity || "-"} {"->"} {profile.arrivalCity || "-"}
                        </span>
                        {isActive ? (
                          <span className="pilot-badge">Profil actuel</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-card">
                  Aucun pilote n est encore memorise. Le premier envoi alimentera cette liste.
                </div>
              )}
            </div>
          </section>
        );
      case "bonNumber":
        return renderFieldQuestion({
          field: "bonNumber",
          placeholder: "BP-20260408-0830",
          helper: "Le numero courant est genere automatiquement.",
          actionLabel: "Regenerer",
          onAction: () =>
            handleInputChange("bonNumber", createBonNumber(new Date())),
        });
      case "transporter":
        return renderFieldQuestion({
          field: "transporter",
          suggestionField: "transporter",
          placeholder: "Nom du transporteur",
        });
      case "vehicleRegistration":
        return renderFieldQuestion({
          field: "vehicleRegistration",
          suggestionField: "vehicleRegistration",
          placeholder: "Ex. AB-123-CD / XY-456-ZT",
          optional: true,
        });
      case "convoyCategory":
        return renderFieldQuestion({
          field: "convoyCategory",
          suggestionField: "convoyCategory",
          placeholder: "Categorie du convoi",
        });
      case "decreeNumber":
        return renderFieldQuestion({
          field: "decreeNumber",
          suggestionField: "decreeNumber",
          placeholder: "No arrete ou laisser vide",
          optional: true,
        });
      case "pickupDate":
        return renderFieldQuestion({
          field: "pickupDate",
          inputType: "date",
          helper: "La date du jour est prechargee.",
          actionLabel: "Aujourd hui",
          onAction: () => handleInputChange("pickupDate", formatDateInput()),
        });
      case "pickupTime":
        return renderFieldQuestion({
          field: "pickupTime",
          inputType: "time",
          helper: "Tu peux reprendre l heure actuelle en un toucher.",
          actionLabel: "Maintenant",
          onAction: () => handleInputChange("pickupTime", formatTimeInput()),
        });
      case "driverName":
        return renderFieldQuestion({
          field: "driverName",
          suggestionField: "driverName",
          placeholder: "Nom du chauffeur",
        });
      case "driverSignature":
        return renderFieldQuestion({
          field: "driverSignature",
          suggestionField: "driverSignature",
          placeholder: "Nom ou signature textuelle",
          optional: true,
        });
      case "departureCity":
        return renderFieldQuestion({
          field: "departureCity",
          suggestionField: "departureCity",
          placeholder: "Ville de depart",
        });
      case "arrivalCity":
        return renderFieldQuestion({
          field: "arrivalCity",
          suggestionField: "arrivalCity",
          placeholder: "Ville d arrivee",
        });
      case "itinerary":
        return (
          <section className="question-card">
            <span className="question-kicker">Itineraire detaille</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>

            <div className="route-toolbar">
              <div className="route-total">{previewData.totalKm || 0} km cumules</div>
              <div className="route-toolbar-actions">
                <button
                  className="inline-action"
                  type="button"
                  onClick={useMainRouteForFirstRow}
                >
                  Reprendre le trajet principal
                </button>
                <button
                  className="inline-action"
                  type="button"
                  onClick={addItineraryRow}
                  disabled={draft.itinerary.length >= MAX_ITINERARY_ROWS}
                >
                  Ajouter une ligne
                </button>
              </div>
            </div>

            <div className="route-list">
              {draft.itinerary.map((row, index) => (
                <div className="route-card" key={`route-${index}`}>
                  <div className="route-card-head">
                    <span className="route-index">Ligne {index + 1}</span>
                    <button
                      className="ghost-inline"
                      type="button"
                      onClick={() => removeItineraryRow(index)}
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="route-grid">
                    <div className="field">
                      <label htmlFor={`itinerary-date-${index}`}>Date</label>
                      <input
                        id={`itinerary-date-${index}`}
                        type="date"
                        value={row.date}
                        onChange={(event) =>
                          handleItineraryChange(index, "date", event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`itinerary-km-${index}`}>km</label>
                      <input
                        id={`itinerary-km-${index}`}
                        type="number"
                        min="0"
                        step="1"
                        value={row.km}
                        onChange={(event) =>
                          handleItineraryChange(index, "km", event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`itinerary-departure-${index}`}>Depart</label>
                      <input
                        id={`itinerary-departure-${index}`}
                        value={row.departureCity}
                        onChange={(event) =>
                          handleItineraryChange(
                            index,
                            "departureCity",
                            event.target.value,
                          )
                        }
                        placeholder="Ville de depart"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`itinerary-departure-time-${index}`}>Heure depart</label>
                      <input
                        id={`itinerary-departure-time-${index}`}
                        type="time"
                        value={row.departureTime}
                        onChange={(event) =>
                          handleItineraryChange(
                            index,
                            "departureTime",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`itinerary-arrival-${index}`}>Arrivee</label>
                      <input
                        id={`itinerary-arrival-${index}`}
                        value={row.arrivalCity}
                        onChange={(event) =>
                          handleItineraryChange(
                            index,
                            "arrivalCity",
                            event.target.value,
                          )
                        }
                        placeholder="Ville d arrivee"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`itinerary-arrival-time-${index}`}>Heure arrivee</label>
                      <input
                        id={`itinerary-arrival-time-${index}`}
                        type="time"
                        value={row.arrivalTime}
                        onChange={(event) =>
                          handleItineraryChange(
                            index,
                            "arrivalTime",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      case "observations":
        return (
          <section className="question-card">
            <span className="question-kicker">Observation</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>

            <label className="question-label" htmlFor="observations">
              Notes libres
            </label>
            <textarea
              id="observations"
              className="question-textarea"
              value={draft.observations}
              onChange={(event) =>
                handleInputChange("observations", event.target.value)
              }
              placeholder="Ex. circulation, restrictions, remarques diverses..."
            />
          </section>
        );
      case "review":
        return (
          <section className="question-card review-card">
            <span className="question-kicker">Resume</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>

            <div className="review-grid">
              <div className="review-block">
                <div className="review-block-head">
                  <h3>Pilote et bon</h3>
                  <button
                    className="ghost-inline"
                    type="button"
                    onClick={() => jumpToStep("pilotName")}
                  >
                    Modifier
                  </button>
                </div>
                <SummaryRow label="Pilote" value={draft.pilotName} />
                <SummaryRow label="Numero" value={draft.bonNumber} />
                <SummaryRow label="Transporteur" value={draft.transporter} />
                <SummaryRow
                  label="Immatriculation"
                  value={draft.vehicleRegistration || "-"}
                />
                <SummaryRow label="Categorie" value={draft.convoyCategory} />
                <SummaryRow label="No arrete" value={draft.decreeNumber || "neant"} />
              </div>

              <div className="review-block">
                <div className="review-block-head">
                  <h3>Mission</h3>
                  <button
                    className="ghost-inline"
                    type="button"
                    onClick={() => jumpToStep("pickupDate")}
                  >
                    Modifier
                  </button>
                </div>
                <SummaryRow label="Date" value={draft.pickupDate} />
                <SummaryRow label="Heure" value={draft.pickupTime} />
                <SummaryRow label="Chauffeur" value={draft.driverName} />
                <SummaryRow label="Signature" value={draft.driverSignature || "-"} />
                <SummaryRow label="Depart" value={draft.departureCity} />
                <SummaryRow label="Arrivee" value={draft.arrivalCity} />
              </div>

              <div className="review-block review-block-wide">
                <div className="review-block-head">
                  <h3>Itineraire</h3>
                  <button
                    className="ghost-inline"
                    type="button"
                    onClick={() => jumpToStep("itinerary")}
                  >
                    Modifier
                  </button>
                </div>
                <div className="review-route-list">
                  {filterFilledItineraryRows(draft.itinerary).map((row, index) => (
                    <div className="review-route" key={`review-route-${index}`}>
                      <div className="review-route-main">
                        <strong>{row.date}</strong> {row.departureCity} ({row.departureTime}) {"->"}{" "}
                        {row.arrivalCity} ({row.arrivalTime})
                      </div>
                      <div className="review-route-km">{row.km} km</div>
                    </div>
                  ))}
                </div>
                <div className="review-total">
                  Total calcule : {previewData.totalKm || 0} km
                </div>
              </div>

              <div className="review-block review-block-wide">
                <div className="review-block-head">
                  <h3>Observations</h3>
                  <button
                    className="ghost-inline"
                    type="button"
                    onClick={() => jumpToStep("observations")}
                  >
                    Modifier
                  </button>
                </div>
                <p className="review-notes">
                  {draft.observations || "Aucune observation renseignee."}
                </p>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  }

  return (
    <main className="app-shell">
      <section className="app-frame">
        <header className="app-topbar">
          <div className="app-brand">
            <span className="app-kicker">Bon de pilotage</span>
            <h1>Assistant de saisie</h1>
          </div>
          <div className="app-meta">
            <span className="app-step-label">
              Question {currentStep + 1} / {steps.length}
            </span>
            <div className="progress-track" aria-hidden="true">
              <span className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {status.type === "success" ? (
          <div className="status status-success">{status.message}</div>
        ) : null}

        {status.type === "error" ? (
          <div className="status status-error">{status.message}</div>
        ) : null}

        <form className="question-flow" onSubmit={handleSubmit}>
          <div className="question-stage" key={step.id}>
            {renderStep()}
          </div>

          <div className="visually-hidden" aria-hidden="true">
            <label htmlFor="website">Ne pas remplir</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={draft.website}
              onChange={(event) =>
                handleInputChange("website", event.target.value)
              }
            />
          </div>

          <footer className="app-footer">
            <button
              className="ghost-button"
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Reinitialiser
            </button>

            <div className="footer-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={goToPreviousStep}
                disabled={isFirstStep || isSubmitting}
              >
                Precedent
              </button>

              {isLastStep ? (
                <button className="button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Envoi en cours..." : "Generer et envoyer"}
                </button>
              ) : (
                <button
                  className="button"
                  type="button"
                  onClick={goToNextStep}
                  disabled={isSubmitting}
                >
                  Continuer
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>
    </main>
  );
}
