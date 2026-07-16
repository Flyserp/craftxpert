import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import SocialButtons from "@/components/auth/SocialButtons";
import { usePwaBranding } from "@/hooks/usePwaBranding";


const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("auth:remember");
    return stored === null ? true : stored === "true";
  });
  const { signIn, user, roles, loading, needsProfileCompletion } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
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
    if (path.startsWith("/employer-dashboard")) return "your employer dashboard";
    if (path.startsWith("/admin")) return "the admin panel";
    if (path.startsWith("/service/")) return "this service";
    if (path.startsWith("/provider/")) return "this provider";
    return "where you left off";
  })();

  const getRoleRedirect = (userRoles?: string[]) => {
    if (redirectTo) return redirectTo;
    if (!userRoles || userRoles.length === 0) return "/complete-profile";
    if (userRoles.includes("admin")) return "/admin";
    if (userRoles.includes("provider")) return "/provider-dashboard";
    if (userRoles.includes("employer")) return "/employer-dashboard";
    if (userRoles.includes("customer")) return "/client-dashboard";
    return "/";
  };

  useEffect(() => {
    if (!loading && user) {
      if (needsProfileCompletion) {
        navigate("/complete-profile", { replace: true });
      } else if (roles.length > 0) {
        navigate(getRoleRedirect(roles), { replace: true });
      }
    }
  }, [loading, user, roles, needsProfileCompletion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error, roles } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Persist remember preference and, if unchecked, wipe the Supabase token
      // from localStorage when the tab/browser closes so the session ends.
      localStorage.setItem("auth:remember", rememberMe ? "true" : "false");
      if (!rememberMe) {
        sessionStorage.setItem("auth:session-only", "1");
      } else {
        sessionStorage.removeItem("auth:session-only");
      }
      toast.success("Welcome back!");
      navigate(getRoleRedirect(roles));
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    const setLoadingFn = provider === "google" ? setIsGoogleLoading : setIsAppleLoading;
    const label = provider === "google" ? "Google" : "Apple";
    setLoadingFn(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) toast.error(`${label} sign-in failed. Please try again.`);
      if (result.redirected) return;
      toast.success("Welcome back!");
      navigate(redirectTo || "/");
    } catch {
      toast.error(`${label} sign-in failed.`);
    } finally {
      setLoadingFn(false);
    }
  };

  const signupHref = redirectTo
    ? `/signup?redirect=${encodeURIComponent(redirectTo)}`
    : "/signup";

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to manage your bookings, messages, and projects."
      footer={
        <>
          Don't have an account?{" "}
          <Link to={signupHref} className="text-primary font-semibold hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <SEOHead
        title="Sign In"
        description={`Sign in to your ${brand} account to book services and manage your appointments.`}
      />

      {redirectContext && (
        <div className="mb-5 flex items-start gap-2.5 rounded-sm border border-primary/20 bg-primary/5 px-3.5 py-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-fs-xs text-heading leading-relaxed">
            Continue to <span className="font-semibold">{redirectContext}</span> after signing in.
          </p>
        </div>
      )}

      <div className="animate-reveal-delay-2">
        <SocialButtons
          mode="in"
          onGoogle={() => handleOAuthLogin("google")}
          onApple={() => handleOAuthLogin("apple")}
          googleLoading={isGoogleLoading}
          appleLoading={isAppleLoading}
        />
      </div>

      <div className="relative my-6 animate-reveal-delay-3" role="separator" aria-label="or continue with email">
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
        <div className="animate-reveal-delay-4">
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
          />
        </div>

        <div className="animate-reveal-delay-5">
          <AuthField
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            labelAction={
              <Link
                to="/forgot-password"
                className="text-[12px] text-primary font-medium hover:underline"
              >
                Forgot?
              </Link>
            }
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
        </div>

        <div className="flex items-center justify-between animate-reveal-delay-6">
          <label className="flex items-center gap-2 cursor-pointer select-none text-fs-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
            />
            Remember me
          </label>
        </div>

        <div className="animate-reveal-delay-6">
          <Button
            type="submit"
            variant="hero"
            size="xl"
            className="w-full gap-2 group mt-1"
            disabled={isLoading}
          >
            {isLoading ? "Signing in…" : "Sign in"}
            {!isLoading && (
              <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
            )}
          </Button>
        </div>
      </form>

    </AuthLayout>
  );
};

export default LoginPage;
