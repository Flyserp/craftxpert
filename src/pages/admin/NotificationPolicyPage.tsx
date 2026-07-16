import { useEffect, useState } from "react";
import { Bell, Loader2, Save, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  EVENT_BUCKETS,
  DEFAULT_TENANT_POLICY,
  loadTenantPolicy,
  saveTenantPolicy,
  type TenantPolicy,
  type ChannelKey,
  type RecipientRole,
  type EventBucketKey,
} from "@/lib/notificationPolicy";
import { Heading } from "@/components/ui/app";

const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: "in_app", label: "In-app" },
  { key: "email",  label: "Email"  },
  { key: "sms",    label: "SMS"    },
];

const ROLES: { key: RecipientRole; label: string }[] = [
  { key: "customer",   label: "Customers" },
  { key: "provider", label: "Providers" },
  { key: "admin",    label: "Admins"    },
];

export default function NotificationPolicyPage() {
  const [policy, setPolicy] = useState<TenantPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadTenantPolicy(true)
      .then((p) => setPolicy(p))
      .catch(() => toast.error("Could not load notification policy"))
      .finally(() => setLoading(false));
  }, []);

  const setChannel = (bucket: EventBucketKey, ch: ChannelKey, val: boolean) => {
    setPolicy((p) => {
      if (!p) return p;
      const next = { ...p, [bucket]: { ...p[bucket], channels: { ...p[bucket].channels, [ch]: val } } };
      return next;
    });
    setDirty(true);
  };

  const setRecipient = (bucket: EventBucketKey, role: RecipientRole, val: boolean) => {
    setPolicy((p) => {
      if (!p) return p;
      const next = { ...p, [bucket]: { ...p[bucket], recipients: { ...p[bucket].recipients, [role]: val } } };
      return next;
    });
    setDirty(true);
  };

  const setNotifyBoth = (bucket: EventBucketKey, val: boolean) => {
    setPolicy((p) => {
      if (!p) return p;
      return { ...p, [bucket]: { ...p[bucket], notify_both: val } };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await saveTenantPolicy(policy);
      toast.success("Notification policy saved");
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPolicy(JSON.parse(JSON.stringify(DEFAULT_TENANT_POLICY)));
    setDirty(true);
  };

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Heading level={1} >Notification Policy</Heading>
            <p className="text-fs-sm text-muted-foreground">
              Control which events trigger notifications platform-wide and who receives them.
              Individual users can still narrow these in their own preferences.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save changes
          </Button>
        </div>
      </header>

      <div className="grid gap-4">
        {EVENT_BUCKETS.map((bucket) => {
          const b = policy[bucket.key];
          return (
            <section
              key={bucket.key}
              className="bg-card border border-border rounded-sm p-5 space-y-4"
            >
              <div>
                <Heading level={2} >{bucket.label}</Heading>
                <p className="text-fs-xs text-muted-foreground">{bucket.desc}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Channels */}
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                    Send via
                  </p>
                  <div className="space-y-2">
                    {CHANNELS.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border/60 hover:border-border transition-colors"
                      >
                        <span className="text-fs-sm text-foreground">{c.label}</span>
                        <Switch
                          checked={b.channels[c.key]}
                          onCheckedChange={(v) => setChannel(bucket.key, c.key, v)}
                          aria-label={`${bucket.label} ${c.label}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                    Who receives it
                  </p>
                  <div className="space-y-2">
                    {ROLES.map((r) => (
                      <label
                        key={r.key}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border/60 hover:border-border transition-colors"
                      >
                        <span className="text-fs-sm text-foreground">{r.label}</span>
                        <Switch
                          checked={b.recipients[r.key]}
                          onCheckedChange={(v) => setRecipient(bucket.key, r.key, v)}
                          aria-label={`${bucket.label} recipient ${r.label}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border/60 hover:border-border transition-colors">
                <div>
                  <span className="text-fs-sm text-foreground block">Notify both parties</span>
                  <span className="text-fs-xs text-muted-foreground">When off, only the OTHER party is notified — the user who triggered the event isn't.</span>
                </div>
                <Switch
                  checked={b.notify_both}
                  onCheckedChange={(v) => setNotifyBoth(bucket.key, v)}
                  aria-label={`${bucket.label} notify both parties`}
                />
              </label>
            </section>
          );
        })}
      </div>

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-card border border-border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
            <span className="text-fs-xs text-muted-foreground">Unsaved changes</span>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
