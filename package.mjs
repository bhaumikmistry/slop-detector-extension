// Produces the Chrome Web Store upload: build/slop-detector-extension.zip
//
// Ships only what the extension needs at runtime — manifest, bundled content
// script, stylesheet, icons. Deliberately excluded:
//   *.map    inflates the upload and leaks local filesystem paths
//   src/     reviewers get the source from GitHub, not the package
//   node_modules/, tests, configs
//
// Run: npm run package

import { execFileSync } from "node:child_process";
import { mkdir, rm, cp, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OUT_DIR = "build";
const STAGE = `${OUT_DIR}/unpacked`;
const ZIP = "slop-detector-extension.zip";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));

// Everything the manifest points at must exist, or the store rejects the upload.
const required = [
  "manifest.json",
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
];
const missing = required.filter((f) => !existsSync(f));
if (missing.length) {
  console.error(`Missing files referenced by the manifest:\n  ${missing.join("\n  ")}`);
  console.error("Run `npm run build` first.");
  process.exit(1);
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(`${STAGE}/dist`, { recursive: true });
await mkdir(`${STAGE}/icons`, { recursive: true });

for (const file of required) {
  await cp(file, `${STAGE}/${file}`);
}

// Guard against a source map ever sneaking in via a manifest change.
const staged = [];
for (const dir of ["", "dist", "icons"]) {
  for (const f of await readdir(`${STAGE}/${dir}`, { withFileTypes: true })) {
    if (f.isFile()) staged.push(dir ? `${dir}/${f.name}` : f.name);
  }
}
const maps = staged.filter((f) => f.endsWith(".map"));
if (maps.length) {
  console.error(`Source maps must not ship: ${maps.join(", ")}`);
  process.exit(1);
}

execFileSync("zip", ["-r", "-q", `../${ZIP}`, "."], { cwd: STAGE });

const { size } = await import("node:fs").then((fs) => fs.statSync(`${OUT_DIR}/${ZIP}`));
console.log(`${OUT_DIR}/${ZIP}  (${(size / 1024).toFixed(1)} kB)`);
console.log(`  ${manifest.name} v${manifest.version}`);
for (const f of staged.sort()) console.log(`  ${f}`);
