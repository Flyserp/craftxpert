import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageHeroBannerProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  gradient?: string;
  title: string;
  description: string;
  breadcrumbs?: Breadcrumb[];
  stats?: { icon: LucideIcon; value: string | number; label: string }[];
  children?: React.ReactNode;
}

export default function PageHeroBanner({
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  gradient = "from-primary/20 via-primary/5 to-transparent",
  title,
  description,
  breadcrumbs,
  stats,
  children,
}: PageHeroBannerProps) {
  const navigate = useNavigate();

  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-b border-border/40`}>
      <div className="container-app py-14 md:py-20 relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-fs-sm text-muted-foreground mb-6">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-foreground transition-colors">{crumb.label}</Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="flex flex-col md:flex-row items-start items-center md:items-start gap-5">
          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-sm ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-8 h-8 md:w-10 md:h-10 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <Heading level={1}  className="mb-2 leading-[1.1]">
              {title}
            </Heading>
            <p className="text-lead max-w-2xl">{description}</p>

            {stats && stats.length > 0 && (
              <div className="flex items-center gap-4 mt-4">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-fs-sm text-muted-foreground">
                    <stat.icon className="w-4 h-4" />
                    <span className="font-semibold text-heading">{stat.value}</span> {stat.label}
                  </div>
                ))}
              </div>
            )}

            {children}
          </div>
        </div>
      </div>

      {/* Decorative background icon */}
      <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none">
        <Icon className="w-72 h-72" />
      </div>
    </section>
  );
}
