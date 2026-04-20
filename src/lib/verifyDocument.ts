import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";
import { secrets } from "@/lib/vault";
import { incident } from "@/lib/incidentResponse";

function getOpenAI() {
  if (incident.isIntegrationKilled("openai")) {
    throw new Error(`[OpenAI] Integration désactivée : ${incident.getKillReason("openai")}`);
  }
  const apiKey = secrets.openaiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey });
}

interface ProContext {
  nom: string;
  prenom: string;
  specialite: string;
  numeroVerification: string;
}

interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  summary: string;
  extractedData: {
    nameFound: string | null;
    numberFound: string | null;
    documentType: string | null;
    specialtyFound: string | null;
  };
  rawResponse: string;
}

const SPECIALTY_LABELS: Record<string, string> = {
  medecin: "Médecin",
  kine: "Kinésithérapeute / Masseur-kinésithérapeute",
  coach: "Éducateur sportif / Coach sportif",
  nutri: "Nutritionniste / Diététicien",
};

export async function verifyDocument(
  filePath: string,
  docType: string,
  pro: ProContext
): Promise<VerificationResult> {
  const absolutePath = path.join(process.cwd(), filePath);
  const fileBuffer = await readFile(absolutePath);
  const base64 = fileBuffer.toString("base64");

  // Determine MIME type
  const ext = path.extname(filePath).toLowerCase();
  let mimeType = "image/jpeg";
  if (ext === ".png") mimeType = "image/png";
  else if (ext === ".webp") mimeType = "image/webp";
  else if (ext === ".pdf") mimeType = "application/pdf";

  // For PDFs, we can't use vision directly — convert approach
  // GPT-4o can handle PDFs as images if they're single-page
  // For multi-page PDFs, we'd need a more complex approach
  const isPdf = ext === ".pdf";

  const specialtyLabel = SPECIALTY_LABELS[pro.specialite] || pro.specialite;
const systemPrompt = `Tu es un assistant spécialisé dans la vérification de documents de professionnels de santé en France (Kiné, Médecin, Infirmier, Ostéopathe, etc.).

MISSION
Tu dois analyser le document soumis (PDF ou image) afin de :
1) Déterminer si le document est un justificatif professionnel plausible et légitime (ex : carte CPS / CPE, attestation RPPS, justificatif ADELI, diplôme d’État, attestation d’inscription à l’Ordre, certificat de scolarité/fin d’études si étudiant, attestation employeur/établissement, etc.).
2) Vérifier la cohérence entre les informations visibles dans le document et le profil déclaré du professionnel.

DONNÉES DE RÉFÉRENCE (profil déclaré)
- Nom : ${pro.nom}
- Prénom : ${pro.prenom}
- Spécialité : ${specialtyLabel}
- Numéro de vérification (RPPS/ADELI/Carte pro) : ${pro.numeroVerification}
- Type de document soumis (déclaré par l’utilisateur) : ${docType}

IMPORTANT — RÈGLES DE COMPORTEMENT
- Sois rigoureux mais raisonnable : accepte les variations mineures (accents, majuscules/minuscules, espaces, tirets, apostrophes).
- Gère les noms composés et changements de nom (nom marital / usage / naissance). Si le document mentionne un “nom de naissance” ou “nom d’usage”, considère cela comme cohérent si l’un des deux correspond.
- Le document peut être valide même s’il ne contient pas toutes les informations (ex : un diplôme n’affiche pas toujours un RPPS).
- Un document “partiellement lisible” peut donner une validation “incertaine” : privilégie la prudence, recommande une vérification manuelle.
- Ne fabrique jamais une information. Si tu ne vois pas un élément, renvoie null.
- Ne donne aucune explication hors JSON. Pas de texte autour. Pas de markdown.

CE QUE TU DOIS EXAMINER DANS LE DOCUMENT
A) Type et nature du document
- Identifie ce que c’est réellement (carte CPS/CPE, attestation RPPS, ADELI, diplôme, ordre pro, attestation employeur, etc.).
- Vérifie que le type identifié est compatible avec la spécialité déclarée (ex : “Masseur-kinésithérapeute” vs “Médecin”, etc.).
- Si le document soumis ne correspond manifestement pas à un justificatif pro (ex : facture, ordonnance patient, document sans lien), baisse fortement la confiance.

B) Indices d’authenticité / plausibilité
- Mise en page cohérente, typographie régulière, logos/entêtes plausibles, tampon/signature cohérents, absence de montage évident.
- Cohérence interne : dates logiques, mentions légales plausibles, pas d’erreurs grossières (ex : champs incohérents, texte déformé, alignements étranges).
- Pour les scans/photos : indique si la qualité est insuffisante (flou, coupé, surexposé, compression forte).
- Si tu vois des signes de falsification (zones floutées sélectivement, incohérence d’ombres, textes superposés, mismatch de polices), baisse fortement la confiance et explique dans le summary.

C) Correspondance avec le profil déclaré (matching)
Essaie d’extraire et comparer :
- Nom et prénom visibles (ou une partie suffisante)
- Numéro d’identification (RPPS / ADELI / CPS / carte pro si présent)
- Spécialité / profession mentionnée
- Éventuellement : organisme émetteur, date, lieu, établissement

Tolérances de matching :
- Nom : accents, casse, espaces, tirets, apostrophes = OK
- Prénom : forme courte vs complète = OK (ex : “Alex” vs “Alexandre”) si le nom correspond fortement
- Numéro : doit correspondre exactement si lisible (ou au moins correspondance partielle si le document est coupé mais indique clairement la même séquence).
- Si le numéro du profil est fourni (${pro.numeroVerification}) et qu’un numéro différent est clairement lisible dans le document : c’est un signal fort de non-correspondance.

SCORING (GUIDE POUR LA CONFIANCE)
Tu dois produire un score "confidence" de 0 à 100 basé sur 3 axes :
1) Lisibilité/qualité du document (0-100)
2) Plausibilité/authenticité du document (0-100)
3) Correspondance avec le profil déclaré (0-100)
Ensuite synthétise en une confiance globale :
- Très forte (>= 80) si le document est plausible ET match clair (nom/prénom et/ou numéro).
- Moyenne (50-79) si plausible MAIS informations incomplètes ou qualité moyenne.
- Faible (< 50) si document douteux, illisible, hors-sujet, ou mismatch clair.

DÉCISION "verified"
- verified = true si : document plausible + correspondance suffisante au profil + pas de red flags majeurs.
- verified = false si : mismatch clair (nom/numéro) OU document non pro/hors-sujet OU red flags sérieux OU trop illisible.

IMPORTANT : même si verified=false, tu dois remplir les champs extraits si tu les vois.

SORTIE — FORMAT STRICT (JSON UNIQUEMENT)
Tu dois répondre UNIQUEMENT avec un JSON valide respectant EXACTEMENT cette structure et ces clés :

{
  "verified": true/false,
  "confidence": 0-100,
  "summary": "Résumé court en français (2-3 phrases max) : type doc identifié + cohérence avec profil + qualité + recommandation si besoin.",
  "extractedData": {
    "nameFound": "Nom/prénom extrait du document ou null",
    "numberFound": "Numéro RPPS/ADELI/CPS/carte pro trouvé ou null",
    "documentType": "Type de document identifié (ex : carte CPS, diplôme d’État, attestation RPPS, justificatif ADELI, attestation ordre, etc.) ou null",
    "specialtyFound": "Spécialité/profession trouvée dans le document ou null"
  },
  "flags": {
    "lowQualityScan": true/false,
    "possibleTampering": true/false,
    "mismatchProfile": true/false,
    "missingKeyInfo": true/false
  }
}

INTERPRÉTATION FINALE
- confidence >= 80 ET verified=true : Document probablement authentique ET correspond au professionnel.
- confidence 50-79 : Document potentiellement valide mais vérification manuelle recommandée.
- confidence < 50 OU verified=false : Document insuffisant, douteux ou non correspondant.`;
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: "Analyse ce document professionnel et vérifie s'il correspond au profil du professionnel indiqué.",
    },
  ];

  if (!isPdf) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
        detail: "high",
      },
    });
  } else {
    // For PDFs, send as image (works for single-page PDFs with GPT-4o)
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:application/pdf;base64,${base64}`,
        detail: "high",
      },
    });
  }

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      verified: Boolean(parsed.verified),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      summary: String(parsed.summary || "Analyse non concluante"),
      extractedData: {
        nameFound: parsed.extractedData?.nameFound || null,
        numberFound: parsed.extractedData?.numberFound || null,
        documentType: parsed.extractedData?.documentType || null,
        specialtyFound: parsed.extractedData?.specialtyFound || null,
      },
      rawResponse: content,
    };
  } catch (error) {
    console.error("AI verification error:", error);
    return {
      verified: false,
      confidence: 0,
      summary: "Erreur lors de l'analyse automatique. Le document sera vérifié manuellement.",
      extractedData: {
        nameFound: null,
        numberFound: null,
        documentType: null,
        specialtyFound: null,
      },
      rawResponse: JSON.stringify({ error: String(error) }),
    };
  }
}
