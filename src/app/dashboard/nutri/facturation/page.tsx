"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface AthleteRef { id: string; name: string; }
interface AthleteUserRef { id: string; prenom: string; nom: string; }
interface PaymentRef { id: string; stripePaymentIntentId: string | null; receiptNumber: string | null; }
interface Invoice {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: "unpaid" | "paid" | "overdue" | "cancelled";
  source: "manual" | "stripe";
  prestationType: string | null;
  dueDate: string;
  paidDate: string | null;
  paymentMethod: string | null;
  notes: string | null;
  athleteId: string | null;
  athlete: AthleteRef | null;
  athleteUserId: string | null;
  athleteUser: AthleteUserRef | null;
  payment: PaymentRef | null;
  createdAt: string;
}
interface TopPatient { name: string; total: number; count: number; }
interface MonthlyTrend { month: string; revenue: number; count: number; }
interface CashFlowForecast { month: string; predicted: number; confidence: "high" | "medium" | "low"; }
interface AIInsight {
  category: "alert" | "trend" | "optimization" | "prediction" | "info";
  severity: "critical" | "warning" | "positive" | "neutral";
  title: string;
  message: string;
  metric?: string;
}
interface ChatMessage { role: "user" | "assistant"; content: string; }
interface PrestationStat { type: string; revenue: number; count: number; }
interface RiskScore { invoiceId: string; number: string; score: number; level: "high" | "medium" | "low"; reason: string; }
interface RelanceEmail { subject: string; body: string; patientName: string; patientEmail: string | null; invoiceNumber: string; amount: number; daysOverdue: number; }
interface MonthlySummary { title: string; highlights: string[]; warnings: string[]; recommendations: string[]; outlook: string; month: string; revenue: number; invoiceCount: number; unpaidCount: number; lastMonthRevenue: number; }
interface AIStats {
  totalInvoices: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  stripeCount: number;
  manualCount: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  totalRevenue: number;
  totalUnpaid: number;
  avgInvoiceAmount: number;
  medianAmount?: number;
  automationRate?: number;
  collectionRate?: number;
  healthScore?: number;
  yoyGrowth?: number | null;
  thisYearRevenue?: number;
  lastYearRevenue?: number;
  prestationBreakdown?: PrestationStat[];
  topPatients: TopPatient[];
  monthlyTrend: MonthlyTrend[];
  forecast?: CashFlowForecast[];
}

const CATEGORY_ICONS: Record<string, string> = {
  alert: "\u26A0\uFE0F", trend: "\uD83D\uDCC8", optimization: "\uD83D\uDCA1",
  prediction: "\uD83D\uDD2E", info: "\u2139\uFE0F",
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", warning: "#f59e0b", positive: "#22c55e", neutral: "#8b5cf6",
};
const CATEGORY_LABELS: Record<string, string> = {
  all: "Tous", alert: "Alertes", trend: "Tendances", optimization: "Optimisations",
  prediction: "Prédictions", info: "Infos",
};

function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const trimmed = line.trim();
    const isBullet = /^[-•●]\s/.test(trimmed);
    const isNumbered = /^\d+[.)\-]\s/.test(trimmed);
    const content = isBullet ? trimmed.slice(2) : isNumbered ? trimmed.replace(/^\d+[.)\-]\s/, "") : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, pi) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={pi}>{part.slice(2, -2)}</strong>;
      return <span key={pi}>{part}</span>;
    });
    if (isBullet || isNumbered) {
      return <div key={li} className={styles.mdBullet}><span className={styles.mdBulletDot}>{isNumbered ? trimmed.match(/^\d+/)?.[0] + "." : "•"}</span><span>{parts}</span></div>;
    }
    if (trimmed === "") return <div key={li} style={{ height: 6 }} />;
    return <div key={li}>{parts}</div>;
  });
}

function getHealthColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}
function getHealthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Bon";
  if (score >= 50) return "Correct";
  if (score >= 35) return "À surveiller";
  return "Critique";
}

/* ─── Component ─── */
export default function FacturationPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [athletes, setAthletes] = useState<AthleteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"all" | "unpaid" | "paid" | "stripe">("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // AI
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiForecast, setAiForecast] = useState<CashFlowForecast[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [aiTab, setAiTab] = useState<"insights" | "chat">("insights");
  const [insightFilter, setInsightFilter] = useState<string>("all");

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // AI Actions
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [relanceModal, setRelanceModal] = useState<{ invoiceId: string; invoice: Invoice } | null>(null);
  const [relanceEmail, setRelanceEmail] = useState<RelanceEmail | null>(null);
  const [relanceLoading, setRelanceLoading] = useState(false);
  const [relanceTone, setRelanceTone] = useState<"professional" | "friendly" | "firm">("professional");
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [descSuggestions, setDescSuggestions] = useState<string[]>([]);
  const [descLoading, setDescLoading] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<number>>(new Set());

  // Form state
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDue, setFormDue] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAthlete, setFormAthlete] = useState("");

  // Fetch invoices
  const fetchInvoices = useCallback(() => {
    fetch("/api/facturation")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInvoices(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch AI insights
  const fetchAiInsights = useCallback(() => {
    setAiLoading(true);
    fetch("/api/facturation/ai-insights")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setAiStats(d.stats);
        if (d.insights) setAiInsights(d.insights);
        if (d.forecast) setAiForecast(d.forecast);
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, []);

  // AI Actions
  const fetchRiskScores = useCallback(async () => {
    setRiskLoading(true);
    try {
      const res = await fetch("/api/facturation/ai-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "risk-scores" }),
      });
      const data = await res.json();
      if (data.riskScores) setRiskScores(data.riskScores);
    } catch {} finally { setRiskLoading(false); }
  }, []);

  const generateRelance = useCallback(async (invoiceId: string, tone: string) => {
    setRelanceLoading(true);
    setRelanceEmail(null);
    try {
      const res = await fetch("/api/facturation/ai-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-relance", invoiceId, tone }),
      });
      const data = await res.json();
      if (data.email) setRelanceEmail(data.email);
      else showToast("Erreur de génération", "error");
    } catch { showToast("Erreur réseau", "error"); } finally { setRelanceLoading(false); }
  }, [showToast]);

  const fetchMonthlySummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/facturation/ai-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "monthly-summary" }),
      });
      const data = await res.json();
      if (data.summary) { setMonthlySummary(data.summary); setSummaryOpen(true); }
    } catch {} finally { setSummaryLoading(false); }
  }, []);

  const fetchDescSuggestions = useCallback(async (patientName: string, amount: string) => {
    setDescLoading(true);
    try {
      const res = await fetch("/api/facturation/ai-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "smart-description", patientName, amount }),
      });
      const data = await res.json();
      if (data.suggestions) setDescSuggestions(data.suggestions);
    } catch {} finally { setDescLoading(false); }
  }, []);

  const toggleInsightExpand = (idx: number) => {
    setExpandedInsights((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const getRiskForInvoice = (invoiceId: string): RiskScore | undefined => riskScores.find((r) => r.invoiceId === invoiceId);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Send chat message (streaming SSE)
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);
    // Add placeholder assistant message
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/facturation/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: newHistory, stream: true }),
      });
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const payload = line.slice(6);
                if (payload === "[DONE]") break;
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.content) {
                    accumulated += parsed.content;
                    const snap = accumulated;
                    setChatMessages((prev) => {
                      const copy = [...prev];
                      copy[copy.length - 1] = { role: "assistant", content: snap };
                      return copy;
                    });
                  }
                } catch {}
              }
            }
          }
        }
        if (!accumulated) {
          setChatMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: "Désolé, je n'ai pas pu répondre." };
            return copy;
          });
        }
      } else {
        const data = await res.json();
        setChatMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: data.reply || data.error || "Erreur" };
          return copy;
        });
      }
    } catch {
      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Erreur de connexion." };
        return copy;
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Dynamic suggestions based on actual data
  const chatSuggestions = (() => {
    const base = [
      "Résume ma situation financière",
      "Comment optimiser ma facturation ?",
    ];
    if (aiStats && aiStats.overdueCount > 0) base.unshift("Quels patients dois-je relancer en priorité ?");
    if (aiStats && aiStats.thisMonthRevenue > 0) base.push(`Analyse mon CA de ce mois (${aiStats.thisMonthRevenue.toFixed(0)}€)`);
    if (aiStats && aiStats.yoyGrowth !== null && aiStats.yoyGrowth !== undefined) base.push("Compare mon activité avec l'année dernière");
    return base.slice(0, 4);
  })();

  // Fetch athletes for the dropdown
  useEffect(() => {
    fetch("/api/athletes")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAthletes(d.map((a: any) => ({ id: a.id, name: a.name }))); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchInvoices(); fetchAiInsights(); fetchRiskScores(); }, [fetchInvoices, fetchAiInsights, fetchRiskScores]);

  // Copy chat message
  const copyMessage = (idx: number) => {
    const msg = chatMessages[idx];
    if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  // CSV export
  const exportCsv = () => {
    const rows = [["Numéro", "Description", "Montant", "Statut", "Source", "Patient", "Émission", "Échéance", "Paiement"]];
    for (const inv of filteredInvoices) {
      const patient = getPatientName(inv) || "";
      rows.push([
        inv.number, inv.description, inv.amount.toFixed(2), inv.status, inv.source,
        patient, inv.createdAt.split("T")[0], inv.dueDate.split("T")[0], inv.paidDate?.split("T")[0] || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `factures-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`${filteredInvoices.length} factures exportées`, "success");
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    if (activeSection === "unpaid" && inv.status !== "unpaid" && inv.status !== "overdue") return false;
    if (activeSection === "paid" && inv.status !== "paid") return false;
    if (activeSection === "stripe" && inv.source !== "stripe") return false;
    if (dateFrom) {
      const d = new Date(inv.createdAt);
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = new Date(inv.createdAt);
      if (d > new Date(dateTo + "T23:59:59")) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const patientName = inv.athleteUser
        ? `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`.toLowerCase()
        : inv.athlete?.name?.toLowerCase() || "";
      if (
        !inv.number.toLowerCase().includes(q) &&
        !inv.description.toLowerCase().includes(q) &&
        !patientName.includes(q)
      ) return false;
    }
    return true;
  }), [invoices, activeSection, searchQuery, dateFrom, dateTo]);

  const getPatientName = (inv: Invoice) => {
    if (inv.athleteUser) return `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`;
    if (inv.athlete) return inv.athlete.name;
    return null;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  const formatCurrency = (amount: number) => amount.toFixed(2).replace(".", ",") + " €";

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowModal(true);
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setFormDesc(""); setFormAmount(""); setFormDue(""); setFormNotes(""); setFormAthlete("");
    setShowModal(true);
  };

  // Follow-up suggestions after assistant reply
  const followUpSuggestions = useMemo(() => {
    if (chatMessages.length === 0 || chatLoading) return [];
    const last = chatMessages[chatMessages.length - 1];
    if (last.role !== "assistant" || !last.content) return [];
    const c = last.content.toLowerCase();
    const suggestions: string[] = [];
    if (c.includes("impayé") || c.includes("retard") || c.includes("relance")) suggestions.push("Rédige un message de relance");
    if (c.includes("ca ") || c.includes("chiffre d'affaire") || c.includes("revenu")) suggestions.push("Donne-moi une prévision pour les 3 prochains mois");
    if (c.includes("patient") || c.includes("fidéli")) suggestions.push("Quels patients sont inactifs ?");
    if (c.includes("optimis") || c.includes("conseil")) suggestions.push("Comment augmenter mon CA ?");
    if (suggestions.length === 0) suggestions.push("Détaille davantage", "Que me conseilles-tu ?");
    return suggestions.slice(0, 3);
  }, [chatMessages, chatLoading]);

  const submitCreate = async () => {
    if (!formDesc.trim() || !formAmount || !formDue) return;
    setSaving(true);
    try {
      await fetch("/api/facturation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: formDesc, amount: formAmount, dueDate: formDue, notes: formNotes, athleteId: formAthlete || null }),
      });
      fetchInvoices();
      fetchAiInsights();
      setShowModal(false);
      showToast("Facture créée avec succès", "success");
    } catch { showToast("Erreur lors de la création", "error"); } finally { setSaving(false); }
  };

  const handleMarkAsPaid = async (invoiceId: string, paymentMethod?: string) => {
    await fetch(`/api/facturation/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paymentMethod: paymentMethod || "Non précisé" }),
    });
    fetchInvoices();
    fetchAiInsights();
    setShowModal(false);
    showToast("Facture marquée comme payée", "success");
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await fetch(`/api/facturation/${invoiceId}`, { method: "DELETE" });
    fetchInvoices();
    fetchAiInsights();
    setShowModal(false);
    showToast("Facture supprimée", "info");
  };

  // Trend chart max for scaling bars
  const trendMax = aiStats ? Math.max(...aiStats.monthlyTrend.map((m) => m.revenue), 1) : 1;
  const prestaMax = aiStats?.prestationBreakdown?.length ? Math.max(...aiStats.prestationBreakdown.map((p) => p.revenue), 1) : 1;

  // Revenue trend arrow
  const revTrend = aiStats ? (aiStats.thisMonthRevenue - aiStats.lastMonthRevenue) : 0;
  const revTrendPct = aiStats && aiStats.lastMonthRevenue > 0
    ? Math.round((revTrend / aiStats.lastMonthRevenue) * 100)
    : null;

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.statsRow4}>
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${styles.statCard} ${styles.skeleton}`}><div className={styles.skeletonBar} /><div><div className={styles.skeletonLine} style={{ width: 80 }} /><div className={styles.skeletonLine} style={{ width: 50 }} /></div></div>)}
      </div>
      <div className={`${styles.aiPanel} ${styles.skeleton}`} style={{ height: 200 }} />
    </div>
  );

  return (
    <div className={styles.container}>
      {/* ─── Toast ─── */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</span>
          {toast.message}
        </div>
      )}

      {/* ─── Stats row (4 cols) ─── */}
      <div className={styles.statsRow4}>
        <div className={`${styles.statCard} ${(aiStats?.overdueCount ?? 0) > 0 ? styles.statCardWarning : ""}`}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div className={styles.statValue}>{formatCurrency(aiStats?.totalUnpaid ?? 0)}</div>
            <div className={styles.statLabel}>En attente {(aiStats?.overdueCount ?? 0) > 0 && <span className={styles.statBadge}>{aiStats!.overdueCount} en retard</span>}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardGreen}`}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className={styles.statValue}>
              {formatCurrency(aiStats?.thisMonthRevenue ?? 0)}
              {revTrendPct !== null && (
                <span className={`${styles.statTrend} ${revTrend >= 0 ? styles.statTrendUp : styles.statTrendDown}`}>
                  {revTrend >= 0 ? "↑" : "↓"} {Math.abs(revTrendPct)}%
                </span>
              )}
            </div>
            <div className={styles.statLabel}>Ce mois vs précédent</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <div className={styles.statValue}>{aiStats?.totalInvoices ?? invoices.length}</div>
            <div className={styles.statLabel}>Total factures</div>
          </div>
          {/* Mini sparkline */}
          {aiStats && aiStats.monthlyTrend.length > 1 && (
            <svg className={styles.sparkline} viewBox="0 0 60 24" preserveAspectRatio="none">
              <polyline fill="none" stroke="rgba(244,123,32,0.4)" strokeWidth="1.5"
                points={aiStats.monthlyTrend.map((m, i) => {
                  const max = Math.max(...aiStats.monthlyTrend.map((t) => t.count), 1);
                  return `${(i / (aiStats.monthlyTrend.length - 1)) * 60},${24 - (m.count / max) * 20}`;
                }).join(" ")} />
            </svg>
          )}
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className={styles.statValue}>{formatCurrency(aiStats?.totalRevenue ?? 0)}</div>
            <div className={styles.statLabel}>CA total</div>
          </div>
        </div>
      </div>

      {/* ─── KPI Row ─── */}
      {aiStats && (
        <div className={styles.kpiRow}>
          <div className={styles.kpiItem}>
            <span className={styles.kpiValue}>{aiStats.collectionRate ?? 0}%</span>
            <span className={styles.kpiLabel}>Taux recouvrement</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiValue}>{aiStats.automationRate ?? 0}%</span>
            <span className={styles.kpiLabel}>Automatisation</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiValue}>{formatCurrency(aiStats.avgInvoiceAmount)}</span>
            <span className={styles.kpiLabel}>Facture moyenne</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={styles.kpiValue}>{aiStats.medianAmount ? formatCurrency(aiStats.medianAmount) : "—"}</span>
            <span className={styles.kpiLabel}>Médiane</span>
          </div>
          <div className={styles.kpiDivider} />
          <div className={styles.kpiItem}>
            <span className={`${styles.kpiValue} ${riskScores.filter(r => r.level === "high").length > 0 ? styles.kpiDanger : ""}`}>
              {riskScores.filter(r => r.level === "high").length}
            </span>
            <span className={styles.kpiLabel}>Risque élevé</span>
          </div>
        </div>
      )}

      {/* ─── AI Quick Actions ─── */}
      <div className={styles.aiActionsBar}>
        <button className={styles.aiActionBtn} onClick={fetchMonthlySummary} disabled={summaryLoading}>
          {summaryLoading ? <span className={styles.aiSpinnerSmall} /> : "📊"}
          Résumé mensuel IA
        </button>
        <button className={styles.aiActionBtn} onClick={() => { fetchRiskScores(); showToast("Scores de risque actualisés", "info"); }} disabled={riskLoading}>
          {riskLoading ? <span className={styles.aiSpinnerSmall} /> : "🎯"}
          Analyse des risques
        </button>
        <button className={styles.aiActionBtn} onClick={() => { setAiTab("chat"); setAiOpen(true); setChatInput("Quels patients dois-je relancer en priorité ?"); }}>
          📨 Stratégie de relance
        </button>
        <button className={styles.aiActionBtn} onClick={() => { setAiTab("chat"); setAiOpen(true); setChatInput("Donne-moi une prévision de mon CA pour les 3 prochains mois"); }}>
          🔮 Prévisions CA
        </button>
      </div>

      {/* ─── Monthly AI Summary ─── */}
      {monthlySummary && summaryOpen && (
        <div className={styles.summaryPanel}>
          <div className={styles.summaryHeader}>
            <div className={styles.summaryTitleRow}>
              <span className={styles.summaryIcon}>📊</span>
              <span className={styles.summaryTitle}>{monthlySummary.title || `Résumé — ${monthlySummary.month}`}</span>
            </div>
            <button className={styles.modalClose} onClick={() => setSummaryOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>
          <div className={styles.summaryBody}>
            <div className={styles.summaryStats}>
              <div className={styles.summaryStat}>
                <span className={styles.summaryStatValue}>{formatCurrency(monthlySummary.revenue)}</span>
                <span className={styles.summaryStatLabel}>CA encaissé</span>
              </div>
              <div className={styles.summaryStat}>
                <span className={styles.summaryStatValue}>{monthlySummary.invoiceCount}</span>
                <span className={styles.summaryStatLabel}>Factures</span>
              </div>
              <div className={styles.summaryStat}>
                <span className={styles.summaryStatValue} style={{ color: monthlySummary.unpaidCount > 0 ? "#f59e0b" : "#22c55e" }}>{monthlySummary.unpaidCount}</span>
                <span className={styles.summaryStatLabel}>Impayées</span>
              </div>
              {monthlySummary.lastMonthRevenue > 0 && (
                <div className={styles.summaryStat}>
                  <span className={`${styles.summaryStatValue} ${monthlySummary.revenue >= monthlySummary.lastMonthRevenue ? styles.statTrendUp : styles.statTrendDown}`}>
                    {monthlySummary.revenue >= monthlySummary.lastMonthRevenue ? "↑" : "↓"} {Math.abs(Math.round((monthlySummary.revenue - monthlySummary.lastMonthRevenue) / monthlySummary.lastMonthRevenue * 100))}%
                  </span>
                  <span className={styles.summaryStatLabel}>vs mois préc.</span>
                </div>
              )}
            </div>
            {monthlySummary.highlights?.length > 0 && (
              <div className={styles.summarySection}>
                <h4 className={styles.summarySectionTitle}>✅ Points forts</h4>
                {monthlySummary.highlights.map((h, i) => <div key={i} className={styles.summaryItem}>{h}</div>)}
              </div>
            )}
            {monthlySummary.warnings?.length > 0 && (
              <div className={styles.summarySection}>
                <h4 className={`${styles.summarySectionTitle} ${styles.summarySectionWarn}`}>⚠️ Points d&apos;attention</h4>
                {monthlySummary.warnings.map((w, i) => <div key={i} className={styles.summaryItem}>{w}</div>)}
              </div>
            )}
            {monthlySummary.recommendations?.length > 0 && (
              <div className={styles.summarySection}>
                <h4 className={`${styles.summarySectionTitle} ${styles.summarySectionReco}`}>💡 Recommandations</h4>
                {monthlySummary.recommendations.map((r, i) => <div key={i} className={styles.summaryItem}>{r}</div>)}
              </div>
            )}
            {monthlySummary.outlook && (
              <div className={styles.summaryOutlook}>
                <span className={styles.summaryOutlookIcon}>🔮</span>
                {monthlySummary.outlook}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── AI Panel ─── */}
      <div className={styles.aiPanel}>
        <div className={styles.aiHeader} onClick={() => setAiOpen(!aiOpen)}>
          <div className={styles.aiIcon}>&#129302;</div>
          <span className={styles.aiTitle}>Assistant IA — Facturation</span>
          <div className={styles.aiTabs}>
            <button className={`${styles.aiTabBtn} ${aiTab === "insights" ? styles.aiTabBtnActive : ""}`} onClick={(e) => { e.stopPropagation(); setAiTab("insights"); }}>Insights</button>
            <button className={`${styles.aiTabBtn} ${aiTab === "chat" ? styles.aiTabBtnActive : ""}`} onClick={(e) => { e.stopPropagation(); setAiTab("chat"); }}>Chat</button>
          </div>
          {aiTab === "insights" && (
            <button className={styles.aiRefresh} onClick={(e) => { e.stopPropagation(); fetchAiInsights(); }}>
              Actualiser
            </button>
          )}
          {aiTab === "chat" && chatMessages.length > 0 && (
            <button className={styles.aiRefresh} onClick={(e) => { e.stopPropagation(); setChatMessages([]); }}>
              Nouveau chat
            </button>
          )}
          <svg className={`${styles.aiChevron} ${aiOpen ? styles.aiChevronOpen : ""}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {aiOpen && aiTab === "insights" && (
          <div className={styles.aiBody}>
            {aiLoading ? (
              <div className={styles.aiLoading}>
                <div className={styles.aiSpinner} />
                Analyse IA en cours...
              </div>
            ) : (
              <>
                {/* Health score + quick stats */}
                {aiStats?.healthScore !== undefined && (
                  <div className={styles.healthRow}>
                    <div className={styles.healthGauge}>
                      <svg viewBox="0 0 120 70" className={styles.healthSvg}>
                        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
                        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={getHealthColor(aiStats.healthScore)} strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${(aiStats.healthScore / 100) * 157} 157`}
                          style={{ transition: "stroke-dasharray 0.8s ease" }} />
                      </svg>
                      <div className={styles.healthValue} style={{ color: getHealthColor(aiStats.healthScore) }}>{aiStats.healthScore}</div>
                      <div className={styles.healthLabel}>{getHealthLabel(aiStats.healthScore)}</div>
                    </div>
                    <div className={styles.healthMeta}>
                      <div className={styles.healthMetaItem}>
                        <span className={styles.healthMetaValue}>{aiStats.collectionRate ?? 0}%</span>
                        <span className={styles.healthMetaLabel}>Recouvrement</span>
                      </div>
                      <div className={styles.healthMetaItem}>
                        <span className={styles.healthMetaValue}>{aiStats.automationRate ?? 0}%</span>
                        <span className={styles.healthMetaLabel}>Automatisation</span>
                      </div>
                      {aiStats.yoyGrowth !== null && aiStats.yoyGrowth !== undefined && (
                        <div className={styles.healthMetaItem}>
                          <span className={styles.healthMetaValue} style={{ color: aiStats.yoyGrowth >= 0 ? "#22c55e" : "#ef4444" }}>
                            {aiStats.yoyGrowth >= 0 ? "+" : ""}{aiStats.yoyGrowth}%
                          </span>
                          <span className={styles.healthMetaLabel}>vs {new Date().getFullYear() - 1}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Category filter pills */}
                {aiInsights.length > 0 && (
                  <div className={styles.insightFilters}>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                      const count = key === "all" ? aiInsights.length : aiInsights.filter((i) => i.category === key).length;
                      if (key !== "all" && count === 0) return null;
                      return (
                        <button
                          key={key}
                          className={`${styles.insightFilterBtn} ${insightFilter === key ? styles.insightFilterBtnActive : ""}`}
                          onClick={() => setInsightFilter(key)}
                        >
                          {label} {count > 0 && <span className={styles.insightFilterCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Insight cards */}
                {aiInsights.length > 0 ? (
                  <div className={styles.insightsGrid}>
                    {aiInsights
                      .filter((i) => insightFilter === "all" || i.category === insightFilter)
                      .map((insight, idx) => {
                        const isExpanded = expandedInsights.has(idx);
                        const isCritical = insight.severity === "critical";
                        return (
                      <div key={idx} className={`${styles.insightCard} ${isCritical ? styles.insightCardCritical : ""}`} style={{ borderLeftColor: SEVERITY_COLORS[insight.severity] || "#8b5cf6" }}>
                        <div className={styles.insightTop} onClick={() => toggleInsightExpand(idx)} style={{ cursor: "pointer" }}>
                          <span className={styles.insightIcon}>{CATEGORY_ICONS[insight.category] || "\u2139\uFE0F"}</span>
                          <span className={styles.insightTitle}>{insight.title}</span>
                          {insight.metric && (
                            <span className={styles.insightMetric} style={{ color: SEVERITY_COLORS[insight.severity] || "#8b5cf6" }}>
                              {insight.metric}
                            </span>
                          )}
                          <span className={`${styles.insightChevron} ${isExpanded ? styles.insightChevronOpen : ""}`}>▾</span>
                        </div>
                        {isExpanded && (
                          <>
                            <div className={styles.insightMessage}>{insight.message}</div>
                            <div className={styles.insightActions}>
                              <div className={styles.insightTags}>
                                <span className={styles.insightTag} style={{ background: `${SEVERITY_COLORS[insight.severity]}18`, color: SEVERITY_COLORS[insight.severity] }}>
                                  {insight.severity === "critical" ? "Critique" : insight.severity === "warning" ? "Attention" : insight.severity === "positive" ? "Positif" : "Info"}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  className={styles.insightAsk}
                                  onClick={() => { setAiTab("chat"); setChatInput(`Détaille-moi : ${insight.title}`); }}
                                  title="Poser une question à l'IA"
                                >
                                  💬 Approfondir
                                </button>
                                {isCritical && (
                                  <button
                                    className={styles.insightAsk}
                                    onClick={() => { setAiTab("chat"); setChatInput(`Donne-moi un plan d'action urgent pour : ${insight.title}`); }}
                                  >
                                    🚨 Plan d&apos;action
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {!isExpanded && (
                          <div className={styles.insightMessagePreview}>{insight.message.slice(0, 80)}{insight.message.length > 80 ? "…" : ""}</div>
                        )}
                      </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className={styles.aiLoading}>Aucune donnée à analyser pour le moment.</div>
                )}
              </>
            )}
          </div>
        )}
        {aiOpen && aiTab === "chat" && (
          <div className={styles.aiBody}>
            <div className={styles.chatContainer} ref={chatContainerRef}>
              {chatMessages.length === 0 && (
                <div className={styles.chatWelcome}>
                  <div className={styles.chatWelcomeIcon}>&#129302;</div>
                  <div className={styles.chatWelcomeTitle}>Assistant Facturation IA</div>
                  <div className={styles.chatWelcomeText}>Posez-moi une question sur vos factures, revenus, patients, tendances ou stratégie.</div>
                  <div className={styles.chatSuggestions}>
                    {chatSuggestions.map((q, i) => (
                      <button key={i} className={styles.chatSuggestion} onClick={() => { setChatInput(q); }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`${styles.chatMsg} ${msg.role === "user" ? styles.chatMsgUser : styles.chatMsgAi}`}>
                  {msg.role === "assistant" && <span className={styles.chatMsgAvatar}>&#129302;</span>}
                  <div className={styles.chatBubbleWrap}>
                    <div className={styles.chatMsgBubble}>
                      {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                      {msg.role === "assistant" && msg.content === "" && chatLoading && (
                        <div className={styles.typingDots}>
                          <span /><span /><span />
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" && msg.content && !chatLoading && (
                      <button className={styles.chatCopy} onClick={() => copyMessage(i)} title="Copier">
                        {copiedIdx === i ? "✓" : "⎘"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {followUpSuggestions.length > 0 && !chatLoading && chatMessages.length > 0 && (
                <div className={styles.chatFollowUps}>
                  {followUpSuggestions.map((s, i) => (
                    <button key={i} className={styles.chatSuggestion} onClick={() => { setChatInput(s); }}>{s}</button>
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className={styles.chatInputRow}>
              <input
                className={styles.chatInput}
                placeholder="Posez votre question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                disabled={chatLoading}
              />
              <button className={styles.chatSend} onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Trend + Forecast + Top patients ─── */}
      {aiStats && (aiStats.monthlyTrend.some((m) => m.revenue > 0) || aiStats.topPatients.length > 0) && (
        <div className={styles.trendRow}>
          {aiStats.monthlyTrend.some((m) => m.revenue > 0) && (
            <div className={styles.trendCard}>
              <div className={styles.trendTitle}>Tendance CA — 6 derniers mois {aiForecast.length > 0 && "+ prévisions"}</div>
              <div className={styles.trendBars}>
                {aiStats.monthlyTrend.map((m, i) => (
                  <div key={`t-${i}`} className={styles.trendBar}>
                    <div
                      className={styles.trendBarFill}
                      style={{ height: `${Math.max((m.revenue / trendMax) * 100, 5)}%` }}
                      title={`${m.month}: ${formatCurrency(m.revenue)}`}
                    />
                    <span className={styles.trendBarLabel}>{m.month.split(" ")[0]}</span>
                  </div>
                ))}
                {aiForecast.map((f, i) => (
                  <div key={`f-${i}`} className={styles.trendBar}>
                    <div
                      className={styles.trendBarFill}
                      style={{
                        height: `${Math.max((f.predicted / trendMax) * 100, 5)}%`,
                        opacity: f.confidence === "high" ? 0.6 : f.confidence === "medium" ? 0.4 : 0.25,
                        borderStyle: "dashed",
                        borderWidth: 1,
                        borderColor: "rgba(244, 123, 32, 0.4)",
                        background: "repeating-linear-gradient(45deg, rgba(244,123,32,0.15), rgba(244,123,32,0.15) 2px, transparent 2px, transparent 6px)",
                      }}
                      title={`${f.month}: ~${formatCurrency(f.predicted)} (prévu, ${f.confidence})`}
                    />
                    <span className={styles.trendBarLabel} style={{ fontStyle: "italic" }}>{f.month.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aiStats.topPatients.length > 0 && (
            <div className={styles.trendCard}>
              <div className={styles.trendTitle}>Top patients</div>
              <div className={styles.topPatientsList}>
                {aiStats.topPatients.map((p, i) => (
                  <div key={i} className={styles.topPatient}>
                    <div className={styles.topPatientRank}>{i + 1}</div>
                    <span className={styles.topPatientName}>{p.name}</span>
                    <span className={styles.topPatientAmount}>{formatCurrency(p.total)}</span>
                    <span className={styles.topPatientCount}>{p.count} fact.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Prestation breakdown ─── */}
      {aiStats?.prestationBreakdown && aiStats.prestationBreakdown.length > 1 && (
        <div className={styles.trendCard}>
          <div className={styles.trendTitle}>Répartition par prestation</div>
          <div className={styles.prestaList}>
            {aiStats.prestationBreakdown.map((p, i) => (
              <div key={i} className={styles.prestaItem}>
                <div className={styles.prestaHeader}>
                  <span className={styles.prestaName}>{p.type}</span>
                  <span className={styles.prestaAmount}>{formatCurrency(p.revenue)}</span>
                </div>
                <div className={styles.prestaBarBg}>
                  <div className={styles.prestaBarFill} style={{ width: `${(p.revenue / prestaMax) * 100}%` }} />
                </div>
                <span className={styles.prestaCount}>{p.count} facture{p.count > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Gestion des factures</h2>
          <p className={styles.subtitle}>Factures automatiques Stripe + manuelles</p>
        </div>
        <button className={styles.createBtn} onClick={handleCreateInvoice}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Créer une facture
        </button>
      </div>

      {/* ─── Filter bar ─── */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterSearch}
          placeholder="Rechercher par numéro, description ou patient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <input type="date" className={styles.filterDate} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date début" />
        <input type="date" className={styles.filterDate} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date fin" />
        {(dateFrom || dateTo) && (
          <button className={styles.filterClear} onClick={() => { setDateFrom(""); setDateTo(""); }}>✕</button>
        )}
        <button className={styles.exportBtn} onClick={exportCsv} title="Exporter en CSV">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeSection === "all" ? styles.tabActive : ""}`} onClick={() => setActiveSection("all")}>
          Toutes ({invoices.length})
        </button>
        <button className={`${styles.tab} ${activeSection === "unpaid" ? styles.tabActive : ""}`} onClick={() => setActiveSection("unpaid")}>
          En attente ({invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").length})
        </button>
        <button className={`${styles.tab} ${activeSection === "paid" ? styles.tabActive : ""}`} onClick={() => setActiveSection("paid")}>
          Payées ({invoices.filter((i) => i.status === "paid").length})
        </button>
        <button className={`${styles.tab} ${activeSection === "stripe" ? styles.tabActive : ""}`} onClick={() => setActiveSection("stripe")}>
          Stripe ({invoices.filter((i) => i.source === "stripe").length})
        </button>
      </div>

      {/* ─── Invoice list ─── */}
      <div className={styles.list}>
        {filteredInvoices.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            {searchQuery ? "Aucune facture ne correspond à votre recherche" : "Aucune facture dans cette catégorie"}
          </div>
        ) : (
          filteredInvoices.map((inv) => (
            <div key={inv.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardId}>{inv.number}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className={inv.source === "stripe" ? styles.badgeStripe : styles.badgeManual}>
                    {inv.source === "stripe" ? "Stripe" : "Manuel"}
                  </span>
                  <span className={inv.status === "paid" ? styles.badgePaid : styles.badgeUnpaid}>
                    {inv.status === "paid" ? "Payée" : "En attente"}
                  </span>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardAmount}>{formatCurrency(inv.amount)}</div>
                {getPatientName(inv) && (
                  <div className={styles.cardPatient}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    {getPatientName(inv)}
                  </div>
                )}
                <div className={styles.cardDesc}>{inv.description}</div>
                <div className={styles.cardDates}>
                  <span>
                    <span className={styles.dateLabel}>Émise le</span> {formatDate(inv.createdAt)}
                  </span>
                  {inv.status === "paid" && inv.paidDate ? (
                    <span>
                      <span className={styles.dateLabel}>Payée le</span> {formatDate(inv.paidDate)}
                    </span>
                  ) : (
                    <span>
                      <span className={styles.dateLabel}>Échéance</span> {formatDate(inv.dueDate)}
                    </span>
                  )}
                </div>
                {inv.paymentMethod && (
                  <div className={styles.cardMethod}>
                    <span className={styles.dateLabel}>Paiement :</span> {inv.paymentMethod}
                  </div>
                )}
              </div>
              {/* Risk score badge */}
              {getRiskForInvoice(inv.id) && (inv.status === "unpaid" || inv.status === "overdue") && (() => {
                const risk = getRiskForInvoice(inv.id)!;
                return (
                  <div className={`${styles.riskBadge} ${styles[`riskBadge_${risk.level}`]}`}>
                    <span className={styles.riskScore}>{risk.score}</span>
                    <span className={styles.riskText}>Risque {risk.level === "high" ? "élevé" : risk.level === "medium" ? "moyen" : "faible"} — {risk.reason}</span>
                  </div>
                );
              })()}
              <div className={styles.cardActions}>
                <button className={styles.btnOutline} onClick={() => handleViewInvoice(inv)}>
                  Voir détails
                </button>
                {(inv.status === "unpaid" || inv.status === "overdue") && (
                  <>
                    <button className={styles.btnGreen} onClick={() => handleMarkAsPaid(inv.id)}>
                      Marquer payée
                    </button>
                    <button className={styles.btnAi} onClick={() => { setRelanceModal({ invoiceId: inv.id, invoice: inv }); setRelanceEmail(null); setRelanceTone("professional"); }}>
                      📨 Relance IA
                    </button>
                  </>
                )}
                {inv.source === "manual" && (
                  <button className={styles.btnDanger} onClick={() => handleDelete(inv.id)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Modal ─── */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{selectedInvoice ? `Facture ${selectedInvoice.number}` : "Créer une facture"}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {selectedInvoice ? (
                <div className={styles.detailGrid}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Numéro</span>
                    <span className={styles.detailValue}>{selectedInvoice.number}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Source</span>
                    <span className={styles.detailValue}>
                      <span className={selectedInvoice.source === "stripe" ? styles.badgeStripe : styles.badgeManual}>
                        {selectedInvoice.source === "stripe" ? "Stripe (auto)" : "Manuelle"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Statut</span>
                    <span className={styles.detailValue}>
                      <span className={selectedInvoice.status === "paid" ? styles.badgePaid : styles.badgeUnpaid}>
                        {selectedInvoice.status === "paid" ? "Payée" : "En attente"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Description</span>
                    <span className={styles.detailValue}>{selectedInvoice.description}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Montant net</span>
                    <span className={styles.detailValue}>{formatCurrency(selectedInvoice.amount)}</span>
                  </div>
                  {getPatientName(selectedInvoice) && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Patient</span>
                      <span className={styles.detailValue}>{getPatientName(selectedInvoice)}</span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Date d&apos;émission</span>
                    <span className={styles.detailValue}>{formatDate(selectedInvoice.createdAt)}</span>
                  </div>
                  {selectedInvoice.notes && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Notes</span>
                      <span className={styles.detailValue}>{selectedInvoice.notes}</span>
                    </div>
                  )}
                  {selectedInvoice.payment?.receiptNumber && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Reçu athlète</span>
                      <span className={styles.detailValue}>{selectedInvoice.payment.receiptNumber}</span>
                    </div>
                  )}
                  {selectedInvoice.payment?.stripePaymentIntentId && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Réf. Stripe</span>
                      <span className={styles.detailValue} style={{ fontSize: 11, fontFamily: "monospace" }}>{selectedInvoice.payment.stripePaymentIntentId}</span>
                    </div>
                  )}
                  {selectedInvoice.status === "paid" && selectedInvoice.paidDate ? (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Date de paiement</span>
                        <span className={styles.detailValue}>{formatDate(selectedInvoice.paidDate)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Méthode</span>
                        <span className={styles.detailValue}>{selectedInvoice.paymentMethod}</span>
                      </div>
                    </>
                  ) : (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Échéance</span>
                      <span className={styles.detailValue}>{formatDate(selectedInvoice.dueDate)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Description *</label>
                    <div className={styles.inputWithAi}>
                      <input type="text" className={styles.input} placeholder="Ex: Consultation initiale" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                      <button className={styles.aiSuggestBtn} onClick={() => fetchDescSuggestions(athletes.find(a => a.id === formAthlete)?.name || "", formAmount)} disabled={descLoading} title="Suggestions IA">
                        {descLoading ? <span className={styles.aiSpinnerSmall} /> : "✨"}
                      </button>
                    </div>
                    {descSuggestions.length > 0 && (
                      <div className={styles.descSuggestions}>
                        {descSuggestions.map((s, i) => (
                          <button key={i} className={styles.descSuggestionBtn} onClick={() => { setFormDesc(s); setDescSuggestions([]); }}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Montant (€) *</label>
                      <input type="number" className={styles.input} min="0" step="0.01" placeholder="0,00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Date d&apos;échéance *</label>
                      <input type="date" className={styles.input} value={formDue} onChange={(e) => setFormDue(e.target.value)} />
                    </div>
                  </div>
                  {athletes.length > 0 && (
                    <div className={styles.formGroup}>
                      <label>Patient (optionnel)</label>
                      <select className={styles.input} value={formAthlete} onChange={(e) => setFormAthlete(e.target.value)}>
                        <option value="">— Aucun —</option>
                        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className={styles.formGroup}>
                    <label>Notes</label>
                    <textarea className={styles.textarea} rows={3} placeholder="Informations complémentaires..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              {selectedInvoice ? (
                <>
                  {(selectedInvoice.status === "unpaid" || selectedInvoice.status === "overdue") && (
                    <button className={styles.btnGreen} onClick={() => handleMarkAsPaid(selectedInvoice.id)}>
                      Marquer payée
                    </button>
                  )}
                  {selectedInvoice.source === "manual" && (
                    <button className={styles.btnDanger} onClick={() => handleDelete(selectedInvoice.id)}>
                      Supprimer
                    </button>
                  )}
                  <button className={styles.btnOutline} onClick={() => setShowModal(false)}>
                    Fermer
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.btnOutline} onClick={() => setShowModal(false)}>
                    Annuler
                  </button>
                  <button className={styles.createBtn} onClick={submitCreate} disabled={saving || !formDesc.trim() || !formAmount || !formDue}>
                    {saving ? "Création..." : "Créer la facture"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Relance Email Modal ─── */}
      {relanceModal && (
        <div className={styles.overlay} onClick={() => setRelanceModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className={styles.modalHeader}>
              <h3>📨 Relance IA — {relanceModal.invoice.number}</h3>
              <button className={styles.modalClose} onClick={() => setRelanceModal(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.relanceInfo}>
                <span>Patient: <strong>{getPatientName(relanceModal.invoice) || "—"}</strong></span>
                <span>Montant: <strong>{formatCurrency(relanceModal.invoice.amount)}</strong></span>
                <span>Échéance: <strong>{formatDate(relanceModal.invoice.dueDate)}</strong></span>
              </div>
              <div className={styles.relanceTones}>
                <span className={styles.relanceToneLabel}>Ton :</span>
                {(["professional", "friendly", "firm"] as const).map((t) => (
                  <button key={t} className={`${styles.relanceToneBtn} ${relanceTone === t ? styles.relanceToneBtnActive : ""}`}
                    onClick={() => setRelanceTone(t)}>
                    {t === "professional" ? "💼 Professionnel" : t === "friendly" ? "🤝 Amical" : "⚡ Ferme"}
                  </button>
                ))}
              </div>
              <button className={styles.createBtn} onClick={() => generateRelance(relanceModal.invoiceId, relanceTone)} disabled={relanceLoading} style={{ alignSelf: "flex-start" }}>
                {relanceLoading ? "Génération..." : "Générer l'email de relance"}
              </button>
              {relanceEmail && (
                <div className={styles.relanceResult}>
                  <div className={styles.relanceSubject}>
                    <span className={styles.relanceSubjectLabel}>Objet :</span>
                    {relanceEmail.subject}
                  </div>
                  <div className={styles.relanceBody}>{relanceEmail.body}</div>
                  <div className={styles.relanceActions}>
                    <button className={styles.btnOutline} onClick={() => {
                      navigator.clipboard.writeText(`Objet : ${relanceEmail.subject}\n\n${relanceEmail.body}`);
                      showToast("Email copié dans le presse-papiers", "success");
                    }}>
                      📋 Copier
                    </button>
                    {relanceEmail.patientEmail && (
                      <a
                        className={styles.btnGreen}
                        href={`mailto:${relanceEmail.patientEmail}?subject=${encodeURIComponent(relanceEmail.subject)}&body=${encodeURIComponent(relanceEmail.body)}`}
                        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        ✉️ Ouvrir dans email
                      </a>
                    )}
                    <button className={styles.btnOutline} onClick={() => generateRelance(relanceModal.invoiceId, relanceTone)} disabled={relanceLoading}>
                      🔄 Régénérer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
