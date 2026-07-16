import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface AppTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Enable sorting on this column. Provide an accessor or set true to sort by key. */
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  /** Hide on mobile (<sm). Useful for responsive layout. */
  hideOnMobile?: boolean;
}

export interface AppTableProps<T> {
  columns: AppTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string | number;
  emptyState?: React.ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  /** Show a loading skeleton/spinner instead of rows. */
  loading?: boolean;
  /** Enable a search input above the table. Pass fields to search, or a custom filter. */
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: ((row: T) => string)[];
  /** Page size; omit or set 0 to disable pagination. */
  pageSize?: number;
  /** Selection support. */
  selectable?: boolean;
  selectedKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>) => void;
  /** Per-row action menu/buttons rendered in a trailing column. */
  rowActions?: (row: T) => React.ReactNode;
  /** Bulk-action toolbar rendered when selectedKeys.length > 0. */
  bulkActions?: (selected: Array<string | number>) => React.ReactNode;
}

/** Data-driven table with sort, search, pagination, selection, and actions. */
export function AppTable<T>({
  columns,
  data,
  rowKey,
  emptyState,
  className,
  onRowClick,
  loading,
  searchable,
  searchPlaceholder = "Search…",
  searchFields,
  pageSize = 0,
  selectable,
  selectedKeys,
  onSelectionChange,
  rowActions,
  bulkActions,
}: AppTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = React.useState(1);
  const [internalSelected, setInternalSelected] = React.useState<Array<string | number>>([]);
  const selected = selectedKeys ?? internalSelected;
  const setSelected = (next: Array<string | number>) => {
    onSelectionChange ? onSelectionChange(next) : setInternalSelected(next);
  };

  React.useEffect(() => { setPage(1); }, [query, pageSize, data.length]);

  // Filter
  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return data;
    const q = query.toLowerCase();
    const fields = searchFields ?? [(r: T) => JSON.stringify(r)];
    return data.filter((row) => fields.some((f) => String(f(row) ?? "").toLowerCase().includes(q)));
  }, [data, query, searchable, searchFields]);

  // Sort
  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const acc = col.sortAccessor ?? ((r: T) => (r as Record<string, unknown>)[sort.key] as string | number | Date | null | undefined);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = acc(a); const bv = acc(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  // Paginate
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pageRows = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  const toggleSort = (key: string) => {
    setSort((s) =>
      !s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null
    );
  };

  const pageRowKeys = pageRows.map((r, i) => rowKey(r, i));
  const allOnPageSelected = pageRowKeys.length > 0 && pageRowKeys.every((k) => selected.includes(k));
  const toggleSelectAll = () => {
    if (allOnPageSelected) setSelected(selected.filter((k) => !pageRowKeys.includes(k)));
    else setSelected([...new Set([...selected, ...pageRowKeys])]);
  };
  const toggleRow = (k: string | number) => {
    setSelected(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  };

  const totalCols = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className={cn("space-y-3", className)}>
      {(searchable || (bulkActions && selected.length > 0)) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 h-9"
              />
            </div>
          )}
          {bulkActions && selected.length > 0 && (
            <div className="flex items-center gap-2 text-fs-sm">
              <span className="text-muted-foreground">{selected.length} selected</span>
              {bulkActions(selected)}
            </div>
          )}
        </div>
      )}
      <div className="w-full overflow-x-auto rounded-sm border border-border/60">
        <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-10">
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
          )}
          {columns.map((c) => (
            <TableHead
              key={c.key}
              className={cn(c.headerClassName, c.hideOnMobile && "hidden sm:table-cell")}
            >
              {c.sortable ? (
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {c.header}
                  {sort?.key === c.key
                    ? sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    : <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
              ) : c.header}
            </TableHead>
          ))}
          {rowActions && <TableHead className="w-12 text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="text-center py-10">
              <Loader2 className="w-5 h-5 animate-spin inline-block text-muted-foreground" />
            </TableCell>
          </TableRow>
        ) : pageRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={totalCols} className="text-center py-10">
              {emptyState ?? (
                <span className="text-fs-sm text-muted-foreground">No results.</span>
              )}
            </TableCell>
          </TableRow>
        ) : (
          pageRows.map((row, i) => {
            const k = rowKey(row, i);
            const isSelected = selected.includes(k);
            return (
            <TableRow
              key={k}
              data-state={isSelected ? "selected" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {selectable && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRow(k)}
                    aria-label="Select row"
                  />
                </TableCell>
              )}
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(c.className, c.hideOnMobile && "hidden sm:table-cell")}
                >
                  {c.cell(row, i)}
                </TableCell>
              ))}
              {rowActions && (
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {rowActions(row)}
                </TableCell>
              )}
            </TableRow>
            );
          })
        )}
      </TableBody>
        </Table>
      </div>
      {pageSize > 0 && sorted.length > pageSize && (
        <div className="flex items-center justify-between text-fs-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {sorted.length} results
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

