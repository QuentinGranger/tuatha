"use client";

import React from "react";
import styles from "./page.module.scss";
import type { Motif } from "./types";

// ─── SVG Icon renderer ───

const ICON_SVGS: Record<string, React.ReactNode> = {
  clipboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  activity: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  heartPulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><line x1="8" y1="6" x2="8" y2="6" /><line x1="12" y1="6" x2="12" y2="6" /><line x1="16" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" /></svg>,
  monitor: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  stethoscope: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6h.87" /><path d="M19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  fileText: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  leaf: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>,
  penTool: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  scale: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21" /><polyline points="8 8 4 4" /><polyline points="16 8 20 4" /><path d="M4 12a4 4 0 0 0 8 0" /><path d="M12 12a4 4 0 0 0 8 0" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
  running: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="17" cy="4" r="2" /><path d="M15.59 13.51l-4.17-1.39-1.42 4.17 4.25 5.71" /><path d="M10 5l2.11 7.39L6 16" /><path d="M17.29 8.09l-3.55 2.23" /></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  dumbbell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" /></svg>,
};

export function MotifSvgIcon({ name, size = 20 }: { name: string; size?: number }) {
  const svg = ICON_SVGS[name];
  if (!svg) return null;
  return <span className={styles.svgIcon} style={{ width: size, height: size }}>{svg}</span>;
}

// ─── Motifs par spécialité ───

const MOTIFS_KINE: Motif[] = [
  { id: "bilan", label: "Bilan initial", icon: "clipboard", description: "Première évaluation complète", duration: "45-60 min" },
  { id: "suivi", label: "Séance de suivi", icon: "refresh", description: "Continuation du traitement en cours", duration: "30 min" },
  { id: "reeducation", label: "Rééducation", icon: "activity", description: "Rééducation fonctionnelle", duration: "30-45 min" },
  { id: "douleur", label: "Douleur / blessure", icon: "heartPulse", description: "Prise en charge d'une douleur ou blessure", duration: "30-45 min" },
  { id: "prevention", label: "Prévention / récupération", icon: "shield", description: "Travail préventif ou aide à la récupération", duration: "30 min" },
  { id: "post-op", label: "Post-opératoire", icon: "building", description: "Rééducation après une opération", duration: "45 min" },
  { id: "teleconsultation", label: "Téléconsultation", icon: "monitor", description: "Consultation à distance", duration: "20-30 min" },
];

const MOTIFS_MEDECIN: Motif[] = [
  { id: "consultation", label: "Nouvelle consultation", icon: "stethoscope", description: "Première consultation ou nouveau motif", duration: "20-30 min" },
  { id: "suivi", label: "Suivi", icon: "refresh", description: "Consultation de suivi régulier", duration: "15-20 min" },
  { id: "urgence", label: "Urgence relative", icon: "zap", description: "Besoin rapide, non vital", duration: "15 min" },
  { id: "bilan", label: "Bilan", icon: "clipboard", description: "Bilan de santé complet", duration: "30-45 min" },
  { id: "douleur", label: "Douleur / blessure", icon: "heartPulse", description: "Consultation pour une douleur ou blessure", duration: "20 min" },
  { id: "certificat", label: "Certificat / avis médical", icon: "fileText", description: "Certificat médical ou avis spécialisé", duration: "15 min" },
  { id: "teleconsultation", label: "Téléconsultation", icon: "monitor", description: "Consultation à distance", duration: "15-20 min" },
];

const MOTIFS_NUTRI: Motif[] = [
  { id: "premiere", label: "Première consultation", icon: "leaf", description: "Bilan nutritionnel initial", duration: "45-60 min" },
  { id: "suivi", label: "Suivi nutritionnel", icon: "refresh", description: "Suivi et ajustement du plan", duration: "30 min" },
  { id: "bilan", label: "Bilan alimentaire", icon: "clipboard", description: "Analyse détaillée de votre alimentation", duration: "45 min" },
  { id: "plan", label: "Plan personnalisé", icon: "penTool", description: "Création d'un programme alimentaire", duration: "30-45 min" },
  { id: "poids", label: "Perte / prise de poids", icon: "scale", description: "Accompagnement objectif poids", duration: "30 min" },
  { id: "sport", label: "Nutrition sportive", icon: "running", description: "Optimisation alimentaire pour le sport", duration: "30-45 min" },
  { id: "teleconsultation", label: "Téléconsultation", icon: "monitor", description: "Consultation à distance", duration: "20-30 min" },
];

const MOTIFS_COACH: Motif[] = [
  { id: "premiere", label: "Première séance", icon: "target", description: "Évaluation et définition des objectifs", duration: "60 min" },
  { id: "suivi", label: "Séance de suivi", icon: "refresh", description: "Séance régulière de votre programme", duration: "45-60 min" },
  { id: "bilan", label: "Bilan physique", icon: "clipboard", description: "Tests et mesures de performance", duration: "45 min" },
  { id: "programme", label: "Programme personnalisé", icon: "penTool", description: "Création ou ajustement du programme", duration: "30 min" },
  { id: "preparation", label: "Préparation physique", icon: "dumbbell", description: "Préparation pour un objectif sportif", duration: "60 min" },
  { id: "prevention", label: "Prévention / récupération", icon: "shield", description: "Travail préventif ou récupération active", duration: "45 min" },
  { id: "visio", label: "Séance en visio", icon: "monitor", description: "Coaching à distance", duration: "45 min" },
];

const SPECIALITE_MOTIFS: Record<string, Motif[]> = {
  kinesitherapeute: MOTIFS_KINE,
  kine: MOTIFS_KINE,
  "kinésithérapeute": MOTIFS_KINE,
  medecin: MOTIFS_MEDECIN,
  "médecin": MOTIFS_MEDECIN,
  dieteticien: MOTIFS_NUTRI,
  "diététicien": MOTIFS_NUTRI,
  nutritionniste: MOTIFS_NUTRI,
  nutri: MOTIFS_NUTRI,
  autre: MOTIFS_COACH,
  coach: MOTIFS_COACH,
};

export function getMotifsForSpec(specialite: string): Motif[] {
  const key = specialite.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, motifs] of Object.entries(SPECIALITE_MOTIFS)) {
    const kNorm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (key.includes(kNorm) || kNorm.includes(key)) return motifs;
  }
  // Default generic motifs
  return [
    { id: "consultation", label: "Consultation", icon: "stethoscope", description: "Consultation générale", duration: "30 min" },
    { id: "suivi", label: "Suivi", icon: "refresh", description: "Rendez-vous de suivi", duration: "20-30 min" },
    { id: "bilan", label: "Bilan", icon: "clipboard", description: "Bilan complet", duration: "45 min" },
    { id: "teleconsultation", label: "Téléconsultation", icon: "monitor", description: "Consultation à distance", duration: "20 min" },
  ];
}

// ─── All possible motifs (for "I know what I need" flow) ───

export const ALL_MOTIFS: { label: string; icon: string; specs: string[]; id: string }[] = [
  { id: "douleur", label: "Douleur / blessure", icon: "heartPulse", specs: ["kine", "medecin"] },
  { id: "consultation", label: "Nouvelle consultation", icon: "stethoscope", specs: ["medecin"] },
  { id: "suivi", label: "Suivi", icon: "refresh", specs: ["kine", "medecin", "dieteticien", "nutri", "autre", "coach"] },
  { id: "bilan", label: "Bilan", icon: "clipboard", specs: ["kine", "medecin", "dieteticien", "nutri", "autre", "coach"] },
  { id: "reeducation", label: "Rééducation", icon: "activity", specs: ["kine"] },
  { id: "prevention", label: "Prévention / récupération", icon: "shield", specs: ["kine", "autre", "coach"] },
  { id: "nutrition", label: "Nutrition", icon: "leaf", specs: ["dieteticien", "nutri"] },
  { id: "poids", label: "Perte / prise de poids", icon: "scale", specs: ["dieteticien", "nutri"] },
  { id: "preparation", label: "Préparation physique", icon: "dumbbell", specs: ["autre", "coach"] },
  { id: "certificat", label: "Certificat / avis médical", icon: "fileText", specs: ["medecin"] },
  { id: "urgence", label: "Urgence relative", icon: "zap", specs: ["medecin"] },
  { id: "teleconsultation", label: "Téléconsultation", icon: "monitor", specs: ["kine", "medecin", "dieteticien", "nutri", "autre", "coach"] },
];

// ─── Speciality colors ───

export const SPECIALITE_COLORS: Record<string, string> = {
  kinesitherapeute: "#3b82f6",
  kine: "#3b82f6",
  medecin: "#a855f7",
  dieteticien: "#f59e0b",
  "diététicien": "#f59e0b",
  nutritionniste: "#f59e0b",
  nutri: "#f59e0b",
  autre: "#10b981",
  coach: "#10b981",
};

export function getSpecColor(spec: string): string {
  const key = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, color] of Object.entries(SPECIALITE_COLORS)) {
    if (key.includes(k)) return color;
  }
  return "#6b7280";
}

// ─── Smart matching: need → speciality relevance score ───

const NEED_SPEC_SCORES: Record<string, Record<string, number>> = {
  douleur:         { kine: 95, medecin: 85, autre: 30, coach: 30, dieteticien: 10, nutri: 10 },
  consultation:    { medecin: 100, kine: 40, dieteticien: 40, nutri: 40, autre: 20, coach: 20 },
  suivi:           { kine: 80, medecin: 80, dieteticien: 80, nutri: 80, autre: 80, coach: 80 },
  bilan:           { medecin: 90, kine: 85, dieteticien: 80, nutri: 80, autre: 75, coach: 75 },
  reeducation:     { kine: 100, medecin: 40, autre: 30, coach: 30, dieteticien: 5, nutri: 5 },
  prevention:      { kine: 90, autre: 85, coach: 85, medecin: 40, dieteticien: 30, nutri: 30 },
  nutrition:       { dieteticien: 100, nutri: 100, medecin: 40, autre: 30, coach: 30, kine: 10 },
  poids:           { dieteticien: 100, nutri: 100, medecin: 50, autre: 40, coach: 40, kine: 5 },
  preparation:     { autre: 100, coach: 100, kine: 60, dieteticien: 30, nutri: 30, medecin: 20 },
  certificat:      { medecin: 100, kine: 10, dieteticien: 5, nutri: 5, autre: 5, coach: 5 },
  urgence:         { medecin: 100, kine: 50, dieteticien: 10, nutri: 10, autre: 10, coach: 10 },
  teleconsultation:{ medecin: 80, kine: 70, dieteticien: 80, nutri: 80, autre: 70, coach: 70 },
};

export function getMatchScore(needId: string, specialite: string): number {
  const scores = NEED_SPEC_SCORES[needId];
  if (!scores) return 50;
  const key = specialite.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, score] of Object.entries(scores)) {
    if (key.includes(k)) return score;
  }
  return 30;
}

export function specMatchesNeed(specialite: string, needId: string): boolean {
  const need = ALL_MOTIFS.find((m) => m.id === needId);
  if (!need) return false;
  const key = specialite.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return need.specs.some((s) => key.includes(s));
}

export function getMatchLabel(score: number): string {
  if (score >= 90) return "Idéal pour votre besoin";
  if (score >= 70) return "Recommandé";
  if (score >= 50) return "Compatible";
  return "";
}

// ─── Formatting helpers ───

export function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
