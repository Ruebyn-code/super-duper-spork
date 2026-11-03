# OpStack marketing website

Responsive public marketing site, using the app's blue/mint colours and genuine isolated-demo screenshots. No analytics, external fonts, cookies, enquiry database or third-party browser scripts are included. The Intelligence section reuses the app’s locally hosted Space Grotesk font, with its OFL licence included in assets.

## Open the website

The existing app serves it at **`/website/`**, independently of sign-in. After the commit deploys to Railway, open:

https://opstack.up.railway.app/website/

The root app, sign-in and tenant pages retain their existing routes. Public website delivery uses a fixed file allowlist in `marketing-site.js`; it never resolves tenant data or arbitrary repository paths. Normal app migration mode still takes priority.

For a local standalone preview from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory website
```

Open http://127.0.0.1:8000. Only `index.html`, `styles.css`, `site.js` and `assets/` are needed for standalone static hosting. You can also publish this folder with a static hosting service and connect your chosen domain; no app credentials are needed.

## Enquiries and links

Demo buttons open an email draft addressed to **Demos@opstacktech.com**, with the subject “OpStack demo enquiry”. They do not send automatically. Existing customers can sign in at https://opstack.up.railway.app/login. If that app domain changes, update its links in `index.html`.

The page includes seven keyboard-accessible feature tabs, phone navigation, native expandable FAQs, desktop/mobile screenshot views and reduced-motion support. Product screenshots use demo records; copy does not claim customer numbers, guaranteed savings, legal compliance or unconfigured pricing.

## Checks

```sh
node --test marketing-site.test.js public-assets.test.js
```

Browser checks cover all tab states, arrow/Home/End keys, internal anchors, mailto destinations, phone menu/Escape, loaded images and overflow at 320, 390, 768, 1024 and 1440 pixels.

Run `node tools/check-marketing-site.cjs` for native-app browser verification (requires Chromium and Playwright; override `OPSTACK_PLAYWRIGHT_MODULE` or `OPSTACK_WEBSITE_PREVIEW_DIR` for local paths).
