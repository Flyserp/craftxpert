import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared CTA button for landing sections.
 * Enforces uniform h-12 / px-4 sizing and text-primary-foreground
 * on filled variants so contrast stays correct everywhere.
 */
export interface LandingCTAButtonProps extends ButtonProps {
  fullWidth?: boolean;
}

export const LandingCTAButton = React.forwardRef<
  HTMLButtonElement,
  LandingCTAButtonProps
>(({ className, fullWidth, variant = "default", ...props }, ref) => {
  const filled = variant === "default" || variant === "hero";
  return (
    <Button
      ref={ref}
      variant={variant}
      className={cn(
        "h-12 px-4 gap-2",
        fullWidth && "w-full",
        filled && "text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
});
LandingCTAButton.displayName = "LandingCTAButton";

export default LandingCTAButton;