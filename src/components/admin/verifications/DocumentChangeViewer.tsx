import { useMemo } from "react";
import { FilePlus2, FileEdit, FileMinus2, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_DOCS } from "@/lib/verification";

type AuditRow = {
  id: string;
  event: string;
  note: string | null;
  actor_role: string | null;
  created_at: string;
};

type ChangeKind = "added" | "replaced" | "removed";

type DocChange = {
  id: string;
  kind: ChangeKind;
  fieldKey: string;
  fieldLabel: string;
  oldFile: string | null;
  newFile: string | null;
  at: string;
  actorRole: string | null;
};

type Cycle = {
  label: string;
  cycleAt: string | null;
  changes: DocChange[];
};

const KIND_META: Record<ChangeKind, { label: string; icon: typeof FilePlus2; tone: string }> = {
  added: {
    label: "Added",
    icon: FilePlus2,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  replaced: {
    label: "Replaced",
    icon: FileEdit,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  removed: {
    label: "Removed",
    icon: FileMinus2,
    tone: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  VERIFICATION_DOCS.map((d) => [d.key, d.label]),
);

/** Parse the trigger-generated note "field_key: old → new" into structured parts. */
function parseNote(note: string | null): { fieldKey: string; oldFile: string | null; newFile: string | null } | null {
  if (!note) return null;
  const idx = note.indexOf(":");
  if (idx === -1) return null;
  const fieldKey = note.slice(0, idx).trim();
  const rest = note.slice(idx + 1).trim();
  const [oldRaw, newRaw] = rest.split("→").map((s) => s.trim());
  const norm = (s?: string) => (!s || s === "(none)" ? null : s);
  return { fieldKey, oldFile: norm(oldRaw), newFile: norm(newRaw) };
}

/**
 * Groups document upload/replace/remove events into resubmission cycles so
 * admins can see exactly which docs changed between each vendor resubmission.
 */
export default function DocumentChangeViewer({ audit }: { audit: AuditRow[] }) {
  const cycles = useMemo<Cycle[]>(() => {
    // Trigger writes newest first; walk oldest→newest to build cycles.
    const asc = [...audit].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const out: Cycle[] = [{ label: "Initial submission", cycleAt: null, changes: [] }];
    for (const row of asc) {
      if (row.event === "resubmitted") {
        out.push({
          label: `Resubmission #${out.length}`,
          cycleAt: row.created_at,
          changes: [],
        });
        continue;
      }
      if (
        row.event !== "document_uploaded" &&
        row.event !== "document_replaced" &&
        row.event !== "document_removed"
      ) {
        continue;
      }
      const parsed = parseNote(row.note);
      if (!parsed) continue;
      const kind: ChangeKind =
        row.event === "document_uploaded"
          ? "added"
          : row.event === "document_removed"
          ? "removed"
          : "replaced";
      out[out.length - 1].changes.push({
        id: row.id,
        kind,
        fieldKey: parsed.fieldKey,
        fieldLabel: FIELD_LABEL[parsed.fieldKey] ?? parsed.fieldKey,
        oldFile: parsed.oldFile,
        newFile: parsed.newFile,
        at: row.created_at,
        actorRole: row.actor_role,
      });
    }
    // Show newest cycle first, drop empty leading ones.
    return out.filter((c) => c.changes.length > 0).reverse();
  }, [audit]);

  if (cycles.length === 0) {
    return (
      <p className="text-fs-sm text-muted-foreground text-center py-8">
        No document changes recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {cycles.map((cycle, idx) => {
        const CycleIcon = cycle.cycleAt ? RefreshCw : Send;
        const totals = cycle.changes.reduce(
          (acc, c) => ({ ...acc, [c.kind]: acc[c.kind] + 1 }),
          { added: 0, replaced: 0, removed: 0 } as Record<ChangeKind, number>,
        );
        return (
          <section
            key={`${cycle.label}-${idx}`}
            className="border border-border rounded-sm overflow-hidden"
          >
            <header className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CycleIcon className="w-3.5 h-3.5 text-primary" />
                <p className="text-fs-sm font-semibold text-foreground">{cycle.label}</p>
                {cycle.cycleAt && (
                  <span className="text-fs-xs text-muted-foreground">
                    · {new Date(cycle.cycleAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                {(Object.keys(totals) as ChangeKind[]).map((k) =>
                  totals[k] > 0 ? (
                    <span
                      key={k}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
                        KIND_META[k].tone,
                      )}
                    >
                      {totals[k]} {KIND_META[k].label.toLowerCase()}
                    </span>
                  ) : null,
                )}
              </div>
            </header>
            <ul className="divide-y divide-border">
              {cycle.changes.map((c) => {
                const meta = KIND_META[c.kind];
                const Icon = meta.icon;
                return (
                  <li key={c.id} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-fs-sm font-medium text-foreground">
                              {c.fieldLabel}
                            </p>
                            <span
                              className={cn(
                                "text-[10px] uppercase tracking-wide rounded-full border px-1.5 py-0.5",
                                meta.tone,
                              )}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="mt-1 text-fs-xs text-muted-foreground break-all">
                            {c.kind === "added" && (
                              <span>
                                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                  + {c.newFile ?? "(new file)"}
                                </span>
                              </span>
                            )}
                            {c.kind === "removed" && (
                              <span>
                                <span className="text-destructive font-medium line-through">
                                  − {c.oldFile ?? "(previous file)"}
                                </span>
                              </span>
                            )}
                            {c.kind === "replaced" && (
                              <span className="flex flex-col gap-0.5">
                                <span className="text-destructive line-through">
                                  − {c.oldFile ?? "(previous)"}
                                </span>
                                <span className="text-emerald-700 dark:text-emerald-300">
                                  + {c.newFile ?? "(new)"}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <time className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(c.at).toLocaleString()}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
