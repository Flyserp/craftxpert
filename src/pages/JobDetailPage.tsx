import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { PageShell } from "@/components/layouts";
import { LoadingState } from "@/components/ui/app/LoadingState";
import EmptyState from "@/components/ui/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { extractJobId, jobUrl } from "@/lib/jobUrl";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import JobLifecycleTimeline from "@/components/jobs/JobLifecycleTimeline";
import { normalizeJobStatus } from "@/components/jobs/jobLifecycle";
import {
  MapPin,
  Calendar,
  DollarSign,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import ReportButton from "@/components/moderation/ReportButton";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

interface JobRow {
  id: string;
  title: string;
  description: string;
  address: string;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_date: string | null;
  created_at: string;
  featured: boolean;
  photos: string[] | null;
  category_id: string;
  service_categories?: { name: string; slug: string | null } | null;
}

export default function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const id = extractJobId(slug);
  const [job, setJob] = useState<JobRow | null>(null);
  const [loading, setLoading] = useState(true);
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";
  const [notFound, setNotFound] = useState(false);
  const [proposalCount, setProposalCount] = useState(0);
  const [hasShortlisted, setHasShortlisted] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [hasDispute, setHasDispute] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,address,status,budget_min,budget_max,preferred_date,created_at,featured,photos,category_id, service_categories(name,slug)")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setJob(data as unknown as JobRow);
        const [propRes, dispRes] = await Promise.all([
          supabase.from("task_proposals").select("status").eq("task_id", data.id),
          supabase.from("disputes").select("id").eq("booking_id", data.id).limit(1),
        ]);
        const props = propRes.data || [];
        setProposalCount(props.length);
        setHasShortlisted(props.some((p: any) => p.status === "shortlisted"));
        setHasAccepted(props.some((p: any) => p.status === "accepted"));
        setHasDispute(((dispRes.data as any[]) || []).length > 0);
      }
      setLoading(false);
    })();
  }, [id]);

  // Rewrite bare-UUID URLs to the clean slug form
  useEffect(() => {
    if (!job) return;
    const expected = jobUrl(job.id, job.title);
    if (window.location.pathname !== expected) {
      window.history.replaceState(null, "", expected);
    }
  }, [job]);

  if (loading) {
    return (
      <PageShell>
        <LoadingState title="Loading job…" />
      </PageShell>
    );
  }

  if (notFound || !job) {
    return (
      <PageShell>
        <SEOHead title="Job not found" description="This job posting is no longer available." />
        <EmptyState
          title="Job not found"
          description="This job posting may have been removed or is no longer public."
          actionLabel="Browse jobs"
          onAction={() => navigate("/browse-tasks")}
        />
      </PageShell>
    );
  }

  const canonicalPath = jobUrl(job.id, job.title);
  const canonicalUrl = `${window.location.origin}${canonicalPath}`;
  const budget =
    job.budget_min && job.budget_max
      ? `$${job.budget_min} – $${job.budget_max}`
      : job.budget_min
      ? `From $${job.budget_min}`
      : job.budget_max
      ? `Up to $${job.budget_max}`
      : "Negotiable";

  const metaDescription =
    (job.description || "").replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Job posting in ${job.address}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.created_at,
    validThrough: job.preferred_date || undefined,
    employmentType: "CONTRACTOR",
    hiringOrganization: {
      "@type": "Organization",
      name: brand,
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", streetAddress: job.address },
    },
    ...(job.budget_min || job.budget_max
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.budget_min ?? undefined,
              maxValue: job.budget_max ?? undefined,
              unitText: "PROJECT",
            },
          },
        }
      : {}),
  };

  const share = (network: "facebook" | "twitter" | "linkedin" | "email" | "copy" | "native") => {
    const url = canonicalUrl;
    const text = `${job.title} – ${budget}`;
    if (network === "copy") {
      navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
      return;
    }
    if (network === "native" && (navigator as any).share) {
      (navigator as any).share({ title: job.title, text, url }).catch(() => {});
      return;
    }
    const targets: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(job.title)}&body=${encodeURIComponent(`${text}\n${url}`)}`,
    };
    window.open(targets[network], "_blank", "noopener,noreferrer");
  };

  return (
    <PageShell>
      <SEOHead
        title={job.title}
        description={metaDescription}
        canonical={canonicalUrl}
        type="article"
        image={job.photos?.[0]}
        jsonLd={jsonLd}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/browse-tasks" className="hover:text-primary">Jobs</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{job.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <article>
          <header className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {job.featured && <Badge variant="secondary">Featured</Badge>}
              <JobStatusBadge
                status={normalizeJobStatus(job.status, { proposalCount, hasShortlisted, hasAccepted, hasDispute })}
              />
              {job.service_categories?.name && (
                <Badge variant="outline">{job.service_categories.name}</Badge>
              )}
            </div>
            <Heading level={1}  className="mb-3">{job.title}</Heading>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.address}</span>
              <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" />{budget}</span>
              {job.preferred_date && (
                <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(job.preferred_date).toLocaleDateString()}</span>
              )}
            </div>
          </header>

          {job.photos && job.photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {job.photos.map((src, i) => (
                <img key={i} src={src} alt={`${job.title} photo ${i + 1}`} loading="lazy" className="w-full h-40 object-cover rounded-sm border border-border" />
              ))}
            </div>
          )}

          <Card className="p-6">
            <Heading level={2}  className="text-subheading mb-3">Job description</Heading>
            <p className="text-body whitespace-pre-wrap">{job.description}</p>
          </Card>
          <div className="mt-3 flex justify-end">
            <ReportButton entityType="task" entityId={job.id} />
          </div>
        </article>

        <aside className="space-y-4">
          <JobLifecycleTimeline
            status={normalizeJobStatus(job.status, { proposalCount, hasShortlisted, hasAccepted, hasDispute })}
            timestamps={{ published: job.created_at }}
          />
          <Card className="p-5">
            <Heading level={3}  className="text-subheading mb-3">Apply for this job</Heading>
            <Button className="w-full" onClick={() => navigate("/login?redirect=" + encodeURIComponent(canonicalPath))}>
              Sign in to apply
            </Button>
            <p className="text-description-sm mt-2">Providers can submit a proposal after signing in.</p>
          </Card>

          <Card className="p-5">
            <Heading level={3}  className="text-subheading mb-3 inline-flex items-center gap-2"><Share2 className="h-4 w-4" />Share this job</Heading>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => share("facebook")} aria-label="Share on Facebook"><Facebook className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => share("twitter")} aria-label="Share on X / Twitter"><Twitter className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => share("linkedin")} aria-label="Share on LinkedIn"><Linkedin className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => share("email")} aria-label="Share via email"><Mail className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => share("copy")} aria-label="Copy link"><LinkIcon className="h-4 w-4" /></Button>
              {typeof navigator !== "undefined" && (navigator as any).share && (
                <Button variant="outline" size="sm" onClick={() => share("native")} aria-label="Share"><Share2 className="h-4 w-4" /></Button>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}