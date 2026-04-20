"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import MessageContent from "@/components/MessageContent";
import AttachmentBubble, { type Attachment } from "@/components/AttachmentBubble";
import { offlineFetch } from "@/lib/offlineFetch";
import { buildVisioGroupRoom, buildVisioPairRoom, openVisioRoom } from "@/lib/visio";
import styles from "./page.module.scss";

/* ─── Types ─── */
interface ProInfo {
  id: string;
  nom: string;
  prenom: string;
  specialite: string | null;
  avatarPath: string | null;
}

interface ProProfile extends ProInfo {
  email?: string;
  telephone?: string;
  adresseCabinet?: string;
  createdAt?: string;
}

interface Conversation {
  proId: string;
  pro?: ProInfo;
  isGroup?: boolean;
  groupId?: string;
  name?: string;
  members?: (ProInfo & { role: string })[];
  athlete?: { id: string; name: string } | null;
  lastMessage: { content: string; createdAt: string; isMe: boolean; senderName?: string } | null;
  unread: number;
}

interface Reaction { proId: string; emoji: string }

interface Message {
  id: string;
  content: string;
  senderProId: string;
  senderPro: ProInfo;
  reactions: Reaction[];
  pinned: boolean;
  important: boolean;
  replyToId: string | null;
  attachments?: Attachment[];
  createdAt: string;
  editedAt?: string | null;
  _status?: "sending" | "failed" | "queued";
  _tempId?: string;
}

interface ContextMenu {
  msgId: string;
  x: number;
  y: number;
}

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀","😁","😂","🤣","😊","😇","😍","🤩","😘","😜","🤔","🤗","🤫","🤭","😏","😌","😴","🤤","😷","🤒","🤕","🤮","🥵","🥶","😱","😤","😡","🥺","😢","😭"] },
  { label: "Gestes", emojis: ["👍","👎","👏","🙌","🤝","💪","🤞","✌️","🤙","👊","✊","👋","🖐️","👌","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤎","💔","❣️","💯","🔥","⭐","✨","💫"] },
  { label: "Sport", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🏋️","🤸","🚴","🏊","🤽","🧘","🏃","🚶","💊","🩺","🩹","🏥","💉","🧬","🧪","📋","📈","🎯","🏆","🥇","🎖️"] },
];

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","�","👏"];

/* ─── Component ─── */
export default function MessageriePage() {
  const [myProId, setMyProId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPro, setSelectedPro] = useState<ProInfo | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; members: (ProInfo & { role: string })[]; athlete?: { id: string; name: string } | null } | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<{ id: string; name: string; sport?: string; avatarUrl?: string | null } | null>(null);
  const [athleteConversations, setAthleteConversations] = useState<{ athleteUserId: string; athlete: { id: string; name: string; sport?: string; avatarUrl?: string | null }; lastMessage: { content: string; createdAt: string; isMe: boolean } | null; unread: number }[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chatSearchRef = useRef<HTMLInputElement>(null);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Reactions
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Message editing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Reply
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // File attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drafts (persist text + files + reply across conversation switches)
  const draftsRef = useRef<Map<string, { text: string; files: File[]; replyTo: Message | null }>>(new Map());
  const getDraftKey = () => {
    if (selectedGroup) return `group:${selectedGroup.id}`;
    if (selectedPro) return `pro:${selectedPro.id}`;
    return null;
  };

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Typing indicator
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  // Presence / online status
  const [peerPresence, setPeerPresence] = useState<{ online: boolean; lastSeen: number | null }>({ online: false, lastSeen: null });

  // Browser notifications
  const prevUnreadRef = useRef<Map<string, number>>(new Map());
  const notifPermRef = useRef<NotificationPermission>("default");

  // Contacts directory
  const [sidebarTab, setSidebarTab] = useState<"messages" | "contacts">("messages");
  const [contacts, setContacts] = useState<{ athletes: any[]; professionals: any[] }>({ athletes: [], professionals: [] });
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<"all" | "athletes" | "pros">("all");

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase();

  const fixAvatar = (path: string | null) =>
    path;

  // Fetch current user ID
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.id) setMyProId(d.id); })
      .catch(() => {});
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      notifPermRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => { notifPermRef.current = p; });
      }
    }
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(() => {
    fetch("/api/messagerie/conversations")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setConversations(d); })
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Fetch athlete conversations
  const fetchAthleteConversations = useCallback(() => {
    fetch("/api/athlete-messages")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAthleteConversations(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchAthleteConversations(); }, [fetchAthleteConversations]);

  // Poll athlete messages when an athlete conversation is selected
  useEffect(() => {
    if (!selectedAthlete) return;
    const iv = setInterval(() => {
      fetch(`/api/athlete-messages/${selectedAthlete.id}`)
        .then(r => r.json())
        .then(d => {
          if (d.messages && Array.isArray(d.messages)) {
            setMessages(d.messages.map((m: any) => ({
              id: m.id, content: m.content, createdAt: m.createdAt, editedAt: m.editedAt,
              senderProId: m.senderType === "pro" ? myProId : m.athleteUserId,
              senderPro: m.senderType === "pro"
                ? { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null }
                : { id: m.athleteUserId, nom: "", prenom: selectedAthlete.name, specialite: null, avatarPath: null },
              reactions: [], pinned: false, important: false, replyToId: null,
            })));
          }
        })
        .catch(() => {});
      fetchAthleteConversations();
    }, 4000);
    return () => clearInterval(iv);
  }, [selectedAthlete, myProId, fetchAthleteConversations]);

  // After offline sync replay completes, refetch messages & clear queued optimistic entries
  useEffect(() => {
    const onSyncComplete = () => {
      setMessages(prev => prev.filter(m => m._status !== "queued"));
      fetchConversations();
      if (selectedGroup) fetchMessages(selectedGroup.id, selectedGroup.id);
      else if (selectedPro) fetchMessages(selectedPro.id);
    };
    window.addEventListener("tuatha-sync-complete", onSyncComplete);
    return () => window.removeEventListener("tuatha-sync-complete", onSyncComplete);
  });

  // Real-time conversation updates via SSE
  useSSE<Conversation[]>({
    url: "/api/messagerie/stream",
    onMessage: (data) => {
      if (!Array.isArray(data)) return;
      setConversations(data);
      setLoadingConvs(false);

      // Push notifications are now handled server-side via Web Push API (see /api/reseau/messages POST)
      // Update tracked unread counts
      const map = new Map<string, number>();
      for (const conv of data) map.set(conv.proId, conv.unread);
      prevUnreadRef.current = map;
    },
  });

  // Fetch contacts directory
  const fetchContacts = useCallback(() => {
    setContactsLoading(true);
    fetch("/api/messagerie/contacts")
      .then((r) => r.json())
      .then((d) => { if (d.athletes) setContacts(d); })
      .catch(() => {})
      .finally(() => setContactsLoading(false));
  }, []);

  useEffect(() => {
    if (sidebarTab === "contacts" && contacts.athletes.length === 0 && contacts.professionals.length === 0) {
      fetchContacts();
    }
  }, [sidebarTab, contacts, fetchContacts]);

  // Start conversation with a pro from the directory
  const startConversationWithPro = (pro: ProInfo) => {
    setSelectedPro(pro);
    setMessages([]);
    setHasMore(false);
    setNextCursor(null);
    setSidebarTab("messages");
    setLoadingMsgs(true);
    fetch(`/api/reseau/messages?proId=${pro.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages && Array.isArray(d.messages)) {
          setMessages(d.messages);
          setHasMore(d.hasMore ?? false);
          setNextCursor(d.nextCursor ?? null);
        } else if (Array.isArray(d)) {
          setMessages(d);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  };

  // Filter contacts
  const filteredAthletes = contactSearch
    ? contacts.athletes.filter((a: any) => a.name.toLowerCase().includes(contactSearch.toLowerCase()) || a.sport?.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts.athletes;

  const filteredPros = contactSearch
    ? contacts.professionals.filter((p: any) => `${p.prenom} ${p.nom}`.toLowerCase().includes(contactSearch.toLowerCase()) || p.specialite?.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts.professionals;

  // Fetch messages for selected conversation (1:1 or group)
  const fetchMessages = useCallback((proId: string, conversationId?: string) => {
    const url = conversationId
      ? `/api/reseau/messages?conversationId=${conversationId}`
      : `/api/reseau/messages?proId=${proId}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const serverMsgs: Message[] = d.messages && Array.isArray(d.messages) ? d.messages : Array.isArray(d) ? d : [];
        if (d.hasMore !== undefined) setHasMore(d.hasMore);
        if (d.nextCursor !== undefined) setNextCursor(d.nextCursor);
        setMessages(prev => {
          const pending = prev.filter(m => m._status === "failed" || m._status === "queued");
          return pending.length > 0 ? [...serverMsgs, ...pending] : serverMsgs;
        });
      })
      .catch(() => {});
  }, []);

  const selectConversation = (conv: Conversation) => {
    // Save current draft before switching
    const currentKey = getDraftKey();
    if (currentKey) {
      const currentText = input.trim() ? input : "";
      if (currentText || pendingFiles.length > 0 || replyTo) {
        draftsRef.current.set(currentKey, { text: input, files: [...pendingFiles], replyTo });
      } else {
        draftsRef.current.delete(currentKey);
      }
    }

    // Determine target key
    const targetKey = conv.isGroup && conv.groupId ? `group:${conv.groupId}` : `pro:${conv.proId}`;
    const draft = draftsRef.current.get(targetKey);

    // Restore draft or reset
    setInput(draft?.text || "");
    setPendingFiles(draft?.files || []);
    setReplyTo(draft?.replyTo || null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    setMessages([]);
    setHasMore(false);
    setNextCursor(null);
    setChatSearch("");
    setChatSearchOpen(false);
    setMenuOpen(false);
    setLoadingMsgs(true);
    setEditingMsgId(null);

    if (conv.isGroup && conv.groupId) {
      setSelectedPro(null);
      setSelectedGroup({ id: conv.groupId, name: conv.name || "Groupe", members: conv.members || [], athlete: conv.athlete });
      fetch(`/api/reseau/messages?conversationId=${conv.groupId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.messages && Array.isArray(d.messages)) {
            setMessages(d.messages);
            setHasMore(d.hasMore ?? false);
            setNextCursor(d.nextCursor ?? null);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMsgs(false));
    } else {
      setSelectedGroup(null);
      setSelectedPro(conv.pro || null);
      fetch(`/api/reseau/messages?proId=${conv.proId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.messages && Array.isArray(d.messages)) {
            setMessages(d.messages);
            setHasMore(d.hasMore ?? false);
            setNextCursor(d.nextCursor ?? null);
          } else if (Array.isArray(d)) {
            setMessages(d);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMsgs(false));
    }
    setConversations((prev) =>
      prev.map((c) => c.proId === conv.proId ? { ...c, unread: 0 } : c)
    );
  };

  // Load older messages (pagination)
  const loadOlderMessages = useCallback(() => {
    if ((!selectedPro && !selectedGroup) || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    const scrollEl = chatMessagesRef.current;
    const prevHeight = scrollEl?.scrollHeight || 0;
    const url = selectedGroup
      ? `/api/reseau/messages?conversationId=${selectedGroup.id}&before=${nextCursor}`
      : `/api/reseau/messages?proId=${selectedPro!.id}&before=${nextCursor}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages && Array.isArray(d.messages)) {
          setMessages((prev) => [...d.messages, ...prev]);
          setHasMore(d.hasMore ?? false);
          setNextCursor(d.nextCursor ?? null);
          requestAnimationFrame(() => {
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  }, [selectedPro, selectedGroup, nextCursor, loadingOlder]);

  // Real-time messages via SSE (replaces polling)
  // Merges new messages with existing ones (preserves older loaded pages)
  const sseEnabled = !!selectedPro || !!selectedGroup;
  const sseParams: Record<string, string> | undefined = selectedGroup
    ? { conversationId: selectedGroup.id }
    : selectedPro
      ? { proId: selectedPro.id }
      : undefined;
  useSSE<Message[]>({
    url: "/api/messagerie/stream",
    enabled: sseEnabled,
    params: sseParams,
    onMessage: (data) => {
      if (!Array.isArray(data)) return;
      setLoadingMsgs(false);
      setMessages((prev) => {
        if (prev.length === 0) return data;
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = data.filter((m) => !existingIds.has(m.id));
        const sseMap = new Map(data.map((m) => [m.id, m]));
        const updated = prev.map((m) => sseMap.get(m.id) ?? m);
        return newMsgs.length > 0 ? [...updated, ...newMsgs] : updated;
      });
    },
  });

  // ─── Typing indicator: send signal (throttled) ───
  const sendTypingSignal = useCallback(() => {
    if (!selectedPro && !selectedAthlete) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return; // throttle: max every 2.5s
    lastTypingSentRef.current = now;
    if (selectedPro) {
      fetch("/api/messagerie/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverProId: selectedPro.id }),
      }).catch(() => {});
    } else if (selectedAthlete) {
      fetch("/api/messagerie/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverProId: selectedAthlete.id }),
      }).catch(() => {});
    }
  }, [selectedPro, selectedAthlete]);

  // ─── Typing indicator: poll remote status ───
  useEffect(() => {
    if (!selectedPro) { setRemoteTyping(false); return; }
    let alive = true;
    const poll = () => {
      if (!alive) return;
      fetch(`/api/messagerie/typing?proId=${selectedPro.id}`)
        .then(r => r.json())
        .then(d => { if (alive) setRemoteTyping(!!d.typing); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, [selectedPro]);

  // Reset typing state on conversation switch
  useEffect(() => {
    setRemoteTyping(false);
    lastTypingSentRef.current = 0;
  }, [selectedPro?.id]);

  // ─── Presence: heartbeat (I'm online) ───
  useEffect(() => {
    const beat = () => fetch("/api/messagerie/presence", { method: "POST" }).catch(() => {});
    beat();
    const iv = setInterval(beat, 20000); // every 20s
    return () => clearInterval(iv);
  }, []);

  // ─── Presence: poll peer status ───
  useEffect(() => {
    if (!selectedPro) { setPeerPresence({ online: false, lastSeen: null }); return; }
    let alive = true;
    const poll = () => {
      if (!alive) return;
      fetch(`/api/messagerie/presence?proId=${selectedPro.id}`)
        .then(r => r.json())
        .then(d => { if (alive) setPeerPresence({ online: !!d.online, lastSeen: d.lastSeen ?? null }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 15000); // every 15s
    return () => { alive = false; clearInterval(iv); };
  }, [selectedPro]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (chatSearchOpen) chatSearchRef.current?.focus();
  }, [chatSearchOpen]);

  // Open profile panel
  const openProfile = () => {
    if (!selectedPro) return;
    setMenuOpen(false);
    setProfileOpen(true);
    setProfileLoading(true);
    fetch(`/api/pro/${selectedPro.id}`)
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
    if (selectedAthlete && myProId) {
      openVisioRoom(buildVisioPairRoom("athlete", selectedAthlete.id, "pro", myProId));
      return;
    }
    if (!selectedPro || !myProId) return;
    openVisioRoom(buildVisioPairRoom("pro", myProId, "pro", selectedPro.id));
  };

  // Delete conversation
  const deleteConversation = async () => {
    if (!selectedPro) return;
    if (!confirm(`Supprimer la conversation avec ${selectedPro.prenom} ${selectedPro.nom} ?`)) return;
    // Delete all messages between the two pros
    const msgs = messages;
    for (const msg of msgs) {
      await offlineFetch(`/api/reseau/messages/${msg.id}`, { method: "DELETE" }).catch(() => {});
    }
    setSelectedPro(null);
    setMessages([]);
    setMenuOpen(false);
    fetchConversations();
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

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionMsgId) return;
    const handler = (e: MouseEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) setReactionMsgId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [reactionMsgId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Insert emoji into input
  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setEmojiOpen(false);
  };

  // Toggle reaction on a message
  const toggleReaction = async (msgId: string, emoji: string) => {
    setReactionMsgId(null);
    setContextMenu(null);
    try {
      const res = await offlineFetch(`/api/reseau/messages/${msgId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const d = await res.json();
      console.log("[react] response:", res.status, d);
      if (d.reactions) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: d.reactions } : m));
      }
    } catch (err) {
      console.error("[react] error:", err);
    }
  };

  // Long-press handlers — opens context menu
  const onMsgPointerDown = (msgId: string, e: React.PointerEvent) => {
    const x = e.clientX; const y = e.clientY;
    longPressTimer.current = setTimeout(() => setContextMenu({ msgId, x, y }), 500);
  };
  const onMsgPointerUp = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // Context menu actions
  const ctxReply = () => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.msgId);
    if (msg) { setReplyTo(msg); inputRef.current?.focus(); }
    setContextMenu(null);
  };

  const ctxReact = () => {
    if (!contextMenu) return;
    setReactionMsgId(contextMenu.msgId);
    setContextMenu(null);
  };

  const ctxCopy = () => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.msgId);
    if (msg) navigator.clipboard.writeText(msg.content);
    setContextMenu(null);
  };

  const ctxToggleImportant = async () => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.msgId);
    if (!msg) return;
    setContextMenu(null);
    try {
      const res = await offlineFetch(`/api/reseau/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ important: !msg.important }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, important: !msg.important } : m));
      }
    } catch {}
  };

  const ctxTogglePin = async () => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.msgId);
    if (!msg) return;
    setContextMenu(null);
    try {
      const res = await offlineFetch(`/api/reseau/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !msg.pinned }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned: !msg.pinned } : m));
      }
    } catch {}
  };

  const ctxEdit = () => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.msgId);
    if (!msg || msg.senderProId !== myProId) return;
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
    setContextMenu(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEdit = async () => {
    if (!editingMsgId) return;
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    const originalMsg = messages.find(m => m.id === editingMsgId);
    if (originalMsg && trimmed === originalMsg.content) { setEditingMsgId(null); return; }
    try {
      const res = await offlineFetch(`/api/reseau/messages/${editingMsgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m));
      }
    } catch {}
    setEditingMsgId(null);
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditingContent("");
  };

  const ctxDelete = async () => {
    if (!contextMenu) return;
    const msgId = contextMenu.msgId;
    setContextMenu(null);
    if (!confirm("Supprimer ce message ? Cette action est irréversible.")) return;
    try {
      await offlineFetch(`/api/reseau/messages/${msgId}`, { method: "DELETE" });
      setMessages(prev => prev.filter(m => m.id !== msgId));
      fetchConversations();
    } catch {}
  };

  // File handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingFiles(prev => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Voice recording
  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (!selectedPro && !selectedGroup) return;
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
        // Cleanup timer
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recorder.start(100); // collect chunks every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 300) { // 5 min max
            stopAndSendRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      // Mic permission denied or not available
    }
  };

  const stopAndSendRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }

    // Wait for final data
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

    if (blob.size < 1000) return; // Too short, ignore

    // Determine file extension
    const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "weba";
    const filename = `vocal-${Date.now()}.${ext}`;
    const file = new File([blob], filename, { type: mimeType.split(";")[0] });

    // Send as voice message
    if (!selectedPro && !selectedGroup) return;

    const tempId = `_temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      content: "",
      senderProId: myProId,
      senderPro: { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null },
      reactions: [],
      pinned: false,
      important: false,
      replyToId: null,
      attachments: [{
        id: `_att_${Math.random().toString(36).slice(2)}`,
        filename,
        originalName: filename,
        mimeType: file.type,
        size: file.size,
        filePath: "",
      }],
      createdAt: new Date().toISOString(),
      _status: "sending",
      _tempId: tempId,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("receiverProId", selectedPro?.id || myProId);
      formData.append("files", file);
      const uploadRes = await fetch("/api/reseau/messages/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setUploading(false);
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
        return;
      }
      setUploading(false);

      const postBody: any = { attachments: uploadData.attachments };
      if (selectedGroup) { postBody.conversationId = selectedGroup.id; }
      else if (selectedPro) { postBody.receiverProId = selectedPro.id; }

      const res = await offlineFetch("/api/reseau/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });

      const vData = await res.clone().json().catch(() => null);
      if (vData?.queued) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "queued" as const } : m));
        return;
      }

      if (!res.ok) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
        return;
      }

      setMessages(prev => prev.filter(m => m._tempId !== tempId));
      if (selectedGroup) { fetchMessages(selectedGroup.id, selectedGroup.id); }
      else if (selectedPro) { fetchMessages(selectedPro.id); }
      fetchConversations();
    } catch {
      setUploading(false);
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Retry a failed optimistic message
  const retryMessage = async (tempId: string) => {
    const msg = messages.find(m => m._tempId === tempId);
    if (!msg || !selectedPro) return;
    // Reset to sending
    setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "sending" as const } : m));

    try {
      let attachments: any[] | undefined;
      // Re-upload files if message had attachments placeholder
      // (files are lost after failure, so attachments-only retry is not supported — only text)

      const res = await offlineFetch("/api/reseau/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverProId: selectedPro.id,
          content: msg.content || undefined,
          replyToId: msg.replyToId,
          attachments,
        }),
      });
      const rData = await res.clone().json().catch(() => null);
      if (rData?.queued) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "queued" as const } : m));
        return;
      }
      if (!res.ok) throw new Error("retry failed");
      // Remove temp, fetch real messages
      setMessages(prev => prev.filter(m => m._tempId !== tempId));
      fetchMessages(selectedPro.id);
      fetchConversations();
    } catch {
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
    }
  };

  // Dismiss a failed optimistic message
  const dismissFailedMessage = (tempId: string) => {
    setMessages(prev => prev.filter(m => m._tempId !== tempId));
  };

  // Create group conversation
  const createGroup = async () => {
    if (groupMemberIds.length < 2) return;
    try {
      const res = await fetch("/api/messagerie/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() || undefined, memberIds: groupMemberIds }),
      });
      if (res.ok) {
        const group = await res.json();
        setShowGroupModal(false);
        setGroupName("");
        setGroupMemberIds([]);
        // Select the new group
        setSelectedPro(null);
        setSelectedGroup({
          id: group.id,
          name: group.name || "Groupe",
          members: group.members.map((m: any) => ({ ...m.pro, role: m.role })),
          athlete: group.athlete,
        });
        setMessages([]);
        fetchConversations();
      }
    } catch {}
  };

  // Send message
  const sendMessage = async () => {
    // Handle athlete conversation separately
    if (selectedAthlete && input.trim()) {
      const content = input.trim();
      setInput("");
      const tempId = `_temp_${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId, content, senderProId: myProId,
        senderPro: { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null },
        reactions: [], pinned: false, important: false, replyToId: null,
        createdAt: new Date().toISOString(), _status: "sending", _tempId: tempId,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      try {
        const res = await fetch(`/api/athlete-messages/${selectedAthlete.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages(prev => prev.map(m => m._tempId === tempId ? { ...msg, senderProId: myProId, senderPro: { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null }, reactions: [], pinned: false, important: false, replyToId: null } : m));
          fetchAthleteConversations();
        } else {
          setMessages(prev => prev.filter(m => m._tempId !== tempId));
        }
      } catch {
        setMessages(prev => prev.filter(m => m._tempId !== tempId));
      }
      return;
    }

    if ((!input.trim() && pendingFiles.length === 0) || (!selectedPro && !selectedGroup)) return;
    const content = input.trim();
    const rId = replyTo?.id || null;
    const filesToSend = [...pendingFiles];
    setInput("");
    setReplyTo(null);
    setPendingFiles([]);
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Build optimistic message
    const tempId = `_temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      content: content || "",
      senderProId: myProId,
      senderPro: { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null },
      reactions: [],
      pinned: false,
      important: false,
      replyToId: rId,
      attachments: filesToSend.length > 0 ? filesToSend.map(f => ({
        id: `_att_${Math.random().toString(36).slice(2)}`,
        filename: f.name,
        originalName: f.name,
        mimeType: f.type,
        size: f.size,
        filePath: "",
      })) : undefined,
      createdAt: new Date().toISOString(),
      _status: "sending",
      _tempId: tempId,
    };

    // Inject optimistic message instantly
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      let attachments: any[] | undefined;

      // Upload files first if any
      if (filesToSend.length > 0) {
        setUploading(true);
        const formData = new FormData();
        formData.append("receiverProId", selectedPro?.id || myProId);
        filesToSend.forEach(f => formData.append("files", f));
        const uploadRes = await fetch("/api/reseau/messages/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setUploading(false);
          setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
          return;
        }
        attachments = uploadData.attachments;
        setUploading(false);
      }

      const postBody: any = {
        content: content || undefined,
        replyToId: rId,
        attachments,
      };
      if (selectedGroup) {
        postBody.conversationId = selectedGroup.id;
      } else if (selectedPro) {
        postBody.receiverProId = selectedPro.id;
      }

      const res = await offlineFetch("/api/reseau/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });

      // Queued for offline sync
      const resData = await res.clone().json().catch(() => null);
      if (resData?.queued) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "queued" as const } : m));
        return;
      }

      if (!res.ok) {
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
        return;
      }

      // Success: remove optimistic, clear draft, fetch real messages
      const draftKey = getDraftKey();
      if (draftKey) draftsRef.current.delete(draftKey);
      setMessages(prev => prev.filter(m => m._tempId !== tempId));
      if (selectedGroup) {
        fetchMessages(selectedGroup.id, selectedGroup.id);
      } else if (selectedPro) {
        fetchMessages(selectedPro.id);
      }
      fetchConversations();
    } catch {
      setUploading(false);
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _status: "failed" as const } : m));
    }
  };

  // Format time
  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (isYesterday) return "Hier";
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const formatMsgTime = (d: string) =>
    new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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

  // Date separators
  const getDateLabel = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Hier";
    return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  // Filter conversations
  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const name = c.isGroup ? (c.name || "").toLowerCase() : `${c.pro?.prenom ?? ""} ${c.pro?.nom ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Filter messages by chat search
  const filteredMessages = chatSearch.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages;

  return (
    <div className={styles.container}>
      {/* ═══ Left sidebar ═══ */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          {/* Tabs */}
          <div className={styles.sidebarTabs}>
            <button className={`${styles.sidebarTab} ${sidebarTab === "messages" ? styles.sidebarTabActive : ""}`} onClick={() => setSidebarTab("messages")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Messages
              {(conversations.some(c => c.unread > 0) || athleteConversations.some(ac => ac.unread > 0)) && <span className={styles.tabBadge}>{conversations.reduce((a, c) => a + c.unread, 0) + athleteConversations.reduce((a, c) => a + c.unread, 0)}</span>}
            </button>
            <button className={`${styles.sidebarTab} ${sidebarTab === "contacts" ? styles.sidebarTabActive : ""}`} onClick={() => setSidebarTab("contacts")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Contacts
            </button>
          </div>

          {/* Search bar - messages */}
          {sidebarTab === "messages" && (
            <div className={styles.searchBarRow}>
              <div className={styles.searchBar}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une conversation..." />
              </div>
              <button className={styles.newGroupBtn} title="Nouveau groupe" onClick={() => { setShowGroupModal(true); setGroupName(""); setGroupMemberIds([]); if (contacts.professionals.length === 0) fetchContacts(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
              </button>
            </div>
          )}

          {/* Search bar - contacts */}
          {sidebarTab === "contacts" && (
            <>
              <div className={styles.searchBar}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input className={styles.searchInput} value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Rechercher un contact..." />
              </div>
              <div className={styles.contactFilters}>
                <button className={`${styles.contactFilterBtn} ${contactFilter === "all" ? styles.contactFilterActive : ""}`} onClick={() => setContactFilter("all")}>Tous</button>
                <button className={`${styles.contactFilterBtn} ${contactFilter === "athletes" ? styles.contactFilterActive : ""}`} onClick={() => setContactFilter("athletes")}>Patients</button>
                <button className={`${styles.contactFilterBtn} ${contactFilter === "pros" ? styles.contactFilterActive : ""}`} onClick={() => setContactFilter("pros")}>Professionnels</button>
              </div>
            </>
          )}
        </div>

        {/* ─── Messages list ─── */}
        {sidebarTab === "messages" && (
        <div className={styles.convList}>
          {loadingConvs && <div className={styles.loading}>Chargement...</div>}
          {!loadingConvs && filtered.length === 0 && (
            <div className={styles.convEmpty}>
              <svg className={styles.convEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {conversations.length === 0
                ? "Aucune conversation\nContactez un professionnel depuis le Réseau"
                : "Aucun résultat"}
            </div>
          )}
          {filtered.map((conv) => {
            const isActive = conv.isGroup
              ? selectedGroup?.id === conv.groupId
              : selectedPro?.id === conv.proId;
            const displayName = conv.isGroup
              ? (conv.name || "Groupe")
              : `${conv.pro?.prenom ?? ""} ${conv.pro?.nom ?? ""}`;
            return (
            <div
              key={conv.proId}
              className={`${styles.convItem} ${isActive ? styles.convItemActive : ""}`}
              onClick={() => selectConversation(conv)}
            >
              <div className={`${styles.convAvatar} ${conv.isGroup ? styles.groupAvatar : ""}`}>
                {conv.isGroup ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ) : conv.pro && fixAvatar(conv.pro.avatarPath) ? (
                  <img src={fixAvatar(conv.pro.avatarPath)!} alt="" className={styles.convAvatarImg} />
                ) : (
                  getInitials(conv.pro?.nom ?? "", conv.pro?.prenom ?? "")
                )}
              </div>
              <div className={styles.convInfo}>
                <div className={styles.convInfoTop}>
                  <span className={styles.convName}>{displayName}</span>
                  <span className={`${styles.convTime} ${conv.unread > 0 ? styles.convTimeUnread : ""}`}>
                    {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ""}
                  </span>
                </div>
                <div className={styles.convInfoBottom}>
                  {(() => {
                    const dk = conv.isGroup && conv.groupId ? `group:${conv.groupId}` : `pro:${conv.proId}`;
                    const draft = draftsRef.current.get(dk);
                    if (draft && (draft.text.trim() || draft.files.length > 0)) {
                      return (
                        <span className={styles.convPreview}>
                          <span className={styles.draftLabel}>Brouillon : </span>
                          {draft.text.trim() ? (draft.text.length > 30 ? draft.text.slice(0, 30) + "…" : draft.text) : `${draft.files.length} fichier(s)`}
                        </span>
                      );
                    }
                    return (
                      <span className={`${styles.convPreview} ${conv.unread > 0 ? styles.convPreviewUnread : ""}`}>
                        {conv.lastMessage?.isMe && (
                          <svg style={{ width: 14, height: 10, marginRight: 4, verticalAlign: "middle", display: "inline" }} viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 5.5 5 9.5 15 1.5" />
                          </svg>
                        )}
                        {conv.isGroup && conv.lastMessage?.senderName && !conv.lastMessage.isMe ? `${conv.lastMessage.senderName}: ` : ""}
                        {conv.lastMessage?.content ?? ""}
                      </span>
                    );
                  })()}
                  {conv.unread > 0 && <span className={styles.convUnread}>{conv.unread}</span>}
                </div>
              </div>
            </div>
            );
          })}

          {/* ─── Athlete conversations ─── */}
          {athleteConversations.filter(ac => ac.lastMessage || selectedAthlete?.id === ac.athleteUserId).map((ac) => {
            const isActive = selectedAthlete?.id === ac.athleteUserId;
            const initials = ac.athlete.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div
                key={`ath-${ac.athleteUserId}`}
                className={`${styles.convItem} ${isActive ? styles.convItemActive : ""}`}
                onClick={() => {
                  setSelectedPro(null);
                  setSelectedGroup(null);
                  setSelectedAthlete(ac.athlete);
                  setMessages([]);
                  setLoadingMsgs(true);
                  fetch(`/api/athlete-messages/${ac.athleteUserId}`)
                    .then(r => r.json())
                    .then(d => {
                      if (d.messages && Array.isArray(d.messages)) {
                        setMessages(d.messages.map((m: any) => ({
                          id: m.id, content: m.content, createdAt: m.createdAt, editedAt: m.editedAt,
                          senderProId: m.senderType === "pro" ? myProId : m.athleteUserId,
                          senderPro: m.senderType === "pro"
                            ? { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null }
                            : { id: m.athleteUserId, nom: "", prenom: ac.athlete.name, specialite: null, avatarPath: null },
                          reactions: [], pinned: false, important: false, replyToId: null,
                        })));
                      }
                    })
                    .catch(() => {})
                    .finally(() => setLoadingMsgs(false));
                  setAthleteConversations(prev => prev.map(c => c.athleteUserId === ac.athleteUserId ? { ...c, unread: 0 } : c));
                }}
              >
                <div className={styles.convAvatar} style={{ background: "rgba(76, 175, 80, 0.12)", color: "#4caf50" }}>
                  {initials}
                </div>
                <div className={styles.convInfo}>
                  <div className={styles.convInfoTop}>
                    <span className={styles.convName}>{ac.athlete.name}</span>
                    <span className={`${styles.convTime} ${ac.unread > 0 ? styles.convTimeUnread : ""}`}>
                      {ac.lastMessage ? formatTime(ac.lastMessage.createdAt) : ""}
                    </span>
                  </div>
                  <div className={styles.convInfoBottom}>
                    <span className={`${styles.convPreview} ${ac.unread > 0 ? styles.convPreviewUnread : ""}`}>
                      {ac.lastMessage?.isMe && (
                        <svg style={{ width: 14, height: 10, marginRight: 4, verticalAlign: "middle", display: "inline" }} viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 5.5 5 9.5 15 1.5" />
                        </svg>
                      )}
                      {ac.lastMessage?.content ?? ""}
                    </span>
                    {ac.unread > 0 && <span className={styles.convUnread}>{ac.unread}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* ─── Contacts directory ─── */}
        {sidebarTab === "contacts" && (
          <div className={styles.contactList}>
            {contactsLoading && <div className={styles.loading}>Chargement des contacts...</div>}

            {!contactsLoading && (contactFilter === "all" || contactFilter === "pros") && filteredPros.length > 0 && (
              <>
                <div className={styles.contactGroupTitle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Professionnels
                  <span className={styles.contactGroupCount}>{filteredPros.length}</span>
                </div>
                {filteredPros.map((pro: any) => (
                  <div key={pro.id} className={styles.contactItem} onClick={() => startConversationWithPro(pro)}>
                    <div className={styles.contactAvatar}>
                      {fixAvatar(pro.avatarPath)
                        ? <img src={fixAvatar(pro.avatarPath)!} alt="" />
                        : getInitials(pro.nom, pro.prenom)}
                    </div>
                    <div className={styles.contactInfo}>
                      <div className={styles.contactName}>{pro.prenom} {pro.nom}</div>
                      <div className={styles.contactSpec}>{pro.specialite || "Professionnel"}</div>
                      {pro.linkedAthletes?.length > 0 && (
                        <div className={styles.contactLinked}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          {pro.linkedAthletes.join(", ")}
                        </div>
                      )}
                    </div>
                    <button className={styles.contactMsgBtn} title="Envoyer un message">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                ))}
              </>
            )}

            {!contactsLoading && (contactFilter === "all" || contactFilter === "athletes") && filteredAthletes.length > 0 && (
              <>
                <div className={styles.contactGroupTitle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Patients suivis
                  <span className={styles.contactGroupCount}>{filteredAthletes.length}</span>
                </div>
                {filteredAthletes.map((a: any) => (
                  <div key={a.id} className={styles.contactItem} onClick={() => {
                    setSelectedPro(null);
                    setSelectedGroup(null);
                    setSelectedAthlete({ id: a.id, name: a.name, sport: a.sport, avatarUrl: a.avatarUrl || null });
                    setMessages([]);
                    setLoadingMsgs(true);
                    fetch(`/api/athlete-messages/${a.id}`)
                      .then(r => r.json())
                      .then(d => {
                        if (d.messages && Array.isArray(d.messages)) {
                          setMessages(d.messages.map((m: any) => ({
                            id: m.id, content: m.content, createdAt: m.createdAt, editedAt: m.editedAt,
                            senderProId: m.senderType === "pro" ? myProId : m.athleteUserId,
                            senderPro: m.senderType === "pro"
                              ? { id: myProId, nom: "", prenom: "Moi", specialite: null, avatarPath: null }
                              : { id: m.athleteUserId, nom: "", prenom: a.name, specialite: null, avatarPath: null },
                            reactions: [], pinned: false, important: false, replyToId: null,
                          })));
                        }
                      })
                      .catch(() => {})
                      .finally(() => setLoadingMsgs(false));
                    setSidebarTab("messages");
                  }}>
                    <div className={styles.contactAvatarAthlete}>
                      {a.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className={styles.contactInfo}>
                      <div className={styles.contactName}>{a.name}</div>
                      <div className={styles.contactSpec}>
                        {[a.sport, a.bodyZone].filter(Boolean).join(" · ") || "Patient"}
                      </div>
                      {a.contactEmail && <div className={styles.contactDetail}>{a.contactEmail}</div>}
                      {a.contactPhone && <div className={styles.contactDetail}>{a.contactPhone}</div>}
                    </div>
                    <button className={styles.contactMsgBtn} title="Envoyer un message">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                ))}
              </>
            )}

            {!contactsLoading && filteredAthletes.length === 0 && filteredPros.length === 0 && (
              <div className={styles.convEmpty}>
                <svg className={styles.convEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Aucun contact trouvé
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Right chat area ═══ */}
      <div className={styles.chatArea}>
        {!selectedPro && !selectedGroup && !selectedAthlete ? (
          <div className={styles.chatPlaceholder}>
            <svg className={styles.chatPlaceholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className={styles.chatPlaceholderText}>Tuatha Messagerie</div>
            <div className={styles.chatPlaceholderSub}>Envoyez et recevez des messages avec les professionnels de votre réseau. Sélectionnez une conversation pour commencer.</div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className={styles.chatHeader}>
              {selectedGroup ? (
                <>
                  <div className={`${styles.chatHeaderAvatar} ${styles.groupAvatar}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div className={styles.chatHeaderInfo}>
                    <div className={styles.chatHeaderName}>{selectedGroup.name}</div>
                    <div className={styles.chatHeaderStatus}>
                      <span className={styles.lastSeenText}>{selectedGroup.members.length} membres{selectedGroup.athlete ? ` · ${selectedGroup.athlete.name}` : ""}</span>
                    </div>
                  </div>
                </>
              ) : selectedAthlete ? (
                <>
                  <div className={styles.chatHeaderAvatar} style={{ background: "rgba(76, 175, 80, 0.12)", color: "#4caf50" }}>
                    {selectedAthlete.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className={styles.chatHeaderInfo}>
                    <div className={styles.chatHeaderName}>{selectedAthlete.name}</div>
                    <div className={styles.chatHeaderStatus}>
                      <span className={styles.lastSeenText}>{selectedAthlete.sport || "Patient"}</span>
                    </div>
                  </div>
                </>
              ) : selectedPro ? (
                <>
                  <div className={styles.chatHeaderAvatar}>
                    {fixAvatar(selectedPro.avatarPath) ? (
                      <img src={fixAvatar(selectedPro.avatarPath)!} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      getInitials(selectedPro.nom, selectedPro.prenom)
                    )}
                  </div>
                  <div className={styles.chatHeaderInfo}>
                    <div className={styles.chatHeaderName}>{selectedPro.prenom} {selectedPro.nom}</div>
                    <div className={styles.chatHeaderStatus}>
                      {peerPresence.online ? (
                        <><span className={styles.onlineDot} /> En ligne</>
                      ) : peerPresence.lastSeen ? (
                        <span className={styles.lastSeenText}>{formatLastSeen(peerPresence.lastSeen)}</span>
                      ) : (
                        <span className={styles.lastSeenText}>{selectedPro.specialite || "Professionnel"}</span>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
              <div className={styles.chatHeaderActions}>
                <button className={styles.chatHeaderBtn} title="Démarrer une visio" onClick={startVisio}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>
                <button className={`${styles.chatHeaderBtn} ${chatSearchOpen ? styles.chatHeaderBtnActive : ""}`} title="Rechercher" onClick={() => { setChatSearchOpen(!chatSearchOpen); setChatSearch(""); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <div style={{ position: "relative" }} ref={menuRef}>
                  <button className={`${styles.chatHeaderBtn} ${menuOpen ? styles.chatHeaderBtnActive : ""}`} title="Plus" onClick={() => setMenuOpen(!menuOpen)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div className={styles.headerMenu}>
                      <button className={styles.headerMenuItem} onClick={openProfile}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        Voir le profil
                      </button>
                      <button className={`${styles.headerMenuItem} ${styles.headerMenuItemDanger}`} onClick={deleteConversation}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        Supprimer la conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Search bar in chat */}
            {chatSearchOpen && (
              <div className={styles.chatSearchBar}>
                <svg style={{ width: 16, height: 16, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={chatSearchRef}
                  className={styles.chatSearchInput}
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Rechercher dans la conversation..."
                />
                {chatSearch && (
                  <span className={styles.chatSearchCount}>
                    {filteredMessages.length} résultat{filteredMessages.length !== 1 ? "s" : ""}
                  </span>
                )}
                <button className={styles.chatSearchClose} onClick={() => { setChatSearchOpen(false); setChatSearch(""); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Pinned messages banner */}
            {messages.some(m => m.pinned) && (
              <div className={styles.pinnedBanner}>
                <div className={styles.pinnedBannerIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/></svg>
                </div>
                <div className={styles.pinnedBannerMessages}>
                  {messages.filter(m => m.pinned).map(pm => (
                    <div key={pm.id} className={styles.pinnedMsg}>
                      <span className={styles.pinnedMsgAuthor}>{pm.senderPro.prenom}</span>
                      <span className={styles.pinnedMsgText}>{pm.content.slice(0, 60)}{pm.content.length > 60 ? "..." : ""}</span>
                      <button className={styles.pinnedMsgUnpin} title="Désépingler" onClick={async () => {
                        try {
                          const res = await offlineFetch(`/api/reseau/messages/${pm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: false }) });
                          if (res.ok) setMessages(prev => prev.map(m => m.id === pm.id ? { ...m, pinned: false } : m));
                        } catch {}
                      }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className={styles.chatMessages} ref={chatMessagesRef}>
              {/* Load older messages */}
              {hasMore && !loadingMsgs && (
                <div className={styles.loadMoreWrap}>
                  <button className={styles.loadMoreBtn} onClick={loadOlderMessages} disabled={loadingOlder}>
                    {loadingOlder ? "Chargement..." : "Charger les messages pr\u00e9c\u00e9dents"}
                  </button>
                </div>
              )}
              {loadingMsgs && <div className={styles.chatEmpty}>Chargement...</div>}
              {!loadingMsgs && messages.length === 0 && (
                <div className={styles.chatEmpty}>
                  <svg style={{ width: 48, height: 48, opacity: 0.1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Aucun message — dites bonjour !
                </div>
              )}
              {filteredMessages.map((msg, i) => {
                const isMe = msg.senderProId === myProId;
                const prevMsg = i > 0 ? filteredMessages[i - 1] : null;
                const showDate = !prevMsg ||
                  new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                const replyMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

                const isSending = msg._status === "sending";
                const isFailed = msg._status === "failed";
                const isQueued = msg._status === "queued";
                const isOptimistic = !!(msg._tempId);

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className={styles.chatDateSep}>{getDateLabel(msg.createdAt)}</div>
                    )}
                    <div
                      className={`${styles.msgRow} ${isMe ? styles.msgRowMe : styles.msgRowThem} ${isSending ? styles.msgRowSending : ""} ${isFailed ? styles.msgRowFailed : ""}`}
                      onPointerDown={isOptimistic ? undefined : (e) => onMsgPointerDown(msg.id, e)}
                      onPointerUp={isOptimistic ? undefined : onMsgPointerUp}
                      onPointerLeave={isOptimistic ? undefined : onMsgPointerUp}
                      onContextMenu={isOptimistic ? undefined : e => { e.preventDefault(); setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY }); }}
                    >
                      {!isMe && (
                        <div className={styles.msgAvatar}>
                          {getInitials(msg.senderPro.nom, msg.senderPro.prenom)}
                        </div>
                      )}
                      <div style={{ position: "relative" }}>
                        {/* Group sender name */}
                        {selectedGroup && !isMe && (
                          <div className={styles.groupSenderName}>{msg.senderPro.prenom} {msg.senderPro.nom}</div>
                        )}
                        {/* Pinned / Important indicators */}
                        {!isOptimistic && (msg.pinned || msg.important) && (
                          <div className={`${styles.msgIndicators} ${isMe ? styles.msgIndicatorsMe : styles.msgIndicatorsThem}`}>
                            {msg.pinned && <span className={styles.msgPinBadge} title="Épinglé">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 2l-4 4-6 1-3 3 6 6-1 6 3-3 1-6 4-4 6 2-2-6-4-3z"/></svg>
                            </span>}
                            {msg.important && <span className={styles.msgStarBadge} title="Important">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </span>}
                          </div>
                        )}
                        {/* Reply quote */}
                        {replyMsg && (
                          <div className={`${styles.replyQuote} ${isMe ? styles.replyQuoteMe : styles.replyQuoteThem}`}>
                            <span className={styles.replyQuoteAuthor}>{replyMsg.senderPro.prenom}</span>
                            <span className={styles.replyQuoteText}>{replyMsg.content.slice(0, 80)}{replyMsg.content.length > 80 ? "..." : ""}</span>
                          </div>
                        )}
                        <div className={styles.msgBubbleWrap}>
                          <div className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : styles.msgBubbleThem} ${isSending ? styles.msgBubbleSending : ""} ${isFailed ? styles.msgBubbleFailed : ""}`}>
                            {editingMsgId === msg.id ? (
                              <div className={styles.editInline}>
                                <textarea
                                  ref={editInputRef}
                                  className={styles.editTextarea}
                                  value={editingContent}
                                  onChange={e => setEditingContent(e.target.value)}
                                  onKeyDown={e => {
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
                                {msg.content && <MessageContent content={msg.content} />}
                                {msg.editedAt && <span className={styles.editedBadge}>(modifié)</span>}
                              </>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && !isOptimistic && (
                              <AttachmentBubble attachments={msg.attachments} proId={myProId} isMe={isMe} />
                            )}
                            {/* Optimistic attachment placeholders */}
                            {isOptimistic && msg.attachments && msg.attachments.length > 0 && (
                              <div className={styles.optimisticAttachments}>
                                {msg.attachments.map((att, ai) => (
                                  <div key={ai} className={styles.optimisticAttFile}>
                                    <span>{att.mimeType?.startsWith("image/") ? "🖼️" : att.mimeType === "application/pdf" ? "📄" : "📎"}</span>
                                    <span className={styles.optimisticAttName}>{att.originalName}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Hover reaction button — not on optimistic messages */}
                          {!isOptimistic && (
                            <button
                              className={`${styles.hoverReactBtn} ${isMe ? styles.hoverReactBtnMe : styles.hoverReactBtnThem}`}
                              onPointerDown={e => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setReactionMsgId(reactionMsgId === msg.id ? null : msg.id); }}
                              title="Réagir"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                                <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Reactions display */}
                        {!isOptimistic && msg.reactions && msg.reactions.length > 0 && (
                          <div className={`${styles.msgReactions} ${isMe ? styles.msgReactionsMe : styles.msgReactionsThem}`}>
                            {msg.reactions.map((r, ri) => (
                              <span key={ri} className={styles.msgReactionChip} onClick={() => toggleReaction(msg.id, r.emoji)}>
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Reaction picker bar */}
                        {!isOptimistic && reactionMsgId === msg.id && (
                          <div ref={reactionRef} className={`${styles.reactionPicker} ${isMe ? styles.reactionPickerMe : styles.reactionPickerThem}`} onPointerDown={e => e.stopPropagation()}>
                            {QUICK_REACTIONS.map(emoji => (
                              <button key={emoji} className={styles.reactionBtn} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}>{emoji}</button>
                            ))}
                            <button className={styles.reactionBtnMore} onClick={(e) => { e.stopPropagation(); setReactionMsgId(null); setContextMenu({ msgId: msg.id, x: 0, y: 0 }); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            </button>
                          </div>
                        )}
                        {/* Meta: time + status indicators */}
                        <div className={`${styles.msgMeta} ${isMe ? styles.msgTimeMe : styles.msgTimeThem}`}>
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
                          {!isOptimistic && (
                            <>
                              <span className={styles.msgTime}>{formatMsgTime(msg.createdAt)}</span>
                              {isMe && (
                                <svg className={`${styles.msgCheck} ${(msg as any).read ? styles.msgCheckRead : ""}`} viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1 5.5 5 9.5 15 1.5" />
                                </svg>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Typing indicator */}
              {remoteTyping && selectedPro && (
                <div className={styles.typingRow}>
                  <div className={styles.typingAvatar}>
                    {getInitials(selectedPro.nom, selectedPro.prenom)}
                  </div>
                  <div className={styles.typingBubble}>
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                  </div>
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
                <div className={styles.ctxQuickReactions}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji} className={styles.ctxQuickBtn} onClick={() => toggleReaction(contextMenu.msgId, emoji)}>{emoji}</button>
                  ))}
                </div>
                <div className={styles.ctxDivider} />
                <button className={styles.ctxItem} onClick={ctxReply}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                  R&eacute;pondre
                </button>
                <button className={styles.ctxItem} onClick={ctxReact}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  R&eacute;agir
                </button>
                <button className={styles.ctxItem} onClick={ctxToggleImportant}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {messages.find(m => m.id === contextMenu.msgId)?.important ? "Retirer important" : "Important"}
                </button>
                <button className={styles.ctxItem} onClick={ctxTogglePin}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/></svg>
                  {messages.find(m => m.id === contextMenu.msgId)?.pinned ? "D\u00e9s\u00e9pingler" : "\u00c9pingler"}
                </button>
                {messages.find(m => m.id === contextMenu.msgId)?.senderProId === myProId && (
                  <button className={styles.ctxItem} onClick={ctxEdit}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Modifier
                  </button>
                )}
                <button className={styles.ctxItem} onClick={ctxCopy}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copier
                </button>
                <div className={styles.ctxDivider} />
                <button className={`${styles.ctxItem} ${styles.ctxItemDanger}`} onClick={ctxDelete}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Supprimer
                </button>
              </div>
            )}

            {/* Profile panel */}
            {profileOpen && (
              <div className={styles.profilePanel}>
                <div className={styles.profileHeader}>
                  <span className={styles.profileHeaderTitle}>Profil</span>
                  <button className={styles.profileCloseBtn} onClick={() => setProfileOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                </div>
                {profileLoading ? (
                  <div className={styles.profileLoading}>Chargement...</div>
                ) : profileData ? (
                  <div className={styles.profileBody}>
                    <div className={styles.profileAvatarSection}>
                      <div className={styles.profileAvatar}>
                        {fixAvatar(profileData.avatarPath) ? (
                          <img src={fixAvatar(profileData.avatarPath)!} alt="" className={styles.profileAvatarImg} />
                        ) : (
                          getInitials(profileData.nom, profileData.prenom)
                        )}
                      </div>
                      <div className={styles.profileName}>{profileData.prenom} {profileData.nom}</div>
                      <div className={styles.profileSpec}>{profileData.specialite || "Professionnel"}</div>
                    </div>
                    <div className={styles.profileSection}>
                      {profileData.email && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Email</div>
                            <div className={styles.profileRowValue}>{profileData.email}</div>
                          </div>
                        </div>
                      )}
                      {profileData.telephone && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>T\u00e9l\u00e9phone</div>
                            <div className={styles.profileRowValue}>{profileData.telephone}</div>
                          </div>
                        </div>
                      )}
                      {profileData.adresseCabinet && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Cabinet</div>
                            <div className={styles.profileRowValue}>{profileData.adresseCabinet}</div>
                          </div>
                        </div>
                      )}
                      {profileData.createdAt && (
                        <div className={styles.profileRow}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <div>
                            <div className={styles.profileRowLabel}>Membre depuis</div>
                            <div className={styles.profileRowValue}>{new Date(profileData.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <div className={styles.replyBar}>
                <div className={styles.replyBarContent}>
                  <svg className={styles.replyBarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                  <div className={styles.replyBarText}>
                    <span className={styles.replyBarAuthor}>{replyTo.senderPro.prenom} {replyTo.senderPro.nom}</span>
                    <span className={styles.replyBarMsg}>{replyTo.content.slice(0, 100)}{replyTo.content.length > 100 ? "..." : ""}</span>
                  </div>
                </div>
                <button className={styles.replyBarClose} onClick={() => setReplyTo(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className={styles.pendingFiles}>
                {pendingFiles.map((f, i) => (
                  <div key={i} className={styles.pendingFile}>
                    <span className={styles.pendingFileIcon}>
                      {f.type.startsWith("image/") ? "🖼️" : f.type === "application/pdf" ? "📄" : "📎"}
                    </span>
                    <span className={styles.pendingFileName}>{f.name.length > 25 ? f.name.slice(0, 22) + "..." : f.name}</span>
                    <span className={styles.pendingFileSize}>{(f.size / 1024).toFixed(0)} Ko</span>
                    <button className={styles.pendingFileRemove} onClick={() => removePendingFile(i)} title="Retirer">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input bar */}
            {isRecording ? (
              <div className={styles.inputBar}>
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
              <div className={styles.inputBar}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <button className={styles.attachBtn} title="Joindre un fichier" onClick={() => fileInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <div style={{ position: "relative" }} ref={emojiRef}>
                  <button className={`${styles.emojiBtn} ${emojiOpen ? styles.emojiBtnActive : ""}`} title="Emoji" onClick={() => setEmojiOpen(!emojiOpen)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                        {EMOJI_CATEGORIES[emojiCat].emojis.map((e, ei) => (
                          <button key={ei} className={styles.emojiItem} onClick={() => insertEmoji(e)}>{e}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <textarea
                  ref={inputRef}
                  className={styles.inputField}
                  value={input}
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                    if (e.target.value.trim()) sendTypingSignal();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder={replyTo ? "Répondre..." : "Écrire un message..."}
                />
                {input.trim() || pendingFiles.length > 0 ? (
                  <button className={styles.sendBtn} onClick={sendMessage} disabled={!input.trim() && pendingFiles.length === 0}>
                    {uploading ? (
                      <span className={styles.sendSpinner} />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
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
      </div>

      {/* ═══ Group creation modal ═══ */}
      {showGroupModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGroupModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nouveau groupe</h3>
              <button className={styles.modalClose} onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Nom du groupe (optionnel)</label>
              <input className={styles.modalInput} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ex: Suivi patient Dupont" />

              <label className={styles.modalLabel}>Membres ({groupMemberIds.length} sélectionnés — min. 2)</label>
              <div className={styles.memberList}>
                {contacts.professionals.length === 0 && <div className={styles.memberEmpty}>Chargez les contacts d&apos;abord via l&apos;onglet Contacts</div>}
                {contacts.professionals.map((pro: any) => {
                  if (pro.id === myProId) return null;
                  const selected = groupMemberIds.includes(pro.id);
                  return (
                    <div key={pro.id} className={`${styles.memberItem} ${selected ? styles.memberItemSelected : ""}`} onClick={() => {
                      setGroupMemberIds(prev => selected ? prev.filter(id => id !== pro.id) : [...prev, pro.id]);
                    }}>
                      <div className={styles.memberCheck}>{selected ? "✓" : ""}</div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{pro.prenom} {pro.nom}</span>
                        <span className={styles.memberSpec}>{pro.specialite || "Professionnel"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowGroupModal(false)}>Annuler</button>
              <button className={styles.modalCreateBtn} onClick={createGroup} disabled={groupMemberIds.length < 2}>Créer le groupe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
