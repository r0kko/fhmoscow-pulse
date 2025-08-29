# UI/UX Guidelines — Spacing, Tabs, and Tiles

These are the project-wide recommendations to keep UI consistent and maintainable. Follow them for all new views and while refactoring existing ones.

## Spacing

- Base spacing: use Bootstrap utilities (`mb-2`, `p-3`, `gap-2`, etc.).
- Tile rows: prefer `gap: 0.75rem` (use `gap-3` where utilities apply).
- Section cards: use `.section-card` globally (rounded, no per-view overrides). Avoid redefining padding/margins per view unless there is a clear exception.
- Mobile full-bleed: only where it improves readability (e.g., home sections), use local full-bleed margins; keep inner padding per `.section-card .card-body`.

## Tabs (tab selectors)

- Use `components/TabSelector.vue` to render tabs with `v-model` on the active key.
- Structure: internally uses Bootstrap `nav nav-pills` with `.tab-selector` and horizontal scroll.
- Spacing: `gap: 0.5rem` and `border-radius: 0.5rem` for links are global in `brand.css`.
- Don’t redefine `.tab-selector` per view; for variants pass `justify`/`navFill` props to `TabSelector`.
- Long labels: rely on `white-space: nowrap`; shorten labels rather than wrapping.

## Tiles (menu and content tiles)

- Use the shared wrapper `components/BaseTile.vue` to render any tile or section card with link/inert behavior and ARIA semantics.
- For home menu tiles, use `MenuTile.vue` (built on top of `BaseTile`).
- Visuals: rely on `.menu-card` and `.section-card` in `brand.css` for size, padding, icon placement, and consistent shadows/border radii. Cards use subtle borders to delineate surfaces.
- Accessibility: tiles with links must set `aria-label`; inert/placeholder tiles set `aria-disabled` and reduce opacity.
- Hover/focus: interactive hover lift is disabled globally; keep focus-visible rings intact.

### Design Tokens (brand.css)

Use CSS variables instead of hard-coded values:

- `--radius-section`: 1rem — section cards.
- `--radius-tile`: 0.75rem — tiles/cards.
- `--radius-sm`: 0.5rem — small pills/badges.
- `--radius-xs`: 0.375rem — micro badges.
- `--shadow-tile`: soft brand shadow for tiles/sections.
- `--border-subtle`: neutral outline for card borders.
- `--section-padding`: 1rem; `--tile-padding`: 0.75rem.

Examples:

```
.card.section-card { border-radius: var(--radius-section); }
.card.tile { border-radius: var(--radius-tile); box-shadow: var(--shadow-tile); border: 1px solid var(--border-subtle); }
.file-tile { border-radius: var(--radius-tile); box-shadow: var(--shadow-tile); border: 1px solid var(--border-subtle); }
```

Per-page overrides: you may locally adjust elevation/border by overriding variables on a container, e.g. Home page with reduced shadow and slightly stronger borders:

```
.home-page {
  --shadow-tile: 0 1px 2px rgba(17, 56, 103, 0.03), 0 2px 4px rgba(17, 56, 103, 0.05);
  --border-subtle: #dfe5ec;
}
```

Example:

```
<TabSelector
  v-model="activeTab"
  :tabs="[
    { key: 'list', label: 'Список' },
    { key: 'arch', label: 'Архив' },
  ]"
  justify="between"
/>
```

## Reuse and Styling Rules

- Do not copy-paste `.section-card` or `.tab-selector` CSS into views. Keep them in `brand.css`.
- Avoid using Bootstrap `shadow-*` utilities on tiles/sections — their effect is neutralized for consistency. Prefer token-based elevation via `--shadow-tile`.
- Prefer composition of small components (e.g., `MenuTile.vue`) for repeated patterns.
- Keep view-level CSS minimal and scoped to true view-specific needs.

## Edge Scrolling

- Horizontal scrollers: use `.scroll-container` and `v-edge-fade` to expose overflow affordances.
- Avoid custom overflow styles unless a layout is truly unique.

## Accessibility

- Always set `aria-label` on interactive tiles and actions with icons only.
- Preserve the visible focus ring (`:focus-visible`) and do not override it.
- Ensure lists and grouped items have appropriate roles when they behave like tables or lists.
