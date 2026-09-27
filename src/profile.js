/**
 * Quest Log — profile / hero XP (W5).
 * Owns profile slice of data.json via storage. User-level XP curve + coins/rewards.
 * Does not write quests/habits/skills domains.
 */

const { loadDomain, saveDomain } = require("./storage");
const { getXpMultiplier } = require("./skills");

const DOMAIN = "profile";

const XP_BASE = 1000;
const XP_GROWTH = 16000;
const XP_EXPANSION_RATE = 1.2;
const XP_PHASE_THRESHOLD = 15;
const XP_TRI_MAX = 120000;

const DEFAULT_PROFILE = Object.freeze({
  heroName: "Hero",
  currentXp: 0,
  questsCompleted: 0,
  coins: 0,
  rewards: [],
});

function getXpForLvl(lvl, difficulty = 10) {
  if (lvl <= 0) return 0;
  const mult = getXpMultiplier(difficulty);
  if (lvl <= XP_PHASE_THRESHOLD) {
    return Math.floor((lvl * (lvl + 1) / 2) * XP_BASE * mult);
  }
  const base = XP_TRI_MAX * mult;
  const ratio = Math.pow(XP_EXPANSION_RATE, lvl - XP_PHASE_THRESHOLD);
  return Math.floor(base + (XP_GROWTH * mult * (ratio - 1)) / (XP_EXPANSION_RATE - 1));
}

function getLevel(currentXp, difficulty = 10) {
  const xp = currentXp || 0;
  let lo = 0;
  let hi = 1;
  while (getXpForLvl(hi, difficulty) <= xp) {
    lo = hi;
    hi = hi * 2;
    if (hi > 10000) break;
  }
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (getXpForLvl(mid, difficulty) <= xp) lo = mid;
    else hi = mid - 1;
  }
  // Match Xp.getLevel / skill getSkillLevel: level N = band between
  // getXpForLvl(N-1) and getXpForLvl(N). Returning `lo` alone made
  // xpProgress use the previous band (into > needed → full bar).
  return lo + 1;
}

function generateXpCurveTable(difficulty = 10, maxLevel = 5) {
  const table = [];
  let prev = 0;
  for (let level = 1; level <= maxLevel; level++) {
    const totalXp = getXpForLvl(level, difficulty);
    table.push({ level, totalXp, deltaXp: totalXp - prev });
    prev = totalXp;
  }
  return table;
}

function normalizeProfile(raw) {
  const base = {
    heroName: DEFAULT_PROFILE.heroName,
    currentXp: DEFAULT_PROFILE.currentXp,
    questsCompleted: DEFAULT_PROFILE.questsCompleted,
    coins: DEFAULT_PROFILE.coins,
    rewards: [],
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  if (raw.heroName !== undefined) {
    const name = String(raw.heroName).trim();
    base.heroName = name || DEFAULT_PROFILE.heroName;
  }
  if (raw.currentXp !== undefined) base.currentXp = Math.max(0, Number(raw.currentXp) || 0);
  if (raw.questsCompleted !== undefined) {
    base.questsCompleted = Math.max(0, Number(raw.questsCompleted) || 0);
  }
  if (raw.coins !== undefined) base.coins = Math.max(0, Number(raw.coins) || 0);
  if (Array.isArray(raw.rewards)) base.rewards = raw.rewards;
  return base;
}

async function loadProfile(plugin) {
  return normalizeProfile(await loadDomain(plugin, DOMAIN));
}

async function saveProfile(plugin, profile) {
  const normalized = normalizeProfile(profile);
  await saveDomain(plugin, DOMAIN, normalized);
  return normalized;
}

async function patchProfile(plugin, patch) {
  const current = await loadProfile(plugin);
  return saveProfile(plugin, { ...current, ...patch });
}

async function setHeroName(plugin, name) {
  const trimmed = String(name || "").trim() || "Hero";
  return patchProfile(plugin, { heroName: trimmed });
}

/**
 * Award hero XP (and optional coins). Returns { profile, leveledUp, levelBefore, levelAfter }.
 * Does not touch skills — caller should call skills.applyXpToSkills separately.
 */
async function awardXp(plugin, xp, opts = {}) {
  const amount = Math.max(0, Number(xp) || 0);
  const difficulty = opts.difficulty != null ? Number(opts.difficulty) : 10;
  const grantCoins = Boolean(opts.grantCoins);
  const profile = await loadProfile(plugin);
  const levelBefore = getLevel(profile.currentXp, difficulty);
  profile.currentXp += amount;
  if (grantCoins && amount > 0) {
    const coins = Math.max(1, Math.min(50, Math.round(amount / 10000)));
    profile.coins += coins;
  }
  const levelAfter = getLevel(profile.currentXp, difficulty);
  if (levelAfter > levelBefore) {
    profile.coins += levelAfter * 10;
  }
  await saveProfile(plugin, profile);
  return {
    profile,
    leveledUp: levelAfter > levelBefore,
    levelBefore,
    levelAfter,
  };
}

/**
 * Revoke hero XP / quest-complete coins (undo completion).
 */
async function revokeXp(plugin, xp, opts = {}) {
  const amount = Math.max(0, Number(xp) || 0);
  const grantCoins = Boolean(opts.grantCoins);
  const profile = await loadProfile(plugin);
  profile.currentXp = Math.max(0, profile.currentXp - amount);
  if (grantCoins && amount > 0) {
    const coins = Math.max(1, Math.min(50, Math.round(amount / 10000)));
    profile.coins = Math.max(0, profile.coins - coins);
  }
  await saveProfile(plugin, profile);
  return profile;
}

async function incrementQuestsCompleted(plugin, delta = 1) {
  const profile = await loadProfile(plugin);
  profile.questsCompleted = Math.max(0, profile.questsCompleted + delta);
  await saveProfile(plugin, profile);
  return profile;
}

/** Rewards shop helpers (stored on profile). */
async function addReward(plugin, input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Reward name is required");
  const profile = await loadProfile(plugin);
  const reward = {
    id: input.id != null ? String(input.id) : Date.now().toString(),
    name,
    description: String(input.description || "").trim(),
    price: Math.max(1, parseInt(input.price, 10) || 1),
    stock:
      input.stock === null || input.stock === undefined || input.stock === ""
        ? null
        : Math.max(1, parseInt(input.stock, 10) || 1),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  profile.rewards.push(reward);
  await saveProfile(plugin, profile);
  return reward;
}

async function removeReward(plugin, id) {
  const profile = await loadProfile(plugin);
  const idx = profile.rewards.findIndex((r) => r && r.id === id);
  if (idx === -1) return null;
  const [removed] = profile.rewards.splice(idx, 1);
  await saveProfile(plugin, profile);
  return removed;
}

module.exports = {
  DOMAIN,
  DEFAULT_PROFILE,
  getXpMultiplier,
  getXpForLvl,
  getLevel,
  generateXpCurveTable,
  normalizeProfile,
  loadProfile,
  saveProfile,
  patchProfile,
  setHeroName,
  awardXp,
  revokeXp,
  incrementQuestsCompleted,
  addReward,
  removeReward,
};
