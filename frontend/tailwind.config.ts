import type { Config } from 'tailwindcss';

const hsl = (v: string) => `hsl(var(--${v}))`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        background: hsl('background'),
        surface: hsl('surface'),
        foreground: hsl('foreground'),
        border: hsl('border'),
        'border-strong': hsl('border-strong'),
        input: hsl('input'),
        ring: hsl('ring'),
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        pink: { DEFAULT: hsl('pink'), foreground: hsl('pink-foreground') },
        'pink-soft': { DEFAULT: hsl('pink-soft'), foreground: hsl('pink-soft-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        success: { DEFAULT: hsl('success'), strong: hsl('success-strong') },
        warning: { DEFAULT: hsl('warning'), strong: hsl('warning-strong') },
        danger: { DEFAULT: hsl('danger'), strong: hsl('danger-strong') },
        info: { DEFAULT: hsl('info'), strong: hsl('info-strong') },
        sidebar: {
          DEFAULT: hsl('sidebar'),
          foreground: hsl('sidebar-foreground'),
          muted: hsl('sidebar-muted'),
          active: hsl('sidebar-active'),
          hover: hsl('sidebar-hover'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        sm: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
        md: '0 4px 12px -2px rgb(16 24 40 / 0.08), 0 2px 6px -2px rgb(16 24 40 / 0.05)',
        lg: '0 12px 28px -6px rgb(16 24 40 / 0.12)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
