// ─── Redaction Engine ───
// Automatically masks, omits, or AI-summarizes fields based on the caller's
// DataScopes and the field's sensitivity classification.
//
// Usage:
//   const safe = await redactRecord("Athlete", rawAthlete, scopes);
//   const safeList = await redactRecords("Session", rawSessions, scopes);

import type { DataCategory, ActionLevel } from "@/lib/abac";
import { meetsActionLevel } from "@/lib/abac";
import {
  MODEL_CLASSIFICATIONS,
  type FieldClassification,
  type RedactionMode,
} from "@/lib/medical-data";
import { secrets } from "@/lib/vault";

// ─── Constants ───

const MASK_PLACEHOLDER = "[Données protégées]";
const SUMMARY_PLACEHOLDER = "[Résumé non disponible]";
const SUMMARY_MAX_LENGTH = 200;

// ─── Core: check if a field is accessible ───

export function isFieldAccessible(
  classification: FieldClassification,
  scopes: Record<DataCategory, ActionLevel>
): boolean {
  const requiredLevel = classification.requiredLevel ?? "read";
  const actualLevel = scopes[classification.requiredCategory] ?? "none";

  switch (classification.sensitivity) {
    case "public":
      // Public fields are always visible to any connected pro
      return true;
    case "internal":
    case "confidential":
    case "restricted":
      return meetsActionLevel(actualLevel, requiredLevel);
    default:
      return false;
  }
}

// ─── AI Summarization ───

interface SummarizeOptions {
  fieldLabel: string;
  rawValue: string;
  context?: string;
}

/**
 * Generate a safe, non-revealing summary of a medical field using AI.
 * Returns a short summary that conveys the type of information without
 * exposing the raw content.
 */
async function aiSummarize({ fieldLabel, rawValue, context }: SummarizeOptions): Promise<string> {
  if (!secrets.hasOpenAI()) {
    return `${MASK_PLACEHOLDER} (${fieldLabel})`;
  }

  try {
    // Dynamic import to avoid loading OpenAI when not needed
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: secrets.openaiApiKey() });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "Tu es un assistant médical. Un professionnel de santé n'a pas accès aux données complètes d'un patient.",
            "Génère un RÉSUMÉ COURT et NON-IDENTIFIANT du contenu ci-dessous.",
            "Règles strictes :",
            "- Ne JAMAIS inclure de noms, dates précises, numéros, adresses, ou identifiants.",
            "- Ne pas reproduire de phrases du contenu original.",
            "- Résumer en 1-2 phrases maximum la NATURE de l'information (ex: 'Antécédents chirurgicaux notés').",
            "- Si le contenu est un JSON, décrire la structure sans les valeurs.",
            `- Le champ s'appelle : "${fieldLabel}".`,
            context ? `- Contexte : ${context}` : "",
          ].filter(Boolean).join("\n"),
        },
        {
          role: "user",
          content: rawValue.slice(0, 2000), // Limit input size
        },
      ],
    });

    const summary = response.choices?.[0]?.message?.content?.trim();
    return summary
      ? `📋 ${summary.slice(0, SUMMARY_MAX_LENGTH)}`
      : `${MASK_PLACEHOLDER} (${fieldLabel})`;
  } catch (error) {
    console.error(`[Redaction] AI summarize failed for ${fieldLabel}:`, error);
    return `${MASK_PLACEHOLDER} (${fieldLabel})`;
  }
}

// ─── Redact a single field value ───

async function redactField(
  value: unknown,
  classification: FieldClassification,
  mode: "sync" | "async"
): Promise<unknown> {
  switch (classification.redactionMode) {
    case "omit":
      return undefined;

    case "mask":
      return MASK_PLACEHOLDER;

    case "summarize":
      if (mode === "sync" || !value || typeof value !== "string") {
        return classification.label
          ? `${MASK_PLACEHOLDER} (${classification.label})`
          : MASK_PLACEHOLDER;
      }
      return aiSummarize({
        fieldLabel: classification.label ?? "Donnée médicale",
        rawValue: value,
      });

    default:
      return undefined;
  }
}

// ─── Redact a full record ───

export interface RedactOptions {
  /** Use AI for summarize fields? Default true if OpenAI is configured */
  useSummaries?: boolean;
  /** Include metadata about redacted fields? */
  includeRedactionMeta?: boolean;
}

/**
 * Redact fields on a single record based on the caller's data scopes.
 * Returns a new object with inaccessible fields redacted.
 */
export async function redactRecord<T extends Record<string, unknown>>(
  model: string,
  record: T,
  scopes: Record<DataCategory, ActionLevel>,
  options: RedactOptions = {}
): Promise<T & { _redacted?: string[] }> {
  const classifications = MODEL_CLASSIFICATIONS[model];
  if (!classifications) return { ...record };

  const { useSummaries = true, includeRedactionMeta = false } = options;
  const mode = useSummaries ? "async" : "sync";
  const result: Record<string, unknown> = { ...record };
  const redactedFields: string[] = [];

  const redactionPromises: Promise<void>[] = [];

  for (const [field, classification] of Object.entries(classifications)) {
    if (!(field in result)) continue;

    if (isFieldAccessible(classification, scopes)) continue;

    // Field is NOT accessible — redact it
    redactedFields.push(field);

    if (mode === "async" && classification.redactionMode === "summarize" && useSummaries) {
      // Queue AI summarization
      const promise = redactField(result[field], classification, mode).then((val) => {
        if (val === undefined) {
          delete result[field];
        } else {
          result[field] = val;
        }
      });
      redactionPromises.push(promise);
    } else {
      // Sync redaction (omit or mask)
      const val = await redactField(result[field], classification, "sync");
      if (val === undefined) {
        delete result[field];
      } else {
        result[field] = val;
      }
    }
  }

  // Wait for all AI summaries
  if (redactionPromises.length > 0) {
    await Promise.all(redactionPromises);
  }

  if (includeRedactionMeta && redactedFields.length > 0) {
    result._redacted = redactedFields;
  }

  return result as T & { _redacted?: string[] };
}

/**
 * Redact fields on an array of records.
 * AI summarization is batched for efficiency.
 */
export async function redactRecords<T extends Record<string, unknown>>(
  model: string,
  records: T[],
  scopes: Record<DataCategory, ActionLevel>,
  options: RedactOptions = {}
): Promise<(T & { _redacted?: string[] })[]> {
  return Promise.all(records.map((r) => redactRecord(model, r, scopes, options)));
}

// ─── Sync version (no AI summaries — faster, for high-throughput) ───

/**
 * Synchronous redaction — never calls AI.
 * Fields with "summarize" mode get a placeholder instead.
 */
export function redactRecordSync<T extends Record<string, unknown>>(
  model: string,
  record: T,
  scopes: Record<DataCategory, ActionLevel>,
  includeRedactionMeta = false
): T & { _redacted?: string[] } {
  const classifications = MODEL_CLASSIFICATIONS[model];
  if (!classifications) return { ...record } as T & { _redacted?: string[] };

  const result: Record<string, unknown> = { ...record };
  const redactedFields: string[] = [];

  for (const [field, classification] of Object.entries(classifications)) {
    if (!(field in result)) continue;
    if (isFieldAccessible(classification, scopes)) continue;

    redactedFields.push(field);

    switch (classification.redactionMode) {
      case "omit":
        delete result[field];
        break;
      case "mask":
        result[field] = MASK_PLACEHOLDER;
        break;
      case "summarize":
        result[field] = classification.label
          ? `${MASK_PLACEHOLDER} (${classification.label})`
          : MASK_PLACEHOLDER;
        break;
    }
  }

  if (includeRedactionMeta && redactedFields.length > 0) {
    result._redacted = redactedFields;
  }

  return result as T & { _redacted?: string[] };
}

/**
 * Synchronous batch redaction.
 */
export function redactRecordsSync<T extends Record<string, unknown>>(
  model: string,
  records: T[],
  scopes: Record<DataCategory, ActionLevel>,
  includeRedactionMeta = false
): (T & { _redacted?: string[] })[] {
  return records.map((r) => redactRecordSync(model, r, scopes, includeRedactionMeta));
}
