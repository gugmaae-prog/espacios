import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/worker.js";

const workerSource = fs.readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
assert.doesNotMatch(workerSource, /aei_[A-Za-z0-9_]+/);
assert.doesNotMatch(workerSource, /aeTempInventoryUpload/);
assert.match(workerSource, /You are Espacios UAE Real Estate Intelligence AI/);
assert.doesNotMatch(workerSource, /You are PSR UAE Property Intelligence AI/);

const context = {
  waitUntil() {},
  passThroughOnException() {}
};

async function request(pathname) {
  return worker.fetch(
    new Request(`https://local.espacios.test${pathname}`),
    {},
    context
  );
}

const indexResponse = await request("/map");
assert.equal(indexResponse.status, 200);
assert.equal(indexResponse.headers.get("x-psr-map-ui"), "espacios-auditfix-v13");
assert.equal(indexResponse.headers.get("x-ae-navigation"), "20260922-auditfix-v13");
assert.equal(
  indexResponse.headers.get("x-psr-map-version"),
  "2026-09-17-edgeassets-live-v1"
);
const indexHtml = await indexResponse.text();
assert.match(indexHtml, /app-v2\.js\?v=20260922-auditfix-v13/);
assert.match(indexHtml, /app-v2\.css\?v=20260922-auditfix-v13/);
assert.match(indexHtml, /\/map\/vendor\/maplibre-gl\.mjs\?v=6\.8\.0/);
assert.match(indexHtml, /\/map\/vendor\/maplibre-gl\.css\?v=6\.8\.0/);
assert.doesNotMatch(indexHtml, /unpkg\.com\/maplibre-gl/);
assert.match(indexHtml, /ae-map-focus-mode/);
assert.match(indexHtml, /Map needs another moment/);
assert.match(indexHtml, /data-context-status/);
assert.match(indexHtml, /id="ae-premium-ui"/);
assert.match(indexHtml, /id="ae-premium-map"/);
assert.match(indexHtml, /__ESPACIOS_PAINT_MAP__/);
assert.doesNotMatch(indexHtml, /p\('ae-bg','background-color','#07121c'\)/);

const jsResponse = await request("/map/app-v2.js");
assert.equal(jsResponse.status, 200);
assert.equal(jsResponse.headers.get("x-psr-map-navfix"), "20260922-auditfix-v13");
assert.ok(Number.isFinite(Number(jsResponse.headers.get("x-psr-map-navfix-count"))));
const javascript = await jsResponse.text();
assert.ok(javascript.length > 200_000);
assert.match(javascript, /20260922-auditfix-v13/);
assert.match(javascript, /__ESPACIOS_PAINT_MAP__/);
assert.match(javascript, /from '\/map\/vendor\/maplibre-gl\.mjs\?v=6\.8\.0'/);
assert.match(javascript, /map\.keyboard\?\.disable/);
assert.match(javascript, /mapBaseReady=true/);
assert.match(javascript, /is3d:true/);
assert.match(javascript, /function sync3DForCamera/);
assert.match(javascript, /event\.ctrlKey/);
assert.match(javascript, /event\.stopImmediatePropagation/);
assert.match(javascript, /scheduleHoverFromMap/);
assert.match(javascript, /ensureContextLayers/);
assert.match(javascript, /aeNativeAddLayer/);
assert.match(javascript, /'text-font':\['Noto Sans Regular'\]/);
assert.match(javascript, /map\.getZoom\(\)>=10\.5/);
assert.doesNotMatch(javascript, /fill-extrusion-opacity':\['case'/);
assert.match(javascript, /sum&&sum\.textContent!==next/);
assert.match(javascript, /location\.hash==='#map'/);
assert.match(javascript, /location\.hash==='#map-help'/);
assert.match(javascript, /Ask Espacios AI/);
assert.doesNotMatch(javascript, /Ask PSR AI/);
assert.doesNotMatch(javascript, /'PSR PROJECT'/);
assert.match(javascript, /wasHidden&&!nowHidden/);
assert.match(javascript, /dockPersistentBound/);
assert.match(javascript, /Exterior ring only/);
assert.ok(!javascript.includes("let raf=0;map.on('mousemove'"));
assert.ok(
  !javascript.includes(
    "map.on('mousemove',e=>{const hit=psrBestGeometryAt(e.point);psrApplyNativeHover(hit)})"
  )
);
assert.match(javascript, /Spatial interaction layers are installed only after the user reaches city scale/);
assert.match(javascript, /seamless-v12: community polygon layers hydrate on load or selection/);

const cssResponse = await request("/map/app-v2.css");
assert.equal(cssResponse.status, 200);
const css = await cssResponse.text();
assert.ok(css.length > 100_000);
assert.match(css, /AE camera-only zoom guard v4/);
assert.match(css, /#map\{contain:layout paint style;overscroll-behavior:none;touch-action:none!important\}/);
assert.match(indexHtml, /@media\(max-width:760px\)/);
assert.match(indexHtml, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(indexHtml, /min-width:44px!important;min-height:44px!important/);

const vendorBody = new TextEncoder().encode("export const mapVersion = '6.8.0';");
const vendorResponse = await worker.fetch(
  new Request("https://local.espacios.test/map/vendor/maplibre-gl.mjs?v=6.8.0"),
  {
    MARKET_R2: {
      async get(key) {
        assert.equal(key, "vendor/maplibre-gl-6.8.0/maplibre-gl.mjs");
        return {
          body: vendorBody,
          httpMetadata: { contentType: "application/javascript; charset=utf-8" }
        };
      }
    }
  },
  context
);
assert.equal(vendorResponse.status, 200);
assert.equal(vendorResponse.headers.get("x-ae-vendor-cache"), "R2-HIT");
assert.equal(vendorResponse.headers.get("x-content-type-options"), "nosniff");
assert.match(await vendorResponse.text(), /mapVersion/);

const verificationResponse = await request("/map/verification.json");
assert.equal(verificationResponse.status, 200);
const verification = await verificationResponse.json();
assert.equal(verification.meta.verifiedProjects, 50);
assert.equal(verification.projects.length, 50);
assert.equal(verification.developers.length, 916);

const missingResponse = await request("/not-a-map-route");
assert.equal(missingResponse.status, 404);

const adminGetResponse = await request("/map/admin/azizi-upload-20260910");
assert.equal(adminGetResponse.status, 404);
const adminUnauthenticatedResponse = await worker.fetch(
  new Request(
    "https://local.espacios.test/map/admin/azizi-upload-20260910?key=availability/azizi/2026-09-10/test.json",
    { method: "POST", body: "{}" }
  ),
  { MARKET_R2: {} },
  context
);
assert.equal(adminUnauthenticatedResponse.status, 404);

console.log("Smoke checks passed: auditfix-v13 theme race, Espacios AI branding, exact boundary joins, footprint dedupe, mobile sheet, vendor cache, removed admin route.");
