import { ReactNode, useLayoutEffect } from"react";
import {
  usePageMetaSetter,
  useIsInsideDashboardShell,
} from"@/components/layouts/PageMetaContext";
import { useAuth } from"@/contexts/AuthContext";
import { useUnreadMessages } from"@/hooks/useUnreadMessages";
import SubscriptionRenewalBanner from"@/components/provider/SubscriptionRenewalBanner";
import { NavLink } from"@/components/NavLink";
import { useLocation, useNavigate, Link } from"react-router-dom";
import {
 Breadcrumb, BreadcrumbList, BreadcrumbItem,
 BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from"@/components/ui/breadcrumb";
import { Button } from"@/components/ui/button";
import {
 DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
 DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from"@/components/ui/dropdown-menu";
import {
 SidebarProvider, SidebarTrigger, Sidebar, SidebarContent,
 SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
 SidebarMenu, SidebarMenuButton, SidebarMenuItem,
 SidebarFooter, useSidebar,
} from"@/components/ui/sidebar";
import {
 LayoutDashboard, CalendarCheck, Settings, Star,
 BarChart3, ShieldCheck, Search, LogOut, Home, Wrench, Clock,
 ListChecks, CreditCard, DollarSign, Sun, Moon, Bookmark, FileText,
 Bell, ArrowLeft, MessageSquare, Ticket, RotateCcw, Banknote, Users, Layers, ScrollText, Cog, User,
} from"lucide-react";
import { useTheme } from"@/contexts/ThemeContext";
import UnifiedHeader from"@/components/header/UnifiedHeader";
import { Heading } from "@/components/ui/app";

type MenuItem = {
 title: string;
 url: string;
 icon: React.ComponentType<{ className?: string }>;
};

const adminMenu: MenuItem[] = [
 { title:"Overview", url:"/admin", icon: LayoutDashboard },
 { title:"Users", url:"/admin/users", icon: Users },
 { title:"Categories", url:"/admin/categories", icon: Layers },
 { title:"Refunds", url:"/admin/refunds", icon: RotateCcw },
 { title:"Withdrawals", url:"/admin/withdrawals", icon: Banknote },
 { title:"Disputes", url:"/admin/disputes", icon: ShieldCheck },
 { title:"Coupons", url:"/admin/coupons", icon: Ticket },
 { title:"Payments", url:"/admin/payments", icon: CreditCard },
 { title:"Earnings", url:"/admin/earnings", icon: BarChart3 },
 { title:"CMS Pages", url:"/admin/cms", icon: Settings },
 { title:"Audit Log", url:"/admin/audit", icon: ScrollText },
];

const moderatorMenu: MenuItem[] = [
 { title:"Dashboard", url:"/moderator", icon: LayoutDashboard },
 { title:"My Inbox", url:"/moderator/inbox", icon: ShieldCheck },
 { title:"Verifications", url:"/moderator/verifications", icon: ShieldCheck },
 { title:"Content Reports", url:"/moderator/reports", icon: ShieldCheck },
 { title:"Disputes", url:"/moderator/disputes", icon: ShieldCheck },
 { title:"Refund Requests", url:"/moderator/refunds", icon: RotateCcw },
 { title:"Response Templates", url:"/moderator/templates", icon: FileText },
 { title:"Notifications", url:"/notifications", icon: Bell },
 { title:"Settings", url:"/settings", icon: Cog },
];

const providerMenu: MenuItem[] = [
 { title:"Dashboard", url:"/provider-dashboard", icon: LayoutDashboard },
 { title:"Bookings", url:"/provider-bookings", icon: CalendarCheck },
 { title:"Task Feed", url:"/provider-tasks", icon: ListChecks },
 { title:"Saved Jobs", url:"/provider/saved-jobs", icon: Bookmark },
 { title:"Applications", url:"/provider/applications", icon: FileText },
 { title:"Messages", url:"/chat", icon: MessageSquare },
 { title:"Services", url:"/provider-services", icon: Wrench },
 { title:"Reviews", url:"/provider-reviews", icon: Star },
 { title:"Earnings", url:"/provider-earnings", icon: DollarSign },
 { title:"Payments", url:"/provider-payments", icon: CreditCard },
 { title:"Withdrawals", url:"/provider-withdrawals", icon: CreditCard },
 { title:"Availability", url:"/provider-availability", icon: Clock },
 { title:"Profile", url:"/provider-profile", icon: User },
 { title:"Settings", url:"/provider-settings", icon: Cog },
 { title:"Notifications", url:"/notifications", icon: Bell },
];

const clientMenu: MenuItem[] = [
 { title:"Dashboard", url:"/client-dashboard", icon: LayoutDashboard },
 { title:"Bookings", url:"/my-bookings", icon: CalendarCheck },
 { title:"Browse Services", url:"/browse", icon: Search },
 { title:"Messages", url:"/chat", icon: MessageSquare },
 { title:"Saved Pros", url:"/saved-providers", icon: Star },
 { title:"Wallet", url:"/wallet", icon: CreditCard },
 { title:"Reviews", url:"/my-reviews", icon: Star },
 { title:"My Reports", url:"/my-disputes", icon: BarChart3 },
 { title:"Notifications", url:"/notifications", icon: Bell },
 { title:"Profile", url:"/profile", icon: User },
 { title:"Settings", url:"/settings", icon: Cog },
];

const employerMenu: MenuItem[] = [
 { title:"Dashboard", url:"/employer-dashboard", icon: LayoutDashboard },
 { title:"Post a Job", url:"/employer-post-job", icon: FileText },
 { title:"My Jobs", url:"/employer-jobs", icon: ListChecks },
 { title:"Browse Providers", url:"/browse", icon: Search },
 { title:"Messages", url:"/chat", icon: MessageSquare },
 { title:"Saved Pros", url:"/saved-providers", icon: Star },
 { title:"Notifications", url:"/notifications", icon: Bell },
 { title:"Company Profile", url:"/employer-profile", icon: User },
 { title:"Settings", url:"/settings", icon: Cog },
];

function DashboardSidebarContent() {
 const { profile, hasRole, signOut } = useAuth();
 const { state } = useSidebar();
 const { resolved, setTheme } = useTheme();
 const navigate = useNavigate();
 const collapsed = state ==="collapsed";
 const unreadMessages = useUnreadMessages();

 let menu: MenuItem[] = clientMenu;
 let roleLabel ="Client";

 if (hasRole("admin")) { menu = adminMenu; roleLabel ="Super Admin"; }
 else if (hasRole("moderator")) { menu = moderatorMenu; roleLabel ="Moderator"; }
 else if (hasRole("provider")) { menu = providerMenu; roleLabel ="Provider"; }
 else if (hasRole("employer")) { menu = employerMenu; roleLabel ="Employer"; }

 const toggleTheme = () => setTheme(resolved ==="dark" ?"light" :"dark");

 return (
 <Sidebar collapsible="icon" className="border-r border-border/40 top-16 h-[calc(100vh-4rem)]">
 <SidebarContent>
 {!collapsed && (
 <div className="px-4 pt-4 pb-1">
 <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
 <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
 <span className="text-fs-xs font-medium text-primary truncate">{roleLabel}</span>
 </div>
 </div>
 )}

 <SidebarGroup>
 <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
 {collapsed ?"" :"Navigation"}
 </SidebarGroupLabel>
 <SidebarGroupContent>
 <SidebarMenu>
 {menu.map((item) => {
 const isMessages = item.title ==="Messages";
 const badge = isMessages && unreadMessages > 0;
 return (
 <SidebarMenuItem key={item.title}>
 <SidebarMenuButton asChild>
 <NavLink
 to={item.url}
 end={item.url !=="/chat"}
 className="flex items-center gap-3 px-3 py-2 rounded-lg text-fs-sm text-body hover:bg-muted/50 transition-colors"
 activeClassName="bg-primary/10 text-primary font-medium"
 >
 <item.icon className="w-4 h-4 shrink-0" />
 {!collapsed && <span className="flex-1">{item.title}</span>}
 {badge && (
 <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
 {unreadMessages > 99 ?"99+" : unreadMessages}
 </span>
 )}
 </NavLink>
 </SidebarMenuButton>
 </SidebarMenuItem>
 );
 })}
 </SidebarMenu>
 </SidebarGroupContent>
 </SidebarGroup>

 <SidebarGroup>
 <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
 {collapsed ?"" :"Quick Links"}
 </SidebarGroupLabel>
 <SidebarGroupContent>
 <SidebarMenu>
 <SidebarMenuItem>
 <SidebarMenuButton asChild>
 <NavLink
 to="/"
 className="flex items-center gap-3 px-3 py-2 rounded-lg text-fs-sm text-body hover:bg-muted/50 transition-colors"
 >
 <Home className="w-4 h-4 shrink-0" />
 {!collapsed && <span>Home</span>}
 </NavLink>
 </SidebarMenuButton>
 </SidebarMenuItem>
 </SidebarMenu>
 </SidebarGroupContent>
 </SidebarGroup>
 </SidebarContent>

  <SidebarFooter className="border-t border-border/40 p-2">
  <DropdownMenu>
  <DropdownMenuTrigger asChild>
  <button
  className={`w-full flex items-center gap-3 rounded-sm p-2 hover:bg-muted/60 transition-colors text-left ${collapsed ?"justify-center" :""}`}
  >
  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-fs-xs font-semibold text-primary shrink-0">
  {(profile?.display_name ||"U")[0].toUpperCase()}
  </div>
  {!collapsed && (
  <div className="min-w-0 flex-1">
   <div className="text-fs-sm font-medium text-heading truncate">
   {profile?.display_name ||"User"}
   </div>
   <div className="text-[13px] text-muted-foreground truncate">{roleLabel}</div>
  </div>
  )}
  </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="top" align="start" className="w-56">
  <DropdownMenuLabel className="truncate">{profile?.display_name ||"User"}</DropdownMenuLabel>
  <DropdownMenuSeparator />
  <DropdownMenuItem onSelect={() => navigate("/profile") }>
  <User className="w-4 h-4 mr-2" /> Profile
  </DropdownMenuItem>
  <DropdownMenuItem onSelect={() => navigate("/settings") }>
  <Cog className="w-4 h-4 mr-2" /> Settings
  </DropdownMenuItem>
  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
  {resolved ==="dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
  {resolved ==="dark" ?"Light mode" :"Dark mode"}
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onSelect={() => signOut()} className="text-destructive focus:text-destructive">
  <LogOut className="w-4 h-4 mr-2" /> Sign out
  </DropdownMenuItem>
  </DropdownMenuContent>
  </DropdownMenu>
  </SidebarFooter>
 </Sidebar>
 );
}

const breadcrumbMap: Record<string, { parent?: { label: string; href: string }; label: string }> = {
"/admin": { label:"Overview" },
"/admin/payments": { parent: { label:"Admin", href:"/admin" }, label:"Payments" },
"/admin/earnings": { parent: { label:"Admin", href:"/admin" }, label:"Earnings" },
"/admin/cms": { parent: { label:"Admin", href:"/admin" }, label:"CMS Pages" },
"/admin/disputes": { parent: { label:"Admin", href:"/admin" }, label:"Disputes" },
"/admin/coupons": { parent: { label:"Admin", href:"/admin" }, label:"Coupons" },
"/admin/refunds": { parent: { label:"Admin", href:"/admin" }, label:"Refunds" },
"/admin/withdrawals": { parent: { label:"Admin", href:"/admin" }, label:"Withdrawals" },
"/admin/users": { parent: { label:"Admin", href:"/admin" }, label:"Users" },
"/admin/categories": { parent: { label:"Admin", href:"/admin" }, label:"Categories" },
"/admin/audit": { parent: { label:"Admin", href:"/admin" }, label:"Audit Log" },
"/my-disputes": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"My Reports" },
"/provider-dashboard": { label:"Dashboard" },
"/provider-bookings": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Bookings" },
"/provider-services": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Services" },
"/provider-earnings": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Earnings" },
"/provider-availability": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Availability" },
"/provider-profile": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Profile" },
"/provider-settings": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Settings" },
"/provider-withdrawals": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Withdrawals" },
"/provider-reviews": { parent: { label:"Dashboard", href:"/provider-dashboard" }, label:"Reviews" },
"/client-dashboard": { label:"Dashboard" },
"/saved-providers": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"Saved Pros" },
"/my-bookings": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"My Bookings" },
"/wallet": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"Wallet" },
"/my-reviews": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"My Reviews" },
"/settings": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"Settings" },
"/profile": { parent: { label:"Dashboard", href:"/client-dashboard" }, label:"Profile" },
"/notifications": { label:"Notifications" },
};

function DashboardBreadcrumbs({ title }: { title: string }) {
 const location = useLocation();
 const navigate = useNavigate();
 const crumb = breadcrumbMap[location.pathname];

 if (!crumb) {
 return <Heading level={1}  className="truncate">{title}</Heading>;
 }

 return (
 <div className="flex items-center gap-2 min-w-0">
 {crumb.parent && (
 <Button
 variant="ghost"
 size="icon"
 className="shrink-0 h-8 w-8 sm:hidden text-muted-foreground active:scale-95 transition-transform"
 onClick={() => navigate(crumb.parent!.href)}
 aria-label={`Back to ${crumb.parent.label}`}
 >
 <ArrowLeft className="w-4 h-4" />
 </Button>
 )}
 <Breadcrumb className="min-w-0">
 <BreadcrumbList>
 {crumb.parent && (
 <>
 <BreadcrumbItem className="hidden sm:inline-flex">
 <BreadcrumbLink asChild>
 <Link to={crumb.parent.href} className="text-muted-foreground hover:text-foreground text-fs-sm">
 {crumb.parent.label}
 </Link>
 </BreadcrumbLink>
 </BreadcrumbItem>
 <BreadcrumbSeparator className="hidden sm:list-item" />
 </>
 )}
 <BreadcrumbItem>
 <BreadcrumbPage className="text-fs-sm font-semibold text-heading truncate">
 {crumb.label}
 </BreadcrumbPage>
 </BreadcrumbItem>
 </BreadcrumbList>
 </Breadcrumb>
 </div>
 );
}

interface DashboardLayoutProps {
 children: ReactNode;
 title: string;
 subtitle?: string;
 actions?: ReactNode;
}

/**
 * Full dashboard chrome (header + sidebar + breadcrumb bar + main).
 * Used directly by DashboardShell so the chrome stays mounted across
 * route transitions while the inner <Outlet /> lazy-loads.
 */
export function DashboardChrome({
 children,
 title,
 subtitle,
 actions,
}: DashboardLayoutProps) {
 const { hasRole } = useAuth();
 const isProvider = hasRole("provider");
 const isClient = !hasRole("admin") && !hasRole("moderator") && !isProvider;
 const hasMobileNav = isProvider || isClient;

 return (
 <SidebarProvider>
 <div className="min-h-screen flex flex-col w-full">
 <UnifiedHeader
 showSearch={false}
 sidebarTrigger={<SidebarTrigger className="text-muted-foreground" />}
 />

 <div className="flex flex-1 min-h-0">
 <DashboardSidebarContent />

 <div className="flex-1 flex flex-col min-w-0">
 <div className="h-12 flex items-center gap-4 border-b border-border/30 bg-muted/20 px-6 shrink-0">
 <div className="flex-1 min-w-0">
 <DashboardBreadcrumbs title={title} />
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {actions}
 </div>
 </div>

              <main id="main-content" tabIndex={-1} className={`flex-1 w-full max-w-5xl mx-auto p-6 lg:p-8 ${hasMobileNav ? "pb-28" : ""}`}>
 {isProvider && <SubscriptionRenewalBanner />}
 {subtitle && (
 <p className="text-body mb-6 animate-reveal">{subtitle}</p>
 )}
 {children}
 </main>
 </div>
 </div>

 </div>
 </SidebarProvider>
 );
}

/**
 * Legacy per-page wrapper.
 *
 * If rendered inside a DashboardShell (new pattern), this skips its own
 * chrome and registers the page's title/subtitle/actions upstream so the
 * shell's persistent header/sidebar/breadcrumb bar reflect the current
 * page. This lets us restructure routes without touching every page file.
 *
 * When rendered outside a shell (public / auth pages that still self-wrap),
 * it falls back to rendering the full chrome as before.
 */
export default function DashboardLayout({
 children,
 title,
 subtitle,
 actions,
}: DashboardLayoutProps) {
 const insideShell = useIsInsideDashboardShell();
 const ctx = usePageMetaSetter();

 useLayoutEffect(() => {
 if (!insideShell || !ctx) return;
 ctx.setMeta({ title, subtitle, actions });
 return () => ctx.setMeta(null);
 }, [insideShell, ctx, title, subtitle, actions]);

 if (insideShell) return <>{children}</>;

 return (
 <DashboardChrome title={title} subtitle={subtitle} actions={actions}>
 {children}
 </DashboardChrome>
 );
}

