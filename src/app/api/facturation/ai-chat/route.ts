import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { secrets } from "@/lib/vault";
import { REMBOURSEMENT_AI_RULES } from "@/lib/remboursement";
import { CANCELLATION_AI_RULES } from "@/lib/cancellation";
import OpenAI from "openai";

// ─── Helpers ───

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getQuarterLabel(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `T${q} ${date.getFullYear()}`;
}

/**
 * POST /api/facturation/ai-chat
 *
 * Streaming AI chat (SSE) for invoice management.
 * Enriched data context with prestation breakdown, collection rate, YoY, patient LTV, quarterly stats.
 */
export const POST = withAuth(async (request: NextRequest, ctx) => {
  try {
    const pro = ctx.session;

    if (!secrets.hasOpenAI()) {
      return NextResponse.json({
        reply: "L'assistant IA n'est pas disponible pour le moment. Veuillez vérifier que la clé OpenAI est configurée.",
      });
    }

    const body = await request.json();
    const userMessage = body.message?.trim();
    const history: { role: string; content: string }[] = body.history || [];
    const stream = body.stream !== false;

    if (!userMessage) {
      return NextResponse.json({ error: "Message requis" }, { status: 400 });
    }

    // ═══════════════════════════════════════
    // FETCH & COMPUTE RICH CONTEXT
    // ═══════════════════════════════════════

    const invoices = await (prisma as any).invoice.findMany({
      where: { professionnelId: pro.id, deletedAt: null },
      include: {
        athlete: { select: { name: true } },
        athleteUser: { select: { prenom: true, nom: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const paidInvoices = invoices.filter((i: any) => i.status === "paid");
    const unpaidInvoices = invoices.filter((i: any) => i.status === "unpaid" || i.status === "overdue");
    const overdueInvoices = unpaidInvoices.filter((i: any) => new Date(i.dueDate) < now);
    const stripeInvoices = invoices.filter((i: any) => i.source === "stripe");
    const manualInvoices = invoices.filter((i: any) => i.source === "manual");

    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + i.amount, 0);
    const totalUnpaid = unpaidInvoices.reduce((s: number, i: any) => s + i.amount, 0);
    const avgAmount = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;
    const collectionRate = invoices.length > 0
      ? ((paidInvoices.length / invoices.length) * 100).toFixed(1)
      : "N/A";

    // Monthly revenue map (12 months)
    const monthlyMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      monthlyMap[getMonthKey(d)] = 0;
    }
    for (const inv of paidInvoices) {
      const d = new Date(inv.paidDate || inv.createdAt);
      const key = getMonthKey(d);
      if (monthlyMap[key] !== undefined) monthlyMap[key] += inv.amount;
    }

    const monthlyRevenue = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, rev]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
        return `${label}: ${rev.toFixed(2)}€`;
      });

    // Quarterly stats
    const quarterlyMap: Record<string, { revenue: number; count: number }> = {};
    for (const inv of paidInvoices) {
      const d = new Date(inv.paidDate || inv.createdAt);
      const ql = getQuarterLabel(d);
      if (!quarterlyMap[ql]) quarterlyMap[ql] = { revenue: 0, count: 0 };
      quarterlyMap[ql].revenue += inv.amount;
      quarterlyMap[ql].count += 1;
    }
    const quarterlyStats = Object.entries(quarterlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([q, d]) => `${q}: ${d.revenue.toFixed(2)}€ (${d.count} fact.)`)
      .join(" | ");

    // YoY comparison
    const thisYearRevenue = paidInvoices
      .filter((i: any) => new Date(i.paidDate || i.createdAt).getFullYear() === thisYear)
      .reduce((s: number, i: any) => s + i.amount, 0);
    const lastYearRevenue = paidInvoices
      .filter((i: any) => new Date(i.paidDate || i.createdAt).getFullYear() === thisYear - 1)
      .reduce((s: number, i: any) => s + i.amount, 0);

    // Prestation type breakdown
    const prestationMap: Record<string, { revenue: number; count: number }> = {};
    for (const inv of paidInvoices) {
      const pt = inv.prestationType || "Non catégorisé";
      if (!prestationMap[pt]) prestationMap[pt] = { revenue: 0, count: 0 };
      prestationMap[pt].revenue += inv.amount;
      prestationMap[pt].count += 1;
    }
    const prestationBreakdown = Object.entries(prestationMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([type, d]) => `${type}: ${d.revenue.toFixed(2)}€ (${d.count} fact.)`)
      .join(" | ");

    // Patient map with LTV and last visit
    const patientMap: Record<string, { name: string; total: number; count: number; lastDate: Date; unpaid: number; invoices: string[] }> = {};
    for (const inv of invoices) {
      const name = inv.athleteUser
        ? `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`
        : inv.athlete?.name || "Non assigné";
      if (!patientMap[name]) patientMap[name] = { name, total: 0, count: 0, lastDate: new Date(0), unpaid: 0, invoices: [] };
      if (inv.status === "paid") patientMap[name].total += inv.amount;
      else patientMap[name].unpaid += inv.amount;
      patientMap[name].count += 1;
      const d = new Date(inv.paidDate || inv.createdAt);
      if (d > patientMap[name].lastDate) patientMap[name].lastDate = d;
      patientMap[name].invoices.push(
        `${inv.number} | ${inv.amount.toFixed(2)}€ | ${inv.status} | ${inv.source} | ${new Date(inv.createdAt).toLocaleDateString("fr-FR")}`
      );
    }

    // Inactive patients (>60 days, ≥2 visits)
    const inactiveThreshold = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const inactivePatients = Object.values(patientMap)
      .filter((p) => p.count >= 2 && p.lastDate < inactiveThreshold)
      .sort((a, b) => a.lastDate.getTime() - b.lastDate.getTime());

    // Recent invoices (last 15)
    const recentInvoices = invoices.slice(0, 15).map((inv: any) => {
      const patient = inv.athleteUser
        ? `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`
        : inv.athlete?.name || "—";
      return `${inv.number} | ${patient} | ${inv.amount.toFixed(2)}€ | ${inv.status} | ${inv.source} | ${inv.prestationType || "—"} | ${new Date(inv.createdAt).toLocaleDateString("fr-FR")}`;
    });

    // Average days to payment (manual)
    const manualPaid = manualInvoices.filter((i: any) => i.status === "paid" && i.paidDate);
    const avgDaysToPayment = manualPaid.length > 0
      ? (manualPaid.reduce((s: number, i: any) =>
          s + (new Date(i.paidDate).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        , 0) / manualPaid.length).toFixed(1)
      : null;

    // ═══════════════════════════════════════
    // BUILD CONTEXT
    // ═══════════════════════════════════════

    const dataContext = `
DONNÉES FACTURATION EN TEMPS RÉEL :

RÉSUMÉ GLOBAL :
• Total : ${invoices.length} factures (${paidInvoices.length} payées, ${unpaidInvoices.length} impayées, ${overdueInvoices.length} en retard)
• CA total : ${totalRevenue.toFixed(2)}€ | Impayés : ${totalUnpaid.toFixed(2)}€
• Montant moyen : ${avgAmount.toFixed(2)}€
• Taux de recouvrement : ${collectionRate}%
• Sources : ${stripeInvoices.length} Stripe (auto), ${manualInvoices.length} manuelles
${avgDaysToPayment ? `• Délai moyen d'encaissement (manuel) : ${avgDaysToPayment} jours` : ""}

COMPARAISON ANNUELLE :
• ${thisYear} (en cours) : ${thisYearRevenue.toFixed(2)}€
${lastYearRevenue > 0 ? `• ${thisYear - 1} : ${lastYearRevenue.toFixed(2)}€ (${thisYearRevenue >= lastYearRevenue ? "+" : ""}${((thisYearRevenue - lastYearRevenue) / lastYearRevenue * 100).toFixed(1)}%)` : `• ${thisYear - 1} : Aucune donnée`}

TENDANCE MENSUELLE (6 mois) : ${monthlyRevenue.join(" | ")}
STATS TRIMESTRIELLES : ${quarterlyStats || "Pas assez de données"}

PRESTATIONS : ${prestationBreakdown || "Aucune catégorisation"}

15 DERNIÈRES FACTURES :
${recentInvoices.join("\n")}

PATIENTS (${Object.keys(patientMap).length}) — Top 15 par CA :
${Object.values(patientMap).sort((a, b) => b.total - a.total).slice(0, 15).map(p =>
  `• ${p.name} — CA: ${p.total.toFixed(2)}€ — ${p.count} facture(s) — Impayés: ${p.unpaid.toFixed(2)}€ — Dernière visite: ${p.lastDate.toLocaleDateString("fr-FR")}`
).join("\n")}

${inactivePatients.length > 0 ? `PATIENTS INACTIFS (>60j, ≥2 consult.) :\n${inactivePatients.slice(0, 8).map(p => `• ${p.name} — ${p.count} consult. — ${p.total.toFixed(2)}€ — Dernière visite: ${p.lastDate.toLocaleDateString("fr-FR")}`).join("\n")}` : ""}

${overdueInvoices.length > 0 ? `FACTURES EN RETARD :\n${overdueInvoices.map((i: any) => {
  const patient = i.athleteUser ? `${i.athleteUser.prenom} ${i.athleteUser.nom}` : i.athlete?.name || "—";
  const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return `• ${i.number} — ${patient} — ${i.amount.toFixed(2)}€ — ${days}j de retard — échéance: ${new Date(i.dueDate).toLocaleDateString("fr-FR")}`;
}).join("\n")}` : "AUCUNE FACTURE EN RETARD."}

DATE ACTUELLE : ${now.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
`;

    const systemPrompt = `Tu es l'assistant IA de facturation de Tuatha, plateforme de suivi sport-santé pour professionnels. Tu es un expert en gestion financière, comptabilité et optimisation de cabinet.

CAPACITÉS AVANCÉES :
1. Analyse financière — CA, marges, tendances, saisonnalité, prévisions
2. Gestion des impayés — identification, priorisation, stratégies de relance
3. Optimisation — tarification, mix de prestations, créneaux rentables
4. Analyse patient — LTV (lifetime value), fidélisation, risque d'attrition
5. Préparation fiscale — estimation charges, TVA, provisions, calendrier fiscal
6. Benchmarking — comparaison YoY, trimestre vs trimestre
7. Conseil stratégique — développement d'activité, diversification

FORMATAGE :
- Utilise **gras** pour les chiffres clés et les points importants
- Utilise des listes à puces pour structurer
- Utilise des retours à la ligne pour la lisibilité
- Ajoute des émojis pertinents (📊 💰 ⚠️ 📈 📉 💡 🎯) pour guider visuellement

RÈGLES STRICTES :
1. Réponds TOUJOURS en français
2. Tutoie le professionnel, sois bienveillant mais expert
3. Base-toi UNIQUEMENT sur les données fournies — ne fabrique JAMAIS de chiffres
4. Sois précis : cite les montants exacts, les noms de patients, les numéros de factures quand pertinent
5. Si la question sort du périmètre des données, dis-le et propose ce que tu PEUX analyser
6. Pour les conseils fiscaux/juridiques complexes, recommande un expert-comptable
7. Adapte la longueur : réponse courte pour question simple, détaillée pour analyse complexe
8. Propose toujours une action concrète à la fin de ta réponse

${REMBOURSEMENT_AI_RULES}

${CANCELLATION_AI_RULES}`;

    const openai = new OpenAI({ apiKey: secrets.openaiApiKey() });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: dataContext },
    ];

    // Add conversation history (last 20 messages)
    const trimmedHistory = history.slice(-20);
    for (const msg of trimmedHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
    messages.push({ role: "user", content: userMessage });

    // ═══════════════════════════════════════
    // STREAMING RESPONSE (SSE)
    // ═══════════════════════════════════════

    if (stream) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 1000,
        temperature: 0.5,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Erreur de génération" })}\n\n`));
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ═══════════════════════════════════════
    // NON-STREAMING FALLBACK
    // ═══════════════════════════════════════

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1000,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/facturation/ai-chat error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });
