// ─── IDOR Protection Helpers ───
// Centralized ownership verification for all API routes.
// Each helper returns the record if the pro owns it, or null otherwise.

import { prisma } from "@/lib/prisma";

const p = prisma as any;

// ─── Direct ownership checks ───

/** Verify a kanbanTask belongs to the pro */
export async function ownKanbanTask(id: string, proId: string) {
  return prisma.kanbanTask.findFirst({ where: { id, professionnelId: proId } });
}

/** Verify a session (programme) belongs to the pro */
export async function ownSession(id: string, proId: string) {
  return prisma.session.findFirst({ where: { id, professionnelId: proId } });
}

/** Verify a nutriPlan belongs to the pro */
export async function ownNutriPlan(id: string, proId: string) {
  return p.nutriPlan.findFirst({ where: { id, proId } });
}

/** Verify a nutriAlert belongs to the pro */
export async function ownNutriAlert(id: string, proId: string) {
  return p.nutriAlert.findFirst({ where: { id, proId } });
}

/** Verify a medAlert belongs to the pro */
export async function ownMedAlert(id: string, proId: string) {
  return p.medAlert.findFirst({ where: { id, proId } });
}

// ─── Nested ownership checks (child → parent → pro) ───

/** Verify an exerciseBlock belongs to a session owned by the pro */
export async function ownBlock(blockId: string, proId: string) {
  const block = await prisma.exerciseBlock.findUnique({
    where: { id: blockId },
    select: { id: true, sessionId: true },
  });
  if (!block) return null;
  const session = await prisma.session.findFirst({
    where: { id: block.sessionId, professionnelId: proId },
  });
  return session ? block : null;
}

/** Verify an exercise belongs to a block → session owned by the pro */
export async function ownExercise(exerciseId: string, proId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, blockId: true },
  });
  if (!exercise) return null;
  const block = await ownBlock(exercise.blockId, proId);
  return block ? exercise : null;
}

/** Verify a nutriMeal belongs to a nutriPlan owned by the pro */
export async function ownNutriMeal(mealId: string, proId: string) {
  const meal = await p.nutriMeal.findUnique({
    where: { id: mealId },
    select: { id: true, planId: true },
  });
  if (!meal) return null;
  const plan = await ownNutriPlan(meal.planId, proId);
  return plan ? meal : null;
}

/** Verify a nutriFoodItem belongs to a meal → plan owned by the pro */
export async function ownNutriFoodItem(itemId: string, proId: string) {
  const item = await p.nutriFoodItem.findUnique({
    where: { id: itemId },
    select: { id: true, mealId: true },
  });
  if (!item) return null;
  const meal = await ownNutriMeal(item.mealId, proId);
  return meal ? item : null;
}

/** Verify a nutriAlternative belongs to a foodItem → meal → plan owned by the pro */
export async function ownNutriAlternative(altId: string, proId: string) {
  const alt = await p.nutriAlternative.findUnique({
    where: { id: altId },
    select: { id: true, foodItemId: true },
  });
  if (!alt) return null;
  const item = await ownNutriFoodItem(alt.foodItemId, proId);
  return item ? alt : null;
}

// ─── Generic 404 response ───

import { NextResponse } from "next/server";

export function notFound(label = "Ressource introuvable") {
  return NextResponse.json({ error: label }, { status: 404 });
}
