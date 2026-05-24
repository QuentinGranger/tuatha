import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import CookieBanner from "@/components/CookieBanner";
import PWARegister from "@/components/PWARegister";
import OfflineBanner from "@/components/OfflineBanner";
import "./globals.scss";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tuatha - Connexion",
  description: "Connectez-vous à Tuatha",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tuatha Pro",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <CookieBanner />
          <PWARegister />
          <OfflineBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
