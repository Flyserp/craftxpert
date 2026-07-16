import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import {
  DashboardChrome,
} from "@/components/DashboardLayout";
import {
  PageMetaProvider,
  useCurrentPageMeta,
} from "@/components/layouts/PageMetaContext";
import PageSkeleton from "@/components/PageSkeleton";

/**
 * Route-level layout for authenticated dashboards (client / provider /
 * employer / shared authed routes).
 *
 * Keeps the header, sidebar, and breadcrumb bar mounted across internal
 * navigations. Only the content area (<Outlet />) is wrapped in Suspense,
 * so switching between pages shows a scoped skeleton rather than blanking
 * the whole viewport.
 *
 * Nested pages register their title/subtitle/actions via `usePageMeta`, or
 * transparently via the legacy `<DashboardLayout title=...>` wrapper —
 * DashboardLayout detects the shell and forwards meta upstream instead of
 * rendering nested chrome.
 */
function ShellInner() {
  const meta = useCurrentPageMeta();
  return (
    <DashboardChrome
      title={meta?.title ?? ""}
      subtitle={meta?.subtitle}
      actions={meta?.actions}
    >
      <Suspense
        fallback={
          <PageSkeleton
            layout="cards"
            withHeader={false}
            count={6}
            className="pt-2"
          />
        }
      >
        <Outlet />
      </Suspense>
    </DashboardChrome>
  );
}

export default function DashboardShell() {
  return (
    <PageMetaProvider>
      <ShellInner />
    </PageMetaProvider>
  );
}
