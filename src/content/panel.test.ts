/**
 * Evidence-panel tests.
 *
 * The panel is what makes the score auditable, so these check that it actually
 * quotes the post rather than merely opening — and that clicking the badge
 * never leaks to X's tweet-wide click handler, which would navigate away from
 * the timeline instead of showing the panel.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const BUNDLE = readFileSync(new URL("../../dist/content.js", import.meta.url), "utf8");

const POST =
  `And this isn't "another healthcare startup." It's an attempt to rewrite the ` +
  `operating system of health itself. So here's the news: I'm proud to be part of ` +
  `the founding team from day one. I backed them when most people said the market ` +
  `didn't exist. #HealthTech #BuildingTheFuture #Startups`;

const settle = () => new Promise((r) => setTimeout(r, 80));

async function open(text = POST) {
  const dom = new JSDOM(
    `<!doctype html><html><body><main>
       <article data-testid="tweet">
         <div data-testid="tweetText">${text}</div>
         <div role="group"><div>like</div></div>
       </article></main></body></html>`,
    { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.com/home" }
  );
  dom.window.eval(BUNDLE);
  await settle();

  const doc = dom.window.document;
  const badge = doc.querySelector<HTMLElement>('[data-slopd="badge"]')!;
  const click = (el: EventTarget) =>
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

  return {
    dom,
    doc,
    badge,
    click,
    host: () => doc.querySelector('[data-slopd="panel-host"]'),
    panel: () =>
      doc.querySelector('[data-slopd="panel-host"]')?.shadowRoot?.querySelector('[data-slopd="panel"]') ?? null,
  };
}

test("the badge is a real button, and no panel exists until clicked", async () => {
  const t = await open();
  assert.equal(t.badge.tagName, "BUTTON");
  assert.match(t.badge.getAttribute("title") ?? "", /Click/);
  assert.equal(t.host(), null);
});

test("clicking opens the panel without navigating to the tweet", async () => {
  const t = await open();
  let leaked = false;
  t.doc.querySelector("article")!.addEventListener("click", () => (leaked = true));

  t.click(t.badge);
  await settle();

  assert.ok(t.panel(), "panel should open");
  assert.equal(leaked, false, "click must not reach X's tweet handler");
  assert.equal(t.badge.getAttribute("aria-expanded"), "true");
});

test("the panel lives outside the tweet, in a shadow root", async () => {
  // Nested in the timeline it gets cropped: X clips overflow on tweet
  // containers and transforms virtualized rows, which also breaks fixed
  // positioning for descendants.
  const t = await open();
  t.click(t.badge);
  await settle();

  assert.equal(t.host()!.closest("article"), null, "host must not be inside the tweet");
  assert.ok(t.host()!.shadowRoot, "contents belong in a shadow root");
});

test("the panel quotes the post and highlights what matched", async () => {
  const t = await open();
  t.click(t.badge);
  await settle();
  const panel = t.panel()!;

  const quotes = [...panel.querySelectorAll(".slopd-quote")];
  const marks = [...panel.querySelectorAll(".slopd-mark")].map((m) => m.textContent ?? "");

  assert.ok(quotes.length >= 3, "several signals should be evidenced");
  assert.ok(marks.every((m) => m.length > 0), "every quote highlights its match");

  for (const m of marks) {
    const plain = m.replace(/[#@]…/g, "").trim();
    if (plain.length > 3) {
      assert.ok(POST.includes(plain.slice(0, 20)), `highlighted text should come from the post: ${m}`);
    }
  }

  assert.ok(panel.querySelectorAll(".slopd-hit__pts").length >= 3, "points shown per signal");
  assert.ok(panel.querySelectorAll(".slopd-hit__why").length >= 3, "reason shown per signal");
});

test("normalization placeholders never reach the reader", async () => {
  const t = await open();
  t.click(t.badge);
  await settle();
  const text = t.panel()!.textContent ?? "";
  assert.doesNotMatch(text, /[]/, "handle/hashtag placeholders must be rendered readably");
});

test("a clean post explains why nothing fired", async () => {
  const t = await open("just got back from lunch, the tacos were great lol");
  t.click(t.badge);
  await settle();
  assert.match(t.panel()!.textContent ?? "", /No AI writing tells/);
});

for (const [name, dismiss] of [
  ["a second click", (t: Awaited<ReturnType<typeof open>>) => t.click(t.badge)],
  ["clicking outside", (t: Awaited<ReturnType<typeof open>>) => t.click(t.doc.body)],
  [
    "Escape",
    (t: Awaited<ReturnType<typeof open>>) =>
      t.doc.dispatchEvent(new t.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  ],
  [
    "scrolling",
    (t: Awaited<ReturnType<typeof open>>) => t.dom.window.dispatchEvent(new t.dom.window.Event("scroll")),
  ],
] as const) {
  test(`${name} closes the panel`, async () => {
    const t = await open();
    t.click(t.badge);
    await settle();
    assert.ok(t.host(), "precondition: panel is open");

    dismiss(t);
    await settle();
    assert.equal(t.host(), null);
  });
}
