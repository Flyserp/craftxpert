import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ProviderReview } from "./types";
import { Heading } from "@/components/ui/app";

interface Props {
  reviews: ProviderReview[];
  avgRating: string;
}

const ReviewsSummary = ({ reviews, avgRating }: Props) => (
  <section className="bg-card rounded-sm border border-border overflow-hidden animate-reveal-delay-2">
    <div className="p-5 border-b border-border/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-400" />
        <Heading level={3} >Reviews Summary</Heading>
        {reviews.length > 0 && (
          <span className="text-fs-xs text-muted-foreground ml-1">({reviews.length} total)</span>
        )}
      </div>
    </div>
    {reviews.length === 0 ? (
      <div className="p-8 text-center">
        <Star className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-description-sm">No reviews yet. Complete jobs to receive ratings!</p>
      </div>
    ) : (
      <>
        {/* Rating distribution */}
        <div className="p-5 border-b border-border/40">
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <p className="text-fs-4xl font-bold text-heading tabular-nums leading-none">{avgRating}</p>
              <div className="flex items-center gap-0.5 mt-2 justify-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={cn("w-3.5 h-3.5", s <= Math.round(Number(avgRating)) ? "text-amber-400 fill-amber-400" : "text-border")} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const pct = Math.round((count / reviews.length) * 100);
                return (
                  <div key={star} className="flex items-center gap-2 text-fs-xs">
                    <span className="w-3 text-right text-muted-foreground tabular-nums">{star}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent reviews */}
        <div className="divide-y divide-border/40">
          {reviews.slice(0, 4).map((r, i) => (
            <div key={i} className="p-5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("w-3.5 h-3.5", s <= r.rating ? "text-amber-400 fill-amber-400" : "text-border")} />
                  ))}
                </div>
                <span className="text-fs-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</span>
              </div>
              {r.comment && <p className="text-description-sm line-clamp-2">{r.comment}</p>}
              {r.vendor_reply && (
                <div className="mt-2 ml-3 pl-3 border-l-2 border-primary/30">
                  <p className="text-fs-xs text-muted-foreground line-clamp-1">
                    <span className="font-medium text-heading">Your reply:</span> {r.vendor_reply}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    )}
  </section>
);

export default ReviewsSummary;
