import { useEffect, useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createNotification } from "@/lib/notifications";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StaffOption {
  user_id: string;
  display_name: string;
}

const UNASSIGNED = "__none__";

interface Props {
  bookingId: string;
  currentStaffId: string | null;
  onAssigned?: (staffId: string | null) => void;
}

export default function AssignStaffSelect({
  bookingId,
  currentStaffId,
  onAssigned,
}: Props) {
  const { user } = useAuth();
  const [options, setOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: staff } = await supabase
        .from("provider_staff")
        .select("staff_user_id")
        .eq("provider_id", user.id)
        .eq("is_active", true);

      const ids = (staff ?? []).map((s) => s.staff_user_id);
      if (ids.length === 0) {
        if (!cancelled) {
          setOptions([]);
          setLoading(false);
        }
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);

      const opts: StaffOption[] = (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name?.trim() || "Staff",
      }));
      if (!cancelled) {
        setOptions(opts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="text-fs-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading staff…
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-fs-xs text-muted-foreground flex items-start gap-2">
        <UserCog className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          No active staff yet.{" "}
          <a href="/provider-staff" className="text-primary font-medium hover:underline">
            Invite a teammate
          </a>{" "}
          to assign bookings.
        </span>
      </div>
    );
  }

  const handleChange = async (value: string) => {
    const newId = value === UNASSIGNED ? null : value;
    const oldId = currentStaffId;
    if (newId === oldId) return;

    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_staff_id: newId })
      .eq("id", bookingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Fire-and-forget notifications via createNotification(), which respects
    // each recipient's notification_preferences and dispatches email/SMS via
    // the dispatch-notification-channels edge function. Failures are non-fatal.
    const shortId = bookingId.slice(0, 8);
    const tasks: Promise<unknown>[] = [];

    if (oldId && oldId !== newId) {
      tasks.push(
        createNotification({
          userId: oldId,
          type: "status_update",
          title: "Booking unassigned",
          message: `You've been removed from booking #${shortId}.`,
          metadata: { booking_id: bookingId, event: "staff_unassigned" },
        }),
      );
    }
    if (newId) {
      tasks.push(
        createNotification({
          userId: newId,
          type: "task_assigned",
          title: "New booking assigned",
          message: `You've been assigned to booking #${shortId}. Open the staff dashboard to view it.`,
          metadata: { booking_id: bookingId, event: "staff_assigned" },
        }),
      );
    }
    if (tasks.length > 0) {
      Promise.all(tasks).catch((err) =>
        console.error("staff assignment notification failed", err),
      );
    }

    toast.success(newId ? "Booking assigned." : "Assignment cleared.");
    onAssigned?.(newId);
  };

  return (
    <div>
      <p className="text-fs-xs text-muted-foreground mb-1.5 flex items-center gap-1">
        <UserCog className="h-3.5 w-3.5" />
        Assigned staff
      </p>
      <Select
        value={currentStaffId ?? UNASSIGNED}
        onValueChange={handleChange}
        disabled={saving}
      >
        <SelectTrigger className="h-9 text-fs-sm">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.user_id} value={o.user_id}>
              {o.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
