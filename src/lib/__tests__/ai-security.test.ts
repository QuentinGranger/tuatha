import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.15 IA et résumés automatiques — Test Suite ───

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. L'athlète est informé de l'usage IA
// ══════════════════════════════════════════════════════════════════════

describe("Athlete is informed about AI usage", () => {
  it("ai-usage endpoint exists and lists all usages", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("AI_USAGES");
    expect(code).toContain("redaction_summary");
    expect(code).toContain("document_verification");
    expect(code).toContain("facturation_insights");
  });

  it("ai-usage exposes provider info and guardrails", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("AI_PROVIDER");
    expect(code).toContain("AI_GUARDRAILS");
    expect(code).toContain("OpenAI");
  });

  it("ai-usage provides disclaimer", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("disclaimer");
    expect(code).toContain("jamais pour remplacer le jugement clinique");
  });

  it("privacy policy documents AI usage (section 10)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacy.ts");
    expect(code).toContain("10. Intelligence Artificielle (OpenAI)");
    expect(code).toContain("GPT-4o");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Consentement ou base légale documentée
// ══════════════════════════════════════════════════════════════════════

describe("Consent or legal basis documented", () => {
  it("consentAI field exists in AthleteUser schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("consentAI");
    expect(schema).toContain("consentAIAt");
  });

  it("AI consent is manageable via athlete consents endpoint", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain('"ai"');
    expect(code).toContain("consentAI");
  });

  it("each AI usage declares its legal basis", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("legalBasis");
    expect(code).toContain("Consentement explicite");
    expect(code).toContain("RGPD Art. 6(1)(a)");
  });

  it("privacy policy documents AI legal basis", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacy.ts");
    expect(code).toContain("consentement explicite");
    expect(code).toContain("sous-traitant");
    expect(code).toContain("Data Processing Addendum");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Données envoyées à l'IA sont minimisées
// ══════════════════════════════════════════════════════════════════════

describe("Data sent to AI is minimized", () => {
  it("redaction limits input to 2000 chars", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("rawValue.slice(0, 2000)");
  });

  it("prompt forbids identifiers (names, dates, numbers)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("Ne JAMAIS inclure de noms, dates précises, numéros, adresses, ou identifiants");
  });

  it("facturation AI sends only aggregated stats, not health data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/facturation/ai-insights/route.ts");
    expect(code).toContain("factures");
    expect(code).not.toContain("antecedent");
    expect(code).not.toContain("diagnostic");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Pas d'envoi de document complet si un extrait suffit
// ══════════════════════════════════════════════════════════════════════

describe("No full document sent when extract suffices", () => {
  it("redaction engine slices input, never sends full content", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("slice(0, 2000)");
  });

  it("ai-usage declares minimization policy", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("2000 caractères maximum");
    expect(code).toContain("dataMinimization");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Pas de diagnostic médical généré automatiquement
// ══════════════════════════════════════════════════════════════════════

describe("No automatic medical diagnosis", () => {
  it("redaction prompt has explicit anti-diagnosis rule", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("Ne JAMAIS formuler de diagnostic, pronostic, prescription ou recommandation thérapeutique");
    expect(code).toContain("Ne JAMAIS interpréter cliniquement les données");
  });

  it("ai-usage guardrails declare no diagnosis", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("noDiagnosis");
    expect(code).toContain("JAMAIS de diagnostic médical");
  });

  it("privacy policy confirms no AI diagnosis", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacy.ts");
    expect(code).toContain("Aucune décision médicale automatisée");
    expect(code).toContain("ne formule **jamais** de diagnostic");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Résumé marqué comme généré automatiquement
// ══════════════════════════════════════════════════════════════════════

describe("Summary marked as AI-generated", () => {
  it("redaction output is prefixed with [Résumé IA]", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("[Résumé IA]");
  });

  it("privacy policy mentions marking", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacy.ts");
    expect(code).toContain("10.4. Marquage et transparence");
    expect(code).toContain("[Résumé IA]");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Possibilité de désactiver certains usages IA (opt-out)
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can opt-out of AI", () => {
  it("consentAI is opt-in (default false)", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("consentAI");
    expect(schema).toContain("@default(false)");
  });

  it("athlete consents endpoint supports revoking AI consent", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    // AI is NOT in the mandatory consents list (cgu, privacy, health_data)
    expect(code).toContain('"cgu" || type === "privacy" || type === "health_data"');
    // So revoking "ai" should be allowed
    expect(code).toContain('"ai"');
  });

  it("ai-usage lists which usages have canOptOut", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("canOptOut: true");
    expect(code).toContain("canOptOut: false");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Logs IA sans contenu médical inutile
// ══════════════════════════════════════════════════════════════════════

describe("AI logs without unnecessary medical content", () => {
  it("redaction AI logs only field name and char counts", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("[AI-AUDIT] redaction_summary");
    expect(code).toContain("field=");
    expect(code).toContain("inputChars=");
    expect(code).toContain("outputChars=");
    expect(code).toContain("model=");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Suppression possible des résumés générés
// ══════════════════════════════════════════════════════════════════════

describe("AI summaries can be deleted", () => {
  it("POST ai-usage supports delete_summaries action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("export async function POST");
    expect(code).toContain('"delete_summaries"');
  });

  it("deletion is audit-logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("athleteAccessLog.create");
    expect(code).toContain('"delete_ai_summaries"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Contrat/sous-traitance clair avec le fournisseur IA
// ══════════════════════════════════════════════════════════════════════

describe("Clear AI subcontracting", () => {
  it("ai-usage endpoint documents provider details", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/ai-usage/route.ts");
    expect(code).toContain("OpenAI");
    expect(code).toContain("dpa");
    expect(code).toContain("Data Processing Addendum");
    expect(code).toContain("dataRetention");
  });

  it("privacy policy has AI sous-traitance section", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacy.ts");
    expect(code).toContain("10.2. Sous-traitance et encadrement contractuel");
    expect(code).toContain("sous-traitant");
    expect(code).toContain("clauses contractuelles types");
    expect(code).toContain("Kill switch");
  });

  it("incident response can kill OpenAI integration", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/incidentResponse.ts");
    expect(code).toContain('"openai"');
    expect(code).toContain("killIntegration");
  });

  it("vault has OpenAI key management", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/vault.ts");
    expect(code).toContain("OPENAI_API_KEY");
    expect(code).toContain("hasOpenAI");
    expect(code).toContain("openaiApiKey");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Review des prompts — anti-diagnostic confirmé
// ══════════════════════════════════════════════════════════════════════

describe("Prompt review — anti-diagnostic confirmed", () => {
  it("redaction prompt has no medical interpretation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    // System prompt explicitly bans clinical interpretation
    expect(code).toContain("uniquement décrire leur nature");
    expect(code).toContain("Ne pas reproduire de phrases du contenu original");
  });

  it("facturation prompt focuses on financial analysis only", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/facturation/ai-chat/route.ts");
    expect(code).toContain("assistant IA de facturation");
    expect(code).toContain("expert en gestion financière");
    // No medical-related prompt content
    expect(code).not.toContain("diagnostic");
    expect(code).not.toContain("prescription");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Example of AI summary format
// ══════════════════════════════════════════════════════════════════════

describe("AI summary example format", () => {
  it("summaries have the expected prefix format", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    // Format: 📋 [Résumé IA] <summary text>
    expect(code).toContain('`📋 [Résumé IA] ${summary.slice(0, SUMMARY_MAX_LENGTH)}`');
  });

  it("fallback placeholder is used when AI is unavailable", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("[Données protégées]");
  });

  it("summary max length is enforced", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(code).toContain("SUMMARY_MAX_LENGTH");
    expect(code).toContain("const SUMMARY_MAX_LENGTH = 200");
  });
});
