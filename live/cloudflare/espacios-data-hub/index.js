var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var RELEASE = "espacios-data-hub-v6-developer-registry";
var TENANTS = {
  psr: { key: "psr", slug: "psr", name: "PSR Homes", site: "https://psrhomes.ae" },
  "haus-and-grace": { key: "haus-and-grace", slug: "haus-and-grace", name: "Haus & Grace", site: "https://hausandgrace.ae" }
};
function commonHeaders(extra = {}) {
  return new Headers({
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
    "x-robots-tag": "noindex, nofollow, noarchive",
    ...extra
  });
}
__name(commonHeaders, "commonHeaders");
function json(value, init = {}) {
  const headers = commonHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": init.cache || "private, no-store",
    ...init.headers || {}
  });
  return new Response(JSON.stringify(value, null, init.pretty ? 2 : 0), {
    status: init.status || 200,
    headers
  });
}
__name(json, "json");
function errorResponse(error, status = 400) {
  return json({ ok: false, error }, { status });
}
__name(errorResponse, "errorResponse");
function normalizeTenant(value) {
  const key = String(value || "").toLowerCase();
  if (key === "hg" || key === "hausandgrace" || key === "haus-grace") return "haus-and-grace";
  return TENANTS[key] ? key : null;
}
__name(normalizeTenant, "normalizeTenant");
function normalizeProjectSlug(value) {
  let candidate = String(value || "").trim().toLowerCase();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  candidate = candidate.replace(/^https?:\/\/[^/]+\/projects\/(?:latest\/)?/i, "").replace(/^\/?projects\/(?:latest\/)?/i, "").split(/[\s/?#]/, 1)[0].replace(/^-+|-+$/g, "");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : null;
}
__name(normalizeProjectSlug, "normalizeProjectSlug");
function normalizeDeveloperSlug(value) {
  let candidate = String(value || "").trim().toLowerCase();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  candidate = candidate.replace(/^https?:\/\/[^/]+\/developers\//i, "").replace(/^\/?developers\//i, "").split(/[\s/?#]/, 1)[0].replace(/^-+|-+$/g, "");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : null;
}
__name(normalizeDeveloperSlug, "normalizeDeveloperSlug");
function jsonObject(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
__name(jsonObject, "jsonObject");
function stringList(value, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.replaceAll("\0", "").trim()).filter(Boolean))].slice(0, maxItems);
}
__name(stringList, "stringList");
function cleanText(value, maxLength = 1e3) {
  return typeof value === "string" ? value.replaceAll("\0", "").replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}
__name(cleanText, "cleanText");
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function etagMatches(ifNoneMatch, etag) {
  const header = String(ifNoneMatch || "").trim();
  if (!header) return false;
  if (header === "*") return true;
  const normalizedTarget = String(etag || "").trim().replace(/^W\//i, "");
  return header.split(",").map((candidate) => candidate.trim().replace(/^W\//i, "")).includes(normalizedTarget);
}
__name(etagMatches, "etagMatches");
function publicProject(row) {
  const payload = jsonObject(row.payload_json);
  const overrides = jsonObject(row.overrides_json);
  return {
    ...payload,
    ...overrides,
    slug: row.public_slug,
    canonicalSlug: row.canonical_slug,
    title: overrides.title || payload.title || row.name,
    developer: overrides.developer || payload.developer || row.developer,
    emirate: overrides.emirate || payload.emirate || row.emirate,
    area: overrides.area || payload.area || row.area,
    href: row.href,
    indexable: Boolean(row.indexable),
    revision: Number(row.registry_revision || 0)
  };
}
__name(publicProject, "publicProject");
function publicDeveloper(row) {
  const payload = jsonObject(row.payload_json);
  const overrides = jsonObject(row.overrides_json);
  const slug = row.public_slug;
  const logoStatus = overrides.logoStatus || payload.logo?.status || row.logo_status || "needs_review";
  const logoApproved = logoStatus === "ready" && payload.logo?.qaStatus === "pass" && payload.logo?.transparentCanvas === true && payload.logo?.noSolidBackground === true && payload.logo?.lightSurfaceReadable === true;
  return {
    ...payload,
    ...overrides,
    slug,
    canonicalSlug: row.canonical_slug,
    name: overrides.name || payload.name || row.name,
    href: row.href,
    indexable: Boolean(row.indexable),
    logoStatus,
    classification: overrides.classification || payload.classification || row.classification || "",
    logo: {
      ...jsonObject(payload.logo),
      ...jsonObject(overrides.logo),
      status: logoStatus,
      url: logoApproved ? `https://espacios.me/logos/png/${encodeURIComponent(row.canonical_slug)}.png` : null,
      format: logoApproved ? "image/png" : null,
      transparentCanvas: logoApproved,
      noSolidBackground: logoApproved,
      lightSurfaceReadable: logoApproved
    },
    revision: Number(row.registry_revision || 0)
  };
}
__name(publicDeveloper, "publicDeveloper");
function ownerEmails(env) {
  return String(env.DATA_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
}
__name(ownerEmails, "ownerEmails");
async function authenticate(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { error: errorResponse("Espacios sign-in required.", 401) };
  }
  if (!env.AUTH || typeof env.AUTH.fetch !== "function") {
    return { error: errorResponse("Espacios authentication service is unavailable.", 503) };
  }
  const response = await env.AUTH.fetch(new Request("https://espacios.me/api/auth/me", {
    method: "GET",
    headers: { authorization, accept: "application/json" }
  }));
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.user?.email) {
    return { error: errorResponse("Espacios session is invalid or expired.", 401) };
  }
  const email = String(payload.user.email).toLowerCase();
  if (!ownerEmails(env).includes(email)) {
    return { error: errorResponse("This Espacios data registry is not enabled for this account.", 403) };
  }
  return {
    user: {
      id: payload.user.id,
      email,
      display_name: payload.user.user_metadata?.full_name || payload.user.user_metadata?.name || email
    }
  };
}
__name(authenticate, "authenticate");
async function latestSummaries(env) {
  const result = await env.REGISTRY.prepare(`
    SELECT
      t.tenant_key, t.route_slug, t.display_name, t.canonical_site_url,
      t.data_owner, t.publish_target, t.status AS tenant_status,
      b.id AS batch_id, b.status AS batch_status, b.scope, b.started_at, b.completed_at,
      b.sitemap_count, b.page_count, b.fetched_count, b.failed_count, b.redirect_count,
      b.total_bytes, b.asset_reference_count, b.archive_bytes, b.archive_sha256,
      b.manifest_bytes, b.manifest_sha256, b.source_last_modified, b.notes
    FROM tenant_registry t
    LEFT JOIN current_snapshots c ON c.tenant_key = t.tenant_key
    LEFT JOIN import_batches b ON b.id = c.batch_id
    ORDER BY t.display_name
  `).all();
  return result.results || [];
}
__name(latestSummaries, "latestSummaries");
async function tenantSummary(env, tenantKey) {
  const row = await env.REGISTRY.prepare(`
    SELECT
      t.tenant_key, t.route_slug, t.display_name, t.canonical_site_url,
      t.data_owner, t.publish_target, t.status AS tenant_status,
      b.id AS batch_id, b.status AS batch_status, b.scope, b.started_at, b.completed_at,
      b.sitemap_count, b.page_count, b.fetched_count, b.failed_count, b.redirect_count,
      b.total_bytes, b.asset_reference_count, b.archive_key, b.archive_bytes, b.archive_sha256,
      b.manifest_key, b.manifest_bytes, b.manifest_sha256, b.source_last_modified, b.notes
    FROM tenant_registry t
    LEFT JOIN current_snapshots c ON c.tenant_key = t.tenant_key
    LEFT JOIN import_batches b ON b.id = c.batch_id
    WHERE t.tenant_key = ?
  `).bind(tenantKey).first();
  return row || null;
}
__name(tenantSummary, "tenantSummary");
async function projectRegistryState(env, tenantKey) {
  return await env.REGISTRY.prepare(`
    SELECT tenant_key, revision, project_count, content_hash, updated_at
    FROM project_registry_state WHERE tenant_key = ?
  `).bind(tenantKey).first() || {
    tenant_key: tenantKey,
    revision: 0,
    project_count: 0,
    content_hash: "",
    updated_at: ""
  };
}
__name(projectRegistryState, "projectRegistryState");
async function developerRegistryState(env, tenantKey) {
  return await env.REGISTRY.prepare(`
    SELECT tenant_key, revision, developer_count, ready_logo_count, content_hash, updated_at
    FROM developer_registry_state WHERE tenant_key = ?
  `).bind(tenantKey).first() || {
    tenant_key: tenantKey,
    revision: 0,
    developer_count: 0,
    ready_logo_count: 0,
    content_hash: "",
    updated_at: ""
  };
}
__name(developerRegistryState, "developerRegistryState");
async function projectFilters(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT p.developer, p.emirate, p.payload_json
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    WHERE tp.tenant_key = ? AND tp.visibility = 'published' AND p.status = 'active'
  `).bind(tenantKey).all();
  const developers = /* @__PURE__ */ new Set();
  const propertyTypes = /* @__PURE__ */ new Set();
  const emirates = {};
  for (const row of result.results || []) {
    if (row.developer) developers.add(row.developer);
    if (row.emirate) emirates[row.emirate] = (emirates[row.emirate] || 0) + 1;
    for (const type of stringList(jsonObject(row.payload_json).propertyTypes)) propertyTypes.add(type);
  }
  return {
    emirates,
    developers: [...developers].sort((a, b) => a.localeCompare(b)),
    propertyTypes: [...propertyTypes].sort((a, b) => a.localeCompare(b))
  };
}
__name(projectFilters, "projectFilters");
function projectQuery(request, tenantKey) {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const requestedLimit = Number(url.searchParams.get("limit") || url.searchParams.get("pageSize") || 24);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 24;
  const filters = {
    q: cleanText(url.searchParams.get("q") || url.searchParams.get("query") || "", 160).toLowerCase(),
    emirate: cleanText(url.searchParams.get("emirate") || "", 80),
    developer: cleanText(url.searchParams.get("developer") || "", 120),
    type: cleanText(url.searchParams.get("type") || url.searchParams.get("propertyType") || "", 80),
    bedrooms: cleanText(url.searchParams.get("bedrooms") || "", 40),
    maxPrice: Math.max(0, Number(url.searchParams.get("maxPrice") || 0))
  };
  const where = [
    "tp.tenant_key = ?",
    "tp.visibility = 'published'",
    "p.status = 'active'"
  ];
  const values = [tenantKey];
  for (const term of filters.q.split(/[^a-z0-9]+/).filter((value) => value.length > 1)) {
    const like = `%${term}%`;
    where.push("(lower(p.name) LIKE ? OR lower(p.developer) LIKE ? OR lower(p.emirate) LIKE ? OR lower(p.area) LIKE ?)");
    values.push(like, like, like, like);
  }
  if (filters.emirate) {
    where.push("p.emirate = ? COLLATE NOCASE");
    values.push(filters.emirate);
  }
  if (filters.developer) {
    where.push("p.developer = ? COLLATE NOCASE");
    values.push(filters.developer);
  }
  if (filters.type) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.payload_json, '$.propertyTypes') WHERE CAST(value AS TEXT) = ? COLLATE NOCASE)");
    values.push(filters.type);
  }
  if (filters.bedrooms) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.payload_json, '$.bedrooms') WHERE CAST(value AS TEXT) = ? COLLATE NOCASE)");
    values.push(filters.bedrooms);
  }
  if (Number.isFinite(filters.maxPrice) && filters.maxPrice > 0) {
    where.push("CAST(COALESCE(json_extract(p.payload_json, '$.startingPrice'), json_extract(p.payload_json, '$.priceAed'), 0) AS REAL) BETWEEN 1 AND ?");
    values.push(filters.maxPrice);
  }
  return { url, page, limit, filters, where: where.join(" AND "), values };
}
__name(projectQuery, "projectQuery");
async function listPublishedProjects(request, env, tenantKey) {
  const query = projectQuery(request, tenantKey);
  const state = await projectRegistryState(env, tenantKey);
  const etagSuffix = await sha256Hex(`${tenantKey}
${state.revision}
${query.url.searchParams.toString()}`);
  const etag = `"${etagSuffix.slice(0, 32)}"`;
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, {
      status: 304,
      headers: commonHeaders({
        etag,
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "access-control-allow-origin": "*"
      })
    });
  }
  const countRow = await env.REGISTRY.prepare(`
    SELECT COUNT(*) AS total
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    WHERE ${query.where}
  `).bind(...query.values).first();
  const total = Number(countRow?.total || 0);
  const offset = (query.page - 1) * query.limit;
  const result = await env.REGISTRY.prepare(`
    SELECT p.canonical_slug, p.name, p.developer, p.emirate, p.area, p.payload_json,
           tp.public_slug, tp.href, tp.indexable, tp.overrides_json, tp.sort_rank
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    WHERE ${query.where}
    ORDER BY tp.sort_rank ASC, p.name COLLATE NOCASE ASC, p.canonical_slug ASC
    LIMIT ? OFFSET ?
  `).bind(...query.values, query.limit, offset).all();
  const projects = (result.results || []).map((row) => publicProject({
    ...row,
    registry_revision: state.revision
  }));
  return json({
    ok: true,
    owner: "Espacios",
    tenant: tenantKey,
    projects,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    pageSize: query.limit,
    filters: await projectFilters(env, tenantKey),
    registry: {
      total: Number(state.project_count || total),
      revision: Number(state.revision || 0),
      updatedAt: state.updated_at || "",
      contentHash: state.content_hash || ""
    }
  }, {
    cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    headers: { etag, "access-control-allow-origin": "*" }
  });
}
__name(listPublishedProjects, "listPublishedProjects");
async function publishedProject(request, env, tenantKey, requestedSlug) {
  const slug = normalizeProjectSlug(requestedSlug);
  if (!slug) return errorResponse("Invalid project slug.", 400);
  const row = await env.REGISTRY.prepare(`
    SELECT p.canonical_slug, p.name, p.developer, p.emirate, p.area, p.payload_json,
           tp.public_slug, tp.href, tp.indexable, tp.overrides_json,
           s.revision AS registry_revision
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    LEFT JOIN project_registry_state s ON s.tenant_key = tp.tenant_key
    WHERE tp.tenant_key = ? AND tp.visibility = 'published' AND p.status = 'active'
      AND (
        tp.public_slug = ? OR p.canonical_slug = ? OR EXISTS (
          SELECT 1 FROM project_aliases a WHERE a.project_id = p.project_id AND a.alias_slug = ?
        )
      )
    LIMIT 1
  `).bind(tenantKey, slug, slug, slug).first();
  if (!row) return errorResponse("Project not found.", 404);
  const project = publicProject(row);
  return json({ ok: true, owner: "Espacios", tenant: tenantKey, project }, {
    cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    headers: { "access-control-allow-origin": "*" }
  });
}
__name(publishedProject, "publishedProject");
async function projectManifest(env, tenantKey) {
  const state = await projectRegistryState(env, tenantKey);
  return json({
    ok: true,
    owner: "Espacios",
    tenant: tenantKey,
    revision: Number(state.revision || 0),
    projectCount: Number(state.project_count || 0),
    contentHash: state.content_hash || "",
    updatedAt: state.updated_at || "",
    catalogue: `/data/api/v1/projects?tenant=${encodeURIComponent(tenantKey)}`
  }, {
    cache: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    headers: { "access-control-allow-origin": "*" }
  });
}
__name(projectManifest, "projectManifest");
function escapeXml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
__name(escapeXml, "escapeXml");
async function projectSitemap(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT tp.href, p.source_updated_at, p.updated_at
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    WHERE tp.tenant_key = ? AND tp.visibility = 'published'
      AND tp.indexable = 1 AND p.status = 'active'
    ORDER BY tp.public_slug
  `).bind(tenantKey).all();
  const origin = TENANTS[tenantKey].site;
  const urls = (result.results || []).map((row) => {
    const lastModified = cleanText(row.source_updated_at || row.updated_at, 50);
    return [
      "  <url>",
      `    <loc>${escapeXml(new URL(row.href, origin).toString())}</loc>`,
      ...lastModified ? [`    <lastmod>${escapeXml(lastModified)}</lastmod>`] : [],
      "    <changefreq>weekly</changefreq>",
      "    <priority>0.85</priority>",
      "  </url>"
    ].join("\n");
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}${urls ? "\n" : ""}</urlset>
`;
  return new Response(xml, {
    headers: commonHeaders({
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
      "access-control-allow-origin": "*",
      "x-project-data-owner": "Espacios",
      "x-project-data-tenant": tenantKey
    })
  });
}
__name(projectSitemap, "projectSitemap");
async function developerFilters(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT d.logo_status, d.payload_json
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    WHERE td.tenant_key = ? AND td.visibility = 'published' AND d.status = 'active'
  `).bind(tenantKey).all();
  const logoStatuses = { ready: 0, needs_review: 0, classified: 0 };
  const locations = /* @__PURE__ */ new Set();
  for (const row of result.results || []) {
    if (Object.hasOwn(logoStatuses, row.logo_status)) logoStatuses[row.logo_status] += 1;
    for (const location of stringList(jsonObject(row.payload_json).locations, 30)) locations.add(location);
  }
  return {
    logoStatuses,
    locations: [...locations].sort((a, b) => a.localeCompare(b))
  };
}
__name(developerFilters, "developerFilters");
function developerQuery(request, tenantKey) {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const requestedLimit = Number(url.searchParams.get("limit") || url.searchParams.get("pageSize") || 100);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(500, Math.max(1, Math.floor(requestedLimit))) : 100;
  const filters = {
    q: cleanText(url.searchParams.get("q") || url.searchParams.get("query") || "", 160).toLowerCase(),
    logoStatus: cleanText(url.searchParams.get("logoStatus") || url.searchParams.get("status") || "", 40),
    location: cleanText(url.searchParams.get("location") || url.searchParams.get("emirate") || "", 80)
  };
  const where = [
    "td.tenant_key = ?",
    "td.visibility = 'published'",
    "d.status = 'active'"
  ];
  const values = [tenantKey];
  for (const term of filters.q.split(/[^a-z0-9]+/).filter((value) => value.length > 1)) {
    const like = `%${term}%`;
    where.push("(lower(d.name) LIKE ? OR lower(d.canonical_slug) LIKE ? OR lower(d.classification) LIKE ?)");
    values.push(like, like, like);
  }
  if (["ready", "needs_review", "classified"].includes(filters.logoStatus)) {
    where.push("d.logo_status = ?");
    values.push(filters.logoStatus);
  }
  if (filters.location) {
    where.push("EXISTS (SELECT 1 FROM json_each(d.payload_json, '$.locations') WHERE CAST(value AS TEXT) = ? COLLATE NOCASE)");
    values.push(filters.location);
  }
  return { url, page, limit, filters, where: where.join(" AND "), values };
}
__name(developerQuery, "developerQuery");
async function listPublishedDevelopers(request, env, tenantKey) {
  const query = developerQuery(request, tenantKey);
  const state = await developerRegistryState(env, tenantKey);
  const etagSuffix = await sha256Hex(`${tenantKey}
${state.revision}
${query.url.searchParams.toString()}`);
  const etag = `"${etagSuffix.slice(0, 32)}"`;
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, {
      status: 304,
      headers: commonHeaders({
        etag,
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "access-control-allow-origin": "*"
      })
    });
  }
  const countRow = await env.REGISTRY.prepare(`
    SELECT COUNT(*) AS total
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    WHERE ${query.where}
  `).bind(...query.values).first();
  const total = Number(countRow?.total || 0);
  const offset = (query.page - 1) * query.limit;
  const result = await env.REGISTRY.prepare(`
    SELECT d.canonical_slug, d.name, d.logo_status, d.classification, d.payload_json,
           td.public_slug, td.href, td.indexable, td.overrides_json, td.sort_rank
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    WHERE ${query.where}
    ORDER BY td.sort_rank ASC, d.name COLLATE NOCASE ASC, d.canonical_slug ASC
    LIMIT ? OFFSET ?
  `).bind(...query.values, query.limit, offset).all();
  const developers = (result.results || []).map((row) => publicDeveloper({
    ...row,
    registry_revision: state.revision
  }));
  return json({
    ok: true,
    owner: "Espacios",
    entity: "developers",
    tenant: tenantKey,
    developers,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    pageSize: query.limit,
    filters: await developerFilters(env, tenantKey),
    registry: {
      total: Number(state.developer_count || total),
      readyLogos: Number(state.ready_logo_count || 0),
      revision: Number(state.revision || 0),
      updatedAt: state.updated_at || "",
      contentHash: state.content_hash || ""
    }
  }, {
    cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    headers: { etag, "access-control-allow-origin": "*" }
  });
}
__name(listPublishedDevelopers, "listPublishedDevelopers");
async function publishedDeveloper(request, env, tenantKey, requestedSlug) {
  const slug = normalizeDeveloperSlug(requestedSlug);
  if (!slug) return errorResponse("Invalid developer slug.", 400);
  const row = await env.REGISTRY.prepare(`
    SELECT d.canonical_slug, d.name, d.logo_status, d.classification, d.payload_json,
           td.public_slug, td.href, td.indexable, td.overrides_json,
           s.revision AS registry_revision
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    LEFT JOIN developer_registry_state s ON s.tenant_key = td.tenant_key
    WHERE td.tenant_key = ? AND td.visibility = 'published' AND d.status = 'active'
      AND (
        td.public_slug = ? OR d.canonical_slug = ? OR EXISTS (
          SELECT 1 FROM developer_aliases a WHERE a.developer_id = d.developer_id AND a.alias_slug = ?
        )
      )
    LIMIT 1
  `).bind(tenantKey, slug, slug, slug).first();
  if (!row) return errorResponse("Developer not found.", 404);
  return json({
    ok: true,
    owner: "Espacios",
    entity: "developers",
    tenant: tenantKey,
    developer: publicDeveloper(row)
  }, {
    cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    headers: { "access-control-allow-origin": "*" }
  });
}
__name(publishedDeveloper, "publishedDeveloper");
async function developerManifest(env, tenantKey) {
  const state = await developerRegistryState(env, tenantKey);
  const filters = await developerFilters(env, tenantKey);
  return json({
    ok: true,
    owner: "Espacios",
    entity: "developers",
    tenant: tenantKey,
    revision: Number(state.revision || 0),
    developerCount: Number(state.developer_count || 0),
    readyLogoCount: Number(state.ready_logo_count || 0),
    logoStatuses: filters.logoStatuses,
    contentHash: state.content_hash || "",
    updatedAt: state.updated_at || "",
    catalogue: `/data/api/v1/developers?tenant=${encodeURIComponent(tenantKey)}`,
    logoPolicy: {
      approvedFormat: "image/png",
      transparentCanvasRequired: true,
      solidBackgroundAllowed: false,
      placeholderAllowed: false
    }
  }, {
    cache: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    headers: { "access-control-allow-origin": "*" }
  });
}
__name(developerManifest, "developerManifest");
async function developerSitemap(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT td.href, d.source_updated_at, d.updated_at
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    WHERE td.tenant_key = ? AND td.visibility = 'published'
      AND td.indexable = 1 AND d.status = 'active'
    ORDER BY td.public_slug
  `).bind(tenantKey).all();
  const origin = TENANTS[tenantKey].site;
  const urls = (result.results || []).map((row) => {
    const lastModified = cleanText(row.source_updated_at || row.updated_at, 50);
    return [
      "  <url>",
      `    <loc>${escapeXml(new URL(row.href, origin).toString())}</loc>`,
      ...lastModified ? [`    <lastmod>${escapeXml(lastModified)}</lastmod>`] : [],
      "    <changefreq>weekly</changefreq>",
      "    <priority>0.75</priority>",
      "  </url>"
    ].join("\n");
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}${urls ? "\n" : ""}</urlset>
`;
  return new Response(xml, {
    headers: commonHeaders({
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
      "access-control-allow-origin": "*",
      "x-developer-data-owner": "Espacios",
      "x-developer-data-tenant": tenantKey
    })
  });
}
__name(developerSitemap, "developerSitemap");
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}
__name(stableValue, "stableValue");
function normalizeProjectUpsert(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Each project must be an object.");
  const canonicalSlug = normalizeProjectSlug(input.canonicalSlug || input.slug);
  if (!canonicalSlug) throw new Error("A valid canonicalSlug is required.");
  const rawPayload = jsonObject(input.payload, input);
  const title = cleanText(rawPayload.title || rawPayload.name || input.title || input.name, 300);
  if (!title) throw new Error(`Project ${canonicalSlug} requires a title.`);
  const developer = cleanText(rawPayload.developer || input.developer, 200);
  const emirate = cleanText(rawPayload.emirate || input.emirate, 80);
  const area = cleanText(rawPayload.area || input.area, 300);
  const payload = {
    ...rawPayload,
    slug: canonicalSlug,
    title,
    developer,
    emirate,
    area,
    bedrooms: stringList(rawPayload.bedrooms, 30),
    propertyTypes: stringList(rawPayload.propertyTypes, 30)
  };
  delete payload.tenants;
  delete payload.aliases;
  delete payload.provenance;
  const tenants = [];
  for (const [rawTenant, rawPublication] of Object.entries(jsonObject(input.tenants))) {
    const tenantKey = normalizeTenant(rawTenant);
    if (!tenantKey) throw new Error(`Unknown tenant ${rawTenant}.`);
    const publication = jsonObject(rawPublication);
    const publicSlug = normalizeProjectSlug(publication.publicSlug || publication.slug || canonicalSlug);
    if (!publicSlug) throw new Error(`Invalid public slug for ${tenantKey}.`);
    const href = cleanText(publication.href || `/projects/${publicSlug}`, 500);
    if (!/^\/projects\/(?:latest\/)?[a-z0-9-]+$/.test(href)) throw new Error(`Invalid project href for ${tenantKey}.`);
    const visibility = ["draft", "published", "hidden"].includes(publication.visibility) ? publication.visibility : "published";
    tenants.push({
      tenantKey,
      publicSlug,
      href,
      visibility,
      indexable: publication.indexable ? 1 : 0,
      sortRank: Number.isFinite(Number(publication.sortRank)) ? Math.floor(Number(publication.sortRank)) : 1e6,
      overrides: jsonObject(publication.overrides),
      publishedAt: cleanText(publication.publishedAt, 50)
    });
  }
  if (!tenants.length) throw new Error(`Project ${canonicalSlug} requires at least one tenant publication.`);
  const aliases = stringList(input.aliases, 40).map(normalizeProjectSlug).filter((alias) => alias && alias !== canonicalSlug);
  return {
    projectId: `project:${canonicalSlug}`,
    canonicalSlug,
    title,
    developer,
    emirate,
    area,
    payload: stableValue(payload),
    provenance: stableValue(jsonObject(input.provenance)),
    aliases: [...new Set(aliases)],
    tenants,
    status: ["active", "archived", "needs_review"].includes(input.status) ? input.status : "active",
    sourceUpdatedAt: cleanText(input.sourceUpdatedAt || rawPayload.updatedAt, 50)
  };
}
__name(normalizeProjectUpsert, "normalizeProjectUpsert");
function normalizeDeveloperUpsert(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Each developer must be an object.");
  const canonicalSlug = normalizeDeveloperSlug(input.canonicalSlug || input.slug);
  if (!canonicalSlug) throw new Error("A valid canonicalSlug is required.");
  const rawPayload = jsonObject(input.payload, input);
  const name = cleanText(rawPayload.name || input.name, 300);
  if (!name) throw new Error(`Developer ${canonicalSlug} requires a name.`);
  const logoStatus = cleanText(input.logoStatus || rawPayload.logoStatus || rawPayload.logo?.status || "needs_review", 40);
  if (!["ready", "needs_review", "classified"].includes(logoStatus)) {
    throw new Error(`Developer ${canonicalSlug} has an invalid logoStatus.`);
  }
  const sourceLogo = jsonObject(rawPayload.logo);
  const logoReady = logoStatus === "ready" && sourceLogo.qaStatus === "pass" && sourceLogo.transparentCanvas === true && sourceLogo.noSolidBackground === true && sourceLogo.lightSurfaceReadable === true;
  if (logoStatus === "ready" && !logoReady) {
    throw new Error(`Developer ${canonicalSlug} cannot publish a logo until clean transparent-PNG QA passes.`);
  }
  const classification = cleanText(rawPayload.classification || input.classification, 300);
  const locations = stringList(rawPayload.locations || rawPayload.emirates, 30);
  const activeProjects = Math.max(0, Math.floor(Number(rawPayload.activeProjects || 0)) || 0);
  const indexedProjects = Math.max(activeProjects, Math.floor(Number(rawPayload.indexedProjects || 0)) || 0);
  const payload = {
    ...rawPayload,
    name,
    locations,
    emirates: locations,
    activeProjects,
    indexedProjects,
    classification,
    officialSite: cleanText(rawPayload.officialSite || rawPayload.website, 1e3),
    website: cleanText(rawPayload.website || rawPayload.officialSite, 1e3),
    sourceVerification: cleanText(rawPayload.sourceVerification, 120),
    logo: {
      ...sourceLogo,
      status: logoStatus,
      url: logoReady ? `https://espacios.me/logos/png/${encodeURIComponent(canonicalSlug)}.png` : null,
      format: logoReady ? "image/png" : null,
      transparentCanvas: logoReady,
      noSolidBackground: logoReady,
      lightSurfaceReadable: logoReady
    }
  };
  delete payload.tenants;
  delete payload.aliases;
  delete payload.provenance;
  const tenants = [];
  for (const [rawTenant, rawPublication] of Object.entries(jsonObject(input.tenants))) {
    const tenantKey = normalizeTenant(rawTenant);
    if (!tenantKey) throw new Error(`Unknown tenant ${rawTenant}.`);
    const publication = jsonObject(rawPublication);
    const publicSlug = normalizeDeveloperSlug(publication.publicSlug || publication.slug || canonicalSlug);
    if (!publicSlug) throw new Error(`Invalid public slug for ${tenantKey}.`);
    const href = cleanText(publication.href || `/developers/${publicSlug}`, 500);
    if (!/^\/developers\/[a-z0-9-]+$/.test(href)) throw new Error(`Invalid developer href for ${tenantKey}.`);
    const visibility = ["draft", "published", "hidden"].includes(publication.visibility) ? publication.visibility : "published";
    tenants.push({
      tenantKey,
      publicSlug,
      href,
      visibility,
      indexable: publication.indexable === false ? 0 : 1,
      sortRank: Number.isFinite(Number(publication.sortRank)) ? Math.floor(Number(publication.sortRank)) : 1e6,
      overrides: jsonObject(publication.overrides),
      publishedAt: cleanText(publication.publishedAt, 50)
    });
  }
  if (!tenants.length) throw new Error(`Developer ${canonicalSlug} requires at least one tenant publication.`);
  const aliases = stringList(input.aliases, 40).map(normalizeDeveloperSlug).filter((alias) => alias && alias !== canonicalSlug);
  return {
    developerId: `developer:${canonicalSlug}`,
    canonicalSlug,
    name,
    logoStatus,
    classification,
    payload: stableValue(payload),
    provenance: stableValue(jsonObject(input.provenance)),
    aliases: [...new Set(aliases)],
    tenants,
    status: ["active", "archived", "needs_review"].includes(input.status) ? input.status : "active",
    sourceUpdatedAt: cleanText(input.sourceUpdatedAt || rawPayload.updatedAt, 50)
  };
}
__name(normalizeDeveloperUpsert, "normalizeDeveloperUpsert");
async function refreshProjectState(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT p.project_id, p.content_hash, tp.public_slug, tp.href, tp.visibility,
           tp.indexable, tp.sort_rank, tp.overrides_json
    FROM tenant_project_publications tp
    JOIN projects p ON p.project_id = tp.project_id
    WHERE tp.tenant_key = ? AND tp.visibility = 'published' AND p.status = 'active'
    ORDER BY tp.sort_rank, tp.public_slug
  `).bind(tenantKey).all();
  const rows = result.results || [];
  const contentHash = await sha256Hex(JSON.stringify(rows));
  await env.REGISTRY.prepare(`
    INSERT INTO project_registry_state (tenant_key, revision, project_count, content_hash, updated_at)
    VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_key) DO UPDATE SET
      revision = project_registry_state.revision + 1,
      project_count = excluded.project_count,
      content_hash = excluded.content_hash,
      updated_at = CURRENT_TIMESTAMP
  `).bind(tenantKey, rows.length, contentHash).run();
  return projectRegistryState(env, tenantKey);
}
__name(refreshProjectState, "refreshProjectState");
async function refreshDeveloperState(env, tenantKey) {
  const result = await env.REGISTRY.prepare(`
    SELECT d.developer_id, d.content_hash, d.logo_status, td.public_slug, td.href,
           td.visibility, td.indexable, td.sort_rank, td.overrides_json
    FROM tenant_developer_publications td
    JOIN developers d ON d.developer_id = td.developer_id
    WHERE td.tenant_key = ? AND td.visibility = 'published' AND d.status = 'active'
    ORDER BY td.sort_rank, td.public_slug
  `).bind(tenantKey).all();
  const rows = result.results || [];
  const readyLogos = rows.filter((row) => row.logo_status === "ready").length;
  const contentHash = await sha256Hex(JSON.stringify(rows));
  await env.REGISTRY.prepare(`
    INSERT INTO developer_registry_state (
      tenant_key, revision, developer_count, ready_logo_count, content_hash, updated_at
    ) VALUES (?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_key) DO UPDATE SET
      revision = developer_registry_state.revision + 1,
      developer_count = excluded.developer_count,
      ready_logo_count = excluded.ready_logo_count,
      content_hash = excluded.content_hash,
      updated_at = CURRENT_TIMESTAMP
  `).bind(tenantKey, rows.length, readyLogos, contentHash).run();
  return developerRegistryState(env, tenantKey);
}
__name(refreshDeveloperState, "refreshDeveloperState");
async function upsertProjects(request, env) {
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > 15e5) return errorResponse("Project batch is too large.", 413);
  const body = await request.json().catch(() => null);
  const records = Array.isArray(body?.projects) ? body.projects : [];
  if (!records.length || records.length > 25) return errorResponse("Provide between 1 and 25 projects.", 400);
  let projects;
  try {
    projects = records.map(normalizeProjectUpsert);
  } catch (error) {
    return errorResponse(cleanText(error?.message || "Invalid project batch.", 500), 400);
  }
  const statements = [];
  const touchedTenants = /* @__PURE__ */ new Set();
  const projectStatement = env.REGISTRY.prepare(`
    INSERT INTO projects (
      project_id, canonical_slug, name, developer, emirate, area, payload_json,
      provenance_json, content_hash, status, source_updated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET
      canonical_slug = excluded.canonical_slug,
      name = excluded.name,
      developer = excluded.developer,
      emirate = excluded.emirate,
      area = excluded.area,
      payload_json = excluded.payload_json,
      provenance_json = excluded.provenance_json,
      content_hash = excluded.content_hash,
      status = excluded.status,
      source_updated_at = excluded.source_updated_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  const revisionStatement = env.REGISTRY.prepare(`
    INSERT OR IGNORE INTO project_revisions (project_id, content_hash, snapshot_json, source)
    VALUES (?, ?, ?, ?)
  `);
  const aliasStatement = env.REGISTRY.prepare(`
    INSERT INTO project_aliases (alias_slug, project_id, reason)
    VALUES (?, ?, 'source_alias')
    ON CONFLICT(alias_slug) DO UPDATE SET project_id = excluded.project_id
  `);
  const publicationStatement = env.REGISTRY.prepare(`
    INSERT INTO tenant_project_publications (
      tenant_key, project_id, public_slug, href, visibility, indexable,
      sort_rank, overrides_json, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_key, project_id) DO UPDATE SET
      public_slug = excluded.public_slug,
      href = excluded.href,
      visibility = excluded.visibility,
      indexable = excluded.indexable,
      sort_rank = excluded.sort_rank,
      overrides_json = excluded.overrides_json,
      published_at = excluded.published_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  for (const project of projects) {
    const payloadJson = JSON.stringify(project.payload);
    const provenanceJson = JSON.stringify(project.provenance);
    const contentHash = await sha256Hex(JSON.stringify({
      payload: project.payload,
      provenance: project.provenance,
      status: project.status
    }));
    statements.push(projectStatement.bind(
      project.projectId,
      project.canonicalSlug,
      project.title,
      project.developer,
      project.emirate,
      project.area,
      payloadJson,
      provenanceJson,
      contentHash,
      project.status,
      project.sourceUpdatedAt
    ));
    statements.push(revisionStatement.bind(project.projectId, contentHash, payloadJson, cleanText(body.source || "espacios", 120)));
    for (const alias of project.aliases) statements.push(aliasStatement.bind(alias, project.projectId));
    for (const publication of project.tenants) {
      touchedTenants.add(publication.tenantKey);
      statements.push(publicationStatement.bind(
        publication.tenantKey,
        project.projectId,
        publication.publicSlug,
        publication.href,
        publication.visibility,
        publication.indexable,
        publication.sortRank,
        JSON.stringify(stableValue(publication.overrides)),
        publication.publishedAt
      ));
    }
  }
  await env.REGISTRY.batch(statements);
  const state = {};
  for (const tenantKey of touchedTenants) state[tenantKey] = await refreshProjectState(env, tenantKey);
  return json({
    ok: true,
    release: RELEASE,
    owner: "Espacios",
    imported: projects.length,
    projects: projects.map((project) => project.canonicalSlug),
    state
  }, { cache: "private, no-store" });
}
__name(upsertProjects, "upsertProjects");
async function upsertDevelopers(request, env) {
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > 15e5) return errorResponse("Developer batch is too large.", 413);
  const body = await request.json().catch(() => null);
  const records = Array.isArray(body?.developers) ? body.developers : [];
  if (!records.length || records.length > 50) return errorResponse("Provide between 1 and 50 developers.", 400);
  let developers;
  try {
    developers = records.map(normalizeDeveloperUpsert);
  } catch (error) {
    return errorResponse(cleanText(error?.message || "Invalid developer batch.", 500), 400);
  }
  const statements = [];
  const touchedTenants = /* @__PURE__ */ new Set();
  const developerStatement = env.REGISTRY.prepare(`
    INSERT INTO developers (
      developer_id, canonical_slug, name, logo_status, classification, payload_json,
      provenance_json, content_hash, status, source_updated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(developer_id) DO UPDATE SET
      canonical_slug = excluded.canonical_slug,
      name = excluded.name,
      logo_status = excluded.logo_status,
      classification = excluded.classification,
      payload_json = excluded.payload_json,
      provenance_json = excluded.provenance_json,
      content_hash = excluded.content_hash,
      status = excluded.status,
      source_updated_at = excluded.source_updated_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  const revisionStatement = env.REGISTRY.prepare(`
    INSERT OR IGNORE INTO developer_revisions (developer_id, content_hash, snapshot_json, source)
    VALUES (?, ?, ?, ?)
  `);
  const aliasStatement = env.REGISTRY.prepare(`
    INSERT INTO developer_aliases (alias_slug, developer_id, reason)
    VALUES (?, ?, 'source_alias')
    ON CONFLICT(alias_slug) DO UPDATE SET developer_id = excluded.developer_id
  `);
  const publicationStatement = env.REGISTRY.prepare(`
    INSERT INTO tenant_developer_publications (
      tenant_key, developer_id, public_slug, href, visibility, indexable,
      sort_rank, overrides_json, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_key, developer_id) DO UPDATE SET
      public_slug = excluded.public_slug,
      href = excluded.href,
      visibility = excluded.visibility,
      indexable = excluded.indexable,
      sort_rank = excluded.sort_rank,
      overrides_json = excluded.overrides_json,
      published_at = excluded.published_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  for (const developer of developers) {
    const payloadJson = JSON.stringify(developer.payload);
    const provenanceJson = JSON.stringify(developer.provenance);
    const contentHash = await sha256Hex(JSON.stringify({
      payload: developer.payload,
      provenance: developer.provenance,
      logoStatus: developer.logoStatus,
      classification: developer.classification,
      status: developer.status
    }));
    statements.push(developerStatement.bind(
      developer.developerId,
      developer.canonicalSlug,
      developer.name,
      developer.logoStatus,
      developer.classification,
      payloadJson,
      provenanceJson,
      contentHash,
      developer.status,
      developer.sourceUpdatedAt
    ));
    statements.push(revisionStatement.bind(
      developer.developerId,
      contentHash,
      payloadJson,
      cleanText(body.source || "espacios", 120)
    ));
    for (const alias of developer.aliases) statements.push(aliasStatement.bind(alias, developer.developerId));
    for (const publication of developer.tenants) {
      touchedTenants.add(publication.tenantKey);
      statements.push(publicationStatement.bind(
        publication.tenantKey,
        developer.developerId,
        publication.publicSlug,
        publication.href,
        publication.visibility,
        publication.indexable,
        publication.sortRank,
        JSON.stringify(stableValue(publication.overrides)),
        publication.publishedAt
      ));
    }
  }
  await env.REGISTRY.batch(statements);
  const state = {};
  for (const tenantKey of touchedTenants) state[tenantKey] = await refreshDeveloperState(env, tenantKey);
  return json({
    ok: true,
    release: RELEASE,
    owner: "Espacios",
    entity: "developers",
    imported: developers.length,
    developers: developers.map((developer) => developer.canonicalSlug),
    state
  }, { cache: "private, no-store" });
}
__name(upsertDevelopers, "upsertDevelopers");
async function listPages(request, env, tenantKey) {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.min(1e5, Math.max(0, Number(url.searchParams.get("offset") || 0)));
  const status = url.searchParams.get("status");
  const summary = await tenantSummary(env, tenantKey);
  if (!summary?.batch_id) return errorResponse("No recorded snapshot exists for this tenant.", 404);
  let sql = `SELECT url, route_path, http_status, content_type, response_bytes, body_sha256,
    final_url, title, canonical_url, etag, last_modified, archive_path, fetched_at, error
    FROM source_pages WHERE batch_id = ?`;
  const values = [summary.batch_id];
  if (status) {
    sql += " AND http_status = ?";
    values.push(Number(status));
  }
  sql += " ORDER BY route_path LIMIT ? OFFSET ?";
  values.push(limit, offset);
  const result = await env.REGISTRY.prepare(sql).bind(...values).all();
  const pages = result.results || [];
  return json({
    ok: true,
    release: RELEASE,
    tenant: tenantKey,
    batch_id: summary.batch_id,
    limit,
    offset,
    pages,
    next_offset: pages.length === limit ? offset + limit : null
  });
}
__name(listPages, "listPages");
async function artifact(env, tenantKey, kind) {
  const summary = await tenantSummary(env, tenantKey);
  if (!summary?.batch_id) return errorResponse("No recorded snapshot exists for this tenant.", 404);
  const key = kind === "manifest" ? summary.manifest_key : summary.archive_key;
  if (!key) return errorResponse(`The current ${kind} is not recorded.`, 404);
  const object = await env.ARCHIVES.get(key);
  if (!object) return errorResponse(`The recorded ${kind} object is missing.`, 503);
  const filename = key.split("/").pop() || `${tenantKey}-${kind}`;
  const headers = commonHeaders({
    "cache-control": "private, no-store",
    "content-disposition": `${kind === "archive" ? "attachment" : "inline"}; filename="${filename.replaceAll('"', "")}"`,
    etag: object.httpEtag
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
__name(artifact, "artifact");
function pageHeaders(nonce) {
  const headers = commonHeaders({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-store"
  });
  headers.set("content-security-policy", [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    "connect-src 'self'"
  ].join("; "));
  return headers;
}
__name(pageHeaders, "pageHeaders");
function dashboard(tenantKey = null) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const tenant = tenantKey ? TENANTS[tenantKey] : null;
  const title = tenant ? `${tenant.name} record \xB7 Espacios` : "Data registry \xB7 Espacios";
  const eyebrow = tenant ? `${tenant.name} \xB7 tenant record` : "Espacios \xB7 canonical data store";
  const heading = tenant ? `${tenant.name}, recorded in Espacios.` : "One record. Separate tenants.";
  const lede = tenant ? `This is the current Espacios-owned public-data snapshot for ${tenant.name}. It contains every sitemap-listed page, its content hash, public metadata and referenced-asset inventory. Private leads, users, credentials, messages and CRM records remain inside the tenant boundary.` : "Espacios holds a versioned, checksummed record of approved public pages and catalogue content, then publishes to each tenant independently. PSR Homes and Haus & Grace remain separate destinations; the UAE map remains Espacios-owned.";
  const summaryEndpoint = tenant ? `/data/${tenant.slug}/api/summary` : "/data/api/summary";
  const cards = tenant ? '<div class="card"><strong id="pages">\u2014</strong><span>Public pages recorded</span></div><div class="card"><strong id="assets">\u2014</strong><span>Asset references</span></div><div class="card"><strong id="bytes">\u2014</strong><span>Captured bytes</span></div><div class="card"><strong id="state">\u2014</strong><span>Batch state</span></div>' : '<div class="card"><strong id="tenants">2</strong><span>Tenant destinations</span></div><div class="card"><strong id="pages">\u2014</strong><span>Public pages recorded</span></div><div class="card"><strong id="batches">\u2014</strong><span>Current batches</span></div><div class="card"><strong>Espacios</strong><span>Canonical owner</span></div>';
  const actions = tenant ? `<a class="button" href="/login?next=%2Fdata%2F${tenant.slug}">Sign in</a><a class="button alt" href="${tenant.site}">Open ${tenant.name}</a><button id="manifest" class="button alt" type="button">Open manifest</button><button id="archive" class="button alt" type="button">Download archive</button>` : '<a class="button" href="/data/psr">PSR record</a><a class="button alt" href="/data/haus-and-grace">Haus & Grace record</a><a class="button alt" href="/map">Espacios map</a>';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>:root{color-scheme:light;--paper:#f2f0e9;--ink:#121315;--muted:#67675f;--line:#d8d5cb;--panel:#faf9f5;--green:#176c4b;--red:#963c31}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1360px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px;font-size:11px;letter-spacing:.16em;text-transform:uppercase}.state{color:var(--green)}.hero{padding:76px 0 46px;max-width:980px}.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}h1{font-size:clamp(52px,8vw,104px);line-height:.92;letter-spacing:-.065em;font-weight:520;margin:16px 0 24px}.lede{font-size:18px;line-height:1.58;color:#51514c;max-width:900px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}.button{border:1px solid var(--ink);background:var(--ink);color:#fff;text-decoration:none;padding:12px 16px;font:inherit;font-size:11px;letter-spacing:.11em;text-transform:uppercase;cursor:pointer}.button.alt{background:transparent;color:var(--ink);border-color:var(--line)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:4px 0 50px}.card{background:var(--panel);border:1px solid var(--line);padding:22px;min-height:128px}.card strong{display:block;font-size:30px;font-weight:520;letter-spacing:-.04em;overflow-wrap:anywhere}.card span{display:block;margin-top:28px;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}.section{border-top:1px solid var(--line);padding:34px 0}.records{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.record{display:block;background:rgba(255,255,255,.35);border:1px solid var(--line);padding:20px;color:inherit;text-decoration:none}.record b{display:block;font-size:22px}.record small{display:block;color:var(--muted);margin-top:12px;line-height:1.5}.record em{display:block;margin-top:24px;font-style:normal;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--green)}pre{display:none;background:#151719;color:#e8e5dc;padding:18px;overflow:auto;max-height:620px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}pre.on{display:block}.error{color:var(--red)}@media(max-width:760px){.shell{padding:16px}.metrics{grid-template-columns:repeat(2,1fr)}.records{grid-template-columns:1fr}.hero{padding-top:54px}.top{text-align:right}.top span:first-child{text-align:left}}</style></head>
<body><main class="shell"><header class="top"><span>Espacios \xB7 Data registry</span><span class="state">Espacios \u2192 tenant publish</span></header><section class="hero"><div class="eyebrow">${eyebrow}</div><h1>${heading}</h1><p class="lede">${lede}</p><div class="actions">${actions}</div></section><section class="metrics">${cards}</section><section class="section"><div class="eyebrow">Current registry</div><div id="records" class="records"></div><pre id="viewer"></pre></section><footer class="section lede" style="font-size:13px">Release ${RELEASE}. Snapshot imports are limited to approved public routes and public catalogue content. Tenant-private operations are not copied into this registry.</footer></main>
<script nonce="${nonce}">(function(){var endpoint=${JSON.stringify(summaryEndpoint)},tenant=${JSON.stringify(tenantKey)},records=document.getElementById('records'),viewer=document.getElementById('viewer');function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function num(v){return Number(v||0).toLocaleString()}function size(v){var n=Number(v||0);if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';if(n<1073741824)return(n/1048576).toFixed(1)+' MB';return(n/1073741824).toFixed(2)+' GB'}function card(r){return '<a class="record" href="/data/'+esc(r.route_slug)+'"><b>'+esc(r.display_name)+'</b><small>Batch '+esc(r.batch_id||'pending')+'<br>'+num(r.fetched_count)+' of '+num(r.page_count)+' pages captured \xB7 '+num(r.failed_count)+' failures</small><em>'+esc(r.batch_status||'awaiting import')+'</em></a>'}async function load(){try{var response=await fetch(endpoint,{headers:{accept:'application/json'}}),data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));var rows=tenant?[data.record]:data.records;rows=rows.filter(Boolean);records.innerHTML=rows.map(card).join('');if(tenant&&rows[0]){document.getElementById('pages').textContent=num(rows[0].fetched_count);document.getElementById('assets').textContent=num(rows[0].asset_reference_count);document.getElementById('bytes').textContent=size(rows[0].total_bytes);document.getElementById('state').textContent=rows[0].batch_status||'pending'}else{document.getElementById('pages').textContent=num(rows.reduce(function(t,r){return t+Number(r.fetched_count||0)},0));document.getElementById('batches').textContent=num(rows.filter(function(r){return r.batch_id}).length)}}catch(e){records.innerHTML='<span class="error">'+esc(e.message)+'</span>'}}function token(){try{return localStorage.getItem('espacios_access_token')||''}catch(e){return''}}async function artifact(kind){var t=token();if(!t){viewer.classList.add('on');viewer.textContent='Sign in to Espacios first.';return}var response=await fetch('/data/'+tenant+'/api/'+kind,{headers:{authorization:'Bearer '+t}});if(!response.ok){var data=await response.json().catch(function(){return{}});throw new Error(data.error||('HTTP '+response.status))}if(kind==='manifest'){viewer.classList.add('on');viewer.textContent=JSON.stringify(await response.json(),null,2);viewer.scrollIntoView({behavior:'smooth'})}else{var url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=tenant+'-public-pages.tar.gz';a.click();setTimeout(function(){URL.revokeObjectURL(url)},30000)}}if(tenant){document.getElementById('manifest').addEventListener('click',function(){artifact('manifest').catch(function(e){viewer.classList.add('on');viewer.textContent=e.message})});document.getElementById('archive').addEventListener('click',function(){artifact('archive').catch(function(e){viewer.classList.add('on');viewer.textContent=e.message})})}load()})();<\/script></body></html>`;
  return new Response(html, { headers: pageHeaders(nonce) });
}
__name(dashboard, "dashboard");
async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: commonHeaders({
        allow: "GET, POST, OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "accept, authorization, content-type, if-none-match"
      })
    });
  }
  if (request.method === "POST" && path === "/data/api/v1/admin/projects/upsert") {
    const auth2 = await authenticate(request, env);
    if (auth2.error) return auth2.error;
    const response = await upsertProjects(request, env);
    const headers = new Headers(response.headers);
    headers.set("x-espacios-user", auth2.user.email);
    return new Response(response.body, { status: response.status, headers });
  }
  if (request.method === "POST" && path === "/data/api/v1/admin/developers/upsert") {
    const auth2 = await authenticate(request, env);
    if (auth2.error) return auth2.error;
    const response = await upsertDevelopers(request, env);
    const headers = new Headers(response.headers);
    headers.set("x-espacios-user", auth2.user.email);
    return new Response(response.body, { status: response.status, headers });
  }
  if (request.method !== "GET") return errorResponse("Method not allowed.", 405);
  if (path === "/data") return dashboard();
  if (path === "/data/api/health") {
    return json({
      ok: true,
      release: env.DATA_RELEASE || RELEASE,
      architecture: "Espacios canonical data store to tenant-specific publish targets",
      bindings: { registry: Boolean(env.REGISTRY), archives: Boolean(env.ARCHIVES), auth: Boolean(env.AUTH) }
    }, { cache: "no-store" });
  }
  if (path === "/data/api/summary") {
    return json({ ok: true, release: RELEASE, owner: "Espacios", records: await latestSummaries(env) }, { cache: "no-store" });
  }
  if (path === "/data/api/v1/projects" || path === "/data/api/v1/projects/manifest" || path === "/data/api/v1/projects/sitemap") {
    const tenantKey2 = normalizeTenant(url.searchParams.get("tenant"));
    if (!tenantKey2) return errorResponse("A valid tenant query parameter is required.", 400);
    if (path.endsWith("/manifest")) return projectManifest(env, tenantKey2);
    if (path.endsWith("/sitemap")) return projectSitemap(env, tenantKey2);
    return listPublishedProjects(request, env, tenantKey2);
  }
  if (path === "/data/api/v1/developers" || path === "/data/api/v1/developers/manifest" || path === "/data/api/v1/developers/sitemap") {
    const tenantKey2 = normalizeTenant(url.searchParams.get("tenant"));
    if (!tenantKey2) return errorResponse("A valid tenant query parameter is required.", 400);
    if (path.endsWith("/manifest")) return developerManifest(env, tenantKey2);
    if (path.endsWith("/sitemap")) return developerSitemap(env, tenantKey2);
    return listPublishedDevelopers(request, env, tenantKey2);
  }
  const projectMatch = path.match(/^\/data\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    const tenantKey2 = normalizeTenant(url.searchParams.get("tenant"));
    if (!tenantKey2) return errorResponse("A valid tenant query parameter is required.", 400);
    return publishedProject(request, env, tenantKey2, projectMatch[1]);
  }
  const developerMatch = path.match(/^\/data\/api\/v1\/developers\/([^/]+)$/);
  if (developerMatch) {
    const tenantKey2 = normalizeTenant(url.searchParams.get("tenant"));
    if (!tenantKey2) return errorResponse("A valid tenant query parameter is required.", 400);
    return publishedDeveloper(request, env, tenantKey2, developerMatch[1]);
  }
  const match = path.match(/^\/data\/([^/]+)(?:\/(.*))?$/);
  if (!match) return errorResponse("Not found.", 404);
  const tenantKey = normalizeTenant(match[1]);
  if (!tenantKey) return errorResponse("Unknown tenant.", 404);
  const suffix = match[2] || "";
  if (!suffix) return dashboard(tenantKey);
  if (suffix === "api/health") {
    return json({ ok: true, release: RELEASE, tenant: tenantKey, registry: Boolean(env.REGISTRY), archives: Boolean(env.ARCHIVES) }, { cache: "no-store" });
  }
  if (suffix === "api/summary") {
    const record = await tenantSummary(env, tenantKey);
    if (!record) return errorResponse("Tenant record not found.", 404);
    delete record.archive_key;
    delete record.manifest_key;
    return json({ ok: true, release: RELEASE, architecture: "Espacios \u2192 tenant publish", record }, { cache: "no-store" });
  }
  const auth = await authenticate(request, env);
  if (auth.error) return auth.error;
  if (suffix === "api/pages" || tenantKey === "psr" && suffix === "api/catalog") {
    const response = await listPages(request, env, tenantKey);
    const headers = new Headers(response.headers);
    headers.set("x-espacios-user", auth.user.email);
    return new Response(response.body, { status: response.status, headers });
  }
  if (suffix === "api/manifest") return artifact(env, tenantKey, "manifest");
  if (suffix === "api/archive") return artifact(env, tenantKey, "archive");
  if (suffix.startsWith("api/table/") || suffix.startsWith("api/objects") || suffix.startsWith("api/object/")) {
    return errorResponse("Direct tenant-database browsing is retired. Use the Espacios snapshot record.", 410);
  }
  return errorResponse("Not found.", 404);
}
__name(handle, "handle");
var index_default = {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    try {
      const response = await handle(request, env);
      const headers = new Headers(response.headers);
      headers.set("x-espacios-data-release", env.DATA_RELEASE || RELEASE);
      headers.set("x-espacios-request-id", requestId);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.error(JSON.stringify({ event: "espacios_data_hub_error", request_id: requestId, path: new URL(request.url).pathname, message: String(error?.message || error) }));
      return json({ ok: false, error: "Espacios data registry unavailable.", request_id: requestId }, { status: 503 });
    }
  }
};
var __test = {
  etagMatches,
  normalizeTenant,
  normalizeProjectSlug,
  normalizeDeveloperSlug,
  normalizeProjectUpsert,
  normalizeDeveloperUpsert,
  publicProject,
  publicDeveloper,
  handle
};
export {
  __test,
  index_default as default
};
//# sourceMappingURL=index.js.map
