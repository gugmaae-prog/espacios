# Cloudflare Versions upload — dry-run only (DO NOT promote)

Worker (live): `psr-portfolio-map-v2` · Map: https://espacios.me/map

## Preconditions
1. Copy `/workspace/espacios-map-navigable-v2` edits onto the laptop canonical tree  
   `.../outputs/espacios-map-navigable-v2` (this box could not reach that path).
2. Re-embed frontend assets the same way the Worker currently builds  
   (historically `npm run assets:embed` or equivalent gzip/base64 into `src/worker.js`).
3. Ensure enriched `map-data.json` lands in the snapshot the Worker reads  
   (`snapshots/current/map-data.json` in R2 / MARKET_INTEL — confirm binding name on laptop wrangler.toml).
4. Authenticated `wrangler` on the laptop; correct Cloudflare account.

## Exact Terminal commands (candidate — stop before promote)

```bash
# 0) On laptop, after merging box mirror into navigable-v2:
cd /Users/keifferjapeth/Documents/Codex/2026-09-19/cloudflare-plugin-dev-6aad368491c481918f56ee1ec8955165-created-by/outputs/espacios-map-navigable-v2

# 1) Optional: validate JSON
python3 -m json.tool data/map-data.json > /dev/null

# 2) Build / embed assets (use the project's real script — names vary by tree)
# npm ci && npm run assets:embed
# or: node scripts/embed-assets.mjs

# 3) Upload a Versions candidate with ZERO traffic (dry candidate)
npx wrangler versions upload \
  --name psr-portfolio-map-v2 \
  --message "initiative-enrichment-2026-09-22 (no promote)"

# 4) Inspect the new version id
npx wrangler versions list --name psr-portfolio-map-v2

# 5) STOP. Do NOT run:
# npx wrangler versions deploy ...
# npx wrangler deploy ...
# npx wrangler rollback ...
```

If the tree uses `wrangler.toml` `name = "psr-portfolio-map-v2"`, you can omit `--name`.

## Promote gate
Only after human verification on a versions preview / 0% traffic:
- Gold Line summary shows 42 km / 18 stations
- Harry Potter timing shows 2029 construction completion + ~63,000 m²
- DEC notes Phase 1 operating 2025–2026
- Initiative detail panel shows catalyst score + linked project counts + coord warning
