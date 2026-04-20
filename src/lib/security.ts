// ─── Disposable / Temporary email domain blocklist ───
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "throwaway.email", "guerrillamail.com", "guerrillamail.net",
  "guerrillamail.org", "grr.la", "sharklasers.com", "guerrillamailblock.com",
  "mailinator.com", "maildrop.cc", "yopmail.com", "yopmail.fr", "yopmail.net",
  "trashmail.com", "trashmail.me", "trashmail.net", "dispostable.com",
  "mailnesia.com", "mailcatch.com", "tempail.com", "tempr.email",
  "temp-mail.org", "temp-mail.io", "fakeinbox.com", "mailnator.com",
  "getnada.com", "mohmal.com", "emailondeck.com", "33mail.com",
  "maildrop.cc", "discard.email", "discardmail.com", "discardmail.de",
  "spamgourmet.com", "mytemp.email", "tempinbox.com", "burnermail.io",
  "mailsac.com", "inboxbear.com", "harakirimail.com", "crazymailing.com",
  "tmail.com", "tmpmail.net", "tmpmail.org", "bupmail.com",
  "10minutemail.com", "10minutemail.net", "minutemail.com",
  "20minutemail.com", "mailtemp.net", "emailfake.com",
  "generator.email", "emailnax.com", "zetmail.com",
  "mohmal.im", "emailtemporanea.com", "tempmailaddress.com",
  "mailgw.com", "jetable.org", "trash-mail.com", "getairmail.com",
  "filzmail.com", "mailexpire.com", "tempmailer.com", "dropmail.me",
  "correotemporal.org", "tempomail.fr", "ephemail.net",
  "mailchimp.com.co", "mail-temp.com", "tempemails.io",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  // Heuristic: detect common temp-mail patterns in domain
  const suspicious = [
    "tempmail", "throwaway", "disposable", "fakeinbox", "trashmail",
    "guerrilla", "yopmail", "mailinator", "tmpmail", "10minute",
    "burner", "noreply", "spamgourmet",
  ];
  return suspicious.some((s) => domain.includes(s));
}

// ─── Password policy ───
export interface PasswordCheck {
  label: string;
  met: boolean;
}

export interface PasswordValidation {
  valid: boolean;
  score: number; // 0-4
  checks: PasswordCheck[];
}

export function validatePassword(password: string): PasswordValidation {
  const checks: PasswordCheck[] = [
    { label: "Au moins 8 caractères", met: password.length >= 8 },
    { label: "Une lettre majuscule", met: /[A-Z]/.test(password) },
    { label: "Une lettre minuscule", met: /[a-z]/.test(password) },
    { label: "Un chiffre", met: /\d/.test(password) },
    { label: "Un caractère spécial (!@#$%...)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];

  const metCount = checks.filter((c) => c.met).length;
  const valid = metCount === checks.length;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (metCount >= 4) score++;
  if (metCount === 5) score++;

  return { valid, score, checks };
}

export function getPasswordStrengthLabel(score: number): { label: string; color: string } {
  switch (score) {
    case 0: return { label: "Très faible", color: "#ef4444" };
    case 1: return { label: "Faible", color: "#f97316" };
    case 2: return { label: "Moyen", color: "#eab308" };
    case 3: return { label: "Fort", color: "#22c55e" };
    case 4: return { label: "Très fort", color: "#10b981" };
    default: return { label: "", color: "" };
  }
}

// ─── Email verification code ───
export function generateVerifyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
