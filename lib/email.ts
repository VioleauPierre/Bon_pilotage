import { COMPANY_INFO } from "@/lib/constants";
import { formatDateLabel, formatTimeLabel } from "@/lib/format";
import type { ParsedSubmission } from "@/lib/submission";
import nodemailer, { type SendMailOptions } from "nodemailer";

type SendBonPilotageEmailInput = {
  submission: ParsedSubmission;
  pdfBuffer: Buffer;
  fileName: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }

  return value;
}

function buildEmailHtml(submission: ParsedSubmission) {
  const observations = submission.observations
    ? escapeHtml(submission.observations).replace(/\n/g, "<br />")
    : "";

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #101827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">${escapeHtml(COMPANY_INFO.name)} — Bon de pilotage</h2>
      <p style="margin: 0 0 18px;">
        Vous trouverez en pièce jointe le bon de pilotage <strong>${escapeHtml(submission.bonNumber)}</strong>
        établi par ${escapeHtml(COMPANY_INFO.name)} pour la prestation de guidage du convoi ci-dessous.
      </p>
      <table style="border-collapse: collapse; width: 100%; max-width: 680px;">
        <tbody>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Pilote</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${escapeHtml(submission.pilotName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Transporteur</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${escapeHtml(submission.transporter)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Chauffeur</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${escapeHtml(submission.driverName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Prise en charge</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${formatDateLabel(submission.pickupDate)} à ${formatTimeLabel(submission.pickupTime)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Trajet principal</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${escapeHtml(submission.departureCity)} -> ${escapeHtml(submission.arrivalCity)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #d0d5dd; font-weight: 700;">Total km</td><td style="padding: 8px; border: 1px solid #d0d5dd;">${submission.totalKm} km</td></tr>
        </tbody>
      </table>
      ${
        observations
          ? `<p style="margin-top: 18px;"><strong>Observations :</strong><br />${observations}</p>`
          : ""
      }
      <p style="margin-top: 24px;">
        ${escapeHtml(COMPANY_INFO.name)}<br />
        ${escapeHtml(COMPANY_INFO.addressLine1)}<br />
        ${escapeHtml(COMPANY_INFO.addressLine2)}<br />
        ${escapeHtml(COMPANY_INFO.phone)} — ${escapeHtml(COMPANY_INFO.email)}
      </p>
    </div>
  `;
}

function buildEmailText(submission: ParsedSubmission) {
  return [
    `${COMPANY_INFO.name} — Bon de pilotage`,
    "",
    `Vous trouverez en pièce jointe le bon de pilotage ${submission.bonNumber}`,
    `établi par ${COMPANY_INFO.name} pour la prestation de guidage du convoi ci-dessous.`,
    "",
    `Pilote : ${submission.pilotName}`,
    `Transporteur : ${submission.transporter}`,
    `Chauffeur : ${submission.driverName}`,
    `Prise en charge : ${formatDateLabel(submission.pickupDate)} à ${formatTimeLabel(submission.pickupTime)}`,
    `Trajet principal : ${submission.departureCity} -> ${submission.arrivalCity}`,
    `Total km : ${submission.totalKm} km`,
    ...(submission.observations ? ["", `Observations : ${submission.observations}`] : []),
    "",
    COMPANY_INFO.name,
    COMPANY_INFO.addressLine1,
    COMPANY_INFO.addressLine2,
    `${COMPANY_INFO.phone} — ${COMPANY_INFO.email}`,
  ].join("\n");
}

export function buildBonPilotageEmail(
  { submission, pdfBuffer, fileName }: SendBonPilotageEmailInput,
  sender: string,
  recipient: string,
): SendMailOptions {
  return {
    // Keep the authenticated Gmail address so Gmail can sign the From domain.
    from: { name: `${COMPANY_INFO.name} — Bon Pilotage`, address: sender },
    to: recipient,
    subject: `${COMPANY_INFO.name} — Bon de pilotage ${submission.bonNumber}`,
    text: buildEmailText(submission),
    html: buildEmailHtml(submission),
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: "application/pdf",
        contentDisposition: "attachment",
      },
    ],
  };
}

export async function sendBonPilotageEmail({
  submission,
  pdfBuffer,
  fileName,
}: SendBonPilotageEmailInput) {
  const user = getRequiredEnv("GMAIL_USER");
  const appPassword = getRequiredEnv("GMAIL_APP_PASSWORD");
  const to = getRequiredEnv("NOTIFICATION_EMAIL");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2" },
    auth: {
      user,
      pass: appPassword,
    },
  });

  const info = await transporter.sendMail(
    buildBonPilotageEmail({ submission, pdfBuffer, fileName }, user, to),
  );

  if (info.accepted.length === 0) throw new Error("Envoi non accepté par Gmail");
  return { id: info.messageId ?? null };
}
