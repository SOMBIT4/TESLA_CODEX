import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "var(--font-bangla)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "var(--font-bangla)",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
        },
        paper: "hsl(var(--paper))",
        vermilion: "hsl(var(--vermilion))",
        marigold: "hsl(var(--marigold))",
        sky: "hsl(var(--sky))",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 2px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        card: "0 1px 0 hsl(var(--ink) / 0.04), 0 1px 3px hsl(var(--ink) / 0.06), 0 12px 32px -18px hsl(var(--ink) / 0.18)",
        lift: "0 1px 0 hsl(var(--ink) / 0.04), 0 4px 10px hsl(var(--ink) / 0.06), 0 22px 44px -20px hsl(var(--ink) / 0.28)",
        press:
          "inset 0 1px 0 hsl(0 0% 100% / 0.18), 0 1px 2px hsl(var(--ink) / 0.24)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "70%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        draw: {
          from: { strokeDashoffset: "var(--path-length, 600)" },
          to: { strokeDashoffset: "0" },
        },
        ping: {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "80%, 100%": { transform: "scale(2.6)", opacity: "0" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        dash: {
          to: { strokeDashoffset: "-28" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        fade: "fade 0.6s ease-out both",
        pop: "pop 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        draw: "draw 1.8s cubic-bezier(0.65, 0, 0.35, 1) both",
        ping: "ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "slide-down": "slide-down 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        drift: "drift 6s ease-in-out infinite",
        dash: "dash 1.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
