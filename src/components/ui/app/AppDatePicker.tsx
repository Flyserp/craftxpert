import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AppDatePickerProps {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  value?: Date;
  defaultValue?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  /** Disable specific days (e.g. past dates). */
  disabledDates?: (date: Date) => boolean;
  /** date-fns format string. Defaults to "PPP" (e.g. "Apr 29, 2026"). */
  dateFormat?: string;
  id?: string;
  className?: string;
  containerClassName?: string;
}

/** Standard labeled date picker matching the AppInput / AppSelect surface. */
export function AppDatePicker({
  label,
  hint,
  error,
  placeholder = "Pick a date",
  value,
  defaultValue,
  onChange,
  disabled,
  disabledDates,
  dateFormat = "PPP",
  id,
  className,
  containerClassName,
}: AppDatePickerProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const isControlled = value !== undefined || onChange !== undefined;
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue);
  const current = isControlled ? value : internal;

  const handleSelect = (date: Date | undefined) => {
    if (!isControlled) setInternal(date);
    onChange?.(date);
  };

  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label && (
        <Label htmlFor={inputId} className="text-fs-sm">
          {label}
        </Label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={!!error || undefined}
            className={cn(
              "w-full justify-start text-left font-normal",
              !current && "text-muted-foreground",
              error && "border-destructive",
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {current ? format(current, dateFormat) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={current}
            onSelect={handleSelect}
            disabled={disabledDates}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-fs-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-fs-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

