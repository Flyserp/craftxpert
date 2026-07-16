import { ReactNode } from "react";
import { Heading } from "@/components/ui/app";

interface AdminPageProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Lightweight page wrapper for admin pages.
 *
 * Admin pages render INSIDE <AdminLayout /> which already provides the
 * sidebar, header, and main padding. This wrapper only renders the
 * page-level title row + subtitle so we don't double up on chrome.
 */
export default function AdminPage({
  children,
  title,
  subtitle,
  actions,
}: AdminPageProps) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <div className="space-y-6 animate-reveal">
      {hasHeader && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && (
              <Heading level={1}  className="truncate">
                {title}
              </Heading>
            )}
            {subtitle && (
              <p className="text-fs-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
