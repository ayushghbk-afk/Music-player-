import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets"))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => "/assets/" + f);
const artwork = (await readdir("dist/art"))
  .filter((f) => f.endsWith(".svg"))
  .map((f) => "/art/" + f);
assets.push(...artwork);
const hash = createHash("sha256").update(assets.join("\n"));
for (const file of artwork) hash.update(await readFile("dist" + file));
const revision = hash.digest("hex").slice(0, 12);
let worker = await readFile("public/sw.js", "utf8");
worker = worker
  .replace("aether-v2", "aether-" + revision)
  .replace(
    "/* BUILD_ASSETS */",
    assets.map((p) => ", " + JSON.stringify(p)).join(""),
  );
await writeFile("dist/sw.js", worker);
