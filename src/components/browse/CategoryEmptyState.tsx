import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Store, ClipboardList, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/app";

interface Props {
  categoryName?: string;
  activeSubcategory?: string;
  /** Provide category slug if you want the "Post a task" CTA prefilled. */
  categorySlug?: string;
}

/**
 * Empty-state shown when a category (or filtered subcategory) has no vendors yet.
 * Guides customers to related actions and invites vendors to add their listing.
 */
export default function CategoryEmptyState({ categoryName, activeSubcategory, categorySlug }: Props) {
  const navigate = useNavigate();
  const label = activeSubcategory && activeSubcategory !== "All"
    ? `${activeSubcategory} (${categoryName})`
    : categoryName || "this category";

  return (
    <div className="animate-reveal">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/40 p-8 md:p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <Heading level={2} className="text-fs-xl font-semibold mb-2">
          No professionals in {label} yet
        </Heading>
        <p className="text-fs-sm text-muted-foreground max-w-lg mx-auto mb-8">
          This category is live but still waiting for its first providers. You can post a task to invite
          professionals directly, browse related categories, or list your own business here.
        </p>

        <div className="grid gap-3 sm:grid-cols-3 text-left mb-8">
          <ActionCard
            icon={ClipboardList}
            title="Post a task"
            body={`Describe what you need in ${categoryName || "this category"} and get matched with providers.`}
            onClick={() =>
              navigate(
                `/post-task${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ""}`
              )
            }
            cta="Post a task"
          />
          <ActionCard
            icon={Store}
            title="Are you a provider?"
            body="List your business in minutes and be the first to show up in this category."
            onClick={() => navigate("/auth?role=vendor")}
            cta="Become a provider"
          />
          <ActionCard
            icon={Bell}
            title="Get notified"
            body="Create a free account and we'll ping you when new providers join this category."
            onClick={() => navigate("/auth")}
            cta="Create account"
          />
        </div>

        <Button variant="outline" asChild className="gap-2">
          <Link to="/browse">
            Browse all services <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  onClick,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  onClick: () => void;
  cta: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col h-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/60 hover:bg-card"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-fs-sm font-semibold text-heading mb-1">{title}</p>
      <p className="text-fs-xs text-muted-foreground mb-3 flex-1">{body}</p>
      <span className="inline-flex items-center gap-1 text-fs-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
        {cta} <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
