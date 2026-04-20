"use client";

import { useEffect, useState } from "react";
import ScreenShield from "./ScreenShield";

// Wrapper that fetches the current user and passes identity to ScreenShield
// for forensic watermarking. Mount once in each dashboard layout.

export default function ScreenShieldWrapper() {
  const [user, setUser] = useState<{ prenom: string; nom: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.prenom) {
          setUser({ prenom: data.prenom, nom: data.nom, id: data.id || "" });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <ScreenShield
      userName={user ? `${user.prenom} ${user.nom}` : undefined}
      userId={user?.id}
    />
  );
}
