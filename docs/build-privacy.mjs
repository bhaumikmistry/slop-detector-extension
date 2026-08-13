// Generates docs/privacy.html (and privacy.txt) from PRIVACY.md.
//
// The Chrome Web Store validates the privacy policy URL and rejects a
// text/plain response as "not a valid link", so the canonical URL it is given
// must be an HTML page. The .txt is kept as a convenience mirror.
//
// PRIVACY.md stays the single source of truth so the copies cannot drift.
//
// Run: npm run sync:privacy

import { readFile, writeFile } from "node:fs/promises";

const raw = await readFile(new URL("../PRIVACY.md", import.meta.url), "utf8");

// The generated headers supply the title; drop the document's own H1 so it does
// not appear twice.
const md = raw.replace(/^#\s+.*\n+/, "");

/* ---------------- plain text ---------------- */

const txt = md
  .replace(/^```[a-z]*\n([\s\S]*?)```$/gm, (_, code) => code.replace(/^/gm, "    ").trimEnd())
  .replace(/^#{1,6}\s+(.*)$/gm, (_, h) => `${h.toUpperCase()}\n${"-".repeat(h.length)}`)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => (text === url ? url : `${text} (${url})`))
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  // Italics only: an asterisk touching a slash or word character belongs to a
  // match pattern like https://x.com/* and must survive intact.
  .replace(/(?<![\w/*])\*([^*\n]+?)\*(?![\w/*])/g, "$1")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/^-\s+/gm, "  - ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

await writeFile(
  new URL("privacy.txt", import.meta.url),
  `SLOP DETECTOR — PRIVACY POLICY
==============================

The canonical version of this document lives at:
https://github.com/bhaumikmistry/slop-detector-extension/blob/main/PRIVACY.md

${txt}
`
);

/* ---------------- html ---------------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline markdown, applied after escaping so tags can be emitted safely. */
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\w/*])\*([^*\n]+?)\*(?![\w/*])/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const blocks = [];
let list = null;

const flushList = () => {
  if (list) {
    blocks.push(`<ul>\n${list.map((li) => `  <li>${inline(li)}</li>`).join("\n")}\n</ul>`);
    list = null;
  }
};

const lines = md.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith("```")) {
    flushList();
    const code = [];
    while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
    blocks.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    continue;
  }

  const heading = line.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    flushList();
    // The document's own H1 was stripped above and the page supplies its own,
    // so "##" maps straight to h2 and the heading levels stay contiguous.
    const level = Math.min(heading[1].length, 6);
    blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    continue;
  }

  const item = line.match(/^[-*]\s+(.*)$/);
  if (item) {
    (list ??= []).push(item[1]);
    continue;
  }

  if (/^\s*$/.test(line)) {
    flushList();
    continue;
  }

  if (/^---+$/.test(line.trim())) {
    flushList();
    blocks.push("<hr>");
    continue;
  }

  // Join wrapped lines into one paragraph.
  flushList();
  const para = [line];
  while (i + 1 < lines.length && !/^\s*$/.test(lines[i + 1]) && !/^([-*#]|```)/.test(lines[i + 1])) {
    para.push(lines[++i]);
  }
  blocks.push(`<p>${inline(para.join(" "))}</p>`);
}
flushList();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Slop Detector</title>
<meta name="description" content="Slop Detector collects nothing, stores nothing, and sends nothing anywhere. Everything runs locally in your browser.">
<style>
  body {
    max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem;
    background: #fdfdf8; color: #111;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  h1 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 .5rem; }
  h2 { font-size: 1.25rem; margin: 2rem 0 .5rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; }
  p, li { margin: 0 0 .75rem; }
  ul { padding-left: 1.25rem; }
  a { color: #b13c00; }
  code { background: #efefe8; padding: .1em .3em; border-radius: 3px; font-size: .9em; }
  pre { background: #111; color: #eee; padding: .9rem 1rem; overflow-x: auto; border-radius: 4px; }
  pre code { background: none; color: inherit; padding: 0; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 2rem 0; }
  .updated { color: #666; font-size: .9rem; margin-bottom: 2rem; }
</style>
</head>
<body>
<h1>Privacy Policy — Slop Detector</h1>
<p class="updated">Plain-text version: <a href="privacy.txt">privacy.txt</a> ·
Source: <a href="https://github.com/bhaumikmistry/slop-detector-extension/blob/main/PRIVACY.md">PRIVACY.md</a></p>
${blocks.join("\n")}
</body>
</html>
`;

await writeFile(new URL("privacy.html", import.meta.url), html);
console.log("wrote docs/privacy.html and docs/privacy.txt");
