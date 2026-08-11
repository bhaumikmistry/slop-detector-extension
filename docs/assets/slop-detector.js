// src/tokens.ts
var HANDLE_TOKEN = "\uE001";
var HASHTAG_TOKEN = "\uE000";

// src/patterns.ts
function sig(id, label, category, pattern, weight, why, extra) {
  return { id, label, category, pattern, weight, why, ...extra };
}
var VOCAB_WORDS = [
  ["delve", 14],
  ["tapestry", 16],
  ["landscape", 6],
  ["pivotal", 10],
  ["robust", 6],
  ["vibrant", 8],
  ["groundbreaking", 9],
  ["renowned", 9],
  ["realm", 7],
  ["testament", 10],
  ["underscore", 8],
  ["multifaceted", 10],
  ["nuanced", 6],
  ["intricate", 6],
  ["seamless", 8],
  ["leverage", 7],
  ["harness", 6],
  ["elevate", 7],
  ["myriad", 8],
  ["plethora", 8],
  ["bustling", 8],
  ["meticulous", 8],
  ["profound", 6],
  ["paradigm", 7],
  ["holistic", 6],
  ["cutting-edge", 7],
  ["ever-evolving", 9],
  ["fast-paced", 6],
  ["game-changer", 8],
  ["unlock", 6],
  ["unleash", 8],
  ["embark", 8],
  ["navigate", 5],
  ["foster", 6],
  ["synergy", 8],
  // --- rest of the skill's "big offenders" list ---
  // Several of these are ordinary English on their own ("crucial", "valuable",
  // "enhance"), so they carry small weights and lean on the clustering rule:
  // "One alone is forgivable. Three in a paragraph is a tell."
  ["boast", 7],
  ["bolster", 6],
  ["garner", 6],
  ["interplay", 7],
  ["intricacy", 7],
  ["enduring", 5],
  ["emphasize", 4],
  ["enhance", 4],
  ["crucial", 4],
  ["valuable", 3],
  ["additionally", 4],
  ["highlight", 3],
  // --- promotional / travel-guide register ---
  ["nestled", 9],
  ["exemplify", 8],
  ["featuring", 3],
  // --- Grok-specific overuse ---
  ["causal", 5],
  ["empirical", 5],
  ["correlate", 5]
];
function inflectionsOf(word) {
  const w = word.toLowerCase();
  const forms = /* @__PURE__ */ new Set([w]);
  if (/[^aeiou]y$/.test(w)) {
    forms.add(w.slice(0, -1) + "ies");
  } else if (/e$/.test(w)) {
    forms.add(w + "s").add(w + "d").add(w.slice(0, -1) + "ing").add(w + "ly");
  } else if (/(?:s|sh|ch|x|z)$/.test(w)) {
    forms.add(w + "es").add(w + "ed").add(w + "ing").add(w + "ly");
  } else {
    forms.add(w + "s").add(w + "ed").add(w + "ing").add(w + "ly");
  }
  return [...forms];
}
function vocabSource(word) {
  if (word.includes("-")) {
    return `\\b(?:${word.split("-").map(escapeRegex).join("[-\\s]?")})s?\\b`;
  }
  const alts = inflectionsOf(word).sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  return `\\b(?:${alts})\\b`;
}
var vocabSignals = VOCAB_WORDS.map(
  ([word, weight]) => sig(
    `vocab.${word.replace(/[^a-z]/gi, "_")}`,
    `AI word: "${word}"`,
    "vocabulary",
    new RegExp(vocabSource(word), "gi"),
    weight,
    `"${word}" (and its inflections) is a hallmark of machine-generated prose. Humans rarely reach for it.`,
    { perExtra: Math.round(weight / 2), maxExtra: weight }
  )
);
var phraseSignals = [
  sig(
    "phrase.serves_as",
    'Elaborate verb: "serves as"',
    "phrase",
    /\bserves as\b/gi,
    9,
    'The skill says swap "serves as" for a simple "is".'
  ),
  sig(
    "phrase.stands_as",
    'Elaborate verb: "stands as"',
    "phrase",
    /\bstands as\b/gi,
    9,
    'Prefer "is". "Stands as a testament" is peak AI.'
  ),
  sig(
    "phrase.showcases",
    'Elaborate verb: "showcases"',
    "phrase",
    /\bshowcase[sd]?\b/gi,
    7,
    "Simple copulatives beat showy verbs."
  ),
  sig(
    "phrase.tapestry_of",
    'Stock phrase: "tapestry of"',
    "phrase",
    /\b(rich|vibrant|intricate|complex)?\s*tapestry of\b/gi,
    18,
    "Almost never written by a human in earnest."
  ),
  sig(
    "phrase.in_the_realm",
    'Stock opener: "in the realm/world of"',
    "phrase",
    /\bin the (realm|world|landscape) of\b/gi,
    11,
    "Classic AI throat-clearing intro."
  ),
  sig(
    "phrase.when_it_comes",
    'Filler: "when it comes to"',
    "phrase",
    /\bwhen it comes to\b/gi,
    6,
    "Generic connective tissue typical of generated text."
  ),
  sig(
    "phrase.play_a_role",
    'Filler: "play a (vital/key) role"',
    "phrase",
    /\bplays? a (vital|key|crucial|pivotal|significant) role\b/gi,
    10,
    "Vague importance-claiming without specifics."
  ),
  sig(
    "phrase.it_is_important",
    'Filler: "it is important to note"',
    "phrase",
    /\b(?:it('?s| is) (?:important|worth|crucial|essential) to (?:note|remember|consider|mention)|it (?:should|must) be noted that|it'?s worth noting|it is worth (?:noting|mentioning))\b/gi,
    9,
    "Didactic throat-clearing. Delete it and start with what you were going to say."
  ),
  sig(
    "phrase.copulative_avoidance",
    'Copulative avoidance: "features a collection of" (for "has")',
    "phrase",
    /\b(?:features? a (?:collection|range|variety|number|host) of|maintains? a (?:presence|commitment|reputation|focus)|represents? a (?:departure|shift|significant|major)|refers? to the (?:practice|process|concept|idea) of|ventured into|boasts? a)\b/gi,
    9,
    'The strongest statistical tell there is: AI avoids "is"/"has" and reaches for an elaborate construction instead.',
    { perExtra: 5, maxExtra: 10 }
  ),
  sig(
    "phrase.in_the_heart_of",
    'Travel-guide opener: "in the heart of"',
    "phrase",
    /\bin the heart of\b/gi,
    9,
    "Straight from the brochure-writing playbook."
  ),
  sig(
    "phrase.diverse_array",
    'Padding: "a diverse array of"',
    "phrase",
    /\b(?:a |an )?(?:diverse|wide|broad|vast|rich) (?:array|range|variety|selection) of\b/gi,
    8,
    'Says "several" in five words.',
    { perExtra: 4, maxExtra: 8 }
  ),
  sig(
    "phrase.rich_praise",
    'Vague praise: "rich history", "storied tradition"',
    "phrase",
    /\b(?:rich|storied|proud|vibrant) (?:history|heritage|tradition|culture|legacy|past)\b/gi,
    8,
    'The skill flags "rich" used as unspecific praise.'
  ),
  sig(
    "phrase.natural_beauty",
    'Travel-guide phrase: "natural beauty"',
    "phrase",
    /\bnatural beauty\b/gi,
    7,
    "Generic scenic praise that describes nothing."
  ),
  sig(
    "phrase.commitment_to",
    'Corporate filler: "commitment to X"',
    "phrase",
    /\b(?:unwavering |strong |deep |ongoing |continued )?(?:commitment|dedication) to\b/gi,
    5,
    "Asserts virtue without evidence."
  ),
  sig(
    "phrase.align_with",
    'Corporate verb: "aligns with"',
    "phrase",
    /\balign(?:s|ed|ing)? with\b/gi,
    5,
    `On the skill's kill list; usually means "matches" or "fits".`
  ),
  sig(
    "phrase.concrete",
    'Discussion tell: "concrete evidence/examples"',
    "phrase",
    /\bconcrete (?:evidence|examples?|steps?|proof|actions?)\b/gi,
    6,
    'The skill calls "concrete" the sneaky one in comments and discussion.'
  ),
  sig(
    "phrase.dive_into",
    'Stock verb: "dive/delve into"',
    "phrase",
    /\b(?:dives?|dived|diving|delves?|delved|delving|deep[- ]dives?) into\b/gi,
    9,
    'Related to the flagged "delve".'
  )
];
var structureSignals = [
  sig(
    "structure.negative_parallelism",
    'Negative parallelism: "not just X, but Y"',
    "structure",
    // Three ways the second half gets introduced, all equally AI:
    //   "not just X, but Y"  |  "not just X — it is Y"  |  "not just X. It is Y"
    /\bnot\s+(?:just|only|merely|simply)\b[^.;!?—–]{1,60}?(?:,?\s*but\b(?:\s+(?:also|rather))?|\s*[—–]+\s*(?:it|they|this|these|that|we|you|i)\b|\.\s+(?:it|they|this|these|that|we|you|i)\b)/gi,
    13,
    'The skill: "replace not just X but Y with a direct statement".',
    { perExtra: 6, maxExtra: 12 }
  ),
  sig(
    "structure.its_not_about",
    `Contrast clich\xE9: "it's not X, it's Y"`,
    "structure",
    // Covers "it's not about X, it's about Y" and the announcement-post variant
    // 'this isn\'t "another startup." It\'s an attempt to...' — same rhythm,
    // different surface form. The ["']* lets the clause end inside quotes.
    /\b(?:it|this|that|these|those)\s*(?:'s|'re)?\s+(?:is\s+not|isn't|are\s+not|aren't|was\s+not|wasn't|not)\b[^.;!?]{1,60}?[.;!?]?["']*\s*(?:it'?s|it is|this is|that'?s|they'?re|we'?re)\b/gi,
    12,
    "A viral-thread rhythm that AI overuses."
  ),
  sig(
    "structure.rule_of_three",
    "Rule-of-three adjective list",
    "structure",
    /\b(\w+(?:ing|ive|ic|al|ous|ent|ant))\s*,\s*(\w+(?:ing|ive|ic|al|ous|ent|ant))\s*,?\s*and\s+(\w+(?:ing|ive|ic|al|ous|ent|ant))\b/gi,
    11,
    'The skill: reduce "innovative, dynamic, and transformative" to one word or zero.',
    { perExtra: 6, maxExtra: 12 }
  ),
  sig(
    "structure.rule_of_three_any",
    "Rule-of-three list (any words)",
    "structure",
    // Catches triads the suffix-based rule above misses: "fast, simple, and
    // secure", "how we work, live, and create", and the skill's parallel-phrase
    // form "creativity, collaboration, and critical thinking". Weighted lightly
    // because a three-item list is also a perfectly normal thing to write.
    /\b([\w-]{3,}(?:\s+[\w-]+)?)\s*,\s*([\w-]{3,}(?:\s+[\w-]+)?)\s*,?\s+(?:and|or)\s+([\w-]{3,}(?:\s+[\w-]+)?)\b/gi,
    6,
    "Triads are the default rhythm of generated prose; real lists are usually messier.",
    { perExtra: 3, maxExtra: 6 }
  ),
  sig(
    "structure.ing_analysis",
    'Superficial "-ing" analysis: "highlighting the..."',
    "structure",
    /,\s*(highlighting|showcasing|underscoring|emphasizing|reflecting|demonstrating|illustrating|ensuring|allowing|enabling|paving|fostering|contributing|cultivating|encompassing|enhancing|symbolizing|marking|shaping|solidifying|cementing|offering|providing) (the |a |an |to )?/gi,
    10,
    "Tacked-on participial clauses that add no real information.",
    { perExtra: 5, maxExtra: 10 }
  ),
  sig(
    "structure.hedge_then_assert",
    'Hedge-then-assert: "while X, it remains Y"',
    "structure",
    /\bwhile [^.,;]{3,60}?,\s*it (remains|is still|continues to|nonetheless)\b/gi,
    9,
    "Take a position or cut it \u2014 the skill's guidance."
  ),
  sig(
    "structure.significance_bloat",
    'Significance bloat: "underscores the importance of", "marks a shift"',
    "structure",
    /\b(?:is a (?:testament|reminder|symbol|tribute) to|underscor\w+ (?:its |the )?(?:importance|significance|need)|highlight\w* (?:its |the )?(?:importance|significance)|reflect\w* (?:a )?broader|symboliz\w+ (?:its )?(?:ongoing|enduring|lasting)|setting the stage for|(?:represents?|marks?) a (?:shift|turning point|departure|new era|milestone)|key turning point|evolving landscape|focal point|indelible mark|deeply rooted|contributing to the (?:broader|overall|growing|wider))\b/gi,
    10,
    "A sentence that exists only to assert importance without adding information. The skill says kill it.",
    { perExtra: 5, maxExtra: 10 }
  ),
  sig(
    "structure.challenges_future",
    'The challenges-and-future formula: "despite these challenges..."',
    "structure",
    /\b(?:faces? (?:several|numerous|many|significant|its share of) challenges|despite (?:these|those|the) challenges|challenges (?:remain|persist)|looking (?:ahead|to the future)|the future (?:looks|remains) (?:bright|promising|uncertain))\b/gi,
    10,
    "Near-universal closing formula of AI-generated articles.",
    { perExtra: 5, maxExtra: 10 }
  ),
  sig(
    "structure.collaborative_leak",
    `Assistant voice: "let's explore", "we can see that"`,
    "structure",
    /\b(?:we can see that|as we can see|let'?s (?:explore|dive|take a look|unpack|break (?:it|this) down)|as we'?ll (?:discuss|see|explore)|in this (?:article|post|thread|guide),?\s*(?:we|i)\b|by the end of this)\b/gi,
    9,
    "Chat-assistant register leaking into text that isn't a conversation.",
    { perExtra: 4, maxExtra: 8 }
  ),
  sig(
    "structure.no_x_no_y",
    'Negative triad: "no gimmicks, no shortcuts, just..."',
    "structure",
    /\bno [\w-]+,\s*no [\w-]+,?\s*(?:and\s+)?(?:just|only|simply)\b/gi,
    9,
    "A negative parallelism dressed up as a triad."
  ),
  sig(
    "structure.rather_than",
    'Contrast filler: "prioritizing depth rather than breadth"',
    "structure",
    /\b\w+ing\s+(?:\w+\s+){0,2}rather than\b/gi,
    5,
    "Flagged in the skill as Grok-heavy phrasing."
  ),
  sig(
    "structure.in_conclusion",
    'Formulaic closer: "in conclusion / in summary"',
    "structure",
    /\b(in conclusion|in summary|to sum up|all in all|in essence)\b/gi,
    9,
    "Essay-scaffolding language rarely used in real posts."
  ),
  sig(
    "structure.more_than_just",
    'Clich\xE9: "more than just"',
    "structure",
    /\bmore than just\b/gi,
    7,
    "A softer cousin of negative parallelism."
  )
];
var punctuationSignals = [
  sig(
    "punct.em_dash",
    "Em dash (\u2014)",
    "punctuation",
    /—|\s--\s|\s–\s/g,
    5,
    'The skill: "Drop em dashes; use periods or commas." Heavy em-dash use is a strong tell.',
    { perExtra: 4, maxExtra: 16 }
  )
];
var attributionSignals = [
  sig(
    "attr.vague",
    'Vague attribution: "experts say/argue"',
    "attribution",
    /\b(?:(?:experts?|observers?|analysts?|researchers?|studies|critics?|many|some|scientists?|sources?|reports?|industry reports?|several sources?)\s+(?:say|says|argue|argues|note|notes|noted|believe|believes|suggest|suggests|indicate|indicates|claim|claims|contend|agree|cited|have cited|point out)|it is (?:widely|often|generally) (?:believed|accepted|known|regarded))\b/gi,
    9,
    "The skill: name a source or delete the claim.",
    { perExtra: 5, maxExtra: 10 }
  )
];
var pufferySignals = [
  sig(
    "puff.generic_praise",
    "Promotional puffery",
    "puffery",
    /\b(world[- ]class|top[- ]notch|state[- ]of[- ]the[- ]art|best[- ]in[- ]class|unparalleled|unrivaled|unmatched|next[- ]level|must[- ]have|game[- ]changing)\b/gi,
    8,
    "Generic praise without specifics \u2014 the skill tells you to cut it.",
    { perExtra: 4, maxExtra: 8 }
  ),
  sig(
    "puff.transformative",
    'Buzzword: "revolutionary/transformative"',
    "puffery",
    /\b(revolutionary|transformative|disruptive|innovative|dynamic|visionary)\b/gi,
    6,
    "Empty intensifiers common in generated marketing copy.",
    { perExtra: 3, maxExtra: 9 }
  )
];
var promoSignals = [
  sig(
    "promo.contrarian_origin",
    `Origin-story trope: "when everyone said it couldn't be done"`,
    "promo",
    /\b(?:when|while|back when)\s+(?:most people|everyone|everybody|no ?one|nobody|the world|others|they all)\s+(?:said|thought|believed|told me|doubted|laughed|ignored)\b/gi,
    6,
    "The obligatory they-doubted-me beat of a launch post.",
    { perExtra: 3, maxExtra: 6 }
  ),
  sig(
    "promo.grandiose_claim",
    'Grandiose claim: "rewrite the operating system of X"',
    "promo",
    /\b(?:rewrit\w*|reinvent\w*|redefin\w*|reimagin\w*|disrupt\w*|revolutioniz\w*)\s+(?:the\s+)?(?:entire\s+|whole\s+)?(?:rules?|game|playbook|operating system|industry|category|standard|way we|future of|world of)\b/gi,
    6,
    "Claims the scale of a revolution without naming a mechanism.",
    { perExtra: 3, maxExtra: 6 }
  ),
  sig(
    "promo.announcement",
    `Announcement scaffolding: "here's the news", "from day one"`,
    "promo",
    /\b(?:here'?s the (?:news|thing|kicker|best part|exciting part)|(?:excited|thrilled|proud|honou?red|humbled)\s+to\s+(?:announce|share|be part of|partner|join|back|support|invest|reveal)|from day one)\b/gi,
    5,
    "Stock connective tissue every launch post is assembled from.",
    { perExtra: 2, maxExtra: 4 }
  ),
  sig(
    "promo.vague_impact",
    'Vague impact claim: "changing the lives of millions"',
    "promo",
    /\b(?:(?:impact\w*|chang\w*|transform\w*|touch\w*|improv\w*)\s+the\s+lives\s+of|creat\w*\s+(?:real\s+|lasting\s+|long-?term\s+)?value|make\s+a\s+(?:real\s+|lasting\s+|meaningful\s+)?difference|change\s+the\s+world)\b/gi,
    5,
    "Impact asserted at maximum scale with no specifics attached.",
    { perExtra: 2, maxExtra: 4 }
  ),
  sig(
    "promo.hashtag_stack",
    "Hashtag stack (3+ in a row)",
    "promo",
    new RegExp(`(?:${HASHTAG_TOKEN}\\s*){3,}`, "g"),
    4,
    "Three or more trailing hashtags is a marketing reflex, not a voice."
  )
];
var SIGNALS = [
  ...vocabSignals,
  ...phraseSignals,
  ...structureSignals,
  ...punctuationSignals,
  ...attributionSignals,
  ...pufferySignals,
  ...promoSignals
];
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/detector.ts
var DEFAULTS = {
  minReliableWords: 12,
  thresholds: { unclear: 25, likelyAi: 50, ai: 75 },
  // Tuned against the corpus in corpus.test.ts: low enough that three fancy
  // words alone stay under "likely-ai", high enough not to blunt real slop.
  decay: { vocabulary: 0.75, promo: 0.55 }
};
var CATEGORY_PRIORITY = {
  cluster: -1,
  // derived, never competes for a span
  structure: 0,
  phrase: 1,
  promo: 2,
  attribution: 3,
  puffery: 4,
  punctuation: 5,
  vocabulary: 6
};
var CLUSTER_MIN = 3;
var CLUSTER_STEP = 4;
var CLUSTER_CAP = 16;
function normalize(text) {
  return text.replace(/https?:\/\/\S+/gi, " ").replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/@\w+/g, ` ${HANDLE_TOKEN} `).replace(/#\w+/g, ` ${HASHTAG_TOKEN} `).replace(/\s+/g, " ").trim();
}
function countWords(text) {
  const m = text.match(/\b[\w'-]+\b/g);
  return m ? m.length : 0;
}
function findMatches(text, re) {
  const clone = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const out = [];
  let m;
  while ((m = clone.exec(text)) !== null) {
    if (m[0].length === 0) {
      clone.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}
function overlapsAny(span, claimed) {
  return claimed.some((c) => span.start < c.end && span.end > c.start);
}
function toExamples(spans, limit = 3) {
  return spans.slice(0, limit).map((s) => {
    const t = s.text.split(HASHTAG_TOKEN).join("#\u2026").split(HANDLE_TOKEN).join("@\u2026").replace(/\s+/g, " ").trim();
    return t.length > 40 ? t.slice(0, 37) + "\u2026" : t;
  });
}
function pointsFor(def, count) {
  if (count <= 0) return 0;
  const perExtra = def.perExtra ?? 0;
  const maxExtra = def.maxExtra ?? perExtra * 2;
  const extra = Math.min((count - 1) * perExtra, maxExtra);
  return def.weight + extra;
}
function saturate(raw) {
  const k = 33;
  const v = 100 * (1 - Math.exp(-raw / k));
  return Math.round(v);
}
function toVerdict(score, t) {
  if (score >= t.ai) return "ai";
  if (score >= t.likelyAi) return "likely-ai";
  if (score >= t.unclear) return "unclear";
  return "human";
}
var VERDICT_LABEL = {
  human: "Looks human-written",
  unclear: "A few AI tells",
  "likely-ai": "Likely AI-assisted",
  ai: "Strong AI signals"
};
function detectAiText(rawText, options = {}) {
  const opts = {
    minReliableWords: options.minReliableWords ?? DEFAULTS.minReliableWords,
    thresholds: options.thresholds ?? DEFAULTS.thresholds,
    decay: options.decay ?? DEFAULTS.decay
  };
  const text = normalize(rawText || "");
  const wordCount = countWords(text);
  const byPriority = SIGNALS.map((def, index) => ({ def, index })).sort(
    (a, b) => b.def.weight - a.def.weight || // On equal weight the more specific signal wins, so "plays a pivotal
    // role" claims the span instead of the bare word "pivotal".
    CATEGORY_PRIORITY[a.def.category] - CATEGORY_PRIORITY[b.def.category] || a.index - b.index
  );
  const claimed = [];
  const hits = [];
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
      points: pointsFor(def, kept.length)
    });
  }
  hits.sort((a, b) => b.points - a.points);
  let raw = 0;
  const rank = {};
  for (const hit of hits) {
    const d = opts.decay[hit.category];
    if (d !== void 0) {
      const n = rank[hit.category] ?? 0;
      hit.points = Math.max(1, Math.round(hit.points * Math.pow(d, n)));
      rank[hit.category] = n + 1;
    }
    raw += hit.points;
  }
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
      points
    });
  }
  hits.sort((a, b) => b.points - a.points);
  let score = saturate(raw);
  if (wordCount < opts.minReliableWords) {
    const factor = Math.max(0.4, wordCount / opts.minReliableWords);
    score = Math.round(score * factor);
  }
  score = Math.max(0, Math.min(100, score));
  const verdict = toVerdict(score, opts.thresholds);
  const topLabels = hits.slice(0, 3).map((h) => h.label.replace(/^[^:]+:\s*/, ""));
  const summary = hits.length === 0 ? `${VERDICT_LABEL[verdict]} \u2014 no AI tells found.` : `${VERDICT_LABEL[verdict]} (${score}/100). Top signals: ${topLabels.join(", ")}.`;
  return { score, verdict, hits, wordCount, normalizedText: text, summary };
}
export {
  HANDLE_TOKEN,
  HASHTAG_TOKEN,
  SIGNALS,
  detectAiText,
  normalize
};
//# sourceMappingURL=index.mjs.map
