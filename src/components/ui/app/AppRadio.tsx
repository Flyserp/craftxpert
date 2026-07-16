import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AppRadioOption {
  value: string;
  label: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}

export interface AppRadioProps {
  label?: string;
  hint?: string;
  error?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: AppRadioOption[];
  disabled?: boolean;
  name?: string;
  orientation?: "vertical" | "horizontal";
  containerClassName?: string;
  className?: string;
}

/** Standard labeled radio group with optional hint/error per group and per option. */
export function AppRadio({
  label,
  hint,
  error,
  value,
  defaultValue,
  onValueChange,
  options,
  disabled,
  name,
  orientation = "vertical",
  containerClassName,
  className,
}: AppRadioProps) {
  const groupId = React.useId();
  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label && (
        <Label className="text-fs-sm" id={`${groupId}-label`}>
          {label}
        </Label>
      )}
      <RadioGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-invalid={!!error || undefined}
        className={cn(
          orientation === "horizontal" ? "flex flex-wrap gap-4" : "grid gap-2",
          className,
        )}
      >
        {options.map((opt) => {
          const optId = `${groupId}-${opt.value}`;
          const isDisabled = disabled || opt.disabled;
          return (
            <div key={opt.value} className="flex items-start gap-2">
              <RadioGroupItem
                id={optId}
                value={opt.value}
                disabled={isDisabled}
                className={cn(error && "border-destructive")}
              />
              <div className="grid">
                <Label
                  htmlFor={optId}
                  className={cn(
                    "text-fs-sm leading-tight cursor-pointer",
                    isDisabled && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {opt.label}
                </Label>
                {opt.hint && (
                  <p className="text-fs-xs text-muted-foreground">{opt.hint}</p>
                )}
              </div>
            </div>
          );
        })}
      </RadioGroup>
      {error ? (
        <p className="text-fs-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-fs-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

