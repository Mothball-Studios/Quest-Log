/**
 * Quest Log — skill CRUD (W4).
 * Owns skills slice of data.json via storage. Level math helpers included so profile/quests
 * can award without pulling UI. No markdown sidecars.
 */

const { loadDomain, saveDomain } = require("./storage");

const DOMAIN = "skills";

const SKILL_BASE = 100;
const SKILL_GROWTH = 1600;
const SKILL_EXPANSION_RATE = 1.15;
const SKILL_MAX_LEVEL = 100;
const XP_PHASE_THRESHOLD = 15;

function getXpMultiplier(difficulty) {
  const diff = difficulty || 10;
  if (diff <= 10) {
    return 0.5 + (diff - 1) * (1 / 18);
  }
  return 1 + (diff - 10) * 0.1;
}

function getSkillXpForLvl(lvl, difficulty = 10) {
  if (lvl <= 0) return 0;
  const mult = getXpMultiplier(difficulty);
  if (lvl <= XP_PHASE_THRESHOLD) {
    return Math.floor((lvl * (lvl + 1) / 2) * SKILL_BASE * mult);
  }
  const base = 12000 * mult;
  const ratio = Math.pow(SKILL_EXPANSION_RATE, lvl - XP_PHASE_THRESHOLD);
  return Math.floor(base + (SKILL_GROWTH * mult * (ratio - 1)) / (SKILL_EXPANSION_RATE - 1));
}

function getSkillLevel(currentXp, difficulty = 10) {
  const xp = currentXp || 0;
  let lo = 0;
  let hi = 1;
  while (hi < SKILL_MAX_LEVEL && getSkillXpForLvl(hi, difficulty) <= xp) {
    lo = hi;
    hi = Math.min(SKILL_MAX_LEVEL, hi * 2);
  }
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (getSkillXpForLvl(mid, difficulty) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(SKILL_MAX_LEVEL, lo + 1);
}

async function listSkills(plugin) {
  const list = await loadDomain(plugin, DOMAIN);
  return Array.isArray(list) ? list : [];
}

async function getSkill(plugin, id) {
  return (await listSkills(plugin)).find((s) => s && s.id === id) || null;
}

function buildSkill(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Skill name is required");
  return {
    id: input.id != null ? String(input.id) : Date.now().toString(),
    name,
    description: String(input.description || "").trim(),
    xp: Number.isFinite(Number(input.xp)) ? Math.max(0, Number(input.xp)) : 0,
    level: Number.isFinite(Number(input.level)) ? Math.max(1, Number(input.level)) : 1,
    legendary: Boolean(input.legendary),
    created: input.created || new Date().toISOString(),
  };
}

async function createSkill(plugin, input) {
  const skill = buildSkill(input);
  const skills = await listSkills(plugin);
  skills.push(skill);
  await saveDomain(plugin, DOMAIN, skills);
  return skill;
}

async function updateSkill(plugin, id, patch) {
  const skills = await listSkills(plugin);
  const idx = skills.findIndex((s) => s && s.id === id);
  if (idx === -1) throw new Error(`Skill not found: ${id}`);
  const current = skills[idx];
  const next = { ...current, ...patch, id: current.id, created: current.created };
  if (patch.name !== undefined) next.name = String(patch.name).trim() || current.name;
  if (patch.description !== undefined) next.description = String(patch.description).trim();
  if (patch.legendary !== undefined) next.legendary = Boolean(patch.legendary);
  if (patch.xp !== undefined) next.xp = Math.max(0, Number(patch.xp) || 0);
  if (patch.level !== undefined) next.level = Math.max(1, Number(patch.level) || 1);
  skills[idx] = next;
  await saveDomain(plugin, DOMAIN, skills);
  return next;
}

async function deleteSkill(plugin, id) {
  const skills = await listSkills(plugin);
  const idx = skills.findIndex((s) => s && s.id === id);
  if (idx === -1) return null;
  const [removed] = skills.splice(idx, 1);
  await saveDomain(plugin, DOMAIN, skills);
  return removed;
}

/**
 * Award quest/habit XP onto skills. Skips legendary. Persists skills.json.
 * @param {import('obsidian').Plugin} plugin
 * @param {number} xp
 * @param {string[]} skillIds
 * @param {number} [difficulty=10]
 */
async function applyXpToSkills(plugin, xp, skillIds, difficulty = 10) {
  if (!skillIds || skillIds.length === 0 || !xp) return [];
  const skills = await listSkills(plugin);
  const touched = [];
  for (const skillId of skillIds) {
    const skill = skills.find((s) => s && s.id === skillId);
    if (skill && !skill.legendary) {
      skill.xp = (skill.xp || 0) + xp;
      skill.level = getSkillLevel(skill.xp, difficulty);
      touched.push(skill);
    }
  }
  if (touched.length) await saveDomain(plugin, DOMAIN, skills);
  return touched;
}

/**
 * Revoke previously applied skill XP.
 */
async function revokeSkillXp(plugin, xp, skillIds, difficulty = 10) {
  if (!skillIds || skillIds.length === 0 || !xp) return [];
  const skills = await listSkills(plugin);
  const touched = [];
  for (const skillId of skillIds) {
    const skill = skills.find((s) => s && s.id === skillId);
    if (skill && !skill.legendary) {
      skill.xp = Math.max(0, (skill.xp || 0) - xp);
      skill.level = getSkillLevel(skill.xp, difficulty);
      touched.push(skill);
    }
  }
  if (touched.length) await saveDomain(plugin, DOMAIN, skills);
  return touched;
}

async function saveSkills(plugin, list) {
  await saveDomain(plugin, DOMAIN, Array.isArray(list) ? list : []);
}

module.exports = {
  DOMAIN,
  SKILL_MAX_LEVEL,
  getXpMultiplier,
  getSkillXpForLvl,
  getSkillLevel,
  listSkills,
  getSkill,
  buildSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  applyXpToSkills,
  revokeSkillXp,
  saveSkills,
};
