import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Secondary action. Wraps shadcn Button with `variant="secondary"`. */
const SecondaryButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="secondary" {...props} />,
);
SecondaryButton.displayName = "SecondaryButton";

export default SecondaryButton;
export { SecondaryButton };