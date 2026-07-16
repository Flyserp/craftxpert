import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Home, MapPin, Bell, Check } from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { useFinishOnboarding } from "./useFinishOnboarding";

const STEPS = ["Welcome", "Location", "Notifications", "Done"];

type PushCats = {
  push_enabled: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  payment_updates: boolean;
  review_alerts: boolean;
  marketing: boolean;
};

const DEFAULT_CATS: PushCats = {
  push_enabled: true,
  booking_updates: true,
  new_messages: true,
  payment_updates: true,
  review_alerts: true,
  marketing: false,
};

const CustomerOnboarding = () => {
  const { user, profile } = useAuth();
  const finish = useFinishOnboarding();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [city, setCity] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [cats, setCats] = useState<PushCats>(DEFAULT_CATS);

  useEffect(() => {
    supabase
      .from("service_categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const toggleCat = (id: string) =>
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const canContinue =
    step === 0
      ? displayName.trim().length > 1
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
      await supabase
        .from("provider_push_settings")
        .upsert(
          { provider_id: user.id, ...cats, overrides_defaults: true },
          { onConflict: "provider_id" },
        );
      await finish("customer", {
        display_name: displayName.trim(),
        phone: phone.trim() || null,
        address: [address.trim(), city.trim()].filter(Boolean).join(", ") || null,
        bio: selectedCats.length
          ? `Looking for: ${categories
              .filter((c) => selectedCats.includes(c.id))
              .map((c) => c.name)
              .join(", ")}`
          : null,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      title="Welcome to ZimProHire"
      subtitle="A few quick details so we can match you with the right pros."
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
          <Header icon={Home} title="Tell us who you are" />
          <Field label="Full name *">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Header icon={MapPin} title="Where do you need help?" />
          <Field label="Street / suburb *">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Samora Machel Ave" />
          </Field>
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Harare" />
          </Field>
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-semibold text-heading">Services you may need</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.slice(0, 12).map((c) => {
                const on = selectedCats.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    className={`px-2.5 py-1 rounded-sm border text-[12px] transition-colors ${
                      on
                        ? "border-accent bg-accent/15 text-heading"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Header icon={Bell} title="Stay in the loop" />
          <p className="text-[12.5px] text-muted-foreground">
            Pick which alerts you want. You can change these later in Settings.
          </p>
          <div className="space-y-2">
            {(
              [
                ["booking_updates", "Booking updates"],
                ["new_messages", "New messages"],
                ["payment_updates", "Payment updates"],
                ["review_alerts", "Review alerts"],
                ["marketing", "Promotions & offers"],
              ] as [keyof PushCats, string][]
            ).map(([k, label]) => (
              <label
                key={k}
                className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card/50 p-2.5 cursor-pointer"
              >
                <span className="text-[13px] text-heading">{label}</span>
                <input
                  type="checkbox"
                  checked={cats[k]}
                  onChange={(e) => setCats((p) => ({ ...p, [k]: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <div className="text-center py-2 space-y-2">
          <div className="w-12 h-12 rounded-full bg-accent/15 text-primary mx-auto flex items-center justify-center">
            <Check className="w-6 h-6" />
          </div>
          <p className="text-heading font-semibold">You're ready to hire.</p>
          <p className="text-[13px] text-muted-foreground">
            We'll save your profile and take you to your dashboard.
          </p>
          <Badge variant="secondary">Customer account</Badge>
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

export default CustomerOnboarding;
