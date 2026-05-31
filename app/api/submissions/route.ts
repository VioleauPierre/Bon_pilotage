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

export async function POST(request: Request) {
  let insertedId: string | null = null;

  try {
    const body = await request.json();
    const parsed = parseSubmission(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.message },
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
      transporter: parsed.data.transporter,
      vehicle_registration: parsed.data.vehicleRegistration,
      convoy_category: parsed.data.convoyCategory,
      decree_number: parsed.data.decreeNumber,
      driver_name: parsed.data.driverName,
      driver_signature: parsed.data.driverSignature,
      pickup_date: parsed.data.pickupDate,
      pickup_time: parsed.data.pickupTime,
      departure_city: parsed.data.departureCity,
      arrival_city: parsed.data.arrivalCity,
      total_km: parsed.data.totalKm,
      observations: parsed.data.observations,
      recipient_email: recipientEmail,
      itinerary: parsed.data.itinerary,
    };

    const { data: insertedRow, error: insertError } = await supabase
      .from(table)
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
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
        message:
          error instanceof Error
            ? error.message
            : "Une erreur inattendue est survenue.",
      },
      { status: 500 },
    );
  }
}
