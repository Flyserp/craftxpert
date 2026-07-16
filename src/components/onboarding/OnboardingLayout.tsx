import { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OnboardingLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
  onBack?: () => void;
  onNext: () => void | Promise<void>;
  canContinue?: boolean;
  saving?: boolean;
  isLast?: boolean;
  finishLabel?: string;
  hideBack?: boolean;
  children: ReactNode;
}

/**
 * Shared shell for every role-specific onboarding flow.
 * Owns the header, progress bar, and back/continue affordances so the
 * step components only worry about their own form fields.
 */
const OnboardingLayout = ({
  eyebrow,
  title,
  subtitle,
  step,
  totalSteps,
  stepLabel,
  onBack,
  onNext,
  canContinue = true,
  saving = false,
  isLast = false,
  finishLabel = "Finish & enter app",
  hideBack = false,
  children,
}: OnboardingLayoutProps) => {
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <AuthLayout
      eyebrow={eyebrow ?? `Step ${step + 1} of ${totalSteps}`}
      title={title}
      subtitle={subtitle}
    >
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span className="font-semibold text-heading">{stepLabel}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="space-y-4">{children}</div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {hideBack ? (
          <span />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={!onBack || step === 0 || saving}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        <Button
          type="button"
          variant="hero"
          size="lg"
          onClick={onNext}
          disabled={!canContinue || saving}
          className="gap-2"
        >
          {isLast ? (saving ? "Saving…" : finishLabel) : "Continue"}
          {!isLast && <ArrowRight className="w-4 h-4" />}
        </Button>
      </div>
    </AuthLayout>
  );
};

export default OnboardingLayout;
