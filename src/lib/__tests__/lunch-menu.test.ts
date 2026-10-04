import assert from "node:assert/strict";
import { test } from "node:test";
import { LUNCH_REPLY, isLunchTrigger } from "../lunch-menu";

test("the trigger word is found in any case, with punctuation, or inside a sentence", () => {
  for (const t of ["isgudokei", "  IsGudOkei ", "isgudokei!", "hej, isgudokei?", "isgudokei\n"]) assert.ok(isLunchTrigger(t), t);
});

test("other text does not trigger it", () => {
  for (const t of ["", "lunch", "isgudokeiii", "xisgudokei", "chcę zieleń i transport", "is gu dokei"]) assert.ok(!isLunchTrigger(t), t);
});

test("the reply states the standing offer and invents no dishes", () => {
  assert.match(LUNCH_REPLY, /46 zł/);
  assert.match(LUNCH_REPLY, /12:00–15:00/);
  assert.match(LUNCH_REPLY, /Instagram/);
  assert.doesNotMatch(LUNCH_REPLY, /schabowy|pierogi|rosół/i);
});
