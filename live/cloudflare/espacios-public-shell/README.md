# Espacios public shell

This module preserves the verified public-shell source serving the main Espacios website. PR #15 first published a snapshot at this path; this copy includes the public audit and shared focus styling fixes deployed by 5 October 2026 (Dubai).

Final parity was checked against Cloudflare Worker `espacios-public-shell`, version `100f0ffc-2569-45cf-90dd-0cdc659d1afe`. The module is 35,423 bytes with SHA-256 `e4ffe69f19f41b2c37fb482009e935068da0791019e982bdd16695c30729317b`. Exact release and stylesheet/script hashes are recorded in `seamless-release.json`.

The shell calls the existing `MARKETING` and `SEO` service bindings. It contains public presentation logic and requires no embedded credentials. Root Map build scripts and Wrangler configurations do not build or deploy this module. A separate owning deployment configuration must preserve those bindings and existing routes before any future shell release.

The public audit changes validate and focus proposal steps, keep hidden submission controls hidden, restore the saved appearance before rendering and after hydration, set mobile login/proposal fields to 16px, and balance the collapsed Workspace preview at four/two/one columns. Existing public navigation and home-card links to Map are retained; no Map application source is modified or exercised by this test.

The control pass removes purple focus frames and nested composite outlines on public forms and buttons. Pointer interactions stay quiet; keyboard focus uses a neutral indicator and validation errors remain visible. `public-seamless.css` and `input-modality.js` preserve the readable sources used by the inline Worker markup. CSS injection and input modality initialization exclude `/map`. A shared installation guard reuses the listeners when the modern bootstrap initializes, and an attribute observer restores the current modality after hydration. The owning marketing Worker's legacy HTML responses use the same public policy through the source-preservation package in PR #26.

## Check the shell

```sh
cd live/cloudflare/espacios-public-shell
npm ci
npm run check
npx playwright install chromium
npm test
```

For an installed Chromium, use `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm test`. Both browser drivers run. The focus driver checks 23 assertions for CSS/script byte parity, pointer and keyboard states, a single composite indicator, validation styling the Map script guard, hydration attribute repair and initialization deduplication. Every browser request is fulfilled locally with fixtures. Tests do not contact the website or submit forms. The nested package keeps its browser tooling independent of the Map package.

## Source coverage

This addition preserves one public Worker, not the complete website. Source for `espacios-marketing-site`, `espacios-auth-central`, `espacios-newsroom` and `espacios-logos-shell` is still unestablished. Their focused production fixes remain live and their private local source backups/patches remain in the audit handoff. Carry those fixes into their owning source before rebuilding them. Private authentication bundles and customer data must not be added to this public repository.

H&G developer and brochure source fixes are separately recorded in `gugmaae-prog/hausandgrace` PR #6. Final legal details, two unresolved developer identities and twelve unavailable source brochure documents remain pending. This source snapshot introduces no deployment or data migration.
