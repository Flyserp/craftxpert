import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading } from "@/components/ui/app";

export interface RecentBookingItem {
  id: string;
  service_title: string;
  vendor_name: string;
  vendor_id: string;
  vendor_avatar: string | null;
  vendor_email?: string | null;
  cover_image: string | null;
  booking_date: string;
}

interface Props {
  bookings: RecentBookingItem[];
  loading?: boolean;
}

export default function RecentBookingsGrid({ bookings, loading }: Props) {
  return (
    <section className="bg-card border border-border rounded-sm p-5 animate-reveal-delay-1">
      <header className="flex items-center justify-between mb-4">
        <Heading level={3} >Recent Booking</Heading>
        <Link to="/my-bookings" className="text-fs-xs font-medium text-primary hover:underline">View all</Link>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-fs-xs text-muted-foreground py-8 text-center">No bookings yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {bookings.slice(0, 6).map((b) => (
            <Link
              key={b.id}
              to={`/my-bookings/${b.id}`}
              className="group bg-background border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors"
            >
              <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                {b.cover_image ? (
                  <img
                    src={b.cover_image}
                    alt={b.service_title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <MapPin className="w-6 h-6" />
                  </div>
                )}
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-background/90 backdrop-blur text-heading rounded-full px-2 py-0.5">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(b.booking_date), "dd MMM yyyy")}
                </span>
              </div>
              <div className="p-3">
                <p className="text-fs-sm font-semibold text-heading truncate">{b.service_title}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  {b.vendor_avatar ? (
                    <img src={b.vendor_avatar} alt={b.vendor_name} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {b.vendor_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-fs-xs font-medium text-heading truncate">{b.vendor_name}</p>
                    {b.vendor_email && (
                      <p className="text-[10px] text-muted-foreground truncate">{b.vendor_email}</p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
