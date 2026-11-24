# Category and feature icons

OpStack has one shared, allowlisted icon set (`public/category-icons.js` plus the generated Lucide set in
`public/category-icons-library.js`, 1,030 icons). Records only ever save an icon **ID**; the server checks it with
`categoryIcons.valid` and rejects anything else (400). Pages that show or choose icons load
`/category-icons.css`, `/category-icons-library.js` and `/category-icons.js`.

`categoryIcons.pick({current,title,onPick})` opens the searchable picker (group jump chips, multi-word search, arrow
keys, Escape, **No icon**). `categoryIcons.button({current,label,onPick})` is the small square button editors use: it
shows the current icon (dashed square when none), opens the picker and only updates the draft — saving always goes
through the feature's own existing save.

Unless noted, an omitted `icon` keeps the saved one (older writers) and `null` removes it.

| Where | Saved as | Chosen in | Shown on |
| --- | --- | --- | --- |
| Knowledge centre categories | category `icon` | Manage categories | category side bar, picture-less article cards |
| Prep & labels categories | company `categoryIcons` map (`PUT /api/prep-labels/category-icon`) | label editor, Choose icon | side bar, card category pills |
| Stock count groups | `countGroups[].icon` (`PUT /api/products/count-groups`) | Stock count → Edit groups | count and saved-count group headings |
| Prep stations | per-location `stationIcons` map (`PUT /api/prep-list/station-icon`, `prep.manage`, revision-checked) | square button in each station heading | station chips and headings, Home Today's prep card |
| Checklists | template `icon`, frozen into run snapshots | builder, button in front of the name | Active cards, builder library, History |
| Courses | draft `icon`, frozen into published versions | Course settings | course library cards, My learning |
| Training checklists | template `icon` | training checklist builder | training checklist library |
| Comms groups | thread `icon` (groups and store groups only; direct chats 400) | ⋯ → Customise group | conversation header and lists when the group has no photo |
| Equipment | list/one-off item `icon`; ticked location copies show the list item's icon | equipment editor | equipment cards |
| Promotions | promotion `icon` | promotion editor | promotion cards, Home Promotions panel |
| Home quick links | quick-links section `linkIcons` `{linkId: icon}` (keys for removed links are dropped) | Edit Home → Quick links chips | Quick links (replacing the built-in icon) |
| Wastage reasons | fixed per reason in `public/wastage-model.js` (display only, not editable) | — | reason chips |

Built-in stock count areas start with default icons (Cool Room → fridge, Freezer → snowflake, Packaging → package,
Chemical → spray can, Dry → wheat). Saved lists that kept a built-in area without an icon setting show its default;
removing it stores `icon: null` for that area so it stays removed.

Icons are display only: reads never write, and icons are never printed on labels or sent to intelligence.
