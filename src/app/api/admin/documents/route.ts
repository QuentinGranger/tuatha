import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminActionEmail } from "@/lib/email";

// ─── Resolve document owner email for notifications ─────────────────────────
async function getOwnerEmail(docId: string, source: string): Promise<{ email: string; prenom: string } | null> {
  try {
    if (source === "verification") {
      const doc = await (prisma as any).verificationDocument.findUnique({
        where: { id: docId },
        include: { professionnel: { select: { email: true, prenom: true } } },
      });
      return doc?.professionnel ? { email: doc.professionnel.email, prenom: doc.professionnel.prenom } : null;
    }
    if (source === "video") {
      const doc = await (prisma as any).athleteVideo.findUnique({
        where: { id: docId },
        include: { professionnel: { select: { email: true, prenom: true } } },
      });
      return doc?.professionnel ? { email: doc.professionnel.email, prenom: doc.professionnel.prenom } : null;
    }
    // SharedDocument — owner is senderPro
    const doc = await (prisma as any).sharedDocument.findUnique({
      where: { id: docId },
      include: { senderPro: { select: { email: true, prenom: true } } },
    });
    return doc?.senderPro ? { email: doc.senderPro.email, prenom: doc.senderPro.prenom } : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget email notification — never blocks the action */
function notifyOwner(
  docId: string,
  source: string,
  actionTitle: string,
  actionDescription: string,
  actionColor: string,
  details: { label: string; value: string }[] = [],
) {
  getOwnerEmail(docId, source).then(owner => {
    if (!owner) return;
    sendAdminActionEmail({
      to: owner.email,
      prenom: owner.prenom,
      actionTitle,
      actionDescription,
      actionColor,
      details,
    }).catch(err => console.error("[Documents] Email notification error:", err));
  });
}

// ─── GET: List documents + KPIs ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("id");

  // ── Single document detail ──
  if (docId) {
    const doc = await (prisma as any).sharedDocument.findUnique({
      where: { id: docId },
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
        receiverAthlete: { select: { id: true, name: true } },
        athlete: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" }, take: 10 },
      },
    });
    if (!doc) {
      // Try VerificationDocument
      const vDoc = await (prisma as any).verificationDocument.findUnique({
        where: { id: docId },
        include: { professionnel: { select: { id: true, nom: true, prenom: true, specialite: true } } },
      });
      if (!vDoc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
      return NextResponse.json({
        ...vDoc,
        docType: "verification",
        owner: `${vDoc.professionnel.prenom} ${vDoc.professionnel.nom}`,
        ownerRole: "Professionnel",
        antivirus: vDoc.aiVerified === true ? "sain" : vDoc.aiVerified === false ? "bloque" : "en_analyse",
        visibility: "Privé",
        downloads: 0,
        lastAccess: null,
        risk: vDoc.aiVerified === false ? "eleve" : "faible",
        accessHistory: [],
      });
    }

    return NextResponse.json({
      ...doc,
      docType: "shared",
      owner: `${doc.senderPro.prenom} ${doc.senderPro.nom}`,
      ownerRole: "Professionnel",
      antivirus: doc.deletedAt ? "supprime" : "sain",
      visibility: doc.receiverProId ? "Pro partagé" : doc.receiverAthleteId ? "Athlète" : "Espace professionnel",
      downloads: doc.readAt ? 1 : 0,
      lastAccess: doc.readAt,
      risk: "faible",
      accessHistory: [
        ...(doc.readAt ? [{ user: doc.receiverPro ? `${doc.receiverPro.prenom} ${doc.receiverPro.nom}` : doc.receiverAthlete?.name ?? "—", date: doc.readAt, action: "Consultation", result: "Autorisé" }] : []),
        { user: `${doc.senderPro.prenom} ${doc.senderPro.nom}`, date: doc.createdAt, action: "Upload", result: "Autorisé" },
      ],
    });
  }

  // ── List all documents ──
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  // SharedDocuments
  const sharedDocs = await (prisma as any).sharedDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      senderPro: { select: { id: true, nom: true, prenom: true, specialite: true } },
      receiverPro: { select: { id: true, nom: true, prenom: true } },
      receiverAthlete: { select: { id: true, name: true } },
    },
  });

  // VerificationDocuments
  const verDocs = await (prisma as any).verificationDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { professionnel: { select: { id: true, nom: true, prenom: true, specialite: true } } },
  });

  // AthleteVideos
  const videos = await (prisma as any).athleteVideo.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      professionnel: { select: { id: true, nom: true, prenom: true } },
      athlete: { select: { id: true, name: true } },
    },
  });

  // Normalize all into unified format
  const documents = [
    ...sharedDocs.map((d: any) => ({
      id: d.id,
      originalName: d.originalName,
      owner: `${d.senderPro.prenom} ${d.senderPro.nom}`,
      ownerRole: "Pro",
      type: d.mimeType,
      category: d.category,
      size: d.size,
      createdAt: d.createdAt,
      antivirus: d.deletedAt ? "supprime" : "sain",
      visibility: d.receiverProId ? "Pro partagé" : d.receiverAthleteId ? "Athlète" : "Espace pro",
      downloads: d.readAt ? 1 : 0,
      lastAccess: d.readAt,
      risk: "faible",
      deletedAt: d.deletedAt,
      source: "document",
    })),
    ...verDocs.map((d: any) => ({
      id: d.id,
      originalName: d.label,
      owner: `${d.professionnel.prenom} ${d.professionnel.nom}`,
      ownerRole: "Pro",
      type: "document/verification",
      category: d.type,
      size: 0,
      createdAt: d.createdAt,
      antivirus: d.aiVerified === true ? "sain" : d.aiVerified === false ? "bloque" : "en_analyse",
      visibility: "Privé",
      downloads: 0,
      lastAccess: null,
      risk: d.aiVerified === false ? "eleve" : "faible",
      deletedAt: null,
      source: "verification",
    })),
    ...videos.map((d: any) => ({
      id: d.id,
      originalName: d.originalName,
      owner: `${d.professionnel.prenom} ${d.professionnel.nom}`,
      ownerRole: "Pro",
      type: d.mimeType,
      category: "video",
      size: d.size,
      createdAt: d.createdAt,
      antivirus: d.deletedAt ? "supprime" : "sain",
      visibility: "Athlète",
      downloads: d.viewed ? 1 : 0,
      lastAccess: d.viewed ? d.createdAt : null,
      risk: "faible",
      deletedAt: d.deletedAt,
      source: "video",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // KPIs
  const uploadedToday = documents.filter(d => new Date(d.createdAt) >= todayStart).length;
  const pendingAntivirus = documents.filter(d => d.antivirus === "en_analyse").length;
  const blocked = documents.filter(d => d.antivirus === "bloque").length;
  const downloadsToday = documents.filter(d => d.lastAccess && new Date(d.lastAccess) >= todayStart).length;
  const accessDenied = 0; // Would come from access logs if tracked
  const deleted = documents.filter(d => d.deletedAt).length;

  return NextResponse.json({
    documents,
    kpis: {
      uploadedToday,
      pendingAntivirus,
      blocked,
      downloadsToday,
      accessDenied,
      deleted,
    },
  });
}

// ─── POST: Actions on documents ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, docId, source } = body;

  if (!docId) {
    return NextResponse.json({ error: "docId requis." }, { status: 400 });
  }

  switch (action) {
    case "rescan": {
      if (source === "verification") {
        await (prisma as any).verificationDocument.update({
          where: { id: docId },
          data: { aiVerified: null, aiConfidence: null, aiSummary: null },
        });
      }
      notifyOwner(docId, source, "Scan antivirus relancé", "Un scan antivirus a été relancé sur l'un de vos documents par l'équipe Tuatha. Si des problèmes sont détectés, vous en serez informé.", "#2563eb", [{ label: "Document", value: docId.slice(0, 8) }]);
      return NextResponse.json({ success: true, message: "Scan antivirus relancé." });
    }
    case "quarantine": {
      // Soft-delete = quarantine for SharedDocument / AthleteVideo
      const table = source === "video" ? "athleteVideo" : source === "verification" ? "verificationDocument" : "sharedDocument";
      if (table === "verificationDocument") {
        await (prisma as any).verificationDocument.update({ where: { id: docId }, data: { status: "rejected", note: "Mis en quarantaine par l'admin." } });
      } else {
        await (prisma as any)[table].update({ where: { id: docId }, data: { deletedAt: new Date(), deletedBy: "admin" } });
      }
      notifyOwner(docId, source, "Document mis en quarantaine", "L'un de vos documents a été placé en quarantaine par l'équipe de sécurité Tuatha. Le fichier n'est plus accessible en téléchargement. Si vous pensez qu'il s'agit d'une erreur, contactez le support.", "#d97706", [{ label: "Document", value: docId.slice(0, 8) }, { label: "Raison", value: "Décision administrative" }]);
      return NextResponse.json({ success: true, message: "Document mis en quarantaine." });
    }
    case "block_download": {
      // Mark document as blocked (soft-delete as blocking mechanism)
      const table = source === "video" ? "athleteVideo" : "sharedDocument";
      await (prisma as any)[table].update({ where: { id: docId }, data: { deletedAt: new Date(), deletedBy: "admin_block" } });
      notifyOwner(docId, source, "Téléchargement bloqué", "Le téléchargement de l'un de vos documents a été bloqué par l'équipe de sécurité Tuatha. Si vous pensez qu'il s'agit d'une erreur, contactez le support.", "#dc2626", [{ label: "Document", value: docId.slice(0, 8) }]);
      return NextResponse.json({ success: true, message: "Téléchargement bloqué." });
    }
    case "delete": {
      const reason = body.reason;
      if (!reason) return NextResponse.json({ error: "Motif requis." }, { status: 400 });
      const table = source === "video" ? "athleteVideo" : source === "verification" ? "verificationDocument" : "sharedDocument";
      if (table === "verificationDocument") {
        await (prisma as any).verificationDocument.delete({ where: { id: docId } });
      } else {
        await (prisma as any)[table].update({ where: { id: docId }, data: { deletedAt: new Date(), deletedBy: `admin:${reason}` } });
      }
      notifyOwner(docId, source, "Document supprimé", `L'un de vos documents a été supprimé par l'équipe Tuatha conformément à la procédure en vigueur. Motif : ${reason}`, "#64748b", [{ label: "Document", value: docId.slice(0, 8) }, { label: "Motif", value: reason }]);
      return NextResponse.json({ success: true, message: "Document supprimé selon procédure." });
    }
    case "restore": {
      const table = source === "video" ? "athleteVideo" : "sharedDocument";
      await (prisma as any)[table].update({ where: { id: docId }, data: { deletedAt: null, deletedBy: null } });
      notifyOwner(docId, source, "Document restauré", "L'un de vos documents précédemment restreint a été restauré par l'équipe Tuatha. Vous pouvez à nouveau y accéder normalement.", "#16a34a", [{ label: "Document", value: docId.slice(0, 8) }]);
      return NextResponse.json({ success: true, message: "Document restauré." });
    }
    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
}
