// Landing page behaviour.
//
// The page scores text with the real published library rather than showing
// screenshots of it, so the demo can never drift from the product. The bundle in
// assets/ is a copy of dist/index.mjs from @slop-detector/slop-detector —
// refresh it with `npm run sync:docs`.

import { detectAiText, HANDLE_TOKEN, HASHTAG_TOKEN } from "./assets/slop-detector.js";

/* Each pair is the same news told twice. Verified scores: human 0, AI 58-67. */
const PAIRS = [
  {
    human: "shipped the thing we've been on for four months. it's rough in places but it works and people are using it. more soon.",
    ai: "After four months of development, we're excited to share what we've been building. It's not just a product, but a foundation for what comes next — meticulously crafted to deliver seamless value.",
  },
  {
    human: "gave the talk. hands shook the whole time. two people came up after and said it helped, so, worth it.",
    ai: "Had the privilege of speaking today. Sharing our journey with such an engaged audience serves as a testament to the power of community, highlighting the importance of authentic connection.",
  },
  {
    human: "we're hiring two engineers. small team, no on-call yet, we pay the top of the band. dm me.",
    ai: "We're thrilled to announce we're expanding our world-class team. Join us on a transformative journey where innovative thinking and meticulous craftsmanship converge to unlock unprecedented impact.",
  },
];

const cardsEl = document.getElementById("cards");
const nextEl = document.getElementById("next");
const tallyEl = document.getElementById("tally");

let round = 0;
let played = 0;
let correct = 0;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Placeholders exist so a link can't trip a word rule; show them readably. */
const readable = (s) =>
  s.split(HASHTAG_TOKEN).join("#…").split(HANDLE_TOKEN).join("@…").replace(/\s+/g, " ");

/** The sentence around a match, clipped, with the match marked. */
function quoteFor(text, m) {
  let s = m.start;
  let e = m.end;
  while (s > 0 && !/[.!?]/.test(text[s - 1])) s--;
  while (e < text.length && !/[.!?]/.test(text[e])) e++;

  let pre = readable(text.slice(s, m.start));
  let post = readable(text.slice(m.end, e));
  if (pre.length > 58) pre = "…" + pre.slice(-58);
  if (post.length > 58) post = post.slice(0, 58) + "…";

  const q = el("blockquote", "quote");
  q.append(pre);
  q.append(el("mark", null, readable(text.slice(m.start, m.end)).trim()));
  q.append(post);
  return q;
}

/** Signal list with the quoted evidence — the same idea as the extension panel. */
function signalList(result, limit = 3) {
  const ul = el("ul", "signals");
  for (const hit of result.hits.slice(0, limit)) {
    const li = document.createElement("li");
    li.append(el("b", null, `${hit.label}  +${hit.points}`));
    if (hit.matches[0]) li.append(quoteFor(result.normalizedText, hit.matches[0]));
    ul.append(li);
  }
  if (result.hits.length > limit) {
    ul.append(el("li", "none", `+${result.hits.length - limit} more signals`));
  }
  return ul;
}

function reveal(cards, results, pickedIdx, aiIdx) {
  played++;
  if (pickedIdx === aiIdx) correct++;
  tallyEl.textContent = `${correct} of ${played} right`;

  cards.forEach((card, i) => {
    const r = results[i];
    const isAi = i === aiIdx;
    card.classList.add("is-done", isAi ? "is-ai" : "is-human");
    card.disabled = true;
    card.querySelector(".card__pick")?.remove();

    const v = el("div", `verdict verdict--${isAi ? "ai" : "human"}`);
    v.append(el("span", null, isAi ? "🤖 reads like slop" : "✓ reads clean"));
    v.append(el("span", "score", `${r.score}/100`));
    card.append(v);

    if (r.hits.length) card.append(signalList(r));
    else card.append(el("p", "none", "No AI writing tells found in this one."));
  });
}

function render() {
  const pair = PAIRS[round % PAIRS.length];
  // Vary which side is the machine, so position never gives it away.
  const aiIdx = round % 2;
  const texts = aiIdx === 0 ? [pair.ai, pair.human] : [pair.human, pair.ai];
  const results = texts.map((t) => detectAiText(t));

  cardsEl.replaceChildren();
  tallyEl.textContent = played ? `${correct} of ${played} right` : "";

  const cards = texts.map((t, i) => {
    const b = el("button", "card");
    b.type = "button";
    b.append(el("p", null, t));
    b.append(el("span", "card__pick", "This one →"));
    b.addEventListener("click", () => reveal(cards, results, i, aiIdx), { once: true });
    cardsEl.append(b);
    return b;
  });
}

nextEl.addEventListener("click", () => {
  round++;
  render();
});
render();

/* ---------- paste-your-own ---------- */

const tryEl = document.getElementById("try");
const outEl = document.getElementById("try-out");

const VERDICT = {
  human: ["✓ reads clean", "verdict--human"],
  unclear: ["? a few tells", ""],
  "likely-ai": ["▲ reads like slop", "verdict--ai"],
  ai: ["🤖 heavy slop", "verdict--ai"],
};

function scoreInput() {
  const text = tryEl.value.trim();
  outEl.replaceChildren();
  if (!text) return;

  const r = detectAiText(text);
  const [label, cls] = VERDICT[r.verdict];

  const v = el("div", `verdict ${cls}`);
  v.append(el("span", null, label));
  v.append(el("span", "score", `${r.score}/100 · ${r.wordCount} words`));
  outEl.append(v);

  if (r.hits.length) outEl.append(signalList(r, 6));
  else outEl.append(el("p", "none", "No AI writing tells found. That is not proof a person wrote it — plain, specific writing simply leaves no tells."));
}

let t;
tryEl.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(scoreInput, 180);
});
scoreInput();
