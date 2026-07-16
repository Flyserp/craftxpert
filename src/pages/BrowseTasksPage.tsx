import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  ClipboardList, MapPin, Calendar, DollarSign, Search, Filter,
  Sparkles, ArrowRight, Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

interface PublicTask {
  id: string;
  title: string;
  description: string;
  address: string;
  preferred_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  category_id: string;
  customer_id: string;
  created_at: string;
  photos: string[] | null;
  category_name?: string;
  customer_name?: string;
}

const POSTED_OPTIONS = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export default function BrowseTasksPage() {
  const { user, hasRole } = useAuth();
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [budgetRange, setBudgetRange] = useState<[number, number]>([0, 5000]);
  const [postedWithin, setPostedWithin] = useState<string>("all");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const [tasksRes, catsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100),
      supabase.from("service_categories").select("id, name").order("sort_order"),
    ]);
    const cats = catsRes.data || [];
    setCategories(cats);
    const catMap = new Map(cats.map((c: any) => [c.id, c.name]));

    const all = (tasksRes.data || []) as PublicTask[];
    const customerIds = [...new Set(all.map(t => t.customer_id))];
    const profiles = customerIds.length
      ? (await supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds)).data || []
      : [];
    const customerMap = new Map(profiles.map((p: any) => [p.user_id, p.display_name]));

    setTasks(all.map(t => ({
      ...t,
      category_name: catMap.get(t.category_id) || "",
      customer_name: customerMap.get(t.customer_id) || "Customer",
    })));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff: Record<string, number> = {
      "24h": 24 * 3600 * 1000,
      "7d": 7 * 24 * 3600 * 1000,
      "30d": 30 * 24 * 3600 * 1000,
    };
    return tasks.filter(t => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      if (categoryId !== "all" && t.category_id !== categoryId) return false;
      const min = t.budget_min ?? 0;
      const max = t.budget_max ?? min;
      if (max < budgetRange[0] || min > budgetRange[1]) return false;
      if (postedWithin !== "all" && cutoff[postedWithin]) {
        if (now - new Date(t.created_at).getTime() > cutoff[postedWithin]) return false;
      }
      return true;
    });
  }, [tasks, search, categoryId, budgetRange, postedWithin]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 12);

  const isVendor = !!user && hasRole("provider");
  const applyHref = (taskId: string) => isVendor ? "/provider-tasks" : `/signup?redirect=/provider-tasks`;
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Browse Open Tasks"
        description={`Explore real customer service requests on ${brand}. See live tasks from homeowners and businesses, then sign up as a professional to apply.`}
        canonical="/browse-tasks"
      />

      <UnifiedHeader showSearch={false} />

      {/* Hero */}
      <section className="border-b border-border/40 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-3 gap-1.5">
                <Sparkles className="w-3 h-3" /> Live marketplace
              </Badge>
              <Heading level={1}  className="mb-2">
                Browse open tasks
              </Heading>
              <p className="text-fs-sm md:text-fs-base text-muted-foreground">
                Real service requests posted by customers. See what jobs are available right now — sign up as a professional to apply and start earning.
              </p>
            </div>
            {!isVendor && (
              <Link to="/signup?redirect=/provider-tasks">
                <Button size="lg" className="gap-2 shrink-0">
                  Become a Pro <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-6 py-8">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* Filter sidebar */}
          <aside className="space-y-5">
            <div>
              <label className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <Search className="w-3 h-3" /> Search
              </label>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="e.g. plumbing, kitchen…"
                className="h-9 text-fs-sm"
              />
            </div>

            <div>
              <label className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <Filter className="w-3 h-3" /> Category
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full h-9 px-3 rounded-sm border border-input bg-background text-fs-sm"
              >
                <option value="all">All categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3 h-3" /> Budget
              </label>
              <div className="px-1">
                <Slider
                  value={budgetRange}
                  onValueChange={(v) => setBudgetRange([v[0], v[1]] as [number, number])}
                  min={0}
                  max={5000}
                  step={50}
                  className="my-3"
                />
                <div className="flex justify-between text-fs-xs text-muted-foreground tabular-nums">
                  <span>${budgetRange[0]}</span>
                  <span>${budgetRange[1]}{budgetRange[1] === 5000 ? "+" : ""}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-fs-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3" /> Posted within
              </label>
              <div className="space-y-1">
                {POSTED_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPostedWithin(opt.value)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-sm text-fs-sm transition-colors",
                      postedWithin === opt.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-fs-xs"
              onClick={() => {
                setSearch(""); setCategoryId("all");
                setBudgetRange([0, 5000]); setPostedWithin("all");
              }}
            >
              Reset filters
            </Button>
          </aside>

          {/* Task list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-fs-sm text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length} open task${filtered.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-sm p-5 h-44 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/60 rounded-sm">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-fs-sm text-muted-foreground">No tasks match your filters.</p>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pageItems.map(t => (
                    <PublicTaskCard key={t.id} task={t} applyHref={applyHref(t.id)} isVendor={isVendor} />
                  ))}
                </div>
                <NumberedPagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setPage}
          onPageSizeChange={setPageSize}
                />
              </>
            )}

            {/* Bottom CTA */}
            {!isVendor && filtered.length > 0 && (
              <div className="mt-10 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-sm p-6 md:p-8 text-center">
                <Heading level={2}  className="mb-2">
                  Ready to win these jobs?
                </Heading>
                <p className="text-fs-sm text-muted-foreground mb-5 max-w-md mx-auto">
                  Sign up as a professional in 2 minutes. Apply to tasks, get hired, and grow your business with {brand}.
                </p>
                <Link to="/signup?redirect=/provider-tasks">
                  <Button size="lg" className="gap-2">
                    Become a Pro <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function PublicTaskCard({
  task, applyHref, isVendor,
}: { task: PublicTask; applyHref: string; isVendor: boolean }) {
  return (
    <div className="bg-card border border-border rounded-sm p-5 hover:border-primary/30 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Heading level={3}  className="line-clamp-1 flex-1">{task.title}</Heading>
        {task.category_name && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">{task.category_name}</Badge>
        )}
      </div>
      <p className="text-fs-xs text-muted-foreground line-clamp-3 mb-3">{task.description}</p>

      {task.photos && task.photos.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {task.photos.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="w-12 h-12 rounded-sm object-cover border border-border" />
          ))}
          {task.photos.length > 3 && (
            <div className="w-12 h-12 rounded-sm bg-muted border border-border flex items-center justify-center text-[10px] text-muted-foreground">
              +{task.photos.length - 3}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 text-fs-xs text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{task.address}</span>
        </div>
        {task.preferred_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{format(new Date(task.preferred_date + "T00:00:00"), "MMM d, yyyy")}</span>
          </div>
        )}
        {task.budget_min !== null && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 shrink-0" />
            <span>Budget: ${task.budget_min}{task.budget_max ? ` – $${task.budget_max}` : "+"}</span>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/60">
        <span className="text-[13px] text-muted-foreground">
          Posted {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </span>
        <Link to={applyHref}>
          <Button size="sm" variant={isVendor ? "default" : "outline"} className="gap-1.5 text-fs-xs">
            {isVendor ? "Apply" : "Sign up to apply"}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
