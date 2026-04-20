"use client";

import { useRouter } from "next/navigation";
import { useLocale as useNextIntlLocale } from "next-intl";
import { locales, type Locale } from "@/i18n/config";

/** Switch the app locale via cookie + full page refresh. */
export function useLocaleSwitcher() {
  const router = useRouter();
  const current = useNextIntlLocale() as Locale;

  const switchLocale = async (locale: Locale) => {
    if (locale === current) return;
    if (!locales.includes(locale)) return;

    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });

    router.refresh();
  };

  return { locale: current, switchLocale, locales };
}
