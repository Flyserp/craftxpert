import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, BookOpen, Rocket, Hammer, FolderTree, Settings, Sparkles,
  Wrench, History, LifeBuoy, HelpCircle, ArrowUp, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/app";

/* -------------------------------------------------------------------------- */
/*  WRAPCODERS — Documentation Portal                                         */
/*  All "Lovable" branding in this docs file is replaced with WRAPCODERS.     */
/* -------------------------------------------------------------------------- */

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
};

const Code = ({ children, lang = "bash" }: { children: string; lang?: string }) => (
  <pre className="rounded-lg border border-border bg-muted/60 text-foreground p-4 overflow-x-auto text-[12.5px] leading-relaxed font-mono">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{lang}</div>
    <code>{children}</code>
  </pre>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
  <Heading level={2}  className="mt-2 mb-3 scroll-mt-24">{children}</Heading>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <Heading level={3}  className="mt-6 mb-2">{children}</Heading>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-body text-muted-foreground leading-relaxed mb-3">{children}</p>
);
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-6 space-y-1.5 text-body text-muted-foreground mb-4">{children}</ul>
);
const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-fs-sm text-foreground my-4">
    {children}
  </div>
);

const SECTIONS: Section[] = [
  {
    id: "introduction",
    title: "A. Introduction",
    icon: BookOpen,
    content: (
      <>
        <H2>Introduction</H2>
        <H3>App name</H3>
        <P><strong>TaskHive</strong> — a multi-tenant services marketplace platform.</P>

        <H3>Overview</H3>
        <P>
          A production-ready SaaS for launching service marketplaces (cleaning, tutoring, beauty, home services and more).
          It ships with bookings, payments, real-time chat, AI-powered matching, reviews, notifications,
          a setup wizard, PWA support and full role-based dashboards.
        </P>

        <H3>Features summary</H3>
        <UL>
          <li>Multi-tenant architecture with path-based tenants</li>
          <li>Roles: Super Admin, Admin/Moderator, Provider/Vendor, Staff, Client/Customer</li>
          <li>Bookings (instant + post-a-task) with deposits</li>
          <li>Stripe & PayPal payments + invoices + commissions</li>
          <li>Real-time chat, notifications & smart vendor matching (Gemini AI)</li>
          <li>PWA with admin-controlled icon & theme</li>
          <li>Setup wizard</li>
        </UL>

        <H3>Tech stack</H3>
        <UL>
          <li>React 18 + Vite 5 + TypeScript 5</li>
          <li>Tailwind CSS v3 + shadcn/ui</li>
          <li>Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)</li>
          <li>TanStack Query, React Router, Framer Motion</li>
          <li>Workbox PWA, Playwright + Vitest</li>
        </UL>
      </>
    ),
  },
  {
    id: "installation",
    title: "B. Installation Guide",
    icon: Rocket,
    content: (
      <>
        <H2>Installation Guide (Step-by-Step)</H2>

        <H3>1. System requirements</H3>
        <UL>
          <li>Node.js ≥ 20.x</li>
          <li>Bun ≥ 1.1 (or npm/pnpm)</li>
          <li>Git</li>
          <li>A Supabase project (or use WRAPCODERS Cloud)</li>
        </UL>

        <H3>2. Environment setup</H3>
        <Code lang="bash">{`git clone <your-repo-url> TaskHive
cd TaskHive
cp .env.example .env`}</Code>

        <H3>3. Install dependencies</H3>
        <Code lang="bash">{`bun install
# or
npm install`}</Code>

        <H3>4. Database setup</H3>
        <P>The schema lives in <code>supabase/migrations</code>. Push it with the Supabase CLI:</P>
        <Code lang="bash">{`supabase link --project-ref <your-ref>
supabase db push`}</Code>

        <H3>5. Configuration steps</H3>
        <UL>
          <li>Fill in <code>.env</code> (see Configuration Guide)</li>
          <li>Deploy edge functions: <code>supabase functions deploy</code></li>
          <li>Run the in-app <code>/install</code> wizard to create the super admin</li>
        </UL>

        <H3>6. First run</H3>
        <Code lang="bash">{`bun run dev
# open http://localhost:5173`}</Code>
      </>
    ),
  },
  {
    id: "build",
    title: "C. Build & Deployment",
    icon: Hammer,
    content: (
      <>
        <H2>Build & Deployment</H2>

        <H3>Development build</H3>
        <Code lang="bash">{`bun run dev`}</Code>

        <H3>Production build</H3>
        <Code lang="bash">{`bun run build
bun run preview  # smoke test the dist output`}</Code>

        <H3>Server deployment steps</H3>
        <UL>
          <li>Run the production build</li>
          <li>Upload <code>dist/</code> to your host</li>
          <li>Point your domain at the host and enable HTTPS</li>
          <li>Make sure your edge functions and DB are deployed</li>
        </UL>

        <H3>Hosting instructions</H3>
        <H3>VPS (Nginx)</H3>
        <Code lang="nginx">{`server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  root /var/www/TaskHive/dist;
  index index.html;
  location / { try_files $uri /index.html; }
}`}</Code>

        <H3>cPanel</H3>
        <UL>
          <li>Build locally, then upload <code>dist/</code> to <code>public_html</code></li>
          <li>Add an <code>.htaccess</code> SPA fallback to <code>index.html</code></li>
        </UL>

        <H3>Docker</H3>
        <Code lang="dockerfile">{`FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install && bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf`}</Code>

        <H3>Common deployment issues & fixes</H3>
        <UL>
          <li><strong>404 on refresh</strong> — add SPA fallback to <code>index.html</code></li>
          <li><strong>Blank page</strong> — check <code>VITE_SUPABASE_URL</code> in build env</li>
          <li><strong>CORS errors</strong> — add your domain in Supabase Auth settings</li>
          <li><strong>Edge functions not found</strong> — run <code>supabase functions deploy</code></li>
        </UL>
      </>
    ),
  },
  {
    id: "structure",
    title: "D. Project Structure",
    icon: FolderTree,
    content: (
      <>
        <H2>Project Structure</H2>
        <Code lang="text">{`src/
├── components/      # Reusable UI + layout components
├── pages/           # Routed pages (admin/, client/, provider/)
├── contexts/        # AuthContext, ThemeContext
├── hooks/           # useNotifications, usePwaBranding, useFavorites…
├── lib/             # Domain helpers (bookingPolicy, commission, …)
├── integrations/
│   └── supabase/    # auto-generated client + types
└── index.css        # Design tokens (HSL semantic variables)

supabase/
├── functions/       # Edge functions (payments, AI, email, seed)
└── migrations/      # SQL schema
`}</Code>

        <H3>Core modules</H3>
        <UL>
          <li><strong>Auth</strong> — Supabase Auth + role redirects</li>
          <li><strong>Bookings</strong> — instant booking & post-a-task</li>
          <li><strong>Payments</strong> — Stripe, PayPal, deposits, invoices</li>
          <li><strong>Chat</strong> — Supabase Realtime messaging</li>
          <li><strong>AI Matching</strong> — Gemini-ranked vendor suggestions</li>
          <li><strong>Admin</strong> — full platform management</li>
        </UL>

        <H3>API structure</H3>
        <P>
          Backend logic runs as Supabase Edge Functions in <code>supabase/functions/</code>.
          The frontend calls them via <code>supabase.functions.invoke(&quot;name&quot;)</code>.
        </P>

        <H3>Auth system overview</H3>
        <P>
          Email + password and Google OAuth, JWT-managed sessions, server-side role checks via a
          dedicated <code>user_roles</code> table and a <code>has_role()</code> security-definer function.
          Roles never live on the profile table.
        </P>
      </>
    ),
  },
  {
    id: "configuration",
    title: "E. Configuration Guide",
    icon: Settings,
    content: (
      <>
        <H2>Configuration Guide</H2>

        <H3>.env variables explained</H3>
        <Code lang="bash">{`# Backend
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
VITE_SUPABASE_PROJECT_ID=xxx

# App
VITE_APP_NAME=TaskHive
VITE_APP_URL=https://yourdomain.com

# Email (for transactional/auth mail)
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=*****

# PWA
VITE_PWA_NAME=TaskHive
VITE_PWA_SHORT_NAME=Wrap
VITE_PWA_THEME_COLOR=#00272c`}</Code>


        <H3>App settings</H3>
        <P>App-wide platform settings (currency, branding, fees, commission %)
        live in the <code>platform_settings</code> table and are managed from the Admin panel.</P>

        <H3>Email configuration</H3>
        <P>Configure SMTP in the Admin → Email Templates panel, or set the SMTP_*
        secrets above for transactional mail.</P>

        <H3>Database configuration</H3>
        <P>Use Supabase migrations under <code>supabase/migrations</code>. Never edit
        <code>src/integrations/supabase/types.ts</code> manually — it is auto-generated.</P>

        <H3>PWA configuration</H3>
        <P>The PWA manifest is generated by <code>vite-plugin-pwa</code>. Theme color, name and icon
        can be overridden at runtime by admin via the Branding panel — <code>PwaBrandingApplier</code>
        patches <code>&lt;link rel=&quot;icon&quot;&gt;</code>, <code>theme-color</code> and apple-touch-icon.</P>

        <H3>PWA icons setup (admin-controlled)</H3>
        <UL>
          <li>Sign in as Admin → Settings → Branding</li>
          <li>Upload square PNGs (192×192 and 512×512)</li>
          <li>Saved icons are served from storage and applied live to all installed apps</li>
        </UL>
      </>
    ),
  },
  {
    id: "features",
    title: "F. Features Documentation",
    icon: Sparkles,
    content: (
      <>
        <H2>Features Documentation</H2>

        <H3>User system</H3>
        <P>Email/password + Google sign-in, profile completion flow, password reset, account deletion.</P>

        <H3>Role-based access</H3>
        <UL>
          <li><strong>Super Admin</strong> — platform earnings, all tenants, payment config</li>
          <li><strong>Admin / Moderator</strong> — tenant-level management</li>
          <li><strong>Provider / Vendor</strong> — services, availability, earnings</li>
          <li><strong>Staff</strong> — provider-delegated dashboard access</li>
          <li><strong>Client / Customer</strong> — bookings, wallet, reviews</li>
        </UL>
        <Note>Roles are stored in a separate <code>user_roles</code> table and checked via the <code>has_role()</code> security-definer function. Never trust client-side role state for security.</Note>

        <H3>Dashboard system</H3>
        <P>Each role has a dedicated dashboard at <code>/admin</code>, <code>/provider-dashboard</code>,
        <code>/staff-dashboard</code> and <code>/profile</code> (clients).</P>

        <H3>Navigation system</H3>
        <P>Responsive header with mega menu (desktop) and hamburger (mobile),
        bottom-nav for clients on mobile, sidebar for admin & provider areas.</P>

        <H3>PWA system</H3>
        <P>Installable on mobile + desktop, offline-cached static shell via Workbox,
        live-patched icon/theme.</P>

        <H3>Setup wizard system</H3>
        <P>First-run installer at <code>/install</code> creates the super admin and locks itself.</P>

        <H3>Notification system</H3>
        <P>Real-time bell + toasts (Supabase Realtime), scheduled reminders via
        <code>pg_cron</code>, and channel dispatch (in-app, email).</P>
      </>
    ),
  },

  {
    id: "setup-wizard",
    title: "H. Setup Wizard",
    icon: Wrench,
    content: (
      <>
        <H2>Setup Wizard Documentation</H2>

        <H3>Installation flow</H3>
        <UL>
          <li>Visit <code>/install</code> on a fresh deployment</li>
          <li>Step 1 — environment & DB connectivity check</li>
          <li>Step 2 — create super admin account</li>
          <li>Step 3 — base branding & currency</li>
          <li>Step 4 — finalize and lock the wizard</li>
        </UL>

        <H3>Super admin creation</H3>
        <P>Creates the very first user with the <code>admin</code> role and platform-wide privileges.</P>

        <H3>System validation</H3>
        <P>Checks DB reachability, required env vars, edge functions and storage buckets before allowing completion.</P>

        <H3>Security behavior</H3>
        <UL>
          <li>Wizard route refuses to load once an admin exists</li>
          <li>All writes use <code>SECURITY DEFINER</code> RPC, never client-side trust</li>
        </UL>

        <H3>Setup lock after completion</H3>
        <P>A row in <code>platform_settings.installed = true</code> permanently disables the installer.
        To re-run, you must clear that flag from the database manually.</P>
      </>
    ),
  },
  {
    id: "changelog",
    title: "I. Changelog",
    icon: History,
    content: (
      <>
        <H2>Changelog</H2>
        <H3>Version v1.0.0</H3>
        <UL>
          <li>Improved role-based redirect system</li>
          <li>Added PWA full support with admin icon control</li>
          <li>Added setup wizard system</li>
          <li>Improved navigation responsive system</li>
          
          <li>Fixed responsiveness issues across modules</li>
          <li>Improved authentication flow stability</li>
          <li>Enhanced documentation system</li>
          <li>UI/UX refinements across dashboard</li>
          <li>Bug fixes and performance improvements</li>
        </UL>
      </>
    ),
  },
  {
    id: "troubleshooting",
    title: "J. Troubleshooting",
    icon: LifeBuoy,
    content: (
      <>
        <H2>Troubleshooting</H2>
        <H3>Common errors</H3>
        <UL>
          <li><strong>Invalid login credentials</strong> — reset the user's password</li>
          <li><strong>RLS policy denies access</strong> — verify <code>user_roles</code> row + <code>has_role()</code></li>
          <li><strong>White screen after deploy</strong> — env vars missing at build time</li>
        </UL>
        <H3>Server issues</H3>
        <UL>
          <li>SPA 404 → enable history fallback in your web server</li>
          <li>WebSocket failures → allow <code>wss://*.supabase.co</code> through proxies</li>
        </UL>
        <H3>Auth issues</H3>
        <UL>
          <li>Email not arriving — check SMTP secrets / Supabase Auth provider</li>
          <li>OAuth redirect mismatch — add the production URL to Auth settings</li>
        </UL>
        <H3>Build issues</H3>
        <UL>
          <li>Out of memory — <code>NODE_OPTIONS=--max-old-space-size=4096 bun run build</code></li>
          <li>Type errors — re-run <code>supabase gen types</code> after schema changes</li>
        </UL>
      </>
    ),
  },
  {
    id: "faq",
    title: "K. FAQ",
    icon: HelpCircle,
    content: (
      <>
        <H2>FAQ</H2>
        <H3>Setup</H3>
        <P><strong>Q.</strong> Can I run without Supabase? — <strong>A.</strong> No, the backend depends on Supabase / WRAPCODERS Cloud.</P>
        <H3>Deployment</H3>
        <P><strong>Q.</strong> Do I need a separate Node server? — <strong>A.</strong> No, this is a static SPA + edge functions.</P>
        <H3>Roles</H3>
        <P><strong>Q.</strong> How do I add a new role? — <strong>A.</strong> Extend the <code>app_role</code> enum, add policies and a redirect in <code>AuthContext</code>.</P>
        <H3>PWA</H3>
        <P><strong>Q.</strong> Why isn’t my new icon showing? — <strong>A.</strong> Hard-refresh / reinstall — service workers cache the manifest aggressively.</P>
      </>
    ),
  },
];

export default function DocsPage() {
  const { section } = useParams();
  const [active, setActive] = useState<string>(section ?? SECTIONS[0].id);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (section) setActive(section);
  }, [section]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => s.title.toLowerCase().includes(q) || s.id.includes(q));
  }, [query]);

  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle docs nav">
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <Link to="/" className="flex items-center gap-2 font-semibold text-heading">
            <BookOpen className="w-5 h-5 text-primary" />
            TaskHive Docs
          </Link>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider">v1.0.0</Badge>
          <div className="ml-auto relative w-full max-w-xs hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sections…"
              className="pl-9 h-9"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] gap-8">
        {/* Sidebar nav */}
        <aside
          className={`${navOpen ? "block" : "hidden"} lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-auto`}
        >
          <nav className="space-y-1">
            {filtered.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === active;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id);
                    setNavOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-fs-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main id="docs-main" className="min-w-0">
          <article className="prose-none max-w-none">
            {current.content}
          </article>

          <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
            <p className="text-fs-xs text-muted-foreground">
              Built by{" "}
              <a
                href="https://wrapcoders.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold hover:underline"
              >
                WRAPCODERS
              </a>{" "}
              · v1.0.0
            </p>
            <Button variant="outline" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ArrowUp className="w-3.5 h-3.5 mr-1" /> Top
            </Button>
          </div>
        </main>

        {/* TOC */}
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
          <p className="text-fs-sm text-foreground font-medium mb-2">{current.title}</p>
          <p className="text-fs-xs text-muted-foreground leading-relaxed">
            Use the left navigation to jump between documentation sections.
          </p>
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(var(--primary))] text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-fs-xs">
          <p>© {new Date().getFullYear()} TaskHive — All rights reserved.</p>
          <p>
            Crafted by{" "}
            <a
              href="https://wrapcoders.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              WRAPCODERS
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}