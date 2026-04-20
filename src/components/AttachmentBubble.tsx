"use client";

import React, { useState, useRef, useEffect } from "react";

/**
 * Renders message attachments: inline images, PDF/document download cards.
 * Uses signed URLs for secure access.
 */

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
}

interface Props {
  attachments: Attachment[];
  proId?: string; // current user's proId, for signing URLs (pro messagerie)
  getUrl?: (filePath: string) => string; // custom URL resolver (athlete messagerie)
  isMe: boolean;
}

const FILE_ICONS: Record<string, string> = {
  pdf: "📄",
  doc: "📝",
  docx: "📝",
  xls: "📊",
  xlsx: "📊",
  csv: "📊",
  txt: "📃",
  zip: "📦",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isAudio(mimeType: string): boolean {
  return mimeType.startsWith("audio/") || (mimeType === "video/webm");
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta = () => { setDuration(audio.duration); setLoaded(true); };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    const onCanPlay = () => { if (!loaded) { setDuration(audio.duration); setLoaded(true); } };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("canplaythrough", onCanPlay);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("canplaythrough", onCanPlay);
    };
  }, [loaded]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`msgAudioPlayer ${isMe ? "msgAudioPlayerMe" : "msgAudioPlayerThem"}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="msgAudioPlayBtn" onClick={toggle} type="button">
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        )}
      </button>
      <div className="msgAudioWaveform" onClick={seek}>
        <div className="msgAudioProgress" style={{ width: `${progress}%` }} />
        {/* Static waveform bars */}
        <div className="msgAudioBars">
          {Array.from({ length: 28 }, (_, i) => {
            const h = 20 + Math.sin(i * 0.7 + 1) * 30 + Math.sin(i * 1.3) * 25 + Math.cos(i * 0.4) * 15;
            return <div key={i} className="msgAudioBar" style={{ height: `${Math.max(15, Math.min(90, h))}%` }} />;
          })}
        </div>
      </div>
      <span className="msgAudioTime">
        {playing || currentTime > 0 ? formatDuration(currentTime) : formatDuration(duration)}
      </span>
    </div>
  );
}

function getSignedUrl(filePath: string, proId: string): string {
  // Client-side: request the signed URL through the API proxy
  // The uploads route handles signing — we construct the API path
  const apiPath = filePath.replace(/^\/uploads\//, "/api/uploads/");
  return `${apiPath}?sub=${encodeURIComponent(proId)}`;
}

export default function AttachmentBubble({ attachments, proId, getUrl: getUrlProp, isMe }: Props) {
  if (!attachments || attachments.length === 0) return null;

  const resolveUrl = getUrlProp ?? ((fp: string) => getSignedUrl(fp, proId!));

  const images = attachments.filter((a) => isImage(a.mimeType));
  const audios = attachments.filter((a) => isAudio(a.mimeType));
  const files = attachments.filter((a) => !isImage(a.mimeType) && !isAudio(a.mimeType));

  return (
    <div className="msgAttachments">
      {/* Image attachments — inline preview grid */}
      {images.length > 0 && (
        <div className={`msgAttImgGrid msgAttImgGrid${Math.min(images.length, 3)}`}>
          {images.map((img) => (
            <a
              key={img.id}
              href={resolveUrl(img.filePath)}
              target="_blank"
              rel="noopener noreferrer"
              className="msgAttImgLink"
              title={img.originalName}
            >
              <img
                src={resolveUrl(img.filePath)}
                alt={img.originalName}
                className="msgAttImg"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {/* Audio attachments — inline player */}
      {audios.map((audio) => (
        <AudioPlayer
          key={audio.id}
          src={resolveUrl(audio.filePath)}
          isMe={isMe}
        />
      ))}

      {/* File attachments — download cards */}
      {files.map((file) => {
        const ext = getExtension(file.originalName);
        const icon = FILE_ICONS[ext] || "📎";

        return (
          <a
            key={file.id}
            href={resolveUrl(file.filePath)}
            target="_blank"
            rel="noopener noreferrer"
            className={`msgAttFile ${isMe ? "msgAttFileMe" : "msgAttFileThem"}`}
            title={`Télécharger ${file.originalName}`}
          >
            <span className="msgAttFileIcon">{icon}</span>
            <span className="msgAttFileInfo">
              <span className="msgAttFileName">{file.originalName}</span>
              <span className="msgAttFileMeta">
                {ext.toUpperCase()} · {formatFileSize(file.size)}
              </span>
            </span>
            <span className="msgAttFileDownload">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </span>
          </a>
        );
      })}
    </div>
  );
}
