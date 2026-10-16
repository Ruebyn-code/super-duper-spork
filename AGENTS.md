# Project instructions

- Run relevant tests whenever adding or changing application behavior. Run `npm test` before delivering code changes.
- For interface or navigation changes, also check the affected interactions in desktop and phone browsers, including relevant permission levels.
- Use isolated temporary data for tests so existing accounts, settings and orders are preserved.

- Keep all new in-page sidebars consistent with the shared `page-sidebar-layout`, `page-sidebar`, `page-sidebar-link` and `page-sidebar-label` classes in `public/style.css`. Sidebars start as a collapsed icon rail, expand smoothly over content on hover or keyboard focus, and collapse on leaving. Keep touch menus compact; do not add a pinned-open setting. Use primary icon outlines, secondary details, and matching tinted hover/selected backgrounds.
