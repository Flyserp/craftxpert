import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      // Custom: full desktop nav threshold (mini menu for 768–1199px)
      xl1200: "1200px",
    },
    extend: {
      fontFamily: {
        // Single source of truth: `--font-sans` in src/index.css defines the
        // full stack (Inter first, Geist fallback, then system fonts).
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        // Token-driven fluid scale — wired to CSS vars in src/index.css.
        // Use with Tailwind: `text-fs-base`, `text-fs-lg`, etc.
        'fs-xs':   'var(--fs-xs)',
        'fs-sm':   'var(--fs-sm)',
        'fs-base': 'var(--fs-base)',
        'fs-md':   'var(--fs-md)',
        'fs-lg':   'var(--fs-lg)',
        'fs-xl':   'var(--fs-xl)',
        'fs-2xl':  'var(--fs-2xl)',
        'fs-3xl':  'var(--fs-3xl)',
        'fs-4xl':  'var(--fs-4xl)',
        'fs-5xl':  'var(--fs-5xl)',
        'fs-6xl':  'var(--fs-6xl)',
      },
      fontWeight: {
        regular:   'var(--fw-regular)',
        medium:    'var(--fw-medium)',
        semibold:  'var(--fw-semibold)',
        bold:      'var(--fw-bold)',
        extrabold: 'var(--fw-extrabold)',
      },
      lineHeight: {
        none:    'var(--lh-none)',
        tight:   'var(--lh-tight)',
        snug:    'var(--lh-snug)',
        normal:  'var(--lh-normal)',
        relaxed: 'var(--lh-relaxed)',
        loose:   'var(--lh-loose)',
      },
      letterSpacing: {
        tighter: 'var(--ls-tighter)',
        tight:   'var(--ls-tight)',
        normal:  'var(--ls-normal)',
        wide:    'var(--ls-wide)',
        wider:   'var(--ls-wider)',
        widest:  'var(--ls-widest)',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        overlay: "hsl(var(--overlay) / var(--overlay-opacity))",
        "on-dark": "hsl(var(--on-dark))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--on-dark))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--on-dark))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--on-dark))",
        },
        danger: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        hover: {
          DEFAULT: "hsl(var(--hover-bg))",
          foreground: "hsl(var(--hover-text))",
        },
        footer: {
          DEFAULT: "hsl(var(--footer))",
          foreground: "hsl(var(--footer-foreground))",
          muted: "hsl(var(--footer-muted))",
          subtle: "hsl(var(--footer-subtle))",
          border: "hsl(var(--footer-border))",
          "link-hover": "hsl(var(--footer-link-hover))",
        },
      },
      borderRadius: {
        sm:   "0.5rem",   /* 8px — small radius */
        md:   "0.75rem",  /* 12px — alias kept for backward compatibility */
        lg:   "0.75rem",  /* 12px — aligned with unified component radius */
        xl:   "0.75rem",  /* 12px — aligned with unified component radius */
        "2xl":"1.5rem",   /* 24px — hero cards, large surfaces */
        "3xl":"2rem",     /* 32px — modals, marketing sections */
      },
      spacing: {
        "space-xs":  "var(--space-xs)",
        "space-sm":  "var(--space-sm)",
        "space-md":  "var(--space-md)",
        "space-lg":  "var(--space-lg)",
        "space-xl":  "var(--space-xl)",
        "space-2xl": "var(--space-2xl)",
        "space-3xl": "var(--space-3xl)",
        "space-4xl": "var(--space-4xl)",
        "icon-xs":   "var(--icon-xs)",
        "icon-sm":   "var(--icon-sm)",
        "icon-md":   "var(--icon-md)",
        "icon-lg":   "var(--icon-lg)",
        "icon-xl":   "var(--icon-xl)",
        "icon-2xl":  "var(--icon-2xl)",
      },
      boxShadow: {
        card: "var(--card-shadow)",
        "card-hover": "var(--card-shadow-hover)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast:    "var(--duration-fast)",
        normal:  "var(--duration-normal)",
        slow:    "var(--duration-slow)",
        slower:  "var(--duration-slower)",
      },
      transitionTimingFunction: {
        standard:    "var(--ease-standard)",
        emphasized:  "var(--ease-emphasized)",
        decelerate:  "var(--ease-decelerate)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 25s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
