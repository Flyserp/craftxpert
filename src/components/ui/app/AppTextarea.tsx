import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AppTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

/** Standard labeled textarea with optional hint/error. */
const AppTextarea = React.forwardRef<HTMLTextAreaElement, AppTextareaProps>(
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
        <Textarea
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
AppTextarea.displayName = "AppTextarea";

export default AppTextarea;
export { AppTextarea };