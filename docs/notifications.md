# Notifications

A bell sits on the right of the blue account control (joined to search) in the persistent header on every signed-in page (desktop, tablet and
phone, including unlocked kiosks). Its red badge shows unread notifications (capped at 9+). The
panel lists notifications for the signed-in account and the **selected location**, with All/Unread
tabs, **Mark all as read**, per-type settings and optional **Desktop alerts**.

## How it works

`notifications.js` builds a read-only feed from existing, permission-checked readers each time it
is requested (on load, every 60 seconds while visible, on focus and when the panel opens). Each
source runs with the session's own permissions and fails independently; a failing source is named
in the panel without hiding the others. Viewing the feed never writes, starts, completes,
approves or acknowledges anything.

| Type | Source (existing reader) | Shown to | Notification |
| --- | --- | --- | --- |
| Messages | Comms Home inbox | `comms.view` | Unread direct/group messages |
| Posts | Comms Home inbox | `comms.view` | Unread posts; required posts are high priority |
| Training | Home personal work | `learning.view` + complete/sign-off | Assigned/overdue courses, in-store training, trainer sign-offs |
| Agreements | Employment documents | Rostering feature on | Agreements waiting for signature |
| Timesheets | Pending approvals | `rostering.approve` | Timesheets to approve per location |
| Roster | `rostering.notificationFeed` | `rostering.view` | Own published roster weeks (next 14 days) and today's shifts |
| Leave | `rostering.notificationFeed` | `rostering.leave` / `rostering.leave.approve` | Own approved/declined requests (30 days); requests to review (confidential leave needs its permission) |
| Checklists | Ops management active list | `ops.view` + `ops.complete` | Checklists open now at this location; "due soon" within 30 min or the planner reminder |
| Equipment | Equipment register | `equipment.manage` | Open problems; services overdue or due within 14 days |
| Stock transfers | Home pending transfers | Assigned receiving managers | Incoming transfers to receive |
| Daily sales | Home daily sales window | `home.view` + `sales.edit`, Store dashboards | Today's sales entry not yet saved |
| Reports | Scheduled AI report inbox | Report recipients | New delivered reports |

Notification IDs include the version of the underlying item (for example a post's `updatedAt` or a
problem's ID), so changes notify again while unchanged items stay read. Items disappear once the
work is done. Switched-off network features remove their permissions, so their notifications stop
automatically.

## Writes and privacy

- `POST /api/notifications/read` (`{ids}` up to 200, or `{all:true}`) and
  `PUT /api/notifications/preferences` (`{muted:[types]}`) require CSRF. Only IDs currently in the
  account's feed are stored.
- State lives in the network's private `notification-state.json` (0600), keyed by account: read
  markers (newest 3,000 kept) and muted types. Preferences never affect other accounts or features.
- Desktop alerts use the browser Notification API after explicit permission; the on/off choice is
  stored in that browser only, and alerts appear only while OpStack is open in a hidden tab.

Tests: `notifications.test.js`. Help guide: `notifications`.
