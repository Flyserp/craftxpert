import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CheckboxBase = React.ComponentPropsWithoutRef<typeof Checkbox>;

export interface AppCheckboxProps extends CheckboxBase {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

/** Standard labeled checkbox with optional hint/error and disabled state. */
const AppCheckbox = React.forwardRef<
  React.ElementRef<typeof Checkbox>,
  AppCheckboxProps
>(({ label, hint, error, id, containerClassName, className, disabled, ...rest }, ref) => {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      <div className="flex items-start gap-2">
        <Checkbox
          id={inputId}
          ref={ref}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          className={cn(error && "border-destructive", className)}
          {...rest}
        />
        {label && (
          <Label
            htmlFor={inputId}
            className={cn(
              "text-fs-sm leading-tight cursor-pointer",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {label}
          </Label>
        )}
      </div>
      {error ? (
        <p className="text-fs-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-fs-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
});
AppCheckbox.displayName = "AppCheckbox";

export default AppCheckbox;
export { AppCheckbox };