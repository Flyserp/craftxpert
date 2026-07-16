import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export type Crumb = { label: string; to?: string };

export interface PageShellProps {
  /** Optional breadcrumb trail rendered above the title. */
  breadcrumbs?: Crumb[];
  /** Page title (H1). */
  title?: ReactNode;
  /** Short description rendered under the title. */
  description?: ReactNode;
  /** Right-aligned action buttons / chips. */
  actions?: ReactNode;
  /** Optional secondary nav (tabs / sub-nav) rendered below the header. */
  subNav?: ReactNode;
  /** Footer slot pinned to the bottom of the content container. */
  footer?: ReactNode;
  /** Container width preset. */
  width?: "sm" | "md" | "lg" | "xl" | "full";
  /** Disable horizontal padding (full-bleed). */
  bleed?: boolean;
  className?: string;
  children: ReactNode;
}

const WIDTHS: Record<NonNullable<PageShellProps["width"]>, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

/**
 * PageShell — the single content container every authenticated page renders
 * inside. Provides consistent spacing, breadcrumb, header, sub-nav, and
 * footer slots. Consumed by DashboardLayout, SettingsLayout, ProfileLayout
 * and AdminLayout so spacing/typography stay identical across the app.
 */
export function PageShell({
  breadcrumbs,
  title,
  description,
  actions,
  subNav,
  footer,
  width = "xl",
  bleed = false,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn("flex flex-col min-h-full", className)}>
      <div
        className={cn(
          "w-full mx-auto flex-1",
          WIDTHS[width],
          !bleed && "px-space-lg sm:px-space-xl py-space-xl",
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-space-md">
            <BreadcrumbList>
              {breadcrumbs.map((c, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <BreadcrumbItem key={`${c.label}-${i}`}>
                    {last || !c.to ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <>
                        <BreadcrumbLink asChild>
                          <Link to={c.to}>{c.label}</Link>
                        </BreadcrumbLink>
                        <BreadcrumbSeparator />
                      </>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {(title || description || actions) && (
          <header className="flex flex-col gap-space-md sm:flex-row sm:items-start sm:justify-between mb-space-xl">
            <div className="min-w-0">
              {title && (
                <Heading level={1}  className="text-foreground">
                  {title}
                </Heading>
              )}
              {description && (
                <p className="mt-space-xs text-fs-sm text-muted-foreground measure-lg">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-space-sm shrink-0">
                {actions}
              </div>
            )}
          </header>
        )}

        {subNav && <div className="mb-space-lg">{subNav}</div>}

        <div className="flex flex-col gap-space-lg">{children}</div>
      </div>

      {footer && (
        <footer className="border-t border-border bg-card">
          <div className={cn("w-full mx-auto px-space-lg sm:px-space-xl py-space-md", WIDTHS[width])}>
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}

export default PageShell;