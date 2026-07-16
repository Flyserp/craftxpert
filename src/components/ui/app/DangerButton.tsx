import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Destructive action. Wraps shadcn Button with `variant="danger"`. */
const DangerButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="danger" {...props} />,
);
DangerButton.displayName = "DangerButton";

export default DangerButton;
export { DangerButton };