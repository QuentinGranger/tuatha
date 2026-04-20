"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import s from "./page.module.scss";

type SignalType = "join" | "offer" | "answer" | "ice-candidate" | "leave";

interface SignalEvent {
  roomId: string;
  senderId: string;
  targetId?: string | null;
  type: SignalType;
  payload?: unknown;
  at: number;
}

const FALLBACK_RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VisioPage() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") || "";
  const roomId = useMemo(() => roomParam.trim(), [roomParam]);

  const [selfId, setSelfId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("Initialisation...");
  const rtcConfigRef = useRef<RTCConfiguration>(FALLBACK_RTC_CONFIG);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);

  // Connection quality monitoring
  interface ConnStats {
    bitrate: number;       // kbps
    packetLoss: number;    // 0-100%
    rtt: number;           // ms
    quality: "good" | "fair" | "poor" | "none";
  }
  const [connStats, setConnStats] = useState<ConnStats>({ bitrate: 0, packetLoss: 0, rtt: 0, quality: "none" });
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatsRef = useRef<{ bytesReceived: number; timestamp: number; packetsReceived: number; packetsLost: number } | null>(null);

  // Lobby state
  const [phase, setPhase] = useState<"lobby" | "call" | "ended">("lobby");
  const [lobbyError, setLobbyError] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number>(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const sseReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseBackoff = useRef(1000); // start at 1s, max 15s
  const iceRestartingRef = useRef(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const sendSignal = async (
    type: SignalType,
    payload?: unknown,
    targetId?: string | null,
  ) => {
    if (!roomId || !selfId) return;
    try {
      await fetch("/api/visio/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          senderId: selfId,
          targetId: targetId || null,
          type,
          payload: payload ?? null,
        }),
      });
    } catch {
      // Signal errors are transient; keep UI alive.
    }
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    setMicEnabled(true);
    setCamEnabled(true);
    return stream;
  };

  const ensurePeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(rtcConfigRef.current);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && peerIdRef.current) {
        void sendSignal("ice-candidate", event.candidate.toJSON(), peerIdRef.current);
      }
    };

    pc.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        remoteStreamRef.current = incomingStream;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = incomingStream;
      } else {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      setStatus("Connecté");
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setStatus("Connecté");
        iceRestartingRef.current = false;
        ringtoneRef.current?.pause();
      } else if (state === "connecting") {
        setStatus("Connexion en cours...");
      } else if (state === "failed") {
        // ICE restart: create a new offer with iceRestart flag
        if (!iceRestartingRef.current && peerIdRef.current) {
          iceRestartingRef.current = true;
          setStatus("Reconnexion en cours...");
          const peerId = peerIdRef.current;
          pc.createOffer({ iceRestart: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => sendSignal("offer", pc.localDescription, peerId))
            .catch(() => setStatus("Échec de la reconnexion"));
        } else {
          setStatus("Connexion interrompue");
        }
      } else if (state === "disconnected") {
        setStatus("Connexion instable...");
        // Wait 3s — if still disconnected, try ICE restart
        setTimeout(() => {
          if (pc.connectionState === "disconnected" && !iceRestartingRef.current && peerIdRef.current) {
            iceRestartingRef.current = true;
            setStatus("Reconnexion en cours...");
            const peerId = peerIdRef.current;
            pc.createOffer({ iceRestart: true })
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => sendSignal("offer", pc.localDescription, peerId))
              .catch(() => setStatus("Échec de la reconnexion"));
          }
        }, 3000);
      } else if (state === "closed") {
        setStatus("Appel terminé");
        ringtoneRef.current?.pause();
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }

    return pc;
  };

  const createAndSendOffer = async (targetId: string) => {
    const pc = ensurePeerConnection();
    if (pc.signalingState !== "stable") return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal("offer", offer, targetId);
    setStatus("Invitation envoyée...");
  };

  const leaveCall = async (emitLeave = true) => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (emitLeave && peerIdRef.current) {
      await sendSignal("leave", null, peerIdRef.current);
    }

    sseRef.current?.close();
    sseRef.current = null;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    camTrackRef.current = null;
    setScreenSharing(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    prevStatsRef.current = null;
    setConnStats({ bitrate: 0, packetLoss: 0, rtt: 0, quality: "none" });

    ringtoneRef.current?.pause();
    ringtoneRef.current = null;

    peerIdRef.current = null;
    setStatus("Appel terminé");
    closingRef.current = false;
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    stream.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicEnabled(next);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camEnabled;
    stream.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCamEnabled(next);
  };

  const toggleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (screenSharing) {
      // Stop screen share, restore camera track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const cam = camTrackRef.current;
      if (cam && localStreamRef.current) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(cam);
        // Replace track in local stream for local video preview
        const oldVideo = localStreamRef.current.getVideoTracks()[0];
        if (oldVideo) localStreamRef.current.removeTrack(oldVideo);
        localStreamRef.current.addTrack(cam);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
      setScreenSharing(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Save current camera track for later restore
      if (localStreamRef.current) {
        camTrackRef.current = localStreamRef.current.getVideoTracks()[0] || null;
      }

      // Replace video track on peer connection
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);

      // Update local preview to show screen
      if (localStreamRef.current) {
        const oldVideo = localStreamRef.current.getVideoTracks()[0];
        if (oldVideo) localStreamRef.current.removeTrack(oldVideo);
        localStreamRef.current.addTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }

      setScreenSharing(true);

      // Auto-stop when user clicks browser "Stop sharing"
      screenTrack.onended = () => {
        void toggleScreenShare();
      };
    } catch {
      // User cancelled the screen share picker — do nothing
    }
  };

  // ─── Lobby: start preview stream ───

  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      previewStreamRef.current = stream;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
      setLobbyError("");
      setPreviewReady(true);

      // Audio level meter
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          setAudioLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          levelRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* AudioContext not supported — skip meter */ }
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        setLobbyError("Permission refusée. Clique sur l'icône 🔒 dans la barre d'adresse → autoriser caméra/micro, puis réessaie.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setLobbyError("Aucune caméra ou micro détecté sur cet appareil.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setLobbyError("La caméra ou le micro est utilisé par une autre application.");
      } else if (name === "OverconstrainedError") {
        setLobbyError("Impossible de trouver une caméra compatible.");
      } else if (typeof navigator.mediaDevices === "undefined") {
        setLobbyError("getUserMedia non disponible — utilise HTTPS ou localhost.");
      } else {
        setLobbyError(`Erreur: ${name || err?.message || "Impossible d'accéder à la caméra/micro."}`);
      }
      setPreviewReady(false);
    }
  }, []);

  const stopPreview = useCallback(() => {
    cancelAnimationFrame(levelRafRef.current);
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    // Don't stop tracks — they get transferred to the call
  }, []);

  const togglePreviewMic = useCallback(() => {
    const stream = previewStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    stream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicEnabled(next);
  }, [micEnabled]);

  const togglePreviewCam = useCallback(() => {
    const stream = previewStreamRef.current;
    if (!stream) return;
    const next = !camEnabled;
    stream.getVideoTracks().forEach((t) => { t.enabled = next; });
    setCamEnabled(next);
  }, [camEnabled]);

  const joinCall = useCallback(() => {
    if (!previewStreamRef.current) return;
    // Transfer preview stream to call
    localStreamRef.current = previewStreamRef.current;
    if (localVideoRef.current) localVideoRef.current.srcObject = previewStreamRef.current;
    stopPreview();
    setPhase("call");
  }, [stopPreview]);

  const requestDevices = useCallback(() => {
    setPermissionAsked(true);
    setLobbyError("");
    startPreview();
  }, [startPreview]);

  useEffect(() => {
    if (phase === "lobby") {
      return () => {
        stopPreview();
      };
    }
  }, [phase, stopPreview]);

  useEffect(() => {
    fetch("/api/visio/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.participantId) return;
        setSelfId(d.participantId);
        setDisplayName(d.displayName || d.participantId);
      })
      .catch(() => {});

    fetch("/api/visio/ice-servers")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.iceServers?.length) {
          rtcConfigRef.current = { iceServers: d.iceServers };
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "call") return;
    if (!roomId) {
      setStatus("Room invalide");
      return;
    }
    if (!selfId) return;

    let active = true;

    const handleSignal = async (signal: SignalEvent) => {
      if (!active) return;
      if (!signal || signal.roomId !== roomId) return;

      try {
        if (signal.type === "join") {
          peerIdRef.current = signal.senderId;
          // One deterministic initiator to avoid offer glare.
          if (selfId < signal.senderId) {
            await createAndSendOffer(signal.senderId);
          } else {
            setStatus("Pair détecté. En attente de l'offre...");
          }
          return;
        }

        if (signal.type === "offer") {
          peerIdRef.current = signal.senderId;
          const pc = ensurePeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", answer, signal.senderId);
          setStatus("Connexion en cours...");
          return;
        }

        if (signal.type === "answer") {
          const pc = ensurePeerConnection();
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
          }
          return;
        }

        if (signal.type === "ice-candidate") {
          const pc = ensurePeerConnection();
          if (signal.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
          }
          return;
        }

        if (signal.type === "leave") {
          setStatus("Le correspondant a quitté l'appel");
          peerIdRef.current = null;
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          remoteStreamRef.current = null;
        }
      } catch {
        setStatus("Erreur de négociation");
      }
    };

    const connect = async () => {
      try {
        await ensureLocalStream();
      } catch {
        setStatus("Autorise la caméra/micro pour démarrer la visio");
        return;
      }

      const source = new EventSource(`/api/visio/stream?roomId=${encodeURIComponent(roomId)}`);
      sseRef.current = source;

      source.onopen = () => {
        if (!active) return;
        sseBackoff.current = 1000; // reset backoff on successful connect
        setStatus("En attente d'un correspondant...");
        // Play ringtone while waiting
        try {
          if (!ringtoneRef.current) {
            const audio = new Audio("/RingtoneBeats.wav");
            audio.loop = true;
            audio.volume = 0.4;
            ringtoneRef.current = audio;
          }
          ringtoneRef.current.currentTime = 0;
          ringtoneRef.current.play().catch(() => {});
        } catch { /* audio not supported */ }
        void sendSignal("join");
      };

      source.onmessage = (event) => {
        let signal: SignalEvent | null = null;
        try {
          signal = JSON.parse(event.data) as SignalEvent;
        } catch {
          return;
        }
        if (signal) void handleSignal(signal);
      };

      source.onerror = () => {
        if (!active || closingRef.current) return;
        source.close();
        sseRef.current = null;
        const delay = sseBackoff.current;
        sseBackoff.current = Math.min(sseBackoff.current * 1.5, 15000);
        setStatus(`Signalisation interrompue — reconnexion dans ${Math.round(delay / 1000)}s...`);
        sseReconnectTimer.current = setTimeout(() => {
          if (!active || closingRef.current) return;
          setStatus("Reconnexion...");
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      active = false;
      if (sseReconnectTimer.current) clearTimeout(sseReconnectTimer.current);
      void leaveCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, selfId, phase]);

  // ─── Connection quality polling ───
  useEffect(() => {
    if (phase !== "call") return;

    statsIntervalRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== "connected") return;

      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let packetsReceived = 0;
        let packetsLost = 0;
        let rtt = 0;
        let hasRtt = false;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            bytesReceived += report.bytesReceived || 0;
            packetsReceived += report.packetsReceived || 0;
            packetsLost += report.packetsLost || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime != null) {
            rtt = report.currentRoundTripTime * 1000; // s → ms
            hasRtt = true;
          }
        });

        const now = performance.now();
        const prev = prevStatsRef.current;
        if (prev) {
          const dt = (now - prev.timestamp) / 1000; // seconds
          const bitrate = dt > 0 ? ((bytesReceived - prev.bytesReceived) * 8) / dt / 1000 : 0; // kbps
          const totalPkts = packetsReceived - prev.packetsReceived + (packetsLost - prev.packetsLost);
          const lostPkts = packetsLost - prev.packetsLost;
          const packetLoss = totalPkts > 0 ? (lostPkts / totalPkts) * 100 : 0;

          let quality: ConnStats["quality"] = "good";
          if (packetLoss > 10 || (hasRtt && rtt > 400) || bitrate < 100) quality = "poor";
          else if (packetLoss > 3 || (hasRtt && rtt > 200) || bitrate < 300) quality = "fair";

          setConnStats({
            bitrate: Math.round(bitrate),
            packetLoss: Math.round(packetLoss * 10) / 10,
            rtt: Math.round(rtt),
            quality,
          });
        }
        prevStatsRef.current = { bytesReceived, timestamp: now, packetsReceived, packetsLost };
      } catch { /* getStats can fail if pc is closing */ }
    }, 2000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [phase]);

  const closeView = async () => {
    await leaveCall(true);
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  // ─── Lobby screen ───
  if (phase === "lobby") {
    const barCount = 16;
    return (
      <main className={s.lobbyMain}>
        <div className={s.lobbyCard}>
          <strong className={s.lobbyTitle}>Vérification des périphériques</strong>
          <span className={s.lobbyRoom}>Room: {roomId || "—"}</span>

          {!permissionAsked ? (
            <>
              <div className={s.previewWrap}>
                <div className={s.camOffOverlay}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Clique ci-dessous pour activer ta caméra et ton micro</span>
                  </div>
                </div>
              </div>
              <button onClick={requestDevices} className={`${s.btnJoin} ${s.btnJoinReady}`}>
                Activer caméra et micro
              </button>
            </>
          ) : !previewReady ? (
            <>
              <div className={s.previewWrap}>
                <div className={s.camOffOverlay}>
                  {lobbyError ? lobbyError : "Autorisation en cours…"}
                </div>
              </div>
              {lobbyError && (
                <>
                  <div className={s.lobbyError}>
                    {lobbyError}<br />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>Vérifie que ton navigateur autorise la caméra et le micro pour ce site.</span>
                  </div>
                  <button onClick={requestDevices} className={`${s.btnJoin} ${s.btnJoinReady}`}>
                    Réessayer
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className={s.previewWrap}>
                <video ref={previewVideoRef} autoPlay muted playsInline className={s.previewVideo} />
                {!camEnabled && (
                  <div className={s.camOffOverlay}>Caméra désactivée</div>
                )}
                <span className={s.previewBadge}>{displayName || "Toi"}</span>
              </div>

              <div className={s.meterWrap}>
                <div className={s.meterHeader}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={micEnabled ? "#10b981" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  <span className={s.meterLabel}>{micEnabled ? "Micro actif" : "Micro coupé"}</span>
                </div>
                <div className={s.meterBars}>
                  {Array.from({ length: barCount }).map((_, i) => (
                    <div key={i} className={s.meterBar} style={{ background: micEnabled && i / barCount < audioLevel ? (i / barCount < 0.6 ? "#10b981" : i / barCount < 0.85 ? "#f59e0b" : "#ef4444") : "transparent" }} />
                  ))}
                </div>
              </div>

              <div className={s.lobbyControls}>
                <button onClick={togglePreviewMic} className={`${s.btnToggle} ${micEnabled ? s.btnToggleOn : s.btnToggleOff}`}>
                  {micEnabled ? "🎙️ Micro ON" : "🔇 Micro OFF"}
                </button>
                <button onClick={togglePreviewCam} className={`${s.btnToggle} ${camEnabled ? s.btnToggleOn : s.btnToggleOff}`}>
                  {camEnabled ? "📷 Caméra ON" : "📷 Caméra OFF"}
                </button>
              </div>

              <button
                onClick={joinCall}
                disabled={!selfId}
                className={`${s.btnJoin} ${selfId ? s.btnJoinReady : s.btnJoinDisabled}`}
              >
                Rejoindre la visio
              </button>
            </>
          )}

          <button onClick={() => { if (previewStreamRef.current) { previewStreamRef.current.getTracks().forEach((t) => t.stop()); previewStreamRef.current = null; } stopPreview(); if (window.history.length > 1) window.history.back(); else window.close(); }} className={s.btnCancel}>
            Annuler
          </button>
        </div>
      </main>
    );
  }

  // ─── Call screen ───
  return (
    <main className={s.callMain}>
      <header className={s.callHeader}>
        <div className={s.callHeaderInfo}>
          <strong className={s.callHeaderTitle}>Visio native Tuatha</strong>
          <span className={s.callHeaderStatus}>{displayName || "Utilisateur"} · {status}</span>
        </div>
        {connStats.quality !== "none" && (
          <div className={s.qualityWrap}>
            <div className={s.qualityBars} title={`${connStats.bitrate} kbps · ${connStats.packetLoss}% perte · ${connStats.rtt}ms RTT`}>
              {[4, 7, 10, 14].map((h, i) => (
                <div key={i} className={s.qualityBar} style={{ height: h, background:
                  connStats.quality === "good" ? (i <= 3 ? "#10b981" : "rgba(255,255,255,0.12)") :
                  connStats.quality === "fair" ? (i <= 1 ? "#f59e0b" : "rgba(255,255,255,0.12)") :
                  (i <= 0 ? "#ef4444" : "rgba(255,255,255,0.12)")
                }} />
              ))}
            </div>
            <span className={s.qualityLabel} style={{ color:
              connStats.quality === "good" ? "#10b981" :
              connStats.quality === "fair" ? "#f59e0b" : "#ef4444"
            }}>
              {connStats.bitrate} kbps
            </span>
          </div>
        )}
      </header>

      <section className={s.videoGrid}>
        <div className={s.videoCard}>
          <video ref={localVideoRef} autoPlay muted playsInline className={s.videoEl} />
          <span className={s.videoBadge}>Toi</span>
        </div>
        <div className={s.videoCard}>
          <video ref={remoteVideoRef} autoPlay playsInline className={s.videoEl} />
          <span className={s.videoBadge}>Correspondant</span>
        </div>
      </section>

      <footer className={s.callFooter}>
        <button onClick={toggleMic} className={`${s.btnControl} ${micEnabled ? s.btnControlOn : s.btnControlOff}`}>
          {micEnabled ? "Micro ON" : "Micro OFF"}
        </button>
        <button onClick={toggleCam} className={`${s.btnControl} ${camEnabled ? s.btnControlOn : s.btnControlOff}`}>
          {camEnabled ? "Caméra ON" : "Caméra OFF"}
        </button>
        <button onClick={() => void toggleScreenShare()} className={`${s.btnControl} ${screenSharing ? s.btnControlOn : s.btnControlOn}`} style={{ background: screenSharing ? "#1e3a5f" : "#1f2937" }}>
          {screenSharing ? "Arrêter le partage" : "Partager l'écran"}
        </button>
        <button onClick={() => void leaveCall(true)} className={s.btnHangup}>
          Raccrocher
        </button>
        <button onClick={() => void closeView()} className={s.btnClose}>
          Fermer
        </button>
      </footer>
    </main>
  );
}
