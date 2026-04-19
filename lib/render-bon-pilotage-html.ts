import { COMPANY_INFO, LIABILITY_NOTICE, MAX_ITINERARY_ROWS } from "@/lib/constants";
import { formatDateLabel, formatTimeLabel, getDraftTotalKm } from "@/lib/format";
import type { BonPilotageDisplayData } from "@/lib/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fillRows(data: BonPilotageDisplayData) {
  const rows = [...data.itinerary];

  while (rows.length < MAX_ITINERARY_ROWS) {
    rows.push({
      date: "",
      departureCity: "",
      departureTime: "",
      arrivalCity: "",
      arrivalTime: "",
      km: "",
    });
  }

  return rows.slice(0, MAX_ITINERARY_ROWS);
}

export function renderBonPilotageHtml(data: BonPilotageDisplayData) {
  const totalKm =
    typeof data.totalKm === "number" || typeof data.totalKm === "string"
      ? data.totalKm
      : getDraftTotalKm(data.itinerary);

  const itineraryRows = fillRows(data)
    .map(
      (row) => `
        <tr>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;">${escapeHtml(formatDateLabel(row.date))}</td>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;">${escapeHtml(row.departureCity)}</td>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;text-align:center;">${escapeHtml(formatTimeLabel(row.departureTime))}</td>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;">${escapeHtml(row.arrivalCity)}</td>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;text-align:center;">${escapeHtml(formatTimeLabel(row.arrivalTime))}</td>
          <td style="border:1px solid #111827;padding:7px 6px;font-size:12px;height:34px;text-align:right;">${row.km ? escapeHtml(String(row.km)) : ""}</td>
        </tr>`,
    )
    .join("");

  const observations = data.observations
    ? escapeHtml(data.observations).replace(/\n/g, "<br />")
    : "&nbsp;";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bon de pilotage</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body>
    <div style="width:794px;margin:0 auto;padding:20px;background:#ffffff;border:2px solid #111827;">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;font-size:12px;">
        <span>Nom du pilote :</span>
        <span style="display:inline-block;min-width:220px;margin-left:8px;padding-bottom:2px;border-bottom:1px solid #111827;font-weight:700;">${escapeHtml(data.pilotName || " ")}</span>
      </div>

      <div style="display:grid;grid-template-columns:1.08fr 0.92fr;gap:12px;margin-bottom:12px;">
        <div style="border:2px solid #111827;min-height:120px;padding:10px 12px;">
          <p style="margin:0 0 8px;font-size:25px;font-weight:800;letter-spacing:0.04em;">${escapeHtml(COMPANY_INFO.name)}</p>
          <p style="margin:0;font-size:13px;line-height:1.45;">${escapeHtml(COMPANY_INFO.addressLine1)}</p>
          <p style="margin:0;font-size:13px;line-height:1.45;">${escapeHtml(COMPANY_INFO.addressLine2)}</p>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.45;">Email : ${escapeHtml(COMPANY_INFO.email)}</p>
          <p style="margin:0;font-size:13px;line-height:1.45;">Tél. ${escapeHtml(COMPANY_INFO.phone)}</p>
        </div>

        <div style="border:2px solid #111827;min-height:120px;display:grid;grid-template-rows:1fr auto;">
          <div style="display:grid;place-items:center;min-height:74px;padding:10px;border-bottom:2px solid #111827;font-weight:800;font-size:22px;letter-spacing:0.04em;text-align:center;text-transform:uppercase;">Bon de pilotage</div>
          <div style="display:grid;place-items:center;min-height:44px;font-size:18px;font-weight:800;">N° ${escapeHtml(data.bonNumber)}</div>
        </div>
      </div>

      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Transporteur</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.transporter)}</span>
          </div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Immatriculation TR/SR</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.vehicleRegistration)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;display:grid;place-items:center;background:#111827;color:#ffffff;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">Prestation</div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Catégorie du convoi</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.convoyCategory)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">N° arrêté</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.decreeNumber || "néant")}</span>
          </div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Nom du chauffeur</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.driverName)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Date et heure de prise en charge demandées</span>
            <span style="font-size:13px;font-weight:700;line-height:1.35;">Le ${escapeHtml(formatDateLabel(data.pickupDate))} à ${escapeHtml(formatTimeLabel(data.pickupTime))}</span>
          </div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Signature</span>
            <span style="font-size:17px;font-style:italic;font-weight:700;line-height:1.4;">${escapeHtml(data.driverSignature)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Ville de départ</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.departureCity)}</span>
          </div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Ville d'arrivée</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(data.arrivalCity)}</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;">
            <span style="display:block;margin-bottom:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Total km</span>
            <span style="font-size:14px;font-weight:700;line-height:1.4;">${escapeHtml(String(totalKm || 0))} km</span>
          </div>
          <div style="border:1px solid #111827;padding:8px 10px;min-height:48px;font-size:11px;line-height:1.45;text-align:justify;">${escapeHtml(LIABILITY_NOTICE)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:14%;">Date</th>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:24%;">Ville départ (département)</th>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:10%;">H</th>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:24%;">Ville d'arrivée (département)</th>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:10%;">H</th>
            <th style="border:1px solid #111827;padding:8px 6px;background:#f1f5f9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:18%;">km</th>
          </tr>
        </thead>
        <tbody>
          ${itineraryRows}
        </tbody>
      </table>

      <div style="border:2px solid #111827;min-height:108px;margin-top:12px;padding:10px 12px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Observations</p>
        <p style="margin:0;min-height:70px;white-space:pre-wrap;font-size:13px;line-height:1.5;">${observations}</p>
      </div>

      <div style="margin-top:10px;text-align:right;font-size:10px;color:#475467;">
        Document généré le ${escapeHtml(data.generatedAt || new Date().toLocaleString("fr-FR"))}
      </div>
    </div>
  </body>
</html>`;
}
