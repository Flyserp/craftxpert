import { ReactNode } from "react";
import Logo from "@/components/Logo";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sparkles,
  Zap,
  Star,
  TrendingUp,
  Wallet,
  CalendarCheck,
  MailCheck,
  Timer,
  KeyRound,
  Lock,
  Eye,
  Users,
  Handshake,
  CalendarRange,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

export type BrandPanelVariant = "client" | "provider" | "forgot" | "reset" | "invite";

interface PanelTestimonial {
  initials: string;
  name: string;
  caption: string;
  quote: string;
  showStars?: boolean;
}

interface PanelContent {
  eyebrow: string;
  headline: ReactNode;
  props: { icon: LucideIcon; title: string; body: string }[];
  testimonial: PanelTestimonial;
}

const PANEL_CONTENT: Record<BrandPanelVariant, PanelContent> = {
  client: {
    eyebrow: "Why TaskHive",
    headline: (
      <>
        The easiest way to <span className="text-[hsl(70_100%_66%)]">get things done.</span>
      </>
    ),
    props: [
      { icon: Sparkles, title: "Trusted local pros", body: "Every provider is vetted, rated, and reviewed by real customers." },
      { icon: Zap, title: "Book in minutes", body: "Compare quotes and confirm a time without endless back-and-forth." },
      { icon: ShieldCheck, title: "Protected payments", body: "Funds are held securely until the job is done to your satisfaction." },
    ],
    testimonial: {
      initials: "SK",
      name: "Sarah K.",
      caption: "Verified customer",
      quote: "Booked a plumber in under five minutes. He arrived on time, fixed the leak, and I paid right inside the app.",
      showStars: true,
    },
  },
  provider: {
    eyebrow: "For pros",
    headline: (
      <>
        Grow your business, <span className="text-[hsl(70_100%_66%)]">book by book.</span>
      </>
    ),
    props: [
      { icon: TrendingUp, title: "Steady stream of leads", body: "Get matched to nearby customers actively looking for your service." },
      { icon: Wallet, title: "Keep 90% of earnings", body: "Low platform fee, instant payouts to your bank or wallet." },
      { icon: CalendarCheck, title: "You own your calendar", body: "Set hours, block dates, and approve every booking on your terms." },
    ],
    testimonial: {
      initials: "MR",
      name: "Marcus R.",
      caption: "Verified pro · Plumber",
      quote: "Quit my agency in month three. TaskHive fills my calendar two weeks out and I haven't chased an invoice since.",
      showStars: true,
    },
  },
  forgot: {
    eyebrow: "Recovery",
    headline: (
      <>
        Reset your password <span className="text-[hsl(70_100%_66%)]">in seconds.</span>
      </>
    ),
    props: [
      { icon: MailCheck, title: "Check your inbox", body: "We'll send a one-time link straight to the email tied to your account." },
      { icon: Timer, title: "Valid for 1 hour", body: "Links expire automatically — no stale tokens floating around." },
      { icon: ShieldCheck, title: "You stay in control", body: "Old sessions stay active until you choose a new password." },
    ],
    testimonial: {
      initials: "TH",
      name: "TaskHive support",
      caption: "We're here 24/7",
      quote: "Didn't get the email? Check spam, or contact support and we'll get you back in within minutes.",
    },
  },
  reset: {
    eyebrow: "New password",
    headline: (
      <>
        Pick something <span className="text-[hsl(70_100%_66%)]">strong & memorable.</span>
      </>
    ),
    props: [
      { icon: KeyRound, title: "12+ characters recommended", body: "Mix upper, lower, numbers, and a symbol or two for best protection." },
      { icon: Lock, title: "Encrypted at rest", body: "We never store your password in plain text — only a one-way hash." },
      { icon: Eye, title: "Use a password manager", body: "Generated passwords beat anything you can remember. We won't judge." },
    ],
    testimonial: {
      initials: "TH",
      name: "Security tip",
      caption: "From the TaskHive team",
      quote: "Reusing a password is the #1 way accounts get compromised. Make this one unique to TaskHive.",
    },
  },
  invite: {
    eyebrow: "Join the team",
    headline: (
      <>
        Better together, <span className="text-[hsl(70_100%_66%)]">booking by booking.</span>
      </>
    ),
    props: [
      { icon: Users, title: "One shared roster", body: "See teammates, roles, and who's covering which jobs at a glance." },
      { icon: CalendarRange, title: "Get assigned bookings", body: "Your manager can route the right jobs straight to your calendar." },
      { icon: Handshake, title: "Built on trust", body: "You only see what you need to do your job — customer privacy stays protected." },
    ],
    testimonial: {
      initials: "JL",
      name: "Jamie L.",
      caption: "Field tech · 2 years on TaskHive",
      quote: "Joining my crew took thirty seconds. Now my schedule, jobs, and notes all live in one place.",
    },
  },
};

interface AuthLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  panelVariant?: BrandPanelVariant;
}

/**
 * Refined two-column auth shell.
 * - Left: editorial brand panel (deep teal + lime), calmer than before
 * - Right: minimal form card on a soft neutral background
 * - Mobile: brand panel collapses; only a compact branded header is shown
 */
const AuthLayout = ({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  panelVariant = "client",
}: AuthLayoutProps) => {
  const panel = PANEL_CONTENT[panelVariant];
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-h-screen">
        {/* ============================ */}
        {/* LEFT — Brand panel (lg+)     */}
        {/* ============================ */}
        <aside
          aria-hidden="true"
          className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14 text-white"
          style={{
            background:
              "linear-gradient(155deg, hsl(186 100% 8%) 0%, hsl(186 100% 11%) 60%, hsl(186 100% 7%) 100%)",
          }}
        >
          {/* Lime ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full opacity-30 blur-3xl"
            style={{ background: "hsl(var(--accent) / 0.55)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-32 w-[440px] h-[440px] rounded-full opacity-20 blur-3xl"
            style={{ background: "hsl(var(--accent) / 0.5)" }}
          />
          {/* Subtle grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(0_0%_100%/0.4)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.4)_1px,transparent_1px)] [background-size:40px_40px]"
          />

          {/* Top: brand */}
          <Link to="/" className="relative inline-flex items-center gap-2.5 group w-fit">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-sm bg-white/10 border border-white/15">
              <Logo size={22} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">{brand}</span>
          </Link>

          {/* Middle: editorial headline + props */}
          <div className="relative max-w-[460px]">
            <span
              className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] mb-5"
              style={{ color: "hsl(var(--accent))" }}
            >
              <span
                className="h-px w-6"
                style={{ background: "hsl(var(--accent))" }}
              />
              {panel.eyebrow}
            </span>
            <Heading level={2}  className="text-[32px] xl:text-[38px] tracking-[-0.02em] leading-[1.1] text-white">
              {panel.headline}
            </Heading>

            <ul className="mt-10 space-y-5">
              {panel.props.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-3.5">
                    <div
                      className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: "hsl(var(--accent) / 0.12)",
                        border: "1px solid hsl(var(--accent) / 0.25)",
                        color: "hsl(var(--accent))",
                      }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-[14px] font-semibold text-white leading-snug">
                        {item.title}
                      </div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/70">
                        {item.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Bottom: testimonial */}
          <figure className="relative max-w-[460px]">
            <blockquote className="text-[14.5px] leading-relaxed text-white/85">
              “{panel.testimonial.quote}”
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{
                  background: "hsl(var(--accent) / 0.2)",
                  border: "1px solid hsl(var(--accent) / 0.35)",
                  color: "hsl(var(--accent))",
                }}
              >
                {panel.testimonial.initials}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white leading-tight">
                  {panel.testimonial.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {panel.testimonial.showStars &&
                    [0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="w-3 h-3"
                        style={{ fill: "hsl(var(--accent))", color: "hsl(var(--accent))" }}
                        strokeWidth={0}
                      />
                    ))}
                  <span className="text-[11px] text-white/55 leading-none">
                    {panel.testimonial.caption}
                  </span>
                </div>
              </div>
            </figcaption>
          </figure>
        </aside>

        {/* ============================ */}
        {/* RIGHT — Form column          */}
        {/* ============================ */}
        <section className="relative flex flex-col min-h-screen">
          {/* Mobile brand bar */}
          <header className="lg:hidden flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/60">
            <Link to="/" className="inline-flex items-center gap-2">
              <Logo size={26} />
              <span className="text-[14px] font-semibold tracking-tight text-heading">{brand}</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-fs-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Home
            </Link>
          </header>

          {/* Desktop top-right utility link */}
          <div className="hidden lg:flex justify-end px-10 xl:px-14 py-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to site
            </Link>
          </div>

          {/* Form area */}
          <div className="flex-1 flex items-start lg:items-center justify-center px-5 sm:px-8 lg:px-12 xl:px-16 py-8 lg:py-10">
            <div className="w-full max-w-[420px]">
              {/* Heading block */}
              <div className="mb-7">
                {eyebrow && (
                  <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                    <span className="h-px w-5 bg-primary/60" />
                    {eyebrow}
                  </span>
                )}
                <Heading level={1}  className="text-[28px] sm:text-[30px] tracking-[-0.02em] leading-[1.15]">
                  {title}
                </Heading>
                {subtitle && (
                  <p className="mt-2.5 text-[14px] text-muted-foreground leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Form card — minimal, no glow */}
              <div className="rounded-sm border border-border bg-card shadow-sm p-5 sm:p-6">
                {children}
              </div>

              {footer && (
                <div className="mt-5 text-center text-[13.5px] text-muted-foreground">
                  {footer}
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70 tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Encrypted · GDPR · SOC 2</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthLayout;
