import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check, X, Info, Home, Briefcase, Building2, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import SocialButtons from "@/components/auth/SocialButtons";
import { usePwaBranding } from "@/hooks/usePwaBranding";

type SignupRole = "customer" | "provider" | "employer";

const getPasswordStrength = (pw: string) => {
  const checks = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score <= 1 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const color =
    score <= 1
      ? "bg-destructive"
      : score <= 3
        ? "bg-warning"
        : score === 4
          ? "bg-primary"
          : "bg-success";
  return { checks, score, label, color };
};

const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const inviteRoleRaw = searchParams.get("role");
  const inviteRole: SignupRole | null =
    inviteRoleRaw === "provider"
      ? "provider"
      : inviteRoleRaw === "employer"
        ? "employer"
        : inviteRoleRaw === "customer"
          ? "customer"
          : null;
  const redirectTo = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const redirectForcesClient = (() => {
    if (!redirectTo) return false;
    const path = redirectTo.split("?")[0].toLowerCase();
    return path.startsWith("/book") || path.startsWith("/post-task");
  })();
  const [role, setRole] = useState<SignupRole>(
    redirectForcesClient ? "customer" : inviteRole || "customer",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  const redirectContext = (() => {
    if (!redirectTo) return null;
    const path = redirectTo.split("?")[0].toLowerCase();
    if (path.startsWith("/book")) return "your booking";
    if (path.startsWith("/post-task")) return "posting your task";
    if (path.startsWith("/chat")) return "your conversation";
    if (path.startsWith("/client-dashboard")) return "your dashboard";
    if (path.startsWith("/provider-dashboard")) return "your provider dashboard";
    if (path.startsWith("/admin")) return "the admin panel";
    if (path.startsWith("/service/")) return "this service";
    if (path.startsWith("/provider/")) return "this provider";
    return "where you left off";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!location.trim()) {
      toast.error("Location is required");
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(email, password, displayName, role, {
      phone: phone.trim(),
      address: location.trim(),
    });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email to confirm your account!");
      const postLogin =
        inviteCode
          ? `/invite/${inviteCode}`
          : redirectTo
            ? redirectTo
            : role === "provider"
              ? "/provider-dashboard"
              : role === "employer"
                ? "/employer-dashboard"
                : "/client-dashboard";
      navigate(`/login?redirect=${encodeURIComponent(postLogin)}`);
    }
  };

  const handleOAuthSignup = async (provider: "google" | "apple") => {
    const setLoadingFn = provider === "google" ? setIsGoogleLoading : setIsAppleLoading;
    const label = provider === "google" ? "Google" : "Apple";
    setLoadingFn(true);
    try {
      // Persist the selected role so we can apply it once the OAuth round-trip completes.
      try { localStorage.setItem("pending_signup_role", role); } catch { /* ignore */ }
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) {
        try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
        toast.error(`${label} sign-up failed. Please try again.`);
      }
      if (result.redirected) return;
      toast.success(`Welcome to ${brand}!`);
      navigate(redirectTo || "/");
    } catch {
      try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
      toast.error(`${label} sign-up failed.`);
    } finally {
      setLoadingFn(false);
    }
  };

  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/login";

  return (
    <AuthLayout
      eyebrow="Create account"
      title={`Join ${brand}`}
      panelVariant={role === "provider" ? "provider" : "client"}
      subtitle={
        role === "provider"
          ? "Set up your pro profile and start receiving bookings."
          : "Find trusted local pros and book in minutes."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to={loginHref} className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {redirectContext && (
        <div className="mb-5 flex items-start gap-2.5 rounded-sm border border-primary/20 bg-primary/5 px-3.5 py-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-fs-xs text-heading leading-relaxed">
            Sign up to continue to <span className="font-semibold">{redirectContext}</span>.
          </p>
        </div>
      )}

      {!redirectForcesClient && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {([
            {
              value: "customer" as const,
              icon: Home,
              title: "Customer",
              subtitle: "Book local pros",
              benefits: ["Free to join", "No booking fees"],
            },
            {
              value: "provider" as const,
              icon: Briefcase,
              title: "Service Provider",
              subtitle: "Get bookings & grow",
              benefits: ["Keep 90%", "Instant payouts"],
            },
            {
              value: "employer" as const,
              icon: Building2,
              title: "Employer",
              subtitle: "Hire & post jobs",
              benefits: ["Post jobs free", "Vetted talent"],
            },
          ]).map((opt) => {
            const Icon = opt.icon;
            const selected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                aria-pressed={selected}
                className={`group relative overflow-hidden rounded-sm border-2 p-3.5 text-left transition-all duration-200 ${
                  selected
                    ? "border-accent bg-accent/10 shadow-[0_0_0_4px_hsl(var(--accent)/0.15),inset_0_1px_0_hsl(var(--accent)/0.2)]"
                    : "border-border bg-card/50 hover:border-accent/40 hover:bg-accent/5"
                }`}
              >
                {selected && (
                  <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary-foreground fill-accent" />
                )}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${
                    selected
                      ? "bg-accent text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-accent/20 group-hover:text-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <div className={`text-[13px] font-bold leading-tight text-heading`}>
                  {opt.title}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                  {opt.subtitle}
                </div>
                {/* Benefits list */}
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  {opt.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <Check className={`w-3 h-3 shrink-0 ${selected ? "text-accent" : "text-muted-foreground/50"}`} />
                      <span className={selected ? "text-foreground" : "text-muted-foreground/70"}>{benefit}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SocialButtons
        mode="up"
        onGoogle={() => handleOAuthSignup("google")}
        onApple={() => handleOAuthSignup("apple")}
        googleLoading={isGoogleLoading}
        appleLoading={isAppleLoading}
      />

      <div className="relative my-6" role="separator" aria-label="or sign up with email">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="relative flex justify-center">
          <span className="inline-flex items-center gap-1.5 bg-card pl-2 pr-3 py-1 rounded-full border border-border/70 text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground shadow-sm">
            <Mail className="w-3 h-3 text-primary" aria-hidden="true" />
            or with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Full name"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          icon={<User className="w-4 h-4" />}
          showValidIndicator
        />

        <AuthField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          errorMessage={
            email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              ? "Please enter a valid email address"
              : undefined
          }
          showValidIndicator
        />

        <AuthField
          label="Phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          icon={<Phone className="w-4 h-4" />}
          showValidIndicator
        />

        <AuthField
          label="Location"
          type="text"
          name="location"
          autoComplete="address-level2"
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
          showValidIndicator
        />

        <div>
          <AuthField
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          {password.length > 0 &&
            (() => {
              const strength = getPasswordStrength(password);
              return (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= strength.score ? strength.color : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {[
                      ["length", "8+ characters"],
                      ["uppercase", "Uppercase"],
                      ["lowercase", "Lowercase"],
                      ["number", "Number"],
                      ["special", "Symbol"],
                    ].map(([key, label]) => {
                      const ok = strength.checks[key as keyof typeof strength.checks];
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-[13px]">
                          {ok ? (
                            <Check className="w-3 h-3 text-success shrink-0" />
                          ) : (
                            <X className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          )}
                          <span
                            className={
                              ok ? "text-foreground" : "text-muted-foreground/60"
                            }
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
        </div>

        <Button
          type="submit"
          variant="hero"
          size="xl"
          className="w-full gap-2 group mt-1"
          disabled={isLoading}
        >
          {isLoading
            ? "Creating account…"
            : role === "provider"
              ? "Create pro account"
              : "Create account"}
          {!isLoading && (
            <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
          )}
        </Button>

        <p className="text-[13px] text-muted-foreground text-center leading-relaxed pt-1">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  );
};

export default SignupPage;
