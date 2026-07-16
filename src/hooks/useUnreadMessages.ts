import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const channelIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (!convos || convos.length === 0) { setCount(0); return; }

      const convoIds = convos.map((c) => c.id);

      const { count: unread } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      setCount(unread || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-messages-${channelIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}
