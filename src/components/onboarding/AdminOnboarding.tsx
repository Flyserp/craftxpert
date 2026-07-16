import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck,
  Users,
  CreditCard,
  Settings,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import OnboardingLayout from "./OnboardingLayout";
import { useFinishOnboarding } from "./useFinishOnboarding";

const AdminOnboarding = () => {
  const { profile } = useAuth();
  const finish = useFinishOnboarding();
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await finish("admin", {
        display_name: profile?.display_name?.trim() || "Admin",
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to complete setup");
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { to: "/admin/users", icon: Users, label: "Users & roles", desc: "Manage members and permissions." },
    { to: "/admin/verifications", icon: BadgeCheck, label: "Verifications", desc: "Approve provider documents." },
    { to: "/admin/payments", icon: CreditCard, label: "Payments", desc: "Track transactions & payouts." },
    { to: "/admin/settings", icon: Settings, label: "Platform settings", desc: "Configure fees, categories, and more." },
  ];

  return (
    <OnboardingLayout
      title="Welcome, admin"
      subtitle="You have full access to the platform. Here's where to start."
      step={0}
      totalSteps={1}
      stepLabel="Overview"
      onNext={handleFinish}
      canContinue
      saving={saving}
      isLast
      finishLabel="Enter admin dashboard"
      hideBack
    >
      <div className="flex items-center gap-2 text-heading">
        <span className="w-8 h-8 rounded-sm bg-accent/15 text-primary flex items-center justify-center">
          <ShieldCheck className="w-4 h-4" />
        </span>
        <span className="text-[14px] font-semibold">Your control center</span>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Jump straight into any area — or continue to the dashboard for the full overview.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-sm border border-border bg-card/50 p-3 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-sm bg-accent/15 text-primary flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="mt-2 text-[13px] font-semibold text-heading">{c.label}</p>
              <p className="text-[12px] text-muted-foreground leading-snug">{c.desc}</p>
            </Link>
          );
        })}
      </div>
    </OnboardingLayout>
  );
};

export default AdminOnboarding;
