import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthField from "@/components/auth/AuthField";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <AuthLayout
      panelVariant="forgot"
      eyebrow="Password reset"
      title={sent ? "Check your inbox" : "Forgot your password?"}
      subtitle={
        sent
          ? undefined
          : "Enter the email tied to your account and we'll send a reset link."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-primary" />
          </div>
          <p className="text-fs-sm text-body mb-5 leading-relaxed">
            We sent a reset link to{" "}
            <strong className="text-heading">{email}</strong>. The link expires in 1 hour.
          </p>
          <Button
            variant="outline"
            onClick={() => setSent(false)}
            className="gap-2"
          >
            <Mail className="w-4 h-4" />
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            label="Email address"
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

          <Button
            type="submit"
            variant="hero"
            size="xl"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
