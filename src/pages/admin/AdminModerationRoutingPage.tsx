import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Route = {
  id: string;
  kind: string | null;
  tenant_id: string | null;
  user_id: string;
  admin_name?: string;
};

type Admin = { user_id: string; display_name: string | null };

const KINDS = [
  { value: "all", label: "All queues" },
  { value: "verification", label: "Verifications" },
  { value: "report", label: "Content reports" },
  { value: "dispute", label: "Disputes" },
  { value: "refund", label: "Refunds" },
];

export default function AdminModerationRoutingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKind, setNewKind] = useState<string>("all");
  const [newUser, setNewUser] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const sb = supabase as any;
    const [routesRes, adminsRes] = await Promise.all([
      sb.from("moderation_notification_routes")
        .select("id, kind, tenant_id, user_id")
        .order("kind", { ascending: true }),
      sb.from("user_roles")
        .select("user_id")
        .eq("role", "admin"),
    ]);
    const adminIds = (adminsRes.data || []).map((r: any) => r.user_id);
    const profiles = adminIds.length
      ? (await supabase.from("profiles").select("user_id, display_name").in("user_id", adminIds)).data || []
      : [];
    const nameMap = new Map(profiles.map((p: any) => [p.user_id, p.display_name || "Admin"]));
    setAdmins(adminIds.map((id: string) => ({ user_id: id, display_name: nameMap.get(id) ?? "Admin" })));
    setRoutes((routesRes.data || []).map((r: any) => ({ ...r, admin_name: nameMap.get(r.user_id) || "Admin" })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addRoute = async () => {
    if (!newUser) { toast({ title: "Pick an admin" }); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("moderation_notification_routes").insert({
      kind: newKind === "all" ? null : newKind,
      tenant_id: null,
      user_id: newUser,
    });
    setSaving(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setNewUser("");
    setNewKind("all");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("moderation_notification_routes").delete().eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Notification Routing</h1>
        <p className="text-description-sm mt-1">
          Send moderation escalations only to the admins responsible for each queue. Empty queue = platform-wide fallback to every admin.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-subheading">Add subscription</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Queue</label>
            <Select value={newKind} onValueChange={setNewKind}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Admin</label>
            <Select value={newUser} onValueChange={setNewUser}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Pick admin..." /></SelectTrigger>
              <SelectContent>
                {admins.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRoute} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add route
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-subheading">Active routes ({routes.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : routes.length === 0 ? (
            <div className="py-10 text-center text-description-sm">
              No routes configured — every admin gets every escalation.
            </div>
          ) : (
            <ul className="divide-y">
              {routes.map(r => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-medium capitalize">
                    {r.kind ? r.kind : "All queues"}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm">{r.admin_name}</span>
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive"
                    onClick={() => remove(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
