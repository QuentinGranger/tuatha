import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarUrl } from "@/lib/signedUrl";
import { sanitizeBody } from "@/lib/sanitize";
import { isValidConventionne, isValidOrdonnance, isValidMutuelle } from "@/lib/remboursement";
import { isValidPrestationType, isValidRemboursementLabel } from "@/lib/prestations";

export const GET = withAuth(async (_req, ctx) => {
  try {
    const session = ctx.session;
    const proId = session.id;

    const pro = await (prisma as any).professionnel.findUnique({
      where: { id: proId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        specialite: true,
        numeroVerification: true,
        avatarPath: true,
        adresseCabinet: true,
        twoFactorEnabled: true,
        verificationStatus: true,
        verifiedAt: true,
        verificationNote: true,
        accountStatus: true,
        statutExercice: true,
        professionAffichee: true,
        specialiteAffichee: true,
        conventionne: true,
        prestationRemboursableType: true,
        ordonnanceRequise: true,
        mutuelleAcceptee: true,
        remboursementNote: true,
        stripeOnboardingComplete: true,
        createdAt: true,
        services: { select: { id: true, nom: true, personnalise: true } },
        tarifs: {
          where: { active: true },
          select: { id: true, label: true, price: true, duration: true, description: true, format: true, prestationType: true, remboursementLabel: true },
          orderBy: { createdAt: "asc" as const },
        },
        disponibilites: {
          select: { id: true, jourDebut: true, jourFin: true, heureDebut: true, heureFin: true },
        },
      },
    });

    if (!pro) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const avatarUrl = signAvatarUrl(pro.avatarPath);

    return NextResponse.json({ ...pro, avatarPath: avatarUrl });
  } catch (error) {
    console.error("GET /api/profil:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });

export const PUT = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;
    const proId = session.id;

    const body = sanitizeBody(await request.json());
    const { nom, prenom, email, telephone, adresseCabinet, services, disponibilites, tarifs } = body;

    // Update professionnel fields
    const updateData: Record<string, unknown> = {};
    if (nom !== undefined) updateData.nom = nom;
    if (prenom !== undefined) updateData.prenom = prenom;
    if (email !== undefined) updateData.email = email;
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresseCabinet !== undefined) updateData.adresseCabinet = adresseCabinet;

    // Reimbursement fields
    if (body.professionAffichee !== undefined) updateData.professionAffichee = body.professionAffichee;
    if (body.specialiteAffichee !== undefined) updateData.specialiteAffichee = body.specialiteAffichee;
    if (body.conventionne !== undefined && isValidConventionne(body.conventionne)) updateData.conventionne = body.conventionne;
    if (body.prestationRemboursableType !== undefined) updateData.prestationRemboursableType = body.prestationRemboursableType;
    if (body.ordonnanceRequise !== undefined && isValidOrdonnance(body.ordonnanceRequise)) updateData.ordonnanceRequise = body.ordonnanceRequise;
    if (body.mutuelleAcceptee !== undefined && isValidMutuelle(body.mutuelleAcceptee)) updateData.mutuelleAcceptee = body.mutuelleAcceptee;
    if (body.remboursementNote !== undefined) updateData.remboursementNote = body.remboursementNote;

    // Security: detect email change and log it
    if (email !== undefined) {
      const currentPro = await prisma.professionnel.findUnique({
        where: { id: proId },
        select: { email: true },
      });
      if (currentPro && currentPro.email !== email) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
        const userAgent = request.headers.get("user-agent") || null;
        await prisma.securityAlert.create({
          data: {
            type: "email_changed",
            message: `Email modifié de ${currentPro.email} vers ${email}.`,
            ip,
            userAgent,
            professionnelId: proId,
          },
        });
      }
    }

    await prisma.professionnel.update({ where: { id: proId }, data: updateData });

    // Replace services if provided
    if (Array.isArray(services)) {
      await prisma.service.deleteMany({ where: { professionnelId: proId } });
      if (services.length > 0) {
        await prisma.service.createMany({
          data: services.map((s: { nom: string; personnalise?: boolean }) => ({
            nom: s.nom,
            personnalise: s.personnalise ?? true,
            professionnelId: proId,
          })),
        });
      }
    }

    // Replace tarifs if provided
    if (Array.isArray(tarifs)) {
      await (prisma as any).tarif.deleteMany({ where: { professionnelId: proId } });
      if (tarifs.length > 0) {
        await (prisma as any).tarif.createMany({
          data: tarifs.map((t: { label: string; price: number; duration?: number; description?: string; format?: string; prestationType?: string; remboursementLabel?: string }) => ({
            label: t.label,
            price: t.price,
            duration: t.duration ?? 30,
            description: t.description || null,
            format: t.format || null,
            prestationType: t.prestationType && isValidPrestationType(t.prestationType) ? t.prestationType : "consultation_presentielle",
            remboursementLabel: t.remboursementLabel && isValidRemboursementLabel(t.remboursementLabel) ? t.remboursementLabel : "a_verifier_patient",
            professionnelId: proId,
          })),
        });
      }
    }

    // Replace disponibilites if provided
    if (Array.isArray(disponibilites)) {
      await prisma.disponibilite.deleteMany({ where: { professionnelId: proId } });
      if (disponibilites.length > 0) {
        await prisma.disponibilite.createMany({
          data: disponibilites.map(
            (d: { jourDebut: string; jourFin: string; heureDebut: string; heureFin: string }) => ({
              jourDebut: d.jourDebut,
              jourFin: d.jourFin,
              heureDebut: d.heureDebut,
              heureFin: d.heureFin,
              professionnelId: proId,
            })
          ),
        });
      }
    }

    return NextResponse.json({ message: "Profil mis à jour" });
  } catch (error) {
    console.error("PUT /api/profil:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "profil" });
