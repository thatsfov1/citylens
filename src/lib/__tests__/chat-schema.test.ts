import assert from "node:assert/strict";
import { test } from "node:test";
import { chatRequestSchema, parseChatOutput } from "../llm/chat-schema";

const imp = { sport: 62, culture: 0, greenery: 100, shopping: 12, transport: 80, education: 40 };

test("parses a follow-up question (no weights yet)", () => {
  const r = parseChatOutput(JSON.stringify({ reply: "Do you commute?", importance: null, stages: null }));
  assert.equal(r.importance, null);
});

test("parses weights and snaps them to the 0/25/50/75/100 scale", () => {
  const r = parseChatOutput(JSON.stringify({ reply: "Got it.", importance: imp, stages: ["kindergarten"] }));
  assert.deepEqual(r.importance, { sport: 50, culture: 0, greenery: 100, shopping: 0, transport: 75, education: 50 });
  assert.deepEqual(r.stages, ["kindergarten"]);
});

test("rejects out-of-range, missing and malformed output", () => {
  assert.throws(() => parseChatOutput(JSON.stringify({ reply: "x", importance: { ...imp, sport: 150 }, stages: null })));
  assert.throws(() => parseChatOutput(JSON.stringify({ reply: "x", importance: { sport: 1 }, stages: null })));
  assert.throws(() => parseChatOutput(JSON.stringify({ reply: "x", importance: imp, stages: ["high_school"] })));
  assert.throws(() => parseChatOutput("not json"));
});

test("request limits", () => {
  const ok = { messages: [{ role: "user", text: "parks" }] };
  assert.ok(chatRequestSchema.safeParse(ok).success);
  assert.ok(!chatRequestSchema.safeParse({ messages: [] }).success);
  assert.ok(!chatRequestSchema.safeParse({ messages: [{ role: "user", text: "x".repeat(501) }] }).success);
  assert.ok(!chatRequestSchema.safeParse({ messages: [{ role: "assistant", text: "hi" }] }).success);
  const many = Array.from({ length: 13 }, () => ({ role: "user", text: "a" }));
  assert.ok(!chatRequestSchema.safeParse({ messages: many }).success);
});

test("nearPlace is optional and validated", () => {
  const base = { reply: "ok", importance: null, stages: null };
  assert.equal(parseChatOutput(JSON.stringify(base)).nearPlace, undefined);
  const r = parseChatOutput(JSON.stringify({ ...base, nearPlace: { query: "AGH", radiusM: 1000 } }));
  assert.equal(r.nearPlace?.query, "AGH");
  assert.throws(() => parseChatOutput(JSON.stringify({ ...base, nearPlace: { query: "AGH", radiusM: 777 } })));
});

test("avoid is optional and limited to known categories", () => {
  const base = { reply: "ok", importance: null, stages: null };
  assert.equal(parseChatOutput(JSON.stringify(base)).avoid, undefined);
  assert.deepEqual(parseChatOutput(JSON.stringify({ ...base, avoid: ["shopping"] })).avoid, ["shopping"]);
  assert.throws(() => parseChatOutput(JSON.stringify({ ...base, avoid: ["noise"] })));
});
