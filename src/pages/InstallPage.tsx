import { Link } from "react-router-dom";
import {
  Download, Smartphone, Apple, Chrome, Share, Plus, Check,
  Wifi, Bell, Zap, Sparkles, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import Footer from "@/components/landing/Footer";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import Logo from "@/components/Logo";
import { Heading } from "@/components/ui/app";

export default function InstallPage() {
  const { isStandalone, canInstall, platform, promptInstall } = usePwaInstall();
  const branding = usePwaBranding();

  const handleInstall = async () => {
    const ok = await promptInstall();
    // No-op: state updates from event listeners
    if (!ok) {
      // user dismissed — silent
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={`Install ${branding.appName} App`}
        description={`Install the ${branding.appName} app on your phone or desktop. Works offline, sends notifications, and feels native.`}
      />
      <UnifiedHeader showSearch={false} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10 pointer-events-none" />
          <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative">
            <div className="flex flex-col md:flex-row items-center gap-10">
              {/* Icon preview */}
              <div className="shrink-0">
                <div
                  className="w-32 h-32 md:w-40 md:h-40 rounded-sm shadow-2xl border border-border/40 overflow-hidden flex items-center justify-center bg-card"
                  style={{ backgroundColor: branding.backgroundColor }}
                >
                  {branding.iconUrl ? (
                    <img
                      src={branding.iconUrl}
                      alt={`${branding.appName} icon`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Logo size={96} />
                  )}
                </div>
              </div>

              {/* Copy */}
              <div className="flex-1 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-4">
                  <Sparkles className="w-3 h-3" /> Installable App
                </span>
                <Heading level={1}  className="mb-3">
                  Get the {branding.appName} app
                </Heading>
                <p className="text-fs-base md:text-fs-lg text-body max-w-xl mb-6">
                  One tap from your home screen. Works offline, opens in seconds, and
                  feels just like a native app — no app store required.
                </p>

                {isStandalone ? (
                  <div className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 py-3 text-fs-sm text-heading">
                    <Check className="w-4 h-4 text-primary" />
                    You're already running the installed app — enjoy!
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 items-center md:items-start">
                    <Button
                      size="lg"
                      onClick={handleInstall}
                      disabled={!canInstall}
                      className="gap-2 min-w-[200px]"
                    >
                      <Download className="w-4 h-4" />
                      {canInstall ? "Install now" : "See instructions below"}
                    </Button>
                    <Link to="/">
                      <Button variant="ghost" size="lg" className="gap-1.5">
                        Maybe later <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}
                {!canInstall && !isStandalone && (
                  <p className="text-fs-xs text-muted-foreground mt-3">
                    Install button only appears in supported browsers. Follow the
                    steps below for your device.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Why install */}
        <section className="container mx-auto px-4 py-12 max-w-5xl">
          <Heading level={2}  className="uppercase text-muted-foreground mb-4">
            Why install?
          </Heading>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Zap, title: "Instant launch", desc: "Open from home screen — no browser tabs." },
              { icon: Wifi, title: "Works offline", desc: "Browse recently viewed pages without a connection." },
              { icon: Bell, title: "Push notifications", desc: "Booking updates and messages, in real time." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="p-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-fs-sm font-semibold text-heading mb-1">{title}</p>
                <p className="text-fs-xs text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Per-OS instructions */}
        <section className="container mx-auto px-4 pb-16 max-w-5xl">
          <Heading level={2}  className="uppercase text-muted-foreground mb-4">
            Step-by-step
          </Heading>

          <div className="grid md:grid-cols-3 gap-4">
            {/* iOS */}
            <Card className={`p-5 ${platform === "ios" ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <Apple className="w-5 h-5 text-heading" />
                <p className="text-fs-sm font-semibold text-heading">iPhone & iPad</p>
                {platform === "ios" && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                )}
              </div>
              <ol className="text-fs-xs text-body space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">1</span>
                  Open this page in <strong>Safari</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">2</span>
                  Tap the <Share className="inline w-3.5 h-3.5 mx-0.5" /> Share button.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">3</span>
                  Choose <strong>Add to Home Screen</strong>{" "}
                  <Plus className="inline w-3.5 h-3.5 mx-0.5" />.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">4</span>
                  Tap <strong>Add</strong> to confirm.
                </li>
              </ol>
            </Card>

            {/* Android */}
            <Card className={`p-5 ${platform === "android" ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-5 h-5 text-heading" />
                <p className="text-fs-sm font-semibold text-heading">Android</p>
                {platform === "android" && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                )}
              </div>
              <ol className="text-fs-xs text-body space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">1</span>
                  Open this page in <strong>Chrome</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">2</span>
                  Tap the <strong>⋮</strong> menu (top-right).
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">3</span>
                  Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">4</span>
                  Tap <strong>Install</strong> to confirm.
                </li>
              </ol>
            </Card>

            {/* Desktop */}
            <Card className={`p-5 ${platform === "desktop" ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <Chrome className="w-5 h-5 text-heading" />
                <p className="text-fs-sm font-semibold text-heading">Desktop (Chrome / Edge)</p>
                {platform === "desktop" && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                )}
              </div>
              <ol className="text-fs-xs text-body space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">1</span>
                  Look for the <Download className="inline w-3.5 h-3.5 mx-0.5" /> install icon in the address bar.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">2</span>
                  Or use the menu → <strong>Install {branding.appName}</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">3</span>
                  Confirm the install dialog.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">4</span>
                  Launch it from your dock or Start menu.
                </li>
              </ol>
            </Card>
          </div>

          <p className="text-fs-xs text-muted-foreground text-center mt-8">
            Tip: PWA install only works in production. If you're testing inside a
            preview, publish the app first.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
