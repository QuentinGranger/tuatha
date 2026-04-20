// ─── Strict Input Validation (Zod) ───
// Never trust client data. Every API route that accepts input must validate
// through schemas defined here before touching the database.
//
// Usage:
//   const parsed = validateBody(await request.json(), loginSchema);
//   if (!parsed.success) return parsed.errorResponse;
//   const { email, password } = parsed.data;

import { z, ZodSchema, ZodError } from "zod";
import { NextResponse } from "next/server";

// ─── Validation result types ───

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; errorResponse: NextResponse; errors: z.ZodIssue[] };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ─── Core validation helper ───

export function validateBody<T>(body: unknown, schema: ZodSchema<T>): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const formatted = formatZodErrors(result.error);
  return {
    success: false,
    errors: result.error.issues,
    errorResponse: NextResponse.json(
      { error: "Données invalides.", details: formatted },
      { status: 400 }
    ),
  };
}

export function validateQuery<T>(params: Record<string, string | null>, schema: ZodSchema<T>): ValidationResult<T> {
  // Convert URLSearchParams-style nulls to undefineds for Zod optional handling
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    cleaned[k] = v ?? undefined;
  }
  return validateBody(cleaned, schema);
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

// ─── Reusable field schemas ───

// Strings
export const trimmedString = z.string().trim();
export const nonEmptyString = z.string().trim().min(1, "Ce champ est requis.");
export const optionalString = z.string().trim().optional().nullable();
export const email = z.string().trim().toLowerCase().email("Adresse email invalide.");
export const password = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.");
export const uuid = z.string().uuid("Identifiant invalide.");
export const optionalUuid = z.string().uuid("Identifiant invalide.").optional().nullable();

// Numbers
export const positiveInt = z.number().int().positive();
export const nonNegativeInt = z.number().int().nonnegative();
export const positiveFloat = z.number().positive();
export const nonNegativeFloat = z.number().nonnegative();
export const optionalPositiveFloat = z.number().positive().optional().nullable();

// Dates
export const dateString = z.string().refine(
  (v) => !isNaN(Date.parse(v)),
  { message: "Date invalide." }
);
export const optionalDateString = z.string().refine(
  (v) => !isNaN(Date.parse(v)),
  { message: "Date invalide." }
).optional().nullable();

// Arrays
export const stringArray = z.array(z.string());
export const optionalStringArray = z.array(z.string()).optional().default([]);

// ─── Auth Schemas ───

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, "Mot de passe requis."),
  totpCode: z.string().length(6, "Code 2FA invalide.").optional(),
});

export const verifyEmailSchema = z.object({
  email: email,
  code: z.string().min(1, "Code requis."),
});

export const resendVerifySchema = z.object({
  email: email,
});

export const forgotPasswordSchema = z.object({
  email: email,
});

export const resetPasswordSchema = z.object({
  token: nonEmptyString,
  password: password,
  passwordConfirm: password,
}).refine((d) => d.password === d.passwordConfirm, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["passwordConfirm"],
});

export const sessionsDeleteSchema = z.object({
  sessionId: uuid.optional(),
  all: z.boolean().optional(),
}).refine((d) => d.all || d.sessionId, {
  message: "sessionId ou all requis.",
});

// ─── Inscription Schemas ───

export const inscriptionConfigSchema = z.object({
  professionnelId: uuid,
  services: z.array(z.any()).optional().default([]),
  disponibilites: z.any().optional(),
  calendriers: z.any().optional(),
  adresseCabinet: optionalString,
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  placeId: optionalString,
});

// ─── Athlete Schemas ───

export const createAthleteSchema = z.object({
  name: nonEmptyString,
  sport: optionalString,
  injuryNote: optionalString,
  objectif: optionalString,
  motif: optionalString,
  contactEmail: z.string().email("Email invalide.").optional().nullable().or(z.literal("")),
  contactPhone: optionalString,
  consentement: z.boolean().optional().default(false),
  dateNaissance: optionalDateString,
  taille: z.union([z.number(), z.string().transform(Number)]).optional().nullable(),
  poids: z.union([z.number(), z.string().transform(Number)]).optional().nullable(),
  bodyZone: optionalString,
  frequence: optionalString,
  antecedents: optionalStringArray,
  traitements: optionalString,
  contreIndications: optionalString,
  dataTracking: optionalStringArray,
  canalCommunication: optionalString,
});

export const updateAthleteSchema = z.object({
  name: nonEmptyString.optional(),
  sport: optionalString,
  injuryNote: optionalString,
  latestNote: optionalString,
  lastContactAt: optionalDateString,
  riskLevel: optionalString,
  trend: optionalString,
  status: z.enum(["active", "inactive", "archive"]).optional(),
  objectif: optionalString,
  motif: optionalString,
  contactEmail: z.string().email("Email invalide.").optional().nullable().or(z.literal("")),
  contactPhone: optionalString,
  consentement: z.boolean().optional(),
  consentementDate: optionalDateString,
  consentementPartage: z.boolean().optional(),
  consentementPartageDate: optionalDateString,
  bodyZone: optionalString,
  frequence: optionalString,
  traitements: optionalString,
  contreIndications: optionalString,
  canalCommunication: optionalString,
  antecedents: optionalStringArray,
  dataTracking: optionalStringArray,
  dateNaissance: optionalDateString,
  taille: z.union([z.number(), z.string().transform(Number)]).optional().nullable(),
  poids: z.union([z.number(), z.string().transform(Number)]).optional().nullable(),
}).strict();

export const athleteNoteSchema = z.object({
  content: nonEmptyString,
});

// ─── Event Schemas ───

export const createEventSchema = z.object({
  title: nonEmptyString,
  date: dateString,
  endDate: optionalDateString,
  allDay: z.boolean().optional().default(false),
  type: optionalString,
  color: optionalString,
  description: optionalString,
  athleteId: optionalUuid,
  reminderMinutes: z.number().int().nonnegative().optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial();

// ─── Kanban Schemas ───

export const createKanbanSchema = z.object({
  title: nonEmptyString,
  description: optionalString,
  column: z.enum(["todo", "inProgress", "done", "archive"]).optional().default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  athleteId: optionalUuid,
  dueDate: optionalDateString,
  reminderMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
});

export const updateKanbanSchema = z.object({
  title: nonEmptyString.optional(),
  description: optionalString,
  column: z.enum(["todo", "inProgress", "done", "archive"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  position: z.number().int().nonnegative().optional(),
  done: z.boolean().optional(),
  athleteId: optionalUuid,
  dueDate: optionalDateString,
  reminderMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
  reminderSeen: z.boolean().optional(),
});

// ─── Invoice Schemas ───

export const createInvoiceSchema = z.object({
  description: nonEmptyString,
  amount: z.union([z.number(), z.string().transform(Number)]).pipe(positiveFloat),
  dueDate: dateString,
  athleteId: optionalUuid,
  notes: optionalString,
  prestationType: optionalString,
});

export const updateInvoiceSchema = z.object({
  description: nonEmptyString.optional(),
  amount: z.union([z.number(), z.string().transform(Number)]).pipe(positiveFloat).optional(),
  dueDate: optionalDateString,
  status: z.enum(["unpaid", "paid", "overdue", "cancelled"]).optional(),
  paidDate: optionalDateString,
  paymentMethod: optionalString,
  notes: optionalString,
});

// ─── Kiné Plan Schemas ───

export const createKinePlanSchema = z.object({
  title: nonEmptyString,
  objective: optionalString,
  pathology: optionalString,
  notesPro: optionalString,
  notesPatient: optionalString,
  startDate: optionalDateString,
  endDate: optionalDateString,
  frequency: optionalString,
  athleteId: optionalUuid,
  isTemplate: z.boolean().optional().default(false),
  templateName: optionalString,
  duplicateFromId: optionalUuid,
});

export const updateKinePlanSchema = z.object({
  title: nonEmptyString.optional(),
  objective: optionalString,
  pathology: optionalString,
  phase: optionalString,
  globalProgress: z.number().int().min(0).max(100).optional().nullable(),
  notesPro: optionalString,
  notesPatient: optionalString,
  startDate: optionalDateString,
  endDate: optionalDateString,
  frequency: optionalString,
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
  conclusion: optionalString,
  outcomeScore: z.number().int().min(0).max(100).optional().nullable(),
  nextRdvDate: optionalDateString,
  nextRdvTime: optionalString,
  nextRdvLocation: optionalString,
  isTemplate: z.boolean().optional(),
  templateName: optionalString,
  athleteId: optionalUuid,
});

// ─── Kiné Exercise Schemas ───

export const kinePlanExerciseSchema = z.object({
  videoId: uuid,
  sets: z.number().int().positive().optional().nullable(),
  reps: optionalString,
  duration: optionalString,
  tempo: optionalString,
  rest: optionalString,
  frequency: optionalString,
  painThreshold: z.number().int().min(0).max(10).optional().nullable(),
  consignes: optionalString,
  equipment: optionalString,
  alternative: optionalString,
  position: z.number().int().nonnegative().optional().default(0),
});

// ─── Kiné Video Schemas ───

export const createKineVideoSchema = z.object({
  title: nonEmptyString,
  url: z.string().url("URL invalide."),
  thumbnail: optionalString,
  category: nonEmptyString,
  duration: z.number().int().positive().optional().nullable(),
  description: optionalString,
});

// ─── Kiné Alert Rule Schemas ───

export const createAlertRuleSchema = z.object({
  ruleType: nonEmptyString,
  threshold: z.coerce.number().int().positive().optional().default(5),
  thresholdDays: z.coerce.number().int().positive().optional().default(3),
  active: z.boolean().optional().default(true),
});

export const updateAlertRuleSchema = z.object({
  id: uuid,
  active: z.boolean().optional(),
  threshold: z.coerce.number().int().positive().optional(),
  thresholdDays: z.coerce.number().int().positive().optional(),
});

export const updateKineAlertSchema = z.object({
  status: z.string().optional(),
  clinicalNote: optionalString,
  title: nonEmptyString.optional(),
  description: optionalString,
  detail: optionalString,
  type: z.string().optional(),
  intensity: z.number().int().min(0).max(10).optional().nullable(),
});

// ─── Kiné Alert Schemas ───

export const createKineAlertSchema = z.object({
  athleteId: uuid,
  planId: optionalUuid,
  type: z.string().optional().default("alert"),
  title: nonEmptyString,
  description: optionalString,
  detail: optionalString,
  intensity: z.number().int().min(0).max(10).optional().nullable(),
  clinicalNote: optionalString,
});

// ─── Médecin Ordonnance Schemas ───

export const createOrdonnanceSchema = z.object({
  athleteId: uuid,
  type: nonEmptyString,
  status: z.enum(["brouillon", "signee", "transmise", "expiree", "annulee"]).optional().default("brouillon"),
  diagnosis: nonEmptyString,
  content: z.any().optional().default({}),
  episode: optionalString,
  validUntil: optionalDateString,
  signedAt: optionalDateString,
  signatureData: optionalString,
});

export const updateOrdonnanceSchema = createOrdonnanceSchema.partial().omit({ athleteId: true });

// ─── Médecin Prescription Schemas ───

export const createPrescriptionSchema = z.object({
  athleteId: uuid,
  type: nonEmptyString,
  title: nonEmptyString,
  contentJson: z.string().optional().default("[]"),
  dateStart: dateString,
  dateEnd: optionalDateString,
  redFlags: optionalStringArray,
  visiblePatient: z.boolean().optional().default(true),
  linkedProtocolId: optionalUuid,
  status: z.enum(["active", "completed", "cancelled"]).optional().default("active"),
});

export const updatePrescriptionSchema = createPrescriptionSchema.partial().omit({ athleteId: true });

// ─── Médecin Protocol Schemas ───

export const createProtocolSchema = z.object({
  athleteId: uuid,
  name: nonEmptyString,
  description: optionalString,
  objectives: optionalStringArray,
  phasesJson: z.string().optional().default("[]"),
  linkedTemplates: optionalStringArray,
  status: z.enum(["draft", "active", "completed"]).optional().default("draft"),
});

export const updateProtocolSchema = createProtocolSchema.partial().omit({ athleteId: true });

// ─── Médecin Plan Schemas ───

export const createMedPlanSchema = z.object({
  athleteId: uuid,
  episode: z.string().optional().default("Suivi général"),
  patientStatus: z.enum(["stable", "surveiller", "alerte"]).optional().default("stable"),
  conduiteJson: z.string().optional().default("[]"),
  restrictionsJson: z.string().optional().default("[]"),
  nextStepsJson: z.string().optional().default("[]"),
});

// ─── Médecin Clinical Note Schemas ───

export const createClinicalNoteSchema = z.object({
  athleteId: uuid,
  focus: nonEmptyString,
  notePro: nonEmptyString,
  notePatient: optionalString,
});

// ─── Médecin Alert Schemas ───

export const createMedAlertSchema = z.object({
  athleteId: uuid,
  severity: z.enum(["info", "warning", "critical"]).optional().default("info"),
  source: z.enum(["patient", "capteur", "auto", "pro"]).optional().default("pro"),
  title: nonEmptyString,
  description: nonEmptyString,
  context: optionalString,
  commentMedecin: optionalString,
});

export const updateMedAlertSchema = createMedAlertSchema.partial().omit({ athleteId: true });

// ─── Médecin Vital Entry Schemas ───

export const createVitalEntrySchema = z.object({
  athleteId: uuid,
  vitalKey: nonEmptyString,
  value: z.number(),
  unit: nonEmptyString,
  note: optionalString,
  recordedAt: optionalDateString,
});

// ─── Réseau Schemas ───

const _reseauActions = [
  z.object({
    action: z.literal("updatePermissions"),
    connectionId: uuid,
    readProgramme: z.boolean().optional(),
    readIndicateurs: z.boolean().optional(),
    readBlessures: z.boolean().optional(),
    readDocuments: z.boolean().optional(),
    writeNote: z.boolean().optional(),
    writeProgramme: z.boolean().optional(),
    writeValidation: z.boolean().optional(),
    scope: optionalString,
  }),
  z.object({
    action: z.literal("updateInvite"),
    inviteId: uuid,
    status: nonEmptyString,
  }),
  z.object({
    action: z.literal("updateConnection"),
    connectionId: uuid,
    status: nonEmptyString,
  }),
  z.object({
    action: z.literal("pinNote"),
    noteId: uuid,
    pinned: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal("updateDataScopes"),
    connectionId: uuid,
    dataScopes: z.record(z.string(), z.string()),
  }),
  z.object({
    action: z.literal("renewConnection"),
    connectionId: uuid,
    days: z.number().int().positive().max(365).optional().default(90),
  }),
] as const;

export const reseauPatchSchema = z.discriminatedUnion("action", [
  _reseauActions[0], _reseauActions[1], _reseauActions[2],
  _reseauActions[3], _reseauActions[4], _reseauActions[5],
]);

// ─── Collab Note Schemas ───

export const createCollabNoteSchema = z.object({
  athleteId: uuid,
  content: nonEmptyString,
  type: z.string().optional().default("note"),
  tags: optionalStringArray,
  parentId: optionalUuid,
});

// ─── Document Schemas ───

export const shareDocumentSchema = z.object({
  athleteId: optionalUuid,
  receiverProId: optionalUuid,
  receiverAthleteId: optionalUuid,
  category: z.string().optional().default("autre"),
  note: optionalString,
});

// ─── Nutrition Schemas ───

export const nutriObjectiveSchema = z.object({
  athleteId: uuid,
  goal: z.string().optional().default("sante"),
  kcal: z.number().int().positive().optional().default(2000),
  protein: z.number().int().nonnegative().optional().default(120),
  carbs: z.number().int().nonnegative().optional().default(250),
  fat: z.number().int().nonnegative().optional().default(65),
  water: z.number().nonnegative().optional().default(2.0),
  weeklyRate: z.number().optional().default(0),
});

export const nutriConsultNoteSchema = z.object({
  athleteId: uuid,
  date: dateString,
  notePro: nonEmptyString,
  notePatient: z.string().optional().default(""),
  focus: z.string().optional().default(""),
});

// ─── Query Param Schemas ───

export const paginationQuery = z.object({
  page: z.string().transform(Number).pipe(positiveInt).optional(),
  limit: z.string().transform(Number).pipe(positiveInt.max(100)).optional(),
});

export const athleteIdQuery = z.object({
  athleteId: uuid,
});

export const optionalAthleteIdQuery = z.object({
  athleteId: uuid.optional(),
});

// ─── Re-export Zod for convenience ───

export { z };
