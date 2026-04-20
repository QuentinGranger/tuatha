import { Resend } from "resend";
import { secrets } from "@/lib/vault";
import { incident } from "@/lib/incidentResponse";

const resend = new Resend(secrets.resendApiKey());

const REPLY_TO = "support@tuatha-app.com";

/** Throws if Resend integration is killed. */
function checkResendKillSwitch(): void {
  if (incident.isIntegrationKilled("resend")) {
    throw new Error(`[Mailer] Integration Resend désactivée : ${incident.getKillReason("resend")}`);
  }
}

/** Common email headers for deliverability */
function emailHeaders(): Record<string, string> {
  return {
    "X-Entity-Ref-ID": `tuatha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
  };
}

/** Strip HTML to generate plain-text fallback */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>[^<]*<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ConfirmationEmailData {
  to: string;
  prenom: string;
  nom: string;
  specialite: string;
}

const specialiteConfig: Record<string, { label: string; dashboardPath: string; description: string; features: string[] }> = {
  medecin: {
    label: "Medecin",
    dashboardPath: "/dashboard/medecin",
    description: "Accedez a vos consultations, prescriptions et dossiers medicaux depuis votre espace dedie.",
    features: ["Dossiers medicaux", "Consultations", "Prescriptions", "Suivi des patients"],
  },
  kine: {
    label: "Kinesitherapeute",
    dashboardPath: "/dashboard/kine",
    description: "Gerez vos patients, vos seances de reeducation et votre planning depuis votre espace dedie.",
    features: ["Gestion des dossiers patients", "Planning de seances", "Suivi de reeducation", "Facturation"],
  },
  dieteticien: {
    label: "Dieteticien",
    dashboardPath: "/dashboard/nutri",
    description: "Elaborez des plans alimentaires, suivez vos patients et gerez vos consultations.",
    features: ["Plans alimentaires", "Suivi dietetique", "Bilans dietetiques", "Consultations"],
  },
  autre: {
    label: "Professionnel",
    dashboardPath: "/dashboard/coach",
    description: "Creez des programmes, suivez la performance de vos clients et gerez votre activite.",
    features: ["Programmes d'entrainement", "Indicateurs de performance", "Suivi des clients", "Messagerie"],
  },
  // Legacy values
  nutri: {
    label: "Dieteticien",
    dashboardPath: "/dashboard/nutri",
    description: "Elaborez des plans alimentaires, suivez vos patients et gerez vos consultations.",
    features: ["Plans alimentaires", "Suivi dietetique", "Bilans dietetiques", "Consultations"],
  },
  coach: {
    label: "Professionnel",
    dashboardPath: "/dashboard/coach",
    description: "Creez des programmes, suivez la performance de vos clients et gerez votre activite.",
    features: ["Programmes d'entrainement", "Indicateurs de performance", "Suivi des clients", "Messagerie"],
  },
};

export async function sendConfirmationEmail({ to, prenom, nom, specialite }: ConfirmationEmailData) {
  checkResendKillSwitch();
  const config = specialiteConfig[specialite] || {
    label: specialite,
    dashboardPath: "/dashboard",
    description: "Gerez votre activite professionnelle depuis votre espace dedie.",
    features: ["Gestion des patients", "Planning", "Messagerie", "Facturation"],
  };

  const appUrl = secrets.appUrl();
  const dashboardUrl = `${appUrl}${config.dashboardPath}`;

  const featuresHtml = config.features
    .map(
      (f) =>
        `<tr><td style="padding:4px 0; color:rgba(255,255,255,0.6); font-size:13px;">&#10003; ${f}</td></tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Bienvenue sur Tuatha Pro</title>
    </head>
    <body style="margin:0; padding:0; background:#0f0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e; border-radius:16px; overflow:hidden;">
              
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg, #e8772e, #d4621a); padding:32px 40px; text-align:center;">
                  <h1 style="margin:0; color:#fff; font-size:28px; font-weight:700;">Tuatha Pro</h1>
                  <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">Plateforme pour professionnels de sante et du sport</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="margin:0 0 8px; color:#fff; font-size:22px;">Bienvenue ${prenom} !</h2>
                  <p style="color:rgba(255,255,255,0.6); font-size:15px; line-height:1.6; margin:0 0 24px;">
                    Votre inscription en tant que <strong style="color:#e8772e;">${config.label}</strong> a ete confirmee avec succes. ${config.description}
                  </p>

                  <!-- Recapitulatif -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
                    <tr>
                      <td style="padding:20px;">
                        <p style="margin:0 0 12px; color:rgba(255,255,255,0.4); font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Recapitulatif</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:6px 0; color:rgba(255,255,255,0.5); font-size:14px;">Nom</td>
                            <td style="padding:6px 0; color:#fff; font-size:14px; text-align:right;">${prenom} ${nom}</td>
                          </tr>
                          <tr>
                            <td style="padding:6px 0; color:rgba(255,255,255,0.5); font-size:14px;">Specialite</td>
                            <td style="padding:6px 0; color:#e8772e; font-size:14px; text-align:right;">${config.label}</td>
                          </tr>
                          <tr>
                            <td style="padding:6px 0; color:rgba(255,255,255,0.5); font-size:14px;">Email</td>
                            <td style="padding:6px 0; color:#fff; font-size:14px; text-align:right;">${to}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Fonctionnalites -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; margin-bottom:24px;">
                    <tr>
                      <td style="padding:20px;">
                        <p style="margin:0 0 12px; color:rgba(255,255,255,0.4); font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Votre espace ${config.label}</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${featuresHtml}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${dashboardUrl}" 
                           style="display:inline-block; background:#e8772e; color:#fff; text-decoration:none; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:600;">
                          Acceder a mon espace ${config.label}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
                  <p style="margin:0 0 8px; color:rgba(255,255,255,0.3); font-size:12px;">
                    Tuatha Pro - Cet email a ete envoye suite a votre inscription.
                  </p>
                  <p style="margin:0; color:rgba(255,255,255,0.15); font-size:10px;">
                    Tuatha SAS - France<br/>
                    Si vous n'etes pas concerne par cet email, vous pouvez l'ignorer en toute securite.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const subject = `Bienvenue sur Tuatha Pro, ${prenom} !`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: secrets.resendFromEmail(),
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Mailer] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Mailer] Confirmation email sent, id:", data?.id);
  return data;
}

// ─── Connection Request Email (Athlete → Pro) ───

interface ConnectionRequestEmailData {
  to: string;
  proPrenom: string;
  athletePrenom: string;
  athleteNom: string;
  athleteSport: string | null;
  requestId: string;
}

export async function sendConnectionRequestEmail({
  to,
  proPrenom,
  athletePrenom,
  athleteNom,
  athleteSport,
  requestId,
}: ConnectionRequestEmailData) {
  checkResendKillSwitch();
  const appUrl = secrets.appUrl();
  const sportLine = athleteSport ? `<p style="color:rgba(255,255,255,0.5); font-size:13px; margin:4px 0 0;">Sport : <strong style="color:#e8772e;">${athleteSport}</strong></p>` : "";

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Nouvelle demande de connexion</title>
    </head>
    <body style="margin:0; padding:0; background:#0f0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e; border-radius:16px; overflow:hidden;">
              
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg, #e8772e, #d4621a); padding:24px 40px; text-align:center;">
                  <h1 style="margin:0; color:#fff; font-size:24px; font-weight:700;">Tuatha Pro</h1>
                  <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px;">Nouvelle demande de connexion</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="margin:0 0 8px; color:#fff; font-size:20px;">Bonjour ${proPrenom},</h2>
                  <p style="color:rgba(255,255,255,0.6); font-size:15px; line-height:1.6; margin:0 0 24px;">
                    L'athlete <strong style="color:#fff;">${athletePrenom} ${athleteNom}</strong> souhaite se connecter avec vous sur Tuatha Pro.
                  </p>

                  <!-- Athlete info -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:24px;">
                    <tr>
                      <td style="padding:20px;">
                        <p style="margin:0; color:#fff; font-size:16px; font-weight:600;">${athletePrenom} ${athleteNom}</p>
                        ${sportLine}
                      </td>
                    </tr>
                  </table>

                  <p style="color:rgba(255,255,255,0.5); font-size:14px; line-height:1.6; margin:0 0 24px;">
                    En acceptant cette demande, vous pourrez suivre cet athlete, echanger des messages et partager des documents.
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:0 0 12px;">
                        <a href="${appUrl}/dashboard" 
                           style="display:inline-block; background:#e8772e; color:#fff; text-decoration:none; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:600;">
                          Voir la demande
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
                  <p style="margin:0 0 8px; color:rgba(255,255,255,0.3); font-size:12px;">
                    Tuatha Pro - Cet email a ete envoye suite a une demande de connexion.
                  </p>
                  <p style="margin:0; color:rgba(255,255,255,0.15); font-size:10px;">
                    Tuatha SAS - France
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const subject = `${athletePrenom} ${athleteNom} souhaite se connecter avec vous`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: secrets.resendFromEmail(),
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Mailer] Connection request email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Mailer] Connection request email sent, id:", data?.id);
  return data;
}

// ─── Payment Receipt Email ───

interface ReceiptEmailData {
  to: string;
  athletePrenom: string;
  proNom: string;
  proPrenom: string;
  receiptNumber: string;
  receiptHtml: string;
}

export async function sendReceiptEmail({
  to,
  athletePrenom,
  proNom,
  proPrenom,
  receiptNumber,
  receiptHtml,
}: ReceiptEmailData) {
  checkResendKillSwitch();
  const subject = `Votre recu de paiement — ${proPrenom} ${proNom} (${receiptNumber})`;
  const text = htmlToText(receiptHtml);

  const { data, error } = await resend.emails.send({
    from: secrets.resendFromEmail(),
    to,
    replyTo: REPLY_TO,
    subject,
    html: receiptHtml,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Mailer] Receipt email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi reçu: ${error.message}`);
  }

  console.log(`[Mailer] Receipt email sent to ${to}, id: ${data?.id}, receipt: ${receiptNumber}`);
  return data;
}
