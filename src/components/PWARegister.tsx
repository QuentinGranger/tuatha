"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Register background sync for offline queue replay
        if ("sync" in reg) {
          (reg as any).sync.register("tuatha-sync-queue").catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  return null;
}
