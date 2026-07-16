import { ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageShell, type Crumb } from "./PageShell";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface ProfileLayoutProps {
  name: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  cover?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Optional sidebar column (e.g. contact card, stats). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * ProfileLayout — DashboardLayout + PageShell with a cover/avatar header
 * and an optional right-hand aside. Same spacing tokens as the rest of
 * the app, so user/provider/admin profile pages stay visually consistent.
 */
export function ProfileLayout({
  name,
  subtitle,
  avatar,
  cover,
  actions,
  breadcrumbs,
  aside,
  children,
  className,
}: ProfileLayoutProps) {
  return (
    <DashboardLayout title={typeof name === "string" ? name : "Profile"}>
      <PageShell breadcrumbs={breadcrumbs} width="xl">
        <div className={cn("flex flex-col gap-space-xl", className)}>
          <header className="overflow-hidden rounded-sm border border-border bg-card">
            {cover && <div className="h-32 sm:h-40 w-full overflow-hidden bg-muted">{cover}</div>}
            <div className="flex flex-col gap-space-md p-space-lg sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-space-md min-w-0">
                {avatar && <div className="shrink-0">{avatar}</div>}
                <div className="min-w-0">
                  <Heading level={1}  className="text-foreground truncate-1">{name}</Heading>
                  {subtitle && (
                    <p className="mt-space-xs text-fs-sm text-muted-foreground">{subtitle}</p>
                  )}
                </div>
              </div>
              {actions && <div className="flex flex-wrap gap-space-sm">{actions}</div>}
            </div>
          </header>

          {aside ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">
              <div className="lg:col-span-2 min-w-0 flex flex-col gap-space-lg">{children}</div>
              <aside className="lg:col-span-1 flex flex-col gap-space-lg">{aside}</aside>
            </div>
          ) : (
            children
          )}
        </div>
      </PageShell>
    </DashboardLayout>
  );
}

export default ProfileLayout;