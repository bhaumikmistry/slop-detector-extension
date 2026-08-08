# Slop Detector — spot AI-style slop writing

A Chrome (Manifest V3) extension that puts a small badge next to every post on
**x.com / twitter.com**, scoring how much it reads like **slop** — promotional,
essay-like, machine-flavoured writing — and showing you the exact lines that
scored.

The scoring engine is
[`@slop-detector/slop-detector`](https://www.npmjs.com/package/@slop-detector/slop-detector),
a standalone, dependency-free TypeScript library that ports the heuristics from
the [`not-ai` skill](https://github.com/bhaumikmistry/bhaumik-agent-skills/tree/main/skills/not-ai)
— the same anti-patterns the skill teaches you to *remove* are the ones we
*detect*.

> ### It is not an AI detector
>
> Measured against 3,500 AI-generated tweets from seven models and 20,000 real
> human tweets:
>
> | | Measured |
> |---|---|
> | False positives on real human tweets | **0.04%** at `≥25`, **0%** at `≥50` |
> | Recall on marketing / essay register | **~75%** |
> | Recall on a current model writing ordinary tweets | **0.2%** — 97% scored zero |
>
> It finds slop reliably and almost never accuses a human wrongly. It is blind
> to AI that writes concisely or casually, which is most AI text on social
> media. The badge answers *"does this read like slop?"*, not *"was this written
> by a machine?"*
>
> Full numbers, the rejected alternatives, and two measurement traps:
> [EVALUATION.md](https://github.com/bhaumikmistry/slop-detector/blob/main/EVALUATION.md).

## What it does

- Scans tweets on `x.com` / `twitter.com` as you scroll (handles the
  virtualized, constantly-rerendering timeline via a debounced `MutationObserver`).
- Scores each tweet 0–100 and shows a color-coded badge:
  - 🟢 **✓ human** (`< 25`) — rendered *quiet*: a faded tick with no number,
    since most posts have no tells and a chip on every tweet is just noise. The
    score appears on hover, and clicking still explains why nothing fired. It
    stays visible rather than disappearing so "scored 0" can't be mistaken for
    "the extension stopped working" — flip `HIDE_CLEAN_POSTS` in `content.ts`
    if you'd rather see nothing at all.
  - 🟡 **? unclear** (`25–49`)
  - 🟠 **▲ likely-ai** (`50–74`)
  - 🔴 **🤖 ai** (`≥ 75`)
- **Click the badge** to open a panel that shows its work: every signal that
  fired, what it cost, why it's a tell, and — most usefully — **the actual line
  from the post, quoted, with the matched span highlighted**. Nothing is taken
  on faith; you can see exactly which words moved the number.
- Signals span AI vocabulary, negative parallelism, rule-of-three, em dashes,
  vague attribution, puffery, and launch/announcement register.

> It's a **heuristic estimate, not proof.** It flags *writing patterns*
> characteristic of AI text; a human can write slop and an AI can write plainly.

## Rubric coverage

The detector implements every section of the skill's
[`anti-patterns.md`](https://github.com/bhaumikmistry/bhaumik-agent-skills/tree/main/skills/not-ai)
that a single post can express — vocabulary kill list, promotional and
travel-guide register, Grok-specific overuse, `"concrete"`, significance bloat,
copulative avoidance, negative parallelisms, rule of three, superficial `-ing`
analysis, vague attribution, the challenges-and-future formula, collaborative
leakage, didactic disclaimers, and em dashes. `corpus.test.ts` holds one case
per section, so a tuning pass can't quietly drop one.

Also implemented: the catalog's clustering rule — *"One alone is forgivable.
Three in a paragraph is a tell."* Three or more distinct flagged words add a
`vocab.cluster` signal on top of the individual words.

Four sections are deliberately **out of scope**, because a tweet can't express
them: title case in headings, mechanical boldface, inline-header lists, and
outline rigidity. A fifth — elegant variation (never repeating a word) — needs a
document-length repetition measure to mean anything and would be noise at tweet
length.

## How the score works

The detector library lives in [`src/detector/`](src/detector) and has no runtime
dependencies — you can lift it into any project.

```ts
import { detectAiText } from "./src/detector";

const r = detectAiText("This groundbreaking tool serves as a testament to seamless innovation.");
r.score;   // 0-100
r.verdict; // "human" | "unclear" | "likely-ai" | "ai"
r.hits;    // [{ id, label, category, count, examples, points, why }, ...]
r.summary; // one-line human-readable summary
```

Each pattern in [`patterns.ts`](src/detector/patterns.ts) is a regex + a weight.
Vocabulary entries are written as lemmas and expanded to their inflections, so
`delve` also catches *delves / delved / delving*. The engine
([`detector.ts`](src/detector/detector.ts)):

1. Strips URLs, straightens curly quotes and apostrophes (phones and ChatGPT
   both emit `’`, which would otherwise make every pattern containing an
   apostrophe miss), and swaps `@handles` / `#hashtags` for placeholders — so a
   link can't trip a word detector, while a stack of hashtags is still countable.
2. Lets signals **compete for spans**: the heaviest signal claims the text it
   matched, and weaker overlapping signals are dropped. "A vibrant tapestry of"
   is billed once as the phrase, not again as *tapestry* and *vibrant*. On equal
   weight the more specific construction wins ("plays a pivotal role" beats the
   bare word "pivotal").
3. Sums weighted points, with **diminishing returns** for repeats of the same tell.
4. Applies a per-category **`decay`** across *distinct* hits — the strongest
   counts in full, the next at `d`, the third at `d²`. Two categories use it:
   `vocabulary` (0.75), without which three merely-fancy words ("renowned",
   "robust", "pivotal") in an ordinary sentence add up to a "likely-ai" verdict
   on their own; and `promo` (0.55), decayed harder because humans genuinely
   write launch posts unaided. Structural tells are never decayed.
5. Runs the total through a saturating curve (`1 - e^-raw/k`) so one strong tell
   doesn't max the meter but stacked evidence climbs toward 100.
6. Applies a **short-text confidence penalty** — a couple of tells in a 6-word
   tweet is thin evidence and gets discounted.

Two of the six categories are worth calling out. `puffery` and `promo` detect
*marketing voice* rather than AI specifically — a founder writing their own
announcement reaches for exactly that register unaided. They're weighted lightly
and decayed hard so they can raise an eyebrow ("unclear" / "likely-ai") without
declaring a human post machine-written. Drop `promoSignals` from the `SIGNALS`
array, or pass `decay: { promo: 0 }`, if you want strictly AI-prose tells.

Tuning knobs (weights, thresholds, `minReliableWords`, `decay`) are all in
`patterns.ts` / passed via `DetectorOptions`. Add or adjust patterns by editing
the `SIGNALS` array — no other code changes needed. When you retune, run
`npm test`: [`corpus.test.ts`](src/detector/corpus.test.ts) holds a small
labeled corpus that catches over- and under-shooting on realistic text.

## Build & load

Requires Node 18+.

```bash
npm install      # esbuild, tsx, typescript, @types/node
npm run build    # bundles src/content -> dist/content.js (+ copies content.css)
```

Then load it in Chrome:

1. Go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select this project folder (the one with
   `manifest.json`).
4. Open [x.com](https://x.com) and scroll — badges appear on each tweet.

For iterating: `npm run watch` rebuilds on change (reload the extension +
refresh the tab to see updates).

## Develop

```bash
npm test        # runs the detector unit tests (node:test via tsx)
npm run typecheck
```

## Project layout

```
manifest.json            MV3 manifest (content script on x.com / twitter.com)
build.mjs                esbuild bundler (build + watch)
src/
  detector/              standalone, dependency-free scoring library
    types.ts             type definitions
    patterns.ts          the signal set (regex + weights) — edit this to tune
    tokens.ts            placeholders left by normalization (@handle, #hashtag)
    detector.ts          scoring engine (span claiming, decay, saturate, verdict)
    index.ts             public exports
    detector.test.ts     per-pattern unit tests
    corpus.test.ts       score regressions on realistic human vs AI text
  content/
    content.ts           finds tweets, scores them, injects badges
    badge.ts             badge button + the click-opened evidence panel
    content.css          badge styling, injected into the page (light/dark aware)
    panel.css            panel styling, bundled as text into the shadow root
icons/                   16/48/128 px icons
dist/                    build output (generated)
```

## Notes & limitations

- Selectors target X's current DOM (`article[data-testid="tweet"]`,
  `[data-testid="tweetText"]`). X changes its markup periodically; if badges
  stop appearing, update the selectors in `content.ts`.
- The panel is not rendered inside the tweet. It is a body-level host element
  with a **shadow root**, positioned in viewport coordinates: X clips overflow
  on its tweet containers (which crops anything nested) and transforms
  virtualized rows (which breaks `position: fixed` for descendants). The shadow
  root also stops X's stylesheets from restyling the panel's contents.
- Each badge is keyed to a hash of the tweet text, not a "processed" flag. X
  recycles `<article>` nodes as you scroll and re-renders footers when counts
  change, so the script re-scores a node whose text changed and re-injects a
  badge React removed — rather than leaving a stale score on the wrong tweet.
- Only the tweet author's primary text is scored — quoted tweets and images are
  ignored.
- Everything runs locally in the page. No network calls, no data leaves the
  browser. See [PRIVACY.md](PRIVACY.md) — the claims there are mechanically
  checkable against the shipped build, and the file says how.

---

Not affiliated with, endorsed by, or sponsored by X Corp. "X" and "Twitter" are
trademarks of their respective owners; this extension merely runs on their site.
