import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getMailConfiguration, getSendEmailSetting } from "@/lib/admin-settings";
import { buildBonPilotagePdf, CURRENT_PDF_TEMPLATE, documentTimestamp } from "@/lib/bon-pilotage-pdf";
import { sendBonPilotageEmail } from "@/lib/email";
import { parseSubmission, type ParsedSubmission } from "@/lib/submission";
import { persistSubmissionMemoryFromDraft } from "@/lib/submission-memory-store";
import { getBonPilotageTableName, getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const failureMessage = "Impossible d’enregistrer le bon. Les données saisies sont conservées. Réessaie dans quelques instants.";

function buildInsertPayload(submission: ParsedSubmission, recipientEmail: string, status: string) {
  const { website: _website, ...content } = submission;
  void _website;
  const fingerprint = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return {
    submission_fingerprint: fingerprint,
    generated_at: new Date().toISOString(),
    pdf_template_version: CURRENT_PDF_TEMPLATE,
    status,
    bon_number: submission.bonNumber,
    pilot_name: submission.pilotName,
    pilot_names: submission.pilotNames,
    transporter: submission.transporter,
    vehicle_registration: submission.vehicleRegistration,
    convoy_category: submission.convoyCategory,
    decree_number: submission.decreeNumber,
    driver_name: submission.driverName,
    driver_signature: submission.driverSignature,
    pickup_date: submission.pickupDate,
    pickup_time: submission.pickupTime,
    end_date: submission.endDate,
    end_time: submission.endTime,
    departure_city: submission.departureCity,
    arrival_city: submission.arrivalCity,
    total_km: submission.totalKm,
    observations: submission.observations,
    recipient_email: recipientEmail,
    itinerary: submission.itinerary,
  };
}

function confirmation(bonNumber: string, emailStatus: string, memory?: Awaited<ReturnType<typeof persistSubmissionMemoryFromDraft>>) {
  const messages: Record<string, string> = {
    sent: " Gmail a accepté l’e-mail.",
    queued: " L’état de l’envoi par e-mail est en attente.",
    email_failed: " L’envoi par e-mail a échoué. Le bon reste accessible à l’administration.",
  };
  return NextResponse.json({
    ok: true, bonNumber, memory, emailStatus,
    message: `Le bon ${bonNumber} a été enregistré.${messages[emailStatus] ?? ""}`,
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseSubmission(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }
  const submission = parsed.data;
  if (submission.website) {
    return NextResponse.json({ ok: true, message: "Soumission reçue." });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const table = supabase.from(getBonPilotageTableName());
    const sendEmail = await getSendEmailSetting(supabase).catch(() => {
      console.error("Mail setting unavailable during submission");
      return null;
    });
    const mail = sendEmail === true ? getMailConfiguration() : null;
    const initialStatus = sendEmail === false ? "email_not_requested" : mail ? "queued" : "email_failed";
    const payload = buildInsertPayload(submission, mail?.recipient ?? "", initialStatus);

    // Seule la requête qui a inséré le bon peut déclencher l’envoi.
    const { data, error } = await table
      .upsert(payload, { onConflict: "submission_fingerprint", ignoreDuplicates: true })
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: existing, error: readError } = await table.select("bon_number,status")
        .eq("submission_fingerprint", payload.submission_fingerprint).single();
      if (readError || !existing) throw readError ?? new Error("Submission unavailable");
      return confirmation(existing.bon_number, existing.status);
    }

    const memory = persistSubmissionMemoryFromDraft(supabase, submission).catch(() => {
      console.error("Unable to update pilot memory");
      return undefined;
    });

    let emailStatus = initialStatus;
    if (mail) {
      let update: Record<string, string | null>;
      try {
        const { buffer, fileName } = await buildBonPilotagePdf(
          { ...submission, generatedAt: documentTimestamp(payload.generated_at) },
          CURRENT_PDF_TEMPLATE,
        );
        const email = await sendBonPilotageEmail({ submission, pdfBuffer: buffer, fileName });
        emailStatus = "sent";
        update = { status: emailStatus, sent_at: new Date().toISOString(), pdf_file_name: fileName, email_provider_id: email.id };
      } catch {
        console.error("Automatic PDF generation or mail failed after submission was saved");
        emailStatus = "email_failed";
        update = { status: emailStatus, email_error: "Génération PDF ou envoi SMTP non confirmé." };
      }
      try {
        const { error: updateError } = await table.update(update).eq("id", data.id);
        if (updateError) throw updateError;
      } catch {
        console.error("Unable to update mail status for saved submission");
      }
    }

    return confirmation(submission.bonNumber, emailStatus, await memory);
  } catch {
    console.error("Unable to save or confirm bon pilotage");
    return NextResponse.json({ ok: false, message: failureMessage }, { status: 503 });
  }
}
