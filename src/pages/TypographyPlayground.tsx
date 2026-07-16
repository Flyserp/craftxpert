import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FONT_SIZES = [
  { token: "--fs-xs", cls: "text-fs-xs", label: "Extra small" },
  { token: "--fs-sm", cls: "text-fs-sm", label: "Small" },
  { token: "--fs-md", cls: "text-fs-md", label: "Medium / body" },
  { token: "--fs-lg", cls: "text-fs-lg", label: "Large" },
  { token: "--fs-xl", cls: "text-fs-xl", label: "Extra large" },
  { token: "--fs-2xl", cls: "text-fs-2xl", label: "2x large" },
  { token: "--fs-3xl", cls: "text-fs-3xl", label: "3x large" },
  { token: "--fs-4xl", cls: "text-fs-4xl", label: "4x large" },
  { token: "--fs-5xl", cls: "text-fs-5xl", label: "5x large" },
  { token: "--fs-6xl", cls: "text-fs-6xl", label: "6x large / hero" },
];

const WEIGHTS = [
  { token: "--fw-regular", cls: "font-regular", label: "Regular (400)" },
  { token: "--fw-medium", cls: "font-medium", label: "Medium (500)" },
  { token: "--fw-semibold", cls: "font-semibold", label: "Semibold (600)" },
  { token: "--fw-bold", cls: "font-bold", label: "Bold (700)" },
];

const LINE_HEIGHTS = [
  { token: "--lh-tight", cls: "leading-tight", label: "Tight" },
  { token: "--lh-snug", cls: "leading-snug", label: "Snug" },
  { token: "--lh-normal", cls: "leading-normal", label: "Normal" },
  { token: "--lh-relaxed", cls: "leading-relaxed", label: "Relaxed" },
  { token: "--lh-loose", cls: "leading-loose", label: "Loose" },
];

const TRACKING = [
  { token: "--ls-tighter", cls: "tracking-tighter", label: "Tighter" },
  { token: "--ls-tight", cls: "tracking-tight", label: "Tight" },
  { token: "--ls-normal", cls: "tracking-normal", label: "Normal" },
  { token: "--ls-wide", cls: "tracking-wide", label: "Wide" },
  { token: "--ls-wider", cls: "tracking-wider", label: "Wider" },
  { token: "--ls-widest", cls: "tracking-widest", label: "Widest" },
];

const SAMPLE = "The quick brown fox jumps over the lazy dog 0123456789";

export default function TypographyPlayground() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-12 space-y-12">
        <header className="space-y-3">
          <p className="eyebrow">Design System</p>
          <h1>Typography Playground</h1>
          <p className="lead text-muted-foreground max-w-3xl">
            Preview every font size, weight, line-height, and letter-spacing token used across
            the app. Drop any of these utilities into your components for consistent type.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">Tokens in <code>src/index.css</code></Badge>
            <Badge variant="secondary">Tailwind utilities in <code>tailwind.config.ts</code></Badge>
          </div>
        </header>

        {/* Headings */}
        <section className="space-y-4">
          <h2>Headings</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div><span className="eyebrow text-muted-foreground">h1 · .h1</span><h1>Heading One — Display</h1></div>
              <div><span className="eyebrow text-muted-foreground">h2 · .h2</span><h2>Heading Two — Section</h2></div>
              <div><span className="eyebrow text-muted-foreground">h3 · .h3</span><h3>Heading Three — Subsection</h3></div>
              <div><span className="eyebrow text-muted-foreground">h4 · .h4</span><h4>Heading Four — Card title</h4></div>
              <div><span className="eyebrow text-muted-foreground">h5 · .h5</span><h5>Heading Five — Small block</h5></div>
              <div><span className="eyebrow text-muted-foreground">h6 · .h6</span><h6>Heading Six — Micro label</h6></div>
            </CardContent>
          </Card>
        </section>

        {/* Body */}
        <section className="space-y-4">
          <h2>Body, Lead & Eyebrow</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div>
                <span className="eyebrow text-muted-foreground">.lead</span>
                <p className="lead">A lead paragraph introduces a section with slightly larger, lighter text. It draws attention without competing with the headline.</p>
              </div>
              <div>
                <span className="eyebrow text-muted-foreground">.body / &lt;p&gt;</span>
                <p>Body copy is the workhorse of the page. It scales from 15px on mobile up to 17px on desktop with a comfortable 1.65 line-height for long-form reading.</p>
              </div>
              <div>
                <span className="eyebrow text-muted-foreground">.eyebrow</span>
                <p className="eyebrow">Eyebrow Label Above Sections</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Font sizes */}
        <section className="space-y-4">
          <h2>Font Size Scale</h2>
          <Card>
            <CardContent className="divide-y divide-border pt-0">
              {FONT_SIZES.map((s) => (
                <div key={s.token} className="flex flex-col gap-2 py-4 md:flex-row md:items-baseline md:gap-6">
                  <div className="w-48 shrink-0">
                    <code className="text-fs-xs text-muted-foreground">{s.cls}</code>
                    <p className="text-fs-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className={`${s.cls} truncate`}>{SAMPLE}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Weights */}
        <section className="space-y-4">
          <h2>Font Weights</h2>
          <Card>
            <CardContent className="divide-y divide-border pt-0">
              {WEIGHTS.map((w) => (
                <div key={w.token} className="flex flex-col gap-2 py-4 md:flex-row md:items-baseline md:gap-6">
                  <div className="w-48 shrink-0">
                    <code className="text-fs-xs text-muted-foreground">{w.cls}</code>
                    <p className="text-fs-xs text-muted-foreground">{w.label}</p>
                  </div>
                  <p className={`text-fs-xl ${w.cls}`}>{SAMPLE}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Line heights */}
        <section className="space-y-4">
          <h2>Line Heights</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {LINE_HEIGHTS.map((l) => (
              <Card key={l.token}>
                <CardHeader>
                  <CardTitle><code className="text-fs-sm">{l.cls}</code></CardTitle>
                  <CardDescription>{l.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-fs-sm ${l.cls}`}>
                    Multi-line sample paragraph to demonstrate line-height stacking. Notice how
                    vertical rhythm tightens or opens up between adjacent lines as the token changes.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Letter spacing */}
        <section className="space-y-4">
          <h2>Letter Spacing</h2>
          <Card>
            <CardContent className="divide-y divide-border pt-0">
              {TRACKING.map((t) => (
                <div key={t.token} className="flex flex-col gap-2 py-4 md:flex-row md:items-baseline md:gap-6">
                  <div className="w-48 shrink-0">
                    <code className="text-fs-xs text-muted-foreground">{t.cls}</code>
                    <p className="text-fs-xs text-muted-foreground">{t.label}</p>
                  </div>
                  <p className={`text-fs-lg ${t.cls} uppercase`}>{SAMPLE}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Labels & form */}
        <section className="space-y-4">
          <h2>Labels & Form Text</h2>
          <Card>
            <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tp-name">Full name</Label>
                <Input id="tp-name" placeholder="Ada Lovelace" />
                <p className="text-fs-xs text-muted-foreground">Helper text uses <code>text-fs-xs</code>.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tp-email">Email address</Label>
                <Input id="tp-email" type="email" placeholder="ada@example.com" />
                <p className="text-fs-xs text-destructive">Error message uses <code>text-fs-xs</code> + destructive color.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Table sample */}
        <section className="space-y-4">
          <h2>Table Typography</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableCaption>Sample bookings demonstrating header/body text scale.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: "INV-20260101-001", c: "Jordan Park", s: "Confirmed", t: "$240.00" },
                    { id: "INV-20260102-002", c: "Riley Chen", s: "Pending", t: "$1,420.50" },
                    { id: "INV-20260103-003", c: "Sam O'Neill", s: "Completed", t: "$98.00" },
                  ].map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.id}</TableCell>
                      <TableCell>{r.c}</TableCell>
                      <TableCell><Badge variant="secondary">{r.s}</Badge></TableCell>
                      <TableCell className="text-right">{r.t}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}