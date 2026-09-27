/**
 * Quest Log — quest CRUD (W2).
 * Owns quests + completedQuests slices of data.json via src/storage.js only.
 * No profile XP, skills, settings, UI, or markdown sidecars — callers/W7 wire those.
 */

const {
  loadDomain,
  saveDomain,
} = require("./storage");

const ACTIVE = "active_quests";
const COMPLETED = "completed_quests";

/**
 * Live XP table: 100 * 5000^((sum-3)/12), sum = d+u+i in 3..15.
 * Matches main.js Xp.calcXp / design-doc Live XP.
 * @param {number} d difficulty 1–5
 * @param {number} u urgency 1–5
 * @param {number} i impact 1–5
 */
function calcQuestXp(d, u, i) {
  const difficulty = clampStat(d);
  const urgency = clampStat(u);
  const impact = clampStat(i);
  const sum = difficulty + urgency + impact;
  if (sum <= 3) return 100;
  if (sum >= 15) return 500000;
  const exp = (sum - 3) / 12;
  return Math.round(100 * Math.pow(5000, exp));
}

/** @param {number} n */
function clampStat(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @returns {Promise<object[]>}
 */
async function listActive(plugin) {
  const list = await loadDomain(plugin, ACTIVE);
  return Array.isArray(list) ? list : [];
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @returns {Promise<object[]>}
 */
async function listCompleted(plugin) {
  const list = await loadDomain(plugin, COMPLETED);
  return Array.isArray(list) ? list : [];
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 */
async function getActive(plugin, id) {
  const list = await listActive(plugin);
  return list.find((q) => q && q.id === id) || null;
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 */
async function getCompleted(plugin, id) {
  const list = await listCompleted(plugin);
  return list.find((q) => q && q.id === id) || null;
}

/**
 * @param {object} input
 * @param {string} input.title
 * @param {string} [input.description]
 * @param {number} [input.difficulty]
 * @param {number} [input.urgency]
 * @param {number} [input.impact]
 * @param {string[]} [input.skillIds]
 * @param {string} [input.id]
 * @param {string} [input.created]
 */
function buildQuest(input) {
  const title = String(input.title || "").trim();
  if (!title) {
    throw new Error("Quest title is required");
  }
  const difficulty = clampStat(input.difficulty ?? 3);
  const urgency = clampStat(input.urgency ?? 3);
  const impact = clampStat(input.impact ?? 3);
  const skillIds = Array.isArray(input.skillIds)
    ? input.skillIds.map(String)
    : [];
  return {
    id: input.id != null ? String(input.id) : Date.now().toString(),
    title,
    description: String(input.description || "").trim(),
    difficulty,
    urgency,
    impact,
    xp: calcQuestXp(difficulty, urgency, impact),
    created: input.created || new Date().toISOString(),
    skillIds,
  };
}

/**
 * Create an active quest and persist.
 * @param {import('obsidian').Plugin} plugin
 * @param {object} input
 */
async function createQuest(plugin, input) {
  const quest = buildQuest(input);
  const active = await listActive(plugin);
  active.push(quest);
  await saveDomain(plugin, ACTIVE, active);
  return quest;
}

/**
 * Patch an active quest by id. Recalculates xp when D/U/I change.
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 * @param {object} patch
 */
async function updateQuest(plugin, id, patch) {
  const active = await listActive(plugin);
  const idx = active.findIndex((q) => q && q.id === id);
  if (idx === -1) {
    throw new Error(`Active quest not found: ${id}`);
  }
  const current = active[idx];
  const next = {
    ...current,
    ...patch,
    id: current.id,
    created: current.created,
  };
  if (patch.title !== undefined) {
    next.title = String(patch.title).trim() || current.title;
  }
  if (patch.description !== undefined) {
    next.description = String(patch.description).trim();
  }
  if (patch.difficulty !== undefined) next.difficulty = clampStat(patch.difficulty);
  if (patch.urgency !== undefined) next.urgency = clampStat(patch.urgency);
  if (patch.impact !== undefined) next.impact = clampStat(patch.impact);
  if (patch.skillIds !== undefined) {
    next.skillIds = Array.isArray(patch.skillIds)
      ? patch.skillIds.map(String)
      : [];
  }
  next.xp = calcQuestXp(next.difficulty, next.urgency, next.impact);
  active[idx] = next;
  await saveDomain(plugin, ACTIVE, active);
  return next;
}

/**
 * Delete an active quest (data only — no note sidecar).
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 * @returns {Promise<object|null>} removed quest or null
 */
async function deleteActive(plugin, id) {
  const active = await listActive(plugin);
  const idx = active.findIndex((q) => q && q.id === id);
  if (idx === -1) return null;
  const [removed] = active.splice(idx, 1);
  await saveDomain(plugin, ACTIVE, active);
  return removed;
}

/**
 * Delete a completed quest (data only).
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function deleteCompleted(plugin, id) {
  const completed = await listCompleted(plugin);
  const idx = completed.findIndex((q) => q && q.id === id);
  if (idx === -1) return null;
  const [removed] = completed.splice(idx, 1);
  await saveDomain(plugin, COMPLETED, completed);
  return removed;
}

/**
 * Move active → completed (adds completedAt). Does not touch profile/skills XP.
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 */
async function completeQuest(plugin, id) {
  const active = await listActive(plugin);
  const idx = active.findIndex((q) => q && q.id === id);
  if (idx === -1) {
    throw new Error(`Active quest not found: ${id}`);
  }
  const [quest] = active.splice(idx, 1);
  const completedQuest = {
    ...quest,
    completedAt: new Date().toISOString(),
  };
  const completed = await listCompleted(plugin);
  completed.push(completedQuest);
  await saveDomain(plugin, ACTIVE, active);
  await saveDomain(plugin, COMPLETED, completed);
  return completedQuest;
}

/**
 * Move completed → active (strips completedAt). Does not reverse profile/skills XP.
 * @param {import('obsidian').Plugin} plugin
 * @param {string} id
 */
async function uncompleteQuest(plugin, id) {
  const completed = await listCompleted(plugin);
  const idx = completed.findIndex((q) => q && q.id === id);
  if (idx === -1) {
    throw new Error(`Completed quest not found: ${id}`);
  }
  const [restored] = completed.splice(idx, 1);
  const { completedAt: _done, ...activeQuest } = restored;
  const active = await listActive(plugin);
  active.push(activeQuest);
  await saveDomain(plugin, COMPLETED, completed);
  await saveDomain(plugin, ACTIVE, active);
  return activeQuest;
}

/**
 * Replace entire active list (rare; prefer CRUD helpers).
 * @param {import('obsidian').Plugin} plugin
 * @param {object[]} list
 */
async function saveActive(plugin, list) {
  await saveDomain(plugin, ACTIVE, Array.isArray(list) ? list : []);
}

/**
 * Replace entire completed list.
 * @param {import('obsidian').Plugin} plugin
 * @param {object[]} list
 */
async function saveCompleted(plugin, list) {
  await saveDomain(plugin, COMPLETED, Array.isArray(list) ? list : []);
}

module.exports = {
  ACTIVE,
  COMPLETED,
  calcQuestXp,
  buildQuest,
  listActive,
  listCompleted,
  getActive,
  getCompleted,
  createQuest,
  updateQuest,
  deleteActive,
  deleteCompleted,
  completeQuest,
  uncompleteQuest,
  saveActive,
  saveCompleted,
};
