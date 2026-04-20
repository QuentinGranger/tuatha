"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface InviteData {
  id: string;
  email: string;
  role: string;
  message: string | null;
  status: string;
  senderName: string;
  senderSpecialite: string | null;
  athleteName: string;
  createdAt: string;
  expiresAt: string;
}

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = params.id as string;
  const token = searchParams.get("token") || "";

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    fetch(`/api/invitation/${inviteId}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 410) { setExpired(true); throw new Error(d.error); }
        if (!r.ok) throw new Error(d.error || "Invitation introuvable");
        return d;
      })
      .then((d) => setInvite(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [inviteId, token]);

  const respond = async (accept: boolean) => {
    setResponding(true);
    try {
      const res = await fetch(`/api/invitation/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, token }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        throw new Error(data.error || "Erreur");
      }
      setDone(accept ? "accepted" : "declined");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      setError(msg);
    } finally {
      setResponding(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: 20,
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{
            display: "inline-block", background: "linear-gradient(135deg, #f47b20, #ff9a44)",
            color: "#fff", fontWeight: 800, fontSize: 22, padding: "12px 32px", borderRadius: 14,
          }}>Tuatha</span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            Chargement de l&apos;invitation...
          </div>
        )}

        {/* Expired */}
        {expired && (
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 48, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9200;</div>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invitation expirée</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
              Cette invitation a expiré. Demandez à l&apos;expéditeur de vous en envoyer une nouvelle.
            </p>
            <a href="/inscription/professionnel" style={{
              display: "inline-block", background: "linear-gradient(135deg, #f47b20, #ff9a44)", color: "#fff",
              fontWeight: 700, fontSize: 14, padding: "12px 32px", borderRadius: 12, textDecoration: "none",
            }}>Créer un compte Tuatha</a>
          </div>
        )}

        {/* Error */}
        {error && !invite && !expired && (
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 48, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invitation introuvable</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
              Cette invitation n&apos;existe pas ou le lien est invalide.
            </p>
            <a href="/inscription/professionnel" style={{
              display: "inline-block", background: "linear-gradient(135deg, #f47b20, #ff9a44)", color: "#fff",
              fontWeight: 700, fontSize: 14, padding: "12px 32px", borderRadius: 12, textDecoration: "none",
            }}>Créer un compte Tuatha</a>
          </div>
        )}

        {/* Already responded */}
        {invite && invite.status !== "envoyee" && !done && (
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 48, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invitation déjà traitée</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
              Cette invitation a déjà été {invite.status === "acceptee" ? "acceptée" : invite.status === "refusee" ? "refusée" : "annulée"}.
            </p>
            <a href="/" style={{
              display: "inline-block", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
              fontWeight: 600, fontSize: 14, padding: "12px 32px", borderRadius: 12, textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>Accéder au dashboard</a>
          </div>
        )}

        {/* Done */}
        {done && (
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 48, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{done === "accepted" ? "🎉" : "👋"}</div>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {done === "accepted" ? "Invitation acceptée !" : "Invitation déclinée"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
              {done === "accepted"
                ? "Vous faites maintenant partie du réseau de soins. Connectez-vous pour collaborer."
                : "Vous avez décliné cette invitation. Vous pouvez fermer cette page."}
            </p>
            {done === "accepted" && (
              <a href="/" style={{
                display: "inline-block", background: "linear-gradient(135deg, #f47b20, #ff9a44)", color: "#fff",
                fontWeight: 700, fontSize: 15, padding: "14px 40px", borderRadius: 12, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(244,123,32,0.3)",
              }}>Accéder au dashboard</a>
            )}
          </div>
        )}

        {/* Pending invite */}
        {invite && invite.status === "envoyee" && !done && (
          <div style={{
            background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden",
          }}>
            {/* Banner */}
            <div style={{ background: "linear-gradient(135deg, #f47b20, #ff9a44)", padding: "28px 36px" }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#fff" }}>Invitation à collaborer</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                {invite.senderName} vous invite à rejoindre un réseau de soins
              </p>
            </div>

            <div style={{ padding: 36 }}>
              {/* Sender */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", background: "rgba(244,123,32,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#f47b20", fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>
                  {invite.senderName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ marginLeft: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{invite.senderName}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{invite.senderSpecialite || "Professionnel"}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: 16, marginBottom: 8,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Patient</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{invite.athleteName}</div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: 16, marginBottom: 8,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Rôle proposé</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f47b20" }}>{invite.role}</div>
                </div>
                {invite.message && (
                  <div style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12, padding: 16,
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Message</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.6 }}>&ldquo;{invite.message}&rdquo;</div>
                  </div>
                )}
              </div>

              {/* Expiry + date info */}
              <div style={{
                background: "rgba(244,123,32,0.08)", border: "1px solid rgba(244,123,32,0.15)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 24, textAlign: "center",
              }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                  &#9200; Expire le <strong style={{ color: "#f47b20" }}>
                    {new Date(invite.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </strong> &middot; Lien à usage unique
                </span>
              </div>

              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                Invitation reçue le {new Date(invite.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => respond(true)}
                  disabled={responding}
                  style={{
                    flex: 1, background: "linear-gradient(135deg, #f47b20, #ff9a44)", color: "#fff",
                    fontWeight: 700, fontSize: 15, padding: "14px 20px", borderRadius: 12, border: "none",
                    cursor: responding ? "not-allowed" : "pointer", opacity: responding ? 0.5 : 1,
                    boxShadow: "0 4px 20px rgba(244,123,32,0.3)",
                  }}>
                  {responding ? "..." : "Accepter"}
                </button>
                <button
                  onClick={() => respond(false)}
                  disabled={responding}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    fontWeight: 600, fontSize: 15, padding: "14px 20px", borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)", cursor: responding ? "not-allowed" : "pointer",
                    opacity: responding ? 0.5 : 1,
                  }}>
                  {responding ? "..." : "Décliner"}
                </button>
              </div>

              {error && (
                <div style={{ marginTop: 14, color: "#ef5350", fontSize: 13, textAlign: "center" }}>{error}</div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, margin: 0 }}>
            Tuatha · Plateforme de suivi interprofessionnel
          </p>
        </div>
      </div>
    </div>
  );
}
