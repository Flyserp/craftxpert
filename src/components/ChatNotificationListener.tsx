import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

/**
 * Global listener that shows a toast when the user receives a new chat message
 * while NOT on the chat page. Also persists a notification to the DB.
 * Mount once inside <AuthProvider> + <BrowserRouter>.
 */
export default function ChatNotificationListener() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Use a ref so the realtime callback always sees the latest pathname
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => {
    if (!user) return;

    // Cache conversation IDs the user participates in
    let myConvoIds: Set<string> = new Set();

    const loadConvos = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      myConvoIds = new Set((data || []).map((c) => c.id));
    };

    loadConvos();

    const channelName = `chat-notif-listener-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string | null;
            file_url: string | null;
          };

          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Check if this convo belongs to us (refresh if unknown)
          if (!myConvoIds.has(msg.conversation_id)) {
            await loadConvos();
            if (!myConvoIds.has(msg.conversation_id)) return;
          }

          // Don't show toast if already viewing this conversation
          if (pathnameRef.current === `/chat/${msg.conversation_id}`) return;

          // Get sender name
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = senderProfile?.display_name || "Someone";
          const preview = msg.content
            ? msg.content.length > 60
              ? msg.content.slice(0, 60) + "…"
              : msg.content
            : "Sent an attachment";

          // Show toast
          toast(`💬 ${senderName}`, {
            description: preview,
            action: {
              label: "View",
              onClick: () => navigate(`/chat/${msg.conversation_id}`),
            },
            duration: 5000,
          });

          // Persist notification in DB (only if not on chat page at all)
          if (!pathnameRef.current.startsWith("/chat")) {
            createNotification({
              userId: user.id,
              type: "new_message",
              title: "New Message 💬",
              message: `${senderName}: ${preview}`,
              metadata: { conversation_id: msg.conversation_id, sender_id: msg.sender_id },
            });
          }
        }
      )
      // Also listen for new conversations (so we pick up convos created after mount)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload) => {
          const convo = payload.new as { id: string; participant_1: string; participant_2: string };
          if (convo.participant_1 === user.id || convo.participant_2 === user.id) {
            myConvoIds.add(convo.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
}
