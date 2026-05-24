"use client";

// ─── Inactivity Guard ───
// Wraps sensitive pages (dashboards) with an automatic inactivity timeout.
// After 15 minutes of inactivity, the session cookies are cleared and the user
// is redirected to the home page with a warning.

import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  useInactivityTimeout({
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    redirectTo: "/?session=expired",
  });

  return <>{children}</>;
}
