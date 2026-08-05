/**
 * Tests for the detector. Run with: npm test
 * Uses the Node built-in test runner (node:test) executed via tsx.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAiText } from "./detector";

// ---- Human-sounding samples should score low ----

test("plain human tweet scores as human", () => {
  const r = detectAiText("just got back from lunch, the tacos were great lol");
  assert.equal(r.verdict, "human");
  assert.ok(r.score < 25, `expected < 25, got ${r.score}`);
});

test("terse technical human tweet scores low", () => {
  const r = detectAiText(
    "shipped the fix. turned out the cache key was wrong. moving on."
  );
  assert.ok(r.score < 25, `expected < 25, got ${r.score}`);
});

// ---- Classic AI slop should score high ----

test("heavy AI slop scores as ai", () => {
  const text =
    "In the realm of technology, this groundbreaking platform serves as a testament to innovation. " +
    "It's not just a tool, but a vibrant tapestry of possibilities — delving into a myriad of " +
    "cutting-edge features, highlighting the importance of seamless integration. Experts argue it is pivotal.";
  const r = detectAiText(text);
  assert.equal(r.verdict, "ai");
  assert.ok(r.score >= 75, `expected >= 75, got ${r.score}`);
});

// ---- Individual categories fire ----

test("detects AI vocabulary", () => {
  const r = detectAiText(
    "We must delve into this multifaceted and nuanced landscape to unlock value."
  );
  const ids = r.hits.map((h) => h.id);
  assert.ok(ids.includes("vocab.delve"));
  assert.ok(ids.includes("vocab.multifaceted"));
});

test("detects negative parallelism", () => {
  const r = detectAiText(
    "This is not just a phone, but also a lifestyle companion for everyone."
  );
  assert.ok(r.hits.some((h) => h.id === "structure.negative_parallelism"));
});

test("detects rule of three", () => {
  const r = detectAiText(
    "The design is innovative, dynamic, and transformative across the board."
  );
  assert.ok(r.hits.some((h) => h.id === "structure.rule_of_three"));
});

test("detects em dashes", () => {
  const r = detectAiText(
    "The results were clear — undeniable, in fact — and everyone noticed the change immediately here."
  );
  assert.ok(r.hits.some((h) => h.id === "punct.em_dash"));
});

test("detects vague attribution", () => {
  const r = detectAiText(
    "Experts argue that this approach is superior, and researchers agree it works well overall."
  );
  assert.ok(r.hits.some((h) => h.id === "attr.vague"));
});

test("detects elaborate verbs", () => {
  const r = detectAiText(
    "This product serves as the foundation and showcases what is possible today."
  );
  const ids = r.hits.map((h) => h.id);
  assert.ok(ids.includes("phrase.serves_as"));
  assert.ok(ids.includes("phrase.showcases"));
});

// ---- Robustness ----

test("empty text is handled", () => {
  const r = detectAiText("");
  assert.equal(r.score, 0);
  assert.equal(r.verdict, "human");
  assert.equal(r.hits.length, 0);
});

test("urls and handles do not create false positives", () => {
  const r = detectAiText(
    "check out https://example.com/landscape-realm-tapestry @robust_user #delve"
  );
  // Those words are inside stripped URL/handle/hashtag, so no vocab hits.
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 0);
});

test("repeated tells accumulate but saturate", () => {
  const many = detectAiText(
    "delve delve delve delve delve into the delve of delving delve delve"
  );
  const one = detectAiText("Let us delve into this important subject together today.");
  assert.ok(many.score > one.score);
  assert.ok(many.score <= 100);
});

test("short text gets a confidence penalty", () => {
  const short = detectAiText("A vibrant tapestry — pivotal.");
  const long = detectAiText(
    "A vibrant tapestry — pivotal for everyone who wants to understand the deeper meaning of things."
  );
  // Same tells, but the very short one is discounted.
  assert.ok(short.score < long.score);
});

test("result summary is populated", () => {
  const r = detectAiText("This groundbreaking, robust, seamless tapestry of innovation.");
  assert.ok(typeof r.summary === "string" && r.summary.length > 0);
});
