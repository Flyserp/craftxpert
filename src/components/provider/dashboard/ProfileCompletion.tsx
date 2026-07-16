import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserCheck, Settings, CheckCircle, User, Phone, FileText, MapPin, Image as ImageIcon, Zap } from "lucide-react";
import { Heading } from "@/components/ui/app";

const PROFILE_FIELDS = [
  { key: "display_name", label: "Display name", icon: User },
  { key: "avatar_url", label: "Profile photo", icon: ImageIcon },
  { key: "bio", label: "Bio / description", icon: FileText },
  { key: "phone", label: "Phone number", icon: Phone },
  { key: "address", label: "Address", icon: MapPin },
];

interface Props {
  profile: Record<string, any> | null;
  servicesCount: number;
  portfolioCount: number;
}

const ProfileCompletion = ({ profile, servicesCount, portfolioCount }: Props) => {
  const filled = profile ? PROFILE_FIELDS.filter((f) => {
    const val = profile[f.key];
    return val && val.trim && val.trim() !== "";
  }) : [];
  const missing = PROFILE_FIELDS.filter((f) => {
    const val = profile?.[f.key];
    return !val || (val.trim && val.trim() === "");
  });
  const hasServices = servicesCount > 0;
  const hasPortfolio = portfolioCount > 0;
  const totalFields = PROFILE_FIELDS.length + 2;
  const filledCount = filled.length + (hasServices ? 1 : 0) + (hasPortfolio ? 1 : 0);
  const percent = Math.round((filledCount / totalFields) * 100);

  return (
    <section className="bg-card rounded-sm border border-border p-5 animate-reveal-delay-1">
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}  className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          Profile Completion
        </Heading>
        <span className={cn(
          "text-fs-xs font-bold tabular-nums px-2 py-0.5 rounded-full",
          percent === 100 ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
          {percent}%
        </span>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      {percent < 100 ? (
        <div className="space-y-2">
          {missing.slice(0, 3).map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-fs-xs text-muted-foreground">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                <f.icon className="w-3 h-3" />
              </div>
              <span>Add {f.label.toLowerCase()}</span>
            </div>
          ))}
          {!hasServices && (
            <div className="flex items-center gap-2 text-fs-xs text-muted-foreground">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><Zap className="w-3 h-3" /></div>
              <span>Add at least one service</span>
            </div>
          )}
          {!hasPortfolio && (
            <div className="flex items-center gap-2 text-fs-xs text-muted-foreground">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-3 h-3" /></div>
              <span>Upload portfolio images</span>
            </div>
          )}
          <Link to="/provider-profile">
            <Button size="sm" variant="outline" className="w-full mt-2 gap-1.5 text-fs-xs">
              <Settings className="w-3 h-3" /> Complete Profile
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-fs-xs text-primary">
          <CheckCircle className="w-4 h-4" />
          <span className="font-medium">Profile complete!</span>
        </div>
      )}
    </section>
  );
};

export default ProfileCompletion;
