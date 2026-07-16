import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Informational action. Wraps shadcn Button with `variant="info"`. */
const InfoButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  (props, ref) => <Button ref={ref} variant="info" {...props} />,
);
InfoButton.displayName = "InfoButton";

export default InfoButton;
export { InfoButton };