import { Suspense } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import ModeratorSidebar from "@/components/moderator/ModeratorSidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ResponsiveSidebarProvider from "@/components/layout/ResponsiveSidebarProvider";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/header/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import ProfileMenu from "@/components/header/ProfileMenu";
import PageSkeleton from "@/components/PageSkeleton";

function deriveTitle(pathname: string): string {
  if (pathname === "/moderator" || pathname === "/moderator/") return "Dashboard";
  const last = pathname.split("/").filter(Boolean).pop() || "";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ModeratorLayout() {
  const location = useLocation();
  const title = deriveTitle(location.pathname);

  return (
    <ResponsiveSidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <ModeratorSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-background/80 backdrop-blur flex items-center gap-3 px-4 sticky top-0 z-30">
            <SidebarTrigger className="shrink-0" />
            <Link to="/moderator" className="flex items-center gap-2 min-w-0">
              <Logo className="h-7 w-auto shrink-0" />
              <span className="text-fs-xs font-medium text-muted-foreground hidden sm:inline">Moderator</span>
            </Link>
            <div className="flex items-center gap-1.5 text-fs-sm ml-2">
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-foreground">{title}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <ProfileMenu />
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 p-6 overflow-x-hidden">
            {/* Scoped Suspense keeps sidebar + header mounted; only the content
                area shows a skeleton while the next moderator route's chunk loads. */}
            <Suspense fallback={<PageSkeleton layout="list" withHeader={false} count={6} />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ResponsiveSidebarProvider>
  );
}
