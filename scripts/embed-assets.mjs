import { constants as zlibConstants, gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const workerPath = path.join(projectRoot, "src", "worker.js");
const assetsDir = path.join(projectRoot, "src", "assets");

const filenames = {
  index: "index.html",
  css: "app-v2.css",
  js: "app-v2.js",
  verification: "verification.json"
};

const gzipAssets = {};
for (const [key, filename] of Object.entries(filenames)) {
  const body = await readFile(path.join(assetsDir, filename));
  gzipAssets[key] = gzipSync(body, {
    level: 9,
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
    mtime: 0
  }).toString("base64");
}

let source = await readFile(workerPath, "utf8");
let replacements = 0;
source = source.replace(/const GZ=\{.*?\};const TYPES=/s, () => {
  replacements += 1;
  return `const GZ=${JSON.stringify(gzipAssets)};const TYPES=`;
});

for (const [constantName, filename] of [
  ["AE_PREMIUM_CSS", "premium.css"],
  ["AE_PREMIUM_JS", "premium.js"]
]) {
  const body = await readFile(path.join(assetsDir, filename), "utf8");
  const pattern = new RegExp(
    `const ${constantName}=("(?:\\\\.|[^"\\\\])*");`
  );
  source = source.replace(pattern, () => {
    replacements += 1;
    return `const ${constantName}=${JSON.stringify(body)};`;
  });
}

if (replacements !== 3) {
  throw new Error(`Expected 3 bundle replacements, applied ${replacements}.`);
}

await writeFile(workerPath, source);
console.log(`Embedded 6 editable assets into ${workerPath}`);
