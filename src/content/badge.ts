/**
 * Badge rendering — the small "AI xx%" chip and the panel it opens.
 *
 * The chip is a real <button>. Clicking it opens a panel that quotes the lines
 * that scored, with the matched span highlighted, so the number is auditable
 * rather than something to take on faith.
 *
 * The panel does not live in the tweet. It is a body-level host element with a
 * shadow root, positioned in viewport coordinates. Anything nested inside the
 * timeline gets cropped: X clips overflow on the tweet containers and applies
 * transforms to virtualized rows, which also break `position: fixed`. The shadow
 * root additionally keeps X's stylesheets from reaching in and restyling us.
 */

import panelCss from "./panel.css";
import { HANDLE_TOKEN, HASHTAG_TOKEN } from "@slop-detector/slop-detector";
import type { DetectionResult, SignalHit, Verdict } from "@slop-detector/slop-detector";

const VERDICT_CLASS: Record<Verdict, string> = {
  human: "slopd-badge--human",
  unclear: "slopd-badge--unclear",
  "likely-ai": "slopd-badge--likely",
  ai: "slopd-badge--ai",
};

const VERDICT_ICON: Record<Verdict, string> = {
  human: "✓",
  unclear: "?",
  "likely-ai": "▲",
  ai: "🤖",
};

/** Results keyed by badge, so the panel is built only when actually opened. */
const RESULTS = new WeakMap<HTMLElement, DetectionResult>();

let openPanel: HTMLElement | null = null;
let openFor: HTMLElement | null = null;

/** Build the badge button for a detection result. */
export function createBadge(result: DetectionResult): HTMLElement {
  const badge = document.createElement("button");
  badge.type = "button";
  // Nothing found is not worth a chip on every tweet in the timeline. The badge
  // stays (so "scored 0" never looks like "extension isn't running") but shrinks
  // to a faded tick that only shows its number on hover or click.
  const quiet = result.verdict === "human" ? " slopd-badge--quiet" : "";
  badge.className = `slopd-badge ${VERDICT_CLASS[result.verdict]}${quiet}`;
  badge.setAttribute("data-slopd", "badge");
  badge.setAttribute("aria-expanded", "false");
  badge.setAttribute("aria-label", `${result.summary} Show the lines that scored.`);
  // Always advertise the click: with no hits the panel still explains why.
  badge.title = `${result.summary}\nClick to see how this was scored.`;

  const icon = document.createElement("span");
  icon.className = "slopd-badge__icon";
  icon.textContent = VERDICT_ICON[result.verdict];

  const label = document.createElement("span");
  label.className = "slopd-badge__label";
  label.textContent = `AI ${result.score}%`;

  badge.appendChild(icon);
  badge.appendChild(label);

  RESULTS.set(badge, result);

  // Any click inside a tweet navigates to it on X, so swallow ours completely.
  badge.addEventListener("mousedown", swallow);
  badge.addEventListener("mouseup", swallow);
  badge.addEventListener("click", onBadgeClick);

  return badge;
}

function swallow(e: Event): void {
  e.stopPropagation();
}

function onBadgeClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const badge = e.currentTarget as HTMLElement;
  if (openFor === badge) {
    closePanel(); // second click closes
    return;
  }
  closePanel();
  const result = RESULTS.get(badge);
  if (!result) return;

  // Host in the page, contents in a shadow root: out of reach of both X's
  // overflow clipping and its CSS.
  const host = document.createElement("div");
  host.setAttribute("data-slopd", "panel-host");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);
  shadow.appendChild(buildPanel(result));

  openPanel = host;
  document.body.appendChild(host);
  position(host, badge);
  openFor = badge;
  badge.setAttribute("aria-expanded", "true");
  listen(true);
}

export function closePanel(): void {
  if (openPanel) {
    openPanel.remove();
    openPanel = null;
  }
  if (openFor) {
    openFor.setAttribute("aria-expanded", "false");
    openFor = null;
  }
  listen(false);
}

function listen(on: boolean): void {
  const fn = on ? "addEventListener" : "removeEventListener";
  document[fn]("click", onDocumentClick, true);
  document[fn]("keydown", onKeydown, true);
  // The panel is positioned in viewport coordinates, so it can't follow the
  // timeline. Closing is less jarring than letting it drift.
  window[fn]("scroll", closePanel, true);
  window[fn]("resize", closePanel);
}

// Typed as plain Event: these are registered through a dynamic
// add/removeEventListener pair, which erases the specific event overload.
function onDocumentClick(e: Event): void {
  const t = e.target as Node | null;
  if (openPanel && t && (openPanel === t || openPanel.contains(t))) return;
  if (openFor && t && (openFor === t || openFor.contains(t))) return;
  closePanel();
}

function onKeydown(e: Event): void {
  if ((e as KeyboardEvent).key === "Escape") {
    const badge = openFor;
    closePanel();
    badge?.focus();
  }
}

/** Place the panel above the badge, flipping below and clamping to the viewport. */
function position(panel: HTMLElement, badge: HTMLElement): void {
  const b = badge.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const margin = 8;

  let top = b.top - p.height - margin;
  if (top < margin) top = Math.min(b.bottom + margin, window.innerHeight - p.height - margin);

  let left = b.left;
  const maxLeft = window.innerWidth - p.width - margin;
  if (left > maxLeft) left = maxLeft;
  if (left < margin) left = margin;

  panel.style.top = `${Math.max(margin, top)}px`;
  panel.style.left = `${left}px`;
}

/* ------------------------------------------------------------------ *
 * Panel contents
 * ------------------------------------------------------------------ */

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text; // never innerHTML: tweet text is untrusted
  return node;
}

/** Put something readable back where normalization left a placeholder. */
function display(s: string): string {
  return s.split(HASHTAG_TOKEN).join("#…").split(HANDLE_TOKEN).join("@…").replace(/\s+/g, " ");
}

const MAX_HITS = 6;
const MAX_QUOTES_PER_HIT = 2;
const MAX_CONTEXT = 80;

/**
 * The sentence containing a match, clipped either side of it. Returned in three
 * pieces so the matched span can be marked without touching innerHTML.
 */
function quoteAround(
  text: string,
  start: number,
  end: number
): { pre: string; hit: string; post: string } {
  let s = start;
  let e = end;
  while (s > 0 && !/[.!?]/.test(text[s - 1])) s--;
  while (e < text.length && !/[.!?]/.test(text[e])) e++;
  if (e < text.length) e++; // keep the terminator

  let pre = text.slice(s, start);
  let post = text.slice(end, e);
  if (pre.length > MAX_CONTEXT) pre = "…" + pre.slice(-MAX_CONTEXT);
  else if (s > 0) pre = "…" + pre;
  if (post.length > MAX_CONTEXT) post = post.slice(0, MAX_CONTEXT) + "…";
  else if (e < text.length) post = post + "…";

  return { pre: display(pre), hit: display(text.slice(start, end)), post: display(post) };
}

function buildHitBlock(hit: SignalHit, text: string): HTMLElement {
  const block = el("div", "slopd-hit");

  const head = el("div", "slopd-hit__head");
  head.appendChild(el("span", "slopd-hit__label", hit.label));
  const pts = el("span", "slopd-hit__pts", `+${hit.points}`);
  pts.title = `Contributed ${hit.points} points${hit.count > 1 ? ` across ${hit.count} matches` : ""}`;
  head.appendChild(pts);
  block.appendChild(head);

  for (const m of hit.matches.slice(0, MAX_QUOTES_PER_HIT)) {
    const { pre, hit: matched, post } = quoteAround(text, m.start, m.end);
    const quote = el("blockquote", "slopd-quote");
    quote.appendChild(document.createTextNode(pre));
    quote.appendChild(el("mark", "slopd-mark", matched));
    quote.appendChild(document.createTextNode(post));
    block.appendChild(quote);
  }

  if (hit.matches.length > MAX_QUOTES_PER_HIT) {
    block.appendChild(
      el("div", "slopd-hit__more", `+${hit.matches.length - MAX_QUOTES_PER_HIT} more like this`)
    );
  }

  block.appendChild(el("div", "slopd-hit__why", hit.why));
  return block;
}

function buildPanel(result: DetectionResult): HTMLElement {
  const panel = el("div", "slopd-panel");
  panel.setAttribute("data-slopd", "panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "AI writing signals in this post");

  const head = el("div", "slopd-panel__head");
  head.appendChild(el("span", `slopd-panel__verdict slopd-panel__verdict--${result.verdict}`, `${VERDICT_ICON[result.verdict]} ${result.summary.split(" — ")[0].split(" (")[0]}`));
  head.appendChild(el("span", "slopd-panel__score", `${result.score}/100`));
  panel.appendChild(head);

  const close = el("button", "slopd-panel__close", "×");
  close.setAttribute("aria-label", "Close");
  (close as HTMLButtonElement).type = "button";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    closePanel();
  });
  panel.appendChild(close);

  if (result.hits.length === 0) {
    panel.appendChild(
      el(
        "div",
        "slopd-panel__none",
        "No AI writing tells found in this post. That is not proof it was written by a person — plain, specific writing simply leaves no tells."
      )
    );
  } else {
    panel.appendChild(
      el("div", "slopd-panel__lead", `${result.hits.length} signal${result.hits.length > 1 ? "s" : ""} contributed to this score:`)
    );
    const body = el("div", "slopd-panel__body");
    for (const hit of result.hits.slice(0, MAX_HITS)) body.appendChild(buildHitBlock(hit, result.normalizedText));
    panel.appendChild(body);
    if (result.hits.length > MAX_HITS) {
      panel.appendChild(
        el("div", "slopd-panel__more", `+${result.hits.length - MAX_HITS} weaker signals not shown`)
      );
    }
  }

  panel.appendChild(
    el("div", "slopd-panel__foot", "Heuristic estimate from the not-ai skill. Writing patterns, not proof.")
  );

  // Clicks inside the panel must not reach X's tweet-wide click handler.
  panel.addEventListener("click", swallow);
  panel.addEventListener("mousedown", swallow);
  return panel;
}
