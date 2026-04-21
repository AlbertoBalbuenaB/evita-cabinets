/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Midnight Glass runs off [data-theme="midnight"], not Tailwind's default
  // `.dark` class — but we still register `darkMode: selector` so any legacy
  // `dark:` variants would hook to it if we ever need them.
  darkMode: ['selector', '[data-theme="midnight"]'],
  theme: {
    extend: {
      colors: {
        // Foreground ramp
        fg: {
          900: 'var(--fg-900)',
          800: 'var(--fg-800)',
          700: 'var(--fg-700)',
          600: 'var(--fg-600)',
          500: 'var(--fg-500)',
          400: 'var(--fg-400)',
          300: 'var(--fg-300)',
          inverse: 'var(--fg-inverse)',
        },
        // Surfaces
        surf: {
          app: 'var(--surf-app)',
          chrome: 'var(--surf-chrome)',
          rail: 'var(--surf-rail)',
          card: 'var(--surf-card)',
          projhdr: 'var(--surf-projhdr)',
          input: 'var(--surf-input)',
          btn: 'var(--surf-btn)',
          'btn-hover': 'var(--surf-btn-hover)',
          muted: 'var(--surf-muted)',
          hover: 'var(--surf-hover)',
          blue: 'var(--surf-blue)',
          indigo: 'var(--surf-indigo)',
          green: 'var(--surf-green)',
        },
        // Borders
        border: {
          hair: 'var(--border-hair)',
          soft: 'var(--border-soft)',
          solid: 'var(--border-solid)',
          input: 'var(--border-input)',
          rail: 'var(--border-rail)',
        },
        // Brand accents
        accent: {
          a: 'var(--accent-a)',
          b: 'var(--accent-b)',
          'a-hover': 'var(--accent-a-hover)',
          'b-hover': 'var(--accent-b-hover)',
          on: 'var(--accent-on)',
          text: 'var(--accent-text)',
          'tint-strong': 'var(--accent-tint-strong)',
          'tint-soft': 'var(--accent-tint-soft)',
          'tint-border': 'var(--accent-tint-border)',
          'badge-bg': 'var(--accent-badge-bg)',
          'badge-fg': 'var(--accent-badge-fg)',
        },
        // Semantic status
        status: {
          'orange-bg': 'var(--status-orange-bg)',
          'orange-fg': 'var(--status-orange-fg)',
          'orange-brd': 'var(--status-orange-brd)',
          'amber-bg': 'var(--status-amber-bg)',
          'amber-fg': 'var(--status-amber-fg)',
          'amber-brd': 'var(--status-amber-brd)',
          'emerald-bg': 'var(--status-emerald-bg)',
          'emerald-fg': 'var(--status-emerald-fg)',
          'emerald-brd': 'var(--status-emerald-brd)',
          'red-bg': 'var(--status-red-bg)',
          'red-fg': 'var(--status-red-fg)',
          'red-brd': 'var(--status-red-brd)',
          'indigo-bg': 'var(--status-indigo-bg)',
          'indigo-fg': 'var(--status-indigo-fg)',
          'indigo-brd': 'var(--status-indigo-brd)',
        },
        // Singletons
        emerald: {
          DEFAULT: 'var(--emerald)',
        },
        'red-dot': 'var(--red-dot)',
        kbd: {
          bg: 'var(--kbd-bg)',
          fg: 'var(--kbd-fg)',
        },
        seg: {
          track: 'var(--seg-track)',
          'active-bg': 'var(--seg-active-bg)',
          'active-fg': 'var(--seg-active-fg)',
        },
        sep: 'var(--sep)',
        'tab-active': 'var(--tab-active)',
        'action-bar': {
          bg: 'var(--action-bar-bg)',
          brd: 'var(--action-bar-brd)',
        },
        'rail-item-hover': 'var(--rail-item-hover)',
        'modal-backdrop': 'var(--modal-backdrop)',
        'chart-axis': 'var(--chart-axis)',
        'chart-grid': 'var(--chart-grid)',
        'chart-tooltip-bg': 'var(--chart-tooltip-bg)',
        'chart-tooltip-fg': 'var(--chart-tooltip-fg)',
        'chart-tooltip-brd': 'var(--chart-tooltip-brd)',
      },
      backgroundImage: {
        'app-gradient': 'var(--gradient-app)',
        'accent-primary': 'var(--gradient-accent-primary)',
        'accent-secondary': 'var(--gradient-accent-secondary)',
        'accent-tint-card': 'var(--accent-tint-card)',
        'login-ring': 'var(--login-ring-gradient)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-blue': 'var(--shadow-card-blue)',
        'card-green': 'var(--shadow-card-green)',
        rail: 'var(--shadow-rail)',
        btn: 'var(--shadow-btn)',
        'btn-hover': 'var(--shadow-btn-hover)',
        'seg-active': 'var(--seg-active-shadow)',
        'login-card': 'var(--login-card-shadow)',
      },
      ringColor: {
        focus: 'var(--focus-ring)',
      },
      outlineColor: {
        focus: 'var(--focus-ring)',
      },
    },
  },
  plugins: [],
};
