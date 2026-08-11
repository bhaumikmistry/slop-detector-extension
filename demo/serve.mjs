// Tiny static server for the demo timeline. No dependencies.
//   npm run demo   ->  http://localhost:4173
//
// Serves the repo root so the page can load ../dist/content.{js,css} — the real
// build, so what you screenshot is what ships.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".map": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/demo/index.html";

  // Keep the server inside the repo, even though it only ever binds localhost.
  const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const body = await readFile(path);
    res.writeHead(200, {
      "content-type": TYPES[extname(path)] || "application/octet-stream",
      "cache-control": "no-store", // always pick up a fresh build
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`  demo timeline → http://localhost:${PORT}`);
  console.log(`  serving the real build from dist/ — rerun after any change`);
});
