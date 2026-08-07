/**
 * Content-script tests.
 *
 * These run the *built bundle* against a simulated X timeline rather than
 * importing the source, because the bundle is what actually ships and because
 * the script self-starts on load. `npm test` builds first.
 *
 * Every case here is a bug that was real at some point — X's timeline recycles
 * nodes and re-renders footers, and both of those quietly break naive badge
 * injection.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const BUNDLE = readFileSync(new URL("../../dist/content.js", import.meta.url), "utf8");

const SLOP =
  "In the realm of technology, this groundbreaking platform serves as a testament to a vibrant tapestry of innovation.";
const HUMAN = "just got back from lunch, the tacos were great lol";

function tweet(text: string, opts: { noActions?: boolean } = {}): string {
  const actions = opts.noActions ? "" : `<div role="group"><div>reply</div><div>like</div></div>`;
  return `
    <article data-testid="tweet">
      <div class="head"><a href="/u"><time datetime="2026-01-01"></time></a></div>
      <div data-testid="tweetText">${text}</div>
      <div class="footer">${actions}</div>
    </article>`;
}

/** Boot a timeline with the real content script running against it. */
async function timeline(bodyHtml: string) {
  const dom = new JSDOM(`<!doctype html><html><body><main id="timeline">${bodyHtml}</main></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://x.com/home",
  });
  dom.window.eval(BUNDLE);
  await settle();
  return dom;
}

/** The script batches work into an animation frame; let it run. */
const settle = () => new Promise((r) => setTimeout(r, 80));

const scoreOf = (el: Element | null | undefined) =>
  el?.querySelector('[data-slopd="badge"] .slopd-badge__label')?.textContent ?? null;

test("scores tweets and injects one badge each", async () => {
  const dom = await timeline(tweet(SLOP) + tweet(HUMAN));
  const [slop, human] = [...dom.window.document.querySelectorAll("article")];

  assert.match(scoreOf(slop) ?? "", /AI [5-9]\d%/, "slop should score high");
  assert.equal(scoreOf(human), "AI 0%");
  assert.equal(dom.window.document.querySelectorAll('[data-slopd="badge"]').length, 2);
});

test("a post with no text gets no badge", async () => {
  const dom = await timeline(tweet(""));
  assert.equal(scoreOf(dom.window.document.querySelector("article")), null);
});

test("falls back to the header when there is no action bar", async () => {
  const dom = await timeline(tweet("Delving into a myriad of seamless solutions.", { noActions: true }));
  assert.ok(scoreOf(dom.window.document.querySelector("article")));
});

test("badges tweets that stream in later", async () => {
  const dom = await timeline(tweet(HUMAN));
  const holder = dom.window.document.createElement("div");
  holder.innerHTML = tweet(SLOP);
  dom.window.document.getElementById("timeline")!.appendChild(holder.firstElementChild!);
  await settle();
  assert.equal(dom.window.document.querySelectorAll('[data-slopd="badge"]').length, 2);
});

test("unrelated DOM churn does not duplicate badges", async () => {
  const dom = await timeline(tweet(SLOP) + tweet(HUMAN));
  for (let i = 0; i < 5; i++) {
    dom.window.document.getElementById("timeline")!.appendChild(dom.window.document.createElement("span"));
  }
  await settle();
  assert.equal(dom.window.document.querySelectorAll('[data-slopd="badge"]').length, 2);
});

test("re-injects a badge React wiped during a re-render", async () => {
  const dom = await timeline(tweet(SLOP));
  const article = dom.window.document.querySelector("article")!;
  // X re-renders the action row whenever a like or repost count changes.
  article.querySelector(".footer")!.innerHTML = `<div role="group"><div>like</div></div>`;
  await settle();

  assert.ok(scoreOf(article), "badge should come back");
  assert.match(scoreOf(article)!, /AI [5-9]\d%/, "and still score this tweet");
  assert.equal(article.querySelectorAll('[data-slopd="badge"]').length, 1, "exactly once");
});

test("re-scores a recycled article node", async () => {
  // The virtualized timeline reuses <article> elements for different tweets.
  // Keying on a 'processed' flag leaves a stale score on the wrong post.
  const dom = await timeline(tweet(SLOP));
  const article = dom.window.document.querySelector("article")!;
  assert.match(scoreOf(article)!, /AI [5-9]\d%/);

  article.querySelector('[data-testid="tweetText"]')!.textContent = "ok cool thanks";
  await settle();

  assert.equal(scoreOf(article), "AI 0%", "badge must follow the new text");
});

test("clean posts render quietly, scored posts do not", async () => {
  const dom = await timeline(tweet(HUMAN) + tweet(SLOP));
  const [human, slop] = [...dom.window.document.querySelectorAll("article")];
  const cls = (a: Element) => a.querySelector('[data-slopd="badge"]')!.className;

  assert.match(cls(human), /slopd-badge--quiet/);
  assert.doesNotMatch(cls(slop), /slopd-badge--quiet/);
  // Quiet, but still present: absence would be indistinguishable from the
  // extension having failed to run at all.
  assert.ok(scoreOf(human));
});

test("does not patch history.pushState", async () => {
  // Content scripts run in an isolated world, so patching pushState here would
  // never see the page's own navigation calls. The MutationObserver covers it.
  const dom = await timeline(tweet(HUMAN));
  assert.doesNotMatch(dom.window.history.pushState.toString(), /origPush|schedule/);
});
