// Single entry point for all app layouts. Use these instead of hand-rolling
// headers/sidebars/breadcrumbs on individual pages so spacing, typography
// and responsive behavior stay consistent across the app.
export { default as DashboardLayout } from "@/components/DashboardLayout";
export { default as AdminLayout } from "@/components/admin/AdminLayout";
export { default as AuthLayout } from "@/components/auth/AuthLayout";
export { PageShell, type PageShellProps, type Crumb } from "./PageShell";
export { SettingsLayout, type SettingsLayoutProps, type SettingsNavItem } from "./SettingsLayout";
export { ProfileLayout, type ProfileLayoutProps } from "./ProfileLayout";