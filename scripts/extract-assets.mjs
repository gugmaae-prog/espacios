import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const workerPath = path.join(projectRoot, "src", "worker.js");
const assetsDir = path.join(projectRoot, "src", "assets");
const source = await readFile(workerPath, "utf8");

const gzipMatch = source.match(/const GZ=(\{.*?\});const TYPES=/s);
if (!gzipMatch) throw new Error("Could not find the embedded GZ asset bundle.");

const gzipAssets = JSON.parse(gzipMatch[1]);
const filenames = {
  index: "index.html",
  css: "app-v2.css",
  js: "app-v2.js",
  verification: "verification.json"
};

await mkdir(assetsDir, { recursive: true });
for (const [key, filename] of Object.entries(filenames)) {
  if (typeof gzipAssets[key] !== "string") {
    throw new Error(`Missing embedded asset: ${key}`);
  }
  const body = gunzipSync(Buffer.from(gzipAssets[key], "base64"));
  await writeFile(path.join(assetsDir, filename), body);
}

for (const [constantName, filename] of [
  ["AE_PREMIUM_CSS", "premium.css"],
  ["AE_PREMIUM_JS", "premium.js"]
]) {
  const pattern = new RegExp(
    `const ${constantName}=("(?:\\\\.|[^"\\\\])*");`
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${constantName}.`);
  await writeFile(path.join(assetsDir, filename), JSON.parse(match[1]));
}

console.log(`Extracted ${Object.keys(filenames).length + 2} assets to ${assetsDir}`);
