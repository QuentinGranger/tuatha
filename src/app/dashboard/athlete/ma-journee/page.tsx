"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";
import { AthleteHeader } from "../components/AthleteHeader";

/* ── Icons (inline SVG) ── */
const IconClock = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconCalendar = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IconDumbbell = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11v11h-11z" /><path d="M14.5 3.5v3" /><path d="M9.5 17.5v3" /><path d="M3.5 9.5h3" /><path d="M17.5 14.5h3" /></svg>;
const IconApple = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-3 9l3 10 3-10a5 5 0 0 0-3-9z" /></svg>;
const IconHeart = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
const IconAlertTriangle = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const IconMapPin = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconVideo = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
const IconCheck = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconSun = <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
const IconPlus = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const IconTrash = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const IconX = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;

interface Appointment {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  format: string;
  visioRoomId: string | null;
  pro: { id: string; nom: string; prenom: string; specialite: string; avatarUrl: string | null; adresseCabinet: string | null } | null;
}

interface KineExercise {
  id: string;
  sets: number | null;
  reps: string | null;
  duration: string | null;
  rest: string | null;
  consignes: string | null;
  equipment: string | null;
  video: { title: string; thumbnail: string | null; category: string | null } | null;
}

interface KinePlan {
  id: string;
  title: string;
  objective: string | null;
  frequency: string | null;
  notesPatient: string | null;
  progress: number;
  proName: string | null;
  proSpecialite: string | null;
  exercises: KineExercise[];
}

interface NutriMealItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  mandatory: boolean;
}

interface NutriMeal {
  id: string;
  name: string;
  time: string | null;
  rule: string | null;
  items: NutriMealItem[];
}

interface NutriPlan {
  id: string;
  name: string;
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  waterTarget: number | null;
  notePatient: string | null;
  proName: string | null;
  proSpecialite: string | null;
  meals: NutriMeal[];
}

interface MedPlan {
  id: string;
  episode: string;
  patientStatus: string;
  conduite: string[];
  restrictions: string[];
  nextSteps: { label: string; status: string }[];
  proName: string | null;
  proSpecialite: string | null;
  updatedAt: string;
}

interface CustomEntry {
  id: string;
  nutriMealId: string;
  name: string;
  quantity: number;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DayData {
  prenom: string;
  todayAppointments: Appointment[];
  nextAppointment: Appointment | null;
  kinePlans: KinePlan[];
  nutriPlans: NutriPlan[];
  consumedItemIds: string[];
  customEntries: CustomEntry[];
  medPlans: MedPlan[];
}

async function fetchWithRefresh(url: string, opts?: RequestInit) {
  let res = await fetch(url, opts);
  if (res.status === 401) {
    const refresh = await fetch("/api/auth/refresh", { method: "POST" });
    if (refresh.ok) res = await fetch(url, opts);
  }
  return res;
}

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};

const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const STATUS_COLORS: Record<string, string> = {
  stable: "#10b981",
  surveiller: "#f59e0b",
  alerte: "#ef4444",
};

// ── SVG calorie ring (centered, clean) ──
function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const size = 130;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circ * (1 - pct);
  const remaining = Math.max(target - consumed, 0);
  const ringColor = consumed > target ? "#ef4444" : "#e67e22";

  return (
    <div className={styles.calorieRing}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div className={styles.calorieRingInner}>
        <span className={styles.calorieRingValue}>{target}</span>
        <span className={styles.calorieRingLabel}>kcal</span>
      </div>
    </div>
  );
}

function MacroCircle({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const offset = circ * (1 - pct);
  return (
    <div className={styles.macroCircle}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <span className={styles.macroCircleVal}>{Math.round(consumed)}g</span>
      <span className={styles.macroCircleLabel}>{label}</span>
      <span className={styles.macroCircleTarget}>/ {target}g</span>
    </div>
  );
}

const IconMealBreakfast = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>;
const IconMealLunch = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
const IconMealSnack = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>;
const IconMealDinner = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
const IconMealDefault = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;

const MEAL_ICON_MAP: Record<string, React.ReactNode> = {
  "petit déjeuner": IconMealBreakfast,
  "petit-déjeuner": IconMealBreakfast,
  "breakfast": IconMealBreakfast,
  "déjeuner": IconMealLunch,
  "lunch": IconMealLunch,
  "collation": IconMealSnack,
  "snack": IconMealSnack,
  "goûter": IconMealSnack,
  "dîner": IconMealDinner,
  "dinner": IconMealDinner,
};

function getMealIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(MEAL_ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return IconMealDefault;
}

export default function MaJourneePage() {
  const router = useRouter();
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [customEntries, setCustomEntries] = useState<CustomEntry[]>([]);
  const [addingMealId, setAddingMealId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithRefresh("/api/athlete/ma-journee");
      if (!res.ok) throw new Error();
      const d: DayData = await res.json();
      setData(d);
      setConsumed(new Set(d.consumedItemIds || []));
      setCustomEntries(d.customEntries || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleItem = useCallback(async (itemId: string) => {
    const newConsumed = !consumed.has(itemId);
    // Optimistic update
    setConsumed((prev) => {
      const next = new Set(prev);
      newConsumed ? next.add(itemId) : next.delete(itemId);
      return next;
    });
    setToggling((prev) => new Set(prev).add(itemId));
    try {
      await fetchWithRefresh("/api/athlete/nutri-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealItemId: itemId, consumed: newConsumed }),
      });
    } catch {
      // Revert on error
      setConsumed((prev) => {
        const next = new Set(prev);
        newConsumed ? next.delete(itemId) : next.add(itemId);
        return next;
      });
    } finally {
      setToggling((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }, [consumed]);

  // Add custom food entry
  const addCustomEntry = useCallback(async (mealId: string) => {
    if (!addForm.name.trim()) return;
    const entry = {
      nutriMealId: mealId,
      name: addForm.name.trim(),
      kcal: parseInt(addForm.kcal) || 0,
      protein: parseFloat(addForm.protein) || 0,
      carbs: parseFloat(addForm.carbs) || 0,
      fat: parseFloat(addForm.fat) || 0,
    };
    try {
      const res = await fetchWithRefresh("/api/athlete/nutri-custom-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const { entry: saved } = await res.json();
        setCustomEntries((prev) => [...prev, saved]);
        setAddForm({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
        setAddingMealId(null);
      }
    } catch { /* silently fail */ }
  }, [addForm]);

  // Delete custom food entry
  const deleteCustomEntry = useCallback(async (id: string) => {
    setCustomEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetchWithRefresh("/api/athlete/nutri-custom-entry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      fetchData();
    }
  }, [fetchData]);

  // Compute consumed macros across all nutri plans + custom entries
  const nutriTotals = React.useMemo(() => {
    if (!data) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    let kcal = 0, protein = 0, carbs = 0, fat = 0;
    for (const plan of data.nutriPlans) {
      for (const meal of plan.meals) {
        for (const item of meal.items) {
          if (consumed.has(item.id)) {
            kcal += item.kcal;
            protein += item.protein;
            carbs += item.carbs;
            fat += item.fat;
          }
        }
      }
    }
    for (const ce of customEntries) {
      kcal += ce.kcal;
      protein += ce.protein;
      carbs += ce.carbs;
      fat += ce.fat;
    }
    return { kcal, protein, carbs, fat };
  }, [data, consumed, customEntries]);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const isEmpty = data && data.todayAppointments.length === 0 && data.kinePlans.length === 0 && data.nutriPlans.length === 0 && data.medPlans.length === 0 && !data.nextAppointment;

  return (
    <div className={styles.page}>
      <AthleteHeader activeTab="ma-journee" />

      <main className={styles.main}>
        {/* ── Hero greeting ── */}
        <div className={styles.hero}>
          <div className={styles.heroIcon}>{IconSun}</div>
          <h1 className={styles.heroTitle}>{loading ? "Chargement..." : `${GREETING()}, ${data?.prenom || ""}`}</h1>
          <p className={styles.heroDate}>{todayLabel}</p>
        </div>

        {loading && (
          <div className={styles.skeleton}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        )}

        {error && (
          <div className={styles.errorBanner}>
            {IconAlertTriangle}
            <span>Impossible de charger vos données. <button onClick={fetchData}>Réessayer</button></span>
          </div>
        )}

        {!loading && isEmpty && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{IconCheck}</div>
            <h2 className={styles.emptyTitle}>Rien de prévu aujourd&apos;hui</h2>
            <p className={styles.emptyDesc}>Profitez de votre journée ! Vos rendez-vous, exercices et plans apparaîtront ici quand vos professionnels de santé vous les assigneront.</p>
          </div>
        )}

        {!loading && data && !isEmpty && (
          <div className={styles.sections}>

            {/* ── Today's Appointments ── */}
            {data.todayAppointments.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{IconCalendar}</span>
                  <h2 className={styles.sectionTitle}>Rendez-vous aujourd&apos;hui</h2>
                  <span className={styles.sectionCount}>{data.todayAppointments.length}</span>
                </div>
                <div className={styles.cardList}>
                  {data.todayAppointments.map((a) => (
                    <div key={a.id} className={styles.rdvCard} onClick={() => router.push("/dashboard/athlete/mes-rdv")}>
                      <div className={styles.rdvTime}>
                        <span className={styles.rdvHour}>{fmtTime(a.date)}</span>
                        {a.endDate && <span className={styles.rdvEndHour}>{fmtTime(a.endDate)}</span>}
                      </div>
                      <div className={styles.rdvInfo}>
                        <span className={styles.rdvTitle}>{a.title}</span>
                        {a.pro && <span className={styles.rdvPro}>{a.pro.prenom} {a.pro.nom} · {a.pro.specialite}</span>}
                        <div className={styles.rdvMeta}>
                          {a.format === "teleconsultation" ? <>{IconVideo} <span>Téléconsultation</span></> : <>{IconMapPin} <span>{a.pro?.adresseCabinet || "Cabinet"}</span></>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Next Appointment Reminder ── */}
            {data.todayAppointments.length === 0 && data.nextAppointment && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{IconClock}</span>
                  <h2 className={styles.sectionTitle}>Prochain rendez-vous</h2>
                </div>
                <div className={styles.rdvCard} onClick={() => router.push("/dashboard/athlete/mes-rdv")}>
                  <div className={styles.rdvTime}>
                    <span className={styles.rdvHour}>{fmtTime(data.nextAppointment.date)}</span>
                    <span className={styles.rdvDateLabel}>{fmtDate(data.nextAppointment.date)}</span>
                  </div>
                  <div className={styles.rdvInfo}>
                    <span className={styles.rdvTitle}>{data.nextAppointment.title}</span>
                    {data.nextAppointment.pro && <span className={styles.rdvPro}>{data.nextAppointment.pro.prenom} {data.nextAppointment.pro.nom}</span>}
                  </div>
                </div>
              </section>
            )}

            {/* ── Kine Plans / Exercises ── */}
            {data.kinePlans.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{IconDumbbell}</span>
                  <h2 className={styles.sectionTitle}>Exercices du jour</h2>
                </div>
                {data.kinePlans.map((plan) => (
                  <div key={plan.id} className={styles.planCard}>
                    <div className={styles.planHeader}>
                      <span className={styles.planTitle}>{plan.title}</span>
                      {plan.proName && <span className={styles.planPro}>{plan.proName}</span>}
                      {plan.progress > 0 && (
                        <div className={styles.planProgress}>
                          <div className={styles.planProgressBar} style={{ width: `${plan.progress}%` }} />
                          <span className={styles.planProgressLabel}>{plan.progress}%</span>
                        </div>
                      )}
                    </div>
                    {plan.objective && <p className={styles.planObjective}>{plan.objective}</p>}
                    {plan.frequency && <span className={styles.planFreq}>{plan.frequency}</span>}
                    {plan.notesPatient && <p className={styles.planNote}>{plan.notesPatient}</p>}
                    <div className={styles.exerciseList}>
                      {plan.exercises.map((ex) => (
                        <div key={ex.id} className={styles.exerciseCard}>
                          {ex.video?.thumbnail && (
                            <div className={styles.exerciseThumb}>
                              <img src={ex.video.thumbnail} alt={ex.video.title} />
                            </div>
                          )}
                          <div className={styles.exerciseInfo}>
                            <span className={styles.exerciseName}>{ex.video?.title || "Exercice"}</span>
                            <div className={styles.exerciseMeta}>
                              {ex.sets && <span>{ex.sets} séries</span>}
                              {ex.reps && <span>{ex.reps} reps</span>}
                              {ex.duration && <span>{ex.duration}</span>}
                              {ex.rest && <span>Repos: {ex.rest}</span>}
                            </div>
                            {ex.consignes && <p className={styles.exerciseConsignes}>{ex.consignes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* ── Nutrition Tracker (Yazio/MFP style) ── */}
            {data.nutriPlans.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{IconApple}</span>
                  <h2 className={styles.sectionTitle}>Nutrition du jour</h2>
                </div>
                {data.nutriPlans.map((plan) => {
                  const mealConsumedCount = (meal: NutriMeal) => meal.items.filter((i) => consumed.has(i.id)).length;
                  const mealCustomEntries = (mealId: string) => customEntries.filter((e) => e.nutriMealId === mealId);
                  return (
                    <div key={plan.id} className={styles.nutriTracker}>
                      {/* ── Dashboard card ── */}
                      <div className={styles.nutriDashboard}>
                        <CalorieRing consumed={nutriTotals.kcal} target={plan.kcalTarget} />
                        <div className={styles.nutriStats}>
                          <div className={styles.nutriStat}>
                            <span className={styles.nutriStatVal} style={{ color: "#e67e22" }}>{nutriTotals.kcal}</span>
                            <span className={styles.nutriStatLabel}>Mangé</span>
                          </div>
                          <div className={styles.nutriStatDivider} />
                          <div className={styles.nutriStat}>
                            <span className={styles.nutriStatVal}>{plan.kcalTarget}</span>
                            <span className={styles.nutriStatLabel}>Objectif</span>
                          </div>
                        </div>
                        <div className={styles.nutriMacroRow}>
                          <MacroCircle label="Prot" consumed={nutriTotals.protein} target={plan.proteinTarget} color="#3b82f6" />
                          <MacroCircle label="Gluc" consumed={nutriTotals.carbs} target={plan.carbsTarget} color="#f59e0b" />
                          <MacroCircle label="Lip" consumed={nutriTotals.fat} target={plan.fatTarget} color="#ef4444" />
                        </div>
                        {plan.proName && <div className={styles.nutriProLabel}>Plan de {plan.proName}</div>}
                      </div>
                      {plan.notePatient && <p className={styles.planNote}>{plan.notePatient}</p>}

                      {/* ── Meal cards ── */}
                      <div className={styles.mealList}>
                        {plan.meals.map((meal) => {
                          const done = mealConsumedCount(meal);
                          const customs = mealCustomEntries(meal.id);
                          const total = meal.items.length + customs.length;
                          const allDone = done === total && total > 0;
                          const mealKcal = meal.items.reduce((s, i) => s + (consumed.has(i.id) ? i.kcal : 0), 0) + customs.reduce((s, c) => s + c.kcal, 0);
                          const isAdding = addingMealId === meal.id;
                          return (
                            <div key={meal.id} className={`${styles.mealCard} ${allDone ? styles.mealCardDone : ""}`}>
                              <div className={styles.mealHeader} onClick={() => {}}>
                                <div className={styles.mealHeaderLeft}>
                                  <span className={styles.mealIcon}>{getMealIcon(meal.name)}</span>
                                  <div className={styles.mealHeaderText}>
                                    <span className={styles.mealName}>{meal.name}</span>
                                    {meal.time && <span className={styles.mealTime}>{meal.time}</span>}
                                  </div>
                                </div>
                                <div className={styles.mealHeaderRight}>
                                  <span className={styles.mealKcalBadge}>{mealKcal} kcal</span>
                                </div>
                              </div>

                              {meal.rule && <p className={styles.mealRule}>{meal.rule}</p>}

                              {/* Plan items */}
                              {meal.items.length > 0 && (
                                <div className={styles.mealItems}>
                                  {meal.items.map((item) => {
                                    const isConsumed = consumed.has(item.id);
                                    const isToggling = toggling.has(item.id);
                                    return (
                                      <button
                                        key={item.id}
                                        className={`${styles.mealItem} ${isConsumed ? styles.mealItemConsumed : ""}`}
                                        onClick={() => toggleItem(item.id)}
                                        disabled={isToggling}
                                      >
                                        <span className={`${styles.mealItemCheck} ${isConsumed ? styles.mealItemCheckOn : ""}`}>
                                          {isConsumed && IconCheck}
                                        </span>
                                        <span className={styles.mealItemInfo}>
                                          <span className={styles.mealItemName}>{item.name}</span>
                                          <span className={styles.mealItemDetail}>{item.quantity}{item.unit} · {item.kcal} kcal</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Custom entries */}
                              {customs.length > 0 && (
                                <div className={styles.mealItems}>
                                  {customs.map((ce) => (
                                    <div key={ce.id} className={`${styles.mealItem} ${styles.mealItemConsumed}`}>
                                      <span className={`${styles.mealItemCheck} ${styles.mealItemCheckOn}`}>{IconCheck}</span>
                                      <span className={styles.mealItemInfo}>
                                        <span className={styles.mealItemName}>{ce.name}</span>
                                        <span className={styles.mealItemDetail}>{ce.quantity} {ce.unit} · {ce.kcal} kcal</span>
                                      </span>
                                      <button className={styles.mealItemDelete} onClick={() => deleteCustomEntry(ce.id)}>{IconTrash}</button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add food form */}
                              {isAdding ? (
                                <div className={styles.addFoodForm}>
                                  <div className={styles.addFoodRow}>
                                    <input
                                      className={styles.addFoodInput}
                                      type="text"
                                      placeholder="Aliment (ex: Oeuf dur)"
                                      value={addForm.name}
                                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                                      autoFocus
                                    />
                                    <input
                                      className={styles.addFoodInputSm}
                                      type="number"
                                      placeholder="kcal"
                                      value={addForm.kcal}
                                      onChange={(e) => setAddForm((f) => ({ ...f, kcal: e.target.value }))}
                                    />
                                  </div>
                                  <div className={styles.addFoodRow}>
                                    <input className={styles.addFoodInputSm} type="number" placeholder="Prot (g)" value={addForm.protein} onChange={(e) => setAddForm((f) => ({ ...f, protein: e.target.value }))} />
                                    <input className={styles.addFoodInputSm} type="number" placeholder="Gluc (g)" value={addForm.carbs} onChange={(e) => setAddForm((f) => ({ ...f, carbs: e.target.value }))} />
                                    <input className={styles.addFoodInputSm} type="number" placeholder="Lip (g)" value={addForm.fat} onChange={(e) => setAddForm((f) => ({ ...f, fat: e.target.value }))} />
                                  </div>
                                  <div className={styles.addFoodActions}>
                                    <button className={styles.addFoodCancel} onClick={() => { setAddingMealId(null); setAddForm({ name: "", kcal: "", protein: "", carbs: "", fat: "" }); }}>{IconX} Annuler</button>
                                    <button className={styles.addFoodSubmit} onClick={() => addCustomEntry(meal.id)}>Ajouter</button>
                                  </div>
                                </div>
                              ) : (
                                <button className={styles.addFoodBtn} onClick={() => { setAddingMealId(meal.id); setAddForm({ name: "", kcal: "", protein: "", carbs: "", fat: "" }); }}>
                                  {IconPlus}
                                  <span>Ajouter un aliment</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* ── Medical Plans ── */}
            {data.medPlans.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{IconHeart}</span>
                  <h2 className={styles.sectionTitle}>Suivi médical</h2>
                </div>
                {data.medPlans.map((plan) => (
                  <div key={plan.id} className={styles.planCard}>
                    <div className={styles.planHeader}>
                      <span className={styles.planTitle}>{plan.episode}</span>
                      {plan.proName && <span className={styles.planPro}>{plan.proName}</span>}
                      <span className={styles.medStatus} style={{ background: `${STATUS_COLORS[plan.patientStatus] || "#6b7280"}20`, color: STATUS_COLORS[plan.patientStatus] || "#6b7280" }}>
                        {plan.patientStatus === "stable" ? "Stable" : plan.patientStatus === "surveiller" ? "À surveiller" : "Alerte"}
                      </span>
                    </div>
                    {plan.conduite.length > 0 && (
                      <div className={styles.medList}>
                        <span className={styles.medListLabel}>Conduite à tenir</span>
                        {plan.conduite.map((c, i) => <div key={i} className={styles.medListItem}>{c}</div>)}
                      </div>
                    )}
                    {plan.restrictions.length > 0 && (
                      <div className={styles.medList}>
                        <span className={`${styles.medListLabel} ${styles.medListLabelWarn}`}>Restrictions</span>
                        {plan.restrictions.map((r, i) => <div key={i} className={`${styles.medListItem} ${styles.medListItemWarn}`}>{r}</div>)}
                      </div>
                    )}
                    {plan.nextSteps.length > 0 && (
                      <div className={styles.medList}>
                        <span className={styles.medListLabel}>Prochaines étapes</span>
                        {plan.nextSteps.map((s, i) => (
                          <div key={i} className={`${styles.medListItem} ${s.status === "done" ? styles.medListItemDone : ""}`}>
                            {s.status === "done" && <span className={styles.medCheckIcon}>{IconCheck}</span>}
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>Mes Pros</span>
        </button>
        <button className={styles.bottomNavBtn} onClick={() => router.push("/dashboard/athlete/mes-rdv")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Mes RDV</span>
        </button>
        <button className={`${styles.bottomNavBtn} ${styles.bottomNavBtnActive}`} onClick={() => router.push("/dashboard/athlete/ma-journee")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span>Ma Journée</span>
        </button>
      </nav>
    </div>
  );
}
