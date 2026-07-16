import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Kind = "verification" | "report" | "dispute" | "refund" | "general";
type Action = "approve" | "reject" | "dismiss" | "request_info" | "warning";

type Tpl = {
  id: string;
  name: string;
  kind: Kind;
  action: Action;
  subject: string | null;
  body: string;
  is_active: boolean;
};

const KIND_OPTS: Kind[] = ["verification", "report", "dispute", "refund", "general"];
const ACTION_OPTS: Action[] = ["approve", "reject", "dismiss", "request_info", "warning"];

const VARS = ["{{admin_note}}", "{{user_name}}", "{{business_name}}", "{{entity_type}}"];

const empty: Omit<Tpl, "id"> = {
  name: "", kind: "verification", action: "approve", subject: "", body: "", is_active: true,
};

export default function ModerationTemplatesPage() {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [draft, setDraft] = useState<Omit<Tpl, "id">>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("moderation_response_templates")
      .select("*")
      .order("kind").order("action").order("name");
    if (error) toast({ title: "Failed to load templates", description: error.message, variant: "destructive" });
    setRows((data || []) as Tpl[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setDraft(empty); setOpen(true); };
  const openEdit = (t: Tpl) => {
    setEditing(t);
    setDraft({ name: t.name, kind: t.kind, action: t.action, subject: t.subject || "", body: t.body, is_active: t.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { ...draft, subject: draft.subject?.trim() || null };
    const { error } = editing
      ? await (supabase as any).from("moderation_response_templates").update(payload).eq("id", editing.id)
      : await (supabase as any).from("moderation_response_templates").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Template updated" : "Template created" });
    setOpen(false);
    load();
  };

  const remove = async (t: Tpl) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const { error } = await (supabase as any).from("moderation_response_templates").delete().eq("id", t.id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Template deleted" });
    load();
  };

  const toggleActive = async (t: Tpl) => {
    const { error } = await (supabase as any)
      .from("moderation_response_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setRows((r) => r.map((x) => (x.id === t.id ? { ...x, is_active: !t.is_active } : x)));
  };

  const insertVar = (v: string) =>
    setDraft((d) => ({ ...d, body: `${d.body}${d.body && !d.body.endsWith(" ") ? " " : ""}${v}` }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading">Response Templates</h1>
          <p className="text-description-sm mt-1">
            Canned replies for verification outcomes and moderation warnings. Available in the Moderation Inbox bulk actions.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> New template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-subheading">All templates ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-description-sm">No templates yet.</div>
          ) : (
            <ul className="divide-y">
              {rows.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{t.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{t.kind}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{t.action.replace("_", " ")}</Badge>
                      {!t.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Off</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {t.subject ? <span className="font-medium">{t.subject} · </span> : null}{t.body}
                    </div>
                  </div>
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Use variables like <code>{"{{admin_note}}"}</code> — they will be filled in when the template is applied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Template name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as Kind })}>
                <SelectTrigger><SelectValue placeholder="Queue" /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={draft.action} onValueChange={(v) => setDraft({ ...draft, action: v as Action })}>
                <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Subject / title (optional)" value={draft.subject || ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <Textarea rows={6} placeholder="Message body..." value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              {VARS.map((v) => (
                <Button key={v} type="button" size="sm" variant="outline" onClick={() => insertVar(v)}>{v}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
