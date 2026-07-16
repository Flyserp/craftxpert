import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type DevicePlatform = "ios" | "android" | "desktop" | "unknown";

export interface PwaInstallState {
  /** true if running already as installed PWA (standalone) */
  isStandalone: boolean;
  /** true if browser supports the native install prompt and offered it */
  canInstall: boolean;
  /** detected platform — drives instructions */
  platform: DevicePlatform;
  /** trigger native prompt; returns true if user accepted */
  promptInstall: () => Promise<boolean>;
}

function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS reports as Mac — heuristic
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS legacy
  // @ts-expect-error - non-standard Safari property
  if (window.navigator.standalone === true) return true;
  return false;
}

export function usePwaInstall(): PwaInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone());
  const [platform] = useState<DevicePlatform>(detectPlatform());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === "accepted";
  }, [deferred]);

  return {
    isStandalone,
    canInstall: !!deferred,
    platform,
    promptInstall,
  };
}
