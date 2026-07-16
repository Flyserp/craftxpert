import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft, Users, Star, MessageSquare, Check, X, BookmarkCheck,
  DollarSign, Calendar, Clock, Scale,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptProposal, declineProposal, shortlistProposal,
} from "@/lib/taskProposals";

type ApplicantStatus = "pending" | "shortlisted" | "accepted" | "rejected";

interface Applicant {
  id: string;
  status: string;
  quoted_price: number | null;
  eta_date: string | null;
  estimated_duration: string | null;
  message: string | null;
  service_id: string | null;
  created_at: string;
  vendor_id: string;
  vendor: {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    business_name: string | null;
  } | null;
  rating: number;
  reviews: number;
}

interface Task {
  id: string;
  title: string;
  customer_id: string;
  status: string;
  preferred_time: string | null;
}

const STATUS_STYLES: Record<ApplicantStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  shortlisted: "bg-blue-100 text-blue-800 border-blue-200",
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

function normalize(s: string): ApplicantStatus {
  if (s === "declined" || s === "withdrawn") return "rejected";
  if (s === "shortlisted") return "shortlisted";
  if (s === "accepted") return "accepted";
  return "pending";
}

export default function EmployerJobApplicantsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | ApplicantStatus>("all");
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const load = async () => {
    if (!taskId || !user) return;
    setLoading(true);
    const { data: t } = await supabase
      .from("tasks").select("id, title, customer_id, status, preferred_time")
      .eq("id", taskId).maybeSingle();
    if (!t || t.customer_id !== user.id) {
      setLoading(false); setTask(null); return;
    }
    setTask(t as Task);

    const { data: rows } = await supabase
      .from("task_proposals")
      .select("id, status, quoted_price, eta_date, estimated_duration, message, service_id, created_at, vendor_id")
      .eq("task_id", taskId)
      .eq("direction", "vendor_applied")
      .order("created_at", { ascending: false });

    const list = (rows ?? []) as any[];
    const vendorIds = list.map((r) => r.vendor_id);
    let ratings: Record<string, { sum: number; count: number }> = {};
    const profileMap: Record<string, Applicant["vendor"]> = {};
    if (vendorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, business_name")
        .in("user_id", vendorIds);
      for (const p of profs ?? []) profileMap[(p as any).user_id] = p as any;
      const { data: revs } = await supabase
        .from("reviews").select("vendor_id, rating").in("vendor_id", vendorIds);
      for (const r of revs ?? []) {
        const k = (r as any).vendor_id;
        ratings[k] = ratings[k] || { sum: 0, count: 0 };
        ratings[k].sum += (r as any).rating;
        ratings[k].count += 1;
      }
    }

    setApplicants(list.map((r) => ({
      ...r,
      vendor: profileMap[r.vendor_id] ?? null,
      rating: ratings[r.vendor_id] ? ratings[r.vendor_id].sum / ratings[r.vendor_id].count : 0,
      reviews: ratings[r.vendor_id]?.count ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId, user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: applicants.length };
    for (const a of applicants) {
      const k = normalize(a.status);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [applicants]);

  const filtered = tab === "all" ? applicants : applicants.filter((a) => normalize(a.status) === tab);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else toast.error("Compare up to 4 applicants at a time");
      return next;
    });
  };

  const handleShortlist = async (a: Applicant) => {
    await shortlistProposal(a.id, a.vendor_id, task?.title ?? "");
    toast.success("Applicant shortlisted");
    load();
  };

  const handleReject = async (a: Applicant) => {
    await declineProposal(a.id, a.vendor_id, task?.title ?? "");
    toast.success("Applicant rejected");
    load();
  };

  const handleHire = async (a: Applicant) => {
    if (!task) return;
    if (!a.service_id || !a.eta_date) {
      toast.error("This applicant didn't include a service or date — cannot create booking.");
      return;
    }
    if (!confirm(`Hire ${a.vendor?.display_name ?? "this applicant"}? Other pending applicants will be declined.`)) return;
    const res = await acceptProposal({
      proposalId: a.id, taskId: task.id, providerId: a.vendor_id,
      customerId: task.customer_id, serviceId: a.service_id,
      quotedPrice: a.quoted_price, etaDate: a.eta_date,
      taskTitle: task.title, preferredTime: task.preferred_time,
    });
    if (res.error) toast.error(res.error);
    else { toast.success("Hired! Booking created."); load(); }
  };

  const compareList = applicants.filter((a) => compareIds.has(a.id));

  return (
    <DashboardLayout
      title={task ? `Applicants — ${task.title}` : "Applicants"}
      subtitle="Review, compare, shortlist, and hire candidates."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/employer-jobs"><ArrowLeft className="h-4 w-4 mr-1" />Back to jobs</Link>
          </Button>
          <Button size="sm" disabled={compareIds.size < 2} onClick={() => setCompareOpen(true)}>
            <Scale className="h-4 w-4 mr-1" />Compare ({compareIds.size})
          </Button>
        </div>
      }
    >
      {loading ? (
        <LoadingState />
      ) : !task ? (
        <EmptyState icon={Users} title="Job not found" description="You don't have access to this job's applicants." />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="flex flex-wrap h-auto">
            {(["all", "pending", "shortlisted", "accepted", "rejected"] as const).map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize gap-1.5">
                {s} <span className="text-fs-xs text-muted-foreground">({counts[s] ?? 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-5">
            {filtered.length === 0 ? (
              <EmptyState icon={Users} title="No applicants" description="No applicants in this category yet." />
            ) : (
              <div className="grid gap-3">
                {filtered.map((a) => {
                  const status = normalize(a.status);
                  const name = a.vendor?.business_name || a.vendor?.display_name || "Applicant";
                  return (
                    <div key={a.id} className="bg-card border border-border rounded-sm p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={compareIds.has(a.id)}
                          onCheckedChange={() => toggleCompare(a.id)}
                          className="mt-1"
                          aria-label="Add to compare"
                        />
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={a.vendor?.avatar_url ?? undefined} />
                          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link to={`/provider/${a.vendor_id}`} className="text-fs-sm font-semibold text-heading hover:text-primary">
                                {name}
                              </Link>
                              <div className="flex items-center gap-2 text-fs-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {a.rating ? a.rating.toFixed(1) : "—"} ({a.reviews})
                                </span>
                                <span>· Applied {format(new Date(a.created_at), "MMM d")}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`capitalize ${STATUS_STYLES[status]}`}>
                              {status}
                            </Badge>
                          </div>

                          {a.message && <p className="text-fs-xs text-foreground/80 mt-2 line-clamp-3">{a.message}</p>}

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-fs-xs text-muted-foreground mt-2">
                            {a.quoted_price !== null && (
                              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${a.quoted_price}</span>
                            )}
                            {a.eta_date && (
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />ETA {format(new Date(a.eta_date + "T00:00:00"), "MMM d")}</span>
                            )}
                            {a.estimated_duration && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.estimated_duration}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/chat?with=${a.vendor_id}`}>
                                <MessageSquare className="w-3.5 h-3.5 mr-1" />Message
                              </Link>
                            </Button>
                            {status !== "shortlisted" && status !== "accepted" && (
                              <Button size="sm" variant="outline" onClick={() => handleShortlist(a)}>
                                <BookmarkCheck className="w-3.5 h-3.5 mr-1" />Shortlist
                              </Button>
                            )}
                            {status !== "accepted" && status !== "rejected" && (
                              <Button size="sm" variant="outline" onClick={() => handleReject(a)}>
                                <X className="w-3.5 h-3.5 mr-1" />Reject
                              </Button>
                            )}
                            {status !== "accepted" && status !== "rejected" && (
                              <Button size="sm" onClick={() => handleHire(a)}>
                                <Check className="w-3.5 h-3.5 mr-1" />Hire
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Compare applicants</DialogTitle></DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-fs-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-fs-xs text-muted-foreground font-medium">Field</th>
                  {compareList.map((a) => (
                    <th key={a.id} className="text-left py-2 pr-3 font-semibold">
                      {a.vendor?.business_name || a.vendor?.display_name || "Applicant"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Status", (a: Applicant) => normalize(a.status)],
                  ["Quote", (a: Applicant) => a.quoted_price !== null ? `$${a.quoted_price}` : "—"],
                  ["ETA", (a: Applicant) => a.eta_date ? format(new Date(a.eta_date + "T00:00:00"), "MMM d, yyyy") : "—"],
                  ["Duration", (a: Applicant) => a.estimated_duration || "—"],
                  ["Rating", (a: Applicant) => a.rating ? `${a.rating.toFixed(1)} (${a.reviews})` : "—"],
                  ["Applied", (a: Applicant) => format(new Date(a.created_at), "MMM d, yyyy")],
                  ["Message", (a: Applicant) => a.message || "—"],
                ].map(([label, get]) => (
                  <tr key={label as string} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 text-muted-foreground capitalize">{label as string}</td>
                    {compareList.map((a) => (
                      <td key={a.id} className="py-2 pr-3 capitalize">{(get as any)(a)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
