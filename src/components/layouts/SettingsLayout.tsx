import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { PageShell, type Crumb } from "./PageShell";
import { cn } from "@/lib/utils";

export type SettingsNavItem = { label: string; to: string };

export interface SettingsLayoutProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Sub-nav tabs rendered under the page header. */
  nav?: SettingsNavItem[];
  breadcrumbs?: Crumb[];
  children: ReactNode;
}

/**
 * SettingsLayout — DashboardLayout + PageShell with a horizontal tab nav.
 * Use for any settings surface (account, billing, branding, integrations,
 * notifications) so spacing/header/tabs match across the app.
 */
export function SettingsLayout({
  title = "Settings",
  description,
  actions,
  nav,
  breadcrumbs,
  children,
}: SettingsLayoutProps) {
  const { pathname } = useLocation();

  const subNav = nav && nav.length > 0 ? (
    <nav
      role="tablist"
      aria-label="Settings sections"
      className="flex gap-space-xs overflow-x-auto border-b border-border -mx-space-sm px-space-sm"
    >
      {nav.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <NavLink
            key={item.to}
            to={item.to}
            role="tab"
            aria-selected={active}
            className={cn(
              "px-space-md py-space-sm text-fs-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-fast",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  ) : null;

  return (
    <DashboardLayout title={typeof title === "string" ? title : "Settings"}>
      <PageShell
        breadcrumbs={breadcrumbs ?? [{ label: "Settings" }]}
        title={title}
        description={description}
        actions={actions}
        subNav={subNav}
        width="lg"
      >
        {children}
      </PageShell>
    </DashboardLayout>
  );
}

export default SettingsLayout;