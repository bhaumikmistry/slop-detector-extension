// esbuild bundler for the extension.
// - bundles the content script (which imports the detector library) to dist/content.js
// - copies content.css to dist/content.css
// Run: npm run build   (or: npm run watch)

import * as esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

await mkdir("dist", { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/content/content.ts"],
  bundle: true,
  format: "iife",
  target: ["chrome110"],
  outfile: "dist/content.js",
  sourcemap: true,
  // panel.css is imported as a string and injected into a shadow root.
  loader: { ".css": "text" },
  legalComments: "none",
  logLevel: "info",
};

async function copyCss() {
  await copyFile("src/content/content.css", "dist/content.css");
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await copyCss();
  console.log("watching…");
} else {
  await esbuild.build(options);
  await copyCss();
  console.log("build complete → dist/");
}
