// Generates docs/privacy.txt from PRIVACY.md.
//
// The Chrome Web Store wants a privacy policy URL, and a plain-text page is the
// least ambiguous thing to hand a reviewer: no styling, no navigation, loads
// instantly, reads identically everywhere. PRIVACY.md stays the single source of
// truth so the two can never disagree.
//
// Run: npm run sync:privacy

import { readFile, writeFile } from "node:fs/promises";

const raw = await readFile(new URL("../PRIVACY.md", import.meta.url), "utf8");

// The plain-text header below supplies the title; drop the document's own H1 so
// it does not appear twice.
const md = raw.replace(/^#\s+.*\n+/, "");

const txt = md
  .replace(/^```[a-z]*\n([\s\S]*?)```$/gm, (_, code) =>
    code.replace(/^/gm, "    ").trimEnd()) // fenced blocks become indented
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

const header = [
  "SLOP DETECTOR — PRIVACY POLICY",
  "==============================",
  "",
  "The canonical version of this document lives at:",
  "https://github.com/bhaumikmistry/slop-detector-extension/blob/main/PRIVACY.md",
  "",
  "",
].join("\n");

await writeFile(new URL("privacy.txt", import.meta.url), header + txt + "\n");
console.log("wrote docs/privacy.txt");
