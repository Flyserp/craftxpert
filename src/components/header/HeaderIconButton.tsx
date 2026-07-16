import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Unified icon button used across the header (theme toggle, notification bell,
 * avatar trigger, menu toggle, login icon, etc.).
 *
 * Guarantees identical sizing, padding, border radius, hover, focus and active
 * states for every icon-shaped button in the header across all breakpoints.
 */
export interface HeaderIconButtonProps extends Omit<ButtonProps, "size"> {
  /** Show a notification dot / badge anchor — adds `relative` positioning. */
  withBadge?: boolean;
}

const HeaderIconButton = forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  ({ className, variant = "ghost", withBadge: _withBadge, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size="sm"
        className={cn(
          // Layout — identical box for every header icon button
          "relative h-10 w-10 shrink-0 p-0 rounded-full",
          // Color + hover
          "text-muted-foreground hover:text-foreground",
          // Focus + active consistency
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "active:scale-95 transition-transform",
          className,
        )}
        {...props}
      />
    );
  },
);
HeaderIconButton.displayName = "HeaderIconButton";

export default HeaderIconButton;
