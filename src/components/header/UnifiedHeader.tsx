import { useState, useEffect } from"react";
import { Link, useNavigate, useLocation } from"react-router-dom";
import {
 Menu, X, Sun, Moon, Search, LogOut, LayoutDashboard, MessageSquare,
 Heart, Plus, ClipboardList, Sparkles, ChevronDown, Briefcase, UserPlus,
 LogIn, UserCircle, Store, FileText, Users as UsersIcon, Download,
} from"lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem,
 DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import {
 Drawer,
 DrawerContent,
 DrawerHeader,
 DrawerTitle,
} from"@/components/ui/drawer";
import { useAuth } from"@/contexts/AuthContext";
import { useTheme } from"@/contexts/ThemeContext";
import { useUnreadMessages } from"@/hooks/useUnreadMessages";
import { usePermission } from"@/hooks/usePermission";
import Can from"@/components/auth/Can";
import Logo from"@/components/Logo";
import NotificationBell from"@/components/NotificationBell";
import CategoryMegaMenu, { MobileCategoryAccordion } from"./CategoryMegaMenu";
import RoleBadge, { type BadgeRole } from"./RoleBadge";
import { ADMIN_PANEL_BUTTON_CLASSES } from"@/lib/roleTokens";
import HeaderIconButton from"./HeaderIconButton";
import ThemeToggle from"./ThemeToggle";
import ProfileMenu from"./ProfileMenu";
import { usePwaBranding } from"@/hooks/usePwaBranding";

interface UnifiedHeaderProps {
 /** Show inline search bar */
 showSearch?: boolean;
 searchValue?: string;
 onSearchChange?: (val: string) => void;
 /** Category callbacks for browse page filtering */
 onCategorySelect?: (category: string) => void;
 onSubcategorySelect?: (subcategory: string) => void;
 /** Whether to show the sidebar trigger (for dashboard pages) */
 sidebarTrigger?: React.ReactNode;
}

export default function UnifiedHeader({
 showSearch = true,
 searchValue ="",
 onSearchChange,
 onCategorySelect,
 onSubcategorySelect,
 sidebarTrigger,
}: UnifiedHeaderProps) {
 const [mobileOpen, setMobileOpen] = useState(false);
 const [scrolled, setScrolled] = useState(false);

 useEffect(() => {
 const onScroll = () => setScrolled(window.scrollY > 8);
 window.addEventListener("scroll", onScroll, { passive: true });
 onScroll();
 return () => window.removeEventListener("scroll", onScroll);
 }, []);
 const { user, profile, hasRole, signOut } = useAuth();
 const { isStaff: isStaffMember } = usePermission();
 const { resolved, setTheme } = useTheme();
 const { siteName } = usePwaBranding();
 const brandName = siteName || "TaskHive";
 const navigate = useNavigate();
 const location = useLocation();
 const unreadMessages = useUnreadMessages();

 const isLanding = location.pathname ==="/";
 const toggleTheme = () => setTheme(resolved ==="dark" ?"light" :"dark");

 const closeMobileMenu = () => setMobileOpen(false);

 const getDashboardLink = () => {
 if (hasRole("admin")) return"/admin";
 if (hasRole("provider")) return"/provider-dashboard";
 return"/client-dashboard";
 };

 const handleSearchSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (searchValue.trim()) {
  navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
 }
 };

 return (
      <header className={`sticky top-0 z-[60] border-b transition-all duration-300 ${
 scrolled
 ?"border-border/60"
 :"border-border/40 shadow-none"
 }`} style={{ backgroundColor: 'hsl(var(--header-background))' }}>
 <div className="flex items-center h-16 px-4 lg:px-6 gap-3">
 {/* Left section */}
 <div className="flex items-center gap-2 shrink-0">
 {sidebarTrigger}
 <Link to="/" className="flex items-center gap-2">
  <Logo size={36} />
              <span className="text-fs-xl font-bold tracking-tight hidden sm:inline text-[hsl(var(--site-name))]">
 {brandName}
 </span>
 </Link>
 </div>

 {/* Categories mega menu — full desktop only (≥1200px) */}
 <div className="hidden xl1200:block">
 <CategoryMegaMenu
 onCategorySelect={onCategorySelect}
 onSubcategorySelect={onSubcategorySelect}
 />
 </div>

 {/* Center: Search — full desktop only (≥1200px) */}
 {showSearch && (
 <form onSubmit={handleSearchSubmit} className="hidden xl1200:flex flex-1 max-w-md mx-auto">
 <div className="relative w-full">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
 <Input
 value={searchValue}
 onChange={(e) => onSearchChange?.(e.target.value)}
 placeholder="Search services…"
 className="pl-9 h-9 bg-muted/40 border-border/40 text-fs-sm rounded-lg"
 />
 </div>
 </form>
 )}

 {/* Spacer fills remaining width in mini range (768–1199px) so right group stays right-aligned */}
 <div className="flex-1 xl1200:hidden" />
 {!showSearch && <div className="hidden xl1200:block flex-1" />}

 {/* Right section */}
 {/* Right section — FULL desktop (≥1200px) */}
 <div className="hidden xl1200:flex items-center gap-1 shrink-0">



 {/* Theme — light / dark / system */}
 <ThemeToggle className="h-10 w-10" />

 {user ? (
 <>
 {/* Admin: prominent admin panel link */}
 {hasRole("admin") && (
 <Link to="/admin">
 <Button>
 <LayoutDashboard className="w-4 h-4" /> Admin Panel
 </Button>
 </Link>
 )}

 {/* Provider: prominent provider panel link */}
 {hasRole("provider") && !hasRole("admin") && (
 <Link to="/provider-dashboard">
 <Button variant="outline" size="sm" className="gap-1.5 text-fs-sm border-primary/40 text-primary hover:bg-primary/10">
 <LayoutDashboard className="w-4 h-4" /> Provider Panel
 </Button>
 </Link>
 )}

 {/* Vendor: quick link to task feed */}
 {hasRole("provider") && (
 <Link to="/provider-tasks">
 <Button variant="ghost" size="sm" className="gap-1.5 text-fs-sm">
 <ClipboardList className="w-4 h-4" /> Tasks
 </Button>
 </Link>
 )}

 {/* Notifications */}
 <NotificationBell />

 {/* User menu — shared ProfileMenu for cross-app consistency */}
 <ProfileMenu />

 </>
 ) : (
 <div className="flex items-center gap-2 ml-1">
 <Link to="/login"><Button variant="ghost" size="sm" className="">Log in</Button></Link>
 <DropdownMenu modal={false}>
 <DropdownMenuTrigger asChild>
 <Button size="sm" className="gap-1">
 Get Started <ChevronDown className="w-3 h-3" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-80 p-2">
 <DropdownMenuLabel className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/90 px-2 pt-2 pb-1">
 Join {brandName}
 </DropdownMenuLabel>
 <DropdownMenuItem onClick={() => navigate("/signup")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <UserCircle className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Create Account</div>
 <div className="text-fs-xs text-muted-foreground">Sign up to book services</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/login")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <LogIn className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Log in</div>
 <div className="text-fs-xs text-muted-foreground">Access your account</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuSeparator className="my-2" />
 <DropdownMenuLabel className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/90 px-2 pt-1 pb-1">
 For Professionals
 </DropdownMenuLabel>
 <DropdownMenuItem onClick={() => navigate("/signup?role=provider")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <Store className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Become a Provider</div>
 <div className="text-fs-xs text-muted-foreground">List your services & grow</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuSeparator className="my-2" />
 <DropdownMenuLabel className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/90 px-2 pt-1 pb-1">
 Quick Actions
 </DropdownMenuLabel>
 <DropdownMenuItem onClick={() => navigate("/browse")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <Search className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Browse Services</div>
 <div className="text-fs-xs text-muted-foreground">Explore vetted professionals</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/browse-tasks")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <ClipboardList className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Browse Tasks</div>
 <div className="text-fs-xs text-muted-foreground">See live customer requests</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/post-task")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <FileText className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">Post a Service Request</div>
 <div className="text-fs-xs text-muted-foreground">Describe what you need done</div>
 </div>
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/ai-match")} className="cursor-pointer items-start gap-3 py-3 rounded-sm">
 <Sparkles className="w-10 h-10 bg-muted rounded-sm text-primary shrink-0 p-3" />
 <div className="min-w-0">
 <div className="text-fs-sm font-semibold text-foreground">AI Match</div>
 <div className="text-fs-xs text-muted-foreground">Find the perfect pro instantly</div>
 </div>
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )}
 </div>

 {/* MINI bar — tablet range (768px–1199px). */}
 <div className="hidden md:flex xl1200:hidden items-center gap-1 shrink-0">
 <DropdownMenu modal={false}>
 <DropdownMenuTrigger asChild>
 <HeaderIconButton aria-label="Open compact menu">
 <Menu className="w-[18px] h-[18px]" />
 </HeaderIconButton>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-64">
 <DropdownMenuLabel>Navigation</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer">
 <Logo size={16} /> Home
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/browse")} className="cursor-pointer">
 <Search className="w-4 h-4 mr-2" /> Browse Services
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/browse-tasks")} className="cursor-pointer">
 <ClipboardList className="w-4 h-4 mr-2" /> Browse Tasks
 </DropdownMenuItem>
 {!hasRole("provider") && !hasRole("admin") && (
 <>
 <DropdownMenuItem onClick={() => navigate("/post-task")} className="cursor-pointer">
 <Briefcase className="w-4 h-4 mr-2" /> Post a Service
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/signup?role=provider")} className="cursor-pointer">
 <UserPlus className="w-4 h-4 mr-2" /> Become a Provider
 </DropdownMenuItem>
 </>
 )}
 {hasRole("provider") && (
 <DropdownMenuItem onClick={() => navigate("/provider-dashboard")} className="cursor-pointer">
 <LayoutDashboard className="w-4 h-4 mr-2" /> Provider Panel
 </DropdownMenuItem>
 )}
 {hasRole("admin") && (
 <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
 <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Panel
 </DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={() => navigate("/install")} className="cursor-pointer">
 <Download className="w-4 h-4 mr-2" /> Install App
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>

 <HeaderIconButton onClick={toggleTheme} aria-label="Toggle theme">
 {resolved ==="dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
 </HeaderIconButton>

 {user && <NotificationBell />}

 {user ? (
 <DropdownMenu modal={false}>
 <DropdownMenuTrigger asChild>
 <HeaderIconButton aria-label="Account menu">
 <Avatar className="w-7 h-7">
 <AvatarImage src={profile?.avatar_url || undefined} />
 <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
 {(profile?.display_name || user.email ||"U").charAt(0).toUpperCase()}
 </AvatarFallback>
 </Avatar>
 </HeaderIconButton>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-52">
 <DropdownMenuLabel className="font-normal">
 <p className="text-fs-sm font-medium">{profile?.display_name ||"User"}</p>
 <p className="text-fs-xs text-muted-foreground truncate">{user.email}</p>
 </DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => navigate(getDashboardLink())} className="cursor-pointer">
 <LayoutDashboard className="w-4 h-4 mr-2" />
 {hasRole("admin") ?"Admin Panel" : hasRole("provider") ?"Provider Panel" :"Dashboard"}
 </DropdownMenuItem>
 {isStaffMember && (
 <DropdownMenuItem onClick={() => navigate("/staff-dashboard")} className="cursor-pointer">
 <UsersIcon className="w-4 h-4 mr-2" /> Staff Dashboard
 </DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={() => navigate("/chat")} className="cursor-pointer">
 <MessageSquare className="w-4 h-4 mr-2" /> Messages
 {unreadMessages > 0 && (
 <span className="ml-auto min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
 {unreadMessages}
 </span>
 )}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/browse")} className="cursor-pointer">
 <Search className="w-4 h-4 mr-2" /> Browse Services
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => navigate("/browse-tasks")} className="cursor-pointer">
 <ClipboardList className="w-4 h-4 mr-2" /> Browse Tasks
 </DropdownMenuItem>
 {hasRole("provider") && (
 <DropdownMenuItem onClick={() => navigate("/provider-tasks")} className="cursor-pointer">
 <ClipboardList className="w-4 h-4 mr-2" /> Provider Tasks
 </DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={() => navigate("/install")} className="cursor-pointer">
 <Download className="w-4 h-4 mr-2" /> Install App
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
 <LogOut className="w-4 h-4 mr-2" /> Sign out
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 ) : (
 <Link to="/login" aria-label="Log in">
 <HeaderIconButton>
 <LogIn className="w-[18px] h-[18px]" />
 </HeaderIconButton>
 </Link>
 )}
 </div>

 {/* Mobile hamburger — drawer trigger (<768px) */}
 <div className="flex md:hidden items-center gap-1 ml-auto">
 {user && <NotificationBell />}
 <HeaderIconButton
 onClick={() => setMobileOpen(true)}
 aria-label={mobileOpen ?"Close menu" :"Open menu"}
 aria-expanded={mobileOpen}
 aria-controls="mobile-nav-drawer"
 aria-haspopup="dialog"
 >
 {mobileOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
 </HeaderIconButton>
 </div>
 </div>

 <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
 <DrawerContent id="mobile-nav-drawer" className="md:hidden h-[100dvh] max-h-[100dvh] rounded-none mt-0">
 <DrawerHeader className="border-b border-border/40 text-left">
 <DrawerTitle className="flex items-center gap-2">
 <Logo size={22} />
 <span className="text-fs-sm font-semibold text-heading">
 {user ? (profile?.display_name || user.email?.split("@")[0] ||"Account") :"Navigation"}
 </span>
 {user && (() => {
 const role: BadgeRole = hasRole("admin") ?"Admin" : hasRole("provider") ?"Provider" :"Client";
 return <RoleBadge role={role} />;
 })()}
 </DrawerTitle>
 </DrawerHeader>
 <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
 {/* Mobile search */}
 {showSearch && (
 <form onSubmit={handleSearchSubmit} className="relative mb-3">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 value={searchValue}
 onChange={(e) => onSearchChange?.(e.target.value)}
 placeholder="Search services…"
 className="pl-9 h-10"
 />
 </form>
 )}

 {isLanding && (
 <>
 <a href="/#features" className="block text-fs-sm text-body py-2" onClick={closeMobileMenu}>Features</a>
 <a href="/#how-it-works" className="block text-fs-sm text-body py-2" onClick={closeMobileMenu}>How It Works</a>
 </>
 )}

 <MobileCategoryAccordion
 onCategorySelect={onCategorySelect}
 onSubcategorySelect={onSubcategorySelect}
 onClose={closeMobileMenu}
 />

 <Link to="/browse" className="block text-fs-sm text-body py-2" onClick={closeMobileMenu}>
 Services
 </Link>

 <Link to="/browse-tasks" className="block text-fs-sm text-body py-2" onClick={closeMobileMenu}>
 Browse Tasks
 </Link>

 {isLanding && (
 <a href="/#providers" className="block text-fs-sm text-body py-2" onClick={closeMobileMenu}>
 For Providers
 </a>
 )}

 <Button
   type="button"
   variant="ghost"
   onClick={toggleTheme}
   className="justify-start gap-2 text-fs-sm text-body py-2 w-full h-auto px-0 hover:bg-transparent"
 >
   {resolved ==="dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
   {resolved ==="dark" ?"Light Mode" :"Dark Mode"}
 </Button>

 {user ? (
 <div className="flex gap-2 pt-2 border-t border-border/40">
 <Link to={getDashboardLink()} className="flex-1" onClick={closeMobileMenu}>
 <Button variant="outline" size="sm" className="w-full gap-1.5">
 <LayoutDashboard className="w-4 h-4" />
 {hasRole("admin") ?"Admin Panel" : hasRole("provider") ?"Provider Panel" :"Dashboard"}
 </Button>
 </Link>
 <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive">
 <LogOut className="w-4 h-4" />
 </Button>
 </div>
 ) : (
 <div className="space-y-1 pt-2 border-t border-border/40">
 <Link to="/login" className="flex items-center gap-2.5 text-fs-sm text-body py-2.5 px-1" onClick={closeMobileMenu}>
 <LogIn className="w-4 h-4 text-primary" /> Log in
 </Link>
 <Link to="/signup" className="flex items-center gap-2.5 text-fs-sm text-body py-2.5 px-1" onClick={closeMobileMenu}>
 <UserCircle className="w-4 h-4 text-primary" /> Create Account
 </Link>
 <Link to="/signup?role=provider" className="flex items-center gap-2.5 text-fs-sm text-body py-2.5 px-1" onClick={closeMobileMenu}>
 <Store className="w-4 h-4 text-primary" /> Become a Provider
 </Link>
 <Link to="/post-task" className="flex items-center gap-2.5 text-fs-sm text-body py-2.5 px-1" onClick={closeMobileMenu}>
 <FileText className="w-4 h-4 text-primary" /> Post a Service
 </Link>
 <Link to="/ai-match" className="flex items-center gap-2.5 text-fs-sm text-body py-2.5 px-1" onClick={closeMobileMenu}>
 <Sparkles className="w-4 h-4 text-primary" /> AI Match
 </Link>
 <div className="flex gap-2 pt-2">
 <Link to="/login" className="flex-1" onClick={closeMobileMenu}>
 <Button variant="outline" size="sm" className="w-full">Log in</Button>
 </Link>
 <Link to="/signup" className="flex-1" onClick={closeMobileMenu}>
 <Button size="sm" className="w-full">Get Started</Button>
 </Link>
 </div>
 </div>
 )}
 </div>
 </DrawerContent>
 </Drawer>
 </header>
 );
}
