import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import StatsRow from "@/components/admin/withdrawals/StatsRow";
import WithdrawalsTable from "@/components/admin/withdrawals/WithdrawalsTable";
import ReviewDialog from "@/components/admin/withdrawals/ReviewDialog";
import { WithdrawalRow } from "@/components/admin/withdrawals/types";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WithdrawalRow | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false });
    const items = (data as WithdrawalRow[]) || [];
    setRows(items);

    const ids = [...new Set(items.map((r) => r.vendor_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.display_name || "Unknown"; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (profiles[r.vendor_id] || "").toLowerCase();
        if (!name.includes(q) && !r.payment_method.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search, profiles]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const stats = useMemo(() => ({
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    paid: rows.filter((r) => r.status === "paid").length,
    pending_amount: rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0),
  }), [rows]);

  const openDetail = (r: WithdrawalRow) => {
    setSelected(r);
    setOpen(true);
  };

  if (loading) {
    return (
      <AdminPage title="Withdrawal Requests">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Withdrawal Requests" subtitle="Review provider payout requests.">
      <div className="space-y-6">
        <StatsRow
          pending={stats.pending}
          approved={stats.approved}
          paid={stats.paid}
          pendingAmount={stats.pending_amount}
        />

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search provider or method..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <WithdrawalsTable
          rows={pageItems}
          totalRowCount={rows.length}
          profiles={profiles}
          onReview={openDetail}
        />
        <NumberedPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>

      <ReviewDialog
        open={open}
        onOpenChange={setOpen}
        selected={selected}
        profiles={profiles}
        onSaved={load}
      />
    </AdminPage>
  );
}
