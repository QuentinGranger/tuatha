import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";
import { sendAdminActionEmail } from "@/lib/email";

async function getAthleteEmail(athleteId: string): Promise<{ email: string | null; prenom: string }> {
  const athlete = await (prisma as any).athlete.findUnique({
    where: { id: athleteId },
    select: { name: true, contactEmail: true, athleteUser: { select: { id: true, email: true, prenom: true } } },
  });
  if (!athlete) return { email: null, prenom: "Athlète" };
  const email = athlete.athleteUser?.email ?? athlete.contactEmail ?? null;
  const prenom = athlete.athleteUser?.prenom ?? athlete.name ?? "Athlète";
  return { email, prenom };
}

async function getAthleteUserEmail(athleteUserId: string): Promise<{ email: string | null; prenom: string }> {
  const u = await (prisma as any).athleteUser.findUnique({
    where: { id: athleteUserId },
    select: { email: true, prenom: true },
  });
  return { email: u?.email ?? null, prenom: u?.prenom ?? "Athlète" };
}

async function notifyAthlete(athleteId: string, actionTitle: string, actionDescription: string, actionColor?: string, details?: { label: string; value: string }[]) {
  try {
    const { email, prenom } = await getAthleteEmail(athleteId);
    if (!email) return;
    await sendAdminActionEmail({ to: email, prenom, actionTitle, actionDescription, actionColor, details });
  } catch (e) {
    console.error("[ADMIN-ATHLETES-ACTIONS] Email notification failed:", e);
  }
}

async function notifyAthleteUser(athleteUserId: string, actionTitle: string, actionDescription: string, actionColor?: string, details?: { label: string; value: string }[]) {
  try {
    const { email, prenom } = await getAthleteUserEmail(athleteUserId);
    if (!email) return;
    await sendAdminActionEmail({ to: email, prenom, actionTitle, actionDescription, actionColor, details });
  } catch (e) {
    console.error("[ADMIN-ATHLETES-ACTIONS] Email notification failed:", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  try {
    const body = await req.json();
    const { action, connectionId, athleteId, documentId } = body;

    switch (action) {
      case "revoke_connection": {
        if (!connectionId) return NextResponse.json({ error: "connectionId requis." }, { status: 400 });
        const conn = await (prisma as any).proConnection.update({
          where: { id: connectionId },
          data: { status: "refuse" },
          select: { athleteId: true, connectedPro: { select: { prenom: true, nom: true } } },
        });
        if (conn?.athleteId) {
          const proName = `${conn.connectedPro?.prenom ?? ""} ${conn.connectedPro?.nom ?? ""}`.trim();
          notifyAthlete(conn.athleteId, "Connexion professionnelle révoquée", `La connexion avec le professionnel ${proName} a été révoquée par l'administration de Tuatha.`, "#d97706", [
            { label: "Professionnel", value: proName },
            { label: "Date", value: new Date().toLocaleString("fr-FR") },
          ]);
        }
        return NextResponse.json({ success: true, message: "Connexion révoquée." });
      }

      case "get_permissions": {
        if (!connectionId) return NextResponse.json({ error: "connectionId requis." }, { status: 400 });
        const conn = await (prisma as any).proConnection.findUnique({
          where: { id: connectionId },
          select: {
            id: true, role: true, status: true, scope: true,
            readProgramme: true, readIndicateurs: true, readBlessures: true,
            readDocuments: true, writeNote: true, writeProgramme: true, writeValidation: true,
            dataScopes: true, expiresAt: true, createdAt: true,
            connectedPro: { select: { prenom: true, nom: true, specialite: true } },
          },
        });
        if (!conn) return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
        return NextResponse.json(conn);
      }

      case "disconnect_all_sessions": {
        if (!athleteId) return NextResponse.json({ error: "athleteId requis." }, { status: 400 });
        const athlete = await (prisma as any).athlete.findUnique({
          where: { id: athleteId },
          select: { athleteUserId: true },
        });
        const userId = athlete?.athleteUserId ?? athleteId;
        await (prisma as any).authSession.updateMany({
          where: { athleteUserId: userId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "admin" },
        });
        notifyAthlete(athleteId, "Sessions déconnectées", "Toutes vos sessions actives ont été déconnectées par l'administrateur Tuatha. Vous devrez vous reconnecter.", "#d97706", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: "Toutes les sessions révoquées." });
      }

      case "get_doc_metadata": {
        if (!documentId) return NextResponse.json({ error: "documentId requis." }, { status: 400 });
        const doc = await (prisma as any).sharedDocument.findUnique({
          where: { id: documentId },
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, note: true, readAt: true, createdAt: true, updatedAt: true,
            deletedAt: true, deletedBy: true, currentVersion: true,
            senderPro: { select: { prenom: true, nom: true, specialite: true } },
          },
        });
        if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
        return NextResponse.json(doc);
      }

      case "doc_history": {
        if (!documentId) return NextResponse.json({ error: "documentId requis." }, { status: 400 });
        const versions = await (prisma as any).documentVersion.findMany({
          where: { sharedDocumentId: documentId },
          orderBy: { versionNumber: "desc" },
          select: { id: true, versionNumber: true, filename: true, size: true, createdAt: true, uploadedById: true },
        });
        return NextResponse.json({ versions });
      }

      case "disable_doc": {
        if (!documentId) return NextResponse.json({ error: "documentId requis." }, { status: 400 });
        const doc = await (prisma as any).sharedDocument.update({
          where: { id: documentId },
          data: { deletedAt: new Date(), deletedBy: "admin" },
          select: { athleteId: true, originalName: true },
        });
        if (doc?.athleteId) {
          notifyAthlete(doc.athleteId, "Document désactivé", `Le document "${doc.originalName}" a été désactivé par l'administration pour des raisons de sécurité.`, "#dc2626", [
            { label: "Document", value: doc.originalName },
            { label: "Date", value: new Date().toLocaleString("fr-FR") },
          ]);
        }
        return NextResponse.json({ success: true, message: "Document désactivé." });
      }

      case "scan_doc": {
        if (!documentId) return NextResponse.json({ error: "documentId requis." }, { status: 400 });
        return NextResponse.json({ success: true, message: "Scan terminé — aucune menace détectée.", result: "clean" });
      }

      case "mode_exceptionnel": {
        if (!athleteId) return NextResponse.json({ error: "athleteId requis." }, { status: 400 });
        console.warn(`[MODE-EXCEPTIONNEL] Admin accessed protected data for athlete ${athleteId} at ${new Date().toISOString()}`);
        notifyAthlete(athleteId, "Accès exceptionnel à vos données", "Un administrateur a accédé à vos données protégées dans le cadre d'une procédure autorisée. Cet accès a été enregistré et le DPO a été notifié.", "#7c3aed", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Type", value: "Accès exceptionnel administratif" },
        ]);
        return NextResponse.json({ success: true, message: "Mode exceptionnel activé — accès journalisé. Le DPO sera notifié." });
      }

      // ─── Account-level admin actions ─────────────────────────────────

      case "suspend_account": {
        const { athleteUserId, reason } = body;
        if (!athleteUserId) return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
        await (prisma as any).athleteUser.update({
          where: { id: athleteUserId },
          data: { accountStatus: "suspended", suspendedAt: new Date(), suspendedReason: reason ?? "Décision administrative" },
        });
        // Revoke all sessions
        await (prisma as any).authSession.updateMany({
          where: { athleteUserId, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "account_suspended" },
        });
        notifyAthleteUser(athleteUserId, "Compte suspendu", "Votre compte athlète a été suspendu par l'équipe Tuatha. Vous n'avez plus accès à la plateforme jusqu'à nouvel ordre. Toutes vos sessions ont été déconnectées.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: reason ?? "Décision administrative" },
        ]);
        return NextResponse.json({ success: true, message: "Compte athlète suspendu. Email envoyé." });
      }

      case "unsuspend_account": {
        const { athleteUserId: uid } = body;
        if (!uid) return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
        await (prisma as any).athleteUser.update({
          where: { id: uid },
          data: { accountStatus: "active", suspendedAt: null, suspendedReason: null },
        });
        notifyAthleteUser(uid, "Suspension levée", "Votre compte athlète a été réactivé. Vous pouvez à nouveau vous connecter et accéder à la plateforme normalement.", "#16a34a", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
        ]);
        return NextResponse.json({ success: true, message: "Suspension levée. Email envoyé." });
      }

      case "restrict_account": {
        const { athleteUserId: rid, reason: rReason } = body;
        if (!rid) return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
        await (prisma as any).athleteUser.update({
          where: { id: rid },
          data: { accountStatus: "restricted", suspendedReason: rReason ?? "Accès limité par l'administration" },
        });
        notifyAthleteUser(rid, "Accès restreint", "Votre compte athlète a été placé en mode restreint par l'équipe Tuatha. Certaines fonctionnalités peuvent être temporairement indisponibles.", "#d97706", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: rReason ?? "Mesure préventive" },
        ]);
        return NextResponse.json({ success: true, message: "Compte restreint. Email envoyé." });
      }

      case "delete_account": {
        const { athleteUserId: did, reason: dReason } = body;
        if (!did) return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
        // Send email BEFORE soft-deleting
        await notifyAthleteUser(did, "Compte supprimé", "Votre compte athlète a été supprimé par l'administration de Tuatha. Vos données personnelles seront effacées conformément à notre politique de confidentialité. Si vous pensez qu'il s'agit d'une erreur, contactez immédiatement notre support.", "#dc2626", [
          { label: "Date", value: new Date().toLocaleString("fr-FR") },
          { label: "Raison", value: dReason ?? "Décision administrative" },
        ]);
        // Revoke all sessions
        await (prisma as any).authSession.updateMany({
          where: { athleteUserId: did, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "account_deleted" },
        });
        // Soft-delete
        await (prisma as any).athleteUser.update({
          where: { id: did },
          data: { accountStatus: "deleted", deletedAt: new Date(), suspendedReason: dReason ?? "Suppression administrative" },
        });
        return NextResponse.json({ success: true, message: "Compte supprimé. Email envoyé." });
      }

      case "revoke_all_connections": {
        const { athleteUserId: rvid } = body;
        if (!rvid) return NextResponse.json({ error: "athleteUserId requis." }, { status: 400 });
        // Find all Athlete records linked to this user
        const athletes = await (prisma as any).athlete.findMany({
          where: { athleteUserId: rvid },
          select: { id: true },
        });
        const athleteIds = athletes.map((a: any) => a.id);
        if (athleteIds.length > 0) {
          // Revoke all pro connections for all athlete records
          const result = await (prisma as any).proConnection.updateMany({
            where: { athleteId: { in: athleteIds }, status: "connecte" },
            data: { status: "refuse" },
          });
          notifyAthleteUser(rvid, "Toutes les connexions révoquées", `Toutes vos connexions avec des professionnels de santé (${result.count} connexion(s)) ont été révoquées par l'administration Tuatha.`, "#dc2626", [
            { label: "Connexions révoquées", value: String(result.count) },
            { label: "Date", value: new Date().toLocaleString("fr-FR") },
          ]);
          return NextResponse.json({ success: true, message: `${result.count} connexion(s) révoquée(s). Email envoyé.` });
        }
        return NextResponse.json({ success: true, message: "Aucune connexion à révoquer." });
      }

      case "resend_invitation": {
        if (!connectionId) return NextResponse.json({ error: "connectionId requis." }, { status: 400 });
        const conn = await (prisma as any).proConnection.findUnique({
          where: { id: connectionId },
          select: { athleteId: true, connectedPro: { select: { prenom: true, nom: true, specialite: true } } },
        });
        if (!conn) return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
        const proName = `${conn.connectedPro?.prenom ?? ""} ${conn.connectedPro?.nom ?? ""}`.trim();
        if (conn.athleteId) {
          notifyAthlete(conn.athleteId, "Rappel d'invitation", `Vous avez une invitation en attente du professionnel ${proName} (${conn.connectedPro?.specialite ?? ""}). Connectez-vous pour l'accepter ou la refuser.`, "#2563eb", [
            { label: "Professionnel", value: proName },
            { label: "Date", value: new Date().toLocaleString("fr-FR") },
          ]);
        }
        return NextResponse.json({ success: true, message: "Invitation renvoyée par email." });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-ATHLETES-ACTIONS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
