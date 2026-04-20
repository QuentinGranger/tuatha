"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { openVisioRoom } from "@/lib/visio";

interface IncomingCall {
  roomId: string;
  callerId: string;
  callerName: string;
  callerSpecialite?: string | null;
  callerAvatar?: string | null;
  eventTitle?: string | null;
  eventDate?: string | null;
  since: string;
}

export default function IncomingCallModal() {
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, []);

  const startRingtone = useCallback(() => {
    try {
      if (!ringtoneRef.current) {
        const audio = new Audio("/RingtoneBeats.wav");
        audio.loop = true;
        audio.volume = 0.5;
        ringtoneRef.current = audio;
      }
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current.play().catch(() => {});
    } catch {
      /* audio not supported */
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch("/api/visio/incoming");
        if (!active) return;
        if (res.status === 401) {
          setPaused(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.incoming && !dismissed.has(data.incoming.roomId)) {
          if (!call || call.roomId !== data.incoming.roomId) {
            setCall(data.incoming);
            startRingtone();
          }
        } else {
          if (call) {
            setCall(null);
            stopRingtone();
          }
        }
      } catch {
        /* silent */
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, paused]);

  const accept = () => {
    if (!call) return;
    stopRingtone();
    openVisioRoom(call.roomId);
    setCall(null);
  };

  const decline = () => {
    if (!call) return;
    stopRingtone();
    setDismissed((prev) => new Set(prev).add(call.roomId));
    setCall(null);
  };

  if (!call) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#111827",
        borderRadius: 20,
        padding: "32px 28px",
        maxWidth: 360,
        width: "90%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
        animation: "incomingCallPulse 2s ease-in-out infinite",
      }}>
        {/* Caller avatar or icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          color: "#fff",
          flexShrink: 0,
        }}>
          📞
        </div>

        {/* Caller info */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
            Appel entrant
          </div>
          <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 600 }}>
            {call.callerName}
          </div>
          {call.callerSpecialite && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {call.callerSpecialite}
            </div>
          )}
          {call.eventTitle && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
              {call.eventTitle}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 16, marginTop: 8, width: "100%" }}>
          <button
            onClick={decline}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: "#991b1b",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Refuser
          </button>
          <button
            onClick={accept}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Accepter
          </button>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes incomingCallPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
