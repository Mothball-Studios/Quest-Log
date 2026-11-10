"use strict";
/**
 * Save-path integration test with a fake Obsidian adapter.
 * The unit merge tests prove the rules; this proves flushBlob actually calls them and that a
 * stale in-memory copy cannot overwrite a newer data.json.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const storage = require("../src/storage");
const { createLiveSync } = require("../src/sync");

const PATH = ".obsidian/plugins/quest-log/data.json";

function makeWorld(initialText) {
  const fs = new Map([[PATH, initialText]]);
  let clock = 1000;
  const adapter = {
    async stat(path) {
      if (!fs.has(path)) throw new Error("ENOENT");
      const text = fs.get(path);
      return { mtime: clock, size: Buffer.byteLength(text), type: "file" };
    },
    async read(path) {
      if (!fs.has(path)) throw new Error("ENOENT");
      return fs.get(path);
    },
    async exists(path) {
      return fs.has(path);
    },
    async write(path, text) {
      fs.set(path, text);
      clock += 1;
      return true;
    },
    // external device writes straight to the file: no clock bump, exactly like a sync client
    externalWrite(path, text) {
      fs.set(path, text);
      clock += 7;
    },
  };
  const plugin = {
    manifest: { dir: ".obsidian/plugins/quest-log", version: "test" },
    app: { vault: { adapter } },
    async loadData() {
      const text = fs.get(PATH);
      return text ? JSON.parse(text) : null;
    },
    async saveData(blob) {
      fs.set(PATH, JSON.stringify(blob));
    },
    _qlPendingFlush: 0,
  };
  return { fs, adapter, plugin, text: () => fs.get(PATH), json: () => JSON.parse(fs.get(PATH)) };
}

const seed = {
  store: "data.json",
  quests: [{ id: "a", title: "old quest", xp: 100 }],
  completedQuests: [],
  habits: [],
  completedHabits: [],
  skills: [],
  currentXp: 1000,
  coins: 5,
  questsCompleted: 1,
  heroName: "Hero",
};

function hooks() {
  return { hydrate: async () => {}, refresh: () => {}, isBusy: () => false, hasOpenViews: () => true };
}

test("a stale memory save merges the phone's quest in instead of clobbering it", async () => {
  const w = makeWorld(JSON.stringify(seed, null, 2));
  const sync = createLiveSync(w.plugin, hooks(), { pollMs: 999999, debounceMs: 1 });
  w.plugin._qlSync = sync;
  assert.equal(await sync.baseline(), true, "baseline reads the seeded file");

  // memory as loaded at baseline, then the user adds a quest locally
  const mem = storage.adoptBlob(w.plugin, JSON.parse(w.text()));
  mem.quests.push({ id: "local", title: "added here", xp: 200 });
  mem.currentXp += 200;

  // meanwhile the phone wrote a different quest straight to the file
  const phone = JSON.parse(w.text());
  phone.quests.push({ id: "phone", title: "added on the phone", xp: 300 });
  phone.currentXp += 300;
  w.adapter.externalWrite(PATH, JSON.stringify(phone, null, 2));

  await storage.flushBlob(w.plugin, mem);

  const saved = w.json();
  const ids = saved.quests.map((q) => q.id).sort();
  assert.deepEqual(ids, ["a", "local", "phone"], "both sides' additions must survive the save");
  assert.equal(saved.currentXp, 1000 + 200 + 300, "earned XP on two devices adds up");
});

test("a normal save with an unchanged disk writes memory as-is", async () => {
  const w = makeWorld(JSON.stringify(seed, null, 2));
  const sync = createLiveSync(w.plugin, hooks(), { pollMs: 999999, debounceMs: 1 });
  w.plugin._qlSync = sync;
  await sync.baseline();

  const mem = storage.adoptBlob(w.plugin, JSON.parse(w.text()));
  mem.heroName = "Micah";
  await storage.flushBlob(w.plugin, mem);

  assert.equal(w.json().heroName, "Micah");
  assert.equal(w.json().quests.length, 1);
});

test("a deleted file does not block the save", async () => {
  const w = makeWorld(JSON.stringify(seed, null, 2));
  const sync = createLiveSync(w.plugin, hooks(), { pollMs: 999999, debounceMs: 1 });
  w.plugin._qlSync = sync;
  await sync.baseline();

  const mem = storage.adoptBlob(w.plugin, JSON.parse(w.text()));
  mem.quests.push({ id: "x", title: "still here", xp: 1 });
  w.fs.delete(PATH);

  await storage.flushBlob(w.plugin, mem);
  assert.deepEqual(w.json().quests.map((q) => q.id), ["a", "x"], "nothing valid to protect, so plain write");
});

test("invalid JSON on disk never gets overwritten blindly mid-save", async () => {
  const w = makeWorld(JSON.stringify(seed, null, 2));
  const sync = createLiveSync(w.plugin, hooks(), { pollMs: 999999, debounceMs: 1 });
  w.plugin._qlSync = sync;
  await sync.baseline();

  const mem = storage.adoptBlob(w.plugin, JSON.parse(w.text()));
  mem.quests = [];
  w.adapter.externalWrite(PATH, '{"store":"data.json","quests":[{"id"'); // half-written by a sync client

  const started = Date.now();
  await storage.flushBlob(w.plugin, mem);
  const elapsed = Date.now() - started;

  assert.ok(elapsed >= 400, `save waits for the partial file to settle (waited ${elapsed}ms)`);
  assert.equal(w.json().store, "data.json", "file is valid JSON afterwards");
});

test("storage never writes sidecar domain files", async () => {
  const w = makeWorld(JSON.stringify(seed, null, 2));
  const sync = createLiveSync(w.plugin, hooks(), { pollMs: 999999, debounceMs: 1 });
  w.plugin._qlSync = sync;
  await sync.baseline();
  const mem = storage.adoptBlob(w.plugin, JSON.parse(w.text()));
  await storage.flushBlob(w.plugin, mem);

  const files = [...w.fs.keys()];
  assert.deepEqual(files, [PATH], "only data.json exists, no settings.json/quests.json resurrection");
});
