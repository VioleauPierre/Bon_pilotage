import { sendBonPilotageEmail } from "@/lib/email";
import { formatDateLabel, sanitizeFilePart } from "@/lib/format";
import { renderPdfFromHtml } from "@/lib/pdf";
import { renderBonPilotageHtml } from "@/lib/render-bon-pilotage-html";
import { parseSubmission } from "@/lib/submission";
import { persistSubmissionMemoryFromDraft } from "@/lib/submission-memory-store";
import { getBonPilotageTableName, getSupabaseAdminClient } from "@/lib/supabase";
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

export async function POST(request: Request) {
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

    const supabase = getSupabaseAdminClient();
    const table = getBonPilotageTableName();
    const recipientEmail = process.env.NOTIFICATION_EMAIL;

    if (!recipientEmail) {
      throw new Error("Variable d'environnement manquante: NOTIFICATION_EMAIL");
    }

    const insertPayload = {
      status: "queued",
      bon_number: parsed.data.bonNumber,
      pilot_name: parsed.data.pilotName,
      pilot_names: parsed.data.pilotNames,
      transporter: parsed.data.transporter,
      vehicle_registration: parsed.data.vehicleRegistration,
      convoy_category: parsed.data.convoyCategory,
      decree_number: parsed.data.decreeNumber,
      driver_name: parsed.data.driverName,
      driver_signature: parsed.data.driverSignature,
      pickup_date: parsed.data.pickupDate,
      pickup_time: parsed.data.pickupTime,
      end_date: parsed.data.endDate,
      end_time: parsed.data.endTime,
      departure_city: parsed.data.departureCity,
      arrival_city: parsed.data.arrivalCity,
      total_km: parsed.data.totalKm,
      observations: parsed.data.observations,
      recipient_email: recipientEmail,
      itinerary: parsed.data.itinerary,
    };

    let { data: insertedRow, error: insertError } = await supabase
      .from(table)
      .insert(insertPayload)
      .select("id")
      .single();

    if (
      insertError &&
      /pilot_names|end_date|end_time/i.test(insertError.message)
    ) {
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

      insertedRow = legacyResult.data;
      insertError = legacyResult.error;
    }

    if (insertError) {
      throw new Error(insertError.message);
    }

    if (!insertedRow) {
      throw new Error("La soumission n'a pas été enregistrée.");
    }

    insertedId = insertedRow.id;

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

    const { error: updateError } = await supabase
      .from(table)
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        pdf_file_name: fileName,
        email_provider_id: emailResult?.id ?? null,
      })
      .eq("id", insertedId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const memory = await persistSubmissionMemoryFromDraft(supabase, parsed.data);

    return NextResponse.json({
      ok: true,
      bonNumber: parsed.data.bonNumber,
      memory,
      message: `Bon ${parsed.data.bonNumber} généré le ${formatDateLabel(
        parsed.data.pickupDate,
      )}.`,
    });
  } catch (error) {
    if (insertedId) {
      try {
        const supabase = getSupabaseAdminClient();
        await supabase
          .from(getBonPilotageTableName())
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
