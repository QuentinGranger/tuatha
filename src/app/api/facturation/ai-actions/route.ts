import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { secrets } from "@/lib/vault";
import { REMBOURSEMENT_AI_RULES } from "@/lib/remboursement";
import { CANCELLATION_AI_RULES } from "@/lib/cancellation";
import OpenAI from "openai";

/**
 * POST /api/facturation/ai-actions
 *
 * AI-powered actions:
 *  - "generate-relance"  → draft payment reminder email for an overdue invoice
 *  - "risk-scores"       → compute risk score (0-100) for each unpaid invoice
 *  - "monthly-summary"   → full AI-generated monthly financial summary
 *  - "smart-description" → AI-generated invoice description from context
 *  - "optimize-pricing"  → pricing recommendations based on data
 */
export const POST = withAuth(async (request: NextRequest, ctx) => {
  try {
    const pro = ctx.session;

    if (!secrets.hasOpenAI()) {
      return NextResponse.json({ error: "OpenAI non configuré" }, { status: 503 });
    }

    const body = await request.json();
    const action: string = body.action;

    if (!action) {
      return NextResponse.json({ error: "Action requise" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: secrets.openaiApiKey() });

    // Fetch all invoices for this pro
    const invoices = await (prisma as any).invoice.findMany({
      where: { professionnelId: pro.id, deletedAt: null },
      include: {
        athlete: { select: { name: true } },
        athleteUser: { select: { prenom: true, nom: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const paidInvoices = invoices.filter((i: any) => i.status === "paid");
    const unpaidInvoices = invoices.filter((i: any) => i.status === "unpaid" || i.status === "overdue");
    const overdueInvoices = unpaidInvoices.filter((i: any) => new Date(i.dueDate) < now);

    // ═══════════════════════════════════════
    // ACTION: Generate payment reminder email
    // ═══════════════════════════════════════
    if (action === "generate-relance") {
      const invoiceId = body.invoiceId;
      const tone: string = body.tone || "professional"; // professional, friendly, firm
      const invoice = invoices.find((i: any) => i.id === invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      }

      const patientName = invoice.athleteUser
        ? `${invoice.athleteUser.prenom} ${invoice.athleteUser.nom}`
        : invoice.athlete?.name || "Patient";

      const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)));

      const proProfile = await (prisma as any).professionnel.findUnique({
        where: { id: pro.id },
        select: { prenom: true, nom: true, specialite: true, adresseCabinet: true },
      });

      const proName = proProfile ? `${proProfile.prenom} ${proProfile.nom}` : "Votre professionnel de santé";

      const toneInstructions: Record<string, string> = {
        professional: "Ton formel et professionnel, respectueux. Utilise le vouvoiement.",
        friendly: "Ton chaleureux et bienveillant, empathique. Utilise le vouvoiement avec une touche personnelle.",
        firm: "Ton ferme mais correct, insistant sur l'urgence du paiement. Utilise le vouvoiement.",
      };

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant qui rédige des emails de relance de paiement pour des professionnels de santé.

RÈGLES :
- Rédige en français
- ${toneInstructions[tone] || toneInstructions.professional}
- L'email doit contenir : objet, corps, et signature
- Mentionne le numéro de facture, le montant, et la date d'échéance
- Ne fais JAMAIS de menaces légales
- Propose des solutions (paiement échelonné si approprié)
- Retourne l'email au format JSON : { "subject": "...", "body": "..." }

${REMBOURSEMENT_AI_RULES}

${CANCELLATION_AI_RULES}`,
          },
          {
            role: "user",
            content: `Rédige un email de relance pour :
- Patient : ${patientName}
- Facture n° : ${invoice.number}
- Montant : ${invoice.amount.toFixed(2)}€
- Description : ${invoice.description}
- Date d'émission : ${new Date(invoice.createdAt).toLocaleDateString("fr-FR")}
- Date d'échéance : ${new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
- Retard : ${daysOverdue} jours
- Professionnel : ${proName}
- Ton : ${tone}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.4,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return NextResponse.json({
        email: {
          subject: result.subject || `Relance — Facture ${invoice.number}`,
          body: result.body || "Erreur de génération.",
          patientName,
          patientEmail: invoice.athleteUser?.email || null,
          invoiceNumber: invoice.number,
          amount: invoice.amount,
          daysOverdue,
        },
      });
    }

    // ═══════════════════════════════════════
    // ACTION: Compute risk scores for unpaid invoices
    // ═══════════════════════════════════════
    if (action === "risk-scores") {
      const riskScores: { invoiceId: string; number: string; score: number; level: string; reason: string }[] = [];

      for (const inv of unpaidInvoices) {
        const patientName = inv.athleteUser
          ? `${inv.athleteUser.prenom} ${inv.athleteUser.nom}`
          : inv.athlete?.name || "Non assigné";

        // Heuristic risk score
        let score = 30; // Base risk

        // Days overdue factor
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 0) score += Math.min(daysOverdue * 1.5, 40);

        // Amount factor (higher amount = higher risk)
        const avgAmount = paidInvoices.length > 0 ? paidInvoices.reduce((s: number, i: any) => s + i.amount, 0) / paidInvoices.length : 50;
        if (inv.amount > avgAmount * 2) score += 10;
        if (inv.amount > avgAmount * 3) score += 10;

        // Patient history factor
        const patientInvoices = invoices.filter((i: any) => {
          const n1 = i.athleteUser ? `${i.athleteUser.prenom} ${i.athleteUser.nom}` : i.athlete?.name;
          return n1 === patientName;
        });
        const patientPaid = patientInvoices.filter((i: any) => i.status === "paid").length;
        const patientTotal = patientInvoices.length;
        if (patientTotal > 1) {
          const payRate = patientPaid / patientTotal;
          if (payRate < 0.5) score += 15;
          else if (payRate >= 0.8) score -= 15;
        }

        // Source factor (manual more risky than stripe)
        if (inv.source === "manual") score += 5;

        score = Math.max(0, Math.min(100, Math.round(score)));

        let level = "low";
        let reason = "Risque modéré";
        if (score >= 70) { level = "high"; reason = daysOverdue > 30 ? `${daysOverdue}j de retard, montant élevé` : `${daysOverdue}j de retard`; }
        else if (score >= 40) { level = "medium"; reason = daysOverdue > 0 ? `${daysOverdue}j de retard` : "Échéance proche"; }
        else { level = "low"; reason = "Bon historique patient"; }

        riskScores.push({
          invoiceId: inv.id,
          number: inv.number,
          score,
          level,
          reason,
        });
      }

      // Sort by risk score descending
      riskScores.sort((a, b) => b.score - a.score);

      return NextResponse.json({ riskScores });
    }

    // ═══════════════════════════════════════
    // ACTION: Monthly AI summary
    // ═══════════════════════════════════════
    if (action === "monthly-summary") {
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const thisMonthInvoices = invoices.filter((i: any) => {
        const d = new Date(i.createdAt);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      const thisMonthPaid = thisMonthInvoices.filter((i: any) => i.status === "paid");
      const thisMonthRevenue = thisMonthPaid.reduce((s: number, i: any) => s + i.amount, 0);
      const thisMonthUnpaid = thisMonthInvoices.filter((i: any) => i.status !== "paid");
      const thisMonthUnpaidTotal = thisMonthUnpaid.reduce((s: number, i: any) => s + i.amount, 0);

      // Last month comparison
      const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
      const lastMonthInvoices = invoices.filter((i: any) => {
        const d = new Date(i.createdAt);
        return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
      });
      const lastMonthRevenue = lastMonthInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0);

      // Prestation breakdown this month
      const prestaMap: Record<string, { revenue: number; count: number }> = {};
      for (const inv of thisMonthPaid) {
        const pt = inv.prestationType || "Non catégorisé";
        if (!prestaMap[pt]) prestaMap[pt] = { revenue: 0, count: 0 };
        prestaMap[pt].revenue += inv.amount;
        prestaMap[pt].count += 1;
      }

      const dataBlock = `
DONNÉES DU MOIS EN COURS (${now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}) :
• Factures émises : ${thisMonthInvoices.length}
• CA encaissé : ${thisMonthRevenue.toFixed(2)}€
• Impayés ce mois : ${thisMonthUnpaid.length} (${thisMonthUnpaidTotal.toFixed(2)}€)
• Factures en retard (global) : ${overdueInvoices.length}
• CA mois précédent : ${lastMonthRevenue.toFixed(2)}€
• Variation : ${lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : "N/A"}%
• Prestations ce mois : ${Object.entries(prestaMap).map(([t, d]) => `${t}: ${d.revenue.toFixed(2)}€ (${d.count})`).join(", ") || "Aucune"}
• Taux recouvrement global : ${invoices.length > 0 ? ((paidInvoices.length / invoices.length) * 100).toFixed(1) : "N/A"}%
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant financier expert. Génère un résumé mensuel structuré et actionnable pour un professionnel de santé.

FORMAT JSON REQUIS :
{
  "title": "Titre du résumé",
  "highlights": ["point fort 1", "point fort 2", ...],
  "warnings": ["alerte 1", ...],
  "recommendations": ["recommandation 1", ...],
  "outlook": "perspective pour le mois prochain"
}

RÈGLES :
- Maximum 3 highlights, 3 warnings, 3 recommendations
- Sois spécifique avec les chiffres
- Mentionne les tendances positives et négatives
- Propose des actions concrètes
- Tout en français, tutoyant le pro

${REMBOURSEMENT_AI_RULES}

${CANCELLATION_AI_RULES}`,
          },
          { role: "user", content: dataBlock },
        ],
        max_tokens: 600,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const summary = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return NextResponse.json({
        summary: {
          ...summary,
          month: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
          revenue: thisMonthRevenue,
          invoiceCount: thisMonthInvoices.length,
          unpaidCount: thisMonthUnpaid.length,
          lastMonthRevenue,
        },
      });
    }

    // ═══════════════════════════════════════
    // ACTION: Smart invoice description
    // ═══════════════════════════════════════
    if (action === "smart-description") {
      const patientName = body.patientName || "";
      const amount = body.amount || "";

      // Get last 5 descriptions for context
      const recentDescs = invoices.slice(0, 10).map((i: any) => i.description).filter(Boolean);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu génères des descriptions de factures professionnelles pour un professionnel de santé.
Retourne un JSON : { "suggestions": ["description 1", "description 2", "description 3"] }
- Maximum 3 suggestions courtes et professionnelles
- Inspire-toi des descriptions précédentes s'il y en a
- En français`,
          },
          {
            role: "user",
            content: `Patient : ${patientName || "Non précisé"}
Montant : ${amount || "Non précisé"}€
Descriptions précédentes : ${recentDescs.slice(0, 5).join(" | ") || "Aucune"}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return NextResponse.json({ suggestions: result.suggestions || [] });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/facturation/ai-actions error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "facturation" });
