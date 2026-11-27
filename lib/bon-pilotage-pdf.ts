import "server-only";
import { sanitizeFilePart } from "@/lib/format";
import { renderPdfFromHtml } from "@/lib/pdf";
import { renderBonPilotageHtml } from "@/lib/render-bon-pilotage-html";
import type { BonPilotageDisplayData } from "@/lib/types";

export const CURRENT_PDF_TEMPLATE = 1;
const templates: Record<number, typeof renderBonPilotageHtml> = {
  1: renderBonPilotageHtml,
};

const timestampFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

export function documentTimestamp(timestamp: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : timestampFormatter.format(date);
}

export async function buildBonPilotagePdf(data: BonPilotageDisplayData, version: number) {
  const render = templates[version];
  if (!render) throw new Error("Version du modèle PDF indisponible");
  const fileName = `${sanitizeFilePart(data.bonNumber).slice(0, 80)}.pdf`;
  const buffer = await renderPdfFromHtml(render(data));
  return { buffer, fileName };
}
