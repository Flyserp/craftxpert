import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare, Image, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import LeaveReviewModal from "@/components/reviews/LeaveReviewModal";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  before_photos: string[] | null;
  after_photos: string[] | null;
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  created_at: string;
  booking_id: string;
  vendor_id: string;
  vendor_name?: string;
  service_title?: string;
}

const MyReviewsPage = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(reviews, 10);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("reviews")
        .select("*, bookings!inner(service_id, vendor_id)")
        .order("created_at", { ascending: false });
      q = q.eq("customer_id", user.id);
      const { data } = await q;

      if (!data) { setLoading(false); return; }

      const providerIds = [...new Set(data.map((r: any) => r.vendor_id))];
      const serviceIds = [...new Set(data.map((r: any) => r.bookings?.service_id).filter(Boolean))];

      const [profilesRes, servicesRes] = await Promise.all([
        providerIds.length ? supabase.from("profiles").select("user_id, display_name").in("user_id", providerIds) : { data: [] },
        serviceIds.length ? supabase.from("vendor_services").select("id, title").in("id", serviceIds) : { data: [] },
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.user_id, p.display_name]));
      const serviceMap = Object.fromEntries((servicesRes.data || []).map((s: any) => [s.id, s.title]));

      setReviews(data.map((r: any) => ({
        ...r,
        vendor_name: profileMap[r.vendor_id] || "Provider",
        service_title: serviceMap[r.bookings?.service_id] || "Service",
      })));
      setLoading(false);
    };
    fetch();
  }, [user, refreshKey]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    setDeletingId(null);
    if (error) { toast.error("Could not delete review"); return; }
    toast.success("Review deleted");
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />
      ))}
    </div>
  );

  const photoCount = (r: Review) => (r.before_photos?.length || 0) + (r.after_photos?.length || 0);

  return (
    <DashboardLayout title="My Reviews" subtitle="All your past ratings and feedback">
      <div className="space-y-4 pb-24">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-sm" />)
        ) : reviews.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">You haven't left any reviews yet.</CardContent></Card>
        ) : (
          pageItems.map(r => {
            const expanded = expandedId === r.id;
            return (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-fs-sm truncate">{r.vendor_name}</p>
                      <p className="text-fs-xs text-muted-foreground truncate">{r.service_title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {renderStars(r.rating)}
                      <span className="text-[13px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {r.comment && <p className="text-fs-sm text-foreground/80">{expanded ? r.comment : r.comment.slice(0, 120)}{!expanded && r.comment.length > 120 ? "…" : ""}</p>}

                  <div className="flex items-center gap-3 text-fs-xs text-muted-foreground">
                    {photoCount(r) > 0 && (
                      <span className="flex items-center gap-1"><Image className="h-3.5 w-3.5" />{photoCount(r)} photo{photoCount(r) > 1 ? "s" : ""}</span>
                    )}
                    {r.vendor_reply && (
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />Provider replied</span>
                    )}
                  </div>

                  {expanded && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      {(r.before_photos?.length || 0) > 0 && (
                        <div>
                          <p className="text-fs-xs font-medium mb-1">Before</p>
                          <div className="flex gap-2 overflow-x-auto">{r.before_photos!.map((url, i) => <img key={i} src={url} className="h-20 w-20 rounded-lg object-cover shrink-0" />)}</div>
                        </div>
                      )}
                      {(r.after_photos?.length || 0) > 0 && (
                        <div>
                          <p className="text-fs-xs font-medium mb-1">After</p>
                          <div className="flex gap-2 overflow-x-auto">{r.after_photos!.map((url, i) => <img key={i} src={url} className="h-20 w-20 rounded-lg object-cover shrink-0" />)}</div>
                        </div>
                      )}
                      {r.vendor_reply && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-fs-xs font-medium mb-1">Provider Reply</p>
                          <p className="text-fs-sm">{r.vendor_reply}</p>
                          {r.vendor_reply_at && <p className="text-[13px] text-muted-foreground mt-1">{format(new Date(r.vendor_reply_at), "MMM d, yyyy")}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {(r.comment && r.comment.length > 120 || photoCount(r) > 0 || r.vendor_reply) && (
                    <Button variant="ghost" size="sm" className="w-full text-fs-xs" onClick={() => setExpandedId(expanded ? null : r.id)}>
                      {expanded ? <><ChevronUp className="h-3 w-3 mr-1" />Less</> : <><ChevronDown className="h-3 w-3 mr-1" />More</>}
                    </Button>
                  )}
                  {user?.id && (
                    <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-fs-xs"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />Edit review
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-fs-xs text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Your rating and comment will be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deletingId === r.id}
                            onClick={() => handleDelete(r.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        {!loading && reviews.length > 0 && (
          <NumberedPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            pageSize={pageSize}
          onPageSizeChange={setPageSize}
          />
        )}
      </div>
      {editing && (
        <LeaveReviewModal
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          bookingId={editing.booking_id}
          providerId={editing.vendor_id}
          providerName={editing.vendor_name}
          existingReview={{ id: editing.id, rating: editing.rating, comment: editing.comment }}
          onReviewSubmitted={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
        />
      )}
    </DashboardLayout>
  );
};

export default MyReviewsPage;
