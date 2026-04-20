import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { secrets } from "@/lib/vault";
import { REMBOURSEMENT_AI_RULES } from "@/lib/remboursement";
import { CANCELLATION_AI_RULES } from "@/lib/cancellation";
import OpenAI from "openai";

// ─── Types for structured AI output ───

interface AIInsight {
  category: "alert" | "trend" | "optimization" | "prediction" | "info";
  severity: "critical" | "warning" | "positive" | "neutral";
  title: string;
  message: string;
  metric?: string;
}

interface CashFlowForecast {
  month: string;
  predicted: number;
  confidence: "high" | "medium" | "low";
}

// ─── Helpers ───

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
}

/**
 * GET /api/facturation/ai-insights
 *
 * Advanced AI analysis:
 * - Structured insights with category/severity
 * - Anomaly detection (outlier amounts, overdue, gaps)
 * - Cash flow forecast (3 months)
 * - Patient retention analysis
 * - Seasonal pattern detection
 * - OpenAI GPT-4o for deep analysis, rich rule-based fallback
 */
export const GET = withAuth(async (_request, ctx) => {
  try {
    const pro = ctx.session;

    const invoices = await (prisma as any).invoice.findMany({
      where: { professionnelId: pro.id, deletedAt: null },
      include: {
        athlete: { select: { name: true } },
        athleteUser: { select: { prenom: true, nom: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ═══════════════════════════════════════
    // COMPUTE STATS
    // ═══════════════════════════════════════

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const paidInvoices = invoices.filter((i: any) => i.status === "paid");
    const unpaidInvoices = invoices.filter((i: any) => i.status === "unpaid" || i.status === "overdue");
    const stripeInvoices = invoices.filter((i: any) => i.source === "stripe");
    const manualInvoices = invoices.filter((i: any) => i.source === "manual");
    const overdueInvoices = unpaidInvoices.filter((i: any) => new Date(i.dueDate) < now);

    // Revenue by month (12 months)
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      monthlyMap[getMonthKey(d)] = { revenue: 0, count: 0 };
    }
    for (const inv of paidInvoices) {
      const d = new Date(inv.paidDate || inv.createdAt);
      const key = getMonthKey(d);
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += inv.amount;
        monthlyMap[key].count += 1;
      }
    }

    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, data]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          month: getMonthLabel(new Date(y, m - 1, 1)),
          revenue: data.revenue,
          count: data.count,
        };
      });

    const thisMonthKey = getMonthKey(now);
    const lastMonthKey = getMonthKey(new Date(thisYear, thisMonth - 1, 1));
    const thisMonthRevenue = monthlyMap[thisMonthKey]?.revenue ?? 0;
    const lastMonthRevenue = monthlyMap[lastMonthKey]?.revenue ?? 0;
    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + i.amount, 0);
    const totalUnpaid = unpaidInvoices.reduce((s: number, i: any) => s + i.amount, 0);
    const amounts = paidInvoices.map((i: any) => i.amount as number);
    const avgInvoiceAmount = amounts.length > 0 ? totalRevenue / amounts.length : 0;
    const medianAmount = median(amounts);
    const amountStdDev = stddev(amounts);

    // Anomaly: outlier invoices (> 2 std dev from mean)
    const outlierInvoices = amounts.length >= 5
      ? paidInvoices.filter((i: any) => Math.abs(i.amount - avgInvoiceAmount) > 2 * amountStdDev)
      : [];

    // Patient analysis
    const patientRevenue: Record<string, { name: string; total: number; count: number; lastDate: Date }> = {};
    for (const inv of paidInvoices) {
      const name = inv.athleteUser
        ? `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`
        : inv.athlete?.name || "Non assigné";
      if (!patientRevenue[name]) patientRevenue[name] = { name, total: 0, count: 0, lastDate: new Date(0) };
      patientRevenue[name].total += inv.amount;
      patientRevenue[name].count += 1;
      const d = new Date(inv.paidDate || inv.createdAt);
      if (d > patientRevenue[name].lastDate) patientRevenue[name].lastDate = d;
    }
    const topPatients = Object.values(patientRevenue)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Patients not seen in 60+ days
    const inactiveThreshold = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const inactivePatients = Object.values(patientRevenue)
      .filter((p) => p.count >= 2 && p.lastDate < inactiveThreshold)
      .sort((a, b) => a.lastDate.getTime() - b.lastDate.getTime());

    // Day-of-week distribution
    const dayOfWeekRevenue: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayOfWeekCount: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const inv of paidInvoices) {
      const day = new Date(inv.paidDate || inv.createdAt).getDay();
      dayOfWeekRevenue[day] += inv.amount;
      dayOfWeekCount[day] += 1;
    }
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const bestDay = dayOfWeekCount.indexOf(Math.max(...dayOfWeekCount));

    // Cash flow forecast (simple linear regression on last 6 months)
    const trendValues = monthlyTrend.map((m) => m.revenue);
    const forecast: CashFlowForecast[] = [];
    if (trendValues.some((v) => v > 0)) {
      const n = trendValues.length;
      const xMean = (n - 1) / 2;
      const yMean = trendValues.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (trendValues[i] - yMean);
        den += (i - xMean) ** 2;
      }
      const slope = den !== 0 ? num / den : 0;
      const intercept = yMean - slope * xMean;
      const recentVariance = stddev(trendValues.slice(-3));

      for (let f = 1; f <= 3; f++) {
        const predicted = Math.max(0, intercept + slope * (n - 1 + f));
        const d = new Date(thisYear, thisMonth + f, 1);
        const confidence = recentVariance > yMean * 0.5 ? "low" : recentVariance > yMean * 0.2 ? "medium" : "high";
        forecast.push({ month: getMonthLabel(d), predicted: Math.round(predicted * 100) / 100, confidence });
      }
    }

    // Automation rate
    const automationRate = invoices.length > 0 ? (stripeInvoices.length / invoices.length) * 100 : 0;

    // Collection rate
    const collectionRate = invoices.length > 0 ? (paidInvoices.length / invoices.length) * 100 : 0;

    // Average days to payment (for manual invoices)
    const manualPaid = manualInvoices.filter((i: any) => i.status === "paid" && i.paidDate);
    const avgDaysToPayment = manualPaid.length > 0
      ? manualPaid.reduce((s: number, i: any) => {
          return s + (new Date(i.paidDate).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / manualPaid.length
      : null;

    // YoY comparison
    const thisYearRevenue = paidInvoices
      .filter((i: any) => new Date(i.paidDate || i.createdAt).getFullYear() === thisYear)
      .reduce((s: number, i: any) => s + i.amount, 0);
    const lastYearRevenue = paidInvoices
      .filter((i: any) => new Date(i.paidDate || i.createdAt).getFullYear() === thisYear - 1)
      .reduce((s: number, i: any) => s + i.amount, 0);
    const yoyGrowth = lastYearRevenue > 0 ? ((thisYearRevenue - lastYearRevenue) / lastYearRevenue) * 100 : null;

    // Prestation type breakdown
    const prestationBreakdown: { type: string; revenue: number; count: number }[] = [];
    const prestationMap: Record<string, { revenue: number; count: number }> = {};
    for (const inv of paidInvoices) {
      const pt = (inv as any).prestationType || "Non catégorisé";
      if (!prestationMap[pt]) prestationMap[pt] = { revenue: 0, count: 0 };
      prestationMap[pt].revenue += inv.amount;
      prestationMap[pt].count += 1;
    }
    for (const [type, data] of Object.entries(prestationMap).sort(([, a], [, b]) => b.revenue - a.revenue)) {
      prestationBreakdown.push({ type, ...data });
    }

    // Financial health score (0-100)
    let healthScore = 50;
    // Collection rate bonus (0-20)
    healthScore += Math.min(20, collectionRate / 5);
    // No overdue bonus (0-15)
    if (overdueInvoices.length === 0) healthScore += 15;
    else healthScore -= Math.min(15, overdueInvoices.length * 3);
    // Revenue growth bonus (0-15)
    if (lastMonthRevenue > 0 && thisMonthRevenue >= lastMonthRevenue) healthScore += 10;
    else if (lastMonthRevenue > 0) healthScore -= 5;
    // Automation bonus (0-10)
    healthScore += Math.min(10, automationRate / 10);
    // Volume bonus (0-10)
    if (paidInvoices.length >= 10) healthScore += 10;
    else if (paidInvoices.length >= 5) healthScore += 5;
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    const stats = {
      totalInvoices: invoices.length,
      paidCount: paidInvoices.length,
      unpaidCount: unpaidInvoices.length,
      overdueCount: overdueInvoices.length,
      stripeCount: stripeInvoices.length,
      manualCount: manualInvoices.length,
      thisMonthRevenue,
      lastMonthRevenue,
      totalRevenue,
      totalUnpaid,
      avgInvoiceAmount,
      medianAmount,
      automationRate: Math.round(automationRate),
      collectionRate: Math.round(collectionRate),
      healthScore,
      yoyGrowth: yoyGrowth !== null ? Math.round(yoyGrowth * 10) / 10 : null,
      thisYearRevenue,
      lastYearRevenue,
      prestationBreakdown,
      topPatients,
      monthlyTrend,
      forecast,
    };

    // ═══════════════════════════════════════
    // AI INSIGHTS
    // ═══════════════════════════════════════

    let insights: AIInsight[] = [];

    if (secrets.hasOpenAI() && invoices.length > 0) {
      try {
        const openai = new OpenAI({ apiKey: secrets.openaiApiKey() });

        const dataContext = `
PROFIL : Professionnel de santé sur Tuatha (plateforme de suivi sport-santé).

FACTURATION — SNAPSHOT :
• Total : ${invoices.length} factures (${paidInvoices.length} payées, ${unpaidInvoices.length} impayées, ${overdueInvoices.length} en retard)
• CA total : ${totalRevenue.toFixed(2)}€ | Ce mois : ${thisMonthRevenue.toFixed(2)}€ | Mois dernier : ${lastMonthRevenue.toFixed(2)}€
• Montant moyen : ${avgInvoiceAmount.toFixed(2)}€ | Médiane : ${medianAmount.toFixed(2)}€ | Écart-type : ${amountStdDev.toFixed(2)}€
• Impayés : ${totalUnpaid.toFixed(2)}€ sur ${unpaidInvoices.length} factures
• Sources : ${stripeInvoices.length} Stripe (auto), ${manualInvoices.length} manuelles — taux d'automatisation : ${automationRate.toFixed(0)}%
${avgDaysToPayment !== null ? `• Délai moyen encaissement (manuel) : ${avgDaysToPayment.toFixed(1)} jours` : ""}
${outlierInvoices.length > 0 ? `• ${outlierInvoices.length} facture(s) avec montant atypique (>2σ de la moyenne)` : ""}

TENDANCE 6 MOIS : ${monthlyTrend.map(m => `${m.month}: ${m.revenue.toFixed(2)}€ (${m.count} fact.)`).join(" | ")}

PRÉVISION 3 MOIS (régression linéaire) : ${forecast.map(f => `${f.month}: ~${f.predicted.toFixed(2)}€ (confiance: ${f.confidence})`).join(" | ")}

TOP PATIENTS : ${topPatients.map((p, i) => `${i + 1}. ${p.name} — ${p.total.toFixed(2)}€ (${p.count} consult.)`).join(" | ") || "Aucun"}

PATIENTS INACTIFS (>60j, ≥2 consult.) : ${inactivePatients.length > 0 ? inactivePatients.slice(0, 5).map(p => `${p.name} (dernière visite : ${p.lastDate.toLocaleDateString("fr-FR")})`).join(", ") : "Aucun"}

JOUR LE PLUS ACTIF : ${dayNames[bestDay]} (${dayOfWeekCount[bestDay]} paiements)
`;

        const systemPrompt = `Tu es un assistant comptable et business analyst expert pour professionnels de santé. Tu analyses les données de facturation et fournis des insights structurés au format JSON.

RÈGLES STRICTES :
1. Réponds UNIQUEMENT avec un JSON array valide (pas de texte autour, pas de markdown)
2. Chaque insight est un objet avec : category, severity, title, message, metric (optionnel)
3. Categories possibles : "alert", "trend", "optimization", "prediction", "info"
4. Severities possibles : "critical", "warning", "positive", "neutral"
5. Le "title" est court (3-6 mots max)
6. Le "message" est 1-2 phrases, concret et actionnable
7. Le "metric" est une valeur clé (ex: "+15%", "3 factures", "450€")
8. Fournis 5-8 insights, priorisés par importance
9. Sois spécifique aux données — pas de généralités
10. Utilise les prévisions pour des recommandations forward-looking

PRIORISE dans cet ordre :
- Alertes critiques (impayés, retards importants)
- Tendances significatives (hausse/baisse CA)
- Prédictions cash flow
- Optimisations (automatisation, tarification, planning)
- Fidélisation patient (inactifs à relancer)
- Infos utiles (jour le plus actif, stats intéressantes)

${REMBOURSEMENT_AI_RULES}

${CANCELLATION_AI_RULES}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: dataContext },
          ],
          max_tokens: 1200,
          temperature: 0.4,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content?.trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : parsed.insights || parsed.data || [];
            if (Array.isArray(arr) && arr.length > 0) {
              insights = arr
                .filter((item: any) => item.title && item.message)
                .map((item: any) => ({
                  category: ["alert", "trend", "optimization", "prediction", "info"].includes(item.category) ? item.category : "info",
                  severity: ["critical", "warning", "positive", "neutral"].includes(item.severity) ? item.severity : "neutral",
                  title: String(item.title).slice(0, 60),
                  message: String(item.message).slice(0, 300),
                  metric: item.metric ? String(item.metric).slice(0, 30) : undefined,
                }));
            }
          } catch {
            // If JSON parse fails, treat as line-separated text
            const lines = raw.split("\n").filter((l: string) => l.trim().length > 0);
            insights = lines.map((line: string) => ({
              category: "info" as const,
              severity: "neutral" as const,
              title: line.slice(0, 40),
              message: line,
            }));
          }
        }
      } catch (aiErr) {
        console.error("[AI Insights] OpenAI error, falling back to rules:", aiErr);
      }
    }

    // ═══════════════════════════════════════
    // FALLBACK: RULE-BASED INSIGHTS
    // ═══════════════════════════════════════

    if (insights.length === 0) {
      // Critical alerts
      if (overdueInvoices.length > 0) {
        const oldest = overdueInvoices.reduce((a: any, b: any) =>
          new Date(a.dueDate) < new Date(b.dueDate) ? a : b
        );
        const daysOverdue = Math.floor((now.getTime() - new Date(oldest.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        insights.push({
          category: "alert",
          severity: overdueInvoices.length >= 3 || totalUnpaid > 500 ? "critical" : "warning",
          title: "Factures en retard",
          message: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} impayée${overdueInvoices.length > 1 ? "s" : ""} pour ${totalUnpaid.toFixed(2)}€. La plus ancienne date de ${daysOverdue} jours. Relancez vos patients pour sécuriser votre trésorerie.`,
          metric: `${totalUnpaid.toFixed(0)}€`,
        });
      }

      // Trend
      if (lastMonthRevenue > 0) {
        const pctChange = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        if (Math.abs(pctChange) >= 5) {
          insights.push({
            category: "trend",
            severity: pctChange > 0 ? "positive" : "warning",
            title: pctChange > 0 ? "CA en hausse" : "CA en baisse",
            message: pctChange > 0
              ? `Votre chiffre d'affaires progresse de ${pctChange.toFixed(0)}% ce mois (${thisMonthRevenue.toFixed(2)}€ vs ${lastMonthRevenue.toFixed(2)}€ le mois dernier). Bonne dynamique !`
              : `Baisse de ${Math.abs(pctChange).toFixed(0)}% du CA ce mois (${thisMonthRevenue.toFixed(2)}€ vs ${lastMonthRevenue.toFixed(2)}€). Vérifiez votre agenda et relancez les patients inactifs.`,
            metric: `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(0)}%`,
          });
        }
      }

      // Cash flow prediction
      if (forecast.length > 0) {
        const nextMonth = forecast[0];
        insights.push({
          category: "prediction",
          severity: nextMonth.predicted >= thisMonthRevenue ? "positive" : "warning",
          title: "Prévision mois prochain",
          message: `Estimation pour ${nextMonth.month} : ~${nextMonth.predicted.toFixed(2)}€ (confiance ${nextMonth.confidence === "high" ? "élevée" : nextMonth.confidence === "medium" ? "moyenne" : "faible"}, basée sur la tendance des 6 derniers mois).`,
          metric: `~${nextMonth.predicted.toFixed(0)}€`,
        });
      }

      // Automation opportunity
      if (manualInvoices.length > 3 && automationRate < 50) {
        insights.push({
          category: "optimization",
          severity: "neutral",
          title: "Automatisation possible",
          message: `Seulement ${automationRate.toFixed(0)}% de vos factures sont automatiques (Stripe). En encourageant la réservation en ligne, vous gagnez du temps et réduisez les impayés.`,
          metric: `${automationRate.toFixed(0)}%`,
        });
      }

      // Inactive patients
      if (inactivePatients.length > 0) {
        const names = inactivePatients.slice(0, 3).map((p) => p.name).join(", ");
        insights.push({
          category: "optimization",
          severity: "warning",
          title: "Patients à relancer",
          message: `${inactivePatients.length} patient${inactivePatients.length > 1 ? "s" : ""} régulier${inactivePatients.length > 1 ? "s" : ""} n'${inactivePatients.length > 1 ? "ont" : "a"} pas consulté depuis 60+ jours : ${names}${inactivePatients.length > 3 ? "…" : ""}. Un message de suivi peut relancer l'activité.`,
          metric: `${inactivePatients.length} patient${inactivePatients.length > 1 ? "s" : ""}`,
        });
      }

      // Outlier amounts
      if (outlierInvoices.length > 0) {
        insights.push({
          category: "alert",
          severity: "warning",
          title: "Montants atypiques",
          message: `${outlierInvoices.length} facture${outlierInvoices.length > 1 ? "s" : ""} avec un montant inhabituel détecté${outlierInvoices.length > 1 ? "s" : ""} (écart > 2× l'écart-type). Vérifiez qu'il ne s'agit pas d'erreurs de saisie.`,
          metric: `${outlierInvoices.length} facture${outlierInvoices.length > 1 ? "s" : ""}`,
        });
      }

      // Best day
      if (dayOfWeekCount[bestDay] >= 3) {
        insights.push({
          category: "info",
          severity: "neutral",
          title: "Jour le plus rentable",
          message: `Le ${dayNames[bestDay]} est votre jour le plus actif avec ${dayOfWeekCount[bestDay]} paiements reçus. Envisagez d'ouvrir plus de créneaux ce jour-là.`,
          metric: dayNames[bestDay],
        });
      }

      // Average invoice
      if (paidInvoices.length >= 3) {
        insights.push({
          category: "info",
          severity: "neutral",
          title: "Panier moyen",
          message: `Votre consultation moyenne est facturée ${avgInvoiceAmount.toFixed(2)}€ (médiane : ${medianAmount.toFixed(2)}€) sur ${paidInvoices.length} factures payées.`,
          metric: `${avgInvoiceAmount.toFixed(0)}€`,
        });
      }

      // Top patient
      if (topPatients.length > 0 && topPatients[0].count >= 2) {
        insights.push({
          category: "info",
          severity: "positive",
          title: "Patient le plus fidèle",
          message: `${topPatients[0].name} est votre meilleur patient avec ${topPatients[0].count} consultations pour un total de ${topPatients[0].total.toFixed(2)}€.`,
          metric: `${topPatients[0].count} consult.`,
        });
      }

      // Welcome
      if (invoices.length === 0) {
        insights.push({
          category: "info",
          severity: "neutral",
          title: "Bienvenue !",
          message: "Vos factures apparaîtront ici automatiquement après chaque paiement via Stripe, ou vous pouvez en créer manuellement. L'assistant IA analysera votre activité au fil du temps.",
        });
      }

      if (avgDaysToPayment !== null && avgDaysToPayment > 7) {
        insights.push({
          category: "optimization",
          severity: avgDaysToPayment > 30 ? "warning" : "neutral",
          title: "Délai d'encaissement",
          message: `Les factures manuelles sont réglées en moyenne ${avgDaysToPayment.toFixed(0)} jours après émission. Le paiement en ligne via Stripe est instantané et réduit ce délai à zéro.`,
          metric: `${avgDaysToPayment.toFixed(0)}j`,
        });
      }
    }

    // Sort by severity priority
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, positive: 2, neutral: 3 };
    insights.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return NextResponse.json({ stats, insights, forecast });
  } catch (error) {
    console.error("GET /api/facturation/ai-insights error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });
