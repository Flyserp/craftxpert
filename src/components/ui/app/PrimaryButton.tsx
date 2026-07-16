import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Filled primary CTA. Wraps shadcn Button with `variant="default"`. */
const PrimaryButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="default" {...props} />,
);
PrimaryButton.displayName = "PrimaryButton";

export default PrimaryButton;
export { PrimaryButton };