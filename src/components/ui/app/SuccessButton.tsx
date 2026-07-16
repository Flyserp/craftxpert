import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Positive/confirm action. Wraps shadcn Button with `variant="success"`. */
const SuccessButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="success" {...props} />,
);
SuccessButton.displayName = "SuccessButton";

export default SuccessButton;
export { SuccessButton };