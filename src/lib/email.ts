import { Resend } from "resend";
import { secrets } from "@/lib/vault";
import { incident } from "@/lib/incidentResponse";

const resend = new Resend(secrets.resendApiKey());

const FROM_EMAIL = secrets.resendFromEmail();
const REPLY_TO = "support@tuatha-app.com";

/** Throws if Resend integration is killed. Call at the top of every send function. */
function checkResendKillSwitch(): void {
  if (incident.isIntegrationKilled("resend")) {
    throw new Error(`[Email] Integration Resend désactivée : ${incident.getKillReason("resend")}`);
  }
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
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&apos;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&#10003;/g, "✓")
    .replace(/&#9200;/g, "")
    .replace(/©/g, "(c)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Shared footer HTML with physical address for CAN-SPAM compliance */
const FOOTER_HTML = `
    <div style="text-align:center;margin-top:32px;padding:0 20px;">
      <p style="color:rgba(255,255,255,0.2);font-size:11px;line-height:1.6;margin:0 0 8px;">
        Cet email a été envoyé par <strong style="color:rgba(255,255,255,0.3);">Tuatha</strong> — Plateforme de suivi interprofessionnel
      </p>
      <p style="color:rgba(255,255,255,0.15);font-size:10px;margin:0;">
        Tuatha SAS — France<br/>
        Si vous n'êtes pas concerné par cet email, vous pouvez l'ignorer en toute sécurité.
      </p>
    </div>
`;

/** Common email headers for deliverability */
function emailHeaders(): Record<string, string> {
  return {
    "X-Entity-Ref-ID": `tuatha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
  };
}

interface InviteEmailParams {
  to: string;
  inviteId: string;
  inviteToken: string;
  senderName: string;
  senderSpecialite: string | null;
  athleteName: string;
  role: string;
  message: string | null;
  expiresAt: Date;
}

export async function sendInviteEmail({ to, inviteId, inviteToken, senderName, senderSpecialite, athleteName, role, message, expiresAt }: InviteEmailParams) {
  checkResendKillSwitch();
  const baseUrl = secrets.appUrl();
  const inviteUrl = `${baseUrl}/invitation/${inviteId}?token=${inviteToken}`;
  const expiresLabel = new Date(expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invitation Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>

    <!-- Main card -->
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

      <!-- Orange banner -->
      <div style="background:linear-gradient(135deg,#f47b20,#ff9a44);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Invitation a collaborer</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Rejoignez le reseau de soins d'un patient</p>
      </div>

      <!-- Content -->
      <div style="padding:36px;">

        <!-- Sender info -->
        <div style="display:flex;align-items:center;margin-bottom:28px;">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(244,123,32,0.15);display:flex;align-items:center;justify-content:center;color:#f47b20;font-weight:700;font-size:18px;flex-shrink:0;">${senderName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
          <div style="margin-left:14px;">
            <div style="font-size:16px;font-weight:700;color:#fff;">${senderName}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.45);">${senderSpecialite || "Professionnel de santé"}</div>
          </div>
        </div>

        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          vous invite à rejoindre le réseau interprofessionnel d'un patient sur <strong style="color:#fff;">Tuatha</strong>, la plateforme de coordination des soins.
        </p>

        <!-- Info cards -->
        <div style="margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Patient concerné</div>
            <div style="font-size:16px;font-weight:700;color:#fff;">${athleteName}</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Rôle proposé</div>
            <div style="font-size:16px;font-weight:700;color:#f47b20;">${role}</div>
          </div>
          ${message ? `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Message personnel</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.7);font-style:italic;line-height:1.6;">&ldquo;${message}&rdquo;</div>
          </div>
          ` : ""}
        </div>

        <!-- What you get -->
        <div style="margin-bottom:32px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;font-weight:600;">Ce que vous pourrez faire</div>
          <div style="margin-bottom:8px;display:flex;align-items:flex-start;">
            <span style="color:#f47b20;font-size:16px;margin-right:10px;line-height:1;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;">Consulter le programme et les indicateurs du patient</span>
          </div>
          <div style="margin-bottom:8px;display:flex;align-items:flex-start;">
            <span style="color:#f47b20;font-size:16px;margin-right:10px;line-height:1;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;">Partager des notes de coordination interprofessionnelles</span>
          </div>
          <div style="display:flex;align-items:flex-start;">
            <span style="color:#f47b20;font-size:16px;margin-right:10px;line-height:1;">&#10003;</span>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;">Collaborer en temps réel avec l'équipe soignante</span>
          </div>
        </div>

        <!-- Expiry notice -->
        <div style="background:rgba(244,123,32,0.08);border:1px solid rgba(244,123,32,0.15);border-radius:10px;padding:14px 18px;margin-bottom:24px;text-align:center;">
          <span style="color:rgba(255,255,255,0.5);font-size:12px;">&#9200; Cette invitation expire le <strong style="color:#f47b20;">${expiresLabel}</strong> · Lien à usage unique</span>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(244,123,32,0.3);">
            Répondre à l'invitation
          </a>
        </div>
        <p style="text-align:center;color:rgba(255,255,255,0.25);font-size:12px;margin:0;">
          Si vous n'avez pas encore de compte, vous serez guidé pour en créer un.
        </p>

      </div>
    </div>

    <!-- Footer -->
    ${FOOTER_HTML}

  </div>
</body>
</html>
  `;

  const subject = `${senderName} vous invite a collaborer sur Tuatha`;
  const text = htmlToText(html);

  console.log("[Email] Sending invite to:", to, "from:", FROM_EMAIL);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Sent successfully, id:", data?.id);
  return data;
}

// ─── Email verification ───

interface VerifyEmailParams {
  to: string;
  prenom: string;
  code: string;
}

export async function sendVerificationEmail({ to, prenom, code }: VerifyEmailParams) {
  checkResendKillSwitch();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verification Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f47b20,#ff9a44);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Verifiez votre email</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Confirmez votre adresse pour activer votre compte</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${prenom}</strong>, bienvenue sur Tuatha ! Entrez le code ci-dessous pour verifier votre adresse email.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:rgba(244,123,32,0.08);border:2px solid rgba(244,123,32,0.3);border-radius:16px;padding:20px 48px;">
            <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:600;">Votre code de verification</div>
            <div style="font-size:36px;font-weight:800;color:#f47b20;letter-spacing:8px;font-family:monospace;">${code}</div>
          </div>
        </div>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;text-align:center;margin:0;">
          Ce code expire dans <strong style="color:rgba(255,255,255,0.5);">15 minutes</strong>. Si vous n'avez pas demande ce code, ignorez cet email.
        </p>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Votre code de verification Tuatha : ${code}`;
  const text = htmlToText(html);

  console.log("[Email] Sending verification code to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Verification email sent, id:", data?.id);
  return data;
}

// ─── New device login alert email ───

interface NewDeviceAlertParams {
  to: string;
  prenom: string;
  deviceName: string;
  ip: string | null;
  date: string;
}

export async function sendNewDeviceAlert({ to, prenom, deviceName, ip, date }: NewDeviceAlertParams) {
  checkResendKillSwitch();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Alerte securite Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Nouvel appareil detecte</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Connexion depuis un appareil inconnu</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 24px;">
          Bonjour <strong style="color:#fff;">${prenom}</strong>, une connexion a votre compte a ete effectuee depuis un nouvel appareil.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:24px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600;">Details de la connexion</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.8;">
            <div>Appareil : <strong style="color:#fff;">${deviceName}</strong></div>
            <div>Date : <strong style="color:#fff;">${date}</strong></div>
            ${ip ? `<div>Adresse IP : <strong style="color:#fff;">${ip}</strong></div>` : ""}
          </div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:16px;">
          <div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Ce n'est pas vous ?</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Changez immediatement votre mot de passe et contactez notre support a <a href="mailto:support@tuatha-app.com" style="color:#f47b20;">support@tuatha-app.com</a></div>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = "Connexion depuis un nouvel appareil - Tuatha";
  const text = htmlToText(html);

  console.log("[Email] Sending new device alert to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] New device alert sent, id:", data?.id);
  return data;
}

// ─── Password reset email ───

interface ResetEmailParams {
  to: string;
  prenom: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export async function sendPasswordResetEmail({ to, prenom, resetUrl, expiresInMinutes }: ResetEmailParams) {
  checkResendKillSwitch();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reinitialisation mot de passe Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f47b20,#ff9a44);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Reinitialisation du mot de passe</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Vous avez demande a changer votre mot de passe</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${prenom}</strong>, cliquez sur le bouton ci-dessous pour reinitialiser votre mot de passe. Ce lien est valable <strong style="color:#fff;">${expiresInMinutes} minutes</strong>.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(244,123,32,0.3);">
            Reinitialiser mon mot de passe
          </a>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:16px;margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Securite</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifie. Si vous recevez plusieurs emails de ce type, contactez notre support.</div>
        </div>
        <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:0;word-break:break-all;">
          ${resetUrl}
        </p>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = "Reinitialisation de votre mot de passe - Tuatha";
  const text = htmlToText(html);

  console.log("[Email] Sending password reset to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Password reset email sent, id:", data?.id);
  return data;
}

// ─── Password changed alert email ───

interface PasswordChangedAlertParams {
  to: string;
  prenom: string;
  ip: string | null;
  date: string;
}

export async function sendPasswordChangedAlert({ to, prenom, ip, date }: PasswordChangedAlertParams) {
  checkResendKillSwitch();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mot de passe modifie - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#ef4444,#f97316);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Mot de passe modifie</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Alerte de securite pour votre compte</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 24px;">
          Bonjour <strong style="color:#fff;">${prenom}</strong>, votre mot de passe Tuatha a ete modifie avec succes.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:24px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600;">Details</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.8;">
            <div>Date : <strong style="color:#fff;">${date}</strong></div>
            ${ip ? `<div>Adresse IP : <strong style="color:#fff;">${ip}</strong></div>` : ""}
          </div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:16px;">
          <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Si vous n'etes pas a l'origine de cette modification, contactez immediatement notre support a <a href="mailto:support@tuatha-app.com" style="color:#f47b20;">support@tuatha-app.com</a></div>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = "Votre mot de passe Tuatha a ete modifie";
  const text = htmlToText(html);

  console.log("[Email] Sending password changed alert to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Password changed alert sent, id:", data?.id);
  return data;
}

// ─── Document sharing email ───

interface DocEmailParams {
  to: string;
  senderName: string;
  senderSpecialite: string | null;
  athleteName: string;
  documentName: string;
  category: string;
  note: string | null;
  downloadUrl: string;
}

export async function sendDocumentEmail({ to, senderName, senderSpecialite, athleteName, documentName, category, note, downloadUrl }: DocEmailParams) {
  checkResendKillSwitch();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nouveau document - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f47b20,#ff9a44);padding:32px 36px;">
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Nouveau document partage</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Un professionnel vous a envoye un document</p>
      </div>
      <div style="padding:36px;">
        <div style="display:flex;align-items:center;margin-bottom:28px;">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(244,123,32,0.15);display:flex;align-items:center;justify-content:center;color:#f47b20;font-weight:700;font-size:18px;flex-shrink:0;">${senderName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
          <div style="margin-left:14px;">
            <div style="font-size:16px;font-weight:700;color:#fff;">${senderName}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.45);">${senderSpecialite || "Professionnel de sante"}</div>
          </div>
        </div>
        <div style="margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Document</div>
            <div style="font-size:16px;font-weight:700;color:#fff;">${documentName}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;">Categorie : ${category}</div>
          </div>
          ${note ? `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Note</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.7);font-style:italic;line-height:1.6;">&ldquo;${note}&rdquo;</div>
          </div>
          ` : ""}
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(244,123,32,0.3);">
            Telecharger le document
          </a>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `${senderName} vous a envoye un document - ${documentName}`;
  const text = htmlToText(html);

  console.log("[Email] Sending document notification to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Document email sent, id:", data?.id);
  return data;
}

// ─── Booking confirmation email ───

interface BookingConfirmEmailParams {
  to: string;
  prenom: string;
  proName: string;
  proSpecialite: string;
  date: string;
  heure: string;
  duree: string;
  motif: string;
  format: "presentiel" | "teleconsultation";
  lieu: string | null;
}

export async function sendBookingConfirmationEmail(params: BookingConfirmEmailParams) {
  checkResendKillSwitch();
  const { to, prenom, proName, proSpecialite, date, heure, duree, motif, format, lieu } = params;

  const formatLabel = format === "presentiel" ? "En cabinet" : "Téléconsultation";
  const lieuHtml = format === "presentiel" && lieu
    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Lieu</div>
        <div style="font-size:14px;color:#fff;">${lieu}</div>
      </div>`
    : format === "teleconsultation"
    ? `<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:12px;color:#10b981;font-weight:600;">Le lien de teleconsultation vous sera envoye avant le rendez-vous</div>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RDV confirme - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#10b981,#34d399);padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#10003;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Rendez-vous confirme</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Votre rendez-vous a ete reserve avec succes</p>
      </div>
      <div style="padding:36px;">
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Professionnel</div>
          <div style="font-size:16px;font-weight:700;color:#fff;">${proName}</div>
          <div style="font-size:12px;color:#f47b20;margin-top:2px;">${proSpecialite}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Date</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${date}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Heure</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${heure}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Duree</div>
            <div style="font-size:14px;color:#fff;">${duree}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Format</div>
            <div style="font-size:14px;color:#fff;">${formatLabel}</div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Motif</div>
          <div style="font-size:14px;color:#fff;">${motif}</div>
        </div>
        ${lieuHtml}
        <div style="text-align:center;margin-top:28px;">
          <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0 0 8px;">Annulation gratuite jusqu'a 24h avant le rendez-vous</p>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Rendez-vous confirme le ${date} a ${heure} avec ${proName}`;
  const text = htmlToText(html);

  console.log("[Email] Sending booking confirmation to:", to);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Booking confirmation sent, id:", data?.id);
  return data;
}

// ─── Booking reminder email ───

interface BookingReminderEmailParams {
  to: string;
  prenom: string;
  type: "j2" | "j1" | "h2" | "h1_visio" | "now_visio";
  proName: string;
  proSpecialite: string;
  proTelephone: string | null;
  proEmail: string | null;
  date: string;
  heure: string;
  duree: string;
  motif: string;
  format: "presentiel" | "teleconsultation";
  lieu: string | null;
  documents: string | null;
  visioRoomId?: string | null;
}

const REMINDER_CONFIG: Record<string, { emoji: string; title: string; subtitle: string; color: string }> = {
  j2: { emoji: "&#128197;", title: "Rendez-vous dans 2 jours", subtitle: "Pensez a preparer vos documents", color: "#3b82f6" },
  j1: { emoji: "&#9200;", title: "Rendez-vous demain", subtitle: "Tout est pret pour demain ?", color: "#f59e0b" },
  h2: { emoji: "&#128276;", title: "Rendez-vous dans 2 heures", subtitle: "Il est bientot l'heure !", color: "#f47b20" },
  h1_visio: { emoji: "&#128187;", title: "Teleconsultation dans 1 heure", subtitle: "Verifiez votre connexion et votre micro/camera", color: "#10b981" },
  now_visio: { emoji: "&#127909;", title: "Votre teleconsultation commence", subtitle: "Rejoignez votre rendez-vous maintenant", color: "#10b981" },
};

export async function sendBookingReminderEmail(params: BookingReminderEmailParams) {
  checkResendKillSwitch();
  const { to, prenom, type, proName, proSpecialite, proTelephone, proEmail, date, heure, duree, motif, format, lieu, documents, visioRoomId } = params;

  const cfg = REMINDER_CONFIG[type] || REMINDER_CONFIG.j1;
  const formatLabel = format === "presentiel" ? "En cabinet" : "Teleconsultation";

  // Documents block
  const docsHtml = documents
    ? `<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600;">Documents a apporter</div>
        ${documents.split(",").map((d: string) => `<div style="font-size:13px;color:#fff;padding:3px 0;">• ${d.trim()}</div>`).join("")}
      </div>`
    : "";

  // Location block
  const lieuHtml = format === "presentiel" && lieu
    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Adresse</div>
        <div style="font-size:14px;color:#fff;">${lieu}</div>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lieu)}" style="display:inline-block;margin-top:8px;font-size:12px;color:#3b82f6;text-decoration:none;font-weight:600;">Voir l'itineraire &rarr;</a>
      </div>`
    : "";

  // Contact pro block
  const contactParts: string[] = [];
  if (proTelephone) contactParts.push(`<a href="tel:${proTelephone}" style="color:#f47b20;text-decoration:none;font-weight:600;">${proTelephone}</a>`);
  if (proEmail) contactParts.push(`<a href="mailto:${proEmail}" style="color:#f47b20;text-decoration:none;font-weight:600;">${proEmail}</a>`);
  const contactHtml = contactParts.length > 0
    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Contacter le professionnel</div>
        <div style="font-size:13px;color:#fff;">${contactParts.join(" &nbsp;|&nbsp; ")}</div>
      </div>`
    : "";

  // Now visio CTA
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tuatha.pro";
  const visioUrl = visioRoomId ? `${appUrl}/visio?room=${encodeURIComponent(visioRoomId)}` : null;
  const visioCta = (type === "now_visio" || type === "h1_visio") && visioUrl
    ? `<div style="text-align:center;margin:20px 0 10px;">
        <a href="${visioUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#34d399);color:#fff;font-size:15px;font-weight:700;padding:14px 40px;border-radius:14px;text-decoration:none;">Rejoindre la teleconsultation</a>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Rappel RDV - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:${cfg.color};padding:28px 36px;text-align:center;">
        <div style="font-size:40px;margin-bottom:6px;">${cfg.emoji}</div>
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#fff;">${cfg.title}</h1>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);">${cfg.subtitle}</p>
      </div>
      <div style="padding:32px;">
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Professionnel</div>
          <div style="font-size:16px;font-weight:700;color:#fff;">${proName}</div>
          <div style="font-size:12px;color:#f47b20;margin-top:2px;">${proSpecialite}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Date</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${date}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Heure</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${heure}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Duree</div>
            <div style="font-size:14px;color:#fff;">${duree}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Motif</div>
            <div style="font-size:14px;color:#fff;">${motif}</div>
          </div>
        </div>
        ${lieuHtml}
        ${docsHtml}
        ${contactHtml}
        ${visioCta}
        <div style="text-align:center;margin-top:20px;">
          <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">Annulation gratuite jusqu'a 24h avant le rendez-vous</p>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subjectMap: Record<string, string> = {
    j2: `Rappel : RDV dans 2 jours avec ${proName}`,
    j1: `Rappel : RDV demain avec ${proName} a ${heure}`,
    h2: `Rappel : RDV dans 2h avec ${proName}`,
    h1_visio: `Dans 1h : teleconsultation avec ${proName}`,
    now_visio: `Maintenant : teleconsultation avec ${proName}`,
  };

  const subject = subjectMap[type] || `Rappel RDV — ${proName}`;
  const text = htmlToText(html);

  console.log(`[Email] Sending ${type} reminder to: ${to}`);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Resend error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log(`[Email] Reminder ${type} sent, id:`, data?.id);
  return data;
}

// ─── Slot Alert Email ───

export async function sendSlotAlertEmail({
  to,
  athleteName,
  proName,
  slotDate,
  alertId,
}: {
  to: string;
  athleteName: string;
  proName: string;
  slotDate: Date;
  alertId: string;
}) {
  checkResendKillSwitch();

  const dateStr = slotDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = slotDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const bookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://tuatha.pro"}/dashboard/athlete/mes-rdv?action=book&slotAlert=${alertId}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0d1117; color: #e6edf3; padding: 32px 24px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">🔔</div>
      </div>
      <h2 style="text-align: center; font-size: 20px; font-weight: 700; margin: 0 0 8px; color: #fff;">Un créneau s'est libéré !</h2>
      <p style="text-align: center; color: rgba(255,255,255,0.5); font-size: 14px; margin: 0 0 24px;">
        Bonjour ${athleteName}, un créneau correspondant à vos préférences est disponible.
      </p>
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <div style="font-weight: 700; color: #fff; font-size: 15px; margin-bottom: 4px;">📅 ${dateStr}</div>
        <div style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 4px;">🕐 ${timeStr}</div>
        <div style="color: rgba(255,255,255,0.6); font-size: 14px;">👨‍⚕️ ${proName}</div>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${bookUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f47b20, #ff9a44); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
          Réserver maintenant
        </a>
      </div>
      <p style="text-align: center; color: rgba(255,255,255,0.25); font-size: 12px; margin: 0;">
        Ce créneau est disponible sous réserve. Réservez-le rapidement avant qu'il ne soit pris.
      </p>
      ${FOOTER_HTML}
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject: `Un creneau s'est libere avec ${proName} — ${dateStr}`,
    html,
    text: htmlToText(html),
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Slot alert error:", error);
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log(`[Email] Slot alert sent to ${to}, id:`, data?.id);
  return data;
}

// ─── Payment confirmation email (to athlete) ───

interface PaymentConfirmEmailParams {
  to: string;
  athletePrenom: string;
  proName: string;
  proSpecialite: string;
  amount: string;       // formatted, e.g. "45,00 €"
  date: string;         // event date formatted
  heure: string;
  description: string;
  receiptNumber: string | null;
}

export async function sendPaymentConfirmationEmail(params: PaymentConfirmEmailParams) {
  checkResendKillSwitch();
  const { to, athletePrenom, proName, proSpecialite, amount, date, heure, description, receiptNumber } = params;
  const appUrl = secrets.appUrl();

  const receiptLine = receiptNumber
    ? `<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px;margin-bottom:10px;text-align:center;">
        <div style="font-size:12px;color:#10b981;font-weight:600;">Recu n° ${receiptNumber} disponible dans votre espace</div>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Paiement confirme - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#10b981,#34d399);padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#9989;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Paiement confirme</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Votre paiement a ete traite avec succes</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${athletePrenom}</strong>, votre paiement a bien ete recu.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Professionnel</div>
          <div style="font-size:16px;font-weight:700;color:#fff;">${proName}</div>
          <div style="font-size:12px;color:#f47b20;margin-top:2px;">${proSpecialite}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Date</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${date}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Heure</div>
            <div style="font-size:15px;font-weight:700;color:#fff;">${heure}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Prestation</div>
            <div style="font-size:14px;color:#fff;">${description}</div>
          </div>
          <div style="flex:1;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Montant paye</div>
            <div style="font-size:18px;font-weight:800;color:#10b981;">${amount}</div>
          </div>
        </div>
        ${receiptLine}
        <div style="text-align:center;margin-top:28px;">
          <a href="${appUrl}/dashboard/athlete/mes-rdv" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
            Voir mes rendez-vous
          </a>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Paiement confirme — ${amount} — ${proName}`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Payment confirmation error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Payment confirmation sent, id:", data?.id);
  return data;
}

// ─── Payment failed email (to athlete) ───

interface PaymentFailedEmailParams {
  to: string;
  athletePrenom: string;
  proName: string;
  amount: string;
  description: string;
  retryUrl: string | null;
}

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams) {
  checkResendKillSwitch();
  const { to, athletePrenom, proName, amount, description, retryUrl } = params;

  const ctaHtml = retryUrl
    ? `<div style="text-align:center;margin-top:28px;">
        <a href="${retryUrl}" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
          Reessayer le paiement
        </a>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Echec de paiement - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#ef4444,#f97316);padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#10060;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Echec du paiement</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Votre paiement n'a pas pu etre traite</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${athletePrenom}</strong>, votre paiement de <strong style="color:#ef4444;">${amount}</strong> pour <strong style="color:#fff;">${proName}</strong> a echoue.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Prestation</div>
          <div style="font-size:14px;color:#fff;">${description}</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:16px;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Que faire ?</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.6;">
            Verifiez les informations de votre carte bancaire et reessayez. Si le probleme persiste, contactez votre banque ou notre support a <a href="mailto:support@tuatha-app.com" style="color:#f47b20;">support@tuatha-app.com</a>.
          </div>
        </div>
        ${ctaHtml}
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Echec de paiement — ${proName}`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Payment failed email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Payment failed email sent, id:", data?.id);
  return data;
}

// ─── Cancellation email (to athlete + optionally to pro) ───

interface CancellationEmailParams {
  to: string;
  recipientPrenom: string;
  otherPartyName: string;
  date: string;
  heure: string;
  motif: string | null;
  cancelledBy: "athlete" | "pro";
  refundInfo: string | null;  // e.g. "Remboursement integral" or "Selon politique du professionnel"
}

export async function sendCancellationEmail(params: CancellationEmailParams) {
  checkResendKillSwitch();
  const { to, recipientPrenom, otherPartyName, date, heure, motif, cancelledBy, refundInfo } = params;

  const cancelledByLabel = cancelledBy === "athlete" ? "le patient" : "le professionnel";
  const motifHtml = motif
    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Motif</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.7);font-style:italic;">${motif}</div>
      </div>`
    : "";
  const refundHtml = refundInfo
    ? `<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:16px;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:4px;">Remboursement</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">${refundInfo}</div>
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RDV annule - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#64748b,#94a3b8);padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#128683;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Rendez-vous annule</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Annulation par ${cancelledByLabel}</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${recipientPrenom}</strong>, le rendez-vous avec <strong style="color:#fff;">${otherPartyName}</strong> a ete annule.
        </p>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Date</div>
            <div style="font-size:15px;font-weight:700;color:#fff;text-decoration:line-through;opacity:0.5;">${date}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Heure</div>
            <div style="font-size:15px;font-weight:700;color:#fff;text-decoration:line-through;opacity:0.5;">${heure}</div>
          </div>
        </div>
        ${motifHtml}
        ${refundHtml}
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Rendez-vous annule — ${date} a ${heure} — ${otherPartyName}`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Cancellation email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Cancellation email sent, id:", data?.id);
  return data;
}

// ─── Reschedule email (to athlete when pro changes date) ───

interface RescheduleEmailParams {
  to: string;
  recipientPrenom: string;
  proName: string;
  oldDate: string;
  oldHeure: string;
  newDate: string;
  newHeure: string;
}

export async function sendRescheduleEmail(params: RescheduleEmailParams) {
  checkResendKillSwitch();
  const { to, recipientPrenom, proName, oldDate, oldHeure, newDate, newHeure } = params;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RDV reprogramme - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#3b82f6,#60a5fa);padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#128197;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">Rendez-vous reprogramme</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Votre professionnel a modifie la date</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${recipientPrenom}</strong>, votre rendez-vous avec <strong style="color:#fff;">${proName}</strong> a ete reprogramme.
        </p>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
          <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Ancienne date</div>
            <div style="font-size:15px;font-weight:700;color:#fff;text-decoration:line-through;opacity:0.5;">${oldDate}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.4);text-decoration:line-through;">${oldHeure}</div>
          </div>
          <div style="flex:1;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:18px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Nouvelle date</div>
            <div style="font-size:15px;font-weight:700;color:#3b82f6;">${newDate}</div>
            <div style="font-size:13px;color:rgba(59,130,246,0.7);">${newHeure}</div>
          </div>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `Rendez-vous reprogramme — ${newDate} a ${newHeure} — ${proName}`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Reschedule email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Reschedule email sent, id:", data?.id);
  return data;
}

// ─── Refund email (to athlete) ───

interface RefundEmailParams {
  to: string;
  athletePrenom: string;
  proName: string;
  originalAmount: string;  // formatted
  refundAmount: string;    // formatted
  isPartial: boolean;
  description: string;
}

export async function sendRefundEmail(params: RefundEmailParams) {
  checkResendKillSwitch();
  const { to, athletePrenom, proName, originalAmount, refundAmount, isPartial, description } = params;

  const typeLabel = isPartial ? "Remboursement partiel" : "Remboursement integral";
  const bannerColor = isPartial ? "linear-gradient(135deg,#f59e0b,#fbbf24)" : "linear-gradient(135deg,#a855f7,#c084fc)";
  const amountColor = isPartial ? "#f59e0b" : "#a855f7";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Remboursement - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:${bannerColor};padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">&#128184;</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">${typeLabel}</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Un remboursement a ete effectue sur votre compte</p>
      </div>
      <div style="padding:36px;">
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
          Bonjour <strong style="color:#fff;">${athletePrenom}</strong>, un remboursement a ete initie suite a votre consultation avec <strong style="color:#fff;">${proName}</strong>.
        </p>
        <div style="margin-bottom:10px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:10px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Prestation</div>
            <div style="font-size:14px;color:#fff;">${description}</div>
          </div>
          <div style="display:flex;gap:10px;">
            <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;">
              <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Montant initial</div>
              <div style="font-size:15px;color:rgba(255,255,255,0.5);">${originalAmount}</div>
            </div>
            <div style="flex:1;background:rgba(${isPartial ? "245,158,11" : "168,85,247"},0.08);border:1px solid rgba(${isPartial ? "245,158,11" : "168,85,247"},0.2);border-radius:12px;padding:18px;">
              <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Rembourse</div>
              <div style="font-size:18px;font-weight:800;color:${amountColor};">${refundAmount}</div>
            </div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-top:10px;">
          <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">
            Le remboursement sera credite sur votre moyen de paiement d'origine sous 5 a 10 jours ouvrables. Pour toute question, contactez <a href="mailto:support@tuatha-app.com" style="color:#f47b20;">support@tuatha-app.com</a>.
          </div>
        </div>
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = `${typeLabel} — ${refundAmount} — ${proName}`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Refund email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log("[Email] Refund email sent, id:", data?.id);
  return data;
}

// ─── Pro verification status email (validated / rejected) ───

interface ProVerificationEmailParams {
  to: string;
  prenom: string;
  nom: string;
  status: "verified" | "rejected";
  note: string | null;     // reason for rejection or congratulatory note
  specialite: string;
}

export async function sendProVerificationEmail(params: ProVerificationEmailParams) {
  checkResendKillSwitch();
  const { to, prenom, nom, status, note, specialite } = params;
  const appUrl = secrets.appUrl();

  const isVerified = status === "verified";
  const bannerColor = isVerified
    ? "linear-gradient(135deg,#10b981,#34d399)"
    : "linear-gradient(135deg,#ef4444,#f97316)";
  const emoji = isVerified ? "&#9989;" : "&#10060;";
  const title = isVerified ? "Compte verifie" : "Verification refusee";
  const subtitle = isVerified
    ? "Votre compte professionnel a ete valide"
    : "Votre demande de verification n'a pas abouti";

  const bodyHtml = isVerified
    ? `<p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
        Felicitations <strong style="color:#fff;">${prenom}</strong> ! Votre compte <strong style="color:#f47b20;">${specialite}</strong> a ete verifie avec succes. Vous pouvez desormais recevoir des reservations et des paiements sur Tuatha.
      </p>
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:18px;margin-bottom:24px;">
        <div style="font-size:13px;color:#10b981;font-weight:600;margin-bottom:6px;">Ce qui est active :</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.8;">
          &#10003; Reception de reservations en ligne<br/>
          &#10003; Paiements securises via Stripe<br/>
          &#10003; Visibilite dans l'annuaire Tuatha<br/>
          &#10003; Messagerie avec vos patients
        </div>
      </div>
      <div style="text-align:center;">
        <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
          Acceder a mon espace
        </a>
      </div>`
    : `<p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 28px;">
        Bonjour <strong style="color:#fff;">${prenom}</strong>, la verification de votre compte <strong style="color:#f47b20;">${specialite}</strong> n'a pas pu aboutir.
      </p>
      ${note ? `
      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:18px;margin-bottom:24px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Motif</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;">${note}</div>
      </div>` : ""}
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px;margin-bottom:24px;">
        <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">
          Vous pouvez soumettre de nouveaux documents depuis votre espace professionnel. Si vous pensez qu'il s'agit d'une erreur, contactez <a href="mailto:support@tuatha-app.com" style="color:#f47b20;">support@tuatha-app.com</a>.
        </div>
      </div>
      <div style="text-align:center;">
        <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:700;font-size:15px;padding:14px 40px;border-radius:12px;text-decoration:none;">
          Soumettre de nouveaux documents
        </a>
      </div>`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} - Tuatha</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f47b20,#ff9a44);color:#fff;font-weight:800;font-size:22px;padding:12px 32px;border-radius:14px;letter-spacing:-0.5px;">Tuatha</div>
    </div>
    <div style="background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="background:${bannerColor};padding:32px 36px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">${emoji}</div>
        <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#fff;">${title}</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">${subtitle}</p>
      </div>
      <div style="padding:36px;">
        ${bodyHtml}
      </div>
    </div>
    ${FOOTER_HTML}
  </div>
</body>
</html>
  `;

  const subject = isVerified
    ? `Votre compte Tuatha est verifie, ${prenom} !`
    : `Verification de votre compte Tuatha — Action requise`;
  const text = htmlToText(html);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    headers: emailHeaders(),
  });

  if (error) {
    console.error("[Email] Pro verification email error:", JSON.stringify(error));
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  console.log(`[Email] Pro ${status} email sent to ${to}, id:`, data?.id);
  return data;
}
