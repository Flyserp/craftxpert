import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
// `relative` + `before:` pseudo-element expands the pointer/tap hit area to a
// minimum of 44×44 CSS px (WCAG 2.5.5 / Apple HIG) WITHOUT changing the visible
// box size. Applied on every variant so icon-only and small buttons meet the
// tap-target rule automatically across the app.
"relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-fs-sm font-medium leading-none tracking-normal ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:min-h-[44px] before:min-w-[44px] before:h-full before:w-full",
 {
 variants: {
 variant: {
  default:"bg-primary text-primary-foreground hover:bg-primary/90",
  primary:"bg-primary text-primary-foreground hover:bg-primary/90",
 destructive:"bg-destructive text-destructive-foreground hover:bg-destructive/90",
  danger:"bg-destructive text-destructive-foreground hover:bg-destructive/90",
 success:"bg-success text-success-foreground hover:bg-success/90",
 warning:"bg-warning text-warning-foreground hover:bg-warning/90",
 info:"bg-info text-info-foreground hover:bg-info/90",
 outline:"border border-input bg-background hover:bg-hover hover:text-hover-foreground",
 secondary:"bg-secondary text-secondary-foreground hover:bg-hover hover:text-hover-foreground",
 ghost:"hover:bg-hover hover:text-hover-foreground",
 link:"text-primary underline-offset-4 hover:underline",
 hero:"bg-primary hover:bg-primary/90 text-fs-md font-semibold text-primary-foreground",
 "hero-outline":"border-2 border-primary bg-transparent text-fs-md font-semibold text-primary hover:bg-primary hover:text-primary-foreground",
 },
 size: {
  default:"h-10 px-4 py-2 !text-[13px] text-center leading-relaxed",
  sm:"h-10 rounded-sm px-3 !text-[13px] text-center leading-relaxed",
  lg:"h-11 rounded-sm px-8 !text-[13px] text-center leading-relaxed",
  xl:"h-12 rounded-sm px-8 !text-[13px] text-center leading-relaxed",
  icon:"h-10 w-10",
  "icon-sm":"h-8 w-8",
  "icon-lg":"h-12 w-12",
 },
 },
 defaultVariants: {
 variant:"default",
 size:"default",
 },
 },
);

export interface ButtonProps
 extends React.ButtonHTMLAttributes<HTMLButtonElement>,
 VariantProps<typeof buttonVariants> {
 asChild?: boolean;
 /** Shows a spinner and disables the button. */
 loading?: boolean;
 /** Optional label shown next to the spinner while loading (e.g. "Saving…"). */
 loadingText?: React.ReactNode;
 /** Accessible label required when rendering an icon-only button. */
 "aria-label"?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;
    const content = loading ? (
      <>
        <Loader2 className="animate-spin" aria-hidden="true" />
        {loadingText ?? children}
      </>
    ) : (
      children
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        type={type}
        {...props}
      >
        {content}
      </Comp>
    );
 },
);
Button.displayName ="Button";

export { Button, buttonVariants };
