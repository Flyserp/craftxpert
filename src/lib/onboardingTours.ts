import type { AppRole } from "@/contexts/AuthContext";

export type TourStep = {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export const TOUR_VERSION = 1;

const common = (role: string): TourStep[] => [
  {
    title: `Welcome to WRAPCODERS, ${role}!`,
    body: "This quick tour walks you through the dashboard, key actions, and the sponsorship, verification, and subscription workflows. You can restart it any time from Settings.",
  },
];

export const ONBOARDING_TOURS: Record<AppRole, TourStep[]> = {
  customer: [
    ...common("Customer"),
    {
      title: "Your dashboard",
      body: "Track bookings, messages, and saved providers from a single place. Stats at the top give you a snapshot of your activity.",
      ctaLabel: "Open dashboard",
      ctaHref: "/client-dashboard",
    },
    {
      title: "Find & book services",
      body: "Browse providers, compare offers, and book instantly — or post a task and let providers apply to you.",
      ctaLabel: "Browse services",
      ctaHref: "/browse",
    },
    {
      title: "Sponsored listings",
      body: "Listings with a Sponsored badge are highlighted by their provider. They still meet the same quality standards — the badge just boosts visibility.",
    },
    {
      title: "Verified providers",
      body: "A Verified badge means the provider passed ID and credential checks. Filter to verified-only for extra peace of mind.",
      ctaLabel: "See verified providers",
      ctaHref: "/providers?verified=true",
    },
    {
      title: "Wallet & subscriptions",
      body: "Top up your wallet for faster checkout. Premium customer plans unlock priority support and exclusive offers.",
      ctaLabel: "Open wallet",
      ctaHref: "/wallet",
    },
  ],
  provider: [
    ...common("Provider"),
    {
      title: "Provider dashboard",
      body: "Manage incoming bookings, your services, earnings, and reviews. Keep your availability up to date so you never miss a job.",
      ctaLabel: "Open dashboard",
      ctaHref: "/provider-dashboard",
    },
    {
      title: "Verification workflow",
      body: "Submit ID and credentials once — admins review and approve. Verified providers rank higher in search and earn customer trust.",
      ctaLabel: "Start verification",
      ctaHref: "/provider/verification",
    },
    {
      title: "Subscription plans",
      body: "Pick a plan to unlock more services, job applications, and premium placement. Upgrade or cancel any time.",
      ctaLabel: "View plans",
      ctaHref: "/provider/subscription",
    },
    {
      title: "Sponsored services",
      body: "Boost a service to the top of search and category pages. Buy sponsorship from your Services page or the Sponsorships hub.",
      ctaLabel: "Manage sponsorships",
      ctaHref: "/provider/sponsorships",
    },
    {
      title: "Applications & earnings",
      body: "Browse open tasks, send proposals, and track payouts in Earnings. Connect a payout method to withdraw your balance.",
      ctaLabel: "View earnings",
      ctaHref: "/provider/earnings",
    },
  ],
  employer: [
    ...common("Employer"),
    {
      title: "Employer dashboard",
      body: "Post jobs, review applicants, and hire providers — all from one workspace.",
      ctaLabel: "Open dashboard",
      ctaHref: "/employer-dashboard",
    },
    {
      title: "Post a job (pay-per-post)",
      body: "Each job posting has a small platform fee. Once paid, providers can discover and apply within minutes.",
      ctaLabel: "Post a job",
      ctaHref: "/employer-post-job",
    },
    {
      title: "Verified talent",
      body: "Filter applicants by verification status, ratings, and completed jobs so you only shortlist trusted providers.",
    },
    {
      title: "Sponsored visibility",
      body: "Sponsored providers and services appear first in search. Look for the Sponsored badge as you compare candidates.",
    },
    {
      title: "Subscriptions for employers",
      body: "Upgrade to bundle job credits, run unlimited postings, and access advanced analytics.",
      ctaLabel: "View plans",
      ctaHref: "/employer/subscription",
    },
  ],
  admin: [
    ...common("Admin"),
    {
      title: "Admin command center",
      body: "Live metrics, activity feed, and quick links to every operational area of the platform.",
      ctaLabel: "Open dashboard",
      ctaHref: "/admin",
    },
    {
      title: "Verification queue",
      body: "Review provider ID and credential submissions. Use bulk actions to approve or reject in batches.",
      ctaLabel: "Open queue",
      ctaHref: "/admin/verifications",
    },
    {
      title: "Subscription management",
      body: "Track active subscribers, change plans, extend renewals, and audit payment history.",
      ctaLabel: "Manage subscriptions",
      ctaHref: "/admin/subscriptions",
    },
    {
      title: "Sponsorship management",
      body: "Approve sponsored listings, tune pricing and placement, and monitor sponsorship revenue.",
      ctaLabel: "Open sponsorships",
      ctaHref: "/admin/sponsorships",
    },
    {
      title: "Platform settings",
      body: "Configure branding, fees, localization, and feature flags. Changes apply across all tenants instantly.",
      ctaLabel: "Open settings",
      ctaHref: "/admin/platform-settings",
    },
  ],
  moderator: [
    ...common("Moderator"),
    {
      title: "Moderation inbox",
      body: "Review reported content, verifications, and disputes assigned to you. SLA timers highlight what needs attention first.",
      ctaLabel: "Open inbox",
      ctaHref: "/admin/moderation-inbox",
    },
    {
      title: "Response templates",
      body: "Reply faster with pre-approved templates for common decisions and outreach.",
      ctaLabel: "Open templates",
      ctaHref: "/admin/moderation-templates",
    },
  ],
};

export function tourStorageKey(role: AppRole) {
  return `wc:tour:${role}:v${TOUR_VERSION}`;
}