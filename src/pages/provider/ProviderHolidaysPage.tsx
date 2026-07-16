import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2, Plane, Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

interface BlockedDate {
  id: string;
  blocked_date: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
}

const fmtDb = (d: Date) => format(d, "yyyy-MM-dd");

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function ProviderHolidaysPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_blocked_dates")
      .select("id, blocked_date, reason, created_at")
      .eq("vendor_id", user.id)
      .order("blocked_date", { ascending: true });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    if (!range?.from) {
      toast.error("Pick a start date.");
      return;
    }
    const from = range.from;
    const to = range.to ?? range.from;
    if (to < from) {
      toast.error("End date must be after start date.");
      return;
    }

    setSaving(true);
    const days = eachDay(from, to);
    const existing = new Set(items.map((i) => i.blocked_date));
    const rows = days
      .map((d) => fmtDb(d))
      .filter((d) => !existing.has(d))
      .map((blocked_date) => ({
        vendor_id: user.id,
        blocked_date,
        reason: reason.trim() || null,
      }));

    if (rows.length === 0) {
      toast.info("Those dates are already blocked.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("vendor_blocked_dates").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      rows.length === 1
        ? "Date blocked."
        : `${rows.length} dates blocked.`
    );
    setRange(undefined);
    setReason("");
    refresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("vendor_blocked_dates")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Block removed.");
  };

  // Group consecutive dates into ranges for nicer display
  const grouped = (() => {
    const sorted = [...items].sort((a, b) =>
      a.blocked_date.localeCompare(b.blocked_date)
    );
    const groups: { start: BlockedDate; end: BlockedDate; ids: string[]; reason: string | null }[] = [];
    for (const it of sorted) {
      const last = groups[groups.length - 1];
      const itDate = new Date(it.blocked_date);
      if (last) {
        const lastDate = new Date(last.end.blocked_date);
        const next = new Date(lastDate);
        next.setDate(next.getDate() + 1);
        if (
          fmtDb(next) === it.blocked_date &&
          (last.reason ?? "") === (it.reason ?? "")
        ) {
          last.end = it;
          last.ids.push(it.id);
          continue;
        }
      }
      groups.push({ start: it, end: it, ids: [it.id], reason: it.reason });
    }
    return groups;
  })();

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(grouped, 10);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <DashboardLayout
      title="Holidays & Leave"
      subtitle="Block specific dates or ranges so customers can't book you while you're away."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Add form */}
        <section className="rounded-sm border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plane className="h-4 w-4" />
            </span>
            <div>
              <Heading level={2}  className="text-foreground">Add time off</Heading>
              <p className="text-fs-xs text-muted-foreground">Pick a single day or a range.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-fs-xs">Date or range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !range?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from ? (
                    range.to && fmtDb(range.to) !== fmtDb(range.from) ? (
                      <>
                        {format(range.from, "MMM d, yyyy")} —{" "}
                        {format(range.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(range.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick a date or range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={1}
                  disabled={(d) => d < today}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-fs-xs">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vacation, Public holiday, Personal"
              maxLength={120}
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={saving || !range?.from}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Blocking…" : "Block these dates"}
          </Button>
        </section>

        {/* List */}
        <section className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <Heading level={2}  className="text-foreground">Upcoming time off</Heading>
            <span className="text-fs-xs text-muted-foreground">
              {items.length} day{items.length === 1 ? "" : "s"} blocked
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-description-sm">
                No blocked dates yet. Add a holiday to keep your calendar accurate.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {pageItems.map((g) => {
                const isRange = g.start.id !== g.end.id;
                const label = isRange
                  ? `${format(new Date(g.start.blocked_date), "MMM d")} — ${format(
                      new Date(g.end.blocked_date),
                      "MMM d, yyyy"
                    )}`
                  : format(new Date(g.start.blocked_date), "EEE, MMM d, yyyy");
                return (
                  <li
                    key={g.start.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary text-fs-xs font-semibold">
                      {g.ids.length}d
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-fs-sm font-medium text-foreground truncate">
                        {label}
                      </p>
                      {g.reason && (
                        <p className="text-fs-xs text-muted-foreground truncate">
                          {g.reason}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Remove all dates in this group
                        Promise.all(g.ids.map((id) => handleDelete(id)));
                      }}
                      aria-label="Remove block"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
                })}
              </ul>
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
          onPageSizeChange={setPageSize}
              />
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
