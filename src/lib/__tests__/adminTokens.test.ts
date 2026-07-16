import { describe, it, expect } from "vitest";
import {
  ADMIN_STATUS_TONES,
  ADMIN_STAT_ACCENTS,
  ADMIN_ICON_TILE,
  ADMIN_USER_PLAN_TONES,
  ADMIN_AVATAR_FALLBACK,
  type AdminStatusTone,
  type AdminStatAccent,
  type AdminPlanTone,
} from "@/lib/roleTokens";

describe("Admin token maps — drift guards", () => {
  describe("ADMIN_STATUS_TONES", () => {
    const required: AdminStatusTone[] = [
      "info",
      "success",
      "warning",
      "danger",
      "neutral",
      "settled",
    ];

    it.each(required)("exposes %s tone", (tone) => {
      expect(ADMIN_STATUS_TONES[tone]).toBeTruthy();
    });

    it("info uses blue 50/700 + dark variants", () => {
      const t = ADMIN_STATUS_TONES.info;
      expect(t).toContain("bg-blue-50");
      expect(t).toContain("text-blue-700");
      expect(t).toContain("dark:bg-blue-950/30");
      expect(t).toContain("dark:text-blue-400");
    });

    it("success uses emerald 50/700 + dark variants", () => {
      const t = ADMIN_STATUS_TONES.success;
      expect(t).toContain("bg-emerald-50");
      expect(t).toContain("text-emerald-700");
      expect(t).toContain("dark:bg-emerald-950/30");
      expect(t).toContain("dark:text-emerald-400");
    });

    it("warning uses amber 50/700 + dark variants", () => {
      const t = ADMIN_STATUS_TONES.warning;
      expect(t).toContain("bg-amber-50");
      expect(t).toContain("text-amber-700");
      expect(t).toContain("dark:bg-amber-950/30");
      expect(t).toContain("dark:text-amber-400");
    });

    it("danger uses semantic destructive token (theme-aware, no hard-coded color)", () => {
      const t = ADMIN_STATUS_TONES.danger;
      expect(t).toContain("bg-destructive/10");
      expect(t).toContain("text-destructive");
      // Must NOT pin to a specific tailwind color — the destructive HSL flips per theme.
      expect(t).not.toMatch(/bg-(red|rose)-\d+/);
    });

    it("neutral + settled use semantic muted/secondary tokens (no hard color)", () => {
      expect(ADMIN_STATUS_TONES.neutral).toBe("bg-muted text-muted-foreground");
      expect(ADMIN_STATUS_TONES.settled).toBe("bg-secondary text-secondary-foreground");
    });
  });

  describe("ADMIN_STAT_ACCENTS", () => {
    const required: AdminStatAccent[] = [
      "primary",
      "info",
      "success",
      "warning",
      "danger",
      "neutral",
    ];

    it.each(required)("exposes %s accent with bg + accent keys", (key) => {
      const entry = ADMIN_STAT_ACCENTS[key];
      expect(entry).toMatchObject({
        bg: expect.any(String),
        accent: expect.any(String),
      });
      expect(entry.bg.length).toBeGreaterThan(0);
      expect(entry.accent.length).toBeGreaterThan(0);
    });

    it("primary uses semantic --primary token (theme-aware)", () => {
      expect(ADMIN_STAT_ACCENTS.primary).toEqual({
        bg: "bg-primary/10",
        accent: "text-primary",
      });
    });

    it("danger uses semantic --destructive token (theme-aware)", () => {
      expect(ADMIN_STAT_ACCENTS.danger).toEqual({
        bg: "bg-destructive/10",
        accent: "text-destructive",
      });
    });

    it("colored accents (info/success/warning) use /10 tinted backgrounds", () => {
      expect(ADMIN_STAT_ACCENTS.info.bg).toBe("bg-blue-500/10");
      expect(ADMIN_STAT_ACCENTS.success.bg).toBe("bg-emerald-500/10");
      expect(ADMIN_STAT_ACCENTS.warning.bg).toBe("bg-amber-500/10");
    });

    it("neutral uses muted semantic token (no hard color)", () => {
      expect(ADMIN_STAT_ACCENTS.neutral).toEqual({
        bg: "bg-muted",
        accent: "text-muted-foreground",
      });
    });
  });

  describe("ADMIN_ICON_TILE", () => {
    it("exposes primary, destructive, and muted variants", () => {
      expect(ADMIN_ICON_TILE.primary).toBe("bg-primary/10 text-primary");
      expect(ADMIN_ICON_TILE.destructive).toBe("bg-destructive/10 text-destructive");
      expect(ADMIN_ICON_TILE.muted).toBe("bg-muted text-muted-foreground");
    });

    it("never references hard-coded tailwind color scales", () => {
      Object.values(ADMIN_ICON_TILE).forEach((v) => {
        expect(v).not.toMatch(/bg-(red|rose|emerald|amber|blue|green|yellow)-\d+/);
      });
    });
  });

  describe("ADMIN_USER_PLAN_TONES", () => {
    const required: AdminPlanTone[] = ["free", "pro", "elite"];

    it.each(required)("exposes %s plan tone", (plan) => {
      expect(ADMIN_USER_PLAN_TONES[plan]).toBeTruthy();
    });

    it("plan tones reuse the shared ADMIN_STATUS_TONES (no drift)", () => {
      expect(ADMIN_USER_PLAN_TONES.free).toBe(ADMIN_STATUS_TONES.settled);
      expect(ADMIN_USER_PLAN_TONES.pro).toBe(ADMIN_STATUS_TONES.info);
      expect(ADMIN_USER_PLAN_TONES.elite).toBe(ADMIN_STATUS_TONES.warning);
    });
  });

  describe("ADMIN_AVATAR_FALLBACK", () => {
    it("uses tinted primary tokens (theme-aware) and no hard color", () => {
      expect(ADMIN_AVATAR_FALLBACK).toBe("bg-primary/10 text-primary");
      expect(ADMIN_AVATAR_FALLBACK).not.toMatch(/bg-\w+-\d+/);
    });
  });
});
