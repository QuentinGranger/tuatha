"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSSE } from "@/hooks/useSSE";
import { offlineFetch } from "@/lib/offlineFetch";
import { buildVisioGroupRoom, buildVisioPairRoom, openVisioRoom } from "@/lib/visio";
import MessageContent from "@/components/MessageContent";
import LegalFooter from "../components/LegalFooter";
import AttachmentBubble from "@/components/AttachmentBubble";
import styles from "./page.module.scss";

interface ProInfo {
  id: string;
  nom: string;
  prenom: string;
  specialite: string | null;
  avatarUrl: string | null;
}

interface Conversation {
  proId: string;
  pro: ProInfo;
  lastMessage: { content: string; createdAt: string; isMe: boolean } | null;
  unread: number;
}

interface GroupConversation {
  id: string;
  name: string;
  isGroup: true;
  members: (ProInfo & { role: string })[];
  lastMessage: { content: string; createdAt: string; senderName: string | null; isMe: boolean } | null;
  unread: number;
}

interface Reaction {
  by: string;
  emoji: string;
}

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
}

interface ContextMenu {
  msgId: string;
  x: number;
  y: number;
}

interface Message {
  id: string;
  content: string;
  senderType: "athlete" | "pro";
  senderProId?: string | null;
  replyToId?: string | null;
  pinned?: boolean;
  important?: boolean;
  reactions?: Reaction[];
  attachments?: Attachment[];
  createdAt: string;
  editedAt?: string | null;
  _status?: "sending" | "failed" | "queued";
  _tempId?: string;
}

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀","😁","😂","🤣","😊","😇","😍","🤩","😘","😜","🤔","🤗","🤫","🤭","😏","😌","😴","🤤","😷","🤒","🤕","🤮","🥵","🥶","😱","😤","😡","🥺","😢","😭"] },
  { label: "Gestes", emojis: ["👍","👎","👏","🙌","🤝","💪","🤞","✌️","🤙","👊","✊","👋","🖐️","👌","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤎","💔","❣️","💯","🔥","⭐","✨","💫"] },
  { label: "Sport", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🏋️","🤸","🚴","🏊","🤽","🧘","🏃","🚶","💊","🩺","🩹","🏥","💉","🧬","🧪","📋","📈","🎯","🏆","🥇","🎖️"] },
];

export default function AthleteMessagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProId = searchParams.get("proId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [selectedProId, setSelectedProId] = useState<string | null>(initialProId);
  const didAutoSelect = useRef(false);
  const [selectedPro, setSelectedPro] = useState<ProInfo | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupConversation | null>(null);
  const [myAthleteId, setMyAthleteId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const lastTypingSentRef = useRef(0);
  const [peerPresence, setPeerPresence] = useState<{ online: boolean; lastSeen: number | null }>({ online: false, lastSeen: null });

  // Browser notifications
  const prevUnreadRef = useRef<Map<string, number>>(new Map());
  const notifPermRef = useRef<NotificationPermission>("default");

  // Reaction picker state
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const [reactionPos, setReactionPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  // Emoji picker (input area)
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  // File attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reply-to
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Edit message
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Drafts: persist text + files + replyTo between conversations
  interface Draft { text: string; files: File[]; replyTo: Message | null; }
  const draftsRef = useRef<Map<string, Draft>>(new Map());
  const getDraftKey = useCallback(() => {
    if (selectedGroup) return `group:${selectedGroup.id}`;
    if (selectedProId) return `pro:${selectedProId}`;
    return null;
  }, [selectedGroup, selectedProId]);

  const saveDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;
    const hasContent = input.trim() || pendingFiles.length > 0 || replyTo;
    if (hasContent) {
      draftsRef.current.set(key, { text: input, files: pendingFiles, replyTo });
    } else {
      draftsRef.current.delete(key);
    }
  }, [getDraftKey, input, pendingFiles, replyTo]);

  const restoreDraft = useCallback((key: string) => {
    const draft = draftsRef.current.get(key);
    if (draft) {
      setInput(draft.text);
      setPendingFiles(draft.files);
      setReplyTo(draft.replyTo);
    } else {
      setInput("");
      setPendingFiles([]);
      setReplyTo(null);
    }
  }, []);

  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    if (key) draftsRef.current.delete(key);
  }, [getDraftKey]);

  // Group modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [connectedPros, setConnectedPros] = useState<ProInfo[]>([]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      notifPermRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => { notifPermRef.current = p; });
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/athlete/profil")
      .then((r) => r.json())
      .then((d) => { if (d.id) setMyAthleteId(d.id); })
      .catch(() => {});
  }, []);

  // After offline sync replay completes, refetch & clear queued entries
  useEffect(() => {
    const onSyncComplete = () => {
      setMessages(prev => prev.filter(m => m._status !== "queued"));
    };
    window.addEventListener("tuatha-sync-complete", onSyncComplete);
    return () => window.removeEventListener("tuatha-sync-complete", onSyncComplete);
  });

  // ─── SSE: Real-time conversation list (1:1 + groups) ───
  useSSE<{ conversations: Conversation[]; groups: GroupConversation[] }>({
    url: "/api/athlete/stream",
    onMessage: (data) => {
      if (data.conversations) {
        setConversations(data.conversations);

        // Browser push notification for new unread messages
        if (notifPermRef.current === "granted") {
          for (const conv of data.conversations) {
            const prev = prevUnreadRef.current.get(conv.proId) ?? 0;
            if (conv.unread > prev && conv.proId !== selectedProId) {
              const title = `${conv.pro.prenom} ${conv.pro.nom}`;
              const body = conv.lastMessage?.content || "Nouveau message";
              try { new Notification(title, { body, icon: conv.pro.avatarUrl || "/icon-192.png", tag: `athlete-msg-${conv.proId}` }); } catch {}
            }
          }
        }
        const map = new Map<string, number>();
        for (const conv of data.conversations) map.set(conv.proId, conv.unread);
        prevUnreadRef.current = map;
      }
      if (data.groups) setGroupConversations(data.groups);
      setLoadingConvs(false);
    },
  });

  // ─── SSE: Real-time messages for active 1:1 conversation ───
  const sseMessageParams: Record<string, string> | undefined = selectedProId
    ? { proId: selectedProId }
    : selectedGroup
      ? { groupId: selectedGroup.id }
      : undefined;

  useSSE<Message[]>({
    url: "/api/athlete/stream",
    enabled: !!selectedProId || !!selectedGroup,
    params: sseMessageParams,
    onMessage: (data) => {
      if (!Array.isArray(data)) return;
      setLoadingMsgs(false);
      setMessages((prev) => {
        if (prev.length === 0) {
          // Initial load: check if there are likely more messages
          setHasMore(data.length >= 40);
          nextCursorRef.current = data.length > 0 ? data[0].id : null;
          return data;
        }
        // Real-time updates: merge new/updated messages (don't touch older prepended messages)
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = data.filter((m: Message) => !existingIds.has(m.id));
        const sseMap = new Map(data.map((m: Message) => [m.id, m]));
        const updated = prev.map((m) => sseMap.get(m.id) ?? m);
        return newMsgs.length > 0 ? [...updated, ...newMsgs] : updated;
      });
    },
  });

  // ─── Typing indicator: send signal (throttled) ───
  const sendTypingSignal = useCallback(() => {
    if (!selectedProId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    fetch("/api/athlete/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proId: selectedProId }),
    }).catch(() => {});
  }, [selectedProId]);

  // ─── Typing indicator: poll remote status ───
  useEffect(() => {
    if (!selectedProId) { setRemoteTyping(false); return; }
    let alive = true;
    const poll = () => {
      if (!alive) return;
      fetch(`/api/athlete/typing?proId=${selectedProId}`)
        .then((r) => r.json())
        .then((d) => { if (alive) setRemoteTyping(!!d.typing); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, [selectedProId]);

  // Reset typing state on conversation switch
  useEffect(() => {
    setRemoteTyping(false);
    lastTypingSentRef.current = 0;
  }, [selectedProId]);

  // ─── Presence: heartbeat (I'm online) ───
  useEffect(() => {
    const beat = () => fetch("/api/athlete/presence", { method: "POST" }).catch(() => {});
    beat();
    const iv = setInterval(beat, 20000);
    return () => clearInterval(iv);
  }, []);

  // ─── Presence: poll peer (pro) status ───
  useEffect(() => {
    if (!selectedProId) { setPeerPresence({ online: false, lastSeen: null }); return; }
    let alive = true;
    const poll = () => {
      if (!alive) return;
      fetch(`/api/athlete/presence?proId=${selectedProId}`)
        .then((r) => r.json())
        .then((d) => { if (alive) setPeerPresence({ online: !!d.online, lastSeen: d.lastSeen ?? null }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [selectedProId]);

  // Fetch connected pros (for group creation modal)
  const fetchConnectedPros = useCallback(() => {
    fetch("/api/athlete/messages")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setConnectedPros(d.map((c: Conversation) => c.pro));
      })
      .catch(() => {});
  }, []);

  // Select 1:1 conversation
  const selectConversation = useCallback((conv: Conversation) => {
    saveDraft();
    setSelectedProId(conv.proId);
    setSelectedPro(conv.pro);
    setSelectedGroup(null);
    setMessages([]);
    setHasMore(false);
    nextCursorRef.current = null;
    setLoadingMsgs(true);
    setMenuOpen(false);
    setProfileOpen(false);
    setChatSearchOpen(false);
    setChatSearch("");
    setContextMenu(null);
    setReplyTo(null);
    setEditingMsgId(null);
    setReactionMsgId(null);
    setConversations((prev) =>
      prev.map((c) => c.proId === conv.proId ? { ...c, unread: 0 } : c)
    );
    restoreDraft(`pro:${conv.proId}`);
  }, [saveDraft, restoreDraft]);

  // Select group conversation
  const selectGroupConversation = useCallback((group: GroupConversation) => {
    saveDraft();
    setSelectedGroup(group);
    setSelectedProId(null);
    setSelectedPro(null);
    setMessages([]);
    setHasMore(false);
    nextCursorRef.current = null;
    setLoadingMsgs(true);
    setMenuOpen(false);
    setProfileOpen(false);
    setChatSearchOpen(false);
    setChatSearch("");
    setContextMenu(null);
    setReplyTo(null);
    setEditingMsgId(null);
    setReactionMsgId(null);
    setGroupConversations((prev) =>
      prev.map((g) => g.id === group.id ? { ...g, unread: 0 } : g)
    );
    restoreDraft(`group:${group.id}`);
  }, [saveDraft, restoreDraft]);

  // Auto-select from URL param (only once)
  useEffect(() => {
    if (didAutoSelect.current) return;
    if (initialProId && conversations.length > 0 && !selectedPro && !selectedGroup) {
      const conv = conversations.find((c) => c.proId === initialProId);
      if (conv) {
        didAutoSelect.current = true;
        // If proId is already set (from URL init), just fill in the pro info
        // without clearing messages (SSE is already streaming)
        if (selectedProId === conv.proId) {
          setSelectedPro(conv.pro);
          setConversations((prev) =>
            prev.map((c) => c.proId === conv.proId ? { ...c, unread: 0 } : c)
          );
        } else {
          selectConversation(conv);
        }
      }
    }
  }, [initialProId, conversations, selectedPro, selectedGroup, selectedProId, selectConversation]);

  // Scroll to bottom on new messages (only when not loading older)
  const skipAutoScroll = useRef(false);
  useEffect(() => {
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Load older messages (cursor-based pagination) ───
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || !nextCursorRef.current) return;
    if (!selectedProId && !selectedGroup) return;

    setLoadingOlder(true);
    const cursor = nextCursorRef.current;
    const url = selectedGroup
      ? `/api/athlete/groups/${selectedGroup.id}/messages?cursor=${cursor}&take=40`
      : `/api/athlete/messages/${selectedProId}?cursor=${cursor}&take=40`;

    try {
      const res = await fetch(url);
      if (!res.ok) { setLoadingOlder(false); return; }
      const data = await res.json();
      const older: Message[] = data.messages || [];
      setHasMore(data.hasMore ?? false);
      nextCursorRef.current = data.nextCursor ?? null;

      if (older.length > 0) {
        // Preserve scroll position: save scrollHeight before prepend
        const container = chatContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        skipAutoScroll.current = true;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = older.filter((m) => !existingIds.has(m.id));
          return [...unique, ...prev];
        });
        // Restore scroll position after DOM update
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch { /* ignore */ }
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, selectedProId, selectedGroup]);

  // Scroll-to-top detection: trigger loadOlderMessages
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop < 80 && hasMore && !loadingOlder) {
        loadOlderMessages();
      }
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingOlder, loadOlderMessages]);

  const handleSend = async () => {
    const text = input.trim();
    const filesToSend = [...pendingFiles];
    const hasFiles = filesToSend.length > 0;
    if ((!text && !hasFiles) || sending) return;
    if (!selectedProId && !selectedGroup) return;

    const rId = replyTo?.id || null;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Clear typing signal
    if (selectedProId) {
      fetch("/api/athlete/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId: selectedProId, typing: false }),
      }).catch(() => {});
    }

    const displayContent = text || (hasFiles ? `📎 ${filesToSend.length} fichier${filesToSend.length > 1 ? "s" : ""}` : "");
    const tempMsg: Message = {
      id: tempId,
      content: displayContent,
      senderType: "athlete",
      replyToId: rId,
      createdAt: new Date().toISOString(),
      _status: "sending",
      _tempId: tempId,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInput("");
    setReplyTo(null);
    setPendingFiles([]);
    clearDraft();
    setSending(true);
    setUploading(hasFiles);

    try {
      // Upload files first if any
      let uploadedAttachments: Attachment[] = [];
      if (hasFiles) {
        const formData = new FormData();
        filesToSend.forEach((f) => formData.append("files", f));
        const upRes = await fetch("/api/athlete/messages/upload", { method: "POST", body: formData });
        if (!upRes.ok) {
          setMessages((prev) => prev.map((m) => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
          setSending(false);
          setUploading(false);
          return;
        }
        const upData = await upRes.json();
        uploadedAttachments = upData.attachments || [];
      }
      setPendingFiles([]);
      setUploading(false);

      // Send message with optional attachments + replyToId
      const url = selectedGroup
        ? `/api/athlete/groups/${selectedGroup.id}/messages`
        : `/api/athlete/messages/${selectedProId}`;
      const res = await offlineFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          ...(rId && { replyToId: rId }),
          ...(uploadedAttachments.length > 0 && { attachments: uploadedAttachments }),
        }),
      });

      const resData = await res.clone().json().catch(() => null);
      if (resData?.queued) {
        setMessages((prev) => prev.map((m) => m._tempId === tempId ? { ...m, _status: "queued" as const } : m));
        return;
      }
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => prev.map((m) => m._tempId === tempId ? msg : m));
      } else {
        setMessages((prev) => prev.map((m) => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
      }
    } catch {
      setMessages((prev) => prev.map((m) => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
    } finally {
      setSending(false);
      setUploading(false);
      inputRef.current?.focus();
    }
  };

  // Retry a failed optimistic message
  const retryMessage = async (tempId: string) => {
    const msg = messages.find(m => m._tempId === tempId);
    if (!msg) return;
    const proId = selectedProId;
    const groupId = selectedGroup?.id;
    if (!proId && !groupId) return;
    setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "sending" as const } : m));
    try {
      const url = groupId
        ? `/api/athlete/groups/${groupId}/messages`
        : `/api/athlete/messages/${proId}`;
      const res = await offlineFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg.content || undefined, replyToId: msg.replyToId }),
      });
      const rData = await res.clone().json().catch(() => null);
      if (rData?.queued) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "queued" as const } : m));
        return;
      }
      if (!res.ok) throw new Error("retry failed");
      setMessages(prev => prev.filter(m => m._tempId !== tempId));
    } catch {
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
    }
  };

  const dismissFailedMessage = (tempId: string) => {
    setMessages(prev => prev.filter(m => m._tempId !== tempId));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // ─── Voice recording ───
  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (!selectedProId && !selectedGroup) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) { stopAndSendRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      console.error("Microphone access denied");
    }
  };

  const stopAndSendRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }

    await new Promise<void>((resolve) => {
      const prevOnStop = recorder.onstop;
      recorder.onstop = (e) => {
        if (prevOnStop && typeof prevOnStop === "function") (prevOnStop as (ev: Event) => void)(e);
        resolve();
      };
      recorder.stop();
    });

    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;

    const mimeType = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });
    audioChunksRef.current = [];

    if (blob.size < 1000) return;

    const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "weba";
    const filename = `vocal-${Date.now()}.${ext}`;
    const file = new File([blob], filename, { type: mimeType.split(";")[0] });

    if (!selectedProId && !selectedGroup) return;

    const tempMsg: Message = {
      id: `temp-voice-${Date.now()}`,
      content: "🎤 Message vocal…",
      senderType: "athlete",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("files", file);
      const upRes = await fetch("/api/athlete/messages/upload", { method: "POST", body: formData });
      if (!upRes.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        setUploading(false);
        return;
      }
      const upData = await upRes.json();
      setUploading(false);

      const url = selectedGroup
        ? `/api/athlete/groups/${selectedGroup.id}/messages`
        : `/api/athlete/messages/${selectedProId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "", attachments: upData.attachments }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? msg : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setUploading(false);
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  };

  // ─── Edit message ───
  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
    setReactionMsgId(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditingContent("");
  };

  const saveEdit = async () => {
    if (!editingMsgId || !editingContent.trim()) return;
    const msg = messages.find((m) => m.id === editingMsgId);
    if (!msg) return;

    const url = selectedGroup
      ? `/api/athlete/groups/messages/${editingMsgId}/edit`
      : `/api/athlete/messages/edit/${editingMsgId}`;

    const prevContent = msg.content;
    setMessages((prev) => prev.map((m) => m.id === editingMsgId ? { ...m, content: editingContent.trim(), editedAt: new Date().toISOString() } : m));
    setEditingMsgId(null);
    setEditingContent("");

    try {
      const res = await offlineFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingContent.trim() }),
      });
      if (!res.ok) {
        setMessages((prev) => prev.map((m) => m.id === editingMsgId ? { ...m, content: prevContent } : m));
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === editingMsgId ? { ...m, content: prevContent } : m));
    }
  };

  // ─── Context menu actions ───
  const ctxCopy = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.msgId);
    if (msg) navigator.clipboard.writeText(msg.content);
    setContextMenu(null);
  };

  const ctxReply = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.msgId);
    if (msg) { setReplyTo(msg); inputRef.current?.focus(); }
    setContextMenu(null);
  };

  const ctxPin = async () => {
    if (!contextMenu) return;
    const msgId = contextMenu.msgId;
    setContextMenu(null);

    const url = selectedGroup
      ? `/api/athlete/groups/messages/${msgId}/pin`
      : `/api/athlete/messages/pin/${msgId}`;

    try {
      const res = await offlineFetch(url, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, pinned: updated.pinned } : m));
      }
    } catch { /* ignore */ }
  };

  const ctxImportant = async () => {
    if (!contextMenu) return;
    const msgId = contextMenu.msgId;
    setContextMenu(null);

    const url = selectedGroup
      ? `/api/athlete/groups/messages/${msgId}/important`
      : `/api/athlete/messages/important/${msgId}`;

    try {
      const res = await offlineFetch(url, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, important: updated.important } : m));
      }
    } catch { /* ignore */ }
  };

  const ctxEdit = () => {
    if (!contextMenu) return;
    const msg = messages.find((m) => m.id === contextMenu.msgId);
    if (!msg || msg.senderType !== "athlete") return;
    startEdit(msg);
    setContextMenu(null);
  };

  const ctxDelete = async () => {
    if (!contextMenu) return;
    const msgId = contextMenu.msgId;
    setContextMenu(null);
    if (!confirm("Supprimer ce message ? Cette action est irréversible.")) return;

    const url = selectedGroup
      ? `/api/athlete/groups/messages/${msgId}/delete`
      : `/api/athlete/messages/delete/${msgId}`;

    try {
      const res = await offlineFetch(url, { method: "DELETE" });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch { /* ignore */ }
  };

  // Create group
  const createGroup = async () => {
    if (groupMemberIds.length < 1) return;
    try {
      const res = await fetch("/api/athlete/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() || undefined, memberIds: groupMemberIds }),
      });
      if (res.ok) {
        const group = await res.json();
        setShowGroupModal(false);
        setGroupName("");
        setGroupMemberIds([]);
        // Auto-select the new group
        setSelectedGroup({ id: group.id, name: group.name, isGroup: true, members: group.members, lastMessage: null, unread: 0 });
        setSelectedProId(null);
        setSelectedPro(null);
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Reaction handlers ───
  const openReactionPicker = (msgId: string, e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setReactionPos({ x: rect.left, y: rect.top - 50 });
    setReactionMsgId(msgId);
  };

  const handlePointerDown = (msgId: string, e: React.PointerEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setReactionPos({ x: rect.left, y: rect.top - 50 });
      setReactionMsgId(msgId);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    setReactionMsgId(null);
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    // Optimistic update
    const currentReactions = msg.reactions || [];
    const existing = currentReactions.find((r) => r.by === "me" && r.emoji === emoji);
    const optimistic = existing
      ? currentReactions.filter((r) => !(r.by === "me" && r.emoji === emoji))
      : [...currentReactions.filter((r) => r.by !== "me"), { by: "me", emoji }];
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reactions: optimistic } : m));

    const url = selectedGroup
      ? `/api/athlete/groups/messages/${msgId}/react`
      : `/api/athlete/messages/${msgId}/react`;

    try {
      const res = await offlineFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reactions: data.reactions } : m));
      }
    } catch { /* SSE will sync */ }
  };

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionMsgId) return;
    const handler = () => setReactionMsgId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [reactionMsgId]);

  // ─── Emoji picker: insert into input ───
  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Close hamburger menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Open contact profile panel
  const openProfile = () => {
    if (!selectedProId) return;
    setMenuOpen(false);
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileData(null);
    fetch(`/api/athlete/contact/${selectedProId}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setProfileData(d); })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  };

  const startVisio = () => {
    if (selectedGroup) {
      openVisioRoom(buildVisioGroupRoom(selectedGroup.id));
      return;
    }
    if (!selectedProId || !myAthleteId) return;
    openVisioRoom(buildVisioPairRoom("athlete", myAthleteId, "pro", selectedProId));
  };

  // Delete conversation
  const deleteConversation = async () => {
    setMenuOpen(false);
    const label = selectedGroup
      ? `le groupe ${selectedGroup.name || "sans nom"}`
      : `la conversation avec ${selectedPro?.prenom} ${selectedPro?.nom}`;
    if (!confirm(`Supprimer ${label} ? Tous les messages seront supprimés.`)) return;

    try {
      if (selectedGroup) {
        // Delete all group messages then the group itself
        for (const msg of messages) {
          await offlineFetch(`/api/athlete/groups/messages/${msg.id}/delete`, { method: "DELETE" }).catch(() => {});
        }
      } else if (selectedProId) {
        for (const msg of messages) {
          if (msg.senderType === "athlete") {
            await offlineFetch(`/api/athlete/messages/delete/${msg.id}`, { method: "DELETE" }).catch(() => {});
          }
        }
      }
    } catch { /* ignore */ }
    setSelectedProId(null);
    setSelectedPro(null);
    setSelectedGroup(null);
    setMessages([]);
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const getDateLabel = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Hier";
    return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  const formatLastSeen = (ts: number | null): string => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Vu à l'instant";
    if (diff < 3600_000) return `Vu il y a ${Math.floor(diff / 60_000)} min`;
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return `Vu aujourd'hui à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Vu hier à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    return `Vu le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getInitials = (pro: ProInfo) => `${pro.prenom?.[0] || ""}${pro.nom?.[0] || ""}`.toUpperCase();

  const filteredConvs = search.trim()
    ? conversations.filter((c) => `${c.pro.prenom} ${c.pro.nom}`.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const filteredGroups = search.trim()
    ? groupConversations.filter((g) => (g.name || "").toLowerCase().includes(search.toLowerCase()))
    : groupConversations;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0) + groupConversations.reduce((sum, g) => sum + g.unread, 0);

  const hasActiveChat = !!selectedProId || !!selectedGroup;

  // Helper: find sender name for group messages
  const getSenderName = (msg: Message) => {
    if (msg.senderType === "athlete") return null;
    if (!selectedGroup || !msg.senderProId) return "Pro";
    const member = selectedGroup.members.find((m) => m.id === msg.senderProId);
    return member ? `${member.prenom} ${member.nom}` : "Pro";
  };

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${hasActiveChat ? styles.sidebarHiddenMobile : ""}`}>
        <div className={styles.sidebarHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/dashboard/athlete")}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className={styles.sidebarTitle}>
            Messages
            {totalUnread > 0 && <span className={styles.unreadBadgeTotal}>{totalUnread}</span>}
          </h2>
          <button className={styles.newGroupBtn} title="Nouveau groupe" onClick={() => { setShowGroupModal(true); setGroupName(""); setGroupMemberIds([]); fetchConnectedPros(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
          </button>
        </div>

        <div className={styles.searchWrap}>
          <svg className={styles.searchIco} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            className={styles.searchInput}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.convList}>
          {loadingConvs && <div className={styles.loadingText}>Chargement...</div>}
          {!loadingConvs && filteredConvs.length === 0 && filteredGroups.length === 0 && (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <p>Aucune conversation</p>
              <span>Connectez-vous à un professionnel pour commencer</span>
            </div>
          )}

          {/* Group conversations */}
          {filteredGroups.map((group) => (
            <button
              key={`group-${group.id}`}
              className={`${styles.convItem} ${selectedGroup?.id === group.id ? styles.convItemActive : ""}`}
              onClick={() => selectGroupConversation(group)}
            >
              <div className={`${styles.convAvatar} ${styles.groupAvatar}`}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className={styles.convInfo}>
                <div className={styles.convName}>{group.name || "Groupe"}</div>
                <div className={styles.convSpec}>{group.members.length} membre{group.members.length > 1 ? "s" : ""}</div>
                {group.lastMessage && (
                  <div className={styles.convPreview}>
                    {group.lastMessage.isMe && <span className={styles.convYou}>Vous : </span>}
                    {!group.lastMessage.isMe && group.lastMessage.senderName && <span className={styles.convYou}>{group.lastMessage.senderName} : </span>}
                    {group.lastMessage.content.slice(0, 40)}{group.lastMessage.content.length > 40 ? "..." : ""}
                  </div>
                )}
              </div>
              <div className={styles.convMeta}>
                {group.lastMessage && <span className={styles.convTime}>{formatTime(group.lastMessage.createdAt)}</span>}
                {group.unread > 0 && <span className={styles.unreadBadge}>{group.unread}</span>}
              </div>
            </button>
          ))}

          {/* 1:1 conversations */}
          {filteredConvs.map((conv) => (
            <button
              key={conv.proId}
              className={`${styles.convItem} ${selectedProId === conv.proId ? styles.convItemActive : ""}`}
              onClick={() => selectConversation(conv)}
            >
              <div className={styles.convAvatar}>
                {conv.pro.avatarUrl ? (
                  <img src={conv.pro.avatarUrl} alt="" />
                ) : (
                  <span>{getInitials(conv.pro)}</span>
                )}
              </div>
              <div className={styles.convInfo}>
                <div className={styles.convName}>{conv.pro.prenom} {conv.pro.nom}</div>
                {conv.pro.specialite && <div className={styles.convSpec}>{conv.pro.specialite}</div>}
                {conv.lastMessage && (
                  <div className={styles.convPreview}>
                    {conv.lastMessage.isMe && <span className={styles.convYou}>Vous : </span>}
                    {conv.lastMessage.content.slice(0, 50)}{conv.lastMessage.content.length > 50 ? "..." : ""}
                  </div>
                )}
              </div>
              <div className={styles.convMeta}>
                {conv.lastMessage && <span className={styles.convTime}>{formatTime(conv.lastMessage.createdAt)}</span>}
                {conv.unread > 0 && <span className={styles.unreadBadge}>{conv.unread}</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main className={`${styles.chat} ${!hasActiveChat ? styles.chatHiddenMobile : ""}`}>
        {!hasActiveChat ? (
          <div className={styles.chatEmpty}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <p>Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className={styles.chatHeader}>
              <button className={styles.chatBackBtn} onClick={() => { saveDraft(); setSelectedProId(null); setSelectedPro(null); setSelectedGroup(null); setMessages([]); setMenuOpen(false); setProfileOpen(false); setChatSearchOpen(false); setChatSearch(""); setContextMenu(null); setReplyTo(null); setEditingMsgId(null); setReactionMsgId(null); setHasMore(false); nextCursorRef.current = null; router.replace("/dashboard/athlete/messagerie", { scroll: false }); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {selectedGroup ? (
                <>
                  <div className={`${styles.chatHeaderAvatar} ${styles.groupAvatar}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div className={styles.chatHeaderInfo}>
                    <div className={styles.chatHeaderName}>{selectedGroup.name || "Groupe"}</div>
                    <div className={styles.chatHeaderSpec}>{selectedGroup.members.map((m) => m.prenom).join(", ")}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.chatHeaderAvatar}>
                    {selectedPro?.avatarUrl ? (
                      <img src={selectedPro.avatarUrl} alt="" />
                    ) : (
                      <span>{selectedPro ? getInitials(selectedPro) : ""}</span>
                    )}
                  </div>
                  <div className={styles.chatHeaderInfo}>
                    <div className={styles.chatHeaderName}>{selectedPro?.prenom} {selectedPro?.nom}</div>
                    <div className={styles.chatHeaderStatus}>
                      {peerPresence.online ? (
                        <><span className={styles.onlineDot} /> En ligne</>
                      ) : peerPresence.lastSeen ? (
                        <span className={styles.lastSeenText}>{formatLastSeen(peerPresence.lastSeen)}</span>
                      ) : (
                        <span className={styles.lastSeenText}>{selectedPro?.specialite || "Professionnel"}</span>
                      )}
                    </div>
                  </div>
                </>
              )}
              <button
                className={styles.chatHeaderBtn}
                style={{ marginLeft: "auto" }}
                title="Démarrer une visio"
                onClick={startVisio}
                disabled={!selectedGroup && (!selectedProId || !myAthleteId)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              </button>
              <div style={{ position: "relative" }} ref={menuRef}>
                <button className={`${styles.chatHeaderBtn} ${menuOpen ? styles.chatHeaderBtnActive : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className={styles.headerMenu}>
                    <button className={styles.headerMenuItem} onClick={() => { setMenuOpen(false); setChatSearchOpen((v) => !v); if (chatSearchOpen) setChatSearch(""); }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Rechercher
                    </button>
                    {!selectedGroup && selectedPro && (
                      <button className={styles.headerMenuItem} onClick={openProfile}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        Voir le profil
                      </button>
                    )}
                    <div className={styles.headerMenuDivider} />
                    <button className={`${styles.headerMenuItem} ${styles.headerMenuItemDanger}`} onClick={deleteConversation}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      Supprimer la conversation
                    </button>
                  </div>
                )}
              </div>
            </div>

            {chatSearchOpen && (
              <div className={styles.chatSearchBar}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  className={styles.chatSearchInput}
                  type="text"
                  placeholder="Rechercher dans la conversation…"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  autoFocus
                />
                {chatSearch && (
                  <span className={styles.chatSearchCount}>
                    {messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase())).length} résultat{messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase())).length !== 1 ? "s" : ""}
                  </span>
                )}
                <button className={styles.chatSearchClose} onClick={() => { setChatSearchOpen(false); setChatSearch(""); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            {/* Pinned / Important messages bar */}
            {(() => {
              const pinned = messages.filter((m) => m.pinned);
              const important = messages.filter((m) => m.important && !m.pinned);
              if (pinned.length === 0 && important.length === 0) return null;
              return (
                <div className={styles.pinnedBar}>
                  {pinned.map((m) => (
                    <div key={m.id} className={styles.pinnedItem} onClick={() => { const el = document.getElementById(`msg-${m.id}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/></svg>
                      <span className={styles.pinnedItemText}>{m.content.slice(0, 60)}{m.content.length > 60 ? "…" : ""}</span>
                    </div>
                  ))}
                  {important.map((m) => (
                    <div key={m.id} className={`${styles.pinnedItem} ${styles.importantItem}`} onClick={() => { const el = document.getElementById(`msg-${m.id}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <span className={styles.pinnedItemText}>{m.content.slice(0, 60)}{m.content.length > 60 ? "…" : ""}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Messages */}
            <div className={styles.chatMessages} ref={chatContainerRef}>
              {loadingOlder && <div className={styles.loadingOlder}>Chargement des messages précédents…</div>}
              {!loadingOlder && hasMore && <div className={styles.loadMoreHint}>↑ Scrollez pour charger plus</div>}
              {loadingMsgs && <div className={styles.loadingText}>Chargement...</div>}
              {!loadingMsgs && messages.length === 0 && (
                <div className={styles.chatStart}>
                  {selectedGroup ? (
                    <>
                      <p>Début du groupe {selectedGroup.name}</p>
                      <span>Envoyez un message pour commencer</span>
                    </>
                  ) : (
                    <>
                      <p>Début de la conversation avec {selectedPro?.prenom} {selectedPro?.nom}</p>
                      <span>Envoyez un message pour commencer</span>
                    </>
                  )}
                </div>
              )}
              {(chatSearch.trim()
                ? messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase()))
                : messages
              ).map((msg, idx, arr) => {
                const reactions = msg.reactions || [];
                const repliedMsg = msg.replyToId ? messages.find((m) => m.id === msg.replyToId) : null;
                const isSending = msg._status === "sending";
                const isFailed = msg._status === "failed";
                const isQueued = msg._status === "queued";
                const isOptimistic = !!(msg._tempId);
                const prevMsg = idx > 0 ? arr[idx - 1] : null;
                const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className={styles.chatDateSep}>{getDateLabel(msg.createdAt)}</div>
                    )}
                  <div
                    id={`msg-${msg.id}`}
                    className={`${styles.msgRow} ${msg.senderType === "athlete" ? styles.msgMe : styles.msgThem} ${isSending ? styles.msgRowSending : ""} ${isFailed ? styles.msgRowFailed : ""}`}
                  >
                    <div
                      className={`${styles.msgBubble} ${msg.pinned ? styles.msgPinned : ""} ${msg.important ? styles.msgImportant : ""} ${isSending ? styles.msgBubbleSending : ""} ${isFailed ? styles.msgBubbleFailed : ""}`}
                      onPointerDown={isOptimistic ? undefined : (e) => handlePointerDown(msg.id, e)}
                      onPointerUp={isOptimistic ? undefined : handlePointerUp}
                      onPointerLeave={isOptimistic ? undefined : handlePointerUp}
                      onDoubleClick={isOptimistic ? undefined : (e) => openReactionPicker(msg.id, e)}
                      onContextMenu={isOptimistic ? undefined : (e) => { e.preventDefault(); setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY }); }}
                    >
                      {repliedMsg && (
                        <div className={styles.replyQuote}>
                          <span className={styles.replyQuoteAuthor}>
                            {repliedMsg.senderType === "athlete" ? "Vous" : (selectedPro ? selectedPro.prenom : "Pro")}
                          </span>
                          <span className={styles.replyQuoteText}>
                            {repliedMsg.content.slice(0, 80)}{repliedMsg.content.length > 80 ? "…" : ""}
                          </span>
                        </div>
                      )}
                      {selectedGroup && msg.senderType === "pro" && (
                        <div className={styles.msgSender}>{getSenderName(msg)}</div>
                      )}
                      {editingMsgId === msg.id ? (
                        <div className={styles.editInline}>
                          <textarea
                            ref={editInputRef}
                            className={styles.editTextarea}
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            rows={1}
                          />
                          <div className={styles.editActions}>
                            <button className={styles.editCancelBtn} onClick={cancelEdit}>Annuler</button>
                            <button className={styles.editSaveBtn} onClick={saveEdit} disabled={!editingContent.trim()}>Enregistrer</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.msgContent}><MessageContent content={msg.content} /></div>
                          {msg.editedAt && <span className={styles.editedBadge}>(modifié)</span>}
                        </>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <AttachmentBubble
                          attachments={msg.attachments}
                          getUrl={(fp) => fp}
                          isMe={msg.senderType === "athlete"}
                        />
                      )}
                      <div className={styles.msgTime}>
                        {isSending && (
                          <span className={styles.msgSendingIndicator}>
                            <svg className={styles.msgSendingSpinner} viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/></svg>
                            <span className={styles.msgSendingLabel}>Envoi…</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className={styles.msgFailedIndicator}>
                            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="9"/><line x1="8" y1="11" x2="8.01" y2="11"/></svg>
                            <span className={styles.msgFailedLabel}>Échec</span>
                            <button className={styles.msgRetryBtn} onClick={() => retryMessage(msg._tempId!)}>Réessayer</button>
                            <button className={styles.msgDismissBtn} onClick={() => dismissFailedMessage(msg._tempId!)}>✕</button>
                          </span>
                        )}
                        {isQueued && (
                          <span className={styles.msgSendingIndicator}>
                            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><polyline points="8 4 8 8 11 10"/></svg>
                            <span className={styles.msgSendingLabel}>En attente</span>
                          </span>
                        )}
                        {!isOptimistic && formatTime(msg.createdAt)}
                      </div>
                    </div>
                    {!isOptimistic && reactions.length > 0 && (
                      <div className={styles.msgReactions}>
                        {reactions.map((r, i) => (
                          <button key={i} className={styles.reactionBadge} onClick={() => toggleReaction(msg.id, r.emoji)}>
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    {reactionMsgId === msg.id && (
                      <div
                        className={styles.reactionPicker}
                        style={{ left: reactionPos.x, top: reactionPos.y }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {QUICK_EMOJIS.map((em) => (
                          <button key={em} className={styles.reactionPickerBtn} onClick={() => toggleReaction(msg.id, em)}>
                            {em}
                          </button>
                        ))}
                        <button className={styles.reactionPickerBtn} title="Répondre" onClick={() => { setReplyTo(msg); setReactionMsgId(null); inputRef.current?.focus(); }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                        </button>
                        {msg.senderType === "athlete" && (
                          <button className={styles.reactionPickerBtn} title="Modifier" onClick={() => startEdit(msg)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  </React.Fragment>
                );
              })}
              {remoteTyping && selectedProId && (
                <div className={styles.typingIndicator}>
                  <div className={styles.typingDots}>
                    <span /><span /><span />
                  </div>
                  <span>{selectedPro?.prenom} est en train d&apos;écrire…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ═══ Context menu ═══ */}
            {contextMenu && (
              <div
                ref={ctxRef}
                className={styles.ctxMenu}
                style={{ top: contextMenu.y, left: contextMenu.x }}
              >
                <button className={styles.ctxItem} onClick={ctxCopy}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copier
                </button>
                <button className={styles.ctxItem} onClick={ctxReply}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                  Répondre
                </button>
                <button className={styles.ctxItem} onClick={ctxPin}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/></svg>
                  {messages.find((m) => m.id === contextMenu.msgId)?.pinned ? "Désépingler" : "Épingler"}
                </button>
                <button className={styles.ctxItem} onClick={ctxImportant}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {messages.find((m) => m.id === contextMenu.msgId)?.important ? "Retirer important" : "Important"}
                </button>
                {messages.find((m) => m.id === contextMenu.msgId)?.senderType === "athlete" && (
                  <>
                    <div className={styles.ctxDivider} />
                    <button className={styles.ctxItem} onClick={ctxEdit}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Modifier
                    </button>
                    <button className={`${styles.ctxItem} ${styles.ctxItemDanger}`} onClick={ctxDelete}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Profile panel */}
            {profileOpen && selectedPro && !selectedGroup && (
              <div className={styles.profilePanel}>
                <div className={styles.profileHeader}>
                  <span className={styles.profileHeaderTitle}>Profil du contact</span>
                  <button className={styles.profileCloseBtn} onClick={() => setProfileOpen(false)}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                {profileLoading ? (
                  <div className={styles.profileLoading}>Chargement…</div>
                ) : profileData ? (
                  <div className={styles.profileBody}>
                    <div className={styles.profileAvatarSection}>
                      <div className={styles.profileAvatar}>
                        {profileData.avatarUrl ? (
                          <img src={profileData.avatarUrl} alt="" className={styles.profileAvatarImg} />
                        ) : (
                          <span>{getInitials(profileData)}</span>
                        )}
                      </div>
                      <div className={styles.profileName}>{profileData.prenom} {profileData.nom}</div>
                      <div className={styles.profileSpec}>{profileData.specialite || "Professionnel"}</div>
                    </div>

                    <div className={styles.profileSection}>
                      <div className={styles.profileSectionTitle}>Informations</div>
                      {profileData.email && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Email</div>
                            <div className={styles.profileRowValue}>{profileData.email}</div>
                          </div>
                        </div>
                      )}
                      {profileData.telephone && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Téléphone</div>
                            <div className={styles.profileRowValue}>{profileData.telephone}</div>
                          </div>
                        </div>
                      )}
                      {profileData.specialite && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Spécialité</div>
                            <div className={styles.profileRowValue}>{profileData.specialite}</div>
                          </div>
                        </div>
                      )}
                      {profileData.adresseCabinet && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Cabinet</div>
                            <div className={styles.profileRowValue}>{profileData.adresseCabinet}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.profileSection}>
                      <div className={styles.profileSectionTitle}>Conversation</div>
                      <div className={styles.profileStats}>
                        <div className={styles.profileStat}>
                          <div className={styles.profileStatValue}>{profileData.messageCount ?? 0}</div>
                          <div className={styles.profileStatLabel}>Messages</div>
                        </div>
                        <div className={styles.profileStat}>
                          <div className={styles.profileStatValue}>{profileData.mediaCount ?? 0}</div>
                          <div className={styles.profileStatLabel}>Médias</div>
                        </div>
                      </div>
                      {profileData.connectedSince && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Connecté depuis</div>
                            <div className={styles.profileRowValue}>{new Date(profileData.connectedSince).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                          </div>
                        </div>
                      )}
                      {profileData.createdAt && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Membre depuis</div>
                            <div className={styles.profileRowValue}>{new Date(profileData.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.profileLoading}>Données indisponibles</div>
                )}
              </div>
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <div className={styles.replyBar}>
                <div className={styles.replyBarContent}>
                  <svg className={styles.replyBarIcon} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                  <div className={styles.replyBarText}>
                    <span className={styles.replyBarAuthor}>
                      {replyTo.senderType === "athlete" ? "Vous" : (selectedPro ? selectedPro.prenom : "Pro")}
                    </span>
                    <span className={styles.replyBarMsg}>
                      {replyTo.content.slice(0, 100)}{replyTo.content.length > 100 ? "…" : ""}
                    </span>
                  </div>
                </div>
                <button className={styles.replyBarClose} onClick={() => setReplyTo(null)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className={styles.pendingFiles}>
                {pendingFiles.map((file, i) => (
                  <div key={i} className={styles.pendingFile}>
                    <div className={styles.pendingFileIcon}>
                      {file.type.startsWith("image/") ? (
                        <img src={URL.createObjectURL(file)} alt="" className={styles.pendingFileThumb} />
                      ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      )}
                    </div>
                    <div className={styles.pendingFileInfo}>
                      <span className={styles.pendingFileName}>{file.name}</span>
                      <span className={styles.pendingFileSize}>{formatFileSize(file.size)}</span>
                    </div>
                    <button className={styles.pendingFileRemove} onClick={() => removePendingFile(i)}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input / Recording bar */}
            {isRecording ? (
              <div className={styles.chatInput}>
                <div className={styles.recordingBar}>
                  <button className={styles.recordingCancelBtn} onClick={cancelRecording} title="Annuler">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                  </button>
                  <div className={styles.recordingIndicator}>
                    <span className={styles.recordingDot} />
                    <span className={styles.recordingTimer}>{formatRecordingTime(recordingTime)}</span>
                  </div>
                  <button className={styles.recordingSendBtn} onClick={stopAndSendRecording} title="Envoyer le vocal">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.chatInput}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                />
                <button className={styles.attachBtn} title="Joindre un fichier" onClick={() => fileInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <div style={{ position: "relative" }} ref={emojiRef}>
                  <button className={`${styles.emojiBtn} ${emojiOpen ? styles.emojiBtnActive : ""}`} title="Emoji" onClick={() => setEmojiOpen(!emojiOpen)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                  {emojiOpen && (
                    <div className={styles.emojiPicker}>
                      <div className={styles.emojiTabs}>
                        {EMOJI_CATEGORIES.map((cat, ci) => (
                          <button key={ci} className={`${styles.emojiTab} ${emojiCat === ci ? styles.emojiTabActive : ""}`} onClick={() => setEmojiCat(ci)}>{cat.label}</button>
                        ))}
                      </div>
                      <div className={styles.emojiGrid}>
                        {EMOJI_CATEGORIES[emojiCat].emojis.map((em, ei) => (
                          <button key={ei} className={styles.emojiItem} onClick={() => insertEmoji(em)}>{em}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <textarea
                  ref={inputRef}
                  className={styles.inputField}
                  placeholder="Écrire un message..."
                  value={input}
                  onChange={(e) => { setInput(e.target.value); sendTypingSignal(); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                {input.trim() || pendingFiles.length > 0 ? (
                  <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {uploading ? (
                      <svg className={styles.spinIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    )}
                  </button>
                ) : (
                  <button className={styles.micBtn} onClick={startRecording} title="Message vocal">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="1" width="6" height="12" rx="3" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Group creation modal */}
      {showGroupModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGroupModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nouveau groupe</h3>
              <button className={styles.modalClose} onClick={() => setShowGroupModal(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <input
                className={styles.modalInput}
                placeholder="Nom du groupe (optionnel)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className={styles.modalLabel}>Sélectionnez les professionnels :</div>
              <div className={styles.modalMemberList}>
                {connectedPros.length === 0 && <div className={styles.modalEmpty}>Aucun professionnel connecté</div>}
                {connectedPros.map((pro) => {
                  const selected = groupMemberIds.includes(pro.id);
                  return (
                    <button
                      key={pro.id}
                      className={`${styles.modalMemberItem} ${selected ? styles.modalMemberSelected : ""}`}
                      onClick={() => {
                        setGroupMemberIds((prev) =>
                          selected ? prev.filter((id) => id !== pro.id) : [...prev, pro.id]
                        );
                      }}
                    >
                      <div className={styles.modalMemberAvatar}>
                        {pro.avatarUrl ? <img src={pro.avatarUrl} alt="" /> : <span>{getInitials(pro)}</span>}
                      </div>
                      <div className={styles.modalMemberInfo}>
                        <span>{pro.prenom} {pro.nom}</span>
                        {pro.specialite && <span className={styles.modalMemberSpec}>{pro.specialite}</span>}
                      </div>
                      <div className={`${styles.modalCheck} ${selected ? styles.modalCheckActive : ""}`}>
                        {selected && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowGroupModal(false)}>Annuler</button>
              <button className={styles.modalCreateBtn} onClick={createGroup} disabled={groupMemberIds.length < 1}>
                Créer ({groupMemberIds.length} sélectionné{groupMemberIds.length > 1 ? "s" : ""})
              </button>
            </div>
          </div>
        </div>
      )}

      <LegalFooter />
    </div>
  );
}
