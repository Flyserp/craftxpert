import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AppSelectProps {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: AppSelectOption[];
  disabled?: boolean;
  id?: string;
  className?: string;
  containerClassName?: string;
}

/** Standard labeled select. Pass `options` as `[{ value, label }]`. */
export function AppSelect({
  label,
  hint,
  error,
  placeholder,
  value,
  defaultValue,
  onValueChange,
  options,
  disabled,
  id,
  className,
  containerClassName,
}: AppSelectProps) {
  const reactId = React.useId();
  const selectId = id ?? reactId;
  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label && (
        <Label htmlFor={selectId} className="text-fs-sm">
          {label}
        </Label>
      )}
      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          aria-invalid={!!error || undefined}
          className={cn(error && "border-destructive", className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-fs-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-fs-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

