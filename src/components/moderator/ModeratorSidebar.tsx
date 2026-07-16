import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Flag,
  MessageSquareWarning,
  RefreshCcw,
  FileText,
  ClipboardList,
  Home as HomeIcon,
  LogOut,
  type LucideIcon,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: LucideIcon; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/moderator", icon: LayoutDashboard, end: true },
      { label: "My Inbox", to: "/moderator/inbox", icon: ShieldCheck },
    ],
  },
  {
    label: "Queues",
    items: [
      { label: "Verifications", to: "/moderator/verifications", icon: ShieldCheck },
      { label: "Content Reports", to: "/moderator/reports", icon: Flag },
      { label: "Disputes", to: "/moderator/disputes", icon: MessageSquareWarning },
      { label: "Refund Requests", to: "/moderator/refunds", icon: RefreshCcw },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Response Templates", to: "/moderator/templates", icon: FileText },
      { label: "Audit Log", to: "/moderator/audit", icon: ClipboardList },
    ],
  },
];

export default function ModeratorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 border-b border-sidebar-border px-2 justify-center">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 text-primary shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </span>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-fs-sm font-semibold leading-tight">Moderator</span>
              <span className="text-fs-xs text-muted-foreground leading-tight">Trust &amp; safety</span>
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
                                active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
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
