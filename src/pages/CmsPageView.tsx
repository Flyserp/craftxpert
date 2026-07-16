import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import SEOHead from "@/components/SEOHead";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading, LoadingState } from "@/components/ui/app";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  updated_at: string;
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let listItems: JSX.Element[] = [];
  let listIndex = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={`list-${listIndex}`} className="list-disc list-inside space-y-1 mb-4">{listItems}</ul>);
      listItems = [];
      listIndex++;
    }
  };

  const parseBold = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  lines.forEach((line, i) => {
    if (line.startsWith("# ")) {
      flushList();
      elements.push(<Heading key={i} level={1} className="mb-4 mt-8 first:mt-0">{line.slice(2)}</Heading>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<Heading key={i} level={2} className="mb-3 mt-6">{line.slice(3)}</Heading>);
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(<Heading key={i} level={3} className="mb-2 mt-5">{line.slice(4)}</Heading>);
    } else if (line.match(/^\d+\.\s/)) {
      flushList();
      elements.push(
        <p key={i} className="text-body mb-2 pl-4">{parseBold(line)}</p>
      );
    } else if (line.startsWith("- ")) {
      listItems.push(<li key={i} className="text-body">{parseBold(line.slice(2))}</li>);
    } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      flushList();
      elements.push(<p key={i} className="text-muted-foreground italic mb-4">{line.slice(1, -1)}</p>);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(<p key={i} className="text-body mb-3 leading-relaxed">{parseBold(line)}</p>);
    }
  });

  flushList();
  return elements;
}

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("cms_pages")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setPage(data as CmsPage); }
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <LoadingState variant="page" />
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen flex flex-col">
        <UnifiedHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Heading level={1}  className="mb-2">Page Not Found</Heading>
            <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
            <Link to="/">
              <Button variant="outline" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Go Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={page.meta_title || page.title}
        description={page.meta_description || undefined}
        image={page.og_image || undefined}
        type="article"
      />
      <UnifiedHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-fs-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <article className="animate-reveal">
          {renderMarkdown(page.content)}
          <div className="mt-12 pt-6 border-t border-border/40">
            <p className="text-fs-xs text-muted-foreground">
              Last updated: {new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
