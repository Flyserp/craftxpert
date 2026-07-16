// Shared constants & helpers for the vendor verification flow.
// One source of truth for: rejection-reason checklist, doc field metadata,
// and the small bits of typing the UI needs (verification rows, statuses).

import type { Database } from "@/integrations/supabase/types";

export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type VerificationRow = Database["public"]["Tables"]["vendor_verifications"]["Row"];

export const VERIFICATION_BUCKET = "verification-docs";

/** Document fields collected during KYC, in the order shown to the vendor. */
export const VERIFICATION_DOCS = [
  {
    key: "government_id_url",
    label: "National ID",
    description: "Passport, driver's licence, or national ID. Front side, clear and unobstructed.",
    required: true,
  },
  {
    key: "proof_of_address_url",
    label: "Proof of address",
    description: "Utility bill or bank statement issued within the last 3 months.",
    required: true,
  },
  {
    key: "police_clearance_url",
    label: "Police clearance",
    description: "Recent police clearance certificate (issued within the last 6 months).",
    required: true,
  },
  {
    key: "business_registration_url",
    label: "Company registration",
    description: "Certificate of incorporation, trade licence, or equivalent (small businesses only).",
    required: false,
  },
  {
    key: "tax_certificate_url",
    label: "Tax certificate",
    description: "Tax compliance / VAT registration certificate (optional).",
    required: false,
  },

  {
    key: "insurance_url",
    label: "Insurance certificate",
    description: "Public liability or professional indemnity certificate (optional).",
    required: false,
  },
  {
    key: "professional_license_url",
    label: "Professional licence",
    description: "Trade-specific licence (e.g. plumbing, electrical) — optional.",
    required: false,
  },
] as const;

export type VerificationDocKey = (typeof VERIFICATION_DOCS)[number]["key"];

/** Pre-defined rejection reasons admins can tick to guide the vendor's resubmission. */
export const REJECTION_REASONS = [
  "ID document is blurry or unreadable",
  "ID document is expired",
  "Name on ID does not match business profile",
  "Business registration document is missing or invalid",
  "Proof of address is older than 3 months",
  "Document appears edited or tampered with",
  "Wrong document type uploaded",
  "Insurance/licence document required for this category",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * Structured item an admin can ask the vendor/employer to update as part of
 * an "information requested" review. Stored on
 * `vendor_verifications.info_request_items` and mirrored into the timeline.
 */
export type InfoRequestItem = {
  kind: "doc" | "field";
  key: string;
  label: string;
};

/** Profile fields (non-document) that the admin can request the user to update. */
export const REQUESTABLE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "business_name", label: "Business / company name" },
  { key: "legal_name", label: "Legal representative name" },
];

/** Human-readable label + token-aware tone for status badges. */
export const STATUS_META: Record<
  VerificationStatus,
  { label: string; tone: string }
> = {
  draft: {
    label: "Not submitted",
    tone: "bg-muted text-muted-foreground border border-border",
  },
  pending: {
    label: "Under review",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  },
  approved: {
    label: "Verified",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  },
  rejected: {
    label: "Action needed",
    tone: "bg-destructive/10 text-destructive border border-destructive/20",
  },
  info_requested: {
    label: "More info requested",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  },
};

/** True when all required document fields have a stored URL. */
export function hasAllRequiredDocs(row: Partial<VerificationRow> | null | undefined): boolean {
  if (!row) return false;
  return VERIFICATION_DOCS.filter((d) => d.required).every(
    (d) => !!(row as Record<string, unknown>)[d.key],
  );
}
