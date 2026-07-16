import { Link } from"react-router-dom";
import { Mail, Phone, MapPin, Shield, LayoutDashboard, ArrowRight, Sparkles } from"lucide-react";
import Logo from"@/components/Logo";
import { useAuth } from"@/contexts/AuthContext";
import { Button } from"@/components/ui/button";
import { useHomepageContent } from"@/hooks/useHomepageContent";
import { usePwaBranding } from"@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

/**
 * Shared hover class for footer links. Uses the`--footer-link-hover` token
 * (lime accent) so links pop against the dark footer background in both
 * light and dark themes. Previously links hovered to`text-primary`, which
 * in light mode is deep teal — nearly invisible on the dark footer bg.
 */
const FOOTER_LINK_HOVER ="hover:text-footer-link-hover transition-colors";

const Footer = () => {
 const { hasRole } = useAuth();
 const { content } = useHomepageContent();
 const { siteName } = usePwaBranding();
 const brandName = siteName || "TaskHive";
 const f = content.footer;
 const isAdmin = hasRole("admin");
 const isProvider = hasRole("provider");
 const panelHref = isAdmin ?"/admin" : isProvider ?"/provider-dashboard" : null;
 const panelLabel = isAdmin ?"Admin Panel" :"Provider Panel";
 const PanelIcon = isAdmin ? Shield : LayoutDashboard;

 return (
 <footer className="border-t border-footer-border/10 bg-footer relative overflow-hidden">
 <div
 className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.03] pointer-events-none"
 style={{ background:"radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
 />

 {/* Newsletter bar — editorial split with lime-accent panel */}
 <div className="border-b border-footer-border/10 relative">
 <div
 aria-hidden
 className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 70% at 15% 50%, hsl(var(--footer-link-hover) / 0.035) 0%, transparent 70%), radial-gradient(ellipse 60% 70% at 85% 50%, hsl(var(--footer-link-hover) / 0.025) 0%, transparent 70%)",
          }}
 />
 <div className="container-app py-12 lg:py-14 relative">
 <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
 {/* Left: editorial copy */}
 <div className="lg:col-span-6">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-footer-link-hover/10 text-footer-link-hover text-fs-xs font-semibold tracking-wide uppercase mb-4">
 <Sparkles className="w-3.5 h-3.5" />
 Newsletter
 </div>
 <Heading level={3}  className="text-footer-foreground mb-2">
 {f.newsletter_title}
 </Heading>
 <p className="text-fs-sm text-footer-muted max-w-md leading-relaxed">
 {f.newsletter_subtitle}
 </p>
 </div>

 {/* Right: input + CTA card */}
 <div className="lg:col-span-6">
 <div className="rounded-sm border border-footer-border/15 bg-footer-border/[0.04] p-3 sm:p-4 backdrop-blur-sm">
 <form
 onSubmit={(e) => e.preventDefault()}
 className="flex flex-col sm:flex-row gap-2"
 >
 <div className="relative flex-1">
 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-footer-subtle" />
 <input
 type="email"
 required
 placeholder="you@company.com"
 className="w-full h-11 pl-10 pr-4 rounded-sm border border-footer-border/15 bg-footer/40 text-fs-sm text-footer-foreground placeholder:text-footer-subtle focus:border-footer-link-hover/50 transition-colors"
 />
 </div>
 <Button
 type="submit"
 variant="primary"
 className="h-11 px-5 gap-2 font-semibold whitespace-nowrap bg-footer-link-hover text-footer hover:bg-footer-link-hover/90"
 >
 Subscribe
 <ArrowRight className="w-4 h-4" />
 </Button>
 </form>
 <p className="text-fs-xs text-footer-subtle mt-3 px-1">
 Join 12k+ readers. No spam — unsubscribe anytime.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="container-app py-14 relative">
 <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
 {/* Brand */}
 <div className="lg:col-span-2">
 <Link to="/" className="flex items-center gap-2 mb-4 group">
 <Logo size={28} />
 <span className="text-fs-lg font-bold text-footer-foreground tracking-tight">{brandName}</span>
 </Link>
 <p className="text-fs-sm text-footer-muted leading-relaxed max-w-xs mb-5">
 {f.tagline}
 </p>
 {/* Contact info */}
 <div className="space-y-2 mb-5">
 <div className="flex items-center gap-2 text-fs-sm text-footer-muted">
 <Mail className="w-4 h-4 text-footer-subtle" />
 <span>{f.email}</span>
 </div>
 <div className="flex items-center gap-2 text-fs-sm text-footer-muted">
 <Phone className="w-4 h-4 text-footer-subtle" />
 <span>{f.phone}</span>
 </div>
 <div className="flex items-center gap-2 text-fs-sm text-footer-muted">
 <MapPin className="w-4 h-4 text-footer-subtle" />
 <span>{f.address}</span>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {["Twitter","LinkedIn","GitHub","Instagram"].map((s) => (
 <a key={s} href="#" className="w-9 h-9 rounded-sm bg-footer-border/5 flex items-center justify-center text-fs-xs font-semibold text-footer-muted hover:text-footer-link-hover hover:bg-footer-link-hover/10 transition-colors">
 {s[0]}
 </a>
 ))}
 </div>
 </div>

 <div>
 <Heading level={4}  className="text-footer-foreground mb-4">Product</Heading>
 <ul className="space-y-2.5 text-fs-sm text-footer-muted">
 <li><a href="#features" className={FOOTER_LINK_HOVER}>Features</a></li>
 <li><a href="#how-it-works" className={FOOTER_LINK_HOVER}>How It Works</a></li>
 <li><a href="#services" className={FOOTER_LINK_HOVER}>Categories</a></li>
 <li><a href="#" className={FOOTER_LINK_HOVER}>Pricing</a></li>
 <li><Link to="/browse" className={FOOTER_LINK_HOVER}>Browse Services</Link></li>
 </ul>
 </div>

 <div>
 <Heading level={4}  className="text-footer-foreground mb-4">Company</Heading>
 <ul className="space-y-2.5 text-fs-sm text-footer-muted">
 <li><Link to="/page/about" className={FOOTER_LINK_HOVER}>About Us</Link></li>
 <li><Link to="/page/faq" className={FOOTER_LINK_HOVER}>FAQ</Link></li>
 <li><a href="#" className={FOOTER_LINK_HOVER}>Careers</a></li>
 <li><a href="/#contact" className={FOOTER_LINK_HOVER}>Contact</a></li>
 <li><Link to="/tenant/signup" className={FOOTER_LINK_HOVER}>Become a Provider</Link></li>
 </ul>
 </div>

 <div>
 <Heading level={4}  className="text-footer-foreground mb-4">Legal</Heading>
 <ul className="space-y-2.5 text-fs-sm text-footer-muted">
 <li><Link to="/page/privacy" className={FOOTER_LINK_HOVER}>Privacy Policy</Link></li>
 <li><Link to="/page/terms" className={FOOTER_LINK_HOVER}>Terms of Service</Link></li>
 <li><a href="#" className={FOOTER_LINK_HOVER}>Security</a></li>
 <li><a href="#" className={FOOTER_LINK_HOVER}>Accessibility</a></li>
 <li><a href="#" className={FOOTER_LINK_HOVER}>Cookie Policy</a></li>
 </ul>
 </div>
 </div>

 <div className="border-t border-footer-border/10 pt-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-fs-xs text-footer-subtle">
 <span>© {new Date().getFullYear()} {brandName}. All rights reserved.</span>
 <div className="flex items-center gap-4 flex-wrap justify-center">
 {panelHref && (
 <>
 <Link
 to={panelHref}
 className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
 >
 <PanelIcon className="w-3 h-3" />
 {panelLabel}
 </Link>
 <span>·</span>
 </>
 )}
 <Link to="/page/privacy" className={FOOTER_LINK_HOVER}>Privacy</Link>
 <span>·</span>
 <Link to="/page/terms" className={FOOTER_LINK_HOVER}>Terms</Link>
 <span>·</span>
 <a href="#" className={FOOTER_LINK_HOVER}>Cookies</a>
 </div>
 </div>
 </div>
 </footer>
 );
};

export default Footer;
