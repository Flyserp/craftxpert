import { useState, useEffect } from"react";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Calendar } from"@/components/ui/calendar";
import { Switch } from"@/components/ui/switch";
import { Label } from"@/components/ui/label";
import { toast } from"sonner";
import { Clock, Plus, Trash2, CalendarOff, Plane, Eye } from"lucide-react";
import { format } from"date-fns";
import { cn } from"@/lib/utils";
import { Heading } from "@/components/ui/app";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

interface AvailabilitySlot {
 id: string;
 day_of_week: number;
 start_time: string;
 end_time: string;
 is_available: boolean;
}

interface BlockedDate {
 id: string;
 blocked_date: string;
 reason: string | null;
}

const AvailabilityManager = () => {
 const { user } = useAuth();
 const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
 const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
 const [loading, setLoading] = useState(true);
 const [addingDay, setAddingDay] = useState<number | null>(null);
 const [newSlot, setNewSlot] = useState({ start:"09:00", end:"17:00" });
 const [selectedDate, setSelectedDate] = useState<Date | undefined>();
 const [blockReason, setBlockReason] = useState("");
 const [vacationMode, setVacationMode] = useState(false);
 const [vacationUntil, setVacationUntil] = useState<string>("");
 const [showPublic, setShowPublic] = useState(true);
 const [savingPrefs, setSavingPrefs] = useState(false);

 const fetchData = async () => {
 if (!user) return;
 setLoading(true);

 const [slotsRes, blockedRes, profileRes] = await Promise.all([
 supabase.from("vendor_availability").select("*").eq("vendor_id", user.id).order("day_of_week").order("start_time"),
 supabase.from("vendor_blocked_dates").select("*").eq("vendor_id", user.id).order("blocked_date"),
 supabase.from("profiles").select("vacation_mode, vacation_until, show_availability_public").eq("user_id", user.id).maybeSingle(),
 ]);

 if (slotsRes.data) setSlots(slotsRes.data);
 if (blockedRes.data) setBlockedDates(blockedRes.data);
 if (profileRes.data) {
  setVacationMode(!!(profileRes.data as any).vacation_mode);
  setVacationUntil((profileRes.data as any).vacation_until ?? "");
  setShowPublic((profileRes.data as any).show_availability_public !== false);
 }
 setLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, [user]);

 const addSlot = async (dayOfWeek: number) => {
 if (!user) return;
 const { error } = await supabase.from("vendor_availability").insert({
 vendor_id: user.id,
 day_of_week: dayOfWeek,
 start_time: newSlot.start,
 end_time: newSlot.end,
 is_available: true,
 });

 if (error) {
 toast.error(error.message.includes("duplicate") ?"Time slot already exists" :"Failed to add slot");
 } else {
 toast.success("Availability added");
 setAddingDay(null);
 setNewSlot({ start:"09:00", end:"17:00" });
 fetchData();
 }
 };

 const deleteSlot = async (id: string) => {
 await supabase.from("vendor_availability").delete().eq("id", id);
 toast.success("Slot removed");
 fetchData();
 };

 const blockDate = async () => {
 if (!user || !selectedDate) return;
 const dateStr = format(selectedDate,"yyyy-MM-dd");
 const { error } = await supabase.from("vendor_blocked_dates").insert({
 vendor_id: user.id,
 blocked_date: dateStr,
 reason: blockReason.trim() || null,
 });

 if (error) {
 toast.error(error.message.includes("duplicate") ?"Date already blocked" :"Failed to block date");
 } else {
 toast.success(`Blocked ${format(selectedDate,"MMM d, yyyy")}`);
 setSelectedDate(undefined);
 setBlockReason("");
 fetchData();
 }
 };

 const unblockDate = async (id: string) => {
 await supabase.from("vendor_blocked_dates").delete().eq("id", id);
 toast.success("Date unblocked");
 fetchData();
 };

 const savePrefs = async (next: { vacation_mode?: boolean; vacation_until?: string | null; show_availability_public?: boolean }) => {
  if (!user) return;
  setSavingPrefs(true);
  const payload: any = {};
  if (next.vacation_mode !== undefined) payload.vacation_mode = next.vacation_mode;
  if (next.vacation_until !== undefined) payload.vacation_until = next.vacation_until || null;
  if (next.show_availability_public !== undefined) payload.show_availability_public = next.show_availability_public;
  const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
  setSavingPrefs(false);
  if (error) { toast.error("Failed to save"); return; }
  toast.success("Saved");
 };

 const blockedDateValues = blockedDates.map((d) => new Date(d.blocked_date +"T00:00:00"));

 if (loading) {
 return (
 <div className="bg-card rounded-sm border border-border p-6">
 <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
 <div className="space-y-3">
 {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Vacation mode + public visibility */}
 <div className="bg-card rounded-sm border border-border p-6 space-y-5">
  <div className="flex items-start justify-between gap-4">
   <div className="flex items-start gap-3">
    <Plane className="w-5 h-5 text-primary mt-0.5" />
    <div>
     <Label htmlFor="vacation-mode" className="text-fs-sm font-semibold text-heading cursor-pointer">Vacation mode</Label>
     <p className="text-fs-xs text-muted-foreground">Hide your profile from "available" searches and pause new bookings.</p>
    </div>
   </div>
   <Switch
    id="vacation-mode"
    checked={vacationMode}
    disabled={savingPrefs}
    onCheckedChange={(v) => { setVacationMode(!!v); savePrefs({ vacation_mode: !!v }); }}
   />
  </div>
  {vacationMode && (
   <div className="flex items-center gap-2 pl-8">
    <Label className="text-fs-xs text-muted-foreground">Until</Label>
    <input
     type="date"
     value={vacationUntil}
     onChange={(e) => setVacationUntil(e.target.value)}
     onBlur={() => savePrefs({ vacation_until: vacationUntil })}
     className="h-9 px-3 rounded-lg border border-input bg-background text-fs-sm"
    />
   </div>
  )}
  <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
   <div className="flex items-start gap-3">
    <Eye className="w-5 h-5 text-primary mt-0.5" />
    <div>
     <Label htmlFor="show-public" className="text-fs-sm font-semibold text-heading cursor-pointer">Show availability on public profile</Label>
     <p className="text-fs-xs text-muted-foreground">Display your weekly schedule to customers visiting your profile.</p>
    </div>
   </div>
   <Switch
    id="show-public"
    checked={showPublic}
    disabled={savingPrefs}
    onCheckedChange={(v) => { setShowPublic(!!v); savePrefs({ show_availability_public: !!v }); }}
   />
  </div>
 </div>

 {/* Weekly schedule */}
 <div className="bg-card rounded-sm border border-border p-6">
 <Heading level={3}  className="mb-5 flex items-center gap-2">
 <Clock className="w-5 h-5 text-primary" />
 Weekly Schedule
 </Heading>

 <div className="space-y-4">
 {DAYS.map((day, i) => {
 const daySlots = slots.filter((s) => s.day_of_week === i);
 return (
 <div key={day} className="flex flex-col sm:flex-row sm:items-start gap-2">
 <div className="w-28 shrink-0 pt-1">
 <span className="text-fs-sm font-medium text-heading">{day}</span>
 </div>
 <div className="flex-1 space-y-1.5">
 {daySlots.length === 0 && addingDay !== i && (
 <span className="text-fs-xs text-muted-foreground">Not available</span>
 )}
 {daySlots.map((slot) => (
 <div key={slot.id} className="inline-flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5 mr-2">
 <span className="text-fs-xs font-medium text-secondary-foreground">
 {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
 </span>
 <Button
   type="button"
   variant="ghost"
   size="icon-sm"
   aria-label="Delete slot"
   onClick={() => deleteSlot(slot.id)}
   className="h-5 w-5 min-h-0 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent [&_svg]:size-3"
 >
   <Trash2 />
 </Button>
 </div>
 ))}

 {addingDay === i ? (
 <div className="flex items-center gap-2 flex-wrap">
 <input
 type="time"
 value={newSlot.start}
 onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
 className="h-8 px-2 rounded border border-input bg-background text-fs-xs"
 />
 <span className="text-fs-xs text-muted-foreground">to</span>
 <input
 type="time"
 value={newSlot.end}
 onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
 className="h-8 px-2 rounded border border-input bg-background text-fs-xs"
 />
 <Button size="sm" variant="default" className="text-fs-xs px-2" onClick={() => addSlot(i)}>Add</Button>
 <Button size="sm" variant="ghost" className="text-fs-xs px-2" onClick={() => setAddingDay(null)}>Cancel</Button>
 </div>
 ) : (
 <Button
   type="button"
   variant="link"
   onClick={() => setAddingDay(i)}
   className="h-auto p-0 gap-1 text-fs-xs text-primary"
 >
   <Plus className="w-3 h-3" /> Add hours
 </Button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Blocked dates */}
 <div className="bg-card rounded-sm border border-border p-6">
 <Heading level={3}  className="mb-5 flex items-center gap-2">
 <CalendarOff className="w-5 h-5 text-destructive" />
 Days Off
 </Heading>

 <div className="grid md:grid-cols-2 gap-6">
 <div>
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={setSelectedDate}
 disabled={(date) => date < new Date()}
 modifiers={{ blocked: blockedDateValues }}
 modifiersClassNames={{ blocked:"bg-destructive/15 text-destructive font-semibold" }}
 className={cn("p-3 pointer-events-auto rounded-lg border border-border/40")}
 />

 {selectedDate && (
 <div className="mt-3 space-y-2">
 <input
 type="text"
 value={blockReason}
 onChange={(e) => setBlockReason(e.target.value)}
 placeholder="Reason (optional)"
 className="w-full h-9 px-3 rounded-lg border border-input bg-background text-fs-sm"
 />
 <Button size="sm" variant="destructive" className="w-full gap-1.5" onClick={blockDate}>
 <CalendarOff className="w-4 h-4" />
 Block {format(selectedDate,"MMM d")}
 </Button>
 </div>
 )}
 </div>

 <div>
 <Heading level={4}  className="mb-3">Blocked Dates</Heading>
 {blockedDates.length === 0 ? (
 <p className="text-fs-xs text-muted-foreground">No blocked dates. Select a date on the calendar to mark it as unavailable.</p>
 ) : (
 <div className="space-y-2 max-h-72 overflow-y-auto">
 {blockedDates.map((d) => (
 <div key={d.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
 <div>
 <p className="text-fs-sm font-medium text-heading">
 {format(new Date(d.blocked_date +"T00:00:00"),"EEE, MMM d, yyyy")}
 </p>
 {d.reason && <p className="text-fs-xs text-muted-foreground">{d.reason}</p>}
 </div>
 <Button
   type="button"
   variant="ghost"
   size="icon-sm"
   aria-label="Unblock date"
   onClick={() => unblockDate(d.id)}
   className="h-6 w-6 min-h-0 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent [&_svg]:size-3.5"
 >
   <Trash2 />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default AvailabilityManager;
