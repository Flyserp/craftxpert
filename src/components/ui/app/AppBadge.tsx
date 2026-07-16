import { Badge, type BadgeProps } from "@/components/ui/badge";

/** Alias for the shadcn Badge under the App* naming convention. */
export type AppBadgeProps = BadgeProps;

export function AppBadge(props: AppBadgeProps) {
  return <Badge {...props} />;
}

