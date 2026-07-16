import { Link } from "react-router-dom";
import {
  LayoutDashboard, CalendarCheck, Heart, Wallet, Star,
  MessageSquare, Settings, LogOut, User, UserCog,
} from "lucide-react";
import { format } from "date-fns";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  memberSince?: string | null; // ISO date
}

const NAV = [
  { label: "Dashboard", to: "/client-dashboard", icon: LayoutDashboard },
  { label: "Bookings", to: "/my-bookings", icon: CalendarCheck },
  { label: "Favorites", to: "/saved-providers", icon: Heart },
  { label: "Wallet", to: "/wallet", icon: Wallet },
  { label: "Reviews", to: "/my-reviews", icon: Star },
  { label: "Chat", to: "/chat", icon: MessageSquare },
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/client-settings", icon: UserCog },
];

export default function ProfileRail({ memberSince }: Props) {
  const { profile, user, signOut } = useAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Customer";
  const since = memberSince ? format(new Date(memberSince), "MMM yyyy") : null;

  return (
    <aside className="bg-card border border-border rounded-sm overflow-hidden animate-reveal sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* Header banner */}
      <div className="relative h-20 bg-gradient-to-br from-primary to-primary/70">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "14px 14px",
          }}
        />
      </div>

      {/* Avatar + identity */}
      <div className="relative z-10 px-5 -mt-10 pb-5 border-b border-border/50">
        <div className="flex flex-col items-center text-center">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-card shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/15 ring-4 ring-card shadow-md flex items-center justify-center text-fs-xl font-bold text-primary">
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p className="mt-3 text-fs-sm font-semibold text-heading truncate w-full">{name}</p>
          {since && (
            <p className="text-[13px] text-muted-foreground mt-0.5">Member since {since}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2.5 text-[14px]">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/client-dashboard"}
            className="flex items-center gap-3 px-3 py-2 rounded-sm text-[14px] font-medium hover:bg-muted/60 transition-colors"
            activeClassName="bg-primary/10 text-primary"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-[14px] font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </nav>
    </aside>
  );
}
