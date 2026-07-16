import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Flag,
  MessageSquareWarning,
  RefreshCcw,
  Inbox,
  Loader2,
} from "lucide-react";

type Counts = {
  mineOpen: number;
  verifications: number;
  reports: number;
  disputes: number;
  refunds: number;
};

export default function ModeratorDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({
    mineOpen: 0,
    verifications: 0,
    reports: 0,
    disputes: 0,
    refunds: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const sb = supabase as any;
      const [mine, ver, rep, dis, ref] = await Promise.all([
        sb
          .from("moderation_assignments")
          .select("entity_id", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .eq("status", "claimed"),
        supabase
          .from("vendor_verifications")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "info_requested"]),
        supabase
          .from("content_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("disputes")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "under_review", "info_requested"]),
        supabase
          .from("refund_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setCounts({
        mineOpen: mine.count ?? 0,
        verifications: ver.count ?? 0,
        reports: rep.count ?? 0,
        disputes: dis.count ?? 0,
        refunds: ref.count ?? 0,
      });
      setLoading(false);
    })();
  }, [user]);

  const tiles = [
    { label: "My open cases", value: counts.mineOpen, icon: Inbox, to: "/moderator/inbox", tone: "text-primary" },
    { label: "Verifications", value: counts.verifications, icon: ShieldCheck, to: "/moderator/verifications", tone: "text-blue-600" },
    { label: "Content reports", value: counts.reports, icon: Flag, to: "/moderator/reports", tone: "text-amber-600" },
    { label: "Disputes", value: counts.disputes, icon: MessageSquareWarning, to: "/moderator/disputes", tone: "text-rose-600" },
    { label: "Refund requests", value: counts.refunds, icon: RefreshCcw, to: "/moderator/refunds", tone: "text-emerald-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Moderator Dashboard</h1>
        <p className="text-description-sm mt-1">
          Your workspace for verifications, reports, disputes, and refunds.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-fs-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                <t.icon className={`h-4 w-4 ${t.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/moderator/inbox">Open my inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/moderator/verifications">Review verifications</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/moderator/reports">Handle reports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/moderator/templates">Response templates</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
