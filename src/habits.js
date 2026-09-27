/**
 * Quest Log — habit CRUD (W3).
 * Owner: Luke (Development Lead). Re-verified 2026-09-26 after Lucas race flag.
 * Owns habits + completedHabits slices of data.json via src/storage.js only.
 * No profile/skills XP, UI, markdown sidecars, or main.js wiring.
 */

const { loadDomain, saveDomain } = require("./storage");
const { calcQuestXp } = require("./quests");

const ACTIVE = "habits";
const COMPLETED = "completed_habits";

function clampStat(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}

async function listActive(plugin) {
  const list = await loadDomain(plugin, ACTIVE);
  return Array.isArray(list) ? list : [];
}

async function listCompleted(plugin) {
  const list = await loadDomain(plugin, COMPLETED);
  return Array.isArray(list) ? list : [];
}

async function getActive(plugin, id) {
  return (await listActive(plugin)).find((h) => h && h.id === id) || null;
}

async function getCompleted(plugin, id, completedAt) {
  const list = await listCompleted(plugin);
  return (
    list.find(
      (h) =>
        h &&
        h.id === id &&
        (completedAt == null || h.completedAt === completedAt)
    ) || null
  );
}

function buildHabit(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Habit title is required");
  const difficulty = clampStat(input.difficulty ?? 3);
  const urgency = clampStat(input.urgency ?? 3);
  const impact = clampStat(input.impact ?? 3);
  return {
    id: input.id != null ? String(input.id) : Date.now().toString(),
    title,
    description: String(input.description || "").trim(),
    difficulty,
    urgency,
    impact,
    xp: calcQuestXp(difficulty, urgency, impact),
    created: input.created || new Date().toISOString(),
    skillIds: Array.isArray(input.skillIds) ? input.skillIds.map(String) : [],
  };
}

async function createHabit(plugin, input) {
  const habit = buildHabit(input);
  const active = await listActive(plugin);
  active.push(habit);
  await saveDomain(plugin, ACTIVE, active);
  return habit;
}

async function updateHabit(plugin, id, patch) {
  const active = await listActive(plugin);
  const idx = active.findIndex((h) => h && h.id === id);
  if (idx === -1) throw new Error(`Active habit not found: ${id}`);
  const current = active[idx];
  const next = { ...current, ...patch, id: current.id, created: current.created };
  if (patch.title !== undefined) next.title = String(patch.title).trim() || current.title;
  if (patch.description !== undefined) next.description = String(patch.description).trim();
  if (patch.difficulty !== undefined) next.difficulty = clampStat(patch.difficulty);
  if (patch.urgency !== undefined) next.urgency = clampStat(patch.urgency);
  if (patch.impact !== undefined) next.impact = clampStat(patch.impact);
  if (patch.skillIds !== undefined) {
    next.skillIds = Array.isArray(patch.skillIds) ? patch.skillIds.map(String) : [];
  }
  next.xp = calcQuestXp(next.difficulty, next.urgency, next.impact);
  active[idx] = next;
  await saveDomain(plugin, ACTIVE, active);
  return next;
}

async function deleteActive(plugin, id) {
  const active = await listActive(plugin);
  const idx = active.findIndex((h) => h && h.id === id);
  if (idx === -1) return null;
  const [removed] = active.splice(idx, 1);
  await saveDomain(plugin, ACTIVE, active);
  return removed;
}

async function deleteCompleted(plugin, id, completedAt) {
  const completed = await listCompleted(plugin);
  const idx = completed.findIndex(
    (h) =>
      h &&
      h.id === id &&
      (completedAt == null || h.completedAt === completedAt)
  );
  if (idx === -1) return null;
  const [removed] = completed.splice(idx, 1);
  await saveDomain(plugin, COMPLETED, completed);
  return removed;
}

/**
 * Log a habit completion (habits stay active — repeatable).
 * Pushes a completed copy with completedAt; does not remove from active.
 * Does not award profile/skills XP.
 */
async function completeHabit(plugin, id) {
  const active = await listActive(plugin);
  const habit = active.find((h) => h && h.id === id);
  if (!habit) throw new Error(`Active habit not found: ${id}`);
  const completedHabit = {
    ...habit,
    completedAt: new Date().toISOString(),
  };
  const completed = await listCompleted(plugin);
  completed.push(completedHabit);
  await saveDomain(plugin, COMPLETED, completed);
  return completedHabit;
}

/**
 * Remove one completed-habit entry (undo completion log). Habit stays active.
 */
async function uncompleteHabit(plugin, id, completedAt) {
  const completed = await listCompleted(plugin);
  const idx = completed.findIndex(
    (h) =>
      h &&
      h.id === id &&
      (completedAt == null || h.completedAt === completedAt)
  );
  if (idx === -1) throw new Error(`Completed habit not found: ${id}`);
  const [removed] = completed.splice(idx, 1);
  await saveDomain(plugin, COMPLETED, completed);
  return removed;
}

async function saveActive(plugin, list) {
  await saveDomain(plugin, ACTIVE, Array.isArray(list) ? list : []);
}

async function saveCompleted(plugin, list) {
  await saveDomain(plugin, COMPLETED, Array.isArray(list) ? list : []);
}

module.exports = {
  ACTIVE,
  COMPLETED,
  buildHabit,
  listActive,
  listCompleted,
  getActive,
  getCompleted,
  createHabit,
  updateHabit,
  deleteActive,
  deleteCompleted,
  completeHabit,
  uncompleteHabit,
  saveActive,
  saveCompleted,
};
