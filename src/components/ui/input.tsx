import * as React from"react";

import { cn } from"@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
 ({ className, type, ...props }, ref) => {
 return (
 <input
 type={type}
 className={cn(
"flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-fs-base ring-offset-background file:border-0 file:bg-transparent file:text-fs-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-fs-sm",
 className,
 )}
 ref={ref}
 {...props}
 />
 );
 },
);
Input.displayName ="Input";

export { Input };
