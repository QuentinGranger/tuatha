// ── Shared types, interfaces, constants for athlete/pro/[proId] ──

export interface ProTarif {
  id: string;
  label: string;
  price: number;
  duration: number;
  description: string | null;
  format: string | null;
  prestationType: string;
  remboursementLabel: string;
}

export interface ProDisponibilite {
  id: string;
  jourDebut: string;
  jourFin: string;
  heureDebut: string;
  heureFin: string;
}

export interface ProInfo {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  avatarUrl: string | null;
  adresseCabinet: string | null;
}

export interface ProFullProfile extends ProInfo {
  email: string;
  telephone: string;
  statutExercice: string;
  latitude: number | null;
  longitude: number | null;
  professionAffichee: string | null;
  specialiteAffichee: string | null;
  conventionne: string;
  prestationRemboursableType: string | null;
  ordonnanceRequise: string;
  mutuelleAcceptee: string;
  remboursementNote: string | null;
  tarifs: ProTarif[];
  disponibilites: ProDisponibilite[];
  connectedSince: string;
}

export interface Rdv {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  description: string | null;
  color: string;
  format: string;
  consignes: string | null;
  visioRoomId: string | null;
  pro: { id: string; nom: string; prenom: string; specialite: string; adresseCabinet: string | null; telephone: string | null };
}

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  category: string;
  duration: number | null;
  description: string | null;
}

export interface PlanExercise {
  id: string;
  position: number;
  sets: number | null;
  reps: string | null;
  duration: string | null;
  tempo: string | null;
  rest: string | null;
  frequency: string | null;
  painThreshold: number | null;
  consignes: string | null;
  equipment: string | null;
  alternative: string | null;
  video: VideoInfo;
  logsCount: number;
}

export interface KinePlan {
  id: string;
  title: string;
  objective: string | null;
  pathology: string | null;
  phase: string | null;
  status: string;
  progress: number;
  globalProgress: number | null;
  notesPatient: string | null;
  startDate: string | null;
  endDate: string | null;
  frequency: string | null;
  nextRdvDate: string | null;
  nextRdvTime: string | null;
  nextRdvLocation: string | null;
  conclusion: string | null;
  outcomeScore: number | null;
  totalLogs: number;
  proName: string | null;
  exercises: PlanExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface DocItem {
  id: string;
  direction: "received" | "sent";
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  category: string;
  note: string | null;
  senderName: string | null;
  createdAt: string;
}

export interface AlertItem {
  id: string;
  type: string;
  status: string;
  origin: string;
  title: string;
  description: string | null;
  intensity: number | null;
  closedAt: string | null;
  planId: string | null;
  planTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Specialty-aware configuration ──
export interface SpecConfig {
  label: string;
  shortLabel: string;
  hasProgrammes: boolean;
  hasExercices: boolean;
  hasSeances: boolean;
  hasIndicateurs: boolean;
  hasNutriPlan: boolean;
  hasMedSuivi: boolean;
  hasMedIndicateurs: boolean;
  tabProgrammes: string;
  tabExercices: string;
  tabSeances: string;
  instructionsLabel: string;
  emptyHistoryLabel: string;
  rdvLabel: string;
}

export const SPEC_CONFIG: Record<string, SpecConfig> = {
  kine: {
    label: "Kinésithérapeute", shortLabel: "kiné",
    hasProgrammes: true, hasExercices: true, hasSeances: false, hasIndicateurs: false, hasNutriPlan: false, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "Mes Programmes", tabExercices: "Mes Exercices", tabSeances: "",
    instructionsLabel: "Instructions de votre kiné",
    emptyHistoryLabel: "Aucun historique de rééducation",
    rdvLabel: "Prochains rendez-vous",
  },
  medecin: {
    label: "Médecin", shortLabel: "médecin",
    hasProgrammes: false, hasExercices: false, hasSeances: false, hasIndicateurs: false, hasNutriPlan: false, hasMedSuivi: true, hasMedIndicateurs: true,
    tabProgrammes: "Mes Programmes", tabExercices: "Mes Exercices", tabSeances: "",
    instructionsLabel: "Instructions de votre médecin",
    emptyHistoryLabel: "Aucun historique de consultation",
    rdvLabel: "Prochaines consultations",
  },
  dieteticien: {
    label: "Diététicien", shortLabel: "diététicien",
    hasProgrammes: false, hasExercices: false, hasSeances: false, hasIndicateurs: false, hasNutriPlan: true, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "", tabExercices: "", tabSeances: "",
    instructionsLabel: "Instructions de votre diététicien",
    emptyHistoryLabel: "Aucun historique de suivi",
    rdvLabel: "Prochains rendez-vous",
  },
  autre: {
    label: "Autre professionnel", shortLabel: "professionnel",
    hasProgrammes: false, hasExercices: false, hasSeances: true, hasIndicateurs: true, hasNutriPlan: false, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "", tabExercices: "", tabSeances: "Mes Séances",
    instructionsLabel: "Instructions de votre professionnel",
    emptyHistoryLabel: "Aucun historique d'entraînement",
    rdvLabel: "Prochaines séances",
  },
  // Legacy values
  coach: {
    label: "Autre professionnel", shortLabel: "professionnel",
    hasProgrammes: false, hasExercices: false, hasSeances: true, hasIndicateurs: true, hasNutriPlan: false, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "", tabExercices: "", tabSeances: "Mes Séances",
    instructionsLabel: "Instructions de votre professionnel",
    emptyHistoryLabel: "Aucun historique d'entraînement",
    rdvLabel: "Prochaines séances",
  },
  nutri: {
    label: "Diététicien", shortLabel: "diététicien",
    hasProgrammes: false, hasExercices: false, hasSeances: false, hasIndicateurs: false, hasNutriPlan: true, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "", tabExercices: "", tabSeances: "",
    instructionsLabel: "Instructions de votre diététicien",
    emptyHistoryLabel: "Aucun historique de suivi",
    rdvLabel: "Prochains rendez-vous",
  },
};

export function getSpecConfig(specialite: string): SpecConfig {
  const key = specialite.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, cfg] of Object.entries(SPEC_CONFIG)) {
    if (key.includes(k)) return cfg;
  }
  return {
    label: specialite || "Professionnel", shortLabel: "professionnel",
    hasProgrammes: true, hasExercices: true, hasSeances: false, hasIndicateurs: false, hasNutriPlan: false, hasMedSuivi: false, hasMedIndicateurs: false,
    tabProgrammes: "Mes Programmes", tabExercices: "Mes Exercices", tabSeances: "",
    instructionsLabel: `Instructions de votre professionnel`,
    emptyHistoryLabel: "Aucun historique",
    rdvLabel: "Prochains rendez-vous",
  };
}

export type Tab = "programmes" | "exercices" | "seances" | "indicateurs" | "nutriplan" | "nutribilan" | "medsuivi" | "medindicateurs" | "suivi" | "signalements" | "historique";
export type MedSubTab = "ordonnances" | "prescriptions" | "protocoles";

export const CATEGORIES = [
  { value: "dos", label: "Dos" }, { value: "epaules", label: "Épaules" },
  { value: "genoux", label: "Genoux" }, { value: "cervicales", label: "Cervicales" },
  { value: "chevilles", label: "Chevilles" }, { value: "hanches", label: "Hanches" },
  { value: "poignet", label: "Poignet" }, { value: "global", label: "Global" },
];

export function catLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label || value;
}

// ── YouTube helpers ──
export function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com/embed/") || url.includes("youtube.com/watch") || url.includes("youtu.be/");
}

export function toYouTubeEmbed(url: string): string {
  if (url.includes("youtube.com/embed/")) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch { /* ignore */ }
  return url;
}

export const STATUS_LABELS: Record<string, string> = {
  active: "En cours", paused: "Pause", completed: "Terminé", archived: "Archivé",
};
export const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e", paused: "#f59e0b", completed: "#3b82f6", archived: "#6b7280",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  planifiee: "Planifiée", en_cours: "En cours", realisee: "Réalisée", annulee: "Annulée",
};
export const SESSION_STATUS_COLORS: Record<string, string> = {
  planifiee: "#3b82f6", en_cours: "#f59e0b", realisee: "#22c55e", annulee: "#6b7280",
};

// ── Shared format helpers ──
export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const formatShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const formatRelative = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days}j`;
  return formatShort(d);
};

// ── Document helpers ──
export const DOC_CATEGORIES: Record<string, string> = {
  bilan: "Bilan", ordonnance: "Ordonnance", imagerie: "Imagerie",
  "compte-rendu": "Compte-rendu", programme: "Programme",
  administratif: "Administratif", autre: "Autre",
};

export function docIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return "📊";
  return "📎";
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const UPLOAD_CATEGORIES = [
  { value: "bilan", label: "Bilan" },
  { value: "ordonnance", label: "Ordonnance" },
  { value: "imagerie", label: "Imagerie" },
  { value: "compte-rendu", label: "Compte-rendu" },
  { value: "administratif", label: "Administratif" },
  { value: "autre", label: "Autre" },
];
