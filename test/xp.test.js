"use strict";
/**
 * XP ledger tests: the curve, the level inversion, and the quest XP table.
 * These are the numbers the plugin pays out, so they get tests before anything else.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const profile = require("../src/profile");
const skills = require("../src/skills");
const quests = require("../src/quests");

test("quest XP: floor, ceiling, and monotonic in every stat", () => {
  assert.equal(quests.calcQuestXp(1, 1, 1), 100, "all-minimum quest is 100 XP");
  assert.equal(quests.calcQuestXp(5, 5, 5), 500000, "all-maximum quest is 500k XP");

  for (let d = 1; d <= 5; d++) {
    for (let u = 1; u <= 5; u++) {
      for (let i = 1; i <= 5; i++) {
        const base = quests.calcQuestXp(d, u, i);
        if (d < 5) assert.ok(quests.calcQuestXp(d + 1, u, i) >= base, `difficulty ${d}->${d + 1} must not shrink XP`);
        if (u < 5) assert.ok(quests.calcQuestXp(d, u + 1, i) >= base, `urgency ${u}->${u + 1} must not shrink XP`);
        if (i < 5) assert.ok(quests.calcQuestXp(d, u, i + 1) >= base, `impact ${i}->${i + 1} must not shrink XP`);
      }
    }
  }
});

test("quest XP: out-of-range stats are clamped, not silently 100", () => {
  assert.equal(quests.calcQuestXp(0, 0, 0), 100, "below range clamps to 1,1,1");
  assert.equal(quests.calcQuestXp(9, 9, 9), 500000, "above range clamps to 5,5,5");
  assert.equal(quests.calcQuestXp("3", "3", "3"), quests.calcQuestXp(3, 3, 3), "numeric strings behave like numbers");
});

test("hero curve: strictly increasing and getLevel inverts getXpForLvl", () => {
  let prev = -1;
  for (let lvl = 0; lvl <= 40; lvl++) {
    const need = profile.getXpForLvl(lvl, 10);
    assert.ok(Number.isFinite(need), `level ${lvl} must be finite`);
    assert.ok(need > prev, `level ${lvl} must cost more than level ${lvl - 1}`);
    prev = need;
  }

  for (const xp of [0, 1, 499, 500, 1000, 4999, 5000, 12345, 99999, 1000000, 11106455]) {
    const level = profile.getLevel(xp, 10);
    const floor = profile.getXpForLvl(level - 1, 10);
    const ceiling = profile.getXpForLvl(level, 10);
    assert.ok(floor <= xp, `xp ${xp}: level ${level} floor ${floor} must be <= xp`);
    assert.ok(xp < ceiling, `xp ${xp}: next level ${ceiling} must be > xp`);
    assert.ok(level >= 1, "level is 1-based");
  }
});

test("hero curve: difficulty scales cost, never direction", () => {
  const easy = profile.getXpForLvl(10, 1);
  const normal = profile.getXpForLvl(10, 10);
  const hard = profile.getXpForLvl(10, 20);
  assert.ok(easy < normal && normal < hard, "harder difficulty must cost more at the same level");
  assert.equal(profile.getLevel(profile.getXpForLvl(9, 20), 20), 10, "level 10 is reached at its own threshold");
});

test("skill curve: capped at level 100 and never decreasing", () => {
  assert.equal(skills.getSkillLevel(0, 1), 1, "zero XP is level 1");
  let prevLevel = 1;
  for (let xp = 0; xp < 400000; xp += 5000) {
    const lvl = skills.getSkillLevel(xp, 1);
    assert.ok(lvl >= prevLevel, "skill level never goes backwards");
    assert.ok(lvl <= skills.SKILL_MAX_LEVEL, "skill level is capped");
    prevLevel = lvl;
  }
  assert.equal(skills.getSkillLevel(1e12, 1), 100, "absurd XP still caps at 100");
});

test("x1 multiplier is the neutral point for difficulty 10", () => {
  assert.equal(skills.getXpMultiplier(10), 1);
  assert.ok(skills.getXpMultiplier(1) < 1);
  assert.ok(skills.getXpMultiplier(20) > 1);
});
