import { Link } from "react-router-dom";
import {
  Search, Calendar, Wallet, Star, MessageSquare, Heart, FileText, Receipt,
  LayoutDashboard, Briefcase, BadgeCheck, Crown, Sparkles, TrendingUp, Users,
  Clock, Image as ImageIcon, CreditCard, Bookmark, Send, Building2, ClipboardList,
  Shield, Flag, BarChart3, Megaphone, Tag, Layers, Settings, Mail, Bell, Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import { Heading } from "@/components/ui/app";


type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href?: string;
  accent: string;
};

type RoleGroup = {
  id: string;
  role: string;
  tagline: string;
  features: Feature[];
};

const groups: RoleGroup[] = [
  {
    id: "customer",
    role: "Customer",
    tagline: "Discover, book and manage services with confidence.",
    features: [
      { icon: Search, title: "Browse Services", description: "Search a curated marketplace with smart filters, categories and location.", href: "/browse", accent: "from-sky-500/20 to-blue-500/10" },
      { icon: Users, title: "Provider Marketplace", description: "Explore verified providers with ratings, portfolios and availability.", href: "/providers", accent: "from-violet-500/20 to-fuchsia-500/10" },
      { icon: Calendar, title: "Instant Booking", description: "Book a slot in seconds with real-time availability and deposits.", href: "/browse", accent: "from-emerald-500/20 to-teal-500/10" },
      { icon: ClipboardList, title: "Post a Task", description: "Describe what you need and receive proposals from providers.", href: "/post-task", accent: "from-amber-500/20 to-orange-500/10" },
      { icon: Sparkles, title: "AI Smart Match", description: "Get AI-ranked recommendations tailored to your needs.", href: "/ai-match", accent: "from-pink-500/20 to-rose-500/10" },
      { icon: Wallet, title: "Wallet & Credits", description: "Top up, pay and track every transaction in one place.", href: "/wallet", accent: "from-indigo-500/20 to-blue-500/10" },
      { icon: Receipt, title: "Invoices & Receipts", description: "Download branded PDF invoices and signed receipts.", href: "/my-invoices", accent: "from-slate-500/20 to-zinc-500/10" },
      { icon: Heart, title: "Favorite Providers", description: "Save providers you love and rebook them in one tap.", href: "/saved-providers", accent: "from-rose-500/20 to-red-500/10" },
      { icon: Star, title: "Verified Reviews", description: "Read and leave verified 5-star reviews with photo evidence.", href: "/my-reviews", accent: "from-yellow-500/20 to-amber-500/10" },
      { icon: MessageSquare, title: "Real-time Chat", description: "Message providers directly with file sharing and read receipts.", href: "/chat", accent: "from-cyan-500/20 to-sky-500/10" },
    ],
  },
  {
    id: "provider",
    role: "Provider",
    tagline: "Run your service business end-to-end.",
    features: [
      { icon: LayoutDashboard, title: "Provider Dashboard", description: "Earnings, bookings, leads and conversion at a glance.", href: "/provider-dashboard", accent: "from-emerald-500/20 to-green-500/10" },
      { icon: Briefcase, title: "Service Catalog", description: "Manage services, pricing, images, FAQs and add-ons.", href: "/provider-services", accent: "from-blue-500/20 to-indigo-500/10" },
      { icon: Clock, title: "Availability & Holidays", description: "Set working hours, vacation mode and block slots.", href: "/provider-availability", accent: "from-teal-500/20 to-cyan-500/10" },
      { icon: ImageIcon, title: "Portfolio Gallery", description: "Showcase past work with a lightbox-powered gallery.", href: "/provider-profile", accent: "from-fuchsia-500/20 to-purple-500/10" },
      { icon: BadgeCheck, title: "ID Verification", description: "Submit documents, get verified and earn a trust badge.", href: "/provider-verification", accent: "from-sky-500/20 to-blue-500/10" },
      { icon: Crown, title: "Subscription Plans", description: "Unlock premium features, leads and higher limits.", href: "/provider-subscription", accent: "from-amber-500/20 to-yellow-500/10" },
      { icon: Sparkles, title: "Sponsored Services", description: "Boost a service to the top of search and category pages.", href: "/provider/sponsorships", accent: "from-rose-500/20 to-pink-500/10" },
      { icon: Send, title: "Job Applications", description: "Browse open jobs and submit proposals to employers.", href: "/provider-tasks", accent: "from-indigo-500/20 to-violet-500/10" },
      { icon: Bookmark, title: "Saved Jobs", description: "Bookmark jobs and apply later from a single feed.", href: "/provider/saved-jobs", accent: "from-orange-500/20 to-amber-500/10" },
      { icon: TrendingUp, title: "Earnings & Withdrawals", description: "Track wallet balance, pending payouts and request withdrawals.", href: "/provider-earnings", accent: "from-green-500/20 to-emerald-500/10" },
    ],
  },
  {
    id: "employer",
    role: "Employer",
    tagline: "Post jobs and hire vetted providers fast.",
    features: [
      { icon: Building2, title: "Employer Dashboard", description: "All your jobs, applicants and hires in one workspace.", href: "/employer-dashboard", accent: "from-blue-500/20 to-sky-500/10" },
      { icon: FileText, title: "Post a Job", description: "Pay-per-post job creation with budget, skills and deadlines.", href: "/employer-post-job", accent: "from-violet-500/20 to-indigo-500/10" },
      { icon: Briefcase, title: "Manage Jobs", description: "Edit, pause, close and re-open job posts anytime.", href: "/employer-jobs", accent: "from-emerald-500/20 to-teal-500/10" },
      { icon: Users, title: "Applicant Review", description: "Compare proposals side-by-side and shortlist top providers.", href: "/employer-jobs", accent: "from-amber-500/20 to-orange-500/10" },
      { icon: MessageSquare, title: "Direct Messaging", description: "Chat with applicants and finalize hire details.", href: "/chat", accent: "from-cyan-500/20 to-sky-500/10" },
      { icon: CreditCard, title: "Secure Payments", description: "Deposits and milestone payments with full audit trail.", href: "/employer-dashboard", accent: "from-indigo-500/20 to-blue-500/10" },
    ],
  },
  {
    id: "admin",
    role: "Admin",
    tagline: "Full operational control of the marketplace.",
    features: [
      { icon: LayoutDashboard, title: "Admin Dashboard", description: "Live metrics, activity feed and quick actions.", href: "/admin", accent: "from-slate-500/20 to-zinc-500/10" },
      { icon: Users, title: "User Management", description: "Search, filter, suspend and manage every user.", href: "/admin/users", accent: "from-blue-500/20 to-indigo-500/10" },
      { icon: Shield, title: "Verification Queue", description: "Bulk approve, reject and re-verify providers.", href: "/admin/verifications", accent: "from-emerald-500/20 to-teal-500/10" },
      { icon: BarChart3, title: "Financial Analytics", description: "Revenue, commission and payout breakdowns over time.", href: "/admin/financial-analytics", accent: "from-violet-500/20 to-fuchsia-500/10" },
      { icon: Crown, title: "Subscriptions", description: "Manage provider plans, renewals and upgrades.", href: "/admin/subscriptions", accent: "from-amber-500/20 to-yellow-500/10" },
      { icon: Sparkles, title: "Sponsorships", description: "Approve, extend and monitor sponsored listings.", href: "/admin/sponsorships", accent: "from-rose-500/20 to-pink-500/10" },
      { icon: Layers, title: "Categories & Locations", description: "Hierarchical taxonomy and service-area management.", href: "/admin/categories", accent: "from-cyan-500/20 to-sky-500/10" },
      { icon: Megaphone, title: "Banners & Ads", description: "Schedule banners and track ad clicks across the app.", href: "/admin/banners", accent: "from-orange-500/20 to-red-500/10" },
      { icon: Tag, title: "Coupons", description: "Create promo codes for subscriptions and sponsorships.", href: "/admin/coupons", accent: "from-pink-500/20 to-rose-500/10" },
      { icon: Flag, title: "Moderation & Disputes", description: "Review reports, evidence and resolve disputes fairly.", href: "/admin/moderation", accent: "from-red-500/20 to-rose-500/10" },
      { icon: FileText, title: "CMS & Homepage", description: "Edit static pages, hero, testimonials and footer.", href: "/admin/cms", accent: "from-indigo-500/20 to-blue-500/10" },
      { icon: Mail, title: "Email Templates", description: "Customize every transactional email sent by the platform.", href: "/admin/email-templates", accent: "from-sky-500/20 to-cyan-500/10" },
      { icon: Bell, title: "Admin Notifications", description: "Get notified about signups, jobs, reports and disputes.", href: "/notifications", accent: "from-yellow-500/20 to-amber-500/10" },
      { icon: Globe, title: "Platform Settings", description: "Localization, fees, commissions and site identity.", href: "/admin/platform-settings", accent: "from-teal-500/20 to-emerald-500/10" },
      { icon: Settings, title: "Search Ranking", description: "Tune the weights behind provider and service ranking.", href: "/admin/search-ranking", accent: "from-violet-500/20 to-purple-500/10" },
    ],
  },
];

const FeatureMock = ({
  icon: Icon,
  accent,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
}) => (
  <div
    className={`relative aspect-[16/9] w-full overflow-hidden rounded-sm border bg-gradient-to-br ${accent}`}
    aria-hidden
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--background))_0%,transparent_60%)]" />
    <div className="absolute left-3 top-3 flex gap-1">
      <span className="h-2 w-2 rounded-full bg-red-400/70" />
      <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
      <span className="h-2 w-2 rounded-full bg-green-400/70" />
    </div>
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
      <Icon className="h-9 w-9 text-foreground/80" />
      <span className="text-description-sm font-medium text-foreground/70 line-clamp-1">
        {title}
      </span>
    </div>
  </div>
);

const FeaturesPage = () => {
  return (
    <>
      <SEOHead
        title="Platform Features — Explore Every Capability"
        description="Browse every major feature of the platform grouped by role: Customer, Provider, Employer and Admin. Screenshots, descriptions and direct links."
        canonical="/features"
      />
      <div className="container mx-auto max-w-7xl px-4 py-12 md:py-16">
        <header className="mb-12 max-w-3xl">
          <Badge variant="secondary" className="mb-4">Feature Discovery</Badge>
          <Heading level={1}  className="mb-4">Every feature, organized by who uses it</Heading>
          <p className="text-lead text-muted-foreground">
            Explore the full platform at a glance. Jump straight into any feature
            to see it in action.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                <Button variant="outline" size="sm" className="rounded-sm">
                  {g.role}
                </Button>
              </a>
            ))}
          </nav>
        </header>

        {groups.map((group) => (
          <section key={group.id} id={group.id} className="mb-16 scroll-mt-24">
            <div className="mb-6 flex items-end justify-between gap-4 border-b pb-4">
              <div>
                <Heading level={2}  className="text-subheading">{group.role}</Heading>
                <p className="text-description-sm text-muted-foreground mt-1">
                  {group.tagline}
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {group.features.length} features
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => {
                const card = (
                  <Card className="group h-full overflow-hidden transition-colors hover:border-primary/40">
                    <FeatureMock icon={f.icon} accent={f.accent} title={f.title} />
                    <CardContent className="p-5">
                      <Heading level={3}  className="text-base mb-1.5 line-clamp-1">
                        {f.title}
                      </Heading>
                      <p className="text-description-sm text-muted-foreground line-clamp-3">
                        {f.description}
                      </p>
                      {f.href && (
                        <span className="mt-3 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
                          Open page →
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
                return f.href ? (
                  <Link key={f.title} to={f.href} className="block focus:outline-none">
                    {card}
                  </Link>
                ) : (
                  <div key={f.title}>{card}</div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="rounded-sm border bg-muted/40 p-8 text-center">
          <Heading level={2}  className="text-subheading mb-2">Ready to try it yourself?</Heading>
          <p className="text-description-sm text-muted-foreground mb-5">
            Create an account and explore every feature.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button className="rounded-sm">Create an account</Button>
            </Link>

            <Link to="/docs">
              <Button variant="outline" className="rounded-sm">Read the docs</Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default FeaturesPage;