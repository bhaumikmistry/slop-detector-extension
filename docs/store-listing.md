# Chrome Web Store listing — copy & answers

Everything the submission form asks for, written out. Paste from here rather
than composing in the form, so the wording stays consistent across resubmissions.

**LIVE:** https://chromewebstore.google.com/detail/slop-detector-%E2%80%94-spot-ai-s/ekoihcfoakjdibdgdgfnbjaigdpfofhi

Privacy policy URL:
`https://github.com/bhaumikmistry/slop-detector-extension/blob/main/PRIVACY.md`

---

## Name

```
Slop Detector — spot AI-style slop
```

34 characters (limit 45). Deliberately does **not** lead with "for X" or use X
branding: store policy forbids listings that imply affiliation with another
brand, and that is the most common avoidable rejection.

## Short description (132 char limit)

```
Scores each post on how much it reads like slop and shows the exact lines that scored. Works on x.com and twitter.com.
```

118 characters. Says *slop*, not *AI-written* — that is what it measurably
detects, and overclaiming here is what earns one-star "it doesn't detect AI"
reviews. Matches `manifest.json` exactly — CI enforces the limit.

## Detailed description

```
Slop Detector puts a small badge next to every post on x.com and twitter.com,
scoring 0–100 how much the writing reads like slop — promotional, essay-like,
machine-flavoured prose.

Click any badge and it shows its work: which patterns fired, what each one cost,
why it is a tell, and the actual line from the post with the matched words
highlighted. The number is auditable — you can always see exactly what produced
it, and disagree with it.

WHAT IT LOOKS FOR

Patterns documented in the "not-ai" anti-pattern catalog, derived from
Wikipedia's "Signs of AI writing":

• AI vocabulary — delve, tapestry, pivotal, robust, nestled, and their variants
• Elaborate verbs used to avoid plain ones — "serves as" instead of "is"
• Negative parallelism — "not just X, but Y"
• The rule of three — "innovative, dynamic, and transformative"
• Tacked-on -ing analysis — "highlighting the importance of..."
• Vague attribution — "experts argue", "industry reports suggest"
• Significance bloat, em dashes, promotional puffery, and launch-post register

Posts with no tells get a quiet tick rather than a loud badge, so only the
things worth noticing draw your eye.

WHAT IT IS NOT

This is not an AI detector, and it does not claim to be. It was measured against
3,500 AI-generated tweets from seven models and 20,000 real human tweets:

• It almost never flags a human wrongly — 0.04% false positives
• It finds marketing and essay register well — around 75%
• It misses AI that writes casually — 97% of tweets from a current model scored
  zero

So it answers "does this read like slop?", not "was this written by a machine?"
The full evaluation, including the failures and two dataset traps, is published
in the repository.

Please do not use it to accuse anyone of anything.

PRIVACY

No network requests. No storage. No analytics. No accounts. No permissions
beyond the two sites it runs on. Everything happens locally in your browser, and
the entire source is public so you can check that claim rather than trust it.

OPEN SOURCE (MIT)

Extension: github.com/bhaumikmistry/slop-detector-extension
Scoring engine: npmjs.com/package/@slop-detector/slop-detector

Not affiliated with, endorsed by, or sponsored by X Corp.
```

## Category

Productivity — it is a reading/writing aid, not a developer tool or social
add-on.

---

## Single purpose statement

```
Slop Detector has one purpose: to annotate posts on x.com and twitter.com with a
heuristic score estimating how much the text reads like promotional, essay-like
"slop" writing, and to show the user which specific phrases produced that score.
```

## Permission justifications

The extension requests **no Chrome permissions** — both `permissions` and
`host_permissions` are empty in the manifest. Only content-script matches are
declared.

**Content script matches — `https://x.com/*`, `https://twitter.com/*`**

```
The extension reads the text of posts on these two sites in order to score them,
and inserts a badge element next to each post to display the result. Both
actions require running a content script in the page. No other host is matched,
and the extension has no capability on any other site.
```

**Remote code:** none. The extension executes no remotely hosted code. The
content script is a single bundled file shipped inside the package, and the
build contains no `eval` or `new Function`.

---

## Data safety declarations

Answer **"No"** to every data collection category:

| Category | Collected? |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

The last row is the one worth being careful about. The extension **reads** post
text in the page in order to score it, but does not *collect* it in the sense the
form means: nothing is transmitted off the device, written to storage, or
retained after the score is computed. It is processed in memory and discarded.

Then certify all three:

- ☑ Does not sell or transfer user data to third parties outside of approved use cases
- ☑ Does not use or transfer user data for purposes unrelated to the item's single purpose
- ☑ Does not use or transfer user data to determine creditworthiness or for lending purposes

---

## Pre-submission checklist

- [ ] `npm run package` → `build/slop-detector-extension.zip` (~17 kB)
- [ ] Load unpacked from the zip, scroll x.com, confirm badges appear and a
      panel opens with quoted lines
- [ ] 3–5 screenshots at 1280×800 (or 640×400)
- [ ] 440×280 small promo tile
- [ ] Privacy policy URL reachable (repo is public)
- [ ] Consider publishing **Unlisted** first to test the install flow

## If the reviewer pushes back

The two likely questions, and the honest answers:

**"Why does it need access to page content?"** It reads post text to score it.
That is the entire function; without it the extension does nothing. Nothing
leaves the device — verifiable in the public source.

**"Is this affiliated with X?"** No. The name avoids X branding, the icons
contain no X marks, and both the listing and the README carry an explicit
non-affiliation notice.
