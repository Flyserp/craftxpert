import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic heading component. Renders <h1>–<h6> and auto-applies the
 * matching typography alias from src/index.css so callers never need to
 * repeat `className="text-h1 text-heading"`.
 *
 * Mapping: h1→text-h1, h2→text-h2, h3→text-h3, h4→text-title,
 * h5/h6→text-subtitle. Override the visual with `as` while keeping the
 * semantic level: <Heading level={2} as="display">…</Heading>.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingVisual =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "subtitle";

const LEVEL_TO_VISUAL: Record<HeadingLevel, HeadingVisual> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "title",
  5: "subtitle",
  6: "subtitle",
};

const VISUAL_TO_CLASS: Record<HeadingVisual, string> = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  title: "text-title",
  subtitle: "text-subtitle",
};

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic heading level (1–6). Also drives the default visual style. */
  level?: HeadingLevel;
  /** Override the visual style while keeping the semantic level. */
  as?: HeadingVisual;
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 2, as, className, ...props }, ref) => {
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const visual = as ?? LEVEL_TO_VISUAL[level];
    return (
      <Tag
        ref={ref}
        className={cn(VISUAL_TO_CLASS[visual], "text-heading", className)}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";

export default Heading;