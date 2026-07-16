import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Page meta registered by the currently-rendered page inside DashboardShell.
 * The shell reads it and renders a persistent breadcrumb bar so header +
 * sidebar stay mounted across navigations.
 */
export type PageMeta = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

type PageMetaCtx = {
  setMeta: (meta: PageMeta | null) => void;
  /** True when we're inside a DashboardShell (so legacy DashboardLayout should skip its own chrome). */
  insideShell: boolean;
};

const PageMetaContext = createContext<PageMetaCtx | null>(null);
const PageMetaStateContext = createContext<PageMeta | null>(null);

interface PageMetaProviderProps {
  children: ReactNode;
}

export function PageMetaProvider({ children }: PageMetaProviderProps) {
  const [meta, setMetaState] = useState<PageMeta | null>(null);

  const setMeta = useCallback((m: PageMeta | null) => {
    setMetaState((prev) => {
      if (!prev && !m) return prev;
      if (
        prev &&
        m &&
        prev.title === m.title &&
        prev.subtitle === m.subtitle &&
        prev.actions === m.actions
      ) {
        return prev;
      }
      return m;
    });
  }, []);

  const ctx = useMemo<PageMetaCtx>(
    () => ({ setMeta, insideShell: true }),
    [setMeta],
  );

  return (
    <PageMetaContext.Provider value={ctx}>
      <PageMetaStateContext.Provider value={meta}>
        {children}
      </PageMetaStateContext.Provider>
    </PageMetaContext.Provider>
  );
}

/**
 * Register title / subtitle / actions for the current page. Only takes effect
 * when the page is rendered inside a DashboardShell.
 *
 * Preferred over `<DashboardLayout title=...>` for new pages, but the legacy
 * wrapper is still supported — it forwards to this hook automatically when
 * rendered inside a shell.
 */
export function usePageMeta(meta: PageMeta) {
  const ctx = useContext(PageMetaContext);
  const { title, subtitle, actions } = meta;

  useLayoutEffect(() => {
    if (!ctx?.insideShell) return;
    ctx.setMeta({ title, subtitle, actions });
    return () => ctx.setMeta(null);
  }, [ctx, title, subtitle, actions]);
}

/** True when the caller is rendered inside a DashboardShell. */
export function useIsInsideDashboardShell(): boolean {
  return useContext(PageMetaContext)?.insideShell ?? false;
}

/** Called by DashboardShell to read the currently-registered page meta. */
export function useCurrentPageMeta(): PageMeta | null {
  return useContext(PageMetaStateContext);
}

/** Escape hatch — legacy DashboardLayout uses this to write meta upstream. */
export function usePageMetaSetter() {
  return useContext(PageMetaContext);
}
