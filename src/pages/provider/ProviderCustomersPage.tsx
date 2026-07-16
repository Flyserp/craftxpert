import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  MessageSquare,
  Search,
  Users,
  CalendarCheck,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";

interface BookingRow {
  customer_id: string;
  booking_date: string;
  status: string;
  total_price: number | null;
}

interface CustomerRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bookingsCount: number;
  completedCount: number;
  totalSpent: number;
  lastBookingDate: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export default function ProviderCustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [messagingId, setMessagingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("customer_id, booking_date, status, total_price")
        .eq("vendor_id", user.id);

      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Aggregate per customer
      const map = new Map<string, CustomerRow>();
      (bookings as BookingRow[]).forEach((b) => {
        const existing = map.get(b.customer_id);
        const price =
          b.status === "completed" ? Number(b.total_price ?? 0) : 0;
        if (!existing) {
          map.set(b.customer_id, {
            id: b.customer_id,
            display_name: "Customer",
            avatar_url: null,
            bookingsCount: 1,
            completedCount: b.status === "completed" ? 1 : 0,
            totalSpent: price,
            lastBookingDate: b.booking_date,
          });
        } else {
          existing.bookingsCount += 1;
          if (b.status === "completed") existing.completedCount += 1;
          existing.totalSpent += price;
          if (b.booking_date > existing.lastBookingDate) {
            existing.lastBookingDate = b.booking_date;
          }
        }
      });

      const ids = Array.from(map.keys());
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", ids);

        profiles?.forEach((p) => {
          const row = map.get(p.user_id);
          if (row) {
            row.display_name = p.display_name?.trim() || "Customer";
            row.avatar_url = p.avatar_url;
          }
        });
      }

      const list = Array.from(map.values()).sort((a, b) =>
        b.lastBookingDate.localeCompare(a.lastBookingDate)
      );
      if (!cancelled) {
        setCustomers(list);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.display_name.toLowerCase().includes(q));
  }, [customers, query]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const totals = useMemo(() => {
    return customers.reduce(
      (acc, c) => {
        acc.bookings += c.bookingsCount;
        acc.revenue += c.totalSpent;
        return acc;
      },
      { bookings: 0, revenue: 0 }
    );
  }, [customers]);

  const handleMessage = async (customerId: string) => {
    if (!user) return;
    setMessagingId(customerId);
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${user.id},participant_2.eq.${customerId}),and(participant_1.eq.${customerId},participant_2.eq.${user.id})`
        )
        .maybeSingle();

      let convoId = existing?.id;
      if (!convoId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ participant_1: user.id, participant_2: customerId })
          .select("id")
          .single();
        if (error) throw error;
        convoId = created.id;
      }
      navigate(`/chat/${convoId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not open chat.";
      toast.error(message);
    } finally {
      setMessagingId(null);
    }
  };

  return (
    <DashboardLayout
      title="Customers"
      subtitle="Everyone who's booked you, with totals and quick access to chat."
    >
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Customers"
          value={customers.length.toString()}
        />
        <StatCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Bookings"
          value={totals.bookings.toString()}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue"
          value={`$${totals.revenue.toFixed(0)}`}
        />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <div className="rounded-sm border border-border bg-card">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading customers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-description-sm">
              {customers.length === 0
                ? "No customers yet. Once you have bookings they'll appear here."
                : "No customers match your search."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 p-3 sm:p-4 hover:bg-accent/40 transition-colors"
              >
                <Avatar className="h-11 w-11 shrink-0">
                  {c.avatar_url && (
                    <AvatarImage src={c.avatar_url} alt={c.display_name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-fs-sm font-semibold">
                    {initials(c.display_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-fs-sm font-semibold text-foreground truncate">
                      {c.display_name}
                    </p>
                    {c.completedCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {c.completedCount} completed
                      </Badge>
                    )}
                  </div>
                  <p className="text-fs-xs text-muted-foreground mt-0.5 truncate">
                    {c.bookingsCount} booking{c.bookingsCount === 1 ? "" : "s"}
                    {" · "}
                    ${c.totalSpent.toFixed(0)} earned
                    {" · last "}
                    {format(new Date(c.lastBookingDate), "MMM d, yyyy")}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMessage(c.id)}
                  disabled={messagingId === c.id}
                  className="shrink-0"
                >
                  {messagingId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Message</span>
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <NumberedPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-fs-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-fs-lg sm:text-fs-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
