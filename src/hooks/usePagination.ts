import { useEffect, useMemo, useState } from "react";

/**
 * Generic client-side pagination hook.
 * - Resets to page 1 when the dataset length or page size changes.
 * - Clamps current page when items shrink below the current page boundary.
 * - Returns `setPageSize` so callers can wire a "Rows per page" selector.
 */
export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems: items.length,
    pageItems,
  };
}
