// ─── Mini-ledger financier ───
// Reconstitue chaque euro pour chaque paiement :
// montant brut, commission Tuatha, frais PSP, montant net pro,
// date paiement, date remboursement, date payout, statut final.

import { getStatusLabel, type PaymentStatus } from "@/lib/paymentStatus";

// ─── Types ───

export interface LedgerEntry {
  paymentId: string;
  // Dates
  createdAt: string;        // ISO
  paidAt: string | null;
  refundedAt: string | null;
  payoutAt: string | null;
  // Amounts (all in cents)
  grossAmount: number;      // montant brut (charged to athlete)
  platformFee: number;      // commission Tuatha
  stripeFee: number | null; // frais PSP Stripe
  netAmount: number;        // montant net pro (amount - platformFee)
  refundAmount: number | null;
  currency: string;
  // Amounts formatted (EUR)
  grossAmountFmt: string;
  platformFeeFmt: string;
  stripeFeeFmt: string;
  netAmountFmt: string;
  refundAmountFmt: string;
  // Status
  status: string;
  statusLabel: string;
  // Context
  description: string | null;
  prestationType: string | null;
  receiptNumber: string | null;
  athleteName: string | null;
  eventDate: string | null;
  eventTitle: string | null;
}

export interface LedgerSummary {
  totalGross: number;
  totalPlatformFees: number;
  totalStripeFees: number;
  totalNet: number;
  totalRefunded: number;
  totalPayouts: number;
  pendingPayouts: number;
  count: number;
  // Formatted
  totalGrossFmt: string;
  totalPlatformFeesFmt: string;
  totalStripeFeeFmt: string;
  totalNetFmt: string;
  totalRefundedFmt: string;
  totalPayoutsFmt: string;
  pendingPayoutsFmt: string;
}

// ─── Formatting ───

export function formatCents(cents: number, currency = "eur"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// ─── Build ledger entry from a Payment row ───

export function toLedgerEntry(payment: {
  id: string;
  amount: number;
  platformFee: number;
  stripeFee: number | null;
  netAmount: number | null;
  refundAmount: number | null;
  currency: string;
  status: string;
  description: string | null;
  prestationType: string | null;
  receiptNumber: string | null;
  createdAt: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
  payoutAt: Date | null;
  athleteUser?: { prenom: string; nom: string } | null;
  calendarEvent?: { date: Date; title: string | null } | null;
}): LedgerEntry {
  const net = payment.netAmount ?? (payment.amount - payment.platformFee);

  return {
    paymentId: payment.id,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null,
    payoutAt: payment.payoutAt?.toISOString() ?? null,
    grossAmount: payment.amount,
    platformFee: payment.platformFee,
    stripeFee: payment.stripeFee,
    netAmount: net,
    refundAmount: payment.refundAmount,
    currency: payment.currency,
    grossAmountFmt: formatCents(payment.amount, payment.currency),
    platformFeeFmt: formatCents(payment.platformFee, payment.currency),
    stripeFeeFmt: formatCents(payment.stripeFee ?? 0, payment.currency),
    netAmountFmt: formatCents(net, payment.currency),
    refundAmountFmt: formatCents(payment.refundAmount ?? 0, payment.currency),
    status: payment.status,
    statusLabel: getStatusLabel(payment.status),
    description: payment.description,
    prestationType: payment.prestationType,
    receiptNumber: payment.receiptNumber,
    athleteName: payment.athleteUser
      ? `${payment.athleteUser.prenom} ${payment.athleteUser.nom}`
      : null,
    eventDate: payment.calendarEvent?.date?.toISOString() ?? null,
    eventTitle: payment.calendarEvent?.title ?? null,
  };
}

// ─── Build summary from multiple entries ───

export function computeLedgerSummary(
  entries: LedgerEntry[],
  currency = "eur",
): LedgerSummary {
  let totalGross = 0;
  let totalPlatformFees = 0;
  let totalStripeFees = 0;
  let totalNet = 0;
  let totalRefunded = 0;
  let totalPayouts = 0;
  let pendingPayouts = 0;

  for (const e of entries) {
    totalGross += e.grossAmount;
    totalPlatformFees += e.platformFee;
    totalStripeFees += e.stripeFee ?? 0;
    totalNet += e.netAmount;
    totalRefunded += e.refundAmount ?? 0;

    if (e.status === "payout_sent") {
      totalPayouts += e.netAmount;
    } else if (e.status === "payout_pending" || e.status === "paid") {
      pendingPayouts += e.netAmount;
    }
  }

  return {
    totalGross,
    totalPlatformFees,
    totalStripeFees,
    totalNet,
    totalRefunded,
    totalPayouts,
    pendingPayouts,
    count: entries.length,
    totalGrossFmt: formatCents(totalGross, currency),
    totalPlatformFeesFmt: formatCents(totalPlatformFees, currency),
    totalStripeFeeFmt: formatCents(totalStripeFees, currency),
    totalNetFmt: formatCents(totalNet, currency),
    totalRefundedFmt: formatCents(totalRefunded, currency),
    totalPayoutsFmt: formatCents(totalPayouts, currency),
    pendingPayoutsFmt: formatCents(pendingPayouts, currency),
  };
}

// ─── CSV export ───

const CSV_HEADERS = [
  "ID Paiement",
  "Date création",
  "Date paiement",
  "Date remboursement",
  "Date virement",
  "Statut",
  "Patient",
  "Description",
  "Montant brut",
  "Commission Tuatha",
  "Frais Stripe",
  "Net pro",
  "Remboursé",
  "Devise",
  "N° reçu",
];

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const rows = entries.map((e) => [
    e.paymentId,
    e.createdAt,
    e.paidAt ?? "",
    e.refundedAt ?? "",
    e.payoutAt ?? "",
    e.statusLabel,
    e.athleteName ?? "",
    e.description ?? "",
    (e.grossAmount / 100).toFixed(2),
    (e.platformFee / 100).toFixed(2),
    ((e.stripeFee ?? 0) / 100).toFixed(2),
    (e.netAmount / 100).toFixed(2),
    ((e.refundAmount ?? 0) / 100).toFixed(2),
    e.currency.toUpperCase(),
    e.receiptNumber ?? "",
  ]);

  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  return [
    CSV_HEADERS.join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}
