import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, ShieldCheck, Sparkles, User, Check } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { useFinishOnboarding } from "./useFinishOnboarding";

const STEPS = ["Business", "Services", "Verification", "Plan", "Done"];

type Plan = "free" | "pro" | "elite";

const PLAN_OPTIONS: { value: Plan; title: string; blurb: string }[] = [
  { value: "free", title: "Starter", blurb: "Get discovered. Basic listings + limited leads." },
  { value: "pro", title: "Pro", blurb: "Unlock premium leads, lower fees, verified badge." },
  { value: "elite", title: "Elite", blurb: "Priority ranking, dedicated support, top placements." },
];

const ProviderOnboarding = () => {
  const { user, profile } = useAuth();
  const finish = useFinishOnboarding();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState<Plan>("free");

  useEffect(() => {
    supabase
      .from("service_categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const canContinue =
    step === 0
      ? displayName.trim().length > 1 && phone.trim().length > 5 && address.trim().length > 1
      : step === 1
        ? skills.trim().length > 1 && !!categoryId && experience.trim().length > 0
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
        "provider",
        {
          display_name: displayName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          business_name: businessName.trim() || null,
          bio: bio.trim() || null,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          experience_years: experience ? Number(experience) : null,
          category_id: categoryId || null,
        },
        { providerPlan: plan },
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      title="Set up your provider profile"
      subtitle="Show customers who you are and what you do best."
      step={step}
      totalSteps={STEPS.length}
      stepLabel={STEPS[step]}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={handleNext}
      canContinue={canContinue}
      saving={saving}
      isLast={step === STEPS.length - 1}
    >
      {step === 0 && (
        <>
          <Header icon={User} title="Your business" />
          <Field label="Display name *">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Business name (optional)">
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </Field>
          <Field label="Phone *">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Service area / address *">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Harare, Zimbabwe" />
          </Field>
          <Field label="Short bio">
            <Textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell clients what makes you great."
            />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Header icon={Briefcase} title="What you offer" />
          <Field label="Primary category *">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Skills (comma separated) *">
            <Input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Plumbing, Electrical, Painting"
            />
          </Field>
          <Field label="Years of experience *">
            <Input
              type="number"
              min={0}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <Header icon={ShieldCheck} title="Get verified" />
          <p className="text-[12.5px] text-muted-foreground">
            Verified providers win more work. After finishing setup, upload your ID and
            business documents from the Verification page to earn the badge.
          </p>
          <div className="rounded-sm border border-border bg-card/50 p-3 text-[12.5px] text-heading">
            <p className="font-semibold mb-1">You'll need:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>Government-issued ID</li>
              <li>Proof of address (recent utility bill)</li>
              <li>Business registration or professional license (if applicable)</li>
            </ul>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Header icon={Sparkles} title="Pick a plan" />
          <div className="space-y-2">
            {PLAN_OPTIONS.map((p) => {
              const on = plan === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlan(p.value)}
                  className={`w-full rounded-sm border-2 p-3 text-left transition-colors ${
                    on ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-heading">{p.title}</span>
                    {on && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{p.blurb}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            You can change or upgrade your plan anytime from Settings.
          </p>
        </>
      )}

      {step === 4 && (
        <div className="text-center py-2 space-y-2">
          <div className="w-12 h-12 rounded-full bg-accent/15 text-primary mx-auto flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <p className="text-heading font-semibold">You're ready to accept jobs.</p>
          <p className="text-[13px] text-muted-foreground">
            We'll save your profile and take you to your provider dashboard.
          </p>
          <Badge variant="secondary">Provider · {plan.toUpperCase()}</Badge>
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

export default ProviderOnboarding;
