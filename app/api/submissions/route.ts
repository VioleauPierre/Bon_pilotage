import { sendBonPilotageEmail } from "@/lib/email";
import { createEmptySubmissionMemory } from "@/lib/form-memory";
import { formatDateLabel, sanitizeFilePart } from "@/lib/format";
import { renderPdfFromHtml } from "@/lib/pdf";
import { renderBonPilotageHtml } from "@/lib/render-bon-pilotage-html";
import { parseSubmission, type ParsedSubmission } from "@/lib/submission";
import { persistSubmissionMemoryFromDraft } from "@/lib/submission-memory-store";
import { getBonPilotageTableName, getSupabaseAdminClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function friendlyServerError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Une erreur inattendue est survenue.";

  if (message.startsWith("Impossible d'envoyer le bon.")) {
    return message;
  }

  return `Impossible d'envoyer le bon. ${message}`;
}

function buildInsertPayload(submission: ParsedSubmission, recipientEmail: string) {
  return {
    status: "queued",
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

async function insertSubmission(
  supabase: SupabaseClient,
  table: string,
  submission: ParsedSubmission,
  recipientEmail: string,
) {
  const insertPayload = buildInsertPayload(submission, recipientEmail);

  const insertResult = await supabase
    .from(table)
    .insert(insertPayload)
    .select("id")
    .single();

  if (!insertResult.error) {
    return insertResult.data?.id as string | null;
  }

  if (!/pilot_names|end_date|end_time/i.test(insertResult.error.message)) {
    throw new Error(insertResult.error.message);
  }

  const legacyInsertPayload = {
    status: insertPayload.status,
    bon_number: insertPayload.bon_number,
    pilot_name: insertPayload.pilot_name,
    transporter: insertPayload.transporter,
    vehicle_registration: insertPayload.vehicle_registration,
    convoy_category: insertPayload.convoy_category,
    decree_number: insertPayload.decree_number,
    driver_name: insertPayload.driver_name,
    driver_signature: insertPayload.driver_signature,
    pickup_date: insertPayload.pickup_date,
    pickup_time: insertPayload.pickup_time,
    departure_city: insertPayload.departure_city,
    arrival_city: insertPayload.arrival_city,
    total_km: insertPayload.total_km,
    observations: insertPayload.observations,
    recipient_email: insertPayload.recipient_email,
    itinerary: insertPayload.itinerary,
  };

  const legacyResult = await supabase
    .from(table)
    .insert(legacyInsertPayload)
    .select("id")
    .single();

  if (legacyResult.error) {
    throw new Error(legacyResult.error.message);
  }

  return legacyResult.data?.id as string | null;
}

async function markSubmissionSent(
  supabase: SupabaseClient,
  table: string,
  insertedId: string | null,
  fileName: string,
  emailProviderId: string | null,
) {
  if (!insertedId) {
    return;
  }

  const { error } = await supabase
    .from(table)
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      pdf_file_name: fileName,
      email_provider_id: emailProviderId,
    })
    .eq("id", insertedId);

  if (error) {
    console.error("Unable to mark submission as sent", error);
  }
}

export async function POST(request: Request) {
  let supabase: SupabaseClient | null = null;
  let table = getBonPilotageTableName();
  let insertedId: string | null = null;

  try {
    const body = await request.json();
    const parsed = parseSubmission(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: friendlyServerError(new Error(parsed.message)) },
        { status: 400 },
      );
    }

    if (parsed.data.website) {
      return NextResponse.json({ ok: true, message: "Soumission reçue." });
    }

    const recipientEmail = process.env.NOTIFICATION_EMAIL;

    if (!recipientEmail) {
      throw new Error("Variable d'environnement manquante: NOTIFICATION_EMAIL");
    }

    try {
      supabase = getSupabaseAdminClient();
      insertedId = await insertSubmission(
        supabase,
        table,
        parsed.data,
        recipientEmail,
      );
    } catch (error) {
      console.error("Unable to persist bon pilotage before email", error);
    }

    const documentData = {
      ...parsed.data,
      generatedAt: new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
    };

    const pdfBuffer = await renderPdfFromHtml(
      renderBonPilotageHtml(documentData),
    );
    const fileName = `${sanitizeFilePart(parsed.data.bonNumber)}.pdf`;
    const emailResult = await sendBonPilotageEmail({
      submission: parsed.data,
      pdfBuffer,
      fileName,
    });

    if (supabase) {
      await markSubmissionSent(
        supabase,
        table,
        insertedId,
        fileName,
        emailResult?.id ?? null,
      );
    }

    let memory = createEmptySubmissionMemory();
    if (supabase) {
      try {
        memory = await persistSubmissionMemoryFromDraft(supabase, parsed.data);
      } catch (error) {
        console.error("Unable to persist bon pilotage memory", error);
      }
    }

    return NextResponse.json({
      ok: true,
      bonNumber: parsed.data.bonNumber,
      memory,
      message: `Bon ${parsed.data.bonNumber} généré le ${formatDateLabel(
        parsed.data.pickupDate,
      )}.`,
      warning: insertedId ? undefined : "Bon envoyé, mais non enregistré en base Supabase.",
    });
  } catch (error) {
    if (insertedId) {
      try {
        const fallbackSupabase = supabase ?? getSupabaseAdminClient();
        await fallbackSupabase
          .from(table)
          .update({
            status: "email_failed",
            email_error:
              error instanceof Error
                ? error.message
                : "Erreur inconnue pendant l'envoi.",
          })
          .eq("id", insertedId);
      } catch {
        // Ignore secondary persistence failures so the API can return the root error.
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: friendlyServerError(error),
      },
      { status: 500 },
    );
  }
}
