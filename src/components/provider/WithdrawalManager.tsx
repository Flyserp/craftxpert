import { useEffect, useState } from"react";
import { useAuth } from"@/contexts/AuthContext";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { toast } from"sonner";
import { cn } from"@/lib/utils";
import { format } from"date-fns";
import {
 ArrowDownRight, DollarSign, Clock, CheckCircle, XCircle,
 Banknote, CreditCard, Wallet,
} from"lucide-react";
import {
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from"@/components/ui/dialog";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from"@/components/ui/select";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

const STATUS_STYLES: Record<string, { bg: string; icon: typeof Clock }> = {
 pending: { bg:"bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", icon: Clock },
 approved: { bg:"bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", icon: CheckCircle },
 rejected: { bg:"bg-destructive/10 text-destructive", icon: XCircle },
 paid: { bg:"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", icon: CheckCircle },
};

const PAYMENT_METHODS = [
 { value:"bank_transfer", label:"Bank Transfer", icon: Banknote },
 { value:"paypal", label:"PayPal", icon: CreditCard },
 { value:"stripe", label:"Stripe", icon: CreditCard },
];

export default function WithdrawalManager() {
 const { user } = useAuth();
 const [withdrawals, setWithdrawals] = useState<any[]>([]);
 const [availableBalance, setAvailableBalance] = useState(0);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [dialogOpen, setDialogOpen] = useState(false);

 // Form state
 const [amount, setAmount] = useState("");
 const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
 const [accountDetails, setAccountDetails] = useState("");

 const [walletBalance, setWalletBalance] = useState(0);
 const [netEarned, setNetEarned] = useState(0);
 const withdrawalPg = usePagination(withdrawals, 10);

 const fetchData = async () => {
 if (!user) return;

 const [withdrawalsRes, bookingsRes, walletRes] = await Promise.all([
 supabase
 .from("withdrawals")
 .select("*")
 .eq("vendor_id", user.id)
 .order("created_at", { ascending: false }),
 supabase
 .from("bookings")
 .select("total_price, status")
 .eq("vendor_id", user.id)
 .eq("status","completed"),
 supabase
 .from("wallets")
 .select("balance")
 .eq("user_id", user.id)
 .maybeSingle(),
 ]);

 // Default platform commission: 10%
 const commRate = 10;
 const netEarnings = (bookingsRes.data || []).reduce((s: number, b: any) => {
 const gross = b.total_price || 0;
 const comm = gross * (commRate / 100);
 return s + (gross - comm);
 }, 0);

 // Subtract already withdrawn/pending amounts
 const withdrawnOrPending = (withdrawalsRes.data || [])
 .filter((w: any) => ["pending","approved","paid"].includes(w.status))
 .reduce((s: number, w: any) => s + Number(w.amount), 0);

 const wallet = Number(walletRes.data?.balance || 0);
 const earningsAvailable = Math.max(0, netEarnings - withdrawnOrPending);
 // Cap by actual wallet balance — payouts debit the wallet, so we can't
 // request more than what's actually there.
 setWalletBalance(wallet);
 setNetEarned(netEarnings);
 setAvailableBalance(Math.min(earningsAvailable, wallet));
 setWithdrawals(withdrawalsRes.data || []);
 setLoading(false);
 };

 useEffect(() => { fetchData(); }, [user]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!user) return;

 const numAmount = parseFloat(amount);
 if (isNaN(numAmount) || numAmount <= 0) {
 toast.error("Enter a valid amount");
 return;
 }
 if (numAmount < 10) {
 toast.error("Minimum withdrawal is $10");
 return;
 }
 // NOTE: We intentionally let the DB trigger be the source of truth for the
 // wallet/available cap. The friendly error is surfaced from the response below.

 setSubmitting(true);
 const { error } = await supabase.from("withdrawals").insert({
 vendor_id: user.id,
 amount: numAmount,
 payment_method: paymentMethod,
 payment_details: { account_info: accountDetails },
 });

 if (error) {
 // Surface the wallet-cap trigger error in plain English
 const msg = error.message ||"";
 if (/exceeds available wallet balance/i.test(msg)) {
 // Trigger format:"... (requested 999, available 250.00)"
 const reqMatch = msg.match(/requested\s+([\d.]+)/i);
 const availMatch = msg.match(/available\s+([\d.]+)/i);
 const req = reqMatch ? Number(reqMatch[1]) : numAmount;
 const avail = availMatch ? Number(availMatch[1]) : walletBalance;
 toast.error(
`You requested $${req.toFixed(2)} but only $${avail.toFixed(2)} is available.`,
 { description:"Pending withdrawals already reserve part of your wallet." }
 );
 } else {
 toast.error(msg ||"Failed to submit request");
 }
 } else {
 toast.success("Withdrawal request submitted!");
 setAmount("");
 setAccountDetails("");
 setDialogOpen(false);
 fetchData();
 }
 setSubmitting(false);
 };

 if (loading) {
 return (
 <LoadingState variant="section" />
 );
 }

 return (
 <div className="space-y-6">
 {/* Balance Card */}
 <div className="bg-gradient-to-br from-primary to-primary/80 rounded-sm p-6 text-primary-foreground relative overflow-hidden">
 <div
 className="absolute inset-0 opacity-10"
 style={{
 backgroundImage:"radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
 backgroundSize:"16px 16px",
 }}
 />
 <div className="relative">
 <div className="flex items-center gap-2 mb-2">
 <Wallet className="w-5 h-5" />
 <span className="text-fs-sm font-medium opacity-80">Available Balance</span>
 </div>
 <p className="text-fs-4xl font-bold tabular-nums mb-2">${availableBalance.toFixed(2)}</p>

 <div className="flex items-center gap-3 text-fs-xs opacity-80 mb-4 tabular-nums">
 <span>Wallet: <span className="font-semibold">${walletBalance.toFixed(2)}</span></span>
 <span className="opacity-50">/</span>
 <span>Earned: <span className="font-semibold">${netEarned.toFixed(2)}</span></span>
 {availableBalance < netEarned && walletBalance < netEarned && (
 <span className="opacity-70">• capped by wallet</span>
 )}
 </div>

 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button
 variant="secondary"
 className="gap-2 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0"
 disabled={availableBalance < 10}
 >
 <ArrowDownRight className="w-4 h-4" /> Request Withdrawal
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Request Withdrawal</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4 mt-2">
 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">Amount</label>
 <div className="relative">
 <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="number"
 step="0.01"
 min="10"
 required
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="0.00"
 className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-fs-sm tabular-nums"
 />
 </div>
 <p className="text-fs-xs text-muted-foreground mt-1">
 Available: ${availableBalance.toFixed(2)} • Min: $10.00
 </p>
 </div>

 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">Payment Method</label>
 <Select value={paymentMethod} onValueChange={setPaymentMethod}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PAYMENT_METHODS.map((m) => (
 <SelectItem key={m.value} value={m.value}>
 {m.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <label className="block text-fs-sm font-medium text-heading mb-1.5">
 Account Details
 </label>
 <textarea
 required
 value={accountDetails}
 onChange={(e) => setAccountDetails(e.target.value)}
 placeholder={
 paymentMethod ==="bank_transfer"
 ?"Bank name, account number, routing number..."
 : paymentMethod ==="paypal"
 ?"PayPal email address..."
 :"Stripe account email..."
 }
 className="w-full min-h-[80px] p-3 rounded-lg border border-input bg-background text-fs-sm resize-none"
 />
 </div>

 <Button type="submit" className="w-full gap-2" disabled={submitting}>
 {submitting ?"Submitting..." :"Submit Request"}
 </Button>
 </form>
 </DialogContent>
 </Dialog>

 {availableBalance < 10 && (
 <p className="text-fs-xs opacity-60 mt-2">Minimum balance of $10 required to withdraw</p>
 )}
 </div>
 </div>

 {/* History */}
 <div className="bg-card rounded-sm border border-border overflow-hidden">
 <div className="p-5 border-b border-border/40">
 <Heading level={3} >Withdrawal History</Heading>
 </div>
 {withdrawals.length === 0 ? (
 <div className="py-12 text-center">
 <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
 <p className="text-description-sm">No withdrawal requests yet</p>
 </div>
 ) : (
 <>
 <div className="divide-y divide-border/40">
 {withdrawalPg.pageItems.map((w) => {
 const style = STATUS_STYLES[w.status] || STATUS_STYLES.pending;
 const Icon = style.icon;
 return (
 <div key={w.id} className="p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
 <div className="w-10 h-10 rounded-sm bg-emerald-500/10 flex items-center justify-center shrink-0">
 <ArrowDownRight className="w-5 h-5 text-emerald-500" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-fs-sm font-semibold text-heading tabular-nums">
 ${Number(w.amount).toFixed(2)}
 </p>
 <p className="text-fs-xs text-muted-foreground">
 {format(new Date(w.created_at),"MMM d, yyyy 'at' h:mm a")}
 {" •"}
 {PAYMENT_METHODS.find((m) => m.value === w.payment_method)?.label || w.payment_method}
 </p>
 {w.admin_notes && (
 <p className="text-fs-xs text-muted-foreground mt-1 italic">Note: {w.admin_notes}</p>
 )}
 </div>
 <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium px-2.5 py-1 rounded-full capitalize", style.bg)}>
 <Icon className="w-3 h-3" />
 {w.status}
 </span>
 </div>
 );
 })}
 </div>
 <NumberedPagination
 currentPage={withdrawalPg.page}
 totalPages={withdrawalPg.totalPages}
 totalItems={withdrawalPg.totalItems}
 pageSize={withdrawalPg.pageSize}
 onPageChange={withdrawalPg.setPage}
 className="mb-5"
 onPageSizeChange={withdrawalPg.setPageSize}
 />
 </>
 )}
 </div>
 </div>
 );
}
