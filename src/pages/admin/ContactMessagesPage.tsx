import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Search, Archive, Reply, Eye, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import EmptyState from "@/components/EmptyState";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "archived" | "replied";
  admin_reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  created_at: string;
};

type FilterTab = "all" | "new" | "read" | "replied" | "archived";

export default function ContactMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [actioning, setActioning] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load messages");
    } else {
      setMessages((data ?? []) as ContactMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const counts = useMemo(() => ({
    all: messages.length,
    new: messages.filter((m) => m.status === "new").length,
    read: messages.filter((m) => m.status === "read").length,
    replied: messages.filter((m) => m.status === "replied").length,
    archived: messages.filter((m) => m.status === "archived").length,
  }), [messages]);

  const visible = useMemo(() => {
    let list = messages;
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q),
      );
    }
    return list;
  }, [messages, filter, search]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(visible, 15);

  const openMessage = async (m: ContactMessage) => {
    setSelected(m);
    setReplyText(m.admin_reply ?? "");
    if (m.status === "new") {
      const { error } = await supabase
        .from("contact_messages")
        .update({ status: "read" })
        .eq("id", m.id);
      if (!error) {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, status: "read" } : x)),
        );
      }
    }
  };

  const archiveMessage = async (id: string) => {
    setActioning(true);
    const { error } = await supabase
      .from("contact_messages")
      .update({ status: "archived" })
      .eq("id", id);
    setActioning(false);
    if (error) {
      toast.error("Could not archive");
      return;
    }
    setMessages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "archived" } : x)),
    );
    setSelected(null);
    toast.success("Message archived");
  };

  const submitReply = async () => {
    if (!selected || !user) return;
    const trimmed = replyText.trim();
    if (trimmed.length < 5) {
      toast.error("Reply is too short");
      return;
    }
    setActioning(true);
    const { error } = await supabase
      .from("contact_messages")
      .update({
        admin_reply: trimmed,
        replied_at: new Date().toISOString(),
        replied_by: user.id,
        status: "replied",
      })
      .eq("id", selected.id);
    setActioning(false);
    if (error) {
      toast.error("Could not save reply");
      return;
    }
    setMessages((prev) =>
      prev.map((x) =>
        x.id === selected.id
          ? {
              ...x,
              admin_reply: trimmed,
              replied_at: new Date().toISOString(),
              replied_by: user.id,
              status: "replied",
            }
          : x,
      ),
    );
    setSelected(null);
    toast.success("Reply saved. Don't forget to email the user.");
  };

  const statusBadge = (s: ContactMessage["status"]) => {
    const map = {
      new: "bg-primary/10 text-primary border-primary/20",
      read: "bg-muted text-muted-foreground border-border",
      replied: "bg-success/10 text-success border-success/20",
      archived: "bg-muted/50 text-muted-foreground border-border",
    } as const;
    return (
      <Badge variant="outline" className={map[s]}>
        {s}
      </Badge>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1}  className="flex items-center gap-2">
            <Mail className="h-6 w-6" /> Contact Messages
          </Heading>
          <p className="text-description-sm mt-1">
            Inbox of inquiries submitted from the public contact form.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Inbox className="h-3.5 w-3.5" /> {counts.new} new
        </Badge>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="new">New ({counts.new})</TabsTrigger>
              <TabsTrigger value="read">Read ({counts.read})</TabsTrigger>
              <TabsTrigger value="replied">Replied ({counts.replied})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({counts.archived})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-fs-sm text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No messages here"
            description="When people send you a message via the contact form, it'll appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-40">Received</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((m) => (
                  <TableRow
                    key={m.id}
                    className={m.status === "new" ? "font-medium bg-primary/[0.02]" : ""}
                  >
                    <TableCell>{statusBadge(m.status)}</TableCell>
                    <TableCell>
                      <div className="text-fs-sm">{m.name}</div>
                      <div className="text-fs-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{m.subject}</TableCell>
                    <TableCell className="text-fs-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openMessage(m)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={pageSize}
              className="mt-4"
          onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <DialogDescription>
                  From <span className="font-medium text-foreground">{selected.name}</span>{" "}
                  &lt;{selected.email}&gt; ·{" "}
                  {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg bg-muted/40 border border-border p-4 text-fs-sm whitespace-pre-wrap">
                  {selected.message}
                </div>

                <div>
                  <label className="text-fs-sm font-medium mb-1.5 flex items-center gap-1.5">
                    <Reply className="h-3.5 w-3.5" /> Internal reply / notes
                  </label>
                  <Textarea
                    rows={4}
                    placeholder="Draft your reply here. Send it via email manually."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    maxLength={5000}
                    className="resize-none"
                  />
                  {selected.replied_at && (
                    <p className="text-fs-xs text-muted-foreground mt-1">
                      Last saved {formatDistanceToNow(new Date(selected.replied_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => archiveMessage(selected.id)}
                  disabled={actioning || selected.status === "archived"}
                  className="gap-1.5"
                >
                  <Archive className="h-4 w-4" /> Archive
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}&body=${encodeURIComponent(replyText)}`;
                  }}
                  className="gap-1.5"
                >
                  <Mail className="h-4 w-4" /> Open in mail
                </Button>
                <Button onClick={submitReply} disabled={actioning} className="gap-1.5">
                  <Reply className="h-4 w-4" /> Save reply
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
