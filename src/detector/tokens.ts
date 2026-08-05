/**
 * Placeholder characters substituted during normalization.
 *
 * `@handles` and `#hashtags` are removed before matching so a link or username
 * can't trip a word detector (`#delve`), but *how many* hashtags a post ends
 * with is itself a signal. So rather than deleting them we swap in a private-use
 * character: invisible to every word pattern, still countable by its own.
 */
export const HANDLE_TOKEN = "";
export const HASHTAG_TOKEN = "";
