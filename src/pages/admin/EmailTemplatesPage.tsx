import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MailOpen, Save, Eye, Code2, RotateCcw, Send, Plus, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  variables: string[];
  is_active: boolean;
  updated_at: string;
};

const sampleValues: Record<string, string> = {
  customer_name: "Alex Doe",
  vendor_name: "Sparkle Cleaners",
  service_title: "Deep Home Cleaning",
  booking_date: "May 12, 2026",
  start_time: "10:00 AM",
  total_price: "120.00",
  user_name: "Alex",
  reset_url: "https://example.com/reset?token=demo",
  app_name: "Lovable",
  dashboard_url: "https://example.com/dashboard",
  amount: "45.00",
  booking_id: "abc12345",
};

function renderTemplate(text: string): string {
  return text.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, key) =>
    sampleValues[key] ?? `{{${key}}}`,
  );
}

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body_html: string; is_active: boolean }>({
    subject: "",
    body_html: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTpl, setNewTpl] = useState({
    key: "",
    name: "",
    description: "",
    subject: "",
    body_html: "<p>Hello {{name}},</p>\n<p>...</p>",
    variables: "name",
  });

  const resetNewTpl = () =>
    setNewTpl({
      key: "",
      name: "",
      description: "",
      subject: "",
      body_html: "<p>Hello {{name}},</p>\n<p>...</p>",
      variables: "name",
    });

  const createTemplate = async () => {
    if (!user) return;
    const key = newTpl.key.trim().toLowerCase();
    const name = newTpl.name.trim();
    const subject = newTpl.subject.trim();
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast.error("Key must use lowercase letters, numbers, and underscores only");
      return;
    }
    if (!name || !subject) {
      toast.error("Name and subject are required");
      return;
    }
    const variables = Array.from(
      new Set(
        newTpl.variables
          .split(/[,\s]+/)
          .map((v) => v.trim())
          .filter((v) => /^[a-z_][a-z0-9_]*$/i.test(v)),
      ),
    );
    setCreating(true);
    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        key,
        name,
        description: newTpl.description.trim() || null,
        subject,
        body_html: newTpl.body_html,
        variables,
        is_active: true,
        updated_by: user.id,
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? `A template with key "${key}" already exists`
          : error.message || "Failed to create template",
      );
      return;
    }
    setTemplates((prev) =>
      [...prev, data as EmailTemplate].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setActiveKey((data as EmailTemplate).key);
    setCreateOpen(false);
    resetNewTpl();
    toast.success("Template created");
  };


  const sendTest = async () => {
    if (!active || !user?.email) {
      toast.error("No admin email on file");
      return;
    }
    setSendingTest(true);
    const variables: Record<string, string> = {};
    active.variables.forEach((v) => {
      variables[v] = sampleValues[v] ?? `{{${v}}}`;
    });
    const { data, error } = await supabase.functions.invoke("send-booking-email", {
      body: {
        templateKey: active.key,
        recipientUserId: user.id,
        variables,
      },
    });
    setSendingTest(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(
        (data as { error?: string })?.error || "Failed to send test email",
      );
      return;
    }
    toast.success(`Test email sent to ${user.email}`);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Failed to load templates");
    } else {
      const list = (data ?? []) as EmailTemplate[];
      setTemplates(list);
      if (!activeKey && list.length > 0) setActiveKey(list[0].key);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => templates.find((t) => t.key === activeKey) ?? null,
    [templates, activeKey],
  );
  const templatePg = usePagination(templates, 12);

  useEffect(() => {
    if (active) {
      setDraft({
        subject: active.subject,
        body_html: active.body_html,
        is_active: active.is_active,
      });
    }
  }, [active]);

  const dirty = useMemo(() => {
    if (!active) return false;
    return (
      draft.subject !== active.subject ||
      draft.body_html !== active.body_html ||
      draft.is_active !== active.is_active
    );
  }, [active, draft]);

  const save = async () => {
    if (!active || !user) return;
    if (draft.subject.trim().length < 1) {
      toast.error("Subject is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: draft.subject.trim(),
        body_html: draft.body_html,
        is_active: draft.is_active,
        updated_by: user.id,
      })
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save template");
      return;
    }
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? {
              ...t,
              subject: draft.subject.trim(),
              body_html: draft.body_html,
              is_active: draft.is_active,
              updated_at: new Date().toISOString(),
            }
          : t,
      ),
    );
    toast.success("Template saved");
  };

  const reset = () => {
    if (!active) return;
    setDraft({
      subject: active.subject,
      body_html: active.body_html,
      is_active: active.is_active,
    });
  };

  const previewSubject = renderTemplate(draft.subject);
  const previewBody = renderTemplate(draft.body_html);

  return (
    <div className="space-y-5">
      <div>
        <Heading level={1}  className="flex items-center gap-2">
          <MailOpen className="h-6 w-6" /> Email Templates
        </Heading>
        <p className="text-description-sm mt-1">
          Edit subject and HTML body for system-sent emails. Use{" "}
          <code className="text-fs-xs px-1 py-0.5 rounded bg-muted">{`{{variable}}`}</code> placeholders.
        </p>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        {/* Template list */}
        <Card className="p-2 h-fit">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="w-full gap-1.5 mb-2"
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
          {loading ? (
            <div className="p-4 text-fs-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <ul className="space-y-1">
                {templatePg.pageItems.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveKey(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-sm text-fs-sm transition-colors ${
                      t.key === activeKey
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      {!t.is_active && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          off
                        </Badge>
                      )}
                    </div>
                    <div className="text-fs-xs text-muted-foreground truncate">
                      {t.key}
                    </div>
                  </button>
                </li>
                ))}
              </ul>
              <NumberedPagination
                currentPage={templatePg.page}
                totalPages={templatePg.totalPages}
                totalItems={templatePg.totalItems}
                pageSize={templatePg.pageSize}
                onPageChange={templatePg.setPage}
                className="mt-3"
          onPageSizeChange={templatePg.setPageSize}
              />
            </>
          )}
        </Card>

        {/* Editor */}
        {!active ? (
          <Card className="p-8 text-fs-sm text-muted-foreground text-center">
            Select a template to edit.
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <Heading level={2} >{active.name}</Heading>
                {active.description && (
                  <p className="text-description-sm mt-0.5">{active.description}</p>
                )}
                <p className="text-fs-xs text-muted-foreground mt-1">
                  Last updated {formatDistanceToNow(new Date(active.updated_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle" className="text-fs-sm">
                  Active
                </Label>
                <Switch
                  id="active-toggle"
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                />
              </div>
            </div>

            {active.variables.length > 0 && (
              <div className="rounded-sm bg-muted/40 border border-border p-3">
                <div className="text-fs-xs font-medium mb-1.5">Available variables</div>
                <div className="flex flex-wrap gap-1.5">
                  {active.variables.map((v) => (
                    <code
                      key={v}
                      className="text-fs-xs px-1.5 py-0.5 rounded bg-background border border-border"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input
                id="tpl-subject"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                maxLength={300}
                className="mt-1.5"
              />
            </div>

            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit" className="gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> HTML
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-3">
                <Textarea
                  value={draft.body_html}
                  onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
                  rows={16}
                  maxLength={50000}
                  className="font-mono text-fs-xs resize-y"
                  spellCheck={false}
                />
                <p className="text-fs-xs text-muted-foreground mt-1 text-right">
                  {draft.body_html.length}/50000
                </p>
              </TabsContent>
              <TabsContent value="preview" className="mt-3">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2 border-b border-border">
                    <div className="text-fs-xs text-muted-foreground">Subject</div>
                    <div className="text-fs-sm font-medium truncate">{previewSubject}</div>
                  </div>
                  <div
                    className="p-4 bg-background prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: previewBody }}
                  />
                </div>
                <p className="text-fs-xs text-muted-foreground mt-2">
                  Preview uses sample values for placeholders.
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border flex-wrap">
              <Button
                variant="outline"
                onClick={sendTest}
                disabled={sendingTest || dirty}
                className="gap-1.5 mr-auto"
                title={dirty ? "Save changes before sending a test" : `Send to ${user?.email ?? "you"}`}
              >
                <Send className="h-4 w-4" /> {sendingTest ? "Sending…" : "Send test email"}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={!dirty || saving} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
              <Button onClick={save} disabled={!dirty || saving} className="gap-1.5">
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetNewTpl(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New email template</DialogTitle>
            <DialogDescription>
              Define a custom template. Use{" "}
              <code className="text-fs-xs px-1 py-0.5 rounded bg-muted">{`{{variable}}`}</code>{" "}
              placeholders in the subject and body.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-key">Key</Label>
                <Input
                  id="new-key"
                  placeholder="welcome_email"
                  value={newTpl.key}
                  onChange={(e) => setNewTpl((d) => ({ ...d, key: e.target.value }))}
                  className="mt-1.5 font-mono text-fs-xs"
                />
                <p className="text-[13px] text-muted-foreground mt-1">
                  Lowercase, numbers, underscores. Used in code.
                </p>
              </div>
              <div>
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  placeholder="Welcome email"
                  value={newTpl.name}
                  onChange={(e) => setNewTpl((d) => ({ ...d, name: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-desc">Description (optional)</Label>
              <Input
                id="new-desc"
                value={newTpl.description}
                onChange={(e) => setNewTpl((d) => ({ ...d, description: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="new-subject">Subject</Label>
              <Input
                id="new-subject"
                placeholder="Welcome, {{name}}!"
                value={newTpl.subject}
                onChange={(e) => setNewTpl((d) => ({ ...d, subject: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="new-vars">Variables</Label>
              <Input
                id="new-vars"
                placeholder="name, app_name"
                value={newTpl.variables}
                onChange={(e) => setNewTpl((d) => ({ ...d, variables: e.target.value }))}
                className="mt-1.5 font-mono text-fs-xs"
              />
              <p className="text-[13px] text-muted-foreground mt-1">
                Comma-separated list. These appear as the available placeholders.
              </p>
            </div>
            <div>
              <Label htmlFor="new-body">Body HTML</Label>
              <Textarea
                id="new-body"
                value={newTpl.body_html}
                onChange={(e) => setNewTpl((d) => ({ ...d, body_html: e.target.value }))}
                rows={6}
                className="mt-1.5 font-mono text-fs-xs"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={createTemplate} disabled={creating} className="gap-1.5">
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
