import { Check, Circle } from "lucide-react";
import { Heading } from "@/components/ui/app";

type Item = { label: string; done: boolean };

export default function ProfileCompletion({ checks }: { checks: Item[] }) {
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  return (
    <section className="bg-card border border-border rounded-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <Heading level={3} >Profile completion</Heading>
        <span className="text-fs-sm font-semibold text-primary">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-sm overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-fs-xs">
        {checks.map((c) => (
          <li key={c.label} className={`inline-flex items-center gap-1.5 ${c.done ? "text-primary" : "text-muted-foreground"}`}>
            {c.done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            {c.label}
          </li>
        ))}
      </ul>
    </section>
  );
}