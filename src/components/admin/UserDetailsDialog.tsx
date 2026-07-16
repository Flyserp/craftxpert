import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState, EmptyState } from "@/components/ui/app";
import { FileCheck2, CreditCard, ListTodo } from "lucide-react";

type Role = "admin" | "provider" | "customer";
type Plan = "free" | "pro" | "elite";
type Status = "active" | "suspended";

export interface DetailsUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  roles: Role[];
  plan?: Plan;
  status: Status;
}

type Tab = "overview" | "verification" | "subscription" | "jobs";

interface Props {
  user: DetailsUser | null;
  initialTab?: Tab;
  onClose: () => void;
}

export default function UserDetailsDialog({ user, initialTab = "overview", onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [verification, setVerification] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTab(initialTab); }, [initialTab, user?.user_id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [v, s, j] = await Promise.all([
        supabase.from("vendor_verifications").select("*").eq("vendor_id", user.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("provider_subscriptions").select("*, subscription_plans(name, price_monthly, interval)").eq("provider_id", user.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("tasks").select("id, title, status, budget_min, budget_max, created_at, payment_status").eq("customer_id", user.user_id).order("created_at", { ascending: false }).limit(25),
      ]);
      if (cancelled) return;
      setVerification(v.data);
      setSubscription(s.data);
      setJobs(j.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.user_id]);

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{(user.display_name ?? "?")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{user.display_name ?? "Unnamed"}</DialogTitle>
              <DialogDescription className="font-mono text-fs-xs">{user.user_id}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 pt-3 text-fs-sm">
            <Row label="Phone" value={user.phone ?? "—"} />
            <Row label="Joined" value={new Date(user.created_at).toLocaleString()} />
            <Row label="Status" value={<Badge variant={user.status === "active" ? "default" : "destructive"} className="capitalize">{user.status}</Badge>} />
            <Row label="Roles" value={
              <div className="flex gap-1 flex-wrap">
                {user.roles.length === 0 ? "—" : user.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                ))}
              </div>
            } />
            <Row label="Plan" value={user.plan ?? "—"} />
          </TabsContent>

          <TabsContent value="verification" className="pt-3">
            {loading ? <LoadingState /> : !verification ? (
              <EmptyState icon={FileCheck2} title="No verification" description="This user has not submitted a verification request." />
            ) : (
              <div className="space-y-2 text-fs-sm">
                <Row label="Status" value={<Badge className="capitalize">{verification.status}</Badge>} />
                <Row label="Business" value={verification.business_name ?? "—"} />
                <Row label="Submitted" value={verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : "—"} />
                {verification.rejection_note && <Row label="Note" value={verification.rejection_note} />}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscription" className="pt-3">
            {loading ? <LoadingState /> : !subscription ? (
              <EmptyState icon={CreditCard} title="No subscription" description="This user has no provider subscription on record." />
            ) : (
              <div className="space-y-2 text-fs-sm">
                <Row label="Plan" value={subscription.subscription_plans?.name ?? "—"} />
                <Row label="Status" value={<Badge className="capitalize">{subscription.status}</Badge>} />
                <Row label="Renews" value={subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"} />
                <Row label="Cancel at period end" value={subscription.cancel_at_period_end ? "Yes" : "No"} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="jobs" className="pt-3">
            {loading ? <LoadingState /> : !jobs || jobs.length === 0 ? (
              <EmptyState icon={ListTodo} title="No jobs" description="This user has not posted any jobs yet." />
            ) : (
              <div className="max-h-80 overflow-auto border border-border rounded-sm">
                <table className="w-full text-fs-sm">
                  <thead className="bg-muted/40 text-fs-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Title</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Budget</th>
                      <th className="text-left px-3 py-2 font-medium">Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-t border-border/60">
                        <td className="px-3 py-2 truncate max-w-[200px]">{j.title}</td>
                        <td className="px-3 py-2"><Badge variant="secondary" className="capitalize">{j.status}</Badge></td>
                        <td className="px-3 py-2 tabular-nums">${j.budget_min ?? 0}–${j.budget_max ?? 0}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(j.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-fs-xs">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}