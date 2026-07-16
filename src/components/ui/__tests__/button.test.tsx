import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "../button";

const FILLED_VARIANTS = [
  { variant: "default", fg: "text-primary-foreground" },
  { variant: "hero", fg: "text-primary-foreground" },
  { variant: "destructive", fg: "text-destructive-foreground" },
  { variant: "secondary", fg: "text-secondary-foreground" },
] as const;

const SIZES = ["default", "sm", "lg", "xl", "icon"] as const;

describe("Button foreground tokens", () => {
  for (const { variant, fg } of FILLED_VARIANTS) {
    for (const size of SIZES) {
      it(`variant="${variant}" size="${size}" applies ${fg}`, () => {
        const { container } = render(
          <Button variant={variant} size={size}>
            Hi
          </Button>,
        );
        const btn = container.querySelector("button")!;
        expect(btn.className).toContain(fg);
        expect(btn.className).not.toContain("text-accent ");
        expect(btn.className).not.toMatch(/text-accent$/);
      });
    }
  }
});