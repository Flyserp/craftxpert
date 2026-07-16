import { Link } from "react-router-dom";
import { Heart, MessageSquare, Star, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Heading } from "@/components/ui/app";

interface FavoriteItem {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}
export const FavoritesWidget = ({ items, total }: { items: FavoriteItem[]; total: number }) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <header className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-500" />
        <Heading level={3} >Favorite Providers</Heading>
      </div>
      <span className="text-fs-xs text-muted-foreground">{total}</span>
    </header>
    {items.length === 0 ? (
      <p className="text-fs-xs text-muted-foreground py-3">No saved providers yet.</p>
    ) : (
      <ul className="space-y-2">
        {items.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link to={`/provider/${p.id}`} className="flex items-center gap-2 text-fs-xs hover:bg-muted/50 rounded-sm p-1.5">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted" />
              )}
              <span className="font-medium text-heading truncate">{p.display_name || "Provider"}</span>
            </Link>
          </li>
        ))}
      </ul>
    )}
    <Link to="/saved-providers" className="block mt-3 text-fs-xs font-medium text-primary hover:underline text-center">
      View all
    </Link>
  </section>
);

interface MessageItem {
  id: string;
  body: string | null;
  created_at: string;
  sender_name?: string | null;
}
export const MessagesWidget = ({ messages, unread }: { messages: MessageItem[]; unread: number }) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <header className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <Heading level={3} >Messages</Heading>
      </div>
      {unread > 0 && (
        <span className="text-fs-2xs font-semibold bg-primary text-primary-foreground rounded-sm px-2 py-0.5">
          {unread}
        </span>
      )}
    </header>
    {messages.length === 0 ? (
      <p className="text-fs-xs text-muted-foreground py-3">No recent messages.</p>
    ) : (
      <ul className="space-y-2">
        {messages.slice(0, 3).map((m) => (
          <li key={m.id} className="text-fs-xs">
            <p className="font-medium text-heading truncate">{m.sender_name || "Conversation"}</p>
            <p className="text-muted-foreground truncate">{m.body || "Attachment"}</p>
          </li>
        ))}
      </ul>
    )}
    <Link to="/chat" className="block mt-3 text-fs-xs font-medium text-primary hover:underline text-center">
      Open inbox
    </Link>
  </section>
);

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
export const ReviewsWidget = ({ reviews }: { reviews: ReviewItem[] }) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <header className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        <Heading level={3} >My Reviews</Heading>
      </div>
      <span className="text-fs-xs text-muted-foreground">{reviews.length}</span>
    </header>
    {reviews.length === 0 ? (
      <p className="text-fs-xs text-muted-foreground py-3">You haven't reviewed any services yet.</p>
    ) : (
      <ul className="space-y-2">
        {reviews.slice(0, 3).map((r) => (
          <li key={r.id} className="text-fs-xs">
            <div className="flex items-center gap-1 mb-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < r.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`} />
              ))}
            </div>
            <p className="text-muted-foreground truncate">{r.comment || "No comment"}</p>
          </li>
        ))}
      </ul>
    )}
    <Link to="/my-reviews" className="block mt-3 text-fs-xs font-medium text-primary hover:underline text-center">
      Manage reviews
    </Link>
  </section>
);

interface NotificationItem {
  id: string;
  title: string;
  created_at: string;
  read_at: string | null;
}
export const NotificationsWidget = ({ items, unread }: { items: NotificationItem[]; unread: number }) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <header className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        <Heading level={3} >Notifications</Heading>
      </div>
      {unread > 0 && (
        <span className="text-fs-2xs font-semibold bg-primary text-primary-foreground rounded-sm px-2 py-0.5">
          {unread} new
        </span>
      )}
    </header>
    {items.length === 0 ? (
      <p className="text-fs-xs text-muted-foreground py-3">You're all caught up.</p>
    ) : (
      <ul className="space-y-2">
        {items.slice(0, 4).map((n) => (
          <li key={n.id} className="flex items-start gap-2 text-fs-xs">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read_at ? "bg-muted-foreground/40" : "bg-primary"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-heading truncate">{n.title}</p>
              <p className="text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          </li>
        ))}
      </ul>
    )}
    <Link to="/notifications" className="block mt-3 text-fs-xs font-medium text-primary hover:underline text-center">
      View all
    </Link>
  </section>
);