// ─── Internal Payment Statuses ───
// Single source of truth for all payment lifecycle states.
// Maps the full journey: booking → payment → payout → refund/dispute.

export const PAYMENT_STATUSES = {
  appointment_created: "appointment_created",
  payment_pending: "payment_pending",
  paid: "paid",
  payment_failed: "payment_failed",
  refund_partial: "refund_partial",
  refunded: "refunded",
  payout_pending: "payout_pending",
  payout_sent: "payout_sent",
  dispute_open: "dispute_open",
  cancelled: "cancelled",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

// ─── Labels & metadata ───

interface StatusMeta {
  label: string;
  shortLabel: string;
  description: string;
  color: string;       // Tailwind-compatible color token
  badgeBg: string;     // badge background
  badgeText: string;   // badge text
  icon: string;        // emoji for quick display
  terminal: boolean;   // true = no further automatic transition expected
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  appointment_created: {
    label: "Rendez-vous créé",
    shortLabel: "RDV créé",
    description: "Rendez-vous confirmé, paiement non initié",
    color: "gray",
    badgeBg: "rgba(107,114,128,0.1)",
    badgeText: "#6b7280",
    icon: "📅",
    terminal: false,
  },
  payment_pending: {
    label: "Paiement en attente",
    shortLabel: "En attente",
    description: "Checkout Stripe créé, en attente du paiement",
    color: "amber",
    badgeBg: "rgba(245,158,11,0.1)",
    badgeText: "#f59e0b",
    icon: "⏳",
    terminal: false,
  },
  paid: {
    label: "Payé",
    shortLabel: "Payé",
    description: "Paiement reçu et confirmé par Stripe",
    color: "green",
    badgeBg: "rgba(34,197,94,0.1)",
    badgeText: "#22c55e",
    icon: "✅",
    terminal: false,
  },
  payment_failed: {
    label: "Paiement échoué",
    shortLabel: "Échoué",
    description: "Le paiement a été refusé ou a échoué",
    color: "red",
    badgeBg: "rgba(239,68,68,0.1)",
    badgeText: "#ef4444",
    icon: "❌",
    terminal: true,
  },
  refund_partial: {
    label: "Remboursement partiel",
    shortLabel: "Remb. partiel",
    description: "Une partie du montant a été remboursée",
    color: "orange",
    badgeBg: "rgba(249,115,22,0.1)",
    badgeText: "#f97316",
    icon: "↩️",
    terminal: false,
  },
  refunded: {
    label: "Remboursé",
    shortLabel: "Remboursé",
    description: "Intégralement remboursé",
    color: "purple",
    badgeBg: "rgba(168,85,247,0.1)",
    badgeText: "#a855f7",
    icon: "💸",
    terminal: true,
  },
  payout_pending: {
    label: "Virement en cours",
    shortLabel: "Virement…",
    description: "En attente du transfert vers le compte du professionnel",
    color: "blue",
    badgeBg: "rgba(59,130,246,0.1)",
    badgeText: "#3b82f6",
    icon: "🏦",
    terminal: false,
  },
  payout_sent: {
    label: "Virement envoyé",
    shortLabel: "Viré",
    description: "Fonds transférés sur le compte du professionnel",
    color: "emerald",
    badgeBg: "rgba(16,185,129,0.1)",
    badgeText: "#10b981",
    icon: "✔️",
    terminal: true,
  },
  dispute_open: {
    label: "Litige ouvert",
    shortLabel: "Litige",
    description: "Un litige (chargeback) a été ouvert par le client ou la banque",
    color: "rose",
    badgeBg: "rgba(244,63,94,0.1)",
    badgeText: "#f43f5e",
    icon: "⚠️",
    terminal: false,
  },
  cancelled: {
    label: "Annulé",
    shortLabel: "Annulé",
    description: "Le rendez-vous ou le paiement a été annulé",
    color: "slate",
    badgeBg: "rgba(100,116,139,0.1)",
    badgeText: "#64748b",
    icon: "🚫",
    terminal: true,
  },
};

// ─── Grouping helpers ───

/** Statuses where money has been successfully collected */
export const COLLECTED_STATUSES: PaymentStatus[] = [
  "paid",
  "payout_pending",
  "payout_sent",
  "refund_partial",
];

/** Statuses where the payment is still in-flight */
export const PENDING_STATUSES: PaymentStatus[] = [
  "appointment_created",
  "payment_pending",
];

/** Terminal negative statuses — no recovery expected */
export const TERMINAL_NEGATIVE_STATUSES: PaymentStatus[] = [
  "payment_failed",
  "refunded",
  "cancelled",
];

/** All statuses where the athlete has effectively paid (fully or partially) */
export const ATHLETE_PAID_STATUSES: PaymentStatus[] = [
  "paid",
  "payout_pending",
  "payout_sent",
  "refund_partial",
];

// ─── Guard helpers ───

export function isPaid(status: string): boolean {
  return ATHLETE_PAID_STATUSES.includes(status as PaymentStatus);
}

export function isPending(status: string): boolean {
  return PENDING_STATUSES.includes(status as PaymentStatus);
}

export function isTerminal(status: string): boolean {
  return PAYMENT_STATUS_META[status as PaymentStatus]?.terminal ?? false;
}

export function isRefunded(status: string): boolean {
  return status === "refunded" || status === "refund_partial";
}

export function isDisputed(status: string): boolean {
  return status === "dispute_open";
}

export function getStatusLabel(status: string): string {
  return PAYMENT_STATUS_META[status as PaymentStatus]?.label ?? status;
}

export function getStatusMeta(status: string): StatusMeta | null {
  return PAYMENT_STATUS_META[status as PaymentStatus] ?? null;
}

// ─── Allowed transitions (for validation) ───
// Key = current status, Value = array of allowed next statuses.

export const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  appointment_created: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "payment_failed", "cancelled"],
  paid: ["refund_partial", "refunded", "payout_pending", "dispute_open"],
  payment_failed: ["payment_pending", "cancelled"],
  refund_partial: ["refunded", "dispute_open"],
  refunded: [],
  payout_pending: ["payout_sent", "dispute_open"],
  payout_sent: ["dispute_open", "refund_partial", "refunded"],
  dispute_open: ["paid", "refunded"],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as PaymentStatus];
  if (!allowed) return false;
  return allowed.includes(to as PaymentStatus);
}

// ─── Legacy mapping ───
// Maps old status strings to new ones for backward compatibility.

export const LEGACY_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: "payment_pending",
  failed: "payment_failed",
  expired: "cancelled",
  // These are unchanged:
  paid: "paid",
  refunded: "refunded",
};

export function resolveStatus(status: string): PaymentStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as PaymentStatus);
}
