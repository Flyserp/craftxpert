import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Caution action. Wraps shadcn Button with `variant="warning"`. */
const WarningButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="warning" {...props} />,
);
WarningButton.displayName = "WarningButton";

export default WarningButton;
export { WarningButton };