"use strict";
/**
 * Merge tests: the three-way merge is the only thing standing between a phone edit and a
 * destroyed data.json. Every case here is a real two-device scenario.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { mergeBlobs } = require("../src/sync");

const quest = (id, patch) => ({ id, title: `quest-${id}`, xp: 100, ...patch });
const blob = (patch) => ({
  store: "data.json",
  quests: [],
  completedQuests: [],
  habits: [],
  completedHabits: [],
  skills: [],
  currentXp: 0,
  coins: 0,
  questsCompleted: 0,
  ...patch,
});

test("disk-only addition survives a local save", () => {
  const base = blob({ quests: [quest("a")] });
  const mem = blob({ quests: [quest("a")] }); // local save with nothing new
  const disk = blob({ quests: [quest("a"), quest("b")] }); // phone added b

  const out = mergeBlobs(base, mem, disk);
  assert.deepEqual(out.quests.map((q) => q.id), ["a", "b"], "phone-added quest must not be clobbered");
});

test("local edit wins over disk's untouched copy", () => {
  const base = blob({ quests: [quest("a")] });
  const mem = blob({ quests: [quest("a", { title: "edited here" })] });
  const disk = blob({ quests: [quest("a")] });

  const out = mergeBlobs(base, mem, disk);
  assert.equal(out.quests[0].title, "edited here");
});

test("an item edited on both sides keeps the local version (documented choice)", () => {
  const base = blob({ quests: [quest("a")] });
  const mem = blob({ quests: [quest("a", { title: "mine" })] });
  const disk = blob({ quests: [quest("a", { title: "theirs" })] });

  assert.equal(mergeBlobs(base, mem, disk).quests[0].title, "mine");
});

test("a local deletion is not resurrected by disk", () => {
  const base = blob({ quests: [quest("a"), quest("b")] });
  const mem = blob({ quests: [quest("b")] }); // deleted a here
  const disk = blob({ quests: [quest("a"), quest("b")] });

  assert.deepEqual(mergeBlobs(base, mem, disk).quests.map((q) => q.id), ["b"]);
});

test("an item completed elsewhere is not resurrected by a stale local copy", () => {
  const base = blob({ quests: [quest("a"), quest("b")] });
  const mem = blob({ quests: [quest("a"), quest("b")] }); // edited nothing, just saving
  const disk = blob({ quests: [quest("b")], completedQuests: [quest("a", { completedAt: "x" })] });

  const out = mergeBlobs(base, mem, disk);
  assert.deepEqual(out.quests.map((q) => q.id), ["b"], "completed-on-phone quest must not come back as active");
  assert.deepEqual(out.completedQuests.map((q) => q.id), ["a"]);
});

test("additive counters take the delta from each side, floored at zero", () => {
  const base = blob({ currentXp: 1000, coins: 10, questsCompleted: 2 });
  const mem = blob({ currentXp: 1500, coins: 12, questsCompleted: 3 }); // +500, +2, +1 here
  const disk = blob({ currentXp: 1200, coins: 15, questsCompleted: 4 }); // +200, +5, +2 there

  const out = mergeBlobs(base, mem, disk);
  assert.equal(out.currentXp, 1700, "disk 1200 + my 500 delta");
  assert.equal(out.coins, 12 + 5, "disk 15 plus my +2 delta");
  assert.equal(out.questsCompleted, 4 + 1, "disk 4 plus my +1 delta");

  const shrink = mergeBlobs(blob({ coins: 5 }), blob({ coins: 0 }), blob({ coins: 0 }));
  assert.equal(shrink.coins, 0, "counters never go negative");
});

test("plain scalars: mine if I changed it, otherwise disk", () => {
  const base = blob({ heroName: "Hero", rewardsMode: false });
  const mem = blob({ heroName: "Micah", rewardsMode: false });
  const disk = blob({ heroName: "Hero", rewardsMode: true });

  const out = mergeBlobs(base, mem, disk);
  assert.equal(out.heroName, "Micah", "my rename wins");
  assert.equal(out.rewardsMode, true, "disk's untouched scalar setting survives");
});

test("skill level is derived, so it never counts as an edit", () => {
  const base = blob({ skills: [{ id: "s1", name: "Rust", xp: 500, level: 3 }] });
  const mem = blob({ skills: [{ id: "s1", name: "Rust", xp: 900, level: 4 }] }); // +400 xp, level recomputed
  const disk = blob({ skills: [{ id: "s1", name: "Rust", xp: 500, level: 3 }] });

  const out = mergeBlobs(base, mem, disk);
  assert.equal(out.skills[0].xp, 900, "skill xp merges");
  const { canonD } = require("../src/sync");
  assert.equal(canonD(out), canonD({ ...out, skills: [{ id: "s1", name: "Rust", xp: 900, level: 99 }] }), "level is excluded from equality");
});

test("merge output is a new object and does not alias its inputs", () => {
  const base = blob({ quests: [quest("a")] });
  const mem = blob({ quests: [quest("a"), quest("b")] });
  const disk = blob({ quests: [quest("a")] });

  const out = mergeBlobs(base, mem, disk);
  out.quests[0].title = "mutated";
  assert.equal(mem.quests[0].title, "quest-a", "inputs must not be mutated through the output");
  assert.equal(disk.quests[0].title, "quest-a");
});
