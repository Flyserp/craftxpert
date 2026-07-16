import { forwardRef, InputHTMLAttributes, ReactNode, useState } from"react";
import { cn } from"@/lib/utils";
import { AlertCircle, CheckCircle2 } from"lucide-react";

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>,"placeholder"> {
 label: string;
 icon: ReactNode;
 /** Element rendered absolutely on the right (e.g. show/hide password). */
 rightSlot?: ReactNode;
 /** Optional element rendered next to the (floated) label area (e.g."Forgot?"). */
 labelAction?: ReactNode;
 /** Inline error message shown under the input. Truthy enables error state. */
 errorMessage?: string;
 /** Inline success/help message shown under the input when no error. */
 helpMessage?: string;
 /** Show a green check when the field is valid (only when value is non-empty and no error). */
 showValidIndicator?: boolean;
}

/**
 * Modernized auth input with a floating label.
 *
 * - 52px height for comfortable touch targets and label travel space
 * - Floating label that animates up on focus or when filled
 * - Soft 3px focus ring using --accent
 * - Inline error / help messages
 */
const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
 (
 {
 label,
 icon,
 rightSlot,
 labelAction,
 errorMessage,
 helpMessage,
 showValidIndicator,
 className,
 id,
 onFocus,
 onBlur,
 value,
 defaultValue,
 ...props
 },
 ref,
 ) => {
 const inputId = id || props.name || label.replace(/\s+/g,"-").toLowerCase();
 const errorId =`${inputId}-error`;
 const helpId =`${inputId}-help`;
 const [focused, setFocused] = useState(false);

 const filled =
 value !== undefined
 ? String(value).length > 0
 : defaultValue !== undefined
 ? String(defaultValue).length > 0
 : false;

 const floated = focused || filled;
 const hasError = !!errorMessage;
 const isValid = !!showValidIndicator && filled && !hasError;

 return (
 <div>
 {/* Optional label action sits above the field (e.g."Forgot?" link). */}
 {labelAction && (
 <div className="flex justify-end mb-1 text-[12px]">{labelAction}</div>
 )}
 <div className="relative group">
 {/* Leading icon */}
 <span
 className={cn(
"absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none z-10",
 hasError
 ?"text-destructive"
 : focused
 ?"text-primary"
 :"text-muted-foreground/70",
 )}
 >
 {icon}
 </span>

 {/* Floating label */}
 <label
 htmlFor={inputId}
 className={cn(
"absolute left-11 z-10 px-1 pointer-events-none origin-left transition-all duration-200 ease-out",
"font-medium tracking-tight",
 floated
 ?"top-0 -translate-y-1/2 text-[10.5px] uppercase tracking-[0.12em] bg-card"
 :"top-1/2 -translate-y-1/2 text-[13.5px]",
 hasError
 ?"text-destructive"
 : focused
 ?"text-primary"
 : floated
 ?"text-muted-foreground"
 :"text-muted-foreground/80",
 )}
 >
 {label}
 </label>

 <input
 ref={ref}
 id={inputId}
 value={value}
 defaultValue={defaultValue}
 aria-invalid={hasError || undefined}
 aria-describedby={
 hasError ? errorId : helpMessage ? helpId : undefined
 }
 onFocus={(e) => {
 setFocused(true);
 onFocus?.(e);
 }}
 onBlur={(e) => {
 setFocused(false);
 onBlur?.(e);
 }}
 className={cn(
"peer w-full h-[52px] pl-11 pr-4 rounded-sm border bg-background/60 text-[14px] text-foreground",
"transition-[border-color,box-shadow,background-color] duration-200",
"",
 hasError
 ?"border-destructive/70"
 :"border-border hover:border-border/80",
 (rightSlot || isValid) &&"pr-11",
 className,
 )}
 {...props}
 />

 {/* Trailing slot — explicit > valid indicator */}
 {rightSlot ? (
 <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center z-10">
 {rightSlot}
 </span>
 ) : isValid ? (
 <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-success z-10">
 <CheckCircle2 className="w-4 h-4" />
 </span>
 ) : null}
 </div>

 {/* Inline message line */}
 {hasError ? (
 <p
 id={errorId}
 role="alert"
 className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-medium text-destructive leading-snug"
 >
 <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
 <span>{errorMessage}</span>
 </p>
 ) : helpMessage ? (
 <p
 id={helpId}
 className="mt-1.5 text-[11.5px] text-muted-foreground/80 leading-snug"
 >
 {helpMessage}
 </p>
 ) : null}
 </div>
 );
 },
);
AuthField.displayName ="AuthField";

export default AuthField;
