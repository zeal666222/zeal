/** @type {import('tailwindcss').Config} */
// __ZEAL_TOKENS__ — every semantic colour reads from @zeal/ui/tokens.css
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:        "var(--color-background)",
        surface:           "var(--color-surface)",
        "surface-raised":  "var(--color-surface-raised)",
        "surface-overlay": "var(--color-surface-overlay)",
        "surface-sunken":  "var(--color-surface-sunken)",
        foreground:        "var(--color-foreground)",
        "muted-foreground":   "var(--color-muted-foreground)",
        "subtle-foreground":  "var(--color-subtle-foreground)",
        border:            "var(--color-border)",
        "border-strong":   "var(--color-border-strong)",
        "border-subtle":   "var(--color-border-subtle)",
        primary: {
          DEFAULT:    "var(--color-primary)",
          hover:      "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
          muted:      "var(--color-primary-muted)",
        },
        success:     "var(--color-success)",
        warning:     "var(--color-warning)",
        destructive: "var(--color-destructive)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
    },
  },
  plugins: [],
};
