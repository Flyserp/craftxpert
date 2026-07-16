import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { createNotification } from "@/lib/notifications";

interface Task {
  id: string;
  title: string;
  category_id: string;
  preferred_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
}

interface ProviderService {
  id: string;
  title: string;
  category_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  providerName: string;
}

export default function InviteToTaskModal({ open, onOpenChange, providerId, providerName }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [existingInvitedTaskIds, setExistingInvitedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [taskId, setTaskId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    Promise.all([
      supabase.from("tasks").select("id, title, category_id, preferred_date, budget_min, budget_max")
        .eq("customer_id", user.id).eq("status", "open").order("created_at", { ascending: false }),
      supabase.from("vendor_services").select("id, title, category_id").eq("vendor_id", providerId).eq("is_active", true),
      supabase.from("task_proposals").select("task_id").eq("vendor_id", providerId).eq("customer_id", user.id),
    ]).then(([tasksRes, servicesRes, existingRes]) => {
      setTasks((tasksRes.data || []) as Task[]);
      setServices((servicesRes.data || []) as ProviderService[]);
      setExistingInvitedTaskIds(new Set((existingRes.data || []).map((p: any) => p.task_id)));
      setLoading(false);
    });
  }, [open, user, providerId]);

  const selectedTask = tasks.find(t => t.id === taskId);

  // Auto-select matching service when task changes
  useEffect(() => {
    if (!selectedTask) return;
    const match = services.find(s => s.category_id === selectedTask.category_id) || services[0];
    if (match) setServiceId(match.id);
    if (selectedTask.preferred_date) setEtaDate(selectedTask.preferred_date);
    if (selectedTask.budget_min) setQuotedPrice(String(selectedTask.budget_min));
  }, [taskId]);

  const reset = () => {
    setTaskId(""); setServiceId(""); setQuotedPrice(""); setEtaDate(""); setMessage("");
  };

  const handleInvite = async () => {
    if (!user || !selectedTask) return;
    if (!serviceId) { toast.error("Provider has no matching services"); return; }
    if (existingInvitedTaskIds.has(taskId)) {
      toast.error("You've already invited this provider to that task");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("task_proposals").insert({
      task_id: selectedTask.id,
      vendor_id: providerId,
      customer_id: user.id,
      direction: "customer_invited",
      service_id: serviceId,
      quoted_price: quotedPrice ? Number(quotedPrice) : null,
      eta_date: etaDate || null,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await createNotification({
      userId: providerId,
      type: "task_invitation",
      title: "New task invitation",
      message: `${user.email || "A customer"} invited you to handle their task "${selectedTask.title}".`,
      metadata: { task_id: selectedTask.id },
    });
    toast.success(`${providerName} has been invited!`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {providerName}</DialogTitle>
          <DialogDescription>Send {providerName} an invitation to handle one of your open tasks.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-fs-sm text-muted-foreground">You don't have any open tasks yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/post-task">Post a task</Link>
            </Button>
          </div>
        ) : services.length === 0 ? (
          <p className="py-6 text-fs-sm text-center text-muted-foreground">This provider hasn't listed any services yet.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Pick a task</label>
              <select
                value={taskId}
                onChange={e => setTaskId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm"
              >
                <option value="">-- Select a task --</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id} disabled={existingInvitedTaskIds.has(t.id)}>
                    {t.title}{existingInvitedTaskIds.has(t.id) ? " (already invited)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedTask && (
              <>
                <div>
                  <label className="block text-fs-sm font-medium mb-1.5">Service</label>
                  <select
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-fs-sm font-medium mb-1.5">Offered price ($)</label>
                  <Input type="number" min={0} value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} placeholder="e.g. 150" />
                </div>
                <div>
                  <label className="block text-fs-sm font-medium mb-1.5">Preferred start date</label>
                  <Input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-fs-sm font-medium mb-1.5">Message (optional)</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 500))}
                    rows={3}
                    maxLength={500}
                    placeholder="Add a personal note for the provider"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm resize-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={submitting || !taskId || !serviceId}>
            {submitting ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
