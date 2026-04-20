import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const client = new PrismaClient({
  // In production, log only warnings and errors
  log: process.env.NODE_ENV === "production"
    ? ["warn", "error"]
    : ["warn", "error"],
});

// ─── Soft-Delete Middleware ───
// Automatically filters out soft-deleted records (deletedAt != null) on read
// operations for models that have a deletedAt column.
// To query deleted records explicitly, use: where: { deletedAt: { not: null } }

const SOFT_DELETE_MODELS = new Set([
  "Athlete",
  "SharedDocument",
  "AthleteVideo",
  "CalendarEvent",
  "KanbanTask",
  "Session",
  "CollabNote",
  "ProMessage",
  "Invoice",
  "KinePlan",
  "NutriPlan",
  "MedOrdonnance",
  "MedProtocol",
  "Cabinet",
]);

client.$use(async (params, next) => {
  if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
    return next(params);
  }

  // Only intercept read operations
  const readActions = ["findMany", "findFirst", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "count", "aggregate", "groupBy"];
  if (!readActions.includes(params.action)) {
    return next(params);
  }

  // Skip if the query already explicitly filters on deletedAt
  // (e.g. listDeleted queries: { deletedAt: { not: null } })
  const where = params.args?.where;
  if (where && "deletedAt" in where) {
    return next(params);
  }

  // Add deletedAt: null filter
  if (!params.args) params.args = {};
  if (!params.args.where) params.args.where = {};
  params.args.where.deletedAt = null;

  return next(params);
});

export const prisma = globalForPrisma.prisma ?? client;

// NOTE: Database SSL/TLS in production is enforced via DATABASE_URL parameter:
//   ?sslmode=require&sslcert=...  (or managed by cloud provider, e.g. Supabase, Neon, RDS)
// Ensure your production DATABASE_URL includes ?sslmode=require

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
