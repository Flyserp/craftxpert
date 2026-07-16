import { useNavigate } from"react-router-dom";
import {
 LayoutDashboard,
 User,
 Settings,
 LogOut,
 Shield,
 Briefcase,
 ChevronDown,
 Inbox,
} from"lucide-react";
import { useUnreadMessages } from"@/hooks/useUnreadMessages";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
import { Button } from"@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import { useAuth } from"@/contexts/AuthContext";
import { Badge } from"@/components/ui/badge";

interface ProfileMenuProps {
 /** Optional override for trigger compactness; defaults to compact (avatar only). */
 compact?: boolean;
 className?: string;
}

/**
 * Reusable profile dropdown shown in any app header.
 * Minimal: identity + dashboard, profile, settings, sign out.
 */
export default function ProfileMenu({ compact = true, className }: ProfileMenuProps) {
 const navigate = useNavigate();
 const { user, profile, hasRole, signOut } = useAuth();
 const unreadMessages = useUnreadMessages();

 if (!user) return null;

 const isAdmin = hasRole("admin");
 const isProvider = hasRole("provider");

 // Role-aware dashboard routing: admins → /admin, providers → /provider-dashboard,
 // everyone else (clients/staff) → /client-dashboard.
 const dashboardPath = isAdmin
 ?"/admin"
 : isProvider
 ?"/provider-dashboard"
 :"/client-dashboard";
 const dashboardLabel = isAdmin
 ?"Admin Dashboard"
 : isProvider
 ?"Provider Dashboard"
 :"Customer Dashboard";
 const DashboardIcon = isAdmin ? Shield : isProvider ? Briefcase : LayoutDashboard;

 const profilePath = isAdmin
 ?"/admin"
 : isProvider
 ?"/provider-profile"
 :"/profile";
 const profileLabel = isAdmin ?"Admin Home" :"Profile";
 const settingsPath = isAdmin
 ?"/admin/payment-settings"
 : isProvider
 ?"/provider-settings"
 :"/settings";

 const initial = (profile?.display_name || user.email ||"U").charAt(0).toUpperCase();
 const display = profile?.display_name || user.email?.split("@")[0] ||"User";
 const roleLabel = isAdmin ?"Admin" : isProvider ?"Provider" :"Customer";

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className={`gap-1.5 rounded-full pl-1 pr-1.5 h-10 ${className ??""}`}
 aria-label="Open user menu"
 >
 <Avatar className="h-7 w-7">
 <AvatarImage src={profile?.avatar_url || undefined} />
 <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-semibold">
 {initial}
 </AvatarFallback>
 </Avatar>
 {!compact && (
 <span className="text-fs-sm font-medium truncate max-w-[120px] hidden md:inline">
 {display}
 </span>
 )}
 <ChevronDown className="h-3 w-3 text-muted-foreground" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56 p-0">
 <DropdownMenuLabel className="font-normal px-3 py-2.5">
 <div className="flex items-center justify-between gap-2">
 <p className="text-fs-sm font-medium truncate">{display}</p>
 <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase tracking-wide shrink-0">
 {roleLabel}
 </Badge>
 </div>
 <p className="text-fs-xs text-muted-foreground truncate">{user.email}</p>
 </DropdownMenuLabel>
 <DropdownMenuSeparator className="my-0" />

 <div className="p-1">
 <DropdownMenuItem onClick={() => navigate(dashboardPath)} className="cursor-pointer">
 <DashboardIcon className="w-4 h-4 mr-2" />
 <span className="flex-1 font-medium">{dashboardLabel}</span>
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/chat")} className="cursor-pointer">
 <Inbox className="w-4 h-4 mr-2" />
 <span className="flex-1">Inbox</span>
 {unreadMessages > 0 && (
 <Badge
 variant="destructive"
 className="h-5 min-w-[20px] px-1.5 text-[10px] tabular-nums"
 aria-label={`${unreadMessages} unread messages`}
 >
 {unreadMessages > 99 ?"99+" : unreadMessages}
 </Badge>
 )}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate(profilePath)} className="cursor-pointer">
 <User className="w-4 h-4 mr-2" /> {profileLabel}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate(settingsPath)} className="cursor-pointer">
 <Settings className="w-4 h-4 mr-2" /> Settings
 </DropdownMenuItem>

 <DropdownMenuSeparator />
 <DropdownMenuItem
 onClick={async () => {
 await signOut();
 navigate("/");
 }}
 className="cursor-pointer text-destructive"
 >
 <LogOut className="w-4 h-4 mr-2" /> Sign out
 </DropdownMenuItem>
 </div>
 </DropdownMenuContent>
 </DropdownMenu>
 );
}
