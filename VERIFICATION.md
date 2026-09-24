# Verification record

Verified locally and on production on 20 September 2026 (Asia/Dubai).

## Root cause confirmed

Chrome's renderer was pinned above one CPU core and stopped answering DevTools evaluation calls. A debugger pause captured the active JavaScript frame in the mobile-sheet summary `refresh` callback. Its `MutationObserver` watched the entire panel subtree while the callback unconditionally rewrote text inside that subtree, creating an endless microtask cycle on desktop and mobile.

The callback now writes only when its value changes. A follow-up startup profile completed normally, and the full Chrome matrix became responsive.

## Build and static checks

- `npm run assets:embed` rebuilt all six editable assets into the Worker.
- `npm run verify` passed syntax and smoke checks.
- Wrangler 4.135.0 dry run passed at **211.30 KiB upload / 125.39 KiB gzip**.
- Expected bindings were present: D1 `DB`, R2 `MARKET_R2`, service `PSR_PROPERTY`, and Workers AI `AI`.
- The temporary Azizi upload route and source credential were removed; both live GET and POST probes return `404`.
- MapLibre is same-origin and R2-first, app-added labels use the available Noto font stack, and browser acceptance reports no JavaScript exceptions, log errors, failed network requests, or HTTP errors.

## Local browser acceptance

Chrome passed the automated matrix at 1440 × 900 and 390 × 844:

- desktop pointer drag, wheel zoom, and trackpad-pinch zoom;
- mobile one-finger touch pan and two-finger pinch zoom;
- stable top-bar, rail, and card geometry during every map zoom gesture;
- automatic 54° camera pitch at city scale and a visible real-building extrusion layer at building scale;
- map focus mode, keyboard pan, navigation help, and UAE reset behavior;
- grouped project/community/developer search;
- on-demand Places and Transport hydration;
- no horizontal viewport overflow;
- 3D mode active by default while building tiles, context sources, and universal spatial layers remain absent from the initial UAE view.

The clean local run initialized **85 layers / 19 sources**, 1,364 projects, 215 communities, and 72 plans. At zoom 15.25 it rendered **375** building extrusions with the 3D control active. It reported desktop FCP at 492 ms and mobile FCP at 368 ms in that local synthetic run. These timings are run-specific browser observations, not field Core Web Vitals.

## Cloudflare release and live acceptance

- Uploaded version `105`: `add18bcb-d4ce-4a4a-8f56-44458e9d87df`.
- Deployed at 100% as `fe9e03c4-cd7c-4ffb-a958-2b23938b759a`.
- Re-read deployment and version resources after release; all four bindings and runtime settings match the previous version.
- Live response markers are `x-ae-navigation: 20260920-v4`, `x-psr-map-ui: premium-20260920-v4`, and `x-psr-map-navfix: 20260920-v4`.
- The same desktop/mobile Chrome matrix passed against `https://espacios.me/map` with no browser or HTTP errors.
- The live synthetic run observed desktop FCP at 1.264 s and mobile FCP at 784 ms; mobile CLS was 0 and desktop CLS was approximately 0.035. The live 3D check rendered 375 extrusions and the pinch checks preserved browser viewport scale and interface dimensions. These are single-run synthetic diagnostics, not field data or a formal DevTools trace.
- The 4.49 MB amenities payload is now requested only when Places/Transport is opened. Cloudflare served it with `cf-cache-status: HIT`; the Worker cache is data-center-local, so probes routed through different PoPs can each report an initial `x-ae-context-cache: MISS`.

## Remaining performance boundary

The largest remaining optimization opportunity is splitting or spatially querying the amenities payload instead of transferring the full registry after a Places/Transport request. It is no longer on the initial render path. A sustained RUM sample or formal DevTools trace should be used for long-term Core Web Vitals tracking.
