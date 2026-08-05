/**
 * Corpus regression tests.
 *
 * The unit tests in detector.test.ts check that each pattern fires; these check
 * that the *scores* stay sensible on realistic text. Every case below was a
 * real miss or false positive at some point — keep them passing when tuning
 * weights, and add a line here whenever tuning breaks something in the wild.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAiText } from "./detector";

const score = (t: string) => detectAiText(t).score;

/** Ordinary human tweets — none of these should read as AI. */
const HUMAN = [
  "just got back from lunch, the tacos were great lol",
  "shipped the fix. turned out the cache key was wrong. moving on.",
  "why does every airline app have the worst possible date picker",
  "spent 3 hours debugging only to find i was on the wrong branch. classic.",
  "we cut p99 latency from 1.2s to 340ms by moving the JSON parse off the hot path. no rewrite, no new infra.",
  "reading the postgres docs on MVCC for the third time and finally something clicked — vacuum isn't garbage collection, it's tombstone cleanup",
  "genuinely think the best engineers i've worked with were the ones who deleted the most code",
  "watched dune part two again. still holds up. the sound design is unreal.",
];

/** Recognisably machine-written text. */
const AI = [
  "In the realm of technology, this groundbreaking platform serves as a testament to innovation. It's not just a tool, but a vibrant tapestry of possibilities.",
  "As we navigate this ever-evolving landscape, it's important to note that leveraging cutting-edge solutions can unlock unprecedented value for stakeholders.",
  "This meticulously crafted product showcases a myriad of innovative, dynamic, and transformative features, highlighting the importance of seamless integration.",
  "Experts argue that remote work plays a pivotal role in fostering a more holistic and nuanced approach to work-life balance in today's fast-paced world.",
  "Let's delve into the intricate world of quantum computing — a realm where the impossible becomes possible. In conclusion, the future is bright.",
];

test("human tweets never reach likely-ai", () => {
  for (const t of HUMAN) {
    const r = detectAiText(t);
    assert.ok(r.score < 25, `expected < 25, got ${r.score} for: ${t}`);
  }
});

test("AI text is at least flagged as unclear, mostly likely-ai", () => {
  const scores = AI.map(score);
  for (const [i, s] of scores.entries()) {
    assert.ok(s >= 25, `expected >= 25, got ${s} for: ${AI[i]}`);
  }
  const flagged = scores.filter((s) => s >= 50).length;
  assert.ok(flagged >= 4, `expected >= 4 of ${AI.length} at likely-ai, got ${flagged}`);
});

test("human and AI corpora stay well separated", () => {
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(avg(AI.map(score)) - avg(HUMAN.map(score)) > 40);
});

// ---- Specific regressions ----

test("inflected AI vocabulary is caught, not just the lemma", () => {
  for (const [base, inflected] of [
    ["Let us delve into the topic with care and attention to detail here.", "Delving into the topic with care and attention to detail here today."],
    ["We leverage the platform to build a better product for our customers.", "We leveraged the platform to build a better product for our customers."],
    ["This underscores the need for a better product for all our customers.", "This is underscoring the need for a better product for our customers."],
  ]) {
    assert.ok(score(inflected) > 0, `inflected form scored 0: ${inflected}`);
    assert.ok(
      Math.abs(score(inflected) - score(base)) <= 5,
      `inflection scored very differently: ${score(base)} vs ${score(inflected)}`
    );
  }
});

test("negative parallelism is caught with a dash or period, not only 'but'", () => {
  const variants = [
    "This is not just a phone, but a lifestyle companion for everyone today.",
    "This is not just a phone — it is a lifestyle companion for everyone today.",
    "This is not just a phone. It is a lifestyle companion for everyone today.",
  ];
  for (const v of variants) {
    const r = detectAiText(v);
    assert.ok(
      r.hits.some((h) => h.id === "structure.negative_parallelism"),
      `missed parallelism in: ${v}`
    );
  }
});

test("rule of three catches lists the suffix rule misses", () => {
  for (const t of [
    "The design is fast, simple, and secure across the whole board today.",
    "It reshapes how we work, live, and create in the modern world today.",
  ]) {
    assert.ok(
      detectAiText(t).hits.some((h) => h.id.startsWith("structure.rule_of_three")),
      `missed triad in: ${t}`
    );
  }
});

test("a phrase is not billed twice as its component words", () => {
  const r = detectAiText("It is a rich tapestry of ideas that runs through the whole project here.");
  const ids = r.hits.map((h) => h.id);
  assert.ok(ids.includes("phrase.tapestry_of"), "expected the phrase to fire");
  assert.ok(!ids.includes("vocab.tapestry"), "the word inside the phrase should be suppressed");
});

test("the more specific signal wins a tie over a bare word", () => {
  const r = detectAiText("This decision plays a pivotal role in how the whole team operates daily.");
  const ids = r.hits.map((h) => h.id);
  assert.ok(ids.includes("phrase.play_a_role"));
  assert.ok(!ids.includes("vocab.pivotal"));
});

test("a few fancy words are suspicious but not damning", () => {
  // Three flagged words, no structural tells. Two rules pull in opposite
  // directions here and the balance between them is deliberate: vocabulary
  // decay says a pile of words is weak evidence, while the skill's clustering
  // rule says "one alone is forgivable, three in a paragraph is a tell". The
  // result should land near the likely-ai line without ever reading as a
  // confident "ai" — this sentence is one a person could plausibly write.
  const r = detectAiText(
    "she's a renowned researcher and her work on robust distributed systems is genuinely pivotal to the field"
  );
  assert.ok(r.score < 60, `expected < 60, got ${r.score}`);
  assert.notEqual(r.verdict, "ai");
  assert.ok(r.hits.some((h) => h.id === "vocab.cluster"), "the cluster itself should be reported");
});

// ---- Coverage of the not-ai rubric ----

/**
 * One case per section of the skill's anti-pattern catalog. If a section here
 * stops firing, the port has drifted away from the rubric it claims to implement.
 *
 * Deliberately out of scope, because a tweet can't express them: title case in
 * headings, mechanical boldface, inline-header lists, outline rigidity, and
 * elegant variation (which needs a document-length repetition measure).
 */
const RUBRIC: [section: string, text: string, expectId: string][] = [
  ["vocabulary kill list", "The interplay here is crucial and the results are valuable.", "vocab.crucial"],
  ["promotional register", "Nestled in the hills, the town boasts a rich history worth seeing.", "vocab.nestled"],
  ["travel-guide opener", "Located in the heart of the city, it draws visitors from everywhere.", "phrase.in_the_heart_of"],
  ["Grok-specific overuse", "The empirical data shows a causal link that correlates across groups.", "vocab.empirical"],
  ['"concrete" in discussion', "There is no concrete evidence for that claim anywhere at all.", "phrase.concrete"],
  ["significance bloat", "The award underscores the importance of the work being done here.", "structure.significance_bloat"],
  ["copulative avoidance", "The museum features a collection of rare instruments from the period.", "phrase.copulative_avoidance"],
  ["negative parallelism", "It is not just a phone, but a companion for everyone who travels.", "structure.negative_parallelism"],
  ["negative triad", "No gimmicks, no shortcuts, just the work put in over many years.", "structure.no_x_no_y"],
  ['"X rather than Y"', "We are prioritizing depth rather than breadth in every single release.", "structure.rather_than"],
  ["rule of three", "It fosters creativity, collaboration, and critical thinking in students.", "structure.rule_of_three_any"],
  ["superficial -ing analysis", "They opened a new wing, cultivating a culture of excellence there.", "structure.ing_analysis"],
  ["vague attribution", "Industry reports suggest the trend will continue for several more years.", "attr.vague"],
  ["challenges-and-future", "Despite these challenges, the future looks bright for the whole team.", "structure.challenges_future"],
  ["collaborative leakage", "Let's explore why this matters for everyone building software today.", "structure.collaborative_leak"],
  ["didactic disclaimer", "It should be noted that the results were mixed across the board.", "phrase.it_is_important"],
  ["em dashes", "The results were clear — undeniable, in fact — and everyone noticed it.", "punct.em_dash"],
  ["puffery", "A world-class team delivering an unparalleled experience for everyone.", "puff.generic_praise"],
];

test("every section of the not-ai rubric is detected", () => {
  const missing: string[] = [];
  for (const [section, text, expectId] of RUBRIC) {
    const ids = detectAiText(text).hits.map((h) => h.id);
    if (!ids.includes(expectId)) missing.push(`${section} (expected ${expectId}, got: ${ids.join(",") || "nothing"})`);
  }
  assert.deepEqual(missing, [], `rubric sections not firing:\n  ${missing.join("\n  ")}`);
});

test("the clustering rule fires on three flagged words", () => {
  const r = detectAiText(
    "The robust and vibrant landscape here is genuinely pivotal for everyone involved."
  );
  const cluster = r.hits.find((h) => h.id === "vocab.cluster");
  assert.ok(cluster, "expected a cluster hit");
  assert.ok(cluster.count >= 3);
  assert.ok(
    detectAiText("The robust design here is good for everyone involved.").hits.every(
      (h) => h.id !== "vocab.cluster"
    ),
    "a single flagged word must not cluster"
  );
});

// ---- Promo / announcement register ----

/** Synthetic founder-announcement post, same register as the real thing. */
const ANNOUNCEMENT = `Some partnerships are built on shared coffee. Mine is built on a shared vision.

I backed them when most people said the at-home diagnostics market didn't exist. What followed changed how the country thinks about preventive care.

And this isn't "another healthcare startup." It's an attempt to rewrite the operating system of health itself.

So here's the news: I'm proud to be part of the founding team from day one. Most of all, I'm happy to be backing something that creates value for society.

#HealthTech #BuildingTheFuture #Startups`;

test("announcement register is flagged, but not as confidently machine-written", () => {
  const r = detectAiText(ANNOUNCEMENT);
  assert.ok(r.score >= 50, `expected >= 50, got ${r.score}`);
  assert.ok(r.score < 75, `promo register alone should not read as "ai", got ${r.score}`);
  const ids = r.hits.map((h) => h.id);
  for (const id of ["structure.its_not_about", "promo.announcement", "promo.hashtag_stack"]) {
    assert.ok(ids.includes(id), `expected ${id} to fire`);
  }
});

test("an isolated promo tell does not condemn an ordinary post", () => {
  // Humans write these unaided; one of them is not evidence of anything.
  for (const t of [
    "excited to share that I'm joining the platform team next month!",
    "proud to announce my kid finally slept through the night",
    "when everyone said the market was dead i bought more. worked out ok",
    "new blog post is up #dev #webdev #javascript",
  ]) {
    const r = detectAiText(t);
    assert.ok(r.score < 25, `expected < 25, got ${r.score} for: ${t}`);
  }
});

test("promo tells decay faster than structural ones", () => {
  const promo = detectAiText(ANNOUNCEMENT, { decay: { promo: 1 } }).score;
  assert.ok(promo > detectAiText(ANNOUNCEMENT).score, "decay should be pulling the score down");
});

// ---- Typographic punctuation ----

test("curly apostrophes score the same as straight ones", () => {
  for (const straight of [
    "It's not just a tool, but a vibrant tapestry of ideas for everyone here.",
    "It's important to note that this is a robust and seamless solution today.",
    "This isn't a product. It's a movement that will change the world entirely.",
  ]) {
    const curly = straight.replace(/'/g, "’");
    assert.equal(
      detectAiText(curly).score,
      detectAiText(straight).score,
      `curly form scored differently: ${straight}`
    );
    assert.ok(detectAiText(curly).score > 0, "expected the curly form to fire at all");
  }
});

test("hashtags still can't trigger word signals, but a stack of them counts", () => {
  assert.equal(detectAiText("check out #delve #tapestry").hits.length, 0);
  const stacked = detectAiText("great launch today #delve #tapestry #realm");
  assert.deepEqual(
    stacked.hits.map((h) => h.id),
    ["promo.hashtag_stack"]
  );
});

test("decay is tunable and monotonic", () => {
  const t = "A renowned, robust, and pivotal paradigm for the modern holistic enterprise.";
  assert.ok(
    detectAiText(t, { decay: { vocabulary: 0.5 } }).score <
      detectAiText(t, { decay: { vocabulary: 1 } }).score
  );
});
