import { Clock, CheckCircle, Banknote, XCircle } from "lucide-react";
import { ADMIN_STATUS_TONES } from "@/lib/roleTokens";

export interface WithdrawalRow {
  id: string;
  vendor_id: string;
  amount: number;
  payment_method: string;
  payment_details: any;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

// Status tones come from the shared admin token map (see @/lib/roleTokens)
// so withdrawal status pills stay in lockstep with refunds, disputes, audit.
export const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending:  { color: ADMIN_STATUS_TONES.warning, icon: Clock },
  approved: { color: ADMIN_STATUS_TONES.info,    icon: CheckCircle },
  paid:     { color: ADMIN_STATUS_TONES.settled, icon: Banknote },
  denied:   { color: ADMIN_STATUS_TONES.danger,  icon: XCircle },
};
