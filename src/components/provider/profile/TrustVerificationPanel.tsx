import { ShieldCheck, BadgeCheck, Phone, Calendar, Briefcase, MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";
import { Heading } from "@/components/ui/app";

interface TrustVerificationPanelProps {
  joinedAt: string;
  hasPhone: boolean;
  completedJobs: number;
  reviewCount: number;
  replyRatePct: number | null;
  avgResponseMinutes: number | null;
}

const formatResponse = (mins: number | null) => {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  if (mins < 60 * 24) return `${(mins / 60).toFixed(1)} h`;
  return `${Math.round(mins / (60 * 24))} d`;
};

export default function TrustVerificationPanel({
  joinedAt, hasPhone, completedJobs, reviewCount, replyRatePct, avgResponseMinutes,
}: TrustVerificationPanelProps) {
  const items = [
    {
      label: "Identity verified",
      value: "Verified",
      icon: <BadgeCheck className="w-4 h-4 text-primary" />,
      ok: true,
    },
    {
      label: "Phone on file",
      value: hasPhone ? "Confirmed" : "Not provided",
      icon: <Phone className="w-4 h-4 text-primary" />,
      ok: hasPhone,
    },
    {
      label: "Member since",
      value: format(new Date(joinedAt), "MMM yyyy"),
      icon: <Calendar className="w-4 h-4 text-primary" />,
      ok: true,
    },
    {
      label: "Completed jobs",
      value: completedJobs > 0 ? `${completedJobs}` : "—",
      icon: <Briefcase className="w-4 h-4 text-primary" />,
      ok: completedJobs > 0,
    },
    {
      label: "Reply rate",
      value: replyRatePct != null ? `${replyRatePct}%` : "—",
      icon: <MessageSquare className="w-4 h-4 text-primary" />,
      ok: replyRatePct != null && replyRatePct >= 50,
    },
    {
      label: "Avg response",
      value: formatResponse(avgResponseMinutes),
      icon: <Clock className="w-4 h-4 text-primary" />,
      ok: avgResponseMinutes != null && avgResponseMinutes < 60 * 24,
    },
  ];

  return (
    <div className="bg-card rounded-sm border border-border p-6">
      <Heading level={2}  className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-primary" /> Trust &amp; verification
      </Heading>
      <p className="text-fs-xs text-muted-foreground mb-4">
        Signals we use to keep your booking safe.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/40"
          >
            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] uppercase tracking-wide text-muted-foreground font-medium">
                {item.label}
              </p>
              <p className={`text-fs-sm font-semibold ${item.ok ? "text-heading" : "text-muted-foreground"}`}>
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed">
        Bookings are protected by our payment escrow and dispute resolution. Reviews come only from
        verified, completed bookings — never anonymous comments.
      </p>
    </div>
  );
}
