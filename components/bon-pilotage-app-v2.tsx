"use client";

import options from "@/data/bon-pilotage-options.json";
import {
  CONVOY_CATEGORIES,
  createNextItineraryRow,
  dateTimeSummary,
  flowSteps,
  getPrefixSuggestions,
  pilotCountLabel,
  submitError,
  syncItineraryBoundaries,
  uniqueValues,
  validateFlowStep,
  type StepId,
} from "@/components/bon-pilotage-flow-utils";
import { MAX_ITINERARY_ROWS } from "@/lib/constants";
import { createEmptySubmissionMemory } from "@/lib/form-memory";
import {
  buildPreviewData,
  createEmptyItineraryRow,
  createInitialDraft,
  filterFilledItineraryRows,
  resetDraftAfterSuccess,
} from "@/lib/format";
import type { ItineraryDraftRow, SubmissionDraft, SubmissionMemory } from "@/lib/types";
import { type FormEvent, useEffect, useState } from "react";

type Status =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type TextField = Extract<Exclude<keyof SubmissionDraft, "itinerary" | "pilotNames">, string>;

const pilotOptions = options.pilotes.map((pilot) => pilot.prenom);

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{value || "-"}</span>
    </div>
  );
}

function SuggestionChips({ items, onPick }: { items: string[]; onPick: (value: string) => void }) {
  if (items.length === 0) return null;

  return (
    <div className="suggestion-stack">
      <span className="suggestion-title">Suggestions</span>
      <div className="suggestion-row">
        {items.map((item) => (
          <button key={item} className="suggestion-chip" type="button" onClick={() => onPick(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BonPilotageAppV2() {
  const [draft, setDraft] = useState<SubmissionDraft>(() => createInitialDraft());
  const [memory, setMemory] = useState<SubmissionMemory>(() => createEmptySubmissionMemory());
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step = flowSteps[currentStep];
  const previewData = buildPreviewData(draft);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === flowSteps.length - 1;
  const progress = ((currentStep + 1) / flowSteps.length) * 100;
  const transporters = uniqueValues([
    ...options.transporteurs,
    ...memory.suggestions.transporter,
  ]);
  const cities = uniqueValues([
    ...options.villesCourantes,
    ...memory.suggestions.departureCity,
    ...memory.suggestions.arrivalCity,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadMemory() {
      try {
        const response = await fetch("/api/memory", { method: "GET" });
        const result = (await response.json()) as { ok?: boolean; memory?: SubmissionMemory };
        if (!ignore && response.ok && result.ok && result.memory) setMemory(result.memory);
      } catch {
        if (!ignore) setMemory(createEmptySubmissionMemory());
      }
    }

    loadMemory();
    return () => {
      ignore = true;
    };
  }, []);

  function clearStatus() {
    setStatus((current) => (current.type === "idle" ? current : { type: "idle" }));
  }

  function updateTextField(field: TextField, value: string) {
    clearStatus();
    setDraft((current) => {
      const next = { ...current, [field]: value } as SubmissionDraft;
      if (["pickupDate", "pickupTime", "endDate", "endTime", "departureCity", "arrivalCity"].includes(field)) {
        return syncItineraryBoundaries(next);
      }
      return next;
    });
  }

  function togglePilot(pilotName: string) {
    clearStatus();
    setDraft((current) => {
      const pilotNames = current.pilotNames.includes(pilotName)
        ? current.pilotNames.filter((name) => name !== pilotName)
        : [...current.pilotNames, pilotName];
      return { ...current, pilotNames, pilotName: pilotNames.join(", ") };
    });
  }

  function updateItinerary(index: number, field: keyof ItineraryDraftRow, value: string) {
    clearStatus();
    setDraft((current) => {
      const itinerary = [...current.itinerary];
      itinerary[index] = { ...itinerary[index], [field]: value };
      return { ...current, itinerary };
    });
  }

  function addItineraryRow() {
    clearStatus();
    setDraft((current) => {
      if (current.itinerary.length >= MAX_ITINERARY_ROWS) return current;
      const itinerary = current.itinerary.map((row) => ({ ...row }));
      const lastIndex = itinerary.length - 1;
      if (lastIndex >= 0) itinerary[lastIndex] = { ...itinerary[lastIndex], arrivalCity: "", arrivalTime: "" };
      itinerary.push(createNextItineraryRow(current));
      return syncItineraryBoundaries({ ...current, itinerary });
    });
  }

  function removeItineraryRow(index: number) {
    clearStatus();
    setDraft((current) => {
      const itinerary = current.itinerary.length === 1
        ? [createEmptyItineraryRow({ date: current.pickupDate })]
        : current.itinerary.filter((_, rowIndex) => rowIndex !== index);
      return syncItineraryBoundaries({ ...current, itinerary });
    });
  }

  function reuseMainRoute() {
    clearStatus();
    setDraft((current) => syncItineraryBoundaries({
      ...current,
      itinerary: [createEmptyItineraryRow({
        date: current.pickupDate,
        departureCity: current.departureCity,
        departureTime: current.pickupTime,
        arrivalCity: current.arrivalCity,
        arrivalTime: current.endTime,
      })],
    }));
  }

  function goToStep(stepId: StepId) {
    clearStatus();
    const index = flowSteps.findIndex((item) => item.id === stepId);
    if (index >= 0) setCurrentStep(index);
  }

  function nextStep() {
    const error = validateFlowStep(step.id, draft);
    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }
    clearStatus();
    setCurrentStep((index) => Math.min(index + 1, flowSteps.length - 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    for (const item of flowSteps) {
      if (item.id === "review") break;
      const error = validateFlowStep(item.id, draft);
      if (error) {
        goToStep(item.id);
        setStatus({ type: "error", message: submitError(error) });
        return;
      }
    }

    setIsSubmitting(true);
    setStatus({ type: "idle" });

    const normalizedDraft = syncItineraryBoundaries({ ...draft, pilotName: draft.pilotNames.join(", ") });
    const payload = { ...normalizedDraft, itinerary: filterFilledItineraryRows(normalizedDraft.itinerary) };

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; bonNumber?: string; memory?: SubmissionMemory };
      if (!response.ok || !result.ok) throw new Error(result.message || "La soumission a echoue.");
      if (result.memory) setMemory(result.memory);
      setDraft((current) => resetDraftAfterSuccess(current));
      setCurrentStep(0);
      setStatus({ type: "success", message: `Le bon ${result.bonNumber || draft.bonNumber} a ete genere et envoye par e-mail.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
      setStatus({ type: "error", message: submitError(`${message} Corrige le formulaire puis reessaie.`) });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderField(options: {
    field: TextField;
    label: string;
    type?: "text" | "date" | "time";
    values?: string[];
    placeholder?: string;
    optional?: boolean;
  }) {
    const value = draft[options.field] as string;
    const values = uniqueValues(options.values || []);
    const listId = `${options.field}-list`;

    return (
      <div className="field">
        <label htmlFor={options.field}>
          {options.label}{options.optional ? <span className="field-optional"> facultatif</span> : null}
        </label>
        <input
          id={options.field}
          type={options.type || "text"}
          list={values.length > 0 ? listId : undefined}
          value={value}
          placeholder={options.placeholder}
          autoComplete="off"
          onChange={(event) => updateTextField(options.field, event.target.value)}
        />
        {values.length > 0 ? <datalist id={listId}>{values.map((item) => <option key={item} value={item} />)}</datalist> : null}
        {values.length > 0 ? <SuggestionChips items={getPrefixSuggestions(values, value)} onPick={(item) => updateTextField(options.field, item)} /> : null}
      </div>
    );
  }

  function renderStep() {
    switch (step.id) {
      case "pilots":
        return (
          <section className="question-card">
            <span className="question-kicker">{pilotCountLabel(draft.pilotNames.length)}</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>
            <div className="pilot-grid">
              {pilotOptions.map((pilotName) => {
                const selected = draft.pilotNames.includes(pilotName);
                return (
                  <button key={pilotName} className={`pilot-card${selected ? " pilot-card-active" : ""}`} type="button" onClick={() => togglePilot(pilotName)}>
                    <span className="pilot-name">{pilotName}</span>
                    <span className="pilot-meta">{selected ? "Selectionne" : "Disponible"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      case "convoy":
        return (
          <section className="question-card">
            <span className="question-kicker">Convoi</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>
            <div className="route-grid">
              {renderField({ field: "transporter", label: "Transporteur", values: transporters, placeholder: "Rechercher ou saisir" })}
              {renderField({ field: "vehicleRegistration", label: "Immatriculation TR/SR", placeholder: "AB-123-CD", optional: true })}
            </div>
            <div className="suggestion-stack">
              <span className="suggestion-title">Categorie de convoi</span>
              <div className="suggestion-row">
                {CONVOY_CATEGORIES.map((category) => (
                  <button key={category} className={`suggestion-chip${draft.convoyCategory === category ? " pilot-card-active" : ""}`} type="button" onClick={() => updateTextField("convoyCategory", category)}>
                    {category}
                  </button>
                ))}
              </div>
            </div>
            {renderField({ field: "driverName", label: "Chauffeur", placeholder: "Nom du chauffeur" })}
          </section>
        );
      case "timing":
        return (
          <section className="question-card">
            <span className="question-kicker">Mission</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>
            <div className="route-grid">
              {renderField({ field: "pickupDate", label: "Date prise en charge", type: "date" })}
              {renderField({ field: "pickupTime", label: "Heure prise en charge", type: "time" })}
              {renderField({ field: "endDate", label: "Date fin de convoi", type: "date" })}
              {renderField({ field: "endTime", label: "Heure fin de convoi", type: "time" })}
              {renderField({ field: "departureCity", label: "Ville depart", values: cities, placeholder: "Rechercher ou saisir" })}
              {renderField({ field: "arrivalCity", label: "Ville arrivee", values: cities, placeholder: "Rechercher ou saisir" })}
            </div>
          </section>
        );
      case "itinerary":
        return (
          <section className="question-card">
            <span className="question-kicker">Trajets</span>
            <h2 className="question-title">{step.title}</h2>
            <p className="question-description">{step.description}</p>
            <div className="route-toolbar"><div className="route-total">{previewData.totalKm || 0} km cumules</div><div className="route-toolbar-actions"><button className="inline-action" type="button" onClick={reuseMainRoute}>Reprendre le trajet</button><button className="inline-action" type="button" onClick={addItineraryRow} disabled={draft.itinerary.length >= MAX_ITINERARY_ROWS}>Ajouter une ligne</button></div></div>
            <datalist id="city-options">{cities.map((city) => <option key={city} value={city} />)}</datalist>
            <div className="route-list">{draft.itinerary.map((row, index) => <div className="route-card" key={`route-${index}`}><div className="route-card-head"><span className="route-index">Ligne {index + 1}</span><button className="ghost-inline" type="button" onClick={() => removeItineraryRow(index)}>Supprimer</button></div><div className="route-grid">
              <div className="field"><label htmlFor={`itinerary-date-${index}`}>Date</label><input id={`itinerary-date-${index}`} type="date" value={row.date} onChange={(event) => updateItinerary(index, "date", event.target.value)} /></div>
              <div className="field"><label htmlFor={`itinerary-km-${index}`}>km</label><input id={`itinerary-km-${index}`} type="number" min="0" step="1" value={row.km} onChange={(event) => updateItinerary(index, "km", event.target.value)} /></div>
              <div className="field"><label htmlFor={`itinerary-departure-${index}`}>Depart</label><input id={`itinerary-departure-${index}`} list="city-options" value={row.departureCity} onChange={(event) => updateItinerary(index, "departureCity", event.target.value)} /></div>
              <div className="field"><label htmlFor={`itinerary-departure-time-${index}`}>Heure depart</label><input id={`itinerary-departure-time-${index}`} type="time" value={row.departureTime} onChange={(event) => updateItinerary(index, "departureTime", event.target.value)} /></div>
              <div className="field"><label htmlFor={`itinerary-arrival-${index}`}>Arrivee</label><input id={`itinerary-arrival-${index}`} list="city-options" value={row.arrivalCity} onChange={(event) => updateItinerary(index, "arrivalCity", event.target.value)} /></div>
              <div className="field"><label htmlFor={`itinerary-arrival-time-${index}`}>Heure arrivee</label><input id={`itinerary-arrival-time-${index}`} type="time" value={row.arrivalTime} onChange={(event) => updateItinerary(index, "arrivalTime", event.target.value)} /></div>
            </div></div>)}</div>
          </section>
        );
      case "observations":
        return <section className="question-card"><span className="question-kicker">Observation</span><h2 className="question-title">{step.title}</h2><p className="question-description">{step.description}</p><label className="question-label" htmlFor="observations">Notes libres</label><textarea id="observations" className="question-textarea" value={draft.observations} onChange={(event) => updateTextField("observations", event.target.value)} placeholder="Remarques, circulation, consignes..." /></section>;
      case "review":
        return (
          <section className="question-card review-card"><span className="question-kicker">Resume</span><h2 className="question-title">{step.title}</h2><p className="question-description">{step.description}</p><div className="review-grid">
            <div className="review-block"><div className="review-block-head"><h3>Pilotes</h3><button className="ghost-inline" type="button" onClick={() => goToStep("pilots")}>Modifier</button></div><SummaryRow label="Selection" value={draft.pilotNames.join(", ")} /><SummaryRow label="Nombre" value={pilotCountLabel(draft.pilotNames.length)} /><SummaryRow label="Numero de bon" value={draft.bonNumber} /></div>
            <div className="review-block"><div className="review-block-head"><h3>Convoi</h3><button className="ghost-inline" type="button" onClick={() => goToStep("convoy")}>Modifier</button></div><SummaryRow label="Transporteur" value={draft.transporter} /><SummaryRow label="Immatriculation" value={draft.vehicleRegistration || "-"} /><SummaryRow label="Categorie" value={draft.convoyCategory} /><SummaryRow label="Chauffeur" value={draft.driverName} /></div>
            <div className="review-block"><div className="review-block-head"><h3>Dates</h3><button className="ghost-inline" type="button" onClick={() => goToStep("timing")}>Modifier</button></div><SummaryRow label="Prise en charge" value={dateTimeSummary(draft.pickupDate, draft.pickupTime)} /><SummaryRow label="Fin de convoi" value={dateTimeSummary(draft.endDate, draft.endTime)} /></div>
            <div className="review-block"><div className="review-block-head"><h3>Villes</h3><button className="ghost-inline" type="button" onClick={() => goToStep("timing")}>Modifier</button></div><SummaryRow label="Depart" value={draft.departureCity} /><SummaryRow label="Arrivee" value={draft.arrivalCity} /></div>
            <div className="review-block review-block-wide"><div className="review-block-head"><h3>Trajets</h3><button className="ghost-inline" type="button" onClick={() => goToStep("itinerary")}>Modifier</button></div><div className="review-route-list">{filterFilledItineraryRows(draft.itinerary).map((row, index) => <div className="review-route" key={`review-route-${index}`}><div className="review-route-main"><strong>{row.date}</strong> {row.departureCity} ({row.departureTime}) {"->"} {row.arrivalCity} ({row.arrivalTime})</div><div className="review-route-km">{row.km} km</div></div>)}</div><div className="review-total">Total calcule : {previewData.totalKm || 0} km</div></div>
            <div className="review-block review-block-wide"><div className="review-block-head"><h3>Observations</h3><button className="ghost-inline" type="button" onClick={() => goToStep("observations")}>Modifier</button></div><p className="review-notes">{draft.observations || "Aucune observation renseignee."}</p></div>
          </div></section>
        );
      default:
        return null;
    }
  }

  return (
    <main className="app-shell"><section className="app-frame"><header className="app-topbar"><div className="app-brand"><span className="app-kicker">Bon de pilotage</span><h1>Saisie rapide</h1></div><div className="app-meta"><span className="app-step-label">Etape {currentStep + 1} / {flowSteps.length}</span><div className="progress-track" aria-hidden="true"><span className="progress-fill" style={{ width: `${progress}%` }} /></div></div></header>
      {status.type === "success" ? <div className="status status-success">{status.message}</div> : null}
      {status.type === "error" ? <div className="status status-error">{status.message}</div> : null}
      <form className="question-flow" onSubmit={handleSubmit}><div className="question-stage" key={step.id}>{renderStep()}</div><div className="visually-hidden" aria-hidden="true"><label htmlFor="website">Ne pas remplir</label><input id="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={(event) => updateTextField("website", event.target.value)} /></div><footer className="app-footer"><button className="ghost-button" type="button" onClick={() => { setDraft(createInitialDraft()); setCurrentStep(0); setStatus({ type: "idle" }); }} disabled={isSubmitting}>Reinitialiser</button><div className="footer-actions"><button className="ghost-button" type="button" onClick={() => { clearStatus(); setCurrentStep((index) => Math.max(index - 1, 0)); }} disabled={isFirstStep || isSubmitting}>Precedent</button>{isLastStep ? <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Envoi en cours..." : "Envoyer"}</button> : <button className="button" type="button" onClick={nextStep} disabled={isSubmitting}>Continuer</button>}</div></footer></form>
    </section></main>
  );
}
