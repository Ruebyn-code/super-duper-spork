# Project instructions

- Run relevant tests whenever adding or changing application behavior. Run `npm test` before delivering code changes.
- For interface or navigation changes, also check the affected interactions in desktop and phone browsers, including relevant permission levels.
- Use isolated temporary data for tests so existing accounts, settings and orders are preserved.

- Keep all new in-page sidebars consistent with the shared `page-sidebar-layout`, `page-sidebar`, `page-sidebar-link` and `page-sidebar-label` classes in `public/style.css`. Sidebars start as a collapsed icon rail, expand smoothly over content on hover or keyboard focus, and collapse on leaving. Keep touch menus compact; do not add a pinned-open setting. Use primary icon outlines, secondary details, and matching tinted hover/selected backgrounds.

- The Knowledge Library category sidebar is a one-off exception: it uses an explicit collapse/expand button and remembers the choice per user/company. It must not expand on hover or keyboard focus. Other in-page sidebars keep the shared hover behavior.

- Keep App edit in the shared bar account dropdown on larger screens; hide it and suspend editing on phones. Phone bottom navigation contains Home, Rostering, Comms and More; More holds the other pages. Rearranging happens directly by holding and dragging sections/cards while edit mode is on, with automatic company-wide saving and Undo. Do not add a separate arranging menu.

- Opened Comms conversations appear beside the conversation list on desktop, keeping navigation visible. On tablets and phones they take over the viewport, hiding navigation and the mobile brand/location header until Back. Preserve the conversation and draft when resizing or rotating.

- Comms and Knowledge Library editors share the grouped Insert menu for formatting, media and callouts. Preserve structured content when sending, saving, editing and displaying required posts. Media files remain private to their uploader and the audience of the messages/posts/articles that reference them.

- Shift clock is a shared signed-in-page popup, not a navigation page. Verify a fresh staff PIN on the server before revealing each clock stage’s actions. Unlocks are session-bound, expire, and match the current shift or entry revision; after an action the keypad returns. Only show remaining required breaks and Clock out for active shifts. Identify early-start approvers automatically from a different eligible manager’s PIN, rejecting ambiguous shared PINs. Require approval for early starts on the shift’s scheduled Melbourne day. Preserve actual timestamps and approval history; never store raw PINs in API responses, browser storage or audit records. Never auto-create clock punches or end breaks from timers.

- Clock PINs derive from the last four digits of each user’s phone number. Enforce unique endings across all companies when saving a phone, preserve leading zeroes, and require phone setup before clocking. Keep phone editing under existing user-management permissions.

- Keep light and dark themes compatible. Use shared `--theme-*` colour variables with the original light value as fallback for new surfaces, borders and text. Use `appearanceStyles.themedColourValue` for rendered custom text/background colours; keep source colour pickers, logos, uploaded media and icon customisations intact. Theme preference stays per account in browser storage, available to every role through the blue account dropdown.

- Stock transfers are immutable after receiving. Require receiving-location confirmation and current company/location permissions; retries must not duplicate movements. Preserve original count snapshots and sender/receiver units. Only confirmed transfers affect usage/recommendations; cost movement is optional and must use equal debit/credit values saved at sending. Keep supplier order totals separate from net transfer costs, and preserve the Sunday-to-next-week financial rule.
