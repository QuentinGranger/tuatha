// ─── i18n Configuration ───
// Shared locale config used by request.ts, middleware, and components.

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
export const LOCALE_COOKIE = "tuatha_locale";
