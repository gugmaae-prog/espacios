#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false
echo "Uploading hotspots Worker version for psr-portfolio-map-v2 (no traffic change)..."
./node_modules/.bin/wrangler versions upload -c wrangler.hotspots-version.jsonc
echo "Done. Promote with Cloudflare Versions UI or:"
echo "  npx wrangler versions deploy -c wrangler.hotspots-version.jsonc"
