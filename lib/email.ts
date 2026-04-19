import { formatDateLabel, formatTimeLabel } from "@/lib/format";
import type { ParsedSubmission } from "@/lib/submission";
import nodemailer from "nodemailer";

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
      <h2 style="margin: 0 0 12px;">Nouveau bon de pilotage</h2>
      <p style="margin: 0 0 18px;">
        Le bon <strong>${escapeHtml(submission.bonNumber)}</strong> a été généré et est joint en PDF.
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
    </div>
  `;
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
    auth: {
      user,
      pass: appPassword,
    },
  });

  const info = await transporter.sendMail({
    from: `"Bon Pilotage" <${user}>`,
    to,
    subject: `Bon de pilotage ${submission.bonNumber}`,
    html: buildEmailHtml(submission),
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
      },
    ],
  });

  return { id: info.messageId };
}
