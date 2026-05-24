"use client";

import { useState } from "react";
import type {
  NextRdv, AvailableSlot, PrepData,
  HistoryRdv, HistoryPro, HistoryTab, HistoryPeriod,
} from "../types";

type ShowToast = (message: string, type?: "success" | "error" | "info") => void;

async function fetchWithRefresh(url: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401) {
    const refresh = await fetch("/api/auth/refresh", { method: "POST" });
    if (refresh.ok) res = await fetch(url, init);
  }
  return res;
}

interface UseAppointmentActionsParams {
  appointments: NextRdv[];
  setAppointments: React.Dispatch<React.SetStateAction<NextRdv[]>>;
  showToast: ShowToast;
}

export function useAppointmentActions({ appointments, setAppointments, showToast }: UseAppointmentActionsParams) {
  // ─── Modification modal ───
  const [modifyingRdv, setModifyingRdv] = useState<NextRdv | null>(null);
  const [modifyView, setModifyView] = useState<"actions" | "reschedule" | "cancel-confirm">("actions");
  const [cancelReason, setCancelReason] = useState("");
  const [modifyLoading, setModifyLoading] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlot[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<Record<string, boolean>>({});

  const openModifyModal = (rdv: NextRdv) => {
    setModifyingRdv(rdv);
    setModifyView("actions");
    setCancelReason("");
    fetch(`/api/athlete/waitlist?eventId=${rdv.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setWaitlistStatus((prev) => ({ ...prev, [rdv.id]: !!data.waitlist }));
      })
      .catch(() => {});
  };

  const closeModifyModal = () => {
    setModifyingRdv(null);
    setModifyView("actions");
  };

  const handleCancel = async () => {
    if (!modifyingRdv) return;
    setModifyLoading(true);
    try {
      const res = await fetchWithRefresh("/api/athlete/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: modifyingRdv.id, reason: cancelReason || null }),
      });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== modifyingRdv.id));
        closeModifyModal();
        showToast("Rendez-vous annulé", "success");
      } else {
        showToast("Impossible d'annuler le rendez-vous", "error");
      }
    } catch {
      showToast("Erreur réseau — impossible d'annuler", "error");
    }
    setModifyLoading(false);
  };

  const loadRescheduleSlots = async () => {
    if (!modifyingRdv) return;
    setModifyView("reschedule");
    setRescheduleLoading(true);
    try {
      const res = await fetch(`/api/athlete/available-slots?proId=${modifyingRdv.pro.id}`);
      const data = await res.json();
      if (data?.slots) {
        setRescheduleSlots(data.slots.map((s: any) => ({ ...s, date: new Date(s.date) })));
      }
    } catch {
      showToast("Impossible de charger les créneaux", "error");
    }
    setRescheduleLoading(false);
  };

  const handleReschedule = async (slot: AvailableSlot) => {
    if (!modifyingRdv) return;
    setModifyLoading(true);
    try {
      const res = await fetchWithRefresh("/api/athlete/reschedule-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: modifyingRdv.id,
          newDate: slot.date.toISOString(),
          newDuration: slot.duration || 30,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAppointments((prev) => prev.map((a) =>
          a.id === modifyingRdv.id
            ? { ...a, date: data.date, endDate: data.endDate }
            : a
        ));
        closeModifyModal();
        showToast("Rendez-vous reprogrammé", "success");
      } else {
        showToast("Impossible de reprogrammer le rendez-vous", "error");
      }
    } catch {
      showToast("Erreur réseau — impossible de reprogrammer", "error");
    }
    setModifyLoading(false);
  };

  const handleWaitlist = async (eventId: string) => {
    const isOnWaitlist = waitlistStatus[eventId];
    try {
      if (isOnWaitlist) {
        await fetchWithRefresh("/api/athlete/waitlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        setWaitlistStatus((prev) => ({ ...prev, [eventId]: false }));
        showToast("Alerte désactivée", "info");
      } else {
        await fetchWithRefresh("/api/athlete/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        setWaitlistStatus((prev) => ({ ...prev, [eventId]: true }));
        showToast("Vous serez alerté si un créneau se libère", "success");
      }
    } catch {
      showToast("Erreur réseau — veuillez réessayer", "error");
    }
  };

  // ─── Consultation prep ───
  const defaultPrep: PrepData = { motifDetail: "", symptoms: "", painLevel: null, fatigueLevel: null, documents: [], evolution: "", completedAt: null };
  const [openPrepId, setOpenPrepId] = useState<string | null>(null);
  const [prepData, setPrepData] = useState<Record<string, PrepData>>({});
  const [prepSaving, setPrepSaving] = useState(false);

  const loadPrep = async (eventId: string) => {
    if (prepData[eventId]) return;
    try {
      const res = await fetch(`/api/athlete/consultation-prep?eventId=${eventId}`);
      const data = await res.json();
      if (data.prep) {
        setPrepData((prev) => ({ ...prev, [eventId]: { ...defaultPrep, ...data.prep } }));
      } else {
        setPrepData((prev) => ({ ...prev, [eventId]: { ...defaultPrep } }));
      }
    } catch {
      setPrepData((prev) => ({ ...prev, [eventId]: { ...defaultPrep } }));
      showToast("Impossible de charger la préparation", "error");
    }
  };

  const togglePrep = (eventId: string) => {
    if (openPrepId === eventId) {
      setOpenPrepId(null);
    } else {
      setOpenPrepId(eventId);
      loadPrep(eventId);
    }
  };

  const updatePrepField = (eventId: string, field: keyof PrepData, value: any) => {
    setPrepData((prev) => ({
      ...prev,
      [eventId]: { ...(prev[eventId] || defaultPrep), [field]: value },
    }));
  };

  const savePrep = async (eventId: string, markComplete: boolean) => {
    const prep = prepData[eventId];
    if (!prep) return;
    setPrepSaving(true);
    try {
      await fetchWithRefresh("/api/athlete/consultation-prep", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          motifDetail: prep.motifDetail,
          symptoms: prep.symptoms,
          painLevel: prep.painLevel,
          fatigueLevel: prep.fatigueLevel,
          documents: prep.documents,
          evolution: prep.evolution,
          completed: markComplete,
        }),
      });
      if (markComplete) {
        setPrepData((prev) => ({ ...prev, [eventId]: { ...prev[eventId], completedAt: new Date().toISOString() } }));
        showToast("Préparation complétée", "success");
      } else {
        showToast("Préparation sauvegardée", "success");
      }
    } catch {
      showToast("Erreur lors de la sauvegarde", "error");
    }
    setPrepSaving(false);
  };

  // ─── Day-of delay notification ───
  const [delayRdvId, setDelayRdvId] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [delayMessage, setDelayMessage] = useState("");
  const [delaySending, setDelaySending] = useState(false);
  const [delaySent, setDelaySent] = useState<Set<string>>(new Set());

  const sendDelayNotification = async (eventId: string) => {
    setDelaySending(true);
    try {
      await fetchWithRefresh("/api/athlete/notify-delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, delayMinutes, message: delayMessage }),
      });
      setDelaySent((prev) => new Set(prev).add(eventId));
      setDelayRdvId(null);
      setDelayMessage("");
      showToast("Retard signalé au praticien", "success");
    } catch {
      showToast("Impossible de signaler le retard", "error");
    }
    setDelaySending(false);
  };

  // ─── Slot alerts ───
  const [showSlotAlert, setShowSlotAlert] = useState(false);
  const [slotAlertDays, setSlotAlertDays] = useState<number[]>([]);
  const [slotAlertTimeStart, setSlotAlertTimeStart] = useState("08:00");
  const [slotAlertTimeEnd, setSlotAlertTimeEnd] = useState("18:00");
  const [slotAlertFormat, setSlotAlertFormat] = useState<string | null>(null);
  const [slotAlertPriority, setSlotAlertPriority] = useState(false);
  const [slotAlertSaving, setSlotAlertSaving] = useState(false);
  const [slotAlertSaved, setSlotAlertSaved] = useState(false);

  const toggleSlotAlertDay = (day: number) => {
    setSlotAlertDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const submitSlotAlert = async (selectedProId: string | null, selectedMotif: any) => {
    setSlotAlertSaving(true);
    try {
      await fetchWithRefresh("/api/athlete/slot-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionnelId: selectedProId || null,
          preferredDays: slotAlertDays,
          timeStart: slotAlertTimeStart,
          timeEnd: slotAlertTimeEnd,
          format: slotAlertFormat,
          motif: selectedMotif || null,
          priority: slotAlertPriority,
        }),
      });
      setSlotAlertSaved(true);
      showToast("Alerte créneau activée", "success");
    } catch {
      showToast("Impossible d'activer l'alerte", "error");
    }
    setSlotAlertSaving(false);
  };

  // ─── History ───
  const [showHistory, setShowHistory] = useState(false);
  const [historyRdvs, setHistoryRdvs] = useState<HistoryRdv[]>([]);
  const [historyPros, setHistoryPros] = useState<HistoryPro[]>([]);
  const [historyStats, setHistoryStats] = useState({ total: 0, upcoming: 0, past: 0, cancelled: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("all");
  const [historyProFilter, setHistoryProFilter] = useState<string>("");
  const [historySpecFilter, setHistorySpecFilter] = useState<string>("");
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("all");
  const [historyMotifFilter, setHistoryMotifFilter] = useState<string>("");

  const fetchHistory = async (tab?: HistoryTab, proId?: string, spec?: string, period?: HistoryPeriod, motif?: string) => {
    setHistoryLoading(true);
    const t = tab ?? historyTab;
    const params = new URLSearchParams();
    if (t !== "all") params.set("status", t);
    if (proId || historyProFilter) params.set("proId", proId || historyProFilter);
    if (spec || historySpecFilter) params.set("specialite", spec || historySpecFilter);
    if ((period || historyPeriod) !== "all") params.set("period", period || historyPeriod);
    if (motif || historyMotifFilter) params.set("motif", motif || historyMotifFilter);

    try {
      const res = await fetch(`/api/athlete/all-rdv?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryRdvs(data.appointments || []);
        setHistoryPros(data.pros || []);
        setHistoryStats(data.stats || { total: 0, upcoming: 0, past: 0, cancelled: 0 });
      }
    } catch {
      showToast("Impossible de charger l'historique", "error");
    }
    setHistoryLoading(false);
  };

  const openHistory = () => {
    setShowHistory(true);
    fetchHistory("all", "", "", "all", "");
  };

  return {
    // Modify/cancel/reschedule
    modifyingRdv, modifyView, setModifyView, cancelReason, setCancelReason,
    modifyLoading, rescheduleSlots, rescheduleLoading, waitlistStatus,
    openModifyModal, closeModifyModal, handleCancel, loadRescheduleSlots,
    handleReschedule, handleWaitlist,

    // Consultation prep
    openPrepId, prepData, prepSaving,
    togglePrep, updatePrepField, savePrep,

    // Delay notification
    delayRdvId, setDelayRdvId, delayMinutes, setDelayMinutes,
    delayMessage, setDelayMessage, delaySending, delaySent,
    sendDelayNotification,

    // Slot alerts
    showSlotAlert, setShowSlotAlert, slotAlertDays, slotAlertTimeStart, setSlotAlertTimeStart,
    slotAlertTimeEnd, setSlotAlertTimeEnd, slotAlertFormat, setSlotAlertFormat,
    slotAlertPriority, setSlotAlertPriority, slotAlertSaving, slotAlertSaved,
    toggleSlotAlertDay, submitSlotAlert,

    // History
    showHistory, setShowHistory, historyRdvs, historyPros, historyStats,
    historyLoading, historyTab, setHistoryTab, historyProFilter, setHistoryProFilter,
    historySpecFilter, setHistorySpecFilter, historyPeriod, setHistoryPeriod,
    historyMotifFilter, setHistoryMotifFilter,
    fetchHistory, openHistory,
  };
}
