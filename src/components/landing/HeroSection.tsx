import { useState } from"react";
import { useNavigate } from"react-router-dom";
import { Button } from"@/components/ui/button";
import { Search, MapPin, Star, Shield, Clock, ArrowRight, Sparkles, Users, CheckCircle2 } from"lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import heroImg from"@/assets/hero-handyman.jpg";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { Heading } from "@/components/ui/app";

const HeroSection = () => {
 const navigate = useNavigate();
 const [location, setLocation] = useState("");
 const [search, setSearch] = useState("");
 const { content } = useHomepageContent();
 const hero = content.hero;
 const popularSearches = hero.popular_searches;

 const goToBrowse = () => {
 const params = new URLSearchParams();
 if (search.trim()) params.set("search", search.trim());
 if (location.trim()) params.set("location", location.trim());
 const qs = params.toString();
 navigate(`/browse${qs ?`?${qs}` :""}`);
 };

 // Accent token map — locked to the `accent` design token (`hsl(var(--accent))`, currently #9dbd47)
 const A = {
 text:"text-accent",
 bg15:"bg-accent/15",
 bg08:"from-accent/[0.08]",
 border20:"border-accent/20",
 border15:"border-accent/15",
 border10:"border-accent/10",
 borderHover:"hover:border-accent/40",
 textHover:"hover:text-accent",
 textFocus:"group-focus-within:text-accent",
 borderFocus:"",
 ring25:"ring-accent/25",
 radial:"radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 70%)",
 };

 return (
 <section className="relative pt-12 pb-[140px] md:pt-20 md:pb-[160px] overflow-hidden">
 {/* Layered background */}
 <div className="absolute inset-0 surface-warm" />
 <div className={`absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l ${A.bg08} to-transparent`} />
 <div
 className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] pointer-events-none"
 style={{ background: A.radial }}
 />

 <div className="container-app relative">
 <div className="grid lg:grid-cols-2 gap-14 lg:gap-12 items-stretch">
 {/* Left column */}
 <div className="animate-reveal">
 <div className={`inline-flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-full px-4 py-1.5 mb-7 border ${A.border20}`}>
 <Shield className={`w-3.5 h-3.5 ${A.text}`} />
 <span className="text-fs-xs font-semibold text-secondary-foreground tracking-wide">{hero.badge}</span>
 </div>

 <Heading level={1}  className="text-[2.75rem] lg:text-[3.75rem] leading-[1.05] mb-6 text-balance">
 {hero.title_prefix}
 <span className="relative inline-block">
 <span className={A.text}>{hero.title_accent}</span>
 <svg className={`absolute -bottom-1.5 left-0 w-full h-[7px] ${A.text}`} viewBox="0 0 200 6" preserveAspectRatio="none" fill="none">
 <path d="M0 5C40 1 60 1 100 3C140 5 160 1 200 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
 </svg>
 </span>
 </Heading>

 <p className="text-lead max-w-lg mb-9">
 {hero.subtitle}
 </p>

 {/* Unified search card */}
 <div className="bg-card rounded-sm border border-border p-2 mb-5">
 <div className="flex flex-col sm:flex-row gap-2">
 <div className="relative flex-1 group">
 <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground ${A.textFocus} transition-colors`} />
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search for Service"
 className={`w-full h-12 pl-11 pr-4 rounded-sm bg-background border border-input text-fs-sm ${A.borderFocus} transition-all duration-200`}
 onKeyDown={(e) => { if (e.key ==="Enter") goToBrowse(); }}
 />
 </div>
 <div className="hidden sm:block w-px bg-border/60 my-2" />
 <div className="relative flex-1 group">
 <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground ${A.textFocus} transition-colors`} />
 <input
 type="text"
 value={location}
 onChange={(e) => setLocation(e.target.value)}
 placeholder="Enter Location"
 className={`w-full h-12 pl-11 pr-4 rounded-sm bg-background border border-input text-fs-sm ${A.borderFocus} transition-all duration-200`}
 onKeyDown={(e) => { if (e.key ==="Enter") goToBrowse(); }}
 />
 </div>
 <Button variant="hero" size="lg" className="gap-2 group/btn h-12 px-7 rounded-sm" onClick={goToBrowse}>
 <Search className="w-4 h-4" />
 Search
 </Button>
 </div>
 </div>

 {/* Popular searches */}
 <div className="flex flex-wrap items-center gap-2 mb-10">
 <span className="text-fs-xs font-semibold text-heading">Popular Searches</span>
 {popularSearches.map((tag) => (
 <button
 key={tag}
 onClick={() => { setSearch(tag); navigate(`/browse?search=${encodeURIComponent(tag)}`); }}
 className={`text-fs-xs font-medium text-body bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full border border-border/50 ${A.borderHover} ${A.textHover} transition-all duration-200`}
 >
 {tag}
 </button>
 ))}
 </div>

 {/* Stats row with icons */}
 <div className="flex flex-wrap gap-8 items-center">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-sm ${A.bg15} flex items-center justify-center`}>
 <Users className={`w-5 h-5 ${A.text}`} />
 </div>
 <div>
 <p className="text-fs-lg font-bold text-heading tabular-nums leading-tight">12,000+</p>
 <p className="text-fs-xs text-muted-foreground">Verified Providers</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-sm bg-accent/15 flex items-center justify-center">
 <CheckCircle2 className="w-5 h-5 text-accent" />
 </div>
 <div>
 <p className="text-fs-lg font-bold text-heading tabular-nums leading-tight">90,000+</p>
 <p className="text-fs-xs text-muted-foreground">Services Completed</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-sm bg-accent/15 flex items-center justify-center">
 <Star className={`w-5 h-5 ${A.text}`} />
 </div>
 <div>
 <p className="text-fs-lg font-bold text-heading tabular-nums leading-tight">4.9 / 5</p>
 <p className="text-fs-xs text-muted-foreground">Average Rating</p>
 </div>
 </div>
 </div>
 </div>

 {/* Right column — Hero image */}
 <div className="animate-reveal-delay-1 relative h-full min-h-[360px] md:min-h-[400px] lg:min-h-[500px]">
 <div className={`absolute -inset-4 rounded-sm border ${A.border15} -z-10 hidden lg:block`} />
 <div className={`absolute -inset-8 rounded-sm border ${A.border10} -z-10 hidden lg:block`} />

 <div className="relative rounded-sm overflow-hidden ring-1 ring-border/50 h-full">
 <img
 src={heroImg}
 alt="Professional handyman fixing a kitchen faucet"
 className="absolute inset-0 w-full h-full object-cover"
 loading="eager"
 />
 <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />

 {/* Floating vendor card */}
 <div
 className="absolute bottom-5 left-5 right-5 sm:left-auto sm:right-5 sm:w-72 bg-background/95 backdrop-blur-lg rounded-sm p-4 border border-border/50"
 style={{ animation:"slide-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both" }}
 >
 <div className="flex items-center gap-3 mb-2">
 <div className={`w-10 h-10 rounded-full ${A.bg15} flex items-center justify-center text-fs-sm font-semibold ${A.text} ring-2 ${A.ring25}`}>MR</div>
 <div>
 <p className="text-fs-sm font-semibold text-heading">Marcus Rivera</p>
 <div className="flex items-center gap-1">
 <StarRating count={5} size="xs" />
 <span className="text-fs-xs text-muted-foreground ml-1 tabular-nums">4.9</span>
 </div>
 </div>
 </div>
 <p className="text-description-sm">Plumbing • Electrical • Available now</p>
 </div>

 {/* Floating badge */}
 <div
 className="absolute top-4 right-4 bg-background/90 backdrop-blur-md rounded-lg px-3 py-2 border border-border/50"
 style={{ animation:"slide-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.8s both" }}
 >
 <div className="flex items-center gap-2">
 <CheckCircle2 className={`w-4 h-4 ${A.text}`} />
 <div>
 <p className="text-[10px] font-semibold text-heading">300+ Bookings</p>
 <p className="text-[10px] text-muted-foreground">Completed today</p>
 </div>
 </div>
 </div>

 {/* AI badge */}
 <div
 className="absolute top-4 left-4 bg-background/90 backdrop-blur-md rounded-lg px-3 py-2 border border-border/50"
 style={{ animation:"slide-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.9s both" }}
 >
 <div className="flex items-center gap-2">
 <Sparkles className={`w-4 h-4 ${A.text}`} />
 <div>
 <p className="text-[10px] font-semibold text-heading">AI Matched</p>
 <p className="text-[10px] text-muted-foreground">98% satisfaction</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>

 </div>

 {/* App features marquee — full-width, outside container */}
 <div className="absolute bottom-0 left-0 right-0 animate-reveal-delay-2">
 <div className="bg-primary h-[100px] flex items-center relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
 <div className="flex w-max animate-marquee gap-10 items-center">
 {[
 { icon: Shield, text:"Verified & Insured Pros" },
 { icon: Sparkles, text:"AI-Powered Matching" },
 { icon: Clock, text:"Same-Day Bookings" },
 { icon: Star, text:"4.9★ Average Rating" },
 { icon: Users, text:"12,000+ Professionals" },
 { icon: CheckCircle2, text:"Satisfaction Guaranteed" },
 { icon: Shield, text:"Verified & Insured Pros" },
 { icon: Sparkles, text:"AI-Powered Matching" },
 { icon: Clock, text:"Same-Day Bookings" },
 { icon: Star, text:"4.9★ Average Rating" },
 { icon: Users, text:"12,000+ Professionals" },
 { icon: CheckCircle2, text:"Satisfaction Guaranteed" },
 ].map((item, i) => (
 <div key={i} className="flex items-center gap-2.5 shrink-0">
 <item.icon className="w-5 h-5 text-primary-foreground/80" />
 <span className="text-fs-sm font-semibold text-primary-foreground whitespace-nowrap">{item.text}</span>
 <span className="text-primary-foreground/30 ml-7">•</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </section>
 );
};

export default HeroSection;
