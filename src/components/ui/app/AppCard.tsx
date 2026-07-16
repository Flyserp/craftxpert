import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AppCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

/**
 * Opinionated Card wrapper. Use slots (title/description/footer)
 * or pass children to render a free-form body.
 */
const AppCard = React.forwardRef<HTMLDivElement, AppCardProps>(
  ({ title, description, header, footer, bodyClassName, children, className, ...rest }, ref) => {
    const showHeader = !!(title || description || header);
    return (
      <Card ref={ref} className={cn(className)} {...rest}>
        {showHeader && (
          <CardHeader>
            {header}
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        {children && <CardContent className={bodyClassName}>{children}</CardContent>}
        {footer && <CardFooter>{footer}</CardFooter>}
      </Card>
    );
  },
);
AppCard.displayName = "AppCard";

export default AppCard;
export { AppCard };