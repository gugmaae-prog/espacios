# Workspace UI preservation — 5 October 2026 (Dubai)

This directory preserves the reviewed public Workspace UI repair separately from the repository's Map application. It does not alter root build or deploy scripts. `/map` was excluded from this work.

The repair gives composite search fields a consistent theme surface, readable 16px mobile controls, larger tab/action labels and targets, useful Learn and CRM empty states, an Ops summary derived from connected process statuses, and coherent secondary navigation, search and sign-in actions for Plug and Expenses. The shared theme preference migrates existing legacy choices.

The final control pass removes purple focus frames and nested outlines from the Aether composer, searches, text fields and buttons. Composite controls use one surface; pointer interactions remain quiet, keyboard focus uses a neutral indicator, and validation error styling stays visible. Readable `styles/public-seamless.css` and `styles/input-modality.js` are shared with the public shell. `integration/seamless-controls.js` adds them to the owning marketing Worker's legacy HTML responses, including routes that bypass the public shell. The same initializer is prepended to the revisioned modern bootstrap so direct Workspace routes install it; a shared global guard prevents duplicate listeners and a narrowly filtered observer restores the current modality attribute after hydration.

## Source ownership

The modern UI belongs to the deployed `espacios-marketing-site` Worker. Plug, Expenses and the legacy appearance code belong to `espacios-auth-central`. Their canonical first-class application sources were not located in the connected repositories or Cloudflare build configuration. These are **compiled preservation artifacts and focused integration deltas**, not a replacement application source tree. The PR stays draft so the owning source can integrate the changes without future builds reverting them.

`assets/` contains only public browser JavaScript and CSS. `styles/workspace-controls.css` is the readable additive style repair. `integration/` contains public asset metadata, focused component/UI spans, a small marketing entry patch and the generated Vite asset manifest. Full Workers, backend modules, account data, bindings, credentials and private test fixtures are deliberately absent.

## Integrating into the owning build

1. Run `npm ci` and `npm test`. `npm run build:assets` creates the public `dist/workspace-ui-assets.js` module.
2. In the owning marketing Worker, apply `integration/marketing-entry.patch` and add the generated asset module plus `integration/seamless-controls.js`. Apply `integration/WorkspaceApp-ssr.patch` to the matching retained SSR UI module. The focused SSR/client span manifests document equivalent component changes and their base hashes.
3. Apply `integration/vite-rsc-assets-manifest.js` to **both** owning Vite asset manifests: `__vite_rsc_assets_manifest.js` and `ssr/__vite_rsc_assets_manifest.js`. Their bootstrap, preloads and styles must agree.
4. Apply the 16 `integration/auth-ui-spans.json` edits only to the exact matching original auth module hash, in descending byte-offset order, verifying each original span and the final patched hash. `node scripts/apply-auth-ui.mjs PRIVATE_OWNING_MODULE OUTPUT_MODULE` performs those checks and writes a separate output. These edits contain UI code only; obtain the backend module from its private owner.
5. Preserve all existing assets, Worker bindings and configuration. Do not replace an existing assets manifest with this partial graph. Deploy through the owning project workflow after reviewing the concrete integration.

The revisioned client graph uses the immutable prefix declared in `integration/asset-graph.json`. It keeps one bootstrap and router graph while sharing the existing React/framework and runtime modules. The legacy Link/router modules import the bootstrap, so revising only WorkspaceApp would leave an inconsistent client graph. Existing unrelated ASSETS remain intact.

`compatibility/` preserves the four earlier 18-asset revisions byte for byte. The generated outlet serves all five revisions (90 URLs), so already-open tabs can continue loading their immutable lazy chunks. New pages use the final revision. These compatibility files contain public client/CSS content only.

The public CSS retains the captured complete base stylesheet, followed by the readable Workspace controls and shared public controls policy. This also covers floating assistant and header controls outside the workspace container. Port the readable style changes and component behavior back to the first-class source when it becomes available; regenerate normal build hashes then.

## Verification

The local repair verification passed 546 responsive samples: 91 synthetic page/state/tab combinations across 11 modern Workspace surfaces, at 390, 615 and 1440px in light and dark themes. It also passed 44 real React browser interaction assertions and 66 focused control checks. The full captured bootstrap replay loaded one bootstrap, produced no JavaScript errors, and transitioned Learn → CRM → Research → Plans using captured RSC streams and synthetic API responses.

Run `npm run test:client` after `npx playwright install chromium`, or set `CHROMIUM_PATH` to an available Chromium binary. It mounts the exact public Learn/CRM/Ops client bodies with real React. Link/Icon and route adapters isolate the component behavior; all network requests and API operations are prohibited. This reproduction covers the 44 assertions; the larger private replay fixtures are not included here.

All account rows and role flags used in validation were synthetic. This does not certify authenticated production workflows. The fixes are deployed. Final Worker version identifiers and the frozen asset revision are recorded in `verification/live-release.json`; this directory does not itself deploy anything.

The final selected-tab replay also checked 36 selected tabs in 66 samples: minimum contrast was 6.03:1 in light and 7.69:1 in dark, with keyboard focus preserved. Six live Plug/Expenses viewport and theme cases passed search clear/focus, navigation, sign-in and appearance checks; all 63 member profile links retained their destinations.

The seamless control pass adds 1,070 modern focus assertions across 168 samples, 338 public focus assertions across 108 samples, 35 browser editing/read-only assertions, and 18 read-only legacy cases. Themes and 390/615/1440px viewports are covered. The full focus matrices used the initial modality listener; final script repeats passed 358 modern and 114 public assertions at 615px, with 11 additional hydration/idempotence assertions. CSS and geometry stayed fixed. The public shell's nested package in draft PR #25 also checks CSS/script byte parity, pointer versus keyboard focus, one composite indicator, validation styling and the Map guard. `integration/public-shell-controls.patch` records its focused public source delta; the full public shell source stays in its owning package.
