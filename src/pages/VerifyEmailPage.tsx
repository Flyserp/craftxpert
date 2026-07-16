import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Status = "checking" | "success" | "pending" | "error";

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const queryError = params.get("error") || hashParams.get("error");
    const queryErrorDesc =
      params.get("error_description") || hashParams.get("error_description");
    const type = params.get("type") || hashParams.get("type");

    if (queryError) {
      setErrorMsg(queryErrorDesc || queryError);
      setStatus("error");
      return;
    }

    // Supabase auto-exchanges the code in the URL via detectSessionInUrl.
    // If we land here with a session OR a recognized verification type, treat as success.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setStatus("success");
        return;
      }
      if (type === "signup" || type === "email_change" || hash.includes("access_token") || search.includes("code=")) {
        // Wait briefly for the auth state listener to settle
        setTimeout(async () => {
          const { data: s } = await supabase.auth.getSession();
          setStatus(s.session ? "success" : "pending");
        }, 800);
        return;
      }
      setStatus("pending");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setStatus("success");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [params]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email sent. Check your inbox.");
    }
  };

  if (status === "checking") {
    return (
      <AuthLayout eyebrow="Email verification" title="Verifying…" panelVariant="reset">
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-fs-sm text-body">Checking your verification link…</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthLayout
        eyebrow="Email verification"
        title="Email verified"
        subtitle="Your email is confirmed. You can continue to your dashboard."
        panelVariant="reset"
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-primary" />
          </div>
          <Button variant="hero" size="xl" className="w-full" onClick={() => navigate("/")}>
            Continue
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (status === "error") {
    return (
      <AuthLayout
        eyebrow="Email verification"
        title="Verification failed"
        subtitle={errorMsg || "This verification link is invalid or has expired."}
        panelVariant="reset"
      >
        <form onSubmit={handleResend} className="space-y-4">
          <AuthField
            label="Email"
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
          />
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={resending}>
            {resending ? "Sending…" : "Resend verification email"}
          </Button>
          <p className="text-center text-fs-xs text-muted-foreground">
            <Link to="/login" className="underline hover:text-foreground">Back to sign in</Link>
          </p>
        </form>
      </AuthLayout>
    );
  }

  // pending
  return (
    <AuthLayout
      eyebrow="Email verification"
      title="Check your inbox"
      subtitle="We sent you a verification link. Click it to activate your account."
      panelVariant="reset"
    >
      <div className="flex items-start gap-2.5 rounded-sm border border-primary/20 bg-primary/5 px-3.5 py-2.5 mb-4">
        <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-fs-xs text-heading leading-relaxed">
          Didn't get the email? Check spam, or resend below.
        </p>
      </div>
      <form onSubmit={handleResend} className="space-y-4">
        <AuthField
          label="Email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
        />
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={resending}>
          {resending ? "Sending…" : "Resend verification email"}
        </Button>
        <p className="text-center text-fs-xs text-muted-foreground">
          <Link to="/login" className="underline hover:text-foreground">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default VerifyEmailPage;