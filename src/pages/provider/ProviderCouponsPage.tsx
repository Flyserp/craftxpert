import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Ticket, Plus, Pencil, Trash2, Loader2, Tag, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  valid_until: string | null;
  is_active: boolean;
}

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Code must be at least 3 characters")
      .max(32, "Code must be 32 characters or less")
      .regex(/^[A-Z0-9_-]+$/, "Use uppercase letters, numbers, _ or -"),
    description: z.string().trim().max(200).optional(),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z.number().positive("Must be greater than 0"),
    min_order_amount: z.number().min(0),
    max_uses: z.number().int().positive().nullable(),
    valid_until: z.string().nullable(),
    is_active: z.boolean(),
  })
  .refine(
    (v) => v.discount_type !== "percentage" || v.discount_value <= 100,
    { message: "Percentage cannot exceed 100", path: ["discount_value"] }
  );

const blankForm = {
  code: "",
  description: "",
  discount_type: "percentage" as "percentage" | "fixed",
  discount_value: "10",
  min_order_amount: "0",
  max_uses: "",
  valid_until: "",
  is_active: true,
};

export default function ProviderCouponsPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(coupons, 15);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_coupons")
      .select(
        "id, code, description, discount_type, discount_value, min_order_amount, max_uses, current_uses, valid_until, is_active"
      )
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCoupons(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description ?? "",
      discount_type: c.discount_type as "percentage" | "fixed",
      discount_value: String(c.discount_value),
      min_order_amount: String(c.min_order_amount ?? 0),
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      valid_until: c.valid_until ? c.valid_until.slice(0, 10) : "",
      is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const parsed = couponSchema.safeParse({
      code: form.code.toUpperCase(),
      description: form.description || undefined,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount || 0),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until || null,
      is_active: form.is_active,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    const d = parsed.data;
    const payload = {
      code: d.code,
      description: d.description ?? null,
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      min_order_amount: d.min_order_amount,
      max_uses: d.max_uses,
      valid_until: d.valid_until,
      is_active: d.is_active,
      applicable_to: "booking",
      vendor_id: user.id,
    };

    setSaving(true);
    const { error } = editing
      ? await supabase
          .from("promo_coupons")
          .update(payload)
          .eq("id", editing.id)
          .eq("vendor_id", user.id)
      : await supabase.from("promo_coupons").insert(payload);
    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("That coupon code is already in use.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(editing ? "Coupon updated." : "Coupon created.");
    setDialogOpen(false);
    refresh();
  };

  const handleToggle = async (c: Coupon) => {
    const { error } = await supabase
      .from("promo_coupons")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCoupons((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x))
    );
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase
      .from("promo_coupons")
      .delete()
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCoupons((prev) => prev.filter((x) => x.id !== c.id));
    toast.success("Coupon deleted.");
  };

  return (
    <DashboardLayout
      title="Coupons"
      subtitle="Create discount codes customers can apply to your services."
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-description-sm">
          {coupons.length} coupon{coupons.length === 1 ? "" : "s"}
        </p>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New coupon
        </Button>
      </div>

      <div className="rounded-sm border border-border bg-card">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-10 text-center">
            <Ticket className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-description-sm">
              No coupons yet. Create your first discount code to attract more bookings.
            </p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-border">
            {pageItems.map((c) => {
              const expired =
                c.valid_until && new Date(c.valid_until) < new Date();
              const usedUp =
                c.max_uses != null && c.current_uses >= c.max_uses;
              return (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {c.discount_type === "percentage" ? (
                      <Percent className="h-4 w-4" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-fs-sm font-mono font-bold text-foreground">
                        {c.code}
                      </code>
                      <Badge
                        variant={c.is_active && !expired && !usedUp ? "default" : "secondary"}
                        className="text-[10px] h-5"
                      >
                        {!c.is_active
                          ? "Disabled"
                          : expired
                            ? "Expired"
                            : usedUp
                              ? "Used up"
                              : "Active"}
                      </Badge>
                    </div>
                    <p className="text-fs-xs text-muted-foreground mt-0.5 truncate">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}% off`
                        : `$${c.discount_value} off`}
                      {c.min_order_amount > 0 && ` · min $${c.min_order_amount}`}
                      {c.max_uses != null && ` · ${c.current_uses}/${c.max_uses} used`}
                      {c.valid_until && ` · until ${format(new Date(c.valid_until), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={() => handleToggle(c)}
                    aria-label="Toggle active"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(c)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(c)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              {editing ? "Edit coupon" : "New coupon"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-fs-xs">Code</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="SUMMER20"
                maxLength={32}
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-fs-xs">Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Summer promo"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Type</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) =>
                    setForm({ ...form, discount_type: v as "percentage" | "fixed" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-fs-xs">
                  {form.discount_type === "percentage" ? "Percent off" : "Amount off ($)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={form.discount_type === "percentage" ? 1 : 0.01}
                  value={form.discount_value}
                  onChange={(e) =>
                    setForm({ ...form, discount_value: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Min order ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.min_order_amount}
                  onChange={(e) =>
                    setForm({ ...form, min_order_amount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-fs-xs">Max uses (blank = ∞)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fs-xs">Valid until (optional)</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-fs-sm font-medium text-foreground">Active</p>
                <p className="text-fs-xs text-muted-foreground">
                  Customers can apply this code at checkout.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create coupon"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
