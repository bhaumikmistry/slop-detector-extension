/**
 * Content script.
 *
 * Finds tweets on x.com / twitter.com, extracts their text, scores them with
 * the detector, and injects a small badge next to the tweet's action bar.
 *
 * The X timeline is a virtualized, constantly-mutating React DOM, so we:
 *  - use a MutationObserver to catch new tweets as they stream in,
 *  - debounce processing into an animation frame,
 *  - key each badge to a hash of the tweet's text rather than a "done" flag,
 *    so a recycled <article> that now holds a different tweet is re-scored and
 *    a badge React wiped during a re-render is put back.
 */

import { detectAiText } from "@slop-detector/slop-detector";
import { createBadge } from "./badge";

/** Hash of the text the current badge was built from ("none" = nothing to score). */
const HASH_ATTR = "data-slopd-hash";
/** How many times we've waited for this tweet to finish rendering. */
const RETRY_ATTR = "data-slopd-retry";
const MAX_RETRIES = 5;

const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const WRAP_SELECTOR = "[data-slopd-wrap]";

/**
 * Set true to inject nothing at all on posts with no tells, instead of the
 * faded tick. Off by default: with no badge there is no way to tell "scored 0"
 * apart from "the extension stopped working".
 */
const HIDE_CLEAN_POSTS = false;

/** FNV-1a — small, fast, and good enough to notice "this is different text". */
function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Pull the human-readable text of a tweet, excluding quoted tweets' chrome. */
function extractTweetText(article: HTMLElement): string {
  const nodes = article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]');
  if (!nodes.length) return "";
  // The first tweetText block is the author's own text; later ones can be
  // quoted tweets. Score only the primary text to keep the signal clean.
  return (nodes[0].innerText || nodes[0].textContent || "").trim();
}

/** Find the best anchor to place the badge near (the timestamp / action row). */
function findBadgeAnchor(article: HTMLElement): HTMLElement | null {
  // Prefer the group of action buttons (reply/retweet/like) footer.
  const actions = article.querySelector<HTMLElement>('[role="group"]');
  if (actions) return actions;
  // Fallback: the time element's parent (header row).
  const time = article.querySelector("time");
  if (time && time.parentElement) return time.parentElement;
  return null;
}

/**
 * Badges belonging to *this* tweet. A quoted or nested tweet renders its own
 * article, and its badge must not be mistaken for ours.
 */
function ownWraps(article: HTMLElement): HTMLElement[] {
  return Array.from(article.querySelectorAll<HTMLElement>(WRAP_SELECTOR)).filter(
    (w) => w.closest(TWEET_SELECTOR) === article
  );
}

function processTweet(article: HTMLElement): void {
  const text = extractTweetText(article);
  const key = text.length >= 3 ? hashText(text) : "none";
  const wraps = ownWraps(article);

  // Already correct: same text, and our badge is still on screen.
  if (article.getAttribute(HASH_ATTR) === key && (key === "none" || wraps.length === 1)) {
    return;
  }

  // Otherwise the node was recycled for a different tweet, or React re-rendered
  // the footer out from under us. Either way, start clean.
  wraps.forEach((w) => w.remove());

  if (key === "none") {
    article.setAttribute(HASH_ATTR, key); // image-only tweet: nothing to score
    return;
  }

  const result = detectAiText(text);
  if (HIDE_CLEAN_POSTS && result.verdict === "human") {
    article.setAttribute(HASH_ATTR, key);
    return;
  }

  const anchor = findBadgeAnchor(article);
  if (!anchor || !anchor.parentElement) {
    // Still rendering. Leave it unmarked so the next pass retries, but cap the
    // retries so a permanently anchor-less tweet isn't re-examined forever.
    const tries = Number(article.getAttribute(RETRY_ATTR) || 0) + 1;
    article.setAttribute(RETRY_ATTR, String(tries));
    if (tries >= MAX_RETRIES) article.setAttribute(HASH_ATTR, key);
    return;
  }
  article.removeAttribute(RETRY_ATTR);

  const wrap = document.createElement("div");
  wrap.className = "slopd-badge-wrap";
  wrap.setAttribute("data-slopd-wrap", "");
  wrap.appendChild(createBadge(result));

  // Insert after the action group so it sits at the end of the footer row.
  anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
  article.setAttribute(HASH_ATTR, key);
}

function scan(root: ParentNode = document): void {
  const tweets = root.querySelectorAll<HTMLElement>(TWEET_SELECTOR);
  tweets.forEach(processTweet);
}

// ---- Debounced observer wiring ----

let scheduled = false;
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

function start(): void {
  scan();
  // The observer is the workhorse: it covers new tweets, re-renders, and X's
  // client-side navigation alike. (Patching history.pushState would not help —
  // content scripts run in an isolated world, so the page's own pushState calls
  // never reach a copy patched from here.)
  const observer = new MutationObserver(() => schedule());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
}

if (document.body) {
  start();
} else {
  document.addEventListener("DOMContentLoaded", start, { once: true });
}
