# Kiosk sign-in screen

A paired kiosk (`/kiosk`) shows a sign-in screen for the device's location.

## Layout

- **Welcome panel:** a gradient of the company's primary colour (lighter at the top, deeper at the bottom), with a greeting for the time of day, a large Melbourne clock, the date, the location and short tips. On tablets in portrait and on phones it shrinks to a compact band, and on phones it hides while the PIN pad is open.
- **Who's signing in?** Name tiles for everyone who can sign in at this location, with coloured initials avatars. Staff who signed in recently on this device appear first. **Search your name** filters the tiles; typing on a physical keyboard starts a search.
- **PIN pad:** tap your name, then enter your four-digit PIN on the round keypad. The dots fill as you type and it signs in automatically on the fourth digit; **Sign in** is still there. A wrong PIN shakes the dots and says so. **Not you?** goes back. Physical keyboards can type digits and use Backspace and Escape.
- **Not listed? Sign in with your PIN only** keeps the original PIN-only sign-in for anyone missing from the list. If the list can't load or is empty, the kiosk goes straight to PIN-only.
- After 45 seconds without input, the PIN pad returns to the name list and the search clears.

## Privacy and security

- `GET /api/kiosk/staff` works only for a paired device. It returns the `id` and `name` of activated accounts with a clock PIN that can access the device's location. It never returns phone numbers, PINs, photos, roles or other locations' staff, and it is `no-store`.
- When a name is chosen, the unlock request includes that `userId` and the server only accepts the PIN if it belongs to that person. Choosing a name never grants access by itself. PIN rate limits, location access checks and the two-minute idle lock are unchanged.
- Recent names are kept per device in browser storage as account IDs only, never PINs or session tokens.
- Pairing works as before, restyled to match.
