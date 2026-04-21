# Midnight Glass — Design Tokens

Source of truth for the token system that drives both Light and Midnight themes.
Tokens live in `src/index.css` on `:root` / `[data-theme="light"]` / `[data-theme="midnight"]`
and are exposed to components through Tailwind's `theme.extend.colors` (see
`tailwind.config.js`).

## How themes work

- `<html>` carries a `data-theme` attribute whose value is `"light"` or `"midnight"`.
- An inline script at the top of `index.html` resolves the attribute **before any
  CSS loads**, so reloads don't flash.
- `useTheme()` (`src/hooks/useTheme.ts`) reads user preference from
  `localStorage` key `evita:theme` (values: `light | midnight | system`) and
  syncs `data-theme` on every change. It subscribes to
  `(prefers-color-scheme: dark)` and re-resolves when the OS preference flips,
  but only while the user has picked `system`.
- `<ThemeToggle />` renders a sun / moon / monitor segmented radiogroup with
  arrow-key navigation. Lives in the Topbar and mirrors in the user menu.

## How to use tokens in components

**Do** use the Tailwind aliases that reference the vars:

```tsx
<div className="bg-surf-card text-fg-900 border border-border-soft shadow-card">
```

**Don't** hardcode colors — not even "just this once":

```tsx
// ❌ bg-white, text-slate-900 break the theme
<div className="bg-white text-slate-900 border-slate-200 shadow-sm">
```

**Don't** use Tailwind's `dark:` variant. We drive themes from `[data-theme]`,
not `.dark`. A `dark:` class won't fire.

## Token groups

### Foreground
| Token | Purpose |
|-------|---------|
| `--fg-900` → `text-fg-900` | Headings, primary text |
| `--fg-800` → `text-fg-800` | Subheadings |
| `--fg-700` → `text-fg-700` | Body copy |
| `--fg-600` → `text-fg-600` | Secondary body |
| `--fg-500` → `text-fg-500` | Metadata, captions |
| `--fg-400` → `text-fg-400` | Muted / disabled |
| `--fg-300` → `text-fg-300` | Divider text |
| `--fg-inverse` → `text-fg-inverse` | Text on accent backgrounds |

### Surfaces
| Token | Purpose |
|-------|---------|
| `--surf-app` → `bg-surf-app` | Solid fallback (body before gradient) |
| `--surf-chrome` → `bg-surf-chrome` | Topbar |
| `--surf-rail` → `bg-surf-rail` | Sidebar |
| `--surf-card` → `bg-surf-card` | Cards, panels, modals |
| `--surf-projhdr` → `bg-surf-projhdr` | Sticky project header |
| `--surf-input` → `bg-surf-input` | Form inputs |
| `--surf-btn` → `bg-surf-btn` | Secondary/ghost buttons |
| `--surf-btn-hover` → `bg-surf-btn-hover` | Hover fill for the above |
| `--surf-muted` → `bg-surf-muted` | Disabled inputs, subtle panels |
| `--surf-hover` → `hover:bg-surf-hover` | Row/item hover fill |
| `--surf-blue` / `--surf-indigo` / `--surf-green` | Tinted glass panels |

The gradient background is `bg-app-gradient` (reads `--gradient-app`).

### Borders
| Token | Purpose |
|-------|---------|
| `border-border-hair` | Topbar bottom border |
| `border-border-soft` | Dividers, row separators |
| `border-border-solid` | Solid outlines |
| `border-border-input` | Form input borders |
| `border-border-rail` | Sidebar border |

### Accents
| Token | Purpose |
|-------|---------|
| `bg-accent-a` / `bg-accent-b` | Primary brand (Light: indigo-500/blue-500; Midnight: indigo-400/blue-400) |
| `text-accent-text` | Accent link / active nav text |
| `bg-accent-tint-strong` / `bg-accent-tint-soft` | Accent fills at 22%/14% (midnight) |
| `bg-accent-primary` | Gradient (use as `bg-[image:var(--gradient-accent-primary)]` when combining with other classes) |
| `bg-accent-badge-bg` / `text-accent-badge-fg` | Sidebar count badges |

### Status chips
Each status has a `bg`, `fg`, and `brd` token:

- `status-orange-*` — Estimating
- `status-amber-*` — Stale, warnings
- `status-emerald-*` — Success, approvals
- `status-red-*` — Danger, errors
- `status-indigo-*` — Custom, neutral-accent

Example:
```tsx
<span className="bg-status-orange-bg text-status-orange-fg border border-status-orange-brd">
  Estimating
</span>
```

When migration encounters a status outside these five (Won/Lost/Archived/Sent/...),
add a new `--status-{name}-bg/fg/brd` triple for **both themes** in `index.css`
before migrating the JSX.

### Chrome misc
| Token | Purpose |
|-------|---------|
| `bg-kbd-bg` / `text-kbd-fg` | Keyboard shortcut chips |
| `bg-seg-track`, `bg-seg-active-bg`, `text-seg-active-fg`, `shadow-seg-active` | Segmented controls (tabs, theme toggle) |
| `bg-sep` | Vertical separators |
| `text-tab-active` | Active tab label color |
| `bg-action-bar-bg` / `border-action-bar-brd` | Floating action bars |
| `hover:bg-rail-item-hover` | Sidebar item hover |

### Shadows
| Token | Purpose |
|-------|---------|
| `shadow-card` | Default card lift |
| `shadow-card-blue` / `shadow-card-green` | Tinted glass variants |
| `shadow-rail` | Sidebar rail shadow |
| `shadow-btn` / `shadow-btn-hover` | Primary button lift |
| `shadow-seg-active` | Active segmented cell |
| `shadow-login-card` | Login card lift |

### Focus
`ring-focus` / `outline-focus` read `--focus-ring` which adapts per theme.
Use `ring-2 ring-focus ring-offset-2 ring-offset-surf-card` for standard
keyboard focus indicators.

### Logo
The sidebar logo uses `filter: var(--logo-filter)`. Light tints it indigo;
Midnight inverts to white. No theme-specific image swap needed — this is
the reason the logo works as a single PNG.

### TipTap / prose
Mentions, placeholder, headings, links — all tokenized. No component edits
needed; styles live in `src/index.css` under `.ProseMirror` and
`.bitacora-content`.

### Charts
Material fills stay theme-agnostic (real cabinet material colors are ground
truth regardless of UI mode). Axis/grid/tooltip are tokenized:
- `stroke-chart-axis` / `fill-chart-axis` (or pass `--chart-axis` via inline
  style to SVG elements)
- `stroke-chart-grid`
- `bg-chart-tooltip-bg text-chart-tooltip-fg border border-chart-tooltip-brd`

### Login
The login page uses dedicated tokens so the animated gradient orbs re-tone
in Midnight without blowing out: `--login-orb-a/b/c/d`, `--gradient-login`,
`--login-card-bg`, `--login-ring-gradient`, `--login-card-shadow`.

## Print

`@media print` in `src/index.css` overrides **all** tokens to Light values
regardless of the active theme, so quotations never print on dark paper.
You do not need to guard components against Midnight-on-print.

## Adding a new token

1. Add the `--var` in `src/index.css` under **both** `:root/[data-theme="light"]`
   **and** `[data-theme="midnight"]`.
2. Also set it in the `@media print` override block if the component can appear
   in printed output.
3. If components need a Tailwind class, register it in `tailwind.config.js`
   under `theme.extend.colors` (or `backgroundImage` / `boxShadow` / etc.).
4. Document the token here.

## Reference artifact

The canonical visual reference is the HTML mock
`V5 Quotation - Option B (Dark).html` (delivered by Claude Design in the
original issue). Its `[data-theme="midnight"]` block in the `<style>` matches
this repo's palette byte-for-byte. When added to the repo it lives at
`docs/design/midnight-glass.html`.
