"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";
import { getRemboursementMessage, MVP_EXCLUSIONS } from "@/lib/remboursement";
import { PAYMENT_STATUS_META } from "@/lib/paymentStatus";

// ─── Types ───

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  prestationType: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  receiptNumber: string | null;
  receiptGeneratedAt: string | null;
  createdAt: string;
  professionnel: {
    nom: string;
    prenom: string;
    specialite: string;
  };
  calendarEvent: {
    id: string;
    date: string;
    endDate: string | null;
    title: string;
    type: string;
    description: string | null;
  } | null;
}

type Tab = "recus" | "consultations" | "paiements" | "remboursements";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "recus", label: "Recus & Factures", icon: "receipt" },
  { key: "consultations", label: "Consultations", icon: "stethoscope" },
  { key: "paiements", label: "Paiements", icon: "creditcard" },
  { key: "remboursements", label: "Remboursements", icon: "refund" },
];

// ─── Helpers ───

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function proFullName(p: Payment["professionnel"]): string {
  return `${p.prenom} ${p.nom}`.trim();
}

function getStatusMeta(status: string) {
  return (PAYMENT_STATUS_META as Record<string, { label: string; icon: string; badgeBg: string; badgeText: string }>)[status] || {
    label: status,
    icon: "",
    badgeBg: "rgba(107,114,128,0.1)",
    badgeText: "#6b7280",
  };
}

function prestationLabel(type: string | null): string {
  const map: Record<string, string> = {
    consultation_visio: "Teleconsultation",
    consultation_presentielle: "Consultation en cabinet",
    suivi_ponctuel: "Suivi ponctuel",
    pack_non_remboursable: "Pack bien-etre",
  };
  return type ? map[type] || type : "Consultation";
}

// ─── Tab Icons (inline SVGs) ───

function TabIcon({ type, size = 16 }: { type: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "receipt":
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case "stethoscope":
      return <svg {...props}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>;
    case "creditcard":
      return <svg {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case "refund":
      return <svg {...props}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>;
    case "download":
      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case "calendar":
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case "clock":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case "empty":
      return <svg {...props} width={48} height={48} strokeWidth={1.2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
    default:
      return null;
  }
}

// ─── KPI Card ───

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiValue} style={{ color }}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

// ─── Main Page ───

export default function MesRecusPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("recus");

  useEffect(() => {
    fetch("/api/athlete/payments-history")
      .then((r) => (r.ok ? r.json() : { payments: [] }))
      .then((data) => setPayments(data.payments || []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  // ─── Filtered data per tab ───

  const receipts = useMemo(() =>
    payments.filter((p) => p.receiptNumber && ["paid", "payout_pending", "payout_sent", "refund_partial"].includes(p.status)),
    [payments]
  );

  const consultations = useMemo(() =>
    payments.filter((p) => p.calendarEvent && ["paid", "payout_pending", "payout_sent", "refund_partial", "refunded"].includes(p.status)),
    [payments]
  );

  const allPayments = payments;

  const refunds = useMemo(() =>
    payments.filter((p) => p.status === "refunded" || p.status === "refund_partial"),
    [payments]
  );

  // ─── KPI stats ───

  const totalPaid = useMemo(() =>
    payments.filter((p) => ["paid", "payout_pending", "payout_sent", "refund_partial"].includes(p.status)).reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );
  const totalRefunded = useMemo(() =>
    refunds.reduce((sum, p) => sum + (p.refundAmount || 0), 0),
    [refunds]
  );

  const tabCounts: Record<Tab, number> = {
    recus: receipts.length,
    consultations: consultations.length,
    paiements: allPayments.length,
    remboursements: refunds.length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>Documents</span>
          <span className={styles.headerSub}>Recus, paiements et remboursements</span>
        </div>
      </div>

      <div className={styles.main}>
        {/* KPI Row */}
        {!loading && payments.length > 0 && (
          <div className={styles.kpiRow}>
            <KpiCard label="Total paye" value={formatPrice(totalPaid, "eur")} color="#22c55e" />
            <KpiCard label="Recus disponibles" value={String(receipts.length)} color="#f47b20" />
            <KpiCard label="Consultations" value={String(consultations.length)} color="#3b82f6" />
            {refunds.length > 0 && (
              <KpiCard label="Rembourse" value={formatPrice(totalRefunded, "eur")} color="#a855f7" />
            )}
          </div>
        )}

        {/* Tab Bar */}
        <div className={styles.tabBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              <TabIcon type={t.icon} size={15} />
              <span>{t.label}</span>
              {tabCounts[t.key] > 0 && <span className={styles.tabCount}>{tabCounts[t.key]}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} style={{ width: "80%" }} />
            <div className={styles.skeleton} style={{ width: "60%" }} />
          </div>
        ) : (
          <>
            {/* ─── Tab: Recus & Factures ─── */}
            {tab === "recus" && (
              receipts.length === 0 ? (
                <EmptyState message="Aucun recu disponible. Vos justificatifs de paiement apparaitront ici apres chaque consultation payee." />
              ) : (
                <div className={styles.list}>
                  {receipts.map((p) => (
                    <div key={p.id} className={styles.card}>
                      <div className={styles.cardIconWrap} style={{ background: "rgba(244,123,32,0.1)", color: "#f47b20" }}>
                        <TabIcon type="receipt" size={20} />
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardRow}>
                          <span className={styles.cardTitle}>{p.description || "Consultation"}</span>
                          <span className={styles.cardAmount} style={{ color: "#22c55e" }}>{formatPrice(p.amount, p.currency)}</span>
                        </div>
                        <div className={styles.cardRow}>
                          <span className={styles.cardSub}>{proFullName(p.professionnel)}</span>
                          <span className={styles.cardSub}>{p.receiptNumber}</span>
                        </div>
                        <div className={styles.cardRow}>
                          <span className={styles.cardMeta}>{p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}</span>
                          {p.calendarEvent && <span className={styles.cardMeta}>RDV {formatDateShort(p.calendarEvent.date)}</span>}
                        </div>
                        <div className={styles.cardRow}>
                          {(() => {
                            const rm = getRemboursementMessage(p.professionnel.specialite);
                            return (
                              <span className={styles.badge} style={{ color: rm.color, background: rm.bgColor }}>
                                <span className={styles.badgeIcon}>{rm.icon}</span>{rm.label}
                              </span>
                            );
                          })()}
                          <a
                            href={`/api/payments/receipt/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionBtn}
                          >
                            <TabIcon type="download" size={14} />
                            Telecharger
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ─── Tab: Consultations ─── */}
            {tab === "consultations" && (
              consultations.length === 0 ? (
                <EmptyState message="Aucune consultation enregistree. L'historique de vos consultations payees apparaitra ici." />
              ) : (
                <div className={styles.list}>
                  {consultations.map((p) => (
                    <div key={p.id} className={styles.card}>
                      <div className={styles.cardIconWrap} style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                        <TabIcon type="stethoscope" size={20} />
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardRow}>
                          <span className={styles.cardTitle}>{p.calendarEvent?.title || p.description || "Consultation"}</span>
                          <span className={styles.cardAmount} style={{ color: "#22c55e" }}>{formatPrice(p.amount, p.currency)}</span>
                        </div>
                        <div className={styles.cardRow}>
                          <span className={styles.cardSub}>{proFullName(p.professionnel)} — {prestationLabel(p.prestationType)}</span>
                        </div>
                        {p.calendarEvent && (
                          <div className={styles.cardDetailRow}>
                            <span className={styles.cardDetail}>
                              <TabIcon type="calendar" size={13} />
                              {formatDate(p.calendarEvent.date)}
                            </span>
                            <span className={styles.cardDetail}>
                              <TabIcon type="clock" size={13} />
                              {formatTime(p.calendarEvent.date)}
                              {p.calendarEvent.endDate && ` — ${formatTime(p.calendarEvent.endDate)}`}
                            </span>
                          </div>
                        )}
                        <div className={styles.cardRow}>
                          {(() => {
                            const sm = getStatusMeta(p.status);
                            return (
                              <span className={styles.badge} style={{ color: sm.badgeText, background: sm.badgeBg }}>
                                {sm.icon} {sm.label}
                              </span>
                            );
                          })()}
                          {p.receiptNumber && (
                            <a
                              href={`/api/payments/receipt/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.actionBtnSmall}
                            >
                              <TabIcon type="download" size={13} />
                              Justificatif
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ─── Tab: Paiements ─── */}
            {tab === "paiements" && (
              allPayments.length === 0 ? (
                <EmptyState message="Aucun paiement enregistre. Votre historique de paiements apparaitra ici." />
              ) : (
                <div className={styles.list}>
                  {allPayments.map((p) => {
                    const sm = getStatusMeta(p.status);
                    return (
                      <div key={p.id} className={styles.card}>
                        <div className={styles.cardIconWrap} style={{ background: sm.badgeBg, color: sm.badgeText }}>
                          <TabIcon type="creditcard" size={20} />
                        </div>
                        <div className={styles.cardBody}>
                          <div className={styles.cardRow}>
                            <span className={styles.cardTitle}>{p.description || "Consultation"}</span>
                            <span className={styles.cardAmount} style={{ color: sm.badgeText }}>{formatPrice(p.amount, p.currency)}</span>
                          </div>
                          <div className={styles.cardRow}>
                            <span className={styles.cardSub}>{proFullName(p.professionnel)}</span>
                            <span className={styles.badge} style={{ color: sm.badgeText, background: sm.badgeBg }}>
                              {sm.icon} {sm.label}
                            </span>
                          </div>
                          <div className={styles.cardRow}>
                            <span className={styles.cardMeta}>
                              {p.paidAt ? `Paye le ${formatDate(p.paidAt)}` : `Cree le ${formatDate(p.createdAt)}`}
                            </span>
                            {p.receiptNumber && <span className={styles.cardMeta}>{p.receiptNumber}</span>}
                          </div>
                          {p.refundAmount != null && p.refundAmount > 0 && (
                            <div className={styles.cardRow}>
                              <span className={styles.cardMeta} style={{ color: "#a855f7" }}>
                                Rembourse : {formatPrice(p.refundAmount, p.currency)}
                                {p.refundedAt && ` le ${formatDate(p.refundedAt)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ─── Tab: Remboursements ─── */}
            {tab === "remboursements" && (
              refunds.length === 0 ? (
                <EmptyState message="Aucun remboursement enregistre. Si un paiement est rembourse, il apparaitra ici." />
              ) : (
                <div className={styles.list}>
                  {refunds.map((p) => {
                    const isPartial = p.status === "refund_partial";
                    const refundedAmount = p.refundAmount || p.amount;
                    return (
                      <div key={p.id} className={styles.card}>
                        <div className={styles.cardIconWrap} style={{ background: isPartial ? "rgba(249,115,22,0.1)" : "rgba(168,85,247,0.1)", color: isPartial ? "#f97316" : "#a855f7" }}>
                          <TabIcon type="refund" size={20} />
                        </div>
                        <div className={styles.cardBody}>
                          <div className={styles.cardRow}>
                            <span className={styles.cardTitle}>
                              {isPartial ? "Remboursement partiel" : "Remboursement integral"}
                            </span>
                            <span className={styles.cardAmount} style={{ color: isPartial ? "#f97316" : "#a855f7" }}>
                              {formatPrice(refundedAmount, p.currency)}
                            </span>
                          </div>
                          <div className={styles.cardRow}>
                            <span className={styles.cardSub}>{p.description || "Consultation"} — {proFullName(p.professionnel)}</span>
                          </div>
                          <div className={styles.cardRow}>
                            <span className={styles.cardMeta}>
                              Montant initial : {formatPrice(p.amount, p.currency)}
                            </span>
                            <span className={styles.cardMeta}>
                              {p.refundedAt ? `Rembourse le ${formatDate(p.refundedAt)}` : "En cours"}
                            </span>
                          </div>
                          {isPartial && (
                            <div className={styles.cardRow}>
                              <span className={styles.badge} style={{ color: "#f97316", background: "rgba(249,115,22,0.1)" }}>
                                Partiel — {formatPrice(p.amount - refundedAmount, p.currency)} non rembourse
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ─── Mutuelle mention ─── */}
            <div className={styles.mention}>
              <div className={styles.mentionIcon}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div>
                <strong>A transmettre a votre organisme si applicable</strong>
                <p>
                  Ces documents (recus, justificatifs de consultation) sont destines a faciliter vos demarches
                  de remboursement aupres de votre mutuelle ou organisme complementaire. Le niveau de prise en charge
                  depend de la specialite du praticien et de votre contrat. Tuatha ne calcule pas les montants
                  de remboursement — contactez directement votre caisse d&apos;Assurance Maladie ou votre mutuelle.
                </p>
              </div>
            </div>
            <div className={styles.mentionSecondary}>
              {MVP_EXCLUSIONS.shortDisclaimer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty state component ───

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.empty}>
      <TabIcon type="empty" />
      <p>{message}</p>
    </div>
  );
}
