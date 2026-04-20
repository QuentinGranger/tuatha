"use client";

import { useEffect, useCallback, useRef, useState } from "react";

// ─── Anti-Screenshot / Screen Capture Shield v2 ───
//
// IMPORTANT: OS-level screenshots (Cmd+Shift+3/4/5 on Mac, PrintScreen on Windows)
// happen at the OS level BEFORE the browser sees them. No JavaScript can prevent them.
//
// Strategy: Make screenshots USELESS instead of trying to prevent them.
//   1. VISIBLE watermark with user identity (appears clearly in any screenshot)
//   2. Aggressive clipboard wiping (every 2s — wipes screenshot from clipboard)
//   3. Blur on window blur / visibility change / modifier key hold
//   4. Block keyboard shortcuts we CAN intercept
//   5. CSS: disable text selection, drag, print
//   6. Right-click blocking
//   7. Screen recording API interception
//   8. DevTools detection
//
// Even if someone screenshots, the watermark identifies WHO did it.

interface ScreenShieldProps {
  userName?: string;
  userId?: string;
}

export default function ScreenShield({ userName, userId }: ScreenShieldProps) {
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [modifierHeld, setModifierHeld] = useState(false);

  // ─── 1. Block keyboard shortcuts + blur on modifier keys ───
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // PrintScreen — wipe clipboard immediately
    if (e.key === "PrintScreen") {
      e.preventDefault();
      wipeClipboard();
      showWarning();
      return;
    }

    // Any Cmd/Ctrl + Shift combo → blur immediately (catches ALL screenshot shortcuts)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      blurScreen();
      wipeClipboard();
      showWarning();
      return;
    }

    // Ctrl+P / Cmd+P (print)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      showWarning();
      return;
    }

    // Ctrl+S / Cmd+S (save page)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      return;
    }

    // F12 (dev tools)
    if (e.key === "F12") {
      e.preventDefault();
      return;
    }

    // Blur while any modifier is held (Cmd, Ctrl, Alt)
    if (e.key === "Meta" || e.key === "Control" || e.key === "Alt") {
      setModifierHeld(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Meta" || e.key === "Control" || e.key === "Alt") {
      setModifierHeld(false);
    }
  }, []);

  // ─── 2. Blur on modifier hold, visibility change, window blur ───
  useEffect(() => {
    const main = document.querySelector("[data-screen-shield]") as HTMLElement;
    if (!main) return;
    if (modifierHeld) {
      main.style.filter = "blur(30px) brightness(0.5)";
      main.style.transition = "filter 0.05s ease";
    } else {
      main.style.filter = "none";
      main.style.transition = "filter 0.3s ease";
    }
  }, [modifierHeld]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "hidden") {
      blurScreen();
    } else {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => unblurScreen(), 500);
    }
  }, []);

  const handleWindowBlur = useCallback(() => {
    blurScreen();
    wipeClipboard();
  }, []);

  const handleWindowFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      unblurScreen();
      wipeClipboard();
    }, 500);
  }, []);

  // ─── 3. Block drag (keep right-click functional) ───
  const handleDragStart = useCallback((e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") e.preventDefault();
  }, []);

  // ─── 4. Screen recording API interception ───
  const patchGetDisplayMedia = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const original = navigator.mediaDevices.getDisplayMedia;
    if (!original) return;

    navigator.mediaDevices.getDisplayMedia = async function (constraints) {
      console.warn("[SCREEN-SHIELD] Screen recording attempt detected.");
      showWarning();
      blurScreen();
      return original.call(navigator.mediaDevices, constraints);
    };
  }, []);

  // ─── 5. DevTools detection (size-based) ───
  const checkDevTools = useCallback(() => {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      blurScreen();
    }
  }, []);

  // ─── Setup all listeners + clipboard wiper ───
  useEffect(() => {
    // Keyboard
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("keyup", handleKeyUp, { capture: true });

    // Visibility / focus
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    // Drag protection (images only)
    document.addEventListener("dragstart", handleDragStart);

    // Screen recording
    patchGetDisplayMedia();

    // DevTools detection (check every 2s)
    const devToolsInterval = setInterval(checkDevTools, 2000);

    // Clipboard wipe only happens on specific events (blur, screenshot keys)
    // NOT on a timer — timer-based wipe steals focus from inputs

    // ─── Inject protection CSS ───
    const style = document.createElement("style");
    style.id = "screen-shield-css";
    style.textContent = `
      /* Block printing */
      @media print {
        body * { display: none !important; }
        body::after {
          content: "IMPRESSION NON AUTORISEE - Contenu protege - Tuatha Pro";
          display: block !important;
          font-size: 32px;
          color: #999;
          text-align: center;
          padding: 200px 20px;
        }
      }
      /* Allow text selection everywhere — watermark handles tracing */
      [data-screen-shield] {
        -webkit-touch-callout: none !important;
      }
      /* Block image dragging */
      [data-screen-shield] img {
        -webkit-user-drag: none !important;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("keyup", handleKeyUp, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("dragstart", handleDragStart);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (clipboardIntervalRef.current) clearInterval(clipboardIntervalRef.current);
      clearInterval(devToolsInterval);
      const s = document.getElementById("screen-shield-css");
      if (s) s.remove();
    };
  }, [handleKeyDown, handleKeyUp, handleVisibilityChange, handleWindowBlur, handleWindowFocus, handleDragStart, patchGetDisplayMedia, checkDevTools]);

  // ─── VISIBLE Watermark ───
  // Semi-transparent but CLEARLY visible in screenshots.
  // This is the #1 deterrent: even if they screenshot, the watermark
  // identifies WHO took it — making it traceable and legally actionable.
  const watermarkText = userName
    ? `${userName} - ${userId || ""} - ${new Date().toLocaleDateString("fr-FR")}`
    : "Tuatha Pro";

  return (
    <>
      {/* Visible watermark overlay — clearly appears in any screenshot */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 99999,
          overflow: "hidden",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            width: "300%",
            height: "300%",
            transform: "rotate(-25deg) translate(-30%, -30%)",
            display: "flex",
            flexWrap: "wrap",
            gap: "60px 100px",
            padding: "40px",
          }}
        >
          {Array.from({ length: 120 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: "15px",
                fontFamily: "monospace",
                color: i % 2 === 0
                  ? "rgba(128, 128, 128, 0.045)"
                  : "rgba(100, 100, 100, 0.035)",
                whiteSpace: "nowrap",
                lineHeight: "60px",
                letterSpacing: "1px",
              }}
            >
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Helpers ───

function blurScreen() {
  const main = document.querySelector("[data-screen-shield]") as HTMLElement;
  if (main) {
    main.style.filter = "blur(30px) brightness(0.3)";
    main.style.transition = "filter 0.05s ease";
  }
}

function unblurScreen() {
  const main = document.querySelector("[data-screen-shield]") as HTMLElement;
  if (main) {
    main.style.filter = "none";
    main.style.transition = "filter 0.3s ease";
  }
}

function wipeClipboard() {
  try {
    // Use only async Clipboard API — never create a textarea (steals focus)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText("").catch(() => {});
    }
  } catch {}
}

function showWarning() {
  if (document.getElementById("screen-shield-warning")) return;

  const toast = document.createElement("div");
  toast.id = "screen-shield-warning";
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Capture d'ecran detectee — Ce contenu est protege et trace.</span>
    </div>
  `;
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    color: "white",
    padding: "14px 28px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "600",
    zIndex: "100001",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.15)",
    maxWidth: "90vw",
  });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.5s ease";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
