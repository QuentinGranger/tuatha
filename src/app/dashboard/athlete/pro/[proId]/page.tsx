"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "./page.module.scss";
import LegalFooter from "../../components/LegalFooter";

import type { ProInfo, ProFullProfile, Rdv, KinePlan, AlertItem, DocItem } from "./components/types";
import { getSpecConfig } from "./components/types";
import { ProfileHero, ProfileInfoView, SuiviView } from "./components";

export default function AthleteProPage() {
  const router = useRouter();
  const params = useParams();
  const proId = params.proId as string;

  // ── Core state ──
  const [pro, setPro] = useState<ProInfo | null>(null);
  const [fullProfile, setFullProfile] = useState<ProFullProfile | null>(null);
  const [connectedSince, setConnectedSince] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(true);
  const [rdvLoading, setRdvLoading] = useState(true);
  const [profileView, setProfileView] = useState<"profil" | "suivi">("profil");

  // ── Suivi state ──
  const [plans, setPlans] = useState<KinePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const specConfig = pro ? getSpecConfig(pro.specialite) : null;

  // ── Data fetching ──
  useEffect(() => {
    Promise.all([
      fetch("/api/athlete/my-connections").then((r) => r.ok ? r.json() : null),
      fetch(`/api/athlete/pro-profile/${proId}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([connData, profileData]) => {
        if (connData?.connections) {
          const conn = connData.connections.find((c: any) => c.status === "accepted" && c.professionnel.id === proId);
          if (conn) {
            setPro(conn.professionnel);
            setConnectedSince(conn.respondedAt || conn.createdAt);
          }
        }
        if (profileData && !profileData.error) setFullProfile(profileData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proId]);

  useEffect(() => {
    fetch("/api/athlete/next-rdv")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.appointments) setRdvs(data.appointments.filter((a: Rdv) => a.pro.id === proId));
      })
      .catch(() => {})
      .finally(() => setRdvLoading(false));
  }, [proId]);

  const refreshPlans = useCallback(() => {
    fetch(`/api/athlete/kine-plans?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.plans) setPlans(data.plans); })
      .catch(() => {});
  }, [proId]);

  const refreshAlerts = useCallback(() => {
    fetch(`/api/athlete/alerts?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.alerts) setAlerts(data.alerts); })
      .catch(() => {})
      .finally(() => setAlertsLoading(false));
  }, [proId]);

  const refreshDocs = useCallback(() => {
    fetch(`/api/athlete/documents?proId=${proId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.documents) setDocs(data.documents); })
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [proId]);

  useEffect(() => {
    refreshPlans();
    setPlansLoading(false);
    refreshAlerts();
    refreshDocs();
  }, [refreshPlans, refreshAlerts, refreshDocs]);

  // ── Loading / empty states ──
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingSkeleton}>
            <div className={styles.skeletonCircle} />
            <div className={styles.skeletonLines}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} style={{ width: "60%" }} />
              <div className={styles.skeletonLine} style={{ width: "40%" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pro) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>← Retour</button>
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
            <p>Professionnel introuvable ou connexion non active.</p>
            <button className={styles.profileActionPrimary} onClick={() => router.push("/dashboard/athlete")}>
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sc = specConfig!;

  return (
    <div className={styles.page}>
      <ProfileHero
        proId={proId}
        prenom={pro.prenom}
        nom={pro.nom}
        avatarUrl={pro.avatarUrl}
        fullProfile={fullProfile}
        specConfig={sc}
        connectedSince={connectedSince}
        profileView={profileView}
        onViewChange={setProfileView}
      />

      {profileView === "profil" && (
        <ProfileInfoView
          proId={proId}
          fullProfile={fullProfile}
          specConfig={sc}
          rdvs={rdvs}
          rdvLoading={rdvLoading}
        />
      )}

      {profileView === "suivi" && (
        <SuiviView
          proId={proId}
          specConfig={sc}
          plans={plans}
          plansLoading={plansLoading}
          alerts={alerts}
          alertsLoading={alertsLoading}
          docs={docs}
          docsLoading={docsLoading}
          onRefreshPlans={refreshPlans}
          onRefreshAlerts={refreshAlerts}
          onRefreshDocs={refreshDocs}
        />
      )}

      <LegalFooter />
    </div>
  );
}
