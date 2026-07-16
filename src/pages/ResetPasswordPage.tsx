import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthField from "@/components/auth/AuthField";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    }
  };

  if (!isRecovery && !success) {
    return (
      <AuthLayout
        panelVariant="reset"
        eyebrow="Password reset"
        title="Link expired"
        subtitle="This reset link is invalid or has already been used."
      >
        <div className="text-center">
          <Link to="/forgot-password" className="inline-block">
            <Button variant="hero" size="xl">
              Request a new link
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      panelVariant="reset"
      eyebrow="Password reset"
      title={success ? "Password updated" : "Set a new password"}
      subtitle={
        success
          ? undefined
          : "Choose a strong password — at least 6 characters."
      }
    >
      {success ? (
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-primary" />
          </div>
          <p className="text-fs-sm text-body">Redirecting you to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <AuthField
            label="New password"
            type={showPassword ? "text" : "password"}
            name="new-password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            errorMessage={
              password.length > 0 && password.length < 6
                ? "Password must be at least 6 characters"
                : undefined
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

          <AuthField
            label="Confirm password"
            type={showPassword ? "text" : "password"}
            name="confirm-password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            errorMessage={
              confirmPassword.length > 0 && confirmPassword !== password
                ? "Passwords do not match"
                : undefined
            }
            showValidIndicator={confirmPassword.length > 0 && confirmPassword === password}
          />

          <Button
            type="submit"
            variant="hero"
            size="xl"
            className="w-full mt-1"
            disabled={isLoading}
          >
            {isLoading ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
