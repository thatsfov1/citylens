import assert from "node:assert/strict";
import { test } from "node:test";
import { chatRequestSchema, parseChatOutput } from "../llm/chat-schema";

const imp = { sport: 62, culture: 0, greenery: 100, shopping: 12, transport: 80 };

test("parses a follow-up question (no weights yet)", () => {
  const r = parseChatOutput(JSON.stringify({ reply: "Do you commute?", importance: null }));
  assert.equal(r.importance, null);
});

test("parses weights and snaps them to the 0/25/50/75/100 scale", () => {
  const r = parseChatOutput(JSON.stringify({ reply: "Got it.", importance: imp }));
  assert.deepEqual(r.importance, { sport: 50, culture: 0, greenery: 100, shopping: 0, transport: 75 });
});

test("rejects out-of-range, missing and malformed output", () => {
  assert.throws(() => parseChatOutput(JSON.stringify({ reply: "x", importance: { ...imp, sport: 150 } })));
  assert.throws(() => parseChatOutput(JSON.stringify({ reply: "x", importance: { sport: 1 } })));
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
