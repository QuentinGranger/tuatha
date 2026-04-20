// ─── Receipt generation — Justificatif de paiement ───
// Génère un reçu HTML imprimable après paiement réussi.
// Contient : identité du pro, profession, date, montant, type de prestation,
// référence transaction, mention remboursement.

import { prisma } from "@/lib/prisma";
import { SPECIALITES } from "@/lib/specialites";
import { PRESTATION_TYPES, type PrestationType } from "@/lib/prestations";
import { isPaid } from "@/lib/paymentStatus";

// ─── Receipt number generation ───

/**
 * Generates a unique sequential receipt number: TUA-YYYY-NNNNNN
 */
export async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TUA-${year}-`;

  // Find the highest existing receipt number for this year
  const latest = await prisma.payment.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  let seq = 1;
  if (latest?.receiptNumber) {
    const num = parseInt(latest.receiptNumber.replace(prefix, ""), 10);
    if (!isNaN(num)) seq = num + 1;
  }

  return `${prefix}${String(seq).padStart(6, "0")}`;
}

// ─── Receipt data structure ───

export interface ReceiptData {
  receiptNumber: string;
  // Pro
  proNom: string;
  proPrenom: string;
  proSpecialite: string;
  proSpecialiteLabel: string;
  proAdresse: string | null;
  // Athlete
  athleteNom: string;
  athletePrenom: string;
  athleteEmail: string;
  // Payment
  amount: number; // in cents
  currency: string;
  paidAt: Date;
  description: string;
  prestationType: string | null;
  prestationTypeLabel: string | null;
  stripePaymentIntentId: string | null;
  // Event
  eventDate: Date | null;
  eventTitle: string | null;
}

/**
 * Fetches all data needed to generate a receipt from a Payment ID.
 */
export async function getReceiptData(paymentId: string): Promise<ReceiptData | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      professionnel: {
        select: {
          nom: true,
          prenom: true,
          specialite: true,
          adresseCabinet: true,
          professionAffichee: true,
        },
      },
      athleteUser: {
        select: { nom: true, prenom: true, email: true },
      },
      calendarEvent: {
        select: { date: true, title: true },
      },
    },
  });

  if (!payment || !isPaid(payment.status) || !payment.receiptNumber) return null;

  const specInfo = SPECIALITES[payment.professionnel.specialite as keyof typeof SPECIALITES];
  const prestLabel = payment.prestationType
    ? PRESTATION_TYPES[payment.prestationType as PrestationType]?.label || payment.prestationType
    : null;

  return {
    receiptNumber: payment.receiptNumber,
    proNom: payment.professionnel.nom,
    proPrenom: payment.professionnel.prenom,
    proSpecialite: payment.professionnel.specialite,
    proSpecialiteLabel: payment.professionnel.professionAffichee || specInfo?.label || payment.professionnel.specialite,
    proAdresse: payment.professionnel.adresseCabinet,
    athleteNom: payment.athleteUser.nom,
    athletePrenom: payment.athleteUser.prenom,
    athleteEmail: payment.athleteUser.email,
    amount: payment.amount,
    currency: payment.currency,
    paidAt: payment.paidAt || payment.updatedAt,
    description: payment.description || "Prestation",
    prestationType: payment.prestationType,
    prestationTypeLabel: prestLabel,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    eventDate: payment.calendarEvent?.date || null,
    eventTitle: payment.calendarEvent?.title || null,
  };
}

// ─── Format helpers ───

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── HTML receipt generation ───

/**
 * Generates a print-ready HTML receipt document.
 * Can be returned as an HTML response or converted to PDF.
 */
export function generateReceiptHtml(data: ReceiptData): string {
  const rows = [
    { label: "Professionnel", value: `${data.proPrenom} ${data.proNom}` },
    { label: "Profession", value: data.proSpecialiteLabel },
    ...(data.proAdresse ? [{ label: "Adresse", value: data.proAdresse }] : []),
    { label: "Bénéficiaire", value: `${data.athletePrenom} ${data.athleteNom}` },
    { label: "Prestation", value: data.description },
    ...(data.prestationTypeLabel ? [{ label: "Type de prestation", value: data.prestationTypeLabel }] : []),
    ...(data.eventDate ? [{ label: "Date du rendez-vous", value: formatDateTime(data.eventDate) }] : []),
    { label: "Montant payé", value: `<strong>${formatPrice(data.amount, data.currency)}</strong>` },
    { label: "Date de paiement", value: formatDate(data.paidAt) },
    { label: "Référence", value: data.receiptNumber },
    ...(data.stripePaymentIntentId ? [{ label: "Réf. transaction", value: data.stripePaymentIntentId }] : []),
  ];

  const tableRows = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 16px;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${r.label}</td>
          <td style="padding:10px 16px;color:#111827;font-size:14px;text-align:right;">${r.value}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu ${data.receiptNumber} — Tuatha</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f9fafb;
      color: #111827;
    }
    .receipt {
      max-width: 640px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #e8772e, #d4621a);
      padding: 32px 40px;
      text-align: center;
    }
    .header h1 { margin: 0; color: #fff; font-size: 24px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
    .body { padding: 32px 40px; }
    .badge {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 20px;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; }
    tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }
    .mention {
      margin-top: 28px;
      padding: 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      padding: 20px 40px;
      border-top: 1px solid #f3f4f6;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
    .print-btn {
      display: block;
      margin: 24px auto 0;
      padding: 12px 32px;
      background: #e8772e;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover { background: #d4621a; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Tuatha</h1>
      <p>Justificatif de paiement</p>
    </div>
    <div class="body">
      <div style="text-align:center;">
        <span class="badge">&#10003; Paiement confirmé</span>
      </div>
      <table>${tableRows}</table>
      <div class="mention">
        <strong>Information :</strong> Ce document est un justificatif de paiement destiné à faciliter vos démarches de remboursement auprès de votre mutuelle ou organisme complémentaire, si applicable. Il ne constitue pas une facture au sens comptable du terme. Pour toute demande de facture, veuillez contacter directement le professionnel.
      </div>
    </div>
    <div class="footer">
      Tuatha SAS — Plateforme de suivi interprofessionnel<br>
      Document généré le ${formatDate(new Date())} — Réf. ${data.receiptNumber}
    </div>
  </div>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / Télécharger en PDF</button>
</body>
</html>`;
}

// ─── Email HTML (inline version for email body) ───

export function generateReceiptEmailHtml(data: ReceiptData, downloadUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Votre reçu Tuatha</title></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#e8772e,#d4621a);padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Tuatha</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Justificatif de paiement</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="display:inline-block;background:rgba(5,150,105,0.15);color:#34d399;font-size:14px;font-weight:600;padding:8px 20px;border-radius:20px;">&#10003; Paiement confirmé</span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
            <tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;">Professionnel</td>
              <td style="padding:14px 20px;color:#fff;font-size:13px;text-align:right;">${data.proPrenom} ${data.proNom}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Profession</td>
              <td style="padding:14px 20px;color:#e8772e;font-size:13px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${data.proSpecialiteLabel}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Prestation</td>
              <td style="padding:14px 20px;color:#fff;font-size:13px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${data.description}${data.prestationTypeLabel ? ` (${data.prestationTypeLabel})` : ""}</td>
            </tr>
            ${data.eventDate ? `<tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Date du RDV</td>
              <td style="padding:14px 20px;color:#fff;font-size:13px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${formatDateTime(data.eventDate)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Montant payé</td>
              <td style="padding:14px 20px;color:#34d399;font-size:16px;font-weight:700;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${formatPrice(data.amount, data.currency)}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.5);font-size:13px;border-top:1px solid rgba(255,255,255,0.06);">Référence</td>
              <td style="padding:14px 20px;color:rgba(255,255,255,0.7);font-size:13px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${data.receiptNumber}</td>
            </tr>
          </table>
          <!-- Mention remboursement -->
          <div style="margin-top:20px;padding:14px 16px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:10px;">
            <p style="margin:0;color:rgba(255,255,255,0.6);font-size:12px;line-height:1.6;">
              <strong style="color:rgba(255,255,255,0.8);">Information :</strong> Ce document est destiné à faciliter vos démarches de remboursement auprès de votre mutuelle ou organisme complémentaire, si applicable.
            </p>
          </div>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
            <tr><td align="center">
              <a href="${downloadUrl}" style="display:inline-block;background:#e8772e;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
                Télécharger mon reçu
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.3);font-size:11px;">Tuatha SAS — Plateforme de suivi interprofessionnel</p>
          <p style="margin:0;color:rgba(255,255,255,0.15);font-size:10px;">Réf. ${data.receiptNumber} — ${formatDate(data.paidAt)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
