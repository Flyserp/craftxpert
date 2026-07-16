import { useState, useEffect, useRef, useCallback } from"react";
import { useParams, useNavigate, useSearchParams } from"react-router-dom";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { notifyNewMessage } from"@/lib/notifications";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { cn } from"@/lib/utils";
import { format, isToday, isYesterday } from"date-fns";
import {
 ArrowLeft, Send, Paperclip, Image as ImageIcon, Check, CheckCheck,
 Loader2, X, MessageSquare, Search, CalendarCheck, Reply, FileText,
} from"lucide-react";
import BookingThreadSelector from"@/components/chat/BookingThreadSelector";
import ReportButton from "@/components/moderation/ReportButton";
import { Heading } from "@/components/ui/app";

/* ─── Types ─── */
interface ConversationBooking {
 id: string;
 booking_date: string;
 start_time: string;
 status: string;
 service_title: string;
}

interface Conversation {
 id: string;
 participant_1: string;
 participant_2: string;
 booking_id: string | null;
 last_message_at: string;
 other_user: { display_name: string; avatar_url: string | null };
 last_message?: string;
 unread_count: number;
 booking?: ConversationBooking | null;
}

interface Message {
 id: string;
 conversation_id: string;
 sender_id: string;
 content: string | null;
 file_url: string | null;
 file_type: string | null;
 file_name: string | null;
 file_size: number | null;
 reply_to_id: string | null;
 is_read: boolean;
 read_at: string | null;
 created_at: string;
}

/* ─── Helpers ─── */
function formatMsgTime(dateStr: string) {
 const d = new Date(dateStr);
 if (isToday(d)) return format(d,"h:mm a");
 if (isYesterday(d)) return"Yesterday" + format(d,"h:mm a");
 return format(d,"MMM d, h:mm a");
}

function formatConvoTime(dateStr: string) {
 const d = new Date(dateStr);
 if (isToday(d)) return format(d,"h:mm a");
 if (isYesterday(d)) return"Yesterday";
 return format(d,"MMM d");
}

const ChatPage = () => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { conversationId } = useParams<{ conversationId?: string }>();

 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [messages, setMessages] = useState<Message[]>([]);
 const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
 const [newMessage, setNewMessage] = useState("");
 const [sending, setSending] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const [isTyping, setIsTyping] = useState(false);
 const [otherTyping, setOtherTyping] = useState(false);
 const [otherOnline, setOtherOnline] = useState(false);
 const [replyTo, setReplyTo] = useState<Message | null>(null);

 const messagesEndRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const typingTimeout = useRef<NodeJS.Timeout>();

 const userId = user?.id;

 // ─── Load conversations ───
 const loadConversations = useCallback(async () => {
 if (!userId) return;

 const { data: convos } = await supabase
 .from("conversations")
 .select("*")
 .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
 .order("last_message_at", { ascending: false });

 if (!convos || convos.length === 0) { setConversations([]); return; }

 const otherIds = convos.map((c) =>
 c.participant_1 === userId ? c.participant_2 : c.participant_1
 );

 const [profilesRes, unreadRes, lastMsgRes] = await Promise.all([
 supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", otherIds),
 supabase.from("messages").select("conversation_id, id").in("conversation_id", convos.map((c) => c.id)).eq("is_read", false).neq("sender_id", userId),
 supabase.from("messages").select("conversation_id, content, file_type").in("conversation_id", convos.map((c) => c.id)).order("created_at", { ascending: false }),
 ]);

 const profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
 (profilesRes.data || []).forEach((p) => { profileMap[p.user_id] = p; });

 const unreadMap: Record<string, number> = {};
 (unreadRes.data || []).forEach((m: any) => {
 unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
 });

 const lastMsgMap: Record<string, string> = {};
 (lastMsgRes.data || []).forEach((m: any) => {
 if (!lastMsgMap[m.conversation_id]) {
 lastMsgMap[m.conversation_id] = m.content || (m.file_type ?"📎 Attachment" :"");
 }
 });

 setConversations(
 convos.map((c) => {
 const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;
 return {
 ...c,
 other_user: profileMap[otherId] || { display_name:"User", avatar_url: null },
 last_message: lastMsgMap[c.id] ||"",
 unread_count: unreadMap[c.id] || 0,
 };
 })
 );
 }, [userId]);

 useEffect(() => { loadConversations(); }, [loadConversations]);

 // ─── Create conversation if"with" param provided ───
 useEffect(() => {
 const withUser = searchParams.get("with");
 if (!withUser || !userId || withUser === userId) return;

 const findOrCreate = async () => {
 // Check existing
 const { data: existing } = await supabase
 .from("conversations")
 .select("*")
 .or(`and(participant_1.eq.${userId},participant_2.eq.${withUser}),and(participant_1.eq.${withUser},participant_2.eq.${userId})`);

 if (existing && existing.length > 0) {
 navigate(`/chat/${existing[0].id}`, { replace: true });
 return;
 }

 const { data: newConvo } = await supabase
 .from("conversations")
 .insert({ participant_1: userId, participant_2: withUser })
 .select()
 .single();

 if (newConvo) {
 navigate(`/chat/${newConvo.id}`, { replace: true });
 loadConversations();
 }
 };
 findOrCreate();
 }, [searchParams, userId]);

 // ─── Load messages for active conversation ───
 useEffect(() => {
 if (!conversationId || !userId) return;

 const loadMessages = async () => {
 const { data } = await supabase
 .from("messages")
 .select("*")
 .eq("conversation_id", conversationId)
 .order("created_at", { ascending: true });

 setMessages(data || []);

 // Find active convo
 const convo = conversations.find((c) => c.id === conversationId);
 let resolved: Conversation | null = convo || null;
 if (!resolved) {
 // Load if not in list
 const { data: c } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
 if (c) {
 const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;
 const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", otherId).single();
 resolved = {
 ...c,
 other_user: profile || { display_name:"User", avatar_url: null },
 unread_count: 0,
 };
 }
 }

 // Hydrate booking context for the active thread (if any)
 if (resolved?.booking_id) {
 const { data: b } = await supabase
 .from("bookings")
 .select("id, booking_date, start_time, status, service_id")
 .eq("id", resolved.booking_id)
 .maybeSingle();
 if (b) {
 const { data: svc } = await supabase
 .from("vendor_services").select("title").eq("id", b.service_id).maybeSingle();
 resolved = {
 ...resolved,
 booking: {
 id: b.id,
 booking_date: b.booking_date,
 start_time: b.start_time,
 status: b.status,
 service_title: svc?.title ||"Service",
 },
 };
 }
 }
 setActiveConvo(resolved);

 // Mark messages as read
 await supabase
 .from("messages")
 .update({ is_read: true, read_at: new Date().toISOString() })
 .eq("conversation_id", conversationId)
 .neq("sender_id", userId)
 .eq("is_read", false);
 };

 loadMessages();
 }, [conversationId, userId, conversations]);

 // ─── Real-time subscription ───
 useEffect(() => {
 if (!conversationId) return;

 const channel = supabase
 .channel(`chat-${conversationId}`)
 .on("postgres_changes", {
 event:"INSERT",
 schema:"public",
 table:"messages",
 filter:`conversation_id=eq.${conversationId}`,
 }, (payload) => {
 const newMsg = payload.new as Message;
 setMessages((prev) => {
 if (prev.some((m) => m.id === newMsg.id)) return prev;
 return [...prev, newMsg];
 });

 // Mark as read if from other user
 if (newMsg.sender_id !== userId) {
 supabase
 .from("messages")
 .update({ is_read: true, read_at: new Date().toISOString() })
 .eq("id", newMsg.id)
 .then();
 }
 })
 .on("postgres_changes", {
 event:"UPDATE",
 schema:"public",
 table:"messages",
 filter:`conversation_id=eq.${conversationId}`,
 }, (payload) => {
 const updated = payload.new as Message;
 setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
 })
 .on("broadcast", { event:"typing" }, (payload) => {
 if (payload.payload?.user_id !== userId) {
 setOtherTyping(true);
 setTimeout(() => setOtherTyping(false), 3000);
 }
 })
 .subscribe();

 return () => { supabase.removeChannel(channel); };
 }, [conversationId, userId]);

 // ─── Presence: online status ───
 useEffect(() => {
  if (!conversationId || !userId || !activeConvo) return;
  const otherId = activeConvo.participant_1 === userId ? activeConvo.participant_2 : activeConvo.participant_1;
  const channel = supabase.channel(`presence-${conversationId}`, { config: { presence: { key: userId } } });
  channel
   .on("presence", { event: "sync" }, () => {
    const state = channel.presenceState() as Record<string, unknown>;
    setOtherOnline(Object.keys(state).includes(otherId));
   })
   .subscribe(async (status) => {
    if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
   });
  return () => { supabase.removeChannel(channel); };
 }, [conversationId, userId, activeConvo]);

 // ─── Auto-scroll ───
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
 }, [messages, otherTyping]);

 // ─── Realtime: conversation list updates ───
 useEffect(() => {
 if (!userId) return;
 const channel = supabase
 .channel("convo-updates")
 .on("postgres_changes", {
 event:"*",
 schema:"public",
 table:"conversations",
 }, () => { loadConversations(); })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [userId, loadConversations]);

 // ─── Typing indicator ───
 const handleTyping = () => {
 if (!conversationId) return;
 if (typingTimeout.current) clearTimeout(typingTimeout.current);
 
 supabase.channel(`chat-${conversationId}`).send({
 type:"broadcast",
 event:"typing",
 payload: { user_id: userId },
 });

 typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
 };

 // ─── Send message ───
 const handleSend = async () => {
 if ((!newMessage.trim() && !uploading) || !conversationId || !userId) return;
 setSending(true);
 const content = newMessage.trim();
 setNewMessage("");
  const replySnapshot = replyTo;
  setReplyTo(null);

 await supabase.from("messages").insert({
 conversation_id: conversationId,
 sender_id: userId,
 content,
   reply_to_id: replySnapshot?.id ?? null,
 });

 await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

 // Notify the other participant
 const convo = conversations.find((c) => c.id === conversationId);
 if (convo) {
 const recipientId = convo.participant_1 === userId ? convo.participant_2 : convo.participant_1;
 const myProfile = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();
 notifyNewMessage(recipientId, myProfile.data?.display_name ||"Someone");
 }

 setSending(false);
 };

 // ─── File upload ───
 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !userId || !conversationId) return;
 if (file.size > 10 * 1024 * 1024) { alert("File too large (max 10MB)"); return; }

 setUploading(true);
 const ext = file.name.split(".").pop() ||"bin";
 const path =`${userId}/${Date.now()}.${ext}`;
 const { error } = await supabase.storage.from("chat-attachments").upload(path, file);

 if (!error) {
 const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
 const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

 await supabase.from("messages").insert({
 conversation_id: conversationId,
 sender_id: userId,
 content: null,
 file_url: urlData.publicUrl,
  file_type: isImage ? "image" : isPdf ? "pdf" : "file",
  file_name: file.name,
  file_size: file.size,
 });

 await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
 }

 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value ="";
 };

 const filteredConversations = conversations.filter((c) =>
 c.other_user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const showConvoList = !conversationId;

 return (
 <div className="min-h-screen bg-muted/30 flex flex-col">
 <UnifiedHeader />
 <main className="flex-1 flex">
 <div className="container-app max-w-5xl flex flex-1 py-4 gap-0 overflow-hidden">

 {/* ─── Conversation List ─── */}
 <div className={cn(
"w-full sm:w-80 shrink-0 bg-card rounded-l-2xl border border-border/60 flex flex-col overflow-hidden",
 conversationId ?"hidden sm:flex" :"flex"
 )}>
 <div className="p-4 border-b border-border/40">
 <Heading level={2}  className="flex items-center gap-2 mb-3">
 <MessageSquare className="w-5 h-5 text-primary" /> Messages
 </Heading>
 <div className="relative">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search conversations..."
 className="pl-9 text-fs-sm"
 />
 </div>
 {userId && (
 <div className="mt-2">
 <BookingThreadSelector
 userId={userId}
 initialBookingId={activeConvo?.booking_id ?? undefined}
 />
 </div>
 )}
 </div>

 <div className="flex-1 overflow-y-auto">
 {filteredConversations.length === 0 ? (
 <div className="text-center py-12 px-4">
 <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
 <p className="text-fs-sm text-muted-foreground">No conversations yet</p>
 <p className="text-fs-xs text-muted-foreground mt-1">Start a chat from a provider's profile</p>
 </div>
 ) : (
 filteredConversations.map((c) => (
 <button
 key={c.id}
 onClick={() => navigate(`/chat/${c.id}`)}
 className={cn(
"w-full text-left p-4 border-b border-border/30 hover:bg-muted/50 transition-colors flex items-center gap-3",
 conversationId === c.id &&"bg-primary/5"
 )}
 >
 <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-fs-xs font-bold text-primary shrink-0">
 {c.other_user.avatar_url ? (
 <img src={c.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
 ) : (
 (c.other_user.display_name ||"U").slice(0, 2).toUpperCase()
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <p className="text-fs-sm font-medium text-heading truncate">{c.other_user.display_name}</p>
 <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatConvoTime(c.last_message_at)}</span>
 </div>
 <div className="flex items-center justify-between mt-0.5">
 <p className="text-fs-xs text-muted-foreground truncate">{c.last_message ||"No messages yet"}</p>
 {c.unread_count > 0 && (
 <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 ml-2">
 {c.unread_count}
 </span>
 )}
 </div>
 </div>
 </button>
 ))
 )}
 </div>
 </div>

 {/* ─── Chat Area ─── */}
 <div className={cn(
"flex-1 bg-card rounded-r-2xl border border-l-0 border-border/60 flex flex-col overflow-hidden",
 !conversationId ?"hidden sm:flex" :"flex"
 )}>
 {!conversationId || !activeConvo ? (
 <div className="flex-1 flex items-center justify-center text-center p-8">
 <div>
 <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
 <p className="text-fs-sm font-medium text-heading mb-1">Select a conversation</p>
 <p className="text-fs-xs text-muted-foreground">Choose from your existing chats or start a new one</p>
 </div>
 </div>
 ) : (
 <>
 {/* Header */}
 <div className="p-4 border-b border-border/40 flex items-center gap-3">
 <Button variant="ghost" size="icon" className="sm:hidden shrink-0" onClick={() => navigate("/chat")} aria-label="Back to conversations">
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div className="relative w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-fs-xs font-bold text-primary shrink-0">
 {activeConvo.other_user.avatar_url ? (
 <img src={activeConvo.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
 ) : (
 (activeConvo.other_user.display_name ||"U").slice(0, 2).toUpperCase()
 )}
 {otherOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-fs-sm font-semibold text-heading truncate">{activeConvo.other_user.display_name}</p>
 {otherTyping ? (
 <p className="text-[10px] text-primary font-medium animate-pulse">typing…</p>
 ) : activeConvo.booking ? (
 <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
 <CalendarCheck className="w-3 h-3 text-primary shrink-0" />
 <span className="truncate">
 {activeConvo.booking.service_title} · {format(new Date(activeConvo.booking.booking_date),"MMM d")} · {activeConvo.booking.start_time.slice(0, 5)} · <span className="capitalize">{activeConvo.booking.status.replace("_","")}</span>
 </span>
 </p>
 ) : null}
 </div>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4 space-y-2">
 {messages.map((msg, idx) => {
 const isMine = msg.sender_id === userId;
 const showDate = idx === 0 || format(new Date(messages[idx - 1].created_at),"yyyy-MM-dd") !== format(new Date(msg.created_at),"yyyy-MM-dd");

 return (
 <div key={msg.id}>
 {showDate && (
 <div className="flex justify-center my-3">
 <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
 {isToday(new Date(msg.created_at)) ?"Today" : isYesterday(new Date(msg.created_at)) ?"Yesterday" : format(new Date(msg.created_at),"MMMM d, yyyy")}
 </span>
 </div>
 )}
 <div className={cn("flex", isMine ?"justify-end" :"justify-start")}>
 <div className={cn(
"max-w-[75%] rounded-sm px-4 py-2.5 relative group",
 isMine
 ?"bg-primary text-primary-foreground rounded-br-md"
 :"bg-secondary text-secondary-foreground rounded-bl-md"
 )}>
 {msg.file_url && msg.file_type ==="image" && (
 <img src={msg.file_url} alt="Shared image" className="rounded-lg max-w-full max-h-60 mb-1.5 cursor-pointer" onClick={() => window.open(msg.file_url!,"_blank")} />
 )}
 {msg.file_url && (msg.file_type === "file" || msg.file_type === "pdf") && (
 <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
 className={cn("flex items-center gap-2 px-2 py-1.5 rounded-sm mb-1 border", isMine ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border/40 bg-background/50")}>
 <FileText className="w-4 h-4 shrink-0" />
 <div className="min-w-0 flex-1">
 <p className="text-fs-xs font-medium truncate">{msg.file_name || (msg.file_type === "pdf" ? "Document.pdf" : "Attachment")}</p>
 {msg.file_size != null && (
 <p className="text-[10px] opacity-70">{(msg.file_size / 1024).toFixed(0)} KB</p>
 )}
 </div>
 </a>
 )}
 {msg.reply_to_id && (() => {
 const q = messages.find((m) => m.id === msg.reply_to_id);
 if (!q) return null;
 return (
 <div className={cn("text-[11px] border-l-2 pl-2 mb-1 opacity-80 truncate", isMine ? "border-primary-foreground/40" : "border-primary/40")}>
 {q.content || (q.file_name ? `📎 ${q.file_name}` : "Attachment")}
 </div>
 );
 })()}
 {msg.content && <p className="text-fs-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
 <div className={cn("flex items-center gap-1 mt-1", isMine ?"justify-end" :"justify-start")}>
 <span className={cn("text-[9px]", isMine ?"text-primary-foreground/60" :"text-muted-foreground")}>
 {format(new Date(msg.created_at),"h:mm a")}
 </span>
 {isMine && (
 msg.is_read
 ? <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
 : <Check className="w-3 h-3 text-primary-foreground/40" />
 )}
 </div>
 <button
  onClick={() => setReplyTo(msg)}
  className={cn(
   "absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded-full p-1 shadow-sm",
   isMine ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full -mr-1"
  )}
  aria-label="Reply"
 >
  <Reply className="w-3 h-3" />
 </button>
 {!isMine && (
   <div className="absolute -bottom-2 right-0 translate-x-full mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
     <ReportButton entityType="message" entityId={msg.id} size="icon" className="h-6 w-6 p-1 bg-card border border-border rounded-full shadow-sm" />
   </div>
 )}
 </div>
 </div>
 </div>
 );
 })}

 {otherTyping && (
 <div className="flex justify-start">
 <div className="bg-secondary rounded-sm rounded-bl-md px-4 py-3 flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay:"0ms" }} />
 <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay:"150ms" }} />
 <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay:"300ms" }} />
 </div>
 </div>
 )}

 <div ref={messagesEndRef} />
 </div>

 {/* Input */}
 <div className="p-3 border-t border-border/40">
 {replyTo && (
 <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 bg-muted/40 rounded-sm border-l-2 border-primary">
  <div className="min-w-0 flex-1">
   <p className="text-[10px] font-semibold text-primary">Replying to {replyTo.sender_id === userId ? "yourself" : activeConvo.other_user.display_name}</p>
   <p className="text-fs-xs text-muted-foreground truncate">{replyTo.content || (replyTo.file_name ? `📎 ${replyTo.file_name}` : "Attachment")}</p>
  </div>
   <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
   <X className="w-3 h-3" />
  </Button>
 </div>
 )}
 <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
 <div className="flex items-end gap-2">
 <Button
 variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground"
 aria-label="Attach file"
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 >
 {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
 </Button>
 <div className="flex-1 relative">
 <textarea
 value={newMessage}
 onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
 onKeyDown={(e) => { if (e.key ==="Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
 placeholder="Type a message..."
 rows={1}
 className="w-full px-4 py-2.5 rounded-sm border border-input bg-background text-fs-sm resize-none max-h-32"
 style={{ minHeight:"42px" }}
 />
 </div>
 <Button
 size="icon" className="shrink-0"
 aria-label="Send message"
 onClick={handleSend}
 disabled={!newMessage.trim() || sending}
 >
 <Send className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 </main>
 </div>
 );
};

export default ChatPage;
