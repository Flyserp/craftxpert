import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

/** Standard labeled input with optional hint/error. */
const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ label, hint, error, id, containerClassName, className, ...rest }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label && (
          <Label htmlFor={inputId} className="text-fs-sm">
            {label}
          </Label>
        )}
        <Input
          id={inputId}
          ref={ref}
          aria-invalid={!!error || undefined}
          className={cn(error && "border-destructive", className)}
          {...rest}
        />
        {error ? (
          <p className="text-fs-xs text-destructive">{error}</p>
        ) : hint ? (
          <p className="text-fs-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  },
);
AppInput.displayName = "AppInput";

export default AppInput;
export { AppInput };