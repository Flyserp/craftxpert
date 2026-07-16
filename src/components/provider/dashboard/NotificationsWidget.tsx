import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Heading } from "@/components/ui/app";

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

interface Props {
  notifications: NotificationItem[];
  unreadCount: number;
}

const NotificationsWidget = ({ notifications, unreadCount }: Props) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        <Heading level={3} >Notifications</Heading>
      </div>
      {unreadCount > 0 && (
        <span className="text-fs-2xs font-semibold bg-primary text-primary-foreground rounded-sm px-2 py-0.5">
          {unreadCount} new
        </span>
      )}
    </div>
    {notifications.length === 0 ? (
      <p className="text-fs-xs text-muted-foreground py-3 text-center">You're all caught up.</p>
    ) : (
      <ul className="space-y-3">
        {notifications.slice(0, 4).map((n) => (
          <li key={n.id} className="flex items-start gap-2 text-fs-xs">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                n.read_at ? "bg-muted-foreground/40" : "bg-primary"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-heading truncate">{n.title}</p>
              <p className="text-muted-foreground truncate">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    )}
    <Link
      to="/notifications"
      className="block mt-3 text-fs-xs font-medium text-primary hover:underline text-center"
    >
      View all
    </Link>
  </section>
);

export default NotificationsWidget;