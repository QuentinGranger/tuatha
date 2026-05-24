import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";
import { sendAdminActionEmail } from "@/lib/email";

async function getProInfo(proId: string) {
  return (prisma as any).professionnel.findUnique({
    where: { id: proId },
    select: { email: true, prenom: true, nom: true },
  });
}

async function notifyPro(proId: string, actionTitle: string, actionDescription: string, actionColor?: string, details?: { label: string; value: string }[]) {
  try {
    const pro = await getProInfo(proId);
    if (!pro?.email) return;
    await sendAdminActionEmail({
      to: pro.email,
      prenom: pro.prenom,
      actionTitle,
      actionDescription,
      actionColor,
      details,
    });
  } catch (e) {
    console.error("[ADMIN-PROS-ACTIONS] Email notification failed:", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  try {
    const body = await req.json();
    const { action, proId, note } = body;

    switch (action) {
      case "suspend": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "suspended" },
        });
        notifyPro(proId, "Compte suspendu", "Votre compte professionnel a été suspendu par l'équipe Tuatha. Vous n'avez plus accès à la plateforme jusqu'à nouvel ordre.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: note ?? "Décision administrative" },
        ]);
        return NextResponse.json({ success: true, message: "Professionnel suspendu." });
      }

      case "unsuspend": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "active" },
        });
        notifyPro(proId, "Suspension levée", "Votre compte professionnel a été réactivé. Vous pouvez à nouveau accéder à la plateforme normalement.", "#16a34a", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: "Suspension levée." });
      }

      case "request_revalidation": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: {
            verificationStatus: "pending",
            verifiedAt: null,
            verificationNote: note ?? "Revalidation demandée par l'admin.",
          },
        });
        notifyPro(proId, "Revalidation requise", "Une nouvelle vérification de votre dossier professionnel est requise. Veuillez vous connecter et mettre à jour vos documents si nécessaire.", "#d97706", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Note", value: note ?? "Vérification périodique" },
        ]);
        return NextResponse.json({ success: true, message: "Revalidation demandée." });
      }

      case "verify": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: {
            verificationStatus: "verified",
            verifiedAt: new Date(),
            verificationNote: note ?? null,
          },
        });
        notifyPro(proId, "Dossier vérifié", "Félicitations ! Votre dossier professionnel a été vérifié et validé par notre équipe. Votre compte est désormais pleinement actif.", "#16a34a", [
          { label: "Date de validation", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: "Professionnel vérifié." });
      }

      case "reject": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: {
            verificationStatus: "rejected",
            verificationNote: note ?? "Dossier rejeté par l'admin.",
          },
        });
        notifyPro(proId, "Dossier rejeté", "Votre dossier de vérification professionnelle a été rejeté. Veuillez vérifier vos documents et soumettre un nouveau dossier.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Motif", value: note ?? "Documents non conformes" },
        ]);
        return NextResponse.json({ success: true, message: "Dossier rejeté." });
      }

      case "block_downloads": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "admin_block" },
        });
        console.warn(`[BLOCK-DOWNLOADS] Admin blocked downloads for pro ${proId}`);
        notifyPro(proId, "Accès restreint", "Vos accès aux téléchargements ont été temporairement bloqués par l'équipe de sécurité Tuatha. Toutes vos sessions ont été déconnectées.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Action", value: "Téléchargements bloqués" },
        ]);
        return NextResponse.json({ success: true, message: "Téléchargements bloqués — sessions révoquées." });
      }

      case "open_investigation": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        // Set account to compliance_review
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "compliance_review" },
        });
        // Create a real Investigation record
        const investigation = await (prisma as any).investigation.create({
          data: {
            title: note ? `Enquête: ${note}` : `Enquête sur le professionnel`,
            description: note ?? "Ouverture d'une enquête de conformité par l'administration.",
            type: "compliance",
            severity: "high",
            openedBy: "Admin Quentin",
            assignedTo: "Admin Quentin",
            professionnelId: proId,
            dpoNotifiedAt: new Date(),
            actionsTaken: ["account_set_compliance_review", "dpo_notified", "user_notified"],
            userNotifiedAt: new Date(),
          },
        });
        // Create associated ticket
        await (prisma as any).supportTicket.create({
          data: {
            subject: `Investigation: ${investigation.title}`,
            description: `Investigation ouverte automatiquement pour le professionnel. Statut: compliance_review.`,
            category: "investigation",
            priority: "high",
            createdByRole: "system",
            professionnelId: proId,
            investigationId: investigation.id,
          },
        });
        console.warn(`[INVESTIGATION] Opened investigation ${investigation.id} for pro ${proId} — DPO notified at ${new Date().toISOString()}`);
        // Notify the pro
        notifyPro(proId, "Revue de conformité", "Votre compte fait l'objet d'une revue de conformité par notre équipe. Certaines fonctionnalités peuvent être temporairement limitées pendant cette période. Vous serez informé de l'issue de cette revue.", "#7c3aed", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Référence", value: investigation.id.slice(0, 8).toUpperCase() },
          { label: "Statut", value: "En cours de revue" },
        ]);
        return NextResponse.json({ success: true, message: "Investigation ouverte. DPO notifié. Ticket créé.", investigationId: investigation.id });
      }

      case "disconnect_all_sessions": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "admin" },
        });
        notifyPro(proId, "Sessions déconnectées", "Toutes vos sessions actives ont été révoquées par l'administrateur. Vous devrez vous reconnecter pour accéder à la plateforme.", "#d97706", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: "Toutes les sessions révoquées." });
      }

      case "update_verification_doc": {
        const { docId, status: docStatus, docNote } = body;
        if (!docId) return NextResponse.json({ error: "docId requis." }, { status: 400 });
        const doc = await (prisma as any).verificationDocument.update({
          where: { id: docId },
          data: { status: docStatus, note: docNote ?? null },
          select: { professionnelId: true, label: true },
        });
        if (doc?.professionnelId) {
          const statusLabel = docStatus === "accepted" ? "accepté" : "rejeté";
          notifyPro(doc.professionnelId, `Document ${statusLabel}`, `Votre document "${doc.label}" a été ${statusLabel} par notre équipe de vérification.`, docStatus === "accepted" ? "#16a34a" : "#dc2626", [
            { label: "Document", value: doc.label },
            { label: "Statut", value: statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1) },
            { label: "Date", value: new Date().toLocaleString("fr-FR") },
          ]);
        }
        return NextResponse.json({ success: true, message: "Document mis à jour." });
      }

      // ─── RGPD & Account management ─────────────────────────────────

      case "restrict": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: { accountStatus: "restricted" },
        });
        notifyPro(proId, "Accès restreint", "Votre compte professionnel a été placé en mode restreint par l'équipe Tuatha. Certaines fonctionnalités sont temporairement limitées.", "#d97706", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: note ?? "Mesure préventive" },
        ]);
        return NextResponse.json({ success: true, message: "Compte restreint. Email envoyé." });
      }

      case "delete_account": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        // Notify BEFORE soft-deleting (RGPD Art. 17 — droit à l'effacement)
        await notifyPro(proId, "Compte supprimé", "Votre compte professionnel a été supprimé par l'administration de Tuatha conformément à l'Art. 17 du RGPD. Vos données personnelles seront effacées dans un délai de 30 jours. Si vous pensez qu'il s'agit d'une erreur, contactez immédiatement notre DPO.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: note ?? "Décision administrative" },
          { label: "Délai d'effacement", value: "30 jours" },
        ]);
        // Revoke all sessions
        await (prisma as any).authSession.updateMany({
          where: { professionnelId: proId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "account_deleted" },
        });
        // Soft-delete
        await (prisma as any).professionnel.update({
          where: { id: proId },
          data: {
            accountStatus: "deleted",
            verificationNote: `Suppression admin: ${note ?? "Décision administrative"} — ${new Date().toISOString()}`,
          },
        });
        return NextResponse.json({ success: true, message: "Compte supprimé. Email envoyé au professionnel." });
      }

      case "revoke_all_connections": {
        if (!proId) return NextResponse.json({ error: "proId requis." }, { status: 400 });
        // Revoke all athlete connections for this pro
        const result = await (prisma as any).proConnection.updateMany({
          where: { connectedProId: proId, status: "connecte" },
          data: { status: "refuse" },
        });
        notifyPro(proId, "Connexions révoquées", `Toutes vos connexions avec des athlètes (${result.count} connexion(s)) ont été révoquées par l'administration Tuatha. Vous ne pouvez plus accéder aux données de ces patients.`, "#dc2626", [
          { label: "Connexions révoquées", value: String(result.count) },
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: `${result.count} connexion(s) révoquée(s). Email envoyé.` });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-PROS-ACTIONS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
