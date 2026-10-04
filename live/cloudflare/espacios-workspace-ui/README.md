# Workspace UI preservation — 5 October 2026 (Dubai)

This directory preserves the reviewed public Workspace UI repair separately from the repository's Map application. It does not alter root build or deploy scripts. `/map` was excluded from this work.

The repair gives composite search fields a consistent theme surface, readable 16px mobile controls, larger tab/action labels and targets, useful Learn and CRM empty states, an Ops summary derived from connected process statuses, and coherent secondary navigation, search and sign-in actions for Plug and Expenses. The shared theme preference migrates existing legacy choices.

## Source ownership

The modern UI belongs to the deployed `espacios-marketing-site` Worker. Plug, Expenses and the legacy appearance code belong to `espacios-auth-central`. Their canonical first-class application sources were not located in the connected repositories or Cloudflare build configuration. These are **compiled preservation artifacts and focused integration deltas**, not a replacement application source tree. The PR stays draft so the owning source can integrate the changes without future builds reverting them.

`assets/` contains only public browser JavaScript and CSS. `styles/workspace-controls.css` is the readable additive style repair. `integration/` contains public asset metadata, focused component/UI spans, a small marketing entry patch and the generated Vite asset manifest. Full Workers, backend modules, account data, bindings, credentials and private test fixtures are deliberately absent.

## Integrating into the owning build

1. Run `npm ci` and `npm test`. `npm run build:assets` creates the public `dist/workspace-ui-assets.js` module.
2. In the owning marketing Worker, apply `integration/marketing-entry.patch` and add that generated module. Apply `integration/WorkspaceApp-ssr.patch` to the matching retained SSR UI module. The focused SSR/client span manifests document equivalent component changes and their base hashes.
3. Apply `integration/vite-rsc-assets-manifest.js` to **both** owning Vite asset manifests: `__vite_rsc_assets_manifest.js` and `ssr/__vite_rsc_assets_manifest.js`. Their bootstrap, preloads and styles must agree.
4. Apply the 16 `integration/auth-ui-spans.json` edits only to the exact matching original auth module hash, in descending byte-offset order, verifying each original span and the final patched hash. `node scripts/apply-auth-ui.mjs PRIVATE_OWNING_MODULE OUTPUT_MODULE` performs those checks and writes a separate output. These edits contain UI code only; obtain the backend module from its private owner.
5. Preserve all existing assets, Worker bindings and configuration. Do not replace an existing assets manifest with this partial graph. Deploy through the owning project workflow after reviewing the concrete integration.

The revisioned client graph uses the immutable prefix declared in `integration/asset-graph.json`. It keeps one bootstrap and router graph while sharing the existing React/framework and runtime modules. The legacy Link/router modules import the bootstrap, so revising only WorkspaceApp would leave an inconsistent client graph. Existing unrelated ASSETS remain intact.

`compatibility/20261005-ec41bb559014/` preserves the 18 earlier public assets byte for byte. The generated outlet serves both revisions (36 URLs), so tabs opened during the first repair deployment can continue loading their immutable lazy chunks. New pages use the final revision. These compatibility files contain public client/CSS content only.

The public CSS retains the captured complete base stylesheet plus the additive Workspace repair. Port the readable style changes and component behavior back to the first-class source when it becomes available; regenerate normal build hashes then.

## Verification

The local repair verification passed 546 responsive samples: 91 synthetic page/state/tab combinations across 11 modern Workspace surfaces, at 390, 615 and 1440px in light and dark themes. It also passed 44 real React browser interaction assertions and 66 focused control checks. The full captured bootstrap replay loaded one bootstrap, produced no JavaScript errors, and transitioned Learn → CRM → Research → Plans using captured RSC streams and synthetic API responses.

Run `npm run test:client` after `npx playwright install chromium`, or set `CHROMIUM_PATH` to an available Chromium binary. It mounts the exact public Learn/CRM/Ops client bodies with real React. Link/Icon and route adapters isolate the component behavior; all network requests and API operations are prohibited. This reproduction covers the 44 assertions; the larger private replay fixtures are not included here.

All account rows and role flags used in validation were synthetic. This does not certify authenticated production workflows. The fixes are deployed. Final Worker version identifiers and the frozen asset revision are recorded in `verification/live-release.json`; this directory does not itself deploy anything.

The final selected-tab replay also checked 36 selected tabs in 66 samples: minimum contrast was 6.03:1 in light and 7.69:1 in dark, with keyboard focus preserved. Six live Plug/Expenses viewport and theme cases passed search clear/focus, navigation, sign-in and appearance checks; all 63 member profile links retained their destinations.
