import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Ticket, Plus, Pencil, Trash2, Search, Loader2, ArrowLeft,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import CouponUsageReport from "@/components/admin/coupons/CouponUsageReport";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { LoadingState } from "@/components/ui/app";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  applicable_to: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [applicableTo, setApplicableTo] = useState("booking");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    const { data } = await supabase
      .from("promo_coupons")
      .select("*")
      .order("created_at", { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setCode(""); setDesc(""); setDiscountType("percentage"); setDiscountValue("10");
    setMinOrder("0"); setMaxUses(""); setValidUntil(""); setApplicableTo("booking");
    setEditingCoupon(null);
  };

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code); setDesc(c.description || ""); setDiscountType(c.discount_type);
    setDiscountValue(c.discount_value.toString()); setMinOrder(c.min_order_amount.toString());
    setMaxUses(c.max_uses?.toString() || ""); setApplicableTo(c.applicable_to);
    setValidUntil(c.valid_until ? c.valid_until.split("T")[0] : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim()) { toast.error("Coupon code required"); return; }
    setSaving(true);

    const payload = {
      code: code.trim().toUpperCase(),
      description: desc.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      min_order_amount: parseFloat(minOrder) || 0,
      max_uses: maxUses ? parseInt(maxUses) : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      applicable_to: applicableTo,
    };

    let error;
    if (editingCoupon) {
      ({ error } = await supabase.from("promo_coupons").update(payload).eq("id", editingCoupon.id));
    } else {
      ({ error } = await supabase.from("promo_coupons").insert(payload));
    }

    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(editingCoupon ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      resetForm();
      fetchCoupons();
    }
  };

  const toggleActive = async (c: Coupon) => {
    await supabase.from("promo_coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("promo_coupons").delete().eq("id", id);
    fetchCoupons();
    toast.success("Coupon deleted");
  };

  const filtered = coupons.filter(
    (c) => !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  useEffect(() => {
    setPage(1);
  }, [search, setPage]);

  const activeCount = coupons.filter((c) => c.is_active).length;
  const totalUses = coupons.reduce((s, c) => s + c.current_uses, 0);

  if (loading) {
    return (
      <AdminPage title="Coupons">
        <LoadingState variant="section" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Coupons" subtitle="Create and manage promotional coupons for your platform.">
      {/* Back link to Monetization */}
      <Link
        to="/admin/monetization"
        className="inline-flex items-center gap-2 mb-6 text-fs-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Monetization
      </Link>

      <div className="space-y-6 max-w-3xl">
        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 animate-reveal">
          <div className="bg-card rounded-sm border border-border p-5">
            <p className="text-fs-xs text-muted-foreground font-medium mb-1">Total Coupons</p>
            <p className="text-fs-2xl font-bold text-heading tabular-nums">{coupons.length}</p>
          </div>
          <div className="bg-card rounded-sm border border-border p-5">
            <p className="text-fs-xs text-muted-foreground font-medium mb-1">Active</p>
            <p className="text-fs-2xl font-bold text-heading tabular-nums">{activeCount}</p>
          </div>
          <div className="bg-card rounded-sm border border-border p-5">
            <p className="text-fs-xs text-muted-foreground font-medium mb-1">Total Uses</p>
            <p className="text-fs-2xl font-bold text-heading tabular-nums">{totalUses}</p>
          </div>
        </div>

        {/* Usage report */}
        <div className="animate-reveal" style={{ animationDelay: "120ms" }}>
          <CouponUsageReport />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 animate-reveal" style={{ animationDelay: "80ms" }}>
          <div className="relative max-w-xs w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupons…"
              className="pl-9"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> New Coupon</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-fs-xs">Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE20" className="uppercase font-mono" />
                  </div>
                  <div>
                    <Label className="text-fs-xs">Applies To</Label>
                    <select
                      value={applicableTo}
                      onChange={(e) => setApplicableTo(e.target.value)}
                      className="w-full h-10 px-3 rounded-sm border border-input bg-background text-fs-sm"
                    >
                      <option value="booking">Bookings</option>
                      <option value="subscription">Subscriptions</option>
                      <option value="sponsorship">Sponsored Services</option>
                      <option value="lead_credits">Lead Credits</option>
                      <option value="all">All purchases</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-fs-xs">Description</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="20% off first booking" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-fs-xs">Discount Type</Label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="w-full h-10 px-3 rounded-sm border border-input bg-background text-fs-sm"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-fs-xs">Discount Value</Label>
                    <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} min="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-fs-xs">Min Order Amount ($)</Label>
                    <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} min="0" />
                  </div>
                  <div>
                    <Label className="text-fs-xs">Max Uses (empty = unlimited)</Label>
                    <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} min="1" placeholder="∞" />
                  </div>
                </div>
                <div>
                  <Label className="text-fs-xs">Valid Until (empty = no expiry)</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? "Saving…" : editingCoupon ? "Update Coupon" : "Create Coupon"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Coupons list */}
        <div className="animate-reveal" style={{ animationDelay: "160ms" }}>
          {filtered.length === 0 ? (
            <div className="bg-card rounded-sm border border-border p-10 text-center">
              <Ticket className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-description-sm">
                {search ? "No coupons match your search." : "No coupons yet. Create your first promo coupon."}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pageItems.map((c, i) => (
                  <div
                    key={c.id}
                    className={cn(
                      "bg-card rounded-sm border p-4 flex items-center gap-4 animate-reveal",
                      c.is_active ? "border-border/60" : "border-border/30 opacity-60"
                    )}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-fs-sm font-bold font-mono text-heading">{c.code}</span>
                        <Badge variant={c.is_active ? "default" : "secondary"} className="text-[9px]">
                          {c.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{c.applicable_to}</Badge>
                      </div>
                      {c.description && <p className="text-fs-xs text-muted-foreground">{c.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[13px] text-muted-foreground flex-wrap">
                        <span>{c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`} off</span>
                        {c.min_order_amount > 0 && <span>Min: ${c.min_order_amount}</span>}
                        <span>Used: {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                        {c.valid_until && (
                          <span>Expires: {format(new Date(c.valid_until), "MMM d, yyyy")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                      <Button variant="ghost" size="sm" className="w-10 p-0" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="w-10 p-0 text-destructive hover:text-destructive" onClick={() => deleteCoupon(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
