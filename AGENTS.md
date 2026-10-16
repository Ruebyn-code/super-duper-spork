# Project instructions

- Run relevant tests whenever adding or changing application behavior. Run `npm test` before delivering code changes.
- For interface or navigation changes, also check the affected interactions in desktop and phone browsers, including relevant permission levels.
- Use isolated temporary data for tests so existing accounts, settings and orders are preserved.

- Keep all new in-page sidebars consistent with the shared `page-sidebar-layout`, `page-sidebar`, `page-sidebar-link` and `page-sidebar-label` classes in `public/style.css`. Sidebars start as a collapsed icon rail, expand smoothly over content on hover or keyboard focus, and collapse on leaving. Keep touch menus compact; do not add a pinned-open setting. Use primary icon outlines, secondary details, and matching tinted hover/selected backgrounds.

- Keep App edit in the shared bar account dropdown (More on phones). Rearranging happens directly by holding and dragging sections/cards while edit mode is on, with automatic company-wide saving and Undo. Do not add a separate arranging menu.

- Opened Comms conversations take over the entire viewport on desktop and phones, hiding all app navigation and the mobile brand/location header. Back restores the conversation list and normal navigation.
