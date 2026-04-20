import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConfirmationEmail } from "@/lib/mailer";
import { createSession, setAuthCookies } from "@/lib/session";
import { sanitizeBody } from "@/lib/sanitize";
import { computeAccountStatus } from "@/lib/accountStatus";

export async function POST(request: NextRequest) {
  try {
    const body = sanitizeBody(await request.json());

    const {
      professionnelId,
      services,
      disponibilites,
      calendriers,
      adresseCabinet,
      latitude,
      longitude,
      placeId,
    } = body;

    if (!professionnelId) {
      return NextResponse.json(
        { error: "Identifiant professionnel manquant." },
        { status: 400 }
      );
    }

    // Verify professional exists
    const pro = await prisma.professionnel.findUnique({
      where: { id: professionnelId },
    });

    if (!pro) {
      return NextResponse.json(
        { error: "Professionnel introuvable." },
        { status: 404 }
      );
    }

    // Update address
    await prisma.professionnel.update({
      where: { id: professionnelId },
      data: {
        adresseCabinet: adresseCabinet || null,
        latitude: latitude || null,
        longitude: longitude || null,
        placeId: placeId || null,
      },
    });

    // Create services
    if (services && services.length > 0) {
      await prisma.service.createMany({
        data: services.map((s: { nom: string; personnalise: boolean }) => ({
          nom: s.nom,
          personnalise: s.personnalise,
          professionnelId,
        })),
      });
    }

    // Create disponibilites
    if (disponibilites && disponibilites.length > 0) {
      await prisma.disponibilite.createMany({
        data: disponibilites.map(
          (d: { jourDebut: string; jourFin: string; heureDebut: string; heureFin: string }) => ({
            jourDebut: d.jourDebut,
            jourFin: d.jourFin,
            heureDebut: d.heureDebut,
            heureFin: d.heureFin,
            professionnelId,
          })
        ),
      });
    }

    // Create calendar syncs
    if (calendriers && calendriers.length > 0) {
      await prisma.calendrierSync.createMany({
        data: calendriers
          .filter((c: { actif: boolean }) => c.actif)
          .map((c: { type: string; actif: boolean }) => ({
            type: c.type,
            actif: c.actif,
            professionnelId,
          })),
      });
    }

    // Recompute account status after configuration
    const updatedPro = await prisma.professionnel.findUnique({ where: { id: professionnelId } });
    if (updatedPro) {
      const newStatus = computeAccountStatus(updatedPro);
      if (newStatus !== updatedPro.accountStatus) {
        await prisma.professionnel.update({
          where: { id: professionnelId },
          data: { accountStatus: newStatus },
        });
      }
    }

    // Send confirmation email
    try {
      await sendConfirmationEmail({
        to: pro.email,
        prenom: pro.prenom,
        nom: pro.nom,
        specialite: pro.specialite,
      });
    } catch (emailError) {
      console.error("Erreur envoi email:", emailError);
    }

    const response = NextResponse.json(
      { message: "Configuration enregistrée avec succès !" },
      { status: 201 }
    );

    // Create DB-backed session
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const { accessToken, refreshToken } = await createSession(professionnelId, pro.specialite, ip, userAgent);

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (error) {
    console.error("Erreur configuration:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la configuration." },
      { status: 500 }
    );
  }
}
