/*
  Warnings:

  - A unique constraint covering the columns `[professionnelId,type]` on the table `CalendrierSync` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GOOD', 'AVERAGE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Trend" AS ENUM ('IMPROVING', 'STAGNATING', 'DECLINING');

-- CreateEnum
CREATE TYPE "AthleteStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('brouillon', 'planifiee', 'en_cours', 'realisee', 'annulee');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('connecte', 'en_attente', 'refuse');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('envoyee', 'acceptee', 'refusee', 'annulee');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "KinePlanStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "NutriPlanStatus" AS ENUM ('brouillon', 'publie', 'en_cours', 'archive');

-- AlterTable
ALTER TABLE "CalendrierSync" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Professionnel" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "placeId" TEXT;

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT,
    "injuryNote" TEXT,
    "latestNote" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'GOOD',
    "trend" "Trend" NOT NULL DEFAULT 'STAGNATING',
    "status" "AthleteStatus" NOT NULL DEFAULT 'active',
    "objectif" TEXT,
    "motif" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "consentement" BOOLEAN NOT NULL DEFAULT false,
    "consentementDate" TIMESTAMP(3),
    "dateNaissance" TIMESTAMP(3),
    "taille" DOUBLE PRECISION,
    "poids" DOUBLE PRECISION,
    "bodyZone" TEXT,
    "frequence" TEXT,
    "antecedents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "traitements" TEXT,
    "contreIndications" TEXT,
    "dataTracking" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canalCommunication" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteNote" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "column" TEXT NOT NULL DEFAULT 'todo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "reminderSeen" BOOLEAN NOT NULL DEFAULT false,
    "athleteId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'rdv',
    "color" TEXT NOT NULL DEFAULT 'orange',
    "description" TEXT,
    "reminderMinutes" INTEGER,
    "reminderSeen" BOOLEAN NOT NULL DEFAULT false,
    "athleteId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "lieu" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'brouillon',
    "visibleAthlete" BOOLEAN NOT NULL DEFAULT false,
    "visiblePros" BOOLEAN NOT NULL DEFAULT false,
    "objectif" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notePro" TEXT,
    "rpeCible" TEXT,
    "zoneCardio" TEXT,
    "contraintes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criteresArret" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focusTechnique" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rpeRessenti" INTEGER,
    "douleur" INTEGER,
    "douleurZone" TEXT,
    "feedbackAthlete" TEXT,
    "analysePro" TEXT,
    "recommandation" TEXT,
    "athleteId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main',
    "position" INTEGER NOT NULL DEFAULT 0,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "ExerciseBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" TEXT,
    "reps" TEXT,
    "duration" TEXT,
    "distance" TEXT,
    "intensity" TEXT,
    "tempo" TEXT,
    "repos" TEXT,
    "consignes" TEXT,
    "videoUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "blockId" TEXT NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProConnection" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "ownerProId" TEXT NOT NULL,
    "connectedProId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Autre',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'en_attente',
    "readProgramme" BOOLEAN NOT NULL DEFAULT false,
    "readIndicateurs" BOOLEAN NOT NULL DEFAULT false,
    "readBlessures" BOOLEAN NOT NULL DEFAULT false,
    "readDocuments" BOOLEAN NOT NULL DEFAULT false,
    "writeNote" BOOLEAN NOT NULL DEFAULT false,
    "writeProgramme" BOOLEAN NOT NULL DEFAULT false,
    "writeValidation" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'partage',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProInvitation" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "senderProId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Autre',
    "message" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'envoyee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollabNote" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "authorProId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProMessage" (
    "id" TEXT NOT NULL,
    "senderProId" TEXT NOT NULL,
    "receiverProId" TEXT NOT NULL,
    "athleteId" TEXT,
    "content" TEXT NOT NULL,
    "reactions" JSONB NOT NULL DEFAULT '[]',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "notes" TEXT,
    "athleteId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinePlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "pathology" TEXT,
    "phase" TEXT,
    "globalProgress" INTEGER DEFAULT 0,
    "notesPro" TEXT,
    "notesPatient" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "frequency" TEXT,
    "nextRdvDate" TIMESTAMP(3),
    "nextRdvTime" TEXT,
    "nextRdvLocation" TEXT,
    "status" "KinePlanStatus" NOT NULL DEFAULT 'draft',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateName" TEXT,
    "conclusion" TEXT,
    "outcomeScore" INTEGER,
    "athleteId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KinePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KineVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "category" TEXT NOT NULL,
    "duration" INTEGER,
    "description" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KineVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinePlanExercise" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER,
    "reps" TEXT,
    "duration" TEXT,
    "tempo" TEXT,
    "rest" TEXT,
    "frequency" TEXT,
    "painThreshold" INTEGER,
    "consignes" TEXT,
    "equipment" TEXT,
    "alternative" TEXT,
    "planId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KinePlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "pain" INTEGER,
    "difficulty" INTEGER,
    "comment" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KineAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'alert',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "origin" TEXT NOT NULL DEFAULT 'kine',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "detail" TEXT,
    "intensity" INTEGER,
    "clinicalNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "athleteId" TEXT NOT NULL,
    "planId" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KineAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KineAlertRule" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 5,
    "thresholdDays" INTEGER DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KineAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultSets" TEXT,
    "defaultReps" TEXT,
    "defaultDuration" TEXT,
    "defaultIntensity" TEXT,
    "defaultRepos" TEXT,
    "consignes" TEXT,
    "videoUrl" TEXT,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteVideo" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "note" TEXT,
    "uploadToken" TEXT NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "athleteId" TEXT NOT NULL,
    "professionnelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedDocument" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "note" TEXT,
    "senderProId" TEXT NOT NULL,
    "receiverProId" TEXT,
    "receiverAthleteId" TEXT,
    "athleteId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriObjective" (
    "id" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'sante',
    "kcal" INTEGER NOT NULL DEFAULT 2000,
    "protein" INTEGER NOT NULL DEFAULT 120,
    "carbs" INTEGER NOT NULL DEFAULT 250,
    "fat" INTEGER NOT NULL DEFAULT 65,
    "water" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "weeklyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutriObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriJournal" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kcal" INTEGER NOT NULL DEFAULT 0,
    "protein" INTEGER NOT NULL DEFAULT 0,
    "carbs" INTEGER NOT NULL DEFAULT 0,
    "fat" INTEGER NOT NULL DEFAULT 0,
    "water" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriMeasure" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weight" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bodyFat" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hydration" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'alert',
    "severity" TEXT NOT NULL DEFAULT 'modere',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT,
    "closedNote" TEXT,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutriAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriRule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriConsultNote" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notePro" TEXT NOT NULL,
    "notePatient" TEXT NOT NULL DEFAULT '',
    "focus" TEXT NOT NULL DEFAULT '',
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriConsultNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Plan alimentaire',
    "status" "NutriPlanStatus" NOT NULL DEFAULT 'brouillon',
    "kcalTarget" INTEGER NOT NULL DEFAULT 2000,
    "proteinTarget" INTEGER NOT NULL DEFAULT 120,
    "carbsTarget" INTEGER NOT NULL DEFAULT 250,
    "fatTarget" INTEGER NOT NULL DEFAULT 65,
    "fiberTarget" INTEGER,
    "saltTarget" DOUBLE PRECISION,
    "waterTarget" DOUBLE PRECISION,
    "proteinPct" INTEGER NOT NULL DEFAULT 30,
    "carbsPct" INTEGER NOT NULL DEFAULT 40,
    "fatPct" INTEGER NOT NULL DEFAULT 30,
    "notePatient" TEXT NOT NULL DEFAULT '',
    "notePro" TEXT NOT NULL DEFAULT '',
    "startDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutriPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriMeal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Repas',
    "time" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "rule" TEXT,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutriMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriFoodItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "kcal" INTEGER NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "mealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriAlternative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "kcal" INTEGER NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "constraint" TEXT,
    "foodItemId" TEXT NOT NULL,

    CONSTRAINT "NutriAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriPlanVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planId" TEXT NOT NULL,

    CONSTRAINT "NutriPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriMealTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriMealTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutriDayTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meals" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutriDayTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedOrdonnance" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'brouillon',
    "diagnosis" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "episode" TEXT,
    "validUntil" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "pdfUrl" TEXT,
    "signatureData" TEXT,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedOrdonnance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedPrescription" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3),
    "redFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visiblePatient" BOOLEAN NOT NULL DEFAULT true,
    "linkedProtocolId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedProtocol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phasesJson" TEXT NOT NULL,
    "linkedTemplates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedAlert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'pro',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" TEXT,
    "commentMedecin" TEXT,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedClinicalNote" (
    "id" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "notePro" TEXT NOT NULL,
    "notePatient" TEXT,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedPlan" (
    "id" TEXT NOT NULL,
    "episode" TEXT NOT NULL DEFAULT 'Suivi général',
    "patientStatus" TEXT NOT NULL DEFAULT 'stable',
    "conduiteJson" TEXT NOT NULL DEFAULT '[]',
    "restrictionsJson" TEXT NOT NULL DEFAULT '[]',
    "nextStepsJson" TEXT NOT NULL DEFAULT '[]',
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedVitalEntry" (
    "id" TEXT NOT NULL,
    "vitalKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "athleteId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedVitalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteVideo_uploadToken_key" ON "AthleteVideo"("uploadToken");

-- CreateIndex
CREATE UNIQUE INDEX "NutriObjective_athleteId_proId_key" ON "NutriObjective"("athleteId", "proId");

-- CreateIndex
CREATE UNIQUE INDEX "NutriJournal_athleteId_date_key" ON "NutriJournal"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendrierSync_professionnelId_type_key" ON "CalendrierSync"("professionnelId", "type");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteNote" ADD CONSTRAINT "AthleteNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanTask" ADD CONSTRAINT "KanbanTask_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseBlock" ADD CONSTRAINT "ExerciseBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ExerciseBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProConnection" ADD CONSTRAINT "ProConnection_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProConnection" ADD CONSTRAINT "ProConnection_ownerProId_fkey" FOREIGN KEY ("ownerProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProConnection" ADD CONSTRAINT "ProConnection_connectedProId_fkey" FOREIGN KEY ("connectedProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProInvitation" ADD CONSTRAINT "ProInvitation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProInvitation" ADD CONSTRAINT "ProInvitation_senderProId_fkey" FOREIGN KEY ("senderProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabNote" ADD CONSTRAINT "CollabNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabNote" ADD CONSTRAINT "CollabNote_authorProId_fkey" FOREIGN KEY ("authorProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProMessage" ADD CONSTRAINT "ProMessage_senderProId_fkey" FOREIGN KEY ("senderProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProMessage" ADD CONSTRAINT "ProMessage_receiverProId_fkey" FOREIGN KEY ("receiverProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProMessage" ADD CONSTRAINT "ProMessage_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinePlan" ADD CONSTRAINT "KinePlan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinePlan" ADD CONSTRAINT "KinePlan_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KineVideo" ADD CONSTRAINT "KineVideo_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinePlanExercise" ADD CONSTRAINT "KinePlanExercise_planId_fkey" FOREIGN KEY ("planId") REFERENCES "KinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinePlanExercise" ADD CONSTRAINT "KinePlanExercise_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "KineVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "KinePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "KinePlanExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KineAlert" ADD CONSTRAINT "KineAlert_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KineAlert" ADD CONSTRAINT "KineAlert_planId_fkey" FOREIGN KEY ("planId") REFERENCES "KinePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KineAlert" ADD CONSTRAINT "KineAlert_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KineAlertRule" ADD CONSTRAINT "KineAlertRule_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseTemplate" ADD CONSTRAINT "ExerciseTemplate_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteVideo" ADD CONSTRAINT "AthleteVideo_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteVideo" ADD CONSTRAINT "AthleteVideo_professionnelId_fkey" FOREIGN KEY ("professionnelId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_senderProId_fkey" FOREIGN KEY ("senderProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_receiverProId_fkey" FOREIGN KEY ("receiverProId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_receiverAthleteId_fkey" FOREIGN KEY ("receiverAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriObjective" ADD CONSTRAINT "NutriObjective_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriObjective" ADD CONSTRAINT "NutriObjective_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriJournal" ADD CONSTRAINT "NutriJournal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriMeasure" ADD CONSTRAINT "NutriMeasure_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriAlert" ADD CONSTRAINT "NutriAlert_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriRule" ADD CONSTRAINT "NutriRule_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriConsultNote" ADD CONSTRAINT "NutriConsultNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriConsultNote" ADD CONSTRAINT "NutriConsultNote_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriPlan" ADD CONSTRAINT "NutriPlan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriPlan" ADD CONSTRAINT "NutriPlan_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriMeal" ADD CONSTRAINT "NutriMeal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutriPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriFoodItem" ADD CONSTRAINT "NutriFoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "NutriMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriAlternative" ADD CONSTRAINT "NutriAlternative_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "NutriFoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriPlanVersion" ADD CONSTRAINT "NutriPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutriPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriMealTemplate" ADD CONSTRAINT "NutriMealTemplate_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutriDayTemplate" ADD CONSTRAINT "NutriDayTemplate_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedOrdonnance" ADD CONSTRAINT "MedOrdonnance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedOrdonnance" ADD CONSTRAINT "MedOrdonnance_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedPrescription" ADD CONSTRAINT "MedPrescription_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedPrescription" ADD CONSTRAINT "MedPrescription_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedProtocol" ADD CONSTRAINT "MedProtocol_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedProtocol" ADD CONSTRAINT "MedProtocol_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedAlert" ADD CONSTRAINT "MedAlert_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedAlert" ADD CONSTRAINT "MedAlert_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedClinicalNote" ADD CONSTRAINT "MedClinicalNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedClinicalNote" ADD CONSTRAINT "MedClinicalNote_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedPlan" ADD CONSTRAINT "MedPlan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedPlan" ADD CONSTRAINT "MedPlan_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedVitalEntry" ADD CONSTRAINT "MedVitalEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedVitalEntry" ADD CONSTRAINT "MedVitalEntry_proId_fkey" FOREIGN KEY ("proId") REFERENCES "Professionnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
