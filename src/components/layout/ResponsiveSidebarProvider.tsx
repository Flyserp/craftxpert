import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";

/**
 * Responsive breakpoints for the app's navigation:
 *   >1200px → expanded sidebar
 *   768–1200px → mini (collapsed-icon) sidebar (60px)
 *   <768px → drawer/offcanvas (handled internally by shadcn Sidebar)
 */
const EXPAND_BREAKPOINT = 1200;

/** Inline CSS vars override shadcn's defaults so collapsed width is exactly 60px. */
const SIDEBAR_STYLE = {
  // Expanded width
  ["--sidebar-width" as string]: "16rem",
  // Mini / collapsed width — 60px as requested
  ["--sidebar-width-icon" as string]: "60px",
  // Mobile drawer width
  ["--sidebar-width-mobile" as string]: "18rem",
} as React.CSSProperties;

/**
 * Auto-expands the sidebar above 1200px and collapses it between
 * 768–1200px. Below 768px, shadcn switches to the mobile drawer
 * automatically (no controlled handling needed for that breakpoint).
 */
function useDesktopAutoCollapse(setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${EXPAND_BREAKPOINT}px)`);
    const apply = () => setOpen(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [setOpen]);
}

/** Closes the mobile drawer whenever the route changes. */
function useCloseMobileOnRouteChange() {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isMobile]);
  return null;
}

function RouteWatcher() {
  useCloseMobileOnRouteChange();
  return null;
}

interface Props {
  children: React.ReactNode;
}

export default function ResponsiveSidebarProvider({ children }: Props) {
  // Default to expanded; the effect immediately syncs to the actual viewport.
  const [open, setOpen] = useState(true);
  useDesktopAutoCollapse(setOpen);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} style={SIDEBAR_STYLE}>
      <RouteWatcher />
      {children}
    </SidebarProvider>
  );
}
