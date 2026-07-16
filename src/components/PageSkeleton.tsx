import { Skeleton } from "@/components/ui/skeleton";

export type PageSkeletonLayout =
  | "page"       // header + hero + card grid (default, mimics landing/browse)
  | "dashboard"  // header + stats row + table
  | "list"       // header + stacked rows
  | "detail"     // header + hero + two-column detail
  | "cards"      // card grid only (no header)
  | "table";     // table rows only

export interface PageSkeletonProps {
  layout?: PageSkeletonLayout;
  /** Number of skeleton items (rows/cards) to render for list/table/cards layouts. */
  count?: number;
  /** When false, omits the top nav bar skeleton (useful when nested inside a real layout). */
  withHeader?: boolean;
  className?: string;
}

const HeaderBar = () => (
  <div className="border-b border-border">
    <div className="container mx-auto flex items-center justify-between h-16 px-4">
      <Skeleton className="h-8 w-32" />
      <div className="hidden md:flex items-center gap-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>
  </div>
);

const HeroBlock = () => (
  <div className="container mx-auto px-4 py-10 space-y-4">
    <Skeleton className="h-10 w-2/3 max-w-xl" />
    <Skeleton className="h-5 w-1/2 max-w-md" />
    <div className="flex gap-3 pt-2">
      <Skeleton className="h-10 w-28 rounded-md" />
      <Skeleton className="h-10 w-28 rounded-md" />
    </div>
  </div>
);

const StatsRow = () => (
  <div className="container mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
);

const CardGrid = ({ count = 6 }: { count?: number }) => (
  <div className="container mx-auto px-4 pb-16">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border border-border rounded-lg p-4 space-y-3 bg-card"
        >
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ListRows = ({ count = 6 }: { count?: number }) => (
  <div className="container mx-auto px-4 pb-16 space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="border border-border rounded-lg p-4 flex items-center gap-4 bg-card"
      >
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md flex-shrink-0" />
      </div>
    ))}
  </div>
);

const TableRows = ({ count = 8 }: { count?: number }) => (
  <div className="container mx-auto px-4 pb-16">
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-5 gap-4 p-4 border-b border-border bg-muted/40">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      {Array.from({ length: count }).map((_, r) => (
        <div
          key={r}
          className="grid grid-cols-5 gap-4 p-4 border-b border-border last:border-b-0"
        >
          {Array.from({ length: 5 }).map((_, c) => (
            <Skeleton key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const DetailBlock = () => (
  <div className="container mx-auto px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 space-y-4">
      <Skeleton className="h-60 w-full rounded-lg" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  </div>
);

/**
 * App-wide skeleton scaffold shown while lazy chunks or page data load.
 * Replaces the old full-screen splash preloader with content-shaped skeletons.
 */
const PageSkeleton = ({
  layout = "page",
  count,
  withHeader = true,
  className,
}: PageSkeletonProps = {}) => {
  return (
    <div
      className={`min-h-screen bg-background ${className ?? ""}`}
      aria-busy="true"
      aria-label="Loading"
    >
      {withHeader && <HeaderBar />}

      {layout === "page" && (
        <>
          <HeroBlock />
          <CardGrid count={count} />
        </>
      )}

      {layout === "dashboard" && (
        <>
          <div className="container mx-auto px-4 pt-8">
            <Skeleton className="h-8 w-56" />
          </div>
          <StatsRow />
          <TableRows count={count ?? 6} />
        </>
      )}

      {layout === "list" && (
        <>
          <div className="container mx-auto px-4 pt-8 pb-4">
            <Skeleton className="h-8 w-48" />
          </div>
          <ListRows count={count} />
        </>
      )}

      {layout === "detail" && (
        <>
          <HeroBlock />
          <DetailBlock />
        </>
      )}

      {layout === "cards" && <CardGrid count={count} />}
      {layout === "table" && <TableRows count={count} />}
    </div>
  );
};

export default PageSkeleton;
