import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const VERCEL_STATIC_DIR = join(__dirname, "..", ".vercel", "output", "static");

await $`cp ${VERCEL_STATIC_DIR}/_build/sw.js ${VERCEL_STATIC_DIR}`;
await $`cp ${VERCEL_STATIC_DIR}/_build/workbox*.js* ${VERCEL_STATIC_DIR}`;
await $`cp ${VERCEL_STATIC_DIR}/_build/manifest.webmanifest ${VERCEL_STATIC_DIR}`;

await $`rm -rf ${VERCEL_STATIC_DIR}/_build/sw.js*`
await $`rm -rf ${VERCEL_STATIC_DIR}/_build/workbox*.js*`;

const path = join(VERCEL_STATIC_DIR, "sw.js");
let content = await readFile(path, "utf8");

content = content.replace(/assets\//g, "_build/assets/");
content = content.replace("//# sourceMappingURL=sw.js.map", "");

const html = await readFile(join(VERCEL_STATIC_DIR, "index.html"));
const hasher = new Bun.CryptoHasher("md5");
hasher.update(html.buffer);
const revision = hasher.digest("hex");
content = content.replace("REV_INDEX_HTML_TO_CHANGE", revision);

await writeFile(path, content, "utf8");
