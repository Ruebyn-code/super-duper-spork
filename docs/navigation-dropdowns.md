# Main bar dropdown menus

On desktop and tablet (not phones, paired kiosks or App edit), main bar destinations with two or more sub-options show a small dropdown underneath:

- **Opening:** hover the link with a mouse (after a short delay), or focus the link and press ArrowDown, which opens the menu and focuses its first option.
- **Moving and closing:** ArrowUp/ArrowDown, Home and End move between options. Escape closes the menu and returns focus to the main link. Tab, clicking an option or elsewhere, scrolling, resizing and leaving the bar also close it.
- **Main links:** clicking a main link still opens its page directly.

`public/navigation-dropdowns.js` runs only in the persistent shell's parent document. `persistent-shell.js` keeps it, together with `subpage-navigation-model.js`, as a parent-only shell script. Styles are in `public/navigation-dropdowns.css`.

The options come from `subpageNavigationModel.menu(path)` and are filtered with `subpageNavigationModel.visible` and the current `appAccess.can` permissions:

| Destination | Sub-options |
|---|---|
| Ordering | the existing Ordering subpages |
| Sales | Daily sales, Hourly sales, Projections & budget, Promotions; plus Weekly overview and Weekly report with finances viewing |
| Rostering | Roster, Timesheets, Leave, Availability; plus Labour settings for managers |
| Comms | All, Company and Network posts; Direct messages; Group chats |
| Checklists | Checklists; Checklist builder for managers; History |
| Prep & labels | Labels, Prep list, Label history; plus All templates and Label settings for managers |
| Learning centre | My learning, Course library, In-store training; plus Course builder and Progress reports with permission |
| Reporting | the six topic pages |
| Admin | Users, Locations, Companies |

Labels/Prep list/Promotions options also follow the network feature switches through `features`. Options are ordinary links handled by the persistent navigation, so draft guards and every page's own permission checks still apply.

The current page is marked `aria-current`. Destinations with a dropdown get `aria-haspopup`.

Display only: opening a menu never saves, fetches or starts anything. Reduced motion removes the fade, forced colours use system colours, and printing hides the menu.

While the pointer or keyboard focus is in a dropdown, the main bar stays expanded (labels shown): `navigation.js` ignores a `pointerleave` into `#nav-dropdown` and treats focus inside it as keyboard focus, and the dropdown sends `nav-dropdown-left` when the pointer leaves it (or it closes) so the bar collapses once the pointer has left both. An invisible bridge (`::before`) covers the small gap between the bar and the menu, and the menu has no outer margin.
