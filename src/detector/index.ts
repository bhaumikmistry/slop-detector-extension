/**
 * Public entry point for the AI-slop detector library.
 *
 * Usage:
 *   import { detectAiText } from "./detector";
 *   const result = detectAiText("This tapestry of innovation serves as a testament...");
 *   console.log(result.score, result.verdict, result.hits);
 */

export { detectAiText, normalize } from "./detector";
export { SIGNALS } from "./patterns";
export { HANDLE_TOKEN, HASHTAG_TOKEN } from "./tokens";
export type {
  DetectionResult,
  DetectorOptions,
  MatchRange,
  SignalCategory,
  SignalDefinition,
  SignalHit,
  Verdict,
} from "./types";
