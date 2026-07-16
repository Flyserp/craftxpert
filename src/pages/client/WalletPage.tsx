import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UnifiedHeader from "@/components/header/UnifiedHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Plus, ArrowDownLeft, ArrowUpRight, CreditCard,
  History, DollarSign, Loader2, Receipt,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";

interface WalletData {
  id: string;
  balance: number;
  currency: string;
}

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const txPg = usePagination(transactions, 15);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [showTopUp, setShowTopUp] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Ensure wallet exists
    const { data: w } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!w) {
      // Create wallet if missing
      const { data: newW } = await supabase
        .from("wallets")
        .insert({ user_id: user.id })
        .select()
        .single();
      if (newW) setWallet(newW);
    } else {
      setWallet(w);
    }

    // Load transactions
    if (w) {
      const { data: txs } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(txs || []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0 || !wallet || !user) {
      toast.error("Enter a valid amount");
      return;
    }
    setProcessing(true);

    // In production, this would create a Stripe PaymentIntent first
    // For now, simulate a successful top-up
    const { error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: "top_up",
        amount,
        description: `Wallet top-up via card`,
      });

    if (!txError) {
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: wallet.balance + amount })
        .eq("id", wallet.id);

      if (!walletError) {
        toast.success(`$${amount.toFixed(2)} added to wallet`);
        setTopUpAmount("");
        setShowTopUp(false);
        loadWallet();
      }
    } else {
      toast.error("Failed to top up");
    }
    setProcessing(false);
  };

  const presetAmounts = [10, 25, 50, 100];

  const txIcon = (type: string) => {
    switch (type) {
      case "top_up": return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case "debit": return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case "credit": return <ArrowDownLeft className="w-4 h-4 text-blue-500" />;
      case "refund": return <ArrowDownLeft className="w-4 h-4 text-amber-500" />;
      default: return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const txColor = (type: string) => {
    switch (type) {
      case "top_up": case "credit": case "refund": return "text-green-600";
      case "debit": return "text-red-500";
      default: return "text-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20 sm:pb-8">
      <UnifiedHeader />
      <main className="container-app max-w-2xl space-y-6">
        {/* Balance Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-fs-sm text-muted-foreground">Available Balance</p>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mt-1" />
                ) : (
                  <p className="text-fs-3xl font-bold text-heading tabular-nums">
                    ${(wallet?.balance || 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowTopUp(!showTopUp)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Funds
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => toast.info("Withdraw feature coming soon")}>
                <ArrowUpRight className="w-4 h-4" /> Withdraw
              </Button>
              <Button asChild variant="ghost" className="gap-2">
                <Link to="/my-invoices">
                  <Receipt className="w-4 h-4" /> Invoices
                </Link>
              </Button>
            </div>
          </div>

          {/* Top-up Panel */}
          {showTopUp && (
            <CardContent className="border-t border-border/40 pt-4">
              <p className="text-fs-sm font-medium text-heading mb-3">Add funds to wallet</p>
              <div className="flex gap-2 mb-3 flex-wrap">
                {presetAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant={topUpAmount === String(amt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTopUpAmount(String(amt))}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
                <Button onClick={handleTopUp} disabled={processing} className="gap-2 shrink-0">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Top Up
                </Button>
              </div>
              <p className="text-[13px] text-muted-foreground mt-2">
                Funds will be available instantly after payment
              </p>
            </CardContent>
          )}
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-fs-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-description-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {txPg.pageItems.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {txIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-fs-sm font-medium text-heading capitalize">{tx.type.replace("_", " ")}</p>
                      <p className="text-fs-xs text-muted-foreground truncate">{tx.description || "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-fs-sm font-semibold tabular-nums ${txColor(tx.type)}`}>
                        {tx.type === "debit" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && transactions.length > 0 && (
              <NumberedPagination
                currentPage={txPg.page}
                totalPages={txPg.totalPages}
                totalItems={txPg.totalItems}
                onPageChange={txPg.setPage}
                pageSize={txPg.pageSize}
          onPageSizeChange={txPg.setPageSize}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
