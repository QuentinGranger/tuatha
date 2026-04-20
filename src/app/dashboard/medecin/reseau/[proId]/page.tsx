"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.scss";

interface ProInfo { id: string; nom: string; prenom: string; specialite: string | null; avatarPath: string | null; email?: string; telephone?: string }

export default function SharedProPage() {
  const { proId } = useParams<{ proId: string }>();
  const searchParams = useSearchParams();
  const athleteId = searchParams.get("athleteId") || "";
  const router = useRouter();

  const [proInfo, setProInfo] = useState<ProInfo | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!proId || !athleteId) return;
    setLoading(true);
    fetch(`/api/reseau/shared?athleteId=${athleteId}&proId=${proId}`)
      .then((r) => { if (!r.ok) throw new Error("Erreur"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données partagées"); setLoading(false); });

    fetch(`/api/reseau/shared/pro-info?proId=${proId}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setProInfo(d); })
      .catch(() => {});
  }, [proId, athleteId]);

  const getInitials = (nom: string, prenom: string) =>
    `${(prenom || "")[0] || ""}${(nom || "")[0] || ""}`.toUpperCase();

  const fixAvatar = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return path;
  };

  if (!athleteId) return <div className={styles.page}><div className={styles.empty}>Paramètre athleteId manquant</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Retour au réseau
        </button>
      </div>

      {proInfo && (
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            {fixAvatar(proInfo.avatarPath)
              ? <img src={fixAvatar(proInfo.avatarPath)!} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = getInitials(proInfo.nom, proInfo.prenom); }} />
              : getInitials(proInfo.nom, proInfo.prenom)}
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{proInfo.prenom} {proInfo.nom}</h1>
            <div className={styles.profileSpecialite}>{proInfo.specialite || "Professionnel"}</div>
            {proInfo.email && <div className={styles.profileContact}>{proInfo.email}</div>}
            {proInfo.telephone && <div className={styles.profileContact}>{proInfo.telephone}</div>}
          </div>
          {data?.permissions && (
            <div className={styles.permBadges}>
              {data.permissions.readProgramme && <span className={styles.permBadge}>Programme</span>}
              {data.permissions.readIndicateurs && <span className={styles.permBadge}>Indicateurs</span>}
              {data.permissions.readBlessures && <span className={styles.permBadge}>Pathologies</span>}
              {data.permissions.readDocuments && <span className={styles.permBadge}>Documents</span>}
            </div>
          )}
        </div>
      )}

      {loading && <div className={styles.loading}>Chargement des données partagées...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {data && !loading && (
        <div className={styles.content}>
          {data.kinePlans?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Plans de rééducation
                <span className={styles.sectionCount}>{data.kinePlans.length}</span>
              </div>
              <div className={styles.cards}>
                {data.kinePlans.map((plan: any) => (
                  <div key={plan.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <strong>{plan.title}</strong>
                      {plan.status && <span className={styles.statusChip}>{plan.status}</span>}
                    </div>
                    {plan.objective && <div className={styles.cardMeta}>Objectif : {plan.objective}</div>}
                    {plan.pathology && <div className={styles.cardMeta}>Pathologie : {plan.pathology}</div>}
                    {plan.phase && <div className={styles.cardMeta}>Phase : {plan.phase}</div>}
                    {plan.frequency && <div className={styles.cardMeta}>Fréquence : {plan.frequency}</div>}
                    {plan.notesPro && <div className={styles.cardNote}>{plan.notesPro}</div>}
                    {plan.globalProgress != null && (
                      <div className={styles.progressWrap}>
                        <div className={styles.progressLabel}>Progression</div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${plan.globalProgress}%` }} />
                        </div>
                        <span className={styles.progressValue}>{plan.globalProgress}%</span>
                      </div>
                    )}
                    {plan.startDate && (
                      <div className={styles.cardMeta}>
                        Du {new Date(plan.startDate).toLocaleDateString("fr-FR")}
                        {plan.endDate ? ` au ${new Date(plan.endDate).toLocaleDateString("fr-FR")}` : ""}
                      </div>
                    )}
                    {plan.exercises?.length > 0 && (
                      <div className={styles.exerciseList}>
                        <div className={styles.exerciseListTitle}>Exercices ({plan.exercises.length})</div>
                        {plan.exercises.map((ex: any) => (
                          <div key={ex.id} className={styles.exerciseItem}>
                            <div className={styles.exerciseName}>{ex.video?.title || "Exercice"}</div>
                            <div className={styles.exerciseDetails}>
                              {ex.sets && <span>{ex.sets} séries</span>}
                              {ex.reps && <span>{ex.reps} reps</span>}
                              {ex.duration && <span>{ex.duration}</span>}
                              {ex.frequency && <span>{ex.frequency}</span>}
                              {ex.rest && <span>Repos: {ex.rest}</span>}
                            </div>
                            {ex.consignes && <div className={styles.exerciseConsigne}>{ex.consignes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {plan.exercises?.length === 0 && (
                      <div className={styles.emptyMini}>Aucun exercice dans ce plan</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.sessions?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Séances
                <span className={styles.sectionCount}>{data.sessions.length}</span>
              </div>
              <div className={styles.cards}>
                {data.sessions.map((s: any) => (
                  <div key={s.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <strong>{s.name}</strong>
                      <span className={styles.statusChip}>{s.status}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      {new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {s.time ? ` à ${s.time}` : ""}
                    </div>
                    {s.lieu && <div className={styles.cardMeta}>Lieu : {s.lieu}</div>}
                    {s.objectif && <div className={styles.cardMeta}>Objectif : {s.objectif}</div>}
                    {s.tags?.length > 0 && (
                      <div className={styles.tagRow}>
                        {s.tags.map((t: string) => <span key={t} className={styles.tag}>{t}</span>)}
                      </div>
                    )}
                    {s.notePro && <div className={styles.cardNote}>{s.notePro}</div>}
                    {s.blocks?.length > 0 && (
                      <div className={styles.exerciseList}>
                        <div className={styles.exerciseListTitle}>Blocs d&apos;exercices</div>
                        {s.blocks.map((b: any) => (
                          <div key={b.id} className={styles.blockGroup}>
                            <div className={styles.blockName}>{b.name}</div>
                            {b.exercises?.map((ex: any) => (
                              <div key={ex.id} className={styles.exerciseItem}>
                                <div className={styles.exerciseName}>{ex.name || "Exercice"}</div>
                                <div className={styles.exerciseDetails}>
                                  {ex.sets && <span>{ex.sets} séries</span>}
                                  {ex.reps && <span>{ex.reps} reps</span>}
                                  {ex.duration && <span>{ex.duration}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.logs?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                Retours &amp; indicateurs
                <span className={styles.sectionCount}>{data.logs.length}</span>
              </div>
              <div className={styles.logGrid}>
                {data.logs.map((log: any) => (
                  <div key={log.id} className={styles.logCard}>
                    <div className={styles.logExercise}>{log.exercise?.video?.title || "Exercice"}</div>
                    <div className={styles.logRow}>
                      <span className={log.done ? styles.logDone : styles.logNotDone}>{log.done ? "Réalisé" : "Non réalisé"}</span>
                      {log.pain != null && <span className={styles.logPain}>Douleur : {log.pain}/10</span>}
                    </div>
                    {log.comment && <div className={styles.logComment}>{log.comment}</div>}
                    <div className={styles.logDate}>{new Date(log.loggedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.athleteInfo?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Informations patient
              </div>
              {data.athleteInfo.map((info: any) => (
                <div key={info.id} className={styles.card}>
                  {info.motif && <div className={styles.infoRow}><span className={styles.infoLabel}>Motif</span><span>{info.motif}</span></div>}
                  {info.sport && <div className={styles.infoRow}><span className={styles.infoLabel}>Sport / activité</span><span>{info.sport}</span></div>}
                  {info.bodyZone && <div className={styles.infoRow}><span className={styles.infoLabel}>Zone corporelle</span><span>{info.bodyZone}</span></div>}
                  {info.injuryNote && <div className={styles.infoRow}><span className={styles.infoLabel}>Note blessure</span><span>{info.injuryNote}</span></div>}
                  {info.antecedents?.length > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Antécédents</span><span>{info.antecedents.join(", ")}</span></div>}
                </div>
              ))}
            </div>
          )}

          {!data.kinePlans?.length && !data.sessions?.length && !data.logs?.length && !data.athleteInfo?.length && (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div className={styles.emptyTitle}>Aucune donnée partagée</div>
              <p className={styles.emptyText}>Ce professionnel n&apos;a pas encore créé de contenu pour ce patient, ou les permissions de partage n&apos;ont pas encore été activées.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
