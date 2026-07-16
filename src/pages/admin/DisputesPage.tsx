import { useState, useEffect, useMemo } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ADMIN_STATUS_TONES, ADMIN_STAT_ACCENTS } from "@/lib/roleTokens";
import {
  AlertTriangle, Search, Eye, CheckCircle, XCircle,
  Clock, Shield, MessageSquare, CreditCard, Users, HelpCircle,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface Dispute {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  booking_id: string | null;
  type: string;
  subject: string;
  description: string;
  evidence_urls: string[];
  status: string;
  priority: string;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const typeLabels: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  service_quality: { label: "Service Quality", icon: AlertTriangle },
  payment: { label: "Payment Issue", icon: CreditCard },
  behavior: { label: "Behavior", icon: Users },
  other: { label: "Other", icon: HelpCircle },
};

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  open:         { color: ADMIN_STATUS_TONES.warning, icon: Clock },
  under_review: { color: ADMIN_STATUS_TONES.info,    icon: Eye },
  resolved:     { color: ADMIN_STATUS_TONES.settled, icon: CheckCircle },
  dismissed:    { color: ADMIN_STATUS_TONES.neutral, icon: XCircle },
};

const priorityConfig: Record<string, string> = {
  low:    ADMIN_STATUS_TONES.neutral,
  medium: ADMIN_STATUS_TONES.warning,
  high:   ADMIN_STATUS_TONES.danger,
};

export default function DisputesPage() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });
    const items = (data as Dispute[]) || [];
    setDisputes(items);

    // Fetch reporter profiles
    const userIds = [...new Set(items.map((d) => d.reporter_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      (profileData || []).forEach((p: any) => { map[p.user_id] = p.display_name || "Unknown"; });
      setProfiles(map);
    }

    setLoading(false);
  };

  useEffect(() => { fetchDisputes(); }, []);

  const filtered = useMemo(() => {
    return disputes.filter((d) => {
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      if (search && !d.subject.toLowerCase().includes(search.toLowerCase()) &&
          !d.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [disputes, filterStatus, filterType, search]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const stats = useMemo(() => ({
    open: disputes.filter((d) => d.status === "open").length,
    under_review: disputes.filter((d) => d.status === "under_review").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
    dismissed: disputes.filter((d) => d.status === "dismissed").length,
    total: disputes.length,
  }), [disputes]);

  const openDetail = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setAdminNotes(dispute.admin_notes || "");
    setNewStatus(dispute.status);
    setNewPriority(dispute.priority);
    setDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedDispute || !user) return;
    setSaving(true);

    const updates: any = {
      admin_notes: adminNotes.trim() || null,
      status: newStatus,
      priority: newPriority,
    };

    if ((newStatus === "resolved" || newStatus === "dismissed") && selectedDispute.status !== newStatus) {
      updates.resolved_by = user.id;
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("disputes")
      .update(updates)
      .eq("id", selectedDispute.id);

    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Dispute updated");
    setSaving(false);
    setDetailOpen(false);
    fetchDisputes();
  };

  if (loading) {
    return (
      <AdminPage title="Reports & Disputes">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Reports & Disputes" subtitle="Review and resolve user complaints and disputes.">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Open",         value: stats.open,         icon: Clock,       ...ADMIN_STAT_ACCENTS.warning },
            { label: "Under Review", value: stats.under_review, icon: Eye,         ...ADMIN_STAT_ACCENTS.info },
            { label: "Resolved",     value: stats.resolved,     icon: CheckCircle, ...ADMIN_STAT_ACCENTS.primary },
            { label: "Dismissed",    value: stats.dismissed,    icon: XCircle,     ...ADMIN_STAT_ACCENTS.neutral },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal">
              <div className="flex items-center justify-between mb-3">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.accent)} />
                </div>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search disputes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="service_quality">Service Quality</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="behavior">Behavior</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm">
              {disputes.length === 0 ? "No disputes have been reported yet" : "No disputes match your filters"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Subject</th>
                    <th className="text-left py-3 px-5 font-medium">Reporter</th>
                    <th className="text-left py-3 px-5 font-medium">Type</th>
                    <th className="text-left py-3 px-5 font-medium">Priority</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Date</th>
                    <th className="text-right py-3 px-5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((d) => {
                    const typeInfo = typeLabels[d.type] || typeLabels.other;
                    const statusInfo = statusConfig[d.status] || statusConfig.open;
                    return (
                      <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2 min-w-0">
                            <typeInfo.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-heading truncate max-w-[200px]">{d.subject}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-body text-fs-xs">
                          {profiles[d.reporter_id] || "Unknown User"}
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-fs-xs text-muted-foreground">{typeInfo.label}</span>
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant="secondary" className={cn("text-[10px] capitalize", priorityConfig[d.priority])}>
                            {d.priority}
                          </Badge>
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant="secondary" className={cn("text-[10px] capitalize", statusInfo.color)}>
                            {d.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-5 text-fs-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Button variant="ghost" size="sm" className="gap-1 text-fs-xs" onClick={() => openDetail(d)}>
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setPage}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Dispute Details
            </DialogTitle>
          </DialogHeader>
          {selectedDispute && (
            <div className="space-y-5 py-2">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Reporter</Label>
                  <p className="text-fs-sm font-medium text-heading">{profiles[selectedDispute.reporter_id] || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Submitted</Label>
                  <p className="text-fs-sm text-body">{new Date(selectedDispute.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-fs-xs text-muted-foreground">Type</Label>
                  <p className="text-fs-sm text-body capitalize">{(typeLabels[selectedDispute.type] || typeLabels.other).label}</p>
                </div>
                {selectedDispute.booking_id && (
                  <div>
                    <Label className="text-fs-xs text-muted-foreground">Booking ID</Label>
                    <p className="text-fs-xs font-mono text-muted-foreground">{selectedDispute.booking_id.slice(0, 8)}...</p>
                  </div>
                )}
              </div>

              {/* Subject & Description */}
              <div className="space-y-2">
                <Label className="text-fs-xs text-muted-foreground">Subject</Label>
                <p className="text-fs-sm font-semibold text-heading">{selectedDispute.subject}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-fs-xs text-muted-foreground">Description</Label>
                <div className="bg-muted/30 rounded-lg p-4 text-fs-sm text-body leading-relaxed">
                  {selectedDispute.description}
                </div>
              </div>

              {/* Evidence */}
              {selectedDispute.evidence_urls && selectedDispute.evidence_urls.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-fs-xs text-muted-foreground">Evidence ({selectedDispute.evidence_urls.length} files)</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedDispute.evidence_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-fs-xs text-primary underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-border/40" />

              {/* Admin Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Add internal notes about this dispute..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              {selectedDispute.resolved_at && (
                <p className="text-fs-xs text-muted-foreground">
                  Resolved on {new Date(selectedDispute.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Update Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
