export interface ProviderBooking {
  id: string;
  status: string;
  booking_date: string;
  total_price: number | null;
  start_time: string;
  end_time: string;
  created_at: string;
  payment_status: string;
  service: { title: string } | null;
  customer_id: string;
}

export interface ProviderReview {
  rating: number;
  comment: string | null;
  created_at: string;
  customer_id: string;
  vendor_reply: string | null;
}

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  accepted: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  confirmed: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

import { Clock, CalendarCheck, CheckCircle, AlertCircle } from "lucide-react";

export const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: CalendarCheck,
  confirmed: CalendarCheck,
  in_progress: Clock,
  completed: CheckCircle,
  cancelled: AlertCircle,
};
