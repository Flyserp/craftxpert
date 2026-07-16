# Category Mega Menu — UI Regression Checklist

Quick manual pass to run after any change to `src/components/header/CategoryMegaMenu.tsx`, `UnifiedHeader.tsx`, or category data.

## Desktop (≥1200px)

- [ ] "Categories" trigger visible in header next to the logo.
- [ ] Hover/click opens the mega menu panel below the header (z-index above page content, not clipped).
- [ ] Left column lists all top-level categories with icons; active category is highlighted.
- [ ] Right column shows subcategories for the hovered/selected category in a multi-column grid.
- [ ] Each subcategory row is clickable and routes to `/browse?category=…&subcategory=…`.
- [ ] "View all {category}" link routes to the category page.
- [ ] **No "Popular Services" / "Popular" quick-access strip is rendered** (removed).
- [ ] No `TrendingUp` icon or featured-picks chips appear anywhere in the panel.
- [ ] Menu closes on outside click, Escape, and route change.
- [ ] Keyboard: Tab moves through categories, Enter activates, focus ring visible.
- [ ] Dark mode: background, borders, hover states use HSL tokens (no white flashes).

## Tablet (768–1199px)

- [ ] Mega menu trigger is hidden; compact menu dropdown (hamburger-ish) is used instead.
- [ ] Compact dropdown lists Home / Browse Services / Browse Tasks / role-specific links.
- [ ] No "Popular Services" section appears in the compact dropdown.

## Mobile (<768px)

- [ ] Hamburger opens the full-height drawer.
- [ ] `MobileCategoryAccordion` renders inside the drawer with all top-level categories.
- [ ] Expanding a category reveals its subcategories with the bullet indicator.
- [ ] "View all {category}" link at the bottom of each expanded group works.
- [ ] **No "Popular" strip, chips, or `TrendingUp` icon are visible** at the bottom of the accordion.
- [ ] Tapping a subcategory closes the drawer and navigates correctly.
- [ ] Drawer scroll works; header + search remain sticky at top.
- [ ] Theme toggle inside drawer flips light/dark without layout shift.

## Cross-cutting

- [ ] `rg -n "Popular" src/components/header/` returns no matches.
- [ ] Typecheck passes (`tsgo`).
- [ ] No console errors on open/close in either viewport.
- [ ] Analytics/onCategorySelect callbacks fire once per selection (no duplicates).
