import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, MessageSquare, CheckCircle, Filter, Search, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

interface Review {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_avatar: string | null;
  before_photos: string[];
  after_photos: string[];
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  service_title: string | null;
}

export default function ProviderReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    if (!user) return;
    setLoading(true);

    let rq = supabase
      .from("reviews")
      .select("id, booking_id, rating, comment, created_at, customer_id, before_photos, after_photos, vendor_reply, vendor_reply_at, vendor_id")
      .order("created_at", { ascending: false });
    rq = rq.eq("vendor_id", user.id);
    const { data: reviewsData } = await rq;

    if (!reviewsData || reviewsData.length === 0) {
      setReviews([]);
      setLoading(false);
      return;
    }

    // Fetch customer profiles & booking service info
    const customerIds = [...new Set(reviewsData.map((r) => r.customer_id))];
    const bookingIds = reviewsData.map((r) => r.booking_id);

    const [custRes, bookingRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", customerIds),
      supabase.from("bookings").select("id, service_id, vendor_services:vendor_services(title)").in("id", bookingIds),
    ]);

    const custMap: Record<string, { name: string; avatar: string | null }> = {};
    (custRes.data || []).forEach((c) => {
      custMap[c.user_id] = { name: c.display_name || "Customer", avatar: c.avatar_url };
    });

    const serviceMap: Record<string, string> = {};
    (bookingRes.data || []).forEach((b: any) => {
      serviceMap[b.id] = b.vendor_services?.title || null;
    });

    setReviews(
      reviewsData.map((r) => ({
        id: r.id,
        booking_id: r.booking_id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        customer_id: r.customer_id,
        customer_name: custMap[r.customer_id]?.name || "Customer",
        customer_avatar: custMap[r.customer_id]?.avatar || null,
        before_photos: r.before_photos || [],
        after_photos: r.after_photos || [],
        vendor_reply: r.vendor_reply || null,
        vendor_reply_at: r.vendor_reply_at || null,
        service_title: serviceMap[r.booking_id] || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [user]);

  const handleReply = async (reviewId: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSubmitting(true);

    try {
      const review = reviews.find((r) => r.id === reviewId);
      const { error } = await supabase
        .from("reviews")
        .update({ vendor_reply: trimmed, vendor_reply_at: new Date().toISOString() })
        .eq("id", reviewId);

      if (error) {
        toast.error("Failed to submit reply.");
        return;
      }

      // Notify customer
      if (review) {
        const { data: vendorProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user!.id)
          .single();

        supabase.from("notifications").insert({
          user_id: review.customer_id,
          type: "info",
          title: "Provider replied to your review",
          message: `${vendorProfile?.display_name || "The provider"} responded: "${trimmed.slice(0, 100)}${trimmed.length > 100 ? "…" : ""}"`,
          metadata: { booking_id: review.booking_id },
        });
      }

      toast.success("Reply posted!");
      setReplyingTo(null);
      setReplyText("");
      fetchReviews();
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering
  const filtered = reviews.filter((r) => {
    if (filter === "replied" && !r.vendor_reply) return false;
    if (filter === "unreplied" && r.vendor_reply) return false;
    if (filter !== "all" && filter !== "replied" && filter !== "unreplied") {
      if (r.rating !== parseInt(filter)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q) ||
        (r.service_title || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 10);

  const avgRating = reviews.length
    ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0;
  const unrepliedCount = reviews.filter((r) => !r.vendor_reply).length;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length ? Math.round((reviews.filter((r) => r.rating === star).length / reviews.length) * 100) : 0,
  }));

  return (
    <DashboardLayout title="Reviews" subtitle="View and respond to all customer reviews.">
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-sm animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Star className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <Heading level={2}  className="mb-1">No reviews yet</Heading>
          <p className="text-description-sm max-w-sm">
            Reviews will appear here once customers rate your completed bookings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
            <div className="bg-card rounded-sm border border-border p-6 flex flex-col items-center justify-center">
              <p className="text-fs-5xl font-bold text-heading tabular-nums leading-none">{avgRating}</p>
              <div className="flex items-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn("w-5 h-5", s <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-border")}
                  />
                ))}
              </div>
              <p className="text-fs-sm text-muted-foreground mt-2">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
              {unrepliedCount > 0 && (
                <Badge variant="secondary" className="mt-3 gap-1">
                  <Clock className="w-3 h-3" />
                  {unrepliedCount} awaiting reply
                </Badge>
              )}
            </div>

            <div className="bg-card rounded-sm border border-border p-6">
              <Heading level={3}  className="mb-4">Rating Distribution</Heading>
              <div className="space-y-2.5">
                {ratingDist.map((d) => (
                  <div key={d.star} className="flex items-center gap-3 text-fs-sm">
                    <span className="w-4 text-right text-muted-foreground tabular-nums">{d.star}</span>
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                    <div className="flex-1">
                      <Progress value={d.pct} className="h-2.5" />
                    </div>
                    <span className="w-8 text-right text-muted-foreground tabular-nums text-fs-xs">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="unreplied">Awaiting Reply</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Review List */}
          {filtered.length === 0 ? (
            <p className="text-description-sm text-center py-8">No reviews match your filter.</p>
          ) : (
            <div className="space-y-4">
              {pageItems.map((r) => (
                <div key={r.id} className="bg-card rounded-sm border border-border p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-fs-sm font-bold text-primary shrink-0">
                        {r.customer_avatar ? (
                          <img src={r.customer_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          r.customer_name[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-fs-sm font-semibold text-heading">{r.customer_name}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified
                          </span>
                          {r.service_title && (
                            <span className="text-[13px] text-muted-foreground">• {r.service_title}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn("w-3.5 h-3.5", s <= r.rating ? "text-amber-400 fill-amber-400" : "text-border")}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-fs-xs text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy")}
                      </span>
                      {r.vendor_reply ? (
                        <Badge variant="outline" className="mt-1 text-[10px] gap-1 block w-fit ml-auto">
                          <CheckCircle className="w-2.5 h-2.5" /> Replied
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1 text-[10px] gap-1 block w-fit ml-auto">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  {r.comment && (
                    <p className="text-description-sm mb-3">{r.comment}</p>
                  )}

                  {/* Before/After Photos */}
                  {(r.before_photos.length > 0 || r.after_photos.length > 0) && (
                    <div className="flex gap-6 mb-3">
                      {r.before_photos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Before</p>
                          <div className="flex gap-1.5">
                            {r.before_photos.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt="Before"
                                className="w-16 h-16 rounded-lg object-cover border border-border/60 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(url, "_blank")}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {r.after_photos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">After</p>
                          <div className="flex gap-1.5">
                            {r.after_photos.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt="After"
                                className="w-16 h-16 rounded-lg object-cover border border-border/60 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(url, "_blank")}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vendor Reply */}
                  {r.vendor_reply && (
                    <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary/40 mt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                        Your reply • {r.vendor_reply_at ? format(new Date(r.vendor_reply_at), "MMM d, yyyy") : ""}
                      </p>
                      <p className="text-description-sm">{r.vendor_reply}</p>
                    </div>
                  )}

                  {/* Reply Action */}
                  {!r.vendor_reply && replyingTo !== r.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 text-fs-xs gap-1.5"
                      onClick={() => { setReplyingTo(r.id); setReplyText(""); }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Write Reply
                    </Button>
                  )}

                  {/* Reply Input */}
                  {replyingTo === r.id && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Write your reply to this review..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="text-fs-sm"
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{replyText.length}/1000</span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-fs-xs"
                            onClick={() => { setReplyingTo(null); setReplyText(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-fs-xs gap-1"
                            disabled={!replyText.trim() || submitting}
                            onClick={() => handleReply(r.id)}
                          >
                            <Send className="w-3 h-3" />
                            {submitting ? "Sending…" : "Post Reply"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setPage}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
