import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NumberedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Optional: total item count to render a "Showing X–Y of Z" caption */
  totalItems?: number;
  pageSize?: number;
  siblingCount?: number;
  /** Provide to render a "Rows per page" selector. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

/**
 * Reusable numbered pagination used across the app.
 * Renders Prev / 1 … N / Next with smart ellipsis windows.
 * When `onPageSizeChange` is provided, also renders a "Rows per page" selector.
 */
const NumberedPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  totalItems,
  pageSize,
  siblingCount = 1,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: NumberedPaginationProps) => {
  const showSizeSelector = !!onPageSizeChange && !!pageSize;

  // Ensure the current pageSize always appears as a valid option, even when
  // a caller passes a non-default initial size (e.g. 6, 12, 15, 25).
  const mergedOptions = (() => {
    if (!pageSize) return pageSizeOptions;
    return pageSizeOptions.includes(pageSize)
      ? pageSizeOptions
      : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  })();

  const sizeSelector = showSizeSelector ? (
    <div className="flex items-center gap-2 text-fs-xs text-muted-foreground">
      <span>Rows per page</span>
      <Select
        value={String(pageSize)}
        onValueChange={(v) => {
          onPageSizeChange?.(Number(v));
          onPageChange(1);
        }}
      >
        <SelectTrigger className="h-8 w-[72px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageSizeOptions.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  if (totalPages <= 1) {
    if (showSizeSelector || (totalItems && pageSize && totalItems > 0)) {
      return (
        <div
          className={cn(
            "flex flex-col items-center gap-3 p-4 sm:flex-row sm:justify-between sm:gap-x-4",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {sizeSelector}
            {totalItems && pageSize && totalItems > 0 && (
              <p className="whitespace-nowrap text-fs-xs text-muted-foreground">
                Showing {totalItems} of {totalItems}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  const getPages = (): (number | "ellipsis-l" | "ellipsis-r")[] => {
    const pages: (number | "ellipsis-l" | "ellipsis-r")[] = [];
    const maxButtons = 5 + siblingCount * 2;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 2 + siblingCount) pages.push("ellipsis-l");
    const start = Math.max(2, currentPage - siblingCount);
    const end = Math.min(totalPages - 1, currentPage + siblingCount);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 1 - siblingCount) pages.push("ellipsis-r");
    pages.push(totalPages);
    return pages;
  };

  const from = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const to = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  const hasMeta = showSizeSelector || (from !== null && to !== null);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-4 sm:flex-row sm:justify-between sm:gap-x-4",
        className,
      )}
    >
      {hasMeta ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {sizeSelector}
          {from !== null && to !== null && (
            <p className="whitespace-nowrap text-fs-xs text-muted-foreground">
              Showing {from}–{to} of {totalItems}
            </p>
          )}
        </div>
      ) : (
        // Spacer to keep pagination right-aligned on desktop when there's no meta.
        <div className="hidden sm:block" />
      )}

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
              className={
                currentPage <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"
              }
            />
          </PaginationItem>

          {getPages().map((page, i) =>
            typeof page === "string" ? (
              <PaginationItem key={`${page}-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => onPageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
              className={
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default NumberedPagination;
