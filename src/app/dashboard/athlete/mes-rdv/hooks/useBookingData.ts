"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  MyConnection, NextRdv, PastRdv, LearnedPreferences,
  AthleteProfile, InAppReminder,
} from "../types";

type ShowToast = (message: string, type?: "success" | "error" | "info") => void;

export type FetchStatus = "idle" | "loading" | "success" | "error";

export function useBookingData(showToast: ShowToast) {
  // ─── Connections ───
  const [connections, setConnections] = useState<MyConnection[]>([]);
  const [connsStatus, setConnsStatus] = useState<FetchStatus>("loading");

  const fetchConnections = useCallback(async () => {
    setConnsStatus("loading");
    try {
      const res = await fetch("/api/athlete/my-connections");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data?.connections) {
        setConnections(data.connections.filter((c: MyConnection) => c.status === "accepted"));
      }
      setConnsStatus("success");
    } catch {
      setConnsStatus("error");
      showToast("Impossible de charger vos professionnels", "error");
    }
  }, [showToast]);

  // ─── Appointments ───
  const [appointments, setAppointments] = useState<NextRdv[]>([]);
  const [rdvStatus, setRdvStatus] = useState<FetchStatus>("loading");

  const fetchAppointments = useCallback(async () => {
    setRdvStatus("loading");
    try {
      const res = await fetch("/api/athlete/next-rdv");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data?.appointments) setAppointments(data.appointments);
      setRdvStatus("success");
    } catch {
      setRdvStatus("error");
      showToast("Impossible de charger vos rendez-vous", "error");
    }
  }, [showToast]);

  // ─── Past appointments ───
  const [pastAppointments, setPastAppointments] = useState<PastRdv[]>([]);
  const [pastStatus, setPastStatus] = useState<FetchStatus>("loading");

  const fetchPastAppointments = useCallback(async () => {
    setPastStatus("loading");
    try {
      const res = await fetch("/api/athlete/past-rdv");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data?.pastAppointments) setPastAppointments(data.pastAppointments);
      setPastStatus("success");
    } catch {
      setPastStatus("error");
      showToast("Impossible de charger les consultations passées", "error");
    }
  }, [showToast]);

  // ─── Preferences ───
  const [learnedPrefs, setLearnedPrefs] = useState<LearnedPreferences | null>(null);
  const [prefsStatus, setPrefsStatus] = useState<FetchStatus>("loading");

  const fetchPreferences = useCallback(async () => {
    setPrefsStatus("loading");
    try {
      const res = await fetch("/api/athlete/preferences");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data?.preferences) setLearnedPrefs(data.preferences);
      setPrefsStatus("success");
    } catch {
      setPrefsStatus("error");
      showToast("Impossible de charger vos préférences", "error");
    }
  }, [showToast]);

  // ─── Profile ───
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<FetchStatus>("loading");

  const fetchProfile = useCallback(async () => {
    setProfileStatus("loading");
    try {
      const res = await fetch("/api/athlete/profile");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (data) setAthleteProfile(data);
      setProfileStatus("success");
    } catch {
      setProfileStatus("error");
      showToast("Impossible de charger votre profil", "error");
    }
  }, [showToast]);

  // ─── In-app reminders (polling, silent errors) ───
  const [activeReminders, setActiveReminders] = useState<InAppReminder[]>([]);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/athlete/booking-reminders");
      if (res.ok) {
        const data = await res.json();
        if (data?.reminders) setActiveReminders(data.reminders);
      }
    } catch { /* polling — silent */ }
  }, []);

  // ─── Follow-up ───
  const [followUpBooked, setFollowUpBooked] = useState<Set<string>>(new Set());
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);

  const scheduleFollowUp = async (pastRdv: PastRdv, days: number) => {
    const key = `${pastRdv.id}-${days}`;
    setFollowUpLoading(key);
    try {
      const res = await fetch("/api/athlete/schedule-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastEventId: pastRdv.id, days, proId: pastRdv.pro.id }),
      });
      if (res.ok) {
        setFollowUpBooked((prev) => new Set(prev).add(pastRdv.id));
        showToast("Suivi programmé avec succès", "success");
        fetchAppointments();
      } else {
        showToast("Impossible de programmer le suivi", "error");
      }
    } catch {
      showToast("Erreur réseau — impossible de programmer le suivi", "error");
    }
    setFollowUpLoading(null);
  };

  const dismissReminder = (id: string) => {
    setActiveReminders((prev) => prev.filter((r) => r.id !== id));
    fetch("/api/athlete/booking-reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderId: id }),
    }).catch(() => showToast("Erreur lors de la suppression du rappel", "error"));
  };

  // ─── Retry all failed fetches ───
  const retryFailed = useCallback(() => {
    if (connsStatus === "error") fetchConnections();
    if (rdvStatus === "error") fetchAppointments();
    if (pastStatus === "error") fetchPastAppointments();
    if (prefsStatus === "error") fetchPreferences();
    if (profileStatus === "error") fetchProfile();
  }, [connsStatus, rdvStatus, pastStatus, prefsStatus, profileStatus,
      fetchConnections, fetchAppointments, fetchPastAppointments, fetchPreferences, fetchProfile]);

  // ─── Initial fetch on mount ───
  useEffect(() => {
    fetchConnections();
    fetchAppointments();
    fetchPastAppointments();
    fetchPreferences();
    fetchProfile();
    fetchReminders();

    const reminderInterval = setInterval(fetchReminders, 60_000);
    return () => clearInterval(reminderInterval);
  }, [fetchConnections, fetchAppointments, fetchPastAppointments, fetchPreferences, fetchProfile, fetchReminders]);

  // Derived convenience booleans
  const loadingConns = connsStatus === "loading";
  const loadingRdvs = rdvStatus === "loading";
  const loadingPast = pastStatus === "loading";
  const hasAnyError = connsStatus === "error" || rdvStatus === "error" || pastStatus === "error"
    || prefsStatus === "error" || profileStatus === "error";

  return {
    // Connections
    connections, loadingConns, connsStatus, fetchConnections,
    // Appointments
    appointments, setAppointments, loadingRdvs, rdvStatus, fetchAppointments,
    // Past
    pastAppointments, loadingPast, pastStatus, fetchPastAppointments,
    // Preferences
    learnedPrefs, prefsStatus, fetchPreferences,
    // Profile
    athleteProfile, profileStatus, fetchProfile,
    // Reminders
    activeReminders, dismissReminder,
    // Follow-up
    followUpBooked, followUpLoading, scheduleFollowUp,
    // Global
    hasAnyError, retryFailed,
  };
}
