import { NavLink, useLocation, useNavigate } from"react-router-dom";
import {
 LayoutDashboard,
 LayoutGrid,
 MapPin,
 RefreshCcw,
 Send,
 Settings,
 FileText,
 CreditCard,
 BarChart3,
 TrendingUp,
 Users,
 Tag,
 MessageSquare,
 ClipboardList,
 AlertTriangle,
 EyeOff,
 Mail,
 MailOpen,
 Bell,
 Gauge,
 ShieldCheck,
 Briefcase,
  Download,
 Home as HomeIcon,
  Megaphone,
  GalleryHorizontal,
  Sparkles,
  Star,
 LogOut,
 type LucideIcon,
} from"lucide-react";
import {
 Sidebar,
 SidebarContent,
 SidebarFooter,
 SidebarGroup,
 SidebarGroupContent,
 SidebarGroupLabel,
 SidebarHeader,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
 useSidebar,
} from"@/components/ui/sidebar";
import { ScrollArea } from"@/components/ui/scroll-area";
import { useAuth } from"@/contexts/AuthContext";
import { cn } from"@/lib/utils";


type NavItem = { label: string; to: string; icon: LucideIcon; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
 {
 label:"Overview",
  items: [
    { label:"Dashboard", to:"/admin", icon: LayoutDashboard, end: true },
    { label:"Moderation Inbox", to:"/admin/inbox", icon: ShieldCheck },
    { label:"Response Templates", to:"/admin/response-templates", icon: FileText },
  ],
 },
 {
 label:"Operations",
 items: [
 { label:"Users", to:"/admin/users", icon: Users },
 { label:"Vendor Verifications", to:"/admin/verifications", icon: ShieldCheck },
 { label:"Jobs", to:"/admin/jobs", icon: Briefcase },
 { label:"Categories", to:"/admin/categories", icon: LayoutGrid },
      { label:"Missing Icons", to:"/admin/categories/missing-icons", icon: AlertTriangle },
      { label:"Taxonomy Audit", to:"/admin/categories/audit", icon: AlertTriangle },
      { label:"Overrides", to:"/admin/categories/overrides", icon: EyeOff },
 { label:"Locations", to:"/admin/locations", icon: MapPin },
 { label:"Coupons", to:"/admin/coupons", icon: Tag },
 ],
 },
 {
 label:"Finance",
 items: [
 { label:"Refund Requests", to:"/admin/refunds", icon: RefreshCcw },
 { label:"Payouts", to:"/admin/withdrawals", icon: Send },
 { label:"Earnings", to:"/admin/earnings", icon: BarChart3 },
 { label:"Payments & Commission", to:"/admin/payments", icon: CreditCard },
 { label:"Subscriptions", to:"/admin/subscriptions", icon: CreditCard },
 { label:"Sponsorships", to:"/admin/sponsorships", icon: Sparkles },
 { label:"Sponsorship Settings", to:"/admin/sponsorships/settings", icon: Sparkles },
 { label:"Service Promotions", to:"/admin/service-promotions", icon: Star },
  { label:"Analytics", to:"/admin/analytics", icon: BarChart3 },
  { label:"Financial Analytics", to:"/admin/financial-analytics", icon: TrendingUp },
 { label:"Payment Settings", to:"/admin/payment-settings", icon: Settings },
 ],
 },
  {
  label:"Reports",
  items: [
  { label:"Export Reports", to:"/admin/exports", icon: Download },
  ],
  },
 {
 label:"Content & Support",
 items: [
 { label:"Pages", to:"/admin/cms", icon: FileText },
  { label:"Homepage", to:"/admin/homepage", icon: HomeIcon },
 { label:"Homepage Sections", to:"/admin/homepage/sections", icon: HomeIcon },

 { label:"Email Templates", to:"/admin/email-templates", icon: MailOpen },
 { label:"Advertisements", to:"/admin/advertisements", icon: Megaphone },
 { label:"Banners", to:"/admin/banners", icon: GalleryHorizontal },
 { label:"Contact Messages", to:"/admin/contact-messages", icon: Mail },
 { label:"Abuse Reports", to:"/admin/disputes", icon: MessageSquare },
 { label:"Moderation", to:"/admin/moderation", icon: ShieldCheck },
 { label:"Audit Log", to:"/admin/audit", icon: ClipboardList },
 { label:"Moderation Audit", to:"/admin/moderation-audit", icon: ShieldCheck },
 { label:"Unknown Invite Roles", to:"/admin/unknown-invite-roles", icon: AlertTriangle },
 ],
 },
 {
 label:"Platform Settings",
 items: [
 { label:"General Settings", to:"/admin/platform-settings", icon: Settings },
 { label:"Notification Policy", to:"/admin/notification-policy", icon: Bell },
 { label:"Push Defaults", to:"/admin/push-defaults", icon: Bell },
 { label:"Notification Logs", to:"/admin/notification-logs", icon: Bell },
 { label:"Bundle Size", to:"/admin/bundle-size", icon: Gauge },
 { label:"Brand Colors", to:"/admin/branding", icon: Settings },
 { label:"Branding Verify", to:"/admin/branding-verify", icon: Settings },
 { label:"Search Ranking", to:"/admin/search-ranking", icon: TrendingUp },
 ],
 },
];

export default function AdminSidebar() {
 const { state } = useSidebar();
 const collapsed = state ==="collapsed";
 const location = useLocation();
 const navigate = useNavigate();
 const { signOut } = useAuth();

 const isActive = (to: string, end?: boolean) =>
 end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to +"/");

 return (
 <Sidebar collapsible="icon">
 <SidebarHeader className="h-14 border-b border-sidebar-border px-2 justify-center">
 <div className={cn("flex items-center gap-2", collapsed &&"justify-center")}>
 <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 text-primary shrink-0">
 <ShieldCheck className="h-4 w-4" />
 </span>
 {!collapsed && (
 <div className="flex flex-col min-w-0">
 <span className="text-fs-sm font-semibold leading-tight">Admin</span>
 <span className="text-fs-xs text-muted-foreground leading-tight">Control panel</span>
 </div>
 )}
 </div>
 </SidebarHeader>

 <SidebarContent className="group-data-[collapsible=icon]:overflow-hidden p-0">
 <ScrollArea className="h-full w-full">
 <div className="flex flex-col gap-2 py-2">
 {groups.map((group) => (
 <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:items-center">
 {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
 <SidebarGroupContent className="group-data-[collapsible=icon]:w-full">
 <SidebarMenu className="group-data-[collapsible=icon]:items-center">
 {group.items.map((item) => {
 const active = isActive(item.to, item.end);
 return (
 <SidebarMenuItem key={item.to} className="group-data-[collapsible=icon]:w-auto">
 <SidebarMenuButton
 asChild
 isActive={active}
 tooltip={item.label}
 className="group-data-[collapsible=icon]:!justify-center"
 >
 <NavLink
 to={item.to}
 end={item.end}
 className={cn(
"flex items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
 active &&"bg-sidebar-accent text-sidebar-accent-foreground font-medium",
 )}
 >
 <item.icon className="h-4 w-4 shrink-0" />
 <span>{item.label}</span>
 </NavLink>
 </SidebarMenuButton>
 </SidebarMenuItem>
 );
 })}
 </SidebarMenu>
 </SidebarGroupContent>
 </SidebarGroup>
 ))}
 </div>
 </ScrollArea>
 </SidebarContent>

 <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:items-center">
 <SidebarMenu className="group-data-[collapsible=icon]:items-center">
 <SidebarMenuItem className="group-data-[collapsible=icon]:w-auto">
 <SidebarMenuButton
 tooltip="Back to site"
 onClick={() => navigate("/")}
 className="group-data-[collapsible=icon]:!justify-center"
 >
 <HomeIcon className="h-4 w-4 shrink-0" />
 <span>Back to site</span>
 </SidebarMenuButton>
 </SidebarMenuItem>
 <SidebarMenuItem className="group-data-[collapsible=icon]:w-auto">
 <SidebarMenuButton
 tooltip="Sign out"
 onClick={async () => {
 await signOut();
 navigate("/");
 }}
 className="text-destructive hover:text-destructive group-data-[collapsible=icon]:!justify-center"
 >
 <LogOut className="h-4 w-4 shrink-0" />
 <span>Sign out</span>
 </SidebarMenuButton>
 </SidebarMenuItem>
 </SidebarMenu>
 </SidebarFooter>
 </Sidebar>
 );
}
