import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { usePwaBranding } from "@/hooks/usePwaBranding";

const DISMISS_KEY = "pwa-install-dismissed-at";
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export default function PwaInstallPrompt() {
  const { canInstall, isStandalone, promptInstall } = usePwaInstall();
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!canInstall || isStandalone) { setShow(false); return; }
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < COOLDOWN_MS) return;
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, [canInstall, isStandalone]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-96 rounded-sm border border-border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-fs-sm font-semibold text-heading">Install {brand}</div>
        <p className="text-fs-xs text-muted-foreground mt-0.5">
          Add to your home screen for faster access, offline support, and push updates.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={async () => { await promptInstall(); setShow(false); }}>
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}