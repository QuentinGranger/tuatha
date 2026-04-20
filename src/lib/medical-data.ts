// ─── Medical Data Classification & Access Rules ───
// Every field that touches patient/athlete data is classified by sensitivity.
// This drives automatic redaction when a pro doesn't have the required scope.
//
// Sensitivity Levels (ascending):
//   public       → visible to any connected pro (name, sport, status)
//   internal     → visible with any read scope on the related category
//   confidential → requires explicit read scope on the exact category
//   restricted   → requires explicit read scope + field is a medical document/vital
//
// Redaction Modes:
//   omit       → field is removed entirely from the response
//   mask       → field is replaced with "[Données protégées]"
//   summarize  → field is replaced with an AI-generated safe summary

import type { DataCategory, ActionLevel } from "@/lib/abac";

// ─── Types ───

export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";

export type RedactionMode = "omit" | "mask" | "summarize";

export interface FieldClassification {
  sensitivity: SensitivityLevel;
  /** Which DataCategory scope is required to see this field */
  requiredCategory: DataCategory;
  /** Minimum action level needed (default: "read") */
  requiredLevel?: ActionLevel;
  /** How to redact if access is denied */
  redactionMode: RedactionMode;
  /** Human-readable label for audit logs */
  label?: string;
}

// ─── Model Field Classifications ───

export const ATHLETE_FIELDS: Record<string, FieldClassification> = {
  // ── Public (any connected pro) ──
  name:             { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  sport:            { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  status:           { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },

  // ── Internal (basic read on related category) ──
  objectif:         { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  motif:            { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "omit" },
  bodyZone:         { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "omit" },
  frequence:        { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  dateNaissance:    { sensitivity: "internal",     requiredCategory: "constantes",   redactionMode: "omit" },
  taille:           { sensitivity: "internal",     requiredCategory: "constantes",   redactionMode: "omit" },
  poids:            { sensitivity: "internal",     requiredCategory: "constantes",   redactionMode: "omit" },
  riskLevel:        { sensitivity: "internal",     requiredCategory: "indicateurs",  redactionMode: "omit" },
  trend:            { sensitivity: "internal",     requiredCategory: "indicateurs",  redactionMode: "omit" },
  latestNote:       { sensitivity: "internal",     requiredCategory: "notes",        redactionMode: "omit" },
  lastContactAt:    { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },

  // ── Confidential (explicit category scope required) ──
  contactEmail:     { sensitivity: "confidential", requiredCategory: "documents",    redactionMode: "mask",      label: "Email de contact" },
  contactPhone:     { sensitivity: "confidential", requiredCategory: "documents",    redactionMode: "mask",      label: "Téléphone" },
  antecedents:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Antécédents médicaux" },
  traitements:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Traitements en cours" },
  contreIndications:{ sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Contre-indications" },
  injuryNote:       { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Notes de blessure" },
  consentement:     { sensitivity: "confidential", requiredCategory: "documents",    redactionMode: "omit" },
  consentementDate: { sensitivity: "confidential", requiredCategory: "documents",    redactionMode: "omit" },
  dataTracking:     { sensitivity: "confidential", requiredCategory: "indicateurs",  redactionMode: "omit" },
};

export const SESSION_FIELDS: Record<string, FieldClassification> = {
  // Public context
  name:             { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  date:             { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  status:           { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },

  // Internal
  objectif:         { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  tags:             { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  lieu:             { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  time:             { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },

  // Confidential — pro notes, analysis, patient feedback
  notePro:          { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Note du professionnel" },
  analysePro:       { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Analyse du professionnel" },
  recommandation:   { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Recommandation" },
  feedbackAthlete:  { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Feedback patient" },

  // Restricted — clinical pain/RPE data
  rpeCible:         { sensitivity: "confidential", requiredCategory: "indicateurs",  redactionMode: "omit" },
  rpeRessenti:      { sensitivity: "confidential", requiredCategory: "indicateurs",  redactionMode: "omit" },
  douleur:          { sensitivity: "restricted",   requiredCategory: "constantes",   redactionMode: "omit",      label: "Score douleur" },
  douleurZone:      { sensitivity: "restricted",   requiredCategory: "constantes",   redactionMode: "omit",      label: "Zone de douleur" },
  zoneCardio:       { sensitivity: "confidential", requiredCategory: "constantes",   redactionMode: "omit" },
  contraintes:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "omit" },
  criteresArret:    { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "omit",      label: "Critères d'arrêt" },
};

export const KINE_PLAN_FIELDS: Record<string, FieldClassification> = {
  title:            { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  status:           { sensitivity: "public",       requiredCategory: "entrainement", redactionMode: "mask" },
  objective:        { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  phase:            { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },
  globalProgress:   { sensitivity: "internal",     requiredCategory: "indicateurs",  redactionMode: "omit" },
  frequency:        { sensitivity: "internal",     requiredCategory: "entrainement", redactionMode: "omit" },

  pathology:        { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Pathologie" },
  notesPro:         { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Notes pro (plan kiné)" },
  notesPatient:     { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "omit" },
  conclusion:       { sensitivity: "confidential", requiredCategory: "entrainement", redactionMode: "summarize", label: "Conclusion" },
  outcomeScore:     { sensitivity: "confidential", requiredCategory: "indicateurs",  redactionMode: "omit" },
};

export const EXERCISE_LOG_FIELDS: Record<string, FieldClassification> = {
  done:             { sensitivity: "internal",     requiredCategory: "indicateurs",  redactionMode: "omit" },
  pain:             { sensitivity: "restricted",   requiredCategory: "constantes",   redactionMode: "omit", label: "Douleur exercice" },
  difficulty:       { sensitivity: "internal",     requiredCategory: "indicateurs",  redactionMode: "omit" },
  comment:          { sensitivity: "confidential", requiredCategory: "notes",        redactionMode: "summarize", label: "Commentaire exercice" },
};

// ─── Medical models (médecin) ───

export const MED_ORDONNANCE_FIELDS: Record<string, FieldClassification> = {
  type:             { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "omit" },
  status:           { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "omit" },
  diagnosis:        { sensitivity: "restricted",   requiredCategory: "imagerie",     redactionMode: "summarize", label: "Diagnostic" },
  contentJson:      { sensitivity: "restricted",   requiredCategory: "imagerie",     redactionMode: "summarize", label: "Contenu ordonnance" },
  episode:          { sensitivity: "confidential", requiredCategory: "imagerie",     redactionMode: "omit" },
  validUntil:       { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "omit" },
  signatureData:    { sensitivity: "restricted",   requiredCategory: "imagerie",     redactionMode: "omit",      label: "Signature" },
  pdfUrl:           { sensitivity: "restricted",   requiredCategory: "imagerie",     redactionMode: "omit",      label: "PDF ordonnance" },
};

export const MED_PRESCRIPTION_FIELDS: Record<string, FieldClassification> = {
  type:             { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "omit" },
  title:            { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "mask" },
  contentJson:      { sensitivity: "restricted",   requiredCategory: "imagerie",     redactionMode: "summarize", label: "Contenu prescription" },
  redFlags:         { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "omit",      label: "Red flags" },
  status:           { sensitivity: "internal",     requiredCategory: "imagerie",     redactionMode: "omit" },
};

export const MED_VITAL_ENTRY_FIELDS: Record<string, FieldClassification> = {
  vitalKey:         { sensitivity: "internal",     requiredCategory: "constantes",   redactionMode: "omit" },
  value:            { sensitivity: "restricted",   requiredCategory: "constantes",   redactionMode: "omit",      label: "Valeur constante" },
  unit:             { sensitivity: "internal",     requiredCategory: "constantes",   redactionMode: "omit" },
  note:             { sensitivity: "confidential", requiredCategory: "constantes",   redactionMode: "summarize", label: "Note constante" },
};

export const MED_CLINICAL_NOTE_FIELDS: Record<string, FieldClassification> = {
  focus:            { sensitivity: "internal",     requiredCategory: "notes",        redactionMode: "omit" },
  notePro:          { sensitivity: "restricted",   requiredCategory: "notes",        redactionMode: "summarize", label: "Note clinique" },
  notePatient:      { sensitivity: "confidential", requiredCategory: "notes",        redactionMode: "summarize", label: "Note patient" },
};

export const MED_PLAN_FIELDS: Record<string, FieldClassification> = {
  episode:          { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "omit" },
  patientStatus:    { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "omit" },
  conduiteJson:     { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Conduite à tenir" },
  restrictionsJson: { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Restrictions" },
  nextStepsJson:    { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "omit" },
};

export const MED_PROTOCOL_FIELDS: Record<string, FieldClassification> = {
  name:             { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "mask" },
  description:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Description protocole" },
  objectives:       { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "omit" },
  phasesJson:       { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Phases du protocole" },
  status:           { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "omit" },
};

// ─── Nutrition models ───

export const NUTRI_CONSULT_NOTE_FIELDS: Record<string, FieldClassification> = {
  focus:            { sensitivity: "internal",     requiredCategory: "nutrition",    redactionMode: "omit" },
  notePro:          { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "summarize", label: "Note nutri pro" },
  notePatient:      { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "summarize", label: "Note nutri patient" },
};

export const NUTRI_MEASURE_FIELDS: Record<string, FieldClassification> = {
  weight:           { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "omit" },
  bmi:              { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "omit" },
  bodyFat:          { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "omit" },
  waist:            { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "omit" },
  hydration:        { sensitivity: "confidential", requiredCategory: "nutrition",    redactionMode: "omit" },
};

// ─── Notes & Documents ───

export const COLLAB_NOTE_FIELDS: Record<string, FieldClassification> = {
  content:          { sensitivity: "confidential", requiredCategory: "notes",        redactionMode: "summarize", label: "Note collaborative" },
  tags:             { sensitivity: "internal",     requiredCategory: "notes",        redactionMode: "omit" },
  type:             { sensitivity: "public",       requiredCategory: "notes",        redactionMode: "mask" },
};

export const SHARED_DOCUMENT_FIELDS: Record<string, FieldClassification> = {
  originalName:     { sensitivity: "internal",     requiredCategory: "documents",    redactionMode: "mask" },
  category:         { sensitivity: "internal",     requiredCategory: "documents",    redactionMode: "omit" },
  note:             { sensitivity: "confidential", requiredCategory: "documents",    redactionMode: "summarize", label: "Note document" },
  filePath:         { sensitivity: "restricted",   requiredCategory: "documents",    redactionMode: "omit",      label: "Fichier" },
  mimeType:         { sensitivity: "internal",     requiredCategory: "documents",    redactionMode: "omit" },
};

// ─── Alerts ───

export const KINE_ALERT_FIELDS: Record<string, FieldClassification> = {
  title:            { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "mask" },
  description:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Description alerte kiné" },
  detail:           { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize" },
  clinicalNote:     { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Note clinique alerte" },
  intensity:        { sensitivity: "confidential", requiredCategory: "indicateurs",  redactionMode: "omit" },
};

export const MED_ALERT_FIELDS: Record<string, FieldClassification> = {
  severity:         { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "omit" },
  title:            { sensitivity: "internal",     requiredCategory: "blessures",    redactionMode: "mask" },
  description:      { sensitivity: "confidential", requiredCategory: "blessures",    redactionMode: "summarize", label: "Description alerte méd." },
  context:          { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Contexte alerte méd." },
  commentMedecin:   { sensitivity: "restricted",   requiredCategory: "blessures",    redactionMode: "summarize", label: "Commentaire médecin" },
};

// ─── Master registry: model → field classifications ───

export const MODEL_CLASSIFICATIONS: Record<string, Record<string, FieldClassification>> = {
  Athlete:          ATHLETE_FIELDS,
  Session:          SESSION_FIELDS,
  KinePlan:         KINE_PLAN_FIELDS,
  ExerciseLog:      EXERCISE_LOG_FIELDS,
  MedOrdonnance:    MED_ORDONNANCE_FIELDS,
  MedPrescription:  MED_PRESCRIPTION_FIELDS,
  MedVitalEntry:    MED_VITAL_ENTRY_FIELDS,
  MedClinicalNote:  MED_CLINICAL_NOTE_FIELDS,
  MedPlan:          MED_PLAN_FIELDS,
  MedProtocol:      MED_PROTOCOL_FIELDS,
  NutriConsultNote: NUTRI_CONSULT_NOTE_FIELDS,
  NutriMeasure:     NUTRI_MEASURE_FIELDS,
  CollabNote:       COLLAB_NOTE_FIELDS,
  SharedDocument:   SHARED_DOCUMENT_FIELDS,
  KineAlert:        KINE_ALERT_FIELDS,
  MedAlert:         MED_ALERT_FIELDS,
};

// ─── Sensitivity level hierarchy ───

const SENSITIVITY_ORDER: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

/** Check if a sensitivity level requires at least a given threshold */
export function sensitivityAtLeast(level: SensitivityLevel, threshold: SensitivityLevel): boolean {
  return SENSITIVITY_ORDER[level] >= SENSITIVITY_ORDER[threshold];
}

/** Get all fields at or above a given sensitivity for a model */
export function getSensitiveFields(
  model: keyof typeof MODEL_CLASSIFICATIONS,
  minSensitivity: SensitivityLevel = "confidential"
): string[] {
  const fields = MODEL_CLASSIFICATIONS[model];
  if (!fields) return [];
  return Object.entries(fields)
    .filter(([, cls]) => sensitivityAtLeast(cls.sensitivity, minSensitivity))
    .map(([field]) => field);
}

/** Get the classification for a specific model + field, or null */
export function getFieldClassification(
  model: string,
  field: string
): FieldClassification | null {
  return MODEL_CLASSIFICATIONS[model]?.[field] ?? null;
}
