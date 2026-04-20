"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../components/LegalFooter";

// Hooks
import { useToast } from "./hooks/useToast";
import { useBookingData } from "./hooks/useBookingData";
import { useBookingFlow } from "./hooks/useBookingFlow";
import { useAppointmentActions } from "./hooks/useAppointmentActions";
import { useSlotSuggestions } from "./hooks/useSlotSuggestions";
import { useBookingWarnings } from "./hooks/useBookingWarnings";

// Components
import { BookingProgress, BookingFlow } from "./components/BookingFlow";
import { StepChooseSlot } from "./components/StepChooseSlot";
import { StepSummary } from "./components/StepSummary";
import { AppointmentView } from "./components/AppointmentView";
import { ModifyModal } from "./components/ModifyModal";
import { ToastContainer } from "./components/ToastContainer";
import { QuickBookAI } from "./components/QuickBookAI";
import { CalendarAgenda } from "./components/CalendarAgenda";

export default function MesRdvPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const proIdParam = searchParams.get("proId");
  const [pageView, setPageView] = React.useState<"list" | "calendar">("calendar");

  // ─── Toast notifications ───
  const { toasts, showToast, dismissToast } = useToast();

  // ─── Data hook: connections, appointments, prefs, profile, reminders ───
  const data = useBookingData(showToast);

  // ─── Booking flow hook: steps, navigation, filters, slots, form, calendar ───
  const flow = useBookingFlow({
    connections: data.connections,
    learnedPrefs: data.learnedPrefs,
    showToast,
  });

  // Start booking if URL has ?action=book or ?action=quick-book
  const quickBookTriggered = React.useRef(false);

  React.useEffect(() => {
    if (action === "book" && !flow.booking) {
      flow.startBooking();
    }
  }, [action]);

  React.useEffect(() => {
    if (action === "quick-book" && !quickBookTriggered.current && data.connsStatus === "success") {
      quickBookTriggered.current = true;
      flow.startQuickBook(proIdParam || undefined);
    }
  }, [action, data.connsStatus]);

  // ─── Appointment actions hook: modify, cancel, reschedule, prep, delay, history ───
  const actions = useAppointmentActions({
    appointments: data.appointments,
    setAppointments: data.setAppointments,
    showToast,
  });

  // ─── Slot suggestions (scoring engine) ───
  const suggestedSlots = useSlotSuggestions({
    availableSlots: flow.availableSlots,
    appointments: data.appointments,
    selectedFormat: flow.selectedFormat,
    selectedMotif: flow.selectedMotif,
    selectedPro: flow.selectedPro,
    learnedPrefs: data.learnedPrefs,
  });

  // ─── Booking warnings (pre-validation) ───
  const bookingWarnings = useBookingWarnings({
    step: flow.step,
    selectedSlot: flow.selectedSlot,
    selectedPro: flow.selectedPro,
    selectedMotif: flow.selectedMotif,
    selectedNeed: flow.selectedNeed,
    selectedFormat: flow.selectedFormat,
    appointments: data.appointments,
    connections: data.connections,
    athleteProfile: data.athleteProfile,
    formDocs: flow.formDocs,
    setStep: flow.setStep,
    setSelectedPro: flow.setSelectedPro,
  });

  // ─── Render ───
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className={styles.headerTitle}>Mes Rendez-vous</h1>
        {!flow.booking && (
          <div className={styles.calViewToggle}>
            <button className={`${styles.calViewToggleBtn} ${pageView === "calendar" ? styles.calViewToggleBtnActive : ""}`} onClick={() => setPageView("calendar")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Agenda
            </button>
            <button className={`${styles.calViewToggleBtn} ${pageView === "list" ? styles.calViewToggleBtnActive : ""}`} onClick={() => setPageView("list")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
              Liste
            </button>
          </div>
        )}
        {!flow.booking && (
          <button className={styles.bookBtn} onClick={flow.startBooking}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Réserver
          </button>
        )}
      </header>

      <main className={styles.main}>
        {flow.booking ? (
          <div className={styles.bookingFlow}>
            {/* Progress indicator (hidden for quick-book) */}
            {!flow.bookingConfirmed && flow.step !== "quick-book" && <BookingProgress step={flow.step} />}

            {/* Back button */}
            {!flow.bookingConfirmed && (
              <button className={styles.bookingBack} onClick={flow.goBack}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Retour
              </button>
            )}

            {/* Quick Book AI */}
            {flow.step === "quick-book" && (
              <QuickBookAI
                flow={flow}
                learnedPrefs={data.learnedPrefs}
                appointments={data.appointments}
              />
            )}

            {/* Steps 1-4: Need, Pro, Motif, Filters */}
            {["choose-need", "choose-pro", "choose-motif", "choose-filters"].includes(flow.step) && (
              <BookingFlow
                flow={flow}
                connections={data.connections}
                connsStatus={data.connsStatus}
                fetchConnections={data.fetchConnections}
                learnedPrefs={data.learnedPrefs}
                router={router}
              />
            )}

            {/* Step 5: Slot selection */}
            {flow.step === "choose-slot" && (
              <StepChooseSlot
                flow={flow}
                suggestedSlots={suggestedSlots}
                actions={actions}
              />
            )}

            {/* Step 6: Summary + Confirmation */}
            {(flow.step === "summary" || flow.bookingConfirmed) && (
              <StepSummary
                flow={flow}
                bookingWarnings={bookingWarnings}
                athleteProfile={data.athleteProfile}
              />
            )}
          </div>
        ) : pageView === "calendar" ? (
          <CalendarAgenda
            appointments={data.appointments}
            pastAppointments={data.pastAppointments}
            onBook={flow.startBooking}
          />
        ) : (
          <AppointmentView
            data={data}
            flow={flow}
            actions={actions}
          />
        )}

        {/* Modification modal (always rendered, shown when modifyingRdv is set) */}
        <ModifyModal actions={actions} />
      </main>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      <LegalFooter />
    </div>
  );
}
