/**
 * Scoring engine.
 *
 * Turns the raw signal hits into a bounded 0-100 likelihood using a
 * saturating (diminishing-returns) curve, then applies a short-text
 * confidence penalty and maps the result to a verdict.
 */

import { SIGNALS } from "./patterns";
import { HANDLE_TOKEN, HASHTAG_TOKEN } from "./tokens";
import type {
  DetectionResult,
  DetectorOptions,
  SignalCategory,
  SignalDefinition,
  SignalHit,
  Verdict,
} from "./types";

const DEFAULTS: Required<DetectorOptions> = {
  minReliableWords: 12,
  thresholds: { unclear: 25, likelyAi: 50, ai: 75 },
  // Tuned against the corpus in corpus.test.ts: low enough that three fancy
  // words alone stay under "likely-ai", high enough not to blunt real slop.
  decay: { vocabulary: 0.75, promo: 0.55 },
};

/**
 * Tie-break order when two signals of equal weight fight over the same span:
 * multi-word constructions are more specific evidence than a single word.
 */
const CATEGORY_PRIORITY: Record<SignalCategory, number> = {
  cluster: -1, // derived, never competes for a span
  structure: 0,
  phrase: 1,
  promo: 2,
  attribution: 3,
  puffery: 4,
  punctuation: 5,
  vocabulary: 6,
};

/** Vocabulary clustering: how many distinct flagged words before it counts. */
const CLUSTER_MIN = 3;
const CLUSTER_STEP = 4;
const CLUSTER_CAP = 16;

/** Half-open character range [start, end) of one match in the normalized text. */
interface Span {
  start: number;
  end: number;
  text: string;
}

/**
 * Normalize text before matching. We strip URLs, @handles and #hashtags so
 * that, e.g., a link containing "landscape" doesn't trip the vocab detector,
 * and collapse whitespace. We keep punctuation (needed for em-dash detection).
 */
export function normalize(text: string): string {
  return (
    text
      .replace(/https?:\/\/\S+/gi, " ")
      // Straighten typographic punctuation first. Phones and ChatGPT both emit
      // curly apostrophes, and without this every pattern containing an "'"
      // ("it's not just", "here's the news") silently misses on real text.
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/@\w+/g, ` ${HANDLE_TOKEN} `)
      .replace(/#\w+/g, ` ${HASHTAG_TOKEN} `)
      .replace(/\s+/g, " ")
      .trim()
  );
}

function countWords(text: string): number {
  const m = text.match(/\b[\w'-]+\b/g);
  return m ? m.length : 0;
}

/** All non-empty matches of `re` in `text`, with their positions. */
function findMatches(text: string, re: RegExp): Span[] {
  // Clone with a fresh lastIndex so we never mutate the shared regex state.
  const clone = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = clone.exec(text)) !== null) {
    if (m[0].length === 0) {
      clone.lastIndex++; // guard against zero-width matches looping forever
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

function overlapsAny(span: Span, claimed: Span[]): boolean {
  return claimed.some((c) => span.start < c.end && span.end > c.start);
}

function toExamples(spans: Span[], limit = 3): string[] {
  return spans.slice(0, limit).map((s) => {
    // Put something readable back where normalization left a placeholder.
    const t = s.text
      .split(HASHTAG_TOKEN)
      .join("#…")
      .split(HANDLE_TOKEN)
      .join("@…")
      .replace(/\s+/g, " ")
      .trim();
    return t.length > 40 ? t.slice(0, 37) + "…" : t;
  });
}

function pointsFor(def: SignalDefinition, count: number): number {
  if (count <= 0) return 0;
  const perExtra = def.perExtra ?? 0;
  const maxExtra = def.maxExtra ?? perExtra * 2;
  const extra = Math.min((count - 1) * perExtra, maxExtra);
  return def.weight + extra;
}

/**
 * Convert an unbounded raw score into 0-100 with diminishing returns.
 * rawScore of ~30 -> ~60, ~60 -> ~82, ~100 -> ~92. This keeps a single
 * strong tell from maxing the meter while rewarding stacked evidence.
 */
function saturate(raw: number): number {
  // 1 - e^(-raw/k); k controls how fast it climbs.
  const k = 33;
  const v = 100 * (1 - Math.exp(-raw / k));
  return Math.round(v);
}

function toVerdict(score: number, t: Required<DetectorOptions>["thresholds"]): Verdict {
  if (score >= t.ai) return "ai";
  if (score >= t.likelyAi) return "likely-ai";
  if (score >= t.unclear) return "unclear";
  return "human";
}

const VERDICT_LABEL: Record<Verdict, string> = {
  human: "Looks human-written",
  unclear: "A few AI tells",
  "likely-ai": "Likely AI-assisted",
  ai: "Strong AI signals",
};

/**
 * Analyze a piece of text and return an AI-assistance likelihood score.
 *
 * @param rawText  The tweet/post text.
 * @param options  Optional threshold / reliability overrides.
 */
export function detectAiText(
  rawText: string,
  options: DetectorOptions = {}
): DetectionResult {
  const opts: Required<DetectorOptions> = {
    minReliableWords: options.minReliableWords ?? DEFAULTS.minReliableWords,
    thresholds: options.thresholds ?? DEFAULTS.thresholds,
    decay: options.decay ?? DEFAULTS.decay,
  };

  const text = normalize(rawText || "");
  const wordCount = countWords(text);

  // Signals compete for the text. The heaviest signal claims its span first,
  // and any weaker signal overlapping a claimed span is dropped — so "a vibrant
  // tapestry of" is billed once as the phrase, not again as "tapestry" and
  // "vibrant", and "delving into" isn't charged as both a word and a verb.
  const byPriority = SIGNALS.map((def, index) => ({ def, index })).sort(
    (a, b) =>
      b.def.weight - a.def.weight ||
      // On equal weight the more specific signal wins, so "plays a pivotal
      // role" claims the span instead of the bare word "pivotal".
      CATEGORY_PRIORITY[a.def.category] - CATEGORY_PRIORITY[b.def.category] ||
      a.index - b.index
  );

  const claimed: Span[] = [];
  const hits: SignalHit[] = [];

  for (const { def } of byPriority) {
    const kept = findMatches(text, def.pattern).filter((m) => !overlapsAny(m, claimed));
    if (kept.length === 0) continue;
    claimed.push(...kept);
    hits.push({
      id: def.id,
      label: def.label,
      category: def.category,
      why: def.why,
      count: kept.length,
      examples: toExamples(kept),
      matches: kept.map(({ start, end }) => ({ start, end })),
      points: pointsFor(def, kept.length),
    });
  }

  // Strongest first, so the decay below spends its full weight on the best
  // evidence rather than on whichever word happened to be defined first.
  hits.sort((a, b) => b.points - a.points);

  let raw = 0;
  const rank: Partial<Record<SignalCategory, number>> = {};
  for (const hit of hits) {
    const d = opts.decay[hit.category];
    if (d !== undefined) {
      const n = rank[hit.category] ?? 0;
      // Floor at 1: a signal we list in the tooltip should never read as
      // contributing nothing at all.
      hit.points = Math.max(1, Math.round(hit.points * Math.pow(d, n)));
      rank[hit.category] = n + 1;
    }
    raw += hit.points;
  }
  // The skill's clustering rule: "One alone is forgivable. Three in a paragraph
  // is a tell." Decay deliberately flattens each additional word; this adds the
  // cluster itself back as its own piece of evidence, so a pile-up of fancy
  // vocabulary reads as one strong signal rather than N weak ones.
  const vocabHits = hits.filter((h) => h.category === "vocabulary");
  if (vocabHits.length >= CLUSTER_MIN) {
    const points = Math.min(CLUSTER_CAP, CLUSTER_STEP * (vocabHits.length - (CLUSTER_MIN - 1)));
    raw += points;
    hits.push({
      id: "vocab.cluster",
      label: `AI vocabulary cluster (${vocabHits.length} words)`,
      category: "cluster",
      why: `The skill's rule of thumb: one flagged word is forgivable, three clustered together is a tell. This post has ${vocabHits.length}.`,
      count: vocabHits.length,
      examples: vocabHits.map((h) => h.examples[0]).filter(Boolean).slice(0, 4),
      matches: vocabHits.map((h) => h.matches[0]).filter(Boolean).slice(0, 3),
      points,
    });
  }

  hits.sort((a, b) => b.points - a.points); // re-sort: decay reshuffles the order

  let score = saturate(raw);

  // Short-text confidence penalty: scale the score down for very short posts,
  // where a single tell is weak evidence. A 6-word tweet with one em dash
  // shouldn't read as "AI".
  if (wordCount < opts.minReliableWords) {
    const factor = Math.max(0.4, wordCount / opts.minReliableWords);
    score = Math.round(score * factor);
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = toVerdict(score, opts.thresholds);

  const topLabels = hits.slice(0, 3).map((h) => h.label.replace(/^[^:]+:\s*/, ""));
  const summary =
    hits.length === 0
      ? `${VERDICT_LABEL[verdict]} — no AI tells found.`
      : `${VERDICT_LABEL[verdict]} (${score}/100). Top signals: ${topLabels.join(", ")}.`;

  return { score, verdict, hits, wordCount, normalizedText: text, summary };
}
