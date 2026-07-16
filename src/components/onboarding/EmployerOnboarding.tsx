import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Briefcase, Check } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { useFinishOnboarding } from "./useFinishOnboarding";

const STEPS = ["Company", "About", "First job", "Done"];

const EmployerOnboarding = () => {
  const { user, profile } = useAuth();
  const finish = useFinishOnboarding();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [postJobNext, setPostJobNext] = useState(true);

  const canContinue =
    step === 0
      ? companyName.trim().length > 1 && industry.trim().length > 1 && displayName.trim().length > 1
      : step === 1
        ? address.trim().length > 1
        : true;

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await finish(
        "employer",
        {
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        },
        {
          employerPayload: {
            company_name: companyName.trim(),
            industry: industry.trim(),
            website: website.trim() || null,
            description: description.trim() || null,
            address: address.trim() || null,
          },
        },
      );
      if (postJobNext) navigate("/post-task", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      title="Set up your employer account"
      subtitle="Tell providers who they'll be working with."
      step={step}
      totalSteps={STEPS.length}
      stepLabel={STEPS[step]}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={handleNext}
      canContinue={canContinue}
      saving={saving}
      isLast={step === STEPS.length - 1}
      finishLabel={postJobNext ? "Finish & post first job" : "Finish"}
    >
      {step === 0 && (
        <>
          <Header icon={Building2} title="Your company" />
          <Field label="Contact name (yours) *">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Company name *">
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Industry *">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Construction" />
          </Field>
          <Field label="Website">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Header icon={FileText} title="About the company" />
          <Field label="Business address *">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Head office / city" />
          </Field>
          <Field label="Short description">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your company do? What are you hiring for?"
            />
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <Header icon={Briefcase} title="Get your first hire" />
          <p className="text-[12.5px] text-muted-foreground">
            Post a job now to start receiving proposals immediately, or skip and do it later.
          </p>
          <label className="flex items-center justify-between rounded-sm border border-border bg-card/50 p-3 cursor-pointer">
            <span className="text-[13px] text-heading">
              Take me to "Post a job" after this
            </span>
            <input
              type="checkbox"
              checked={postJobNext}
              onChange={(e) => setPostJobNext(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </>
      )}

      {step === 3 && (
        <div className="text-center py-2 space-y-2">
          <div className="w-12 h-12 rounded-full bg-accent/15 text-primary mx-auto flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <p className="text-heading font-semibold">Your company is set up.</p>
          <p className="text-[13px] text-muted-foreground">
            {postJobNext
              ? "We'll take you straight to Post a Job."
              : "We'll take you to your employer dashboard."}
          </p>
          <Badge variant="secondary">Employer · {companyName || "Company"}</Badge>
        </div>
      )}
    </OnboardingLayout>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[12.5px] font-semibold text-heading">{label}</Label>
    {children}
  </div>
);

const Header = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 text-heading">
    <span className="w-8 h-8 rounded-sm bg-accent/15 text-primary flex items-center justify-center">
      <Icon className="w-4 h-4" />
    </span>
    <span className="text-[14px] font-semibold">{title}</span>
  </div>
);

export default EmployerOnboarding;
