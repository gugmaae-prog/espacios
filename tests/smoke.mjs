import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.caches ??= { default: { async match() { return null; }, async put() {} } };
const workerUrl = new URL(process.env.ESPACIOS_TEST_WORKER_MODULE || "../src/worker.js", import.meta.url);
const { default: worker } = await import(workerUrl.href);
const workerSource = fs.readFileSync(workerUrl, "utf8");
const frontendExtension = fs.readFileSync(new URL('../src/mobile-map/worker-extension.js', import.meta.url), 'utf8');
const frontendRelease = /var MM_RELEASE\s*=\s*['"]([^'"]+)['"]/.exec(frontendExtension)?.[1];
assert.ok(frontendRelease, 'Frontend wrapper declares its release');
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
    new Request(`https://espacios.me${pathname}`),
    {},
    context
  );
}

const indexResponse = await request("/map");
assert.equal(indexResponse.status, 200);
assert.equal(indexResponse.headers.get("x-psr-map-ui"), "espacios-research-v1");
const navigationRelease = indexResponse.headers.get("x-ae-navigation");
assert.ok(navigationRelease, "The map identifies its navigation release");
assert.equal(navigationRelease, frontendRelease);
assert.equal(indexResponse.headers.get('x-espacios-mobile'), frontendRelease);
assert.equal(indexResponse.headers.get("x-espacios-system"), "20260930-system-map-v1");
assert.equal(
  indexResponse.headers.get("x-psr-map-version"),
  "2026-09-17-edgeassets-live-v1"
);
const indexHtml = await indexResponse.text();
assert.ok(indexHtml.includes(`app-v2.js?v=${navigationRelease}`));
assert.ok(indexHtml.includes(`app-v2.css?v=${navigationRelease}`));
assert.match(indexHtml, /\/map\/vendor\/maplibre-gl\.mjs\?v=6\.8\.0/);
assert.match(indexHtml, /\/map\/vendor\/maplibre-gl\.css\?v=6\.8\.0/);
assert.doesNotMatch(indexHtml, /unpkg\.com\/maplibre-gl/);
assert.match(indexHtml, /ae-map-focus-mode/);
assert.match(indexHtml, /Map needs another moment/);
assert.match(indexHtml, /data-context-status/);
assert.match(indexHtml, /id="ae-premium-ui"/);
assert.match(indexHtml, /id="ae-premium-map"/);
assert.match(indexHtml, /map-seamless-v1|map-seamless-style|--eg-theme-canvas:#edf1f4/);
assert.doesNotMatch(indexHtml, /Timeline is taking longer to load/);
assert.match(indexHtml, /__ESPACIOS_PAINT_MAP__/);
assert.match(indexHtml, /map\.getCanvas\?\.\(\)&&map\.getStyle\?\.\(\)\?\.layers\?\.length\)clearRecovery\(\)/);
assert.doesNotMatch(indexHtml, /p\('ae-bg','background-color','#07121c'\)/);

const jsResponse = await request("/map/app-v2.js");
assert.equal(jsResponse.status, 200);
assert.equal(jsResponse.headers.get("x-psr-map-navfix"), navigationRelease);
assert.ok(Number.isFinite(Number(jsResponse.headers.get("x-psr-map-navfix-count"))));
const javascript = await jsResponse.text();
assert.ok(javascript.length > 200_000);
assert.ok(javascript.includes(navigationRelease));
assert.match(javascript, /window\.EspaciosUnifiedMap=Object\.freeze/);
assert.match(javascript, /window\.EspaciosSearchFocus = Object\.freeze/);
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
assert.match(javascript, /Timeline layer could not finish loading/);
assert.match(javascript, /Retry timeline/);
assert.match(javascript, /reviewed snapshot projects across seven emirates/);
assert.match(javascript, /Number\(counts\.unmappedProjects\?\?0\)/);
assert.doesNotMatch(javascript, /Number\(counts\.unmappedProjects\|\|45\)/);
assert.match(javascript, /if\(aeUaeState\.installed\|\|!tlState\?\.ready\|\|!drState\?\.installed\|\|!tlQ\('#tl-dock'\)\)return false/);
assert.doesNotMatch(javascript, /aeUaeState\.installed\|\|!tlState\?\.ready\|\|!drState\?\.installed\|\|!bhState\?\.installed/);

const cssResponse = await request("/map/app-v2.css");
assert.equal(cssResponse.status, 200);
const css = await cssResponse.text();
assert.equal(cssResponse.headers.get('x-espacios-mobile'), frontendRelease);
assert.ok(css.length > 100_000);
assert.match(css, /AE camera-only zoom guard v4/);
assert.match(css, /#map\{contain:layout paint style;overscroll-behavior:none;touch-action:none!important\}/);
assert.match(indexHtml, /@media\(max-width:760px\)/);
assert.match(indexHtml, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(indexHtml, /\.ae-map-recovery\{background:var\(--su-panel\)/);
assert.match(indexHtml, /min-width:44px!important;min-height:44px!important/);

const vendorBody = new TextEncoder().encode("export const mapVersion = '6.8.0';");
const vendorResponse = await worker.fetch(
  new Request("https://espacios.me/map/vendor/maplibre-gl.mjs?v=6.8.0"),
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

for (const pathname of ["/map/map-core.json", "/map/map-data.json"]) {
  const emergencyResponse = await worker.fetch(
    new Request(`https://espacios.me${pathname}`),
    {
      MARKET_R2: {
        async head() { throw new Error("R2 account unavailable"); },
        async get() { throw new Error("R2 account unavailable"); }
      }
    },
    context
  );
  assert.equal(emergencyResponse.status, 200, `${pathname} has a bounded repository fallback`);
  assert.equal(emergencyResponse.headers.get("x-ae-data-source"), "embedded-reviewed-emergency-snapshot");
  assert.equal(emergencyResponse.headers.get("x-ae-data-degraded"), "r2-account-unavailable");
  const emergency = await emergencyResponse.json();
  assert.equal(emergency.projects.length, 1337);
  assert.equal(emergency.communities.length, 215);
  assert.equal(emergency.initiatives.length, 72);
  assert.equal(emergency.projects.filter(project => Number.isFinite(project?.coordinates?.lat) && Number.isFinite(project?.coordinates?.lng)).length, 1337);

  const unboundResponse = await worker.fetch(
    new Request(`https://espacios.me${pathname}`),
    {},
    context
  );
  assert.equal(unboundResponse.status, 200, `${pathname} works when MARKET_R2 is unbound`);
  assert.equal(unboundResponse.headers.get("x-ae-data-source"), "embedded-reviewed-emergency-snapshot");
  assert.equal(unboundResponse.headers.get("x-ae-data-degraded"), "r2-account-unavailable");
  const unbound = await unboundResponse.json();
  assert.equal(unbound.projects.length, 1337);
  assert.equal(unbound.communities.length, 215);
  assert.equal(unbound.initiatives.length, 72);
}

const emergencyHeatmapResponse = await worker.fetch(
  new Request("https://espacios.me/map/api/uae-heatmap"),
  {},
  context
);
assert.equal(emergencyHeatmapResponse.status, 200, "UAE timeline heatmap works without MARKET_R2");
assert.equal(emergencyHeatmapResponse.headers.get("x-ae-data-source"), "embedded-reviewed-emergency-snapshot");
assert.equal(emergencyHeatmapResponse.headers.get("x-ae-data-degraded"), "r2-account-unavailable");
const emergencyHeatmap = await emergencyHeatmapResponse.json();
assert.equal(emergencyHeatmap.version, "20260927-uae-heatmap-v3-adrec");
assert.ok(emergencyHeatmap.projectFeatures.features.length >= 1337);
assert.equal(emergencyHeatmap.counts.emirates, 7);
assert.deepEqual(emergencyHeatmap.completeness.mappedEmirates, ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"]);

const researchResponse=await request('/map/api/research');
assert.equal(researchResponse.status,200);
assert.equal(researchResponse.headers.get('x-ae-data-degraded'),'r2-account-unavailable');
const research=await researchResponse.json();
assert.equal(research.counts.snapshotProjects,1337);
assert.equal(research.projects.length,1337);
assert.equal(research.upstream.complete,false);
assert.equal(research.upstream.liveProjectsIncluded,false);
assert.equal(research.counts.projectPsfVerified,0);
for(const [path,page] of [['/map/research','research'],['/map/history','history'],['/map/predictions','predictions'],['/map/intelligence','intelligence'],['/map/system','system']]){
  const response=await request(path);
  assert.equal(response.status,200,path);
  const html=await response.text();
  assert.match(html,new RegExp('data-map-page="'+page+'"'));
  assert.match(html,/data-map-degraded="r2"/);
  assert.match(html,/map-seamless-style/);
  assert.match(html,/map-degraded-banner/);
  assert.match(html,/espacios_theme_v1/);
  if(page==='history'){
    assert.doesNotMatch(html,/<p id="status" role="status">Loading the accepted data manifest/);
    assert.match(html,/R2-backed historical series are unavailable/);
  }
  if(page==='system')assert.match(html,/Source branch<\/span><span>codex\/map-seamless-v48-recovery-20261102/);
}
const abuDhabiResponse=await request('/map/abu-dhabi');
assert.equal(abuDhabiResponse.status,503);
assert.match(abuDhabiResponse.headers.get('content-type')||'',/text\/html/);
assert.match(await abuDhabiResponse.text(),/detailed source package is stored in R2/);
const systemPayload=await (await request('/map/api/system')).json();
assert.equal(systemPayload.storage.r2BindingAvailable,false);
assert.equal(systemPayload.storage.mapFallbackActive,true);
assert.equal(systemPayload.source.branch,'codex/map-seamless-v48-recovery-20261102');
assert.match(systemPayload.topology.find(row=>row.to==='MARKET_R2').via,/unavailable/);

const missingResponse = await request("/not-a-map-route");
assert.equal(missingResponse.status, 404);

const adminGetResponse = await request("/map/admin/azizi-upload-20260910");
assert.equal(adminGetResponse.status, 404);
const adminUnauthenticatedResponse = await worker.fetch(
  new Request(
    "https://espacios.me/map/admin/azizi-upload-20260910?key=availability/azizi/2026-09-10/test.json",
    { method: "POST", body: "{}" }
  ),
  { MARKET_R2: {} },
  context
);
assert.equal(adminUnauthenticatedResponse.status, 404);

assert.doesNotMatch(indexHtml, /id="ae-event-invite"/);
assert.match(indexHtml, /ae-system-access/);
assert.match(javascript, /function aeCollapseRepairV3\(/);
for (const hook of ["function CXCore()", "function UECore()", "function msForecastCard()"])
  assert.ok(javascript.includes(hook), `Preserve ${hook}`);
for (const pathname of ["/map/data-room", "/map/data-room/app.js", "/map/data-room/style.css", "/map/data-room/core.mjs"]) {
  const response = await request(pathname);
  assert.equal(response.status, 404, `${pathname} fails closed`);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
}
for (const pathname of ["/map/system", "/map/api/system"]) {
  const response = await request(pathname);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const disallowed = await worker.fetch(new Request(`https://espacios.me${pathname}`, { method: "POST" }), {}, context);
  assert.equal(disallowed.status, 405);
}
console.log("Smoke checks passed: preserved map interaction, theme, branding, history/projections, collapse repair, System routes, closed Data Room, vendor cache and removed admin route.");
