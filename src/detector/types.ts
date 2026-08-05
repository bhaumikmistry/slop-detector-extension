/**
 * Type definitions for the AI-slop detector.
 *
 * The detector ports the heuristics from the `not-ai` agent skill
 * (https://github.com/bhaumikmistry/bhaumik-agent-skills/tree/main/skills/not-ai)
 * into a small, dependency-free scoring engine. Each "signal" is one
 * anti-pattern the skill teaches you to remove from machine-generated text;
 * here we instead *detect* them and turn them into a 0-100 likelihood score.
 */

/** Broad category a signal belongs to. Useful for grouping in the UI. */
export type SignalCategory =
  | "vocabulary" // individual AI-favored words
  | "phrase" // multi-word AI-favored phrases
  | "structure" // sentence-level constructions (parallelism, rule-of-three)
  | "punctuation" // punctuation habits (em dashes, etc.)
  | "attribution" // vague sourcing ("experts argue")
  | "puffery" // generic promotional praise
  | "promo" // launch/announcement register (founder-post voice)
  | "cluster"; // derived: several tells of one kind piling up

/** Definition of a single detectable pattern. */
export interface SignalDefinition {
  /** Stable identifier, e.g. "vocab.delve". */
  id: string;
  /** Human-readable label shown in the details table. */
  label: string;
  category: SignalCategory;
  /** Regex used to find occurrences. MUST be global (`g`) and case-insensitive where relevant. */
  pattern: RegExp;
  /**
   * Points awarded for the FIRST match of this signal.
   * Weights are tuned so a single weak signal barely moves the needle,
   * while several strong signals together push the score high.
   */
  weight: number;
  /**
   * Additional points for each match beyond the first, capped by `maxExtra`.
   * Repetition of the same tell is evidence, but with diminishing returns.
   */
  perExtra?: number;
  /** Cap on total extra points from repeats. Defaults to 2 * perExtra. */
  maxExtra?: number;
  /** Short explanation of why this is an AI tell (shown on hover). */
  why: string;
}

/** A concrete hit found in the analyzed text. */
export interface SignalHit {
  id: string;
  label: string;
  category: SignalCategory;
  why: string;
  /** Number of times this pattern matched. */
  count: number;
  /** Up to a few example substrings that matched, for display. */
  examples: string[];
  /**
   * Where each match landed, as [start, end) offsets into
   * `DetectionResult.normalizedText`. Lets a UI quote the line that scored and
   * highlight the exact span, instead of just naming the signal.
   */
  matches: MatchRange[];
  /** Points this signal contributed to the raw score. */
  points: number;
}

/** Half-open [start, end) range into the normalized text. */
export interface MatchRange {
  start: number;
  end: number;
}

/** Qualitative bucket derived from the numeric score. */
export type Verdict = "human" | "unclear" | "likely-ai" | "ai";

export interface DetectionResult {
  /** Final AI-assistance likelihood, 0-100. */
  score: number;
  verdict: Verdict;
  /** All signals that fired, sorted by points descending. */
  hits: SignalHit[];
  /** Number of words analyzed (short texts are scored more cautiously). */
  wordCount: number;
  /**
   * The text the signals were actually matched against — URLs removed, handles
   * and hashtags replaced by placeholders, whitespace collapsed. All offsets in
   * `hits[].matches` index into this string.
   */
  normalizedText: string;
  /** Human-readable one-line summary for tooltips. */
  summary: string;
}

export interface DetectorOptions {
  /**
   * Texts shorter than this many words get a confidence penalty, since a
   * couple of tells in a 6-word tweet is thin evidence.
   */
  minReliableWords?: number;
  /** Thresholds for mapping score -> verdict. */
  thresholds?: {
    unclear: number; // >= this is "unclear"
    likelyAi: number; // >= this is "likely-ai"
    ai: number; // >= this is "ai"
  };
  /**
   * Per-category decay (0-1) applied across successive *distinct* hits in that
   * category: the strongest counts in full, the next at `d`, the third at `d²`.
   * Categories absent from the map are not decayed.
   *
   * Two categories need it. Without `vocabulary`, three merely-fancy words
   * ("renowned", "robust", "pivotal") in an ordinary sentence add up to a
   * "likely-ai" verdict on their own. Without `promo` — decayed harder, since
   * humans do write launch posts unaided — announcement register alone would
   * read as confidently machine-written. Structural tells are never decayed:
   * stacked *constructions* really are strong evidence.
   */
  decay?: Partial<Record<SignalCategory, number>>;
}
