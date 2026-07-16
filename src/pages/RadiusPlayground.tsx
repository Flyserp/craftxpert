import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/app";

const RADII = [
  { cls: "rounded-none", label: "none", value: "0" },
  { cls: "rounded-sm", label: "sm", value: "0.5rem" },
  { cls: "rounded-sm", label: "md", value: "0.75rem" },
  { cls: "rounded-lg", label: "lg", value: "1rem (--radius)" },
  { cls: "rounded-xl", label: "xl", value: "1.25rem" },
  { cls: "rounded-2xl", label: "2xl", value: "1.5rem" },
  { cls: "rounded-3xl", label: "3xl", value: "2rem" },
  { cls: "rounded-full", label: "full", value: "9999px" },
];

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="bg-background text-foreground border border-border rounded-lg p-6">
        <Heading level={2}  className="mb-4 capitalize">{theme} theme</Heading>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {RADII.map((r) => (
            <div key={r.cls} className="flex flex-col items-center gap-2">
              <div
                className={`${r.cls} bg-primary w-20 h-20 border border-border`}
                aria-label={r.cls}
              />
              <div className="text-fs-xs text-muted-foreground text-center">
                <div className="font-mono">{r.cls}</div>
                <div>{r.value}</div>
              </div>
            </div>
          ))}
        </div>

        <Heading level={3}  className="mb-3">Components</Heading>
        <div className="space-y-3">
          {RADII.map((r) => (
            <div key={r.cls} className="flex flex-wrap items-center gap-3">
              <span className="text-fs-xs font-mono w-24 text-muted-foreground">{r.cls}</span>
              <Button className={r.cls}>Button</Button>
              <input
                placeholder="Input"
                className={`${r.cls} h-10 px-3 border border-input bg-background text-foreground text-fs-sm`}
              />
              <Card className={`${r.cls} px-4 py-2 text-fs-sm`}>Card</Card>
              <span className={`${r.cls} bg-accent text-accent-foreground px-3 py-1 text-fs-xs`}>
                Badge
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RadiusPlayground() {
  const [mode, setMode] = useState<"side" | "light" | "dark">("side");

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Heading level={1} >Radius Playground</Heading>
            <p className="text-fs-sm text-muted-foreground">
              Visual preview of all <code>rounded-*</code> tokens in light and dark themes.
            </p>
          </div>
          <div className="flex gap-2">
            {(["side", "light", "dark"] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
              >
                {m === "side" ? "Side-by-side" : m}
              </Button>
            ))}
          </div>
        </div>

        {mode === "side" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel theme="light" />
            <Panel theme="dark" />
          </div>
        ) : (
          <Panel theme={mode} />
        )}
      </div>
    </div>
  );
}