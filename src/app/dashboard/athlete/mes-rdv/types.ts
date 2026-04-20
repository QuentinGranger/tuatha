// ─── Shared types for mes-rdv ───

export interface Motif {
  id: string;
  label: string;
  icon: string;
  description: string;
  duration?: string;
}

export interface ProTarif {
  id: string;
  label: string;
  price: number;   // cents
  duration: number; // minutes
  description?: string | null;
  format?: string | null; // "presentiel" | "teleconsultation" | null
  prestationType?: string; // consultation_visio, consultation_presentielle, suivi_ponctuel, pack_non_remboursable
  remboursementLabel?: string; // potentiellement_remboursable, hors_assurance_maladie, complementaire_possible, a_verifier_patient
}

export interface ProInfo {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  avatarUrl: string | null;
  adresseCabinet: string | null;
  tarifs?: ProTarif[];
}

export interface MyConnection {
  id: string;
  status: string;
  professionnel: ProInfo;
}

export interface NextRdv {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  description: string | null;
  format?: string;
  consignes?: string | null;
  visioRoomId?: string | null;
  pro: { id: string; nom: string; prenom: string; specialite: string; adresseCabinet?: string | null; telephone?: string | null };
}

export interface PastRdvDoc { id: string; name: string; category: string; note?: string | null }
export interface PastRdvOrd { id: string; type: string; diagnosis: string; pdfUrl?: string | null }
export interface FollowUpSuggestion { label: string; days: number }

export interface PastRdv {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  format: string;
  motif: string | null;
  documents: PastRdvDoc[];
  ordonnances: PastRdvOrd[];
  followUpSuggestions: FollowUpSuggestion[];
  pro: { id: string; nom: string; prenom: string; specialite: string };
}

export interface HistoryRdv {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  format: string;
  motif: string | null;
  status: "upcoming" | "past" | "cancelled";
  cancelledAt: string | null;
  visioRoomId?: string | null;
  documents: { id: string; name: string; category: string }[];
  ordonnances: { id: string; type: string; diagnosis: string }[];
  pro: { id: string; nom: string; prenom: string; specialite: string };
}

export interface HistoryPro { id: string; nom: string; prenom: string; specialite: string }

export type HistoryTab = "all" | "upcoming" | "past" | "cancelled";
export type HistoryPeriod = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

export interface ProRegularity {
  isRegular: boolean;
  periodDays: number | null;
  periodLabel: string | null;
  confidence: number;
  nextIdealDate: string | null;
}

export interface ProProfile {
  preferredHour: number | null;
  preferredDay: number | null;
  preferredDayName: string | null;
  avgIntervalDays: number | null;
  regularity: ProRegularity;
}

export interface HourRange {
  start: number;
  end: number;
  pct: number;
  label: string;
}

export interface SequentialPattern {
  from: string;
  to: string;
  count: number;
  avgDelayDays: number;
}

export interface LearnedPreferences {
  totalAppointments: number;
  cancelledCount: number;
  dataConfidence: number; // 0-100
  preferredHours: { hour: number; pct: number; confidence: number }[];
  preferredDays: { day: number; name: string; pct: number; confidence: number }[];
  preferredFormat: { format: string; presentielPct: number; teleconsultationPct: number; confidence: number };
  preferredTimeSlot: string;
  hourRange: HourRange | null;
  topDayHours: { day: number; dayName: string; hour: number; pct: number; label: string }[];
  motifFormatPrefs: Record<string, { format: string; confidence: number }>;
  topPros: { id: string; nom: string; prenom: string; specialite: string; count: number; pct: number; profile: ProProfile | null }[];
  avgDuration: number | null;
  avgBookingDelay: number | null;
  avgFollowUpInterval: number | null;
  trends: {
    hours: { hour: number; direction: "rising" | "falling"; delta: number }[];
    days: { day: number; dayName: string; direction: "rising" | "falling"; delta: number }[];
  };
  cancellationPatterns: {
    avoidSlots: { hour: number; risk: number }[];
    avoidDays: { day: number; dayName: string; risk: number }[];
  };
  regularity: {
    isRegular: boolean;
    periodDays: number | null;
    periodLabel: string | null;
    confidence: number;
    nextIdealDate: string | null;
  };
  seasonalAwareness: { season: string; usualSlot: string; seasonalSlot: string } | null;
  sequentialPatterns: SequentialPattern[];
  bookingVelocity: "last-minute" | "spontane" | "planificateur" | "anticipateur" | null;
  engagement: {
    level: "actif" | "regulier" | "en-baisse" | "inactif" | "nouveau";
    recent90: number;
    prev90: number;
    daysSinceLast: number | null;
  };
  preferenceStability: number | null; // 0-100
  scoring: {
    hourBonus: number | null;
    hourConf: number;
    hourBonus2: number | null;
    hourConf2: number;
    dayBonus: number | null;
    dayConf: number;
    dayBonus2: number | null;
    formatBonus: string | null;
    formatConf: number;
    topProIds: string[];
    durationTarget: number | null;
    timeSlot: string;
    seasonalTimeSlot: string | null;
    hourRange: HourRange | null;
    dayHourCombos: { day: number; hour: number; pct: number }[];
    cancelPenaltyHours: number[];
    cancelPenaltyDays: number[];
    trendingHour: number | null;
    trendingDay: number | null;
    proProfiles: Record<string, ProProfile>;
    regularity: { periodDays: number | null; nextIdealDate: string | null } | null;
    sequentialPatterns: SequentialPattern[];
    confidence: number; // 0-1
    stability: number | null; // 0-100
  };
}

export interface AvailableSlot {
  id: string;
  date: Date;
  duration: number;
}

export interface SuggestedSlot {
  slot: AvailableSlot;
  badges: { label: string; icon: string; color: string }[];
  score: number;
  matchPct?: number;
}

export interface BookingWarning {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}

export interface AthleteProfile {
  prenom: string; nom: string; email: string; telephone: string;
  sport: string | null; antecedents: string[]; traitements: string | null;
  contreIndications: string | null;
}

export interface InAppReminder {
  id: string;
  type: string;
  eventTitle: string;
  eventDate: string;
  eventEndDate: string | null;
  eventFormat: string;
  eventMotif: string;
  eventAddress: string | null;
  eventDocuments: string | null;
  eventVisioRoomId?: string | null;
  scheduledAt: string;
  professionnel: {
    nom: string; prenom: string; specialite: string;
    telephone: string | null; email: string | null; adresseCabinet: string | null;
  };
}

export interface PrepData {
  motifDetail: string;
  symptoms: string;
  painLevel: number | null;
  fatigueLevel: number | null;
  documents: string[];
  evolution: string;
  completedAt: string | null;
}

export type ProFilterMode = "recommended" | "habitual" | "first-available";
export type TimeSlot = "matin" | "midi" | "apres-midi" | "soir";
export type PeriodFilter = "this-week" | "next-week" | "this-month" | "any";
export type CalendarView = "list" | "day" | "week";
export type BookingStep = "choose-need" | "choose-pro" | "choose-motif" | "choose-filters" | "choose-slot" | "summary" | "quick-book";
