# Espacios public shell

This module preserves the verified public-shell source serving the main Espacios website. PR #15 first published a snapshot at this path; this copy includes the public audit fixes already deployed on 4 October 2026 UTC.

Parity was checked on 5 October 2026 (Dubai) against Cloudflare Worker `espacios-public-shell`, version `b390e4fe-bae4-4ead-9e5b-d5192c7e7132` at 100% traffic. The deployed module is 29,808 bytes with SHA-256 `604d8b4649298465fb698fedf419b269a93dffcf2358e1746773cd652d55e419`.

The shell calls the existing `MARKETING` and `SEO` service bindings. It contains public presentation logic and requires no embedded credentials. Root Map build scripts and Wrangler configurations do not build or deploy this module. A separate owning deployment configuration must preserve those bindings and existing routes before any future shell release.

The public audit changes validate and focus proposal steps, keep hidden submission controls hidden, restore the saved appearance before rendering and after hydration, set mobile login/proposal fields to 16px, and balance the collapsed Workspace preview at four/two/one columns. Existing public navigation and home-card links to Map are retained; no Map application source is modified or exercised by this test.

## Check the shell

```sh
cd live/cloudflare/espacios-public-shell
npm ci
npm run check
npx playwright install chromium
npm test
```

For an installed Chromium, use `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm test`. Every browser request is fulfilled locally with fixtures. Tests do not contact the website or submit forms. The nested package keeps its browser tooling independent of the Map package.

## Source coverage

This addition preserves one public Worker, not the complete website. Source for `espacios-marketing-site`, `espacios-auth-central`, `espacios-newsroom` and `espacios-logos-shell` is still unestablished. Their focused production fixes remain live and their private local source backups/patches remain in the audit handoff. Carry those fixes into their owning source before rebuilding them. Private authentication bundles and customer data must not be added to this public repository.

H&G developer and brochure source fixes are separately recorded in `gugmaae-prog/hausandgrace` PR #6. Final legal details, two unresolved developer identities and twelve unavailable source brochure documents remain pending. This source snapshot introduces no deployment or data migration.
