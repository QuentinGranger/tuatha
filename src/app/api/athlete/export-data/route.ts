import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { logAthleteAccess } from "@/lib/athleteAccessLog";

export const dynamic = "force-dynamic";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function GET() {
  try {
    const athlete = await getSessionAthlete();
    if (!athlete) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const au = await (prisma as any).athleteUser.findUnique({
      where: { id: athlete.id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        sport: true,
        dateNaissance: true,
        taille: true,
        poids: true,
        objectif: true,
        antecedents: true,
        traitements: true,
        contreIndications: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!au) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });

    const connections = await safe(() => (prisma as any).connectionRequest.findMany({
      where: { athleteUserId: athlete.id, status: "accepted" },
      select: {
        createdAt: true,
        respondedAt: true,
        professionnel: { select: { nom: true, prenom: true, specialite: true } },
      },
    }), []);

    const privacySettings = await safe(() => (prisma as any).athletePrivacySettings.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        shareSport: true, sharePhysical: true, shareAntecedents: true,
        shareTraitements: true, shareContraindic: true, shareVitals: true,
        shareConsultPrep: true, sharePhoto: true, shareMessaging: true,
        professionnel: { select: { nom: true, prenom: true, specialite: true } },
      },
    }), []);

    const messages = await safe(() => (prisma as any).athleteProMessage.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        content: true, senderType: true, createdAt: true,
        professionnel: { select: { nom: true, prenom: true, specialite: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }), []);

    const calendarEvents = await safe(() => (prisma as any).calendarEvent.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        title: true, date: true, endDate: true, type: true, description: true,
        professionnel: { select: { nom: true, prenom: true, specialite: true } },
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: 200,
    }), []);

    const consultationPreps = await safe(() => (prisma as any).consultationPrep.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        motifDetail: true, symptoms: true, painLevel: true, fatigueLevel: true,
        evolution: true, completedAt: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }), []);

    const accessLogs = await safe(() => (prisma as any).proAccessLog.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        action: true, resource: true, blocked: true, createdAt: true,
        professionnel: { select: { nom: true, prenom: true, specialite: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }), []);

    // ── Données manquantes pour Art.20 ──

    const healthConnections = await safe(() => (prisma as any).healthAppConnection.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        provider: true, status: true, scopes: true,
        lastSyncAt: true, createdAt: true,
      },
    }), []);

    const healthData = await safe(() => (prisma as any).healthDataPoint.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        category: true, value: true, unit: true, date: true,
        metadata: true, createdAt: true,
        connection: { select: { provider: true } },
      },
      orderBy: { date: "desc" },
      take: 2000,
    }), []);

    const documents = await safe(() => (prisma as any).athleteDocument.findMany({
      where: { athleteUserId: athlete.id, deletedAt: null },
      select: {
        originalName: true, mimeType: true, size: true, category: true,
        note: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }), []);

    const nutriDayLogs = await safe(() => (prisma as any).nutriDayLog.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        date: true, notes: true, createdAt: true,
      },
      orderBy: { date: "desc" },
      take: 500,
    }), []);

    const athleteAccessLogs = await safe(() => (prisma as any).athleteAccessLog.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        action: true, resource: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }), []);

    const dataAccessRequests = await safe(() => (prisma as any).dataAccessRequest.findMany({
      where: { athleteUserId: athlete.id },
      select: {
        type: true, status: true, createdAt: true, resolvedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }), []);

    const exportData = {
      exportDate: new Date().toISOString(),
      profil: {
        nom: au.nom,
        prenom: au.prenom,
        email: au.email,
        telephone: au.telephone,
        sport: au.sport,
        dateNaissance: au.dateNaissance,
        taille: au.taille,
        poids: au.poids,
        objectif: au.objectif,
        antecedents: au.antecedents,
        traitements: au.traitements,
        contreIndications: au.contreIndications,
        inscritLe: au.createdAt,
        derniereMiseAJour: au.updatedAt,
      },
      connexions: connections.map((c: any) => ({
        professionnel: `${c.professionnel.prenom} ${c.professionnel.nom}`,
        specialite: c.professionnel.specialite,
        connecteLe: c.respondedAt || c.createdAt,
      })),
      parametresConfidentialite: privacySettings.map((ps: any) => ({
        professionnel: `${ps.professionnel.prenom} ${ps.professionnel.nom}`,
        specialite: ps.professionnel.specialite,
        partages: {
          sport: ps.shareSport,
          donneesPhysiques: ps.sharePhysical,
          antecedents: ps.shareAntecedents,
          traitements: ps.shareTraitements,
          contreIndications: ps.shareContraindic,
          constantesVitales: ps.shareVitals,
          preparationConsultation: ps.shareConsultPrep,
          photo: ps.sharePhoto,
          messagerie: ps.shareMessaging,
        },
      })),
      messages: messages.map((m: any) => ({
        de: m.senderType === "athlete" ? "Moi" : `${m.professionnel.prenom} ${m.professionnel.nom}`,
        contenu: m.content,
        date: m.createdAt,
      })),
      rendezVous: calendarEvents.map((ev: any) => ({
        titre: ev.title,
        date: ev.date,
        dateFin: ev.endDate,
        type: ev.type,
        description: ev.description,
        professionnel: `${ev.professionnel.prenom} ${ev.professionnel.nom}`,
        specialite: ev.professionnel.specialite,
      })),
      preparationsConsultation: consultationPreps.map((cp: any) => ({
        motif: cp.motifDetail,
        symptomes: cp.symptoms,
        niveauDouleur: cp.painLevel,
        niveauFatigue: cp.fatigueLevel,
        evolution: cp.evolution,
        completeLe: cp.completedAt,
        date: cp.createdAt,
      })),
      historiqueAccesPro: accessLogs.map((l: any) => ({
        professionnel: `${l.professionnel.prenom} ${l.professionnel.nom}`,
        specialite: l.professionnel.specialite,
        action: l.action,
        ressource: l.resource,
        bloque: l.blocked,
        date: l.createdAt,
      })),
      appareilsConnectes: healthConnections.map((hc: any) => ({
        fournisseur: hc.provider,
        statut: hc.status,
        scopes: hc.scopes,
        derniereSynchro: hc.lastSyncAt,
        connecteLe: hc.createdAt,
      })),
      donneesSante: healthData.map((dp: any) => ({
        categorie: dp.category,
        valeur: dp.value,
        unite: dp.unit,
        date: dp.date,
        fournisseur: dp.connection?.provider,
        metadata: dp.metadata,
      })),
      documents: documents.map((d: any) => ({
        nomOriginal: d.originalName,
        type: d.mimeType,
        taille: d.size,
        categorie: d.category,
        note: d.note,
        date: d.createdAt,
      })),
      journauxNutrition: nutriDayLogs.map((n: any) => ({
        date: n.date,
        notes: n.notes,
        cree: n.createdAt,
      })),
      historiqueAccesAthlete: athleteAccessLogs.map((l: any) => ({
        action: l.action,
        ressource: l.resource,
        date: l.createdAt,
      })),
      demandesAcces: dataAccessRequests.map((d: any) => ({
        type: d.type,
        statut: d.status,
        demandeLe: d.createdAt,
        resoluLe: d.resolvedAt,
      })),
    };

    // Log this export action
    logAthleteAccess(athlete.id, "export_data").catch(() => {});

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mes-donnees-tuatha-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    console.error("[export-data] error:", err);
    return NextResponse.json({ error: "Erreur lors de l'export" }, { status: 500 });
  }
}
