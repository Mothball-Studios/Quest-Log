var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/storage.js
var require_storage = __commonJS({
  "src/storage.js"(exports2, module2) {
    var VAULT_STORE_DIR = "Quest Log/_store";
    var DOMAIN_FILES = Object.freeze({
      settings: "settings.json",
      active_quests: "active_quests.json",
      completed_quests: "completed_quests.json",
      habits: "habits.json",
      completed_habits: "completed_habits.json",
      skills: "skills.json",
      profile: "profile.json"
    });
    var DOMAIN_DEFAULTS = Object.freeze({
      settings: {},
      active_quests: [],
      completed_quests: [],
      habits: [],
      completed_habits: [],
      skills: [],
      profile: {}
    });
    var SETTINGS_BLOB_KEYS = Object.freeze([
      "rewardsMode",
      "userProfileFileName",
      "userProfileFolder",
      "questsFolderPath",
      "habitsFolderPath",
      "skillsFolderPath",
      "completedFolderPath",
      "userDifficulty",
      "skillDifficulty",
      "showXpCurvePreview"
    ]);
    var PROFILE_BLOB_KEYS = Object.freeze([
      "heroName",
      "currentXp",
      "questsCompleted",
      "coins",
      "rewards"
    ]);
    var ARRAY_BLOB_TO_DOMAIN = Object.freeze({
      quests: "active_quests",
      completedQuests: "completed_quests",
      habits: "habits",
      completedHabits: "completed_habits",
      skills: "skills"
    });
    var DOMAIN_TO_ARRAY_KEY = Object.freeze(
      Object.fromEntries(
        Object.entries(ARRAY_BLOB_TO_DOMAIN).map(([k, v]) => [v, k])
      )
    );
    var STORE_MARKER = "data.json";
    var blobCache = /* @__PURE__ */ new WeakMap();
    function storeDir(plugin) {
      return plugin.manifest.dir;
    }
    function domainPath(plugin, name) {
      const file = DOMAIN_FILES[name];
      if (!file) throw new Error(`Unknown Quest Log domain: ${name}`);
      return `${plugin.manifest.dir}/${file}`;
    }
    function dataJsonPath(plugin) {
      return `${plugin.manifest.dir}/data.json`;
    }
    function vaultStoreDomainPath(plugin, name) {
      void plugin;
      const file = DOMAIN_FILES[name];
      if (!file) throw new Error(`Unknown Quest Log domain: ${name}`);
      return `${VAULT_STORE_DIR}/${file}`;
    }
    function legacyPluginDomainPath(plugin, name) {
      return vaultStoreDomainPath(plugin, name);
    }
    async function pathExists(plugin, fullPath) {
      try {
        return await plugin.app.vault.adapter.exists(fullPath);
      } catch (_e) {
        return false;
      }
    }
    async function readJson(plugin, fullPath, fallback) {
      const adapter = plugin.app.vault.adapter;
      if (!await pathExists(plugin, fullPath)) return fallback;
      const raw = await adapter.read(fullPath);
      if (raw == null || String(raw).trim() === "") return fallback;
      return JSON.parse(raw);
    }
    function isGodBlob(blob) {
      if (!blob || typeof blob !== "object" || Array.isArray(blob)) return false;
      if (blob.store === STORE_MARKER) return true;
      for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
        if (Object.prototype.hasOwnProperty.call(blob, key)) return true;
      }
      for (const key of PROFILE_BLOB_KEYS) {
        if (Object.prototype.hasOwnProperty.call(blob, key)) return true;
      }
      for (const key of SETTINGS_BLOB_KEYS) {
        if (Object.prototype.hasOwnProperty.call(blob, key)) return true;
      }
      return false;
    }
    function extractDomain(blob, name) {
      if (name === "settings") {
        const out = {};
        for (const key of SETTINGS_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(blob, key)) out[key] = blob[key];
        }
        return out;
      }
      if (name === "profile") {
        const out = {};
        for (const key of PROFILE_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(blob, key)) out[key] = blob[key];
        }
        return out;
      }
      const arrayKey = DOMAIN_TO_ARRAY_KEY[name];
      if (arrayKey) {
        const val = blob[arrayKey];
        return Array.isArray(val) ? val : DOMAIN_DEFAULTS[name];
      }
      throw new Error(`Unknown Quest Log domain: ${name}`);
    }
    function applyDomain(blob, name, data) {
      if (name === "settings") {
        const src = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        for (const key of SETTINGS_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(src, key)) blob[key] = src[key];
        }
        return;
      }
      if (name === "profile") {
        const src = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        for (const key of PROFILE_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(src, key)) blob[key] = src[key];
        }
        return;
      }
      const arrayKey = DOMAIN_TO_ARRAY_KEY[name];
      if (arrayKey) {
        blob[arrayKey] = Array.isArray(data) ? data : DOMAIN_DEFAULTS[name];
        return;
      }
      throw new Error(`Unknown Quest Log domain: ${name}`);
    }
    function richnessProfile(p) {
      if (!p || typeof p !== "object" || Array.isArray(p)) return -1;
      const xp = Number(p.currentXp);
      if (Number.isFinite(xp) && xp > 0) return xp;
      return Object.keys(p).length > 0 ? 0 : -1;
    }
    function richnessArray(a) {
      if (!Array.isArray(a)) return -1;
      return a.length;
    }
    function richnessSettings(s) {
      if (!s || typeof s !== "object" || Array.isArray(s)) return -1;
      return Object.keys(s).length;
    }
    function pickRicher(ranked, scoreFn) {
      let best = null;
      let bestScore = -Infinity;
      for (const item of ranked) {
        if (item.value == null) continue;
        const score = scoreFn(item.value);
        if (score > bestScore) {
          bestScore = score;
          best = item.value;
        }
      }
      return best;
    }
    function emptyGodBlob() {
      return {
        store: STORE_MARKER,
        quests: [],
        completedQuests: [],
        habits: [],
        completedHabits: [],
        skills: []
      };
    }
    async function getBlob(plugin) {
      if (blobCache.has(plugin)) return blobCache.get(plugin);
      let loaded = null;
      if (typeof plugin.loadData === "function") {
        try {
          loaded = await plugin.loadData();
        } catch (_e) {
          loaded = null;
        }
      }
      const blob = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? { ...emptyGodBlob(), ...loaded, store: STORE_MARKER } : emptyGodBlob();
      for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
        if (!Array.isArray(blob[key])) blob[key] = [];
      }
      blobCache.set(plugin, blob);
      return blob;
    }
    async function flushBlob(plugin, blob) {
      const next = blob || blobCache.get(plugin) || emptyGodBlob();
      next.store = STORE_MARKER;
      blobCache.set(plugin, next);
      if (plugin._qlDeferSave) {
        plugin._qlDirty = true;
        return;
      }
      if (typeof plugin.saveData !== "function") {
        throw new Error("Quest Log: plugin.saveData unavailable");
      }
      await plugin.saveData(next);
      plugin._qlDirty = false;
    }
    function beginSaveBatch2(plugin) {
      plugin._qlDeferSave = true;
    }
    async function endSaveBatch2(plugin) {
      plugin._qlDeferSave = false;
      if (plugin._qlDirty) {
        await flushBlob(plugin);
      }
    }
    async function loadDomain(plugin, name) {
      if (!(name in DOMAIN_FILES)) {
        throw new Error(`Unknown Quest Log domain: ${name}`);
      }
      const blob = await getBlob(plugin);
      const slice = extractDomain(blob, name);
      const fallback = DOMAIN_DEFAULTS[name];
      if (Array.isArray(fallback)) {
        return Array.isArray(slice) ? slice : fallback;
      }
      return slice && typeof slice === "object" ? slice : fallback;
    }
    async function saveDomain(plugin, name, data) {
      if (!(name in DOMAIN_FILES)) {
        throw new Error(`Unknown Quest Log domain: ${name}`);
      }
      const blob = await getBlob(plugin);
      applyDomain(blob, name, data);
      await flushBlob(plugin, blob);
    }
    async function readDomainFileQuiet(plugin, fullPath, fallback) {
      try {
        if (!await pathExists(plugin, fullPath)) return null;
        return await readJson(plugin, fullPath, fallback);
      } catch (_e) {
        return null;
      }
    }
    async function mergeSourcesIntoGod(plugin, existingBlob) {
      const god = emptyGodBlob();
      if (existingBlob && typeof existingBlob === "object") {
        for (const key of SETTINGS_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(existingBlob, key)) {
            god[key] = existingBlob[key];
          }
        }
        for (const key of PROFILE_BLOB_KEYS) {
          if (Object.prototype.hasOwnProperty.call(existingBlob, key)) {
            god[key] = existingBlob[key];
          }
        }
        for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
          if (Array.isArray(existingBlob[key])) god[key] = existingBlob[key];
        }
      }
      const domains = (
        /** @type {DomainName[]} */
        Object.keys(DOMAIN_FILES)
      );
      for (const name of domains) {
        const fromLoad = extractDomain(god, name);
        const fromPlugin = await readDomainFileQuiet(
          plugin,
          domainPath(plugin, name),
          DOMAIN_DEFAULTS[name]
        );
        const fromStore = await readDomainFileQuiet(
          plugin,
          vaultStoreDomainPath(plugin, name),
          DOMAIN_DEFAULTS[name]
        );
        const ranked = [
          { value: fromPlugin, source: "plugin-dir" },
          { value: fromLoad, source: "loadData" },
          { value: fromStore, source: "_store" }
        ];
        let picked;
        if (name === "profile") {
          picked = pickRicher(ranked, richnessProfile);
          if (picked == null) picked = {};
        } else if (name === "settings") {
          picked = pickRicher(ranked, richnessSettings);
          if (picked == null) picked = {};
        } else {
          picked = pickRicher(ranked, richnessArray);
          if (picked == null) picked = [];
        }
        applyDomain(god, name, picked);
      }
      god.store = STORE_MARKER;
      return god;
    }
    async function migrateIfNeeded2(plugin) {
      let loaded = null;
      if (typeof plugin.loadData === "function") {
        try {
          loaded = await plugin.loadData();
        } catch (_e) {
          loaded = null;
        }
      }
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded) && (loaded.store === STORE_MARKER || isGodBlob(loaded))) {
        const blob = { ...emptyGodBlob(), ...loaded, store: STORE_MARKER };
        for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
          if (!Array.isArray(blob[key])) blob[key] = [];
        }
        blobCache.set(plugin, blob);
        return { migrated: false, reason: "already-god-blob" };
      }
      const merged = await mergeSourcesIntoGod(
        plugin,
        loaded && typeof loaded === "object" ? loaded : {}
      );
      const hasProfile = richnessProfile(extractDomain(merged, "profile")) > 0;
      const hasSettings = richnessSettings(extractDomain(merged, "settings")) > 0;
      let hasArrays = false;
      for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
        if (Array.isArray(merged[key]) && merged[key].length > 0) {
          hasArrays = true;
          break;
        }
      }
      blobCache.set(plugin, merged);
      if (typeof plugin.saveData === "function") {
        await plugin.saveData(merged);
      }
      if (hasProfile || hasSettings || hasArrays) {
        return { migrated: true, reason: "merged-to-data-json" };
      }
      return { migrated: true, reason: "init-empty-god-blob" };
    }
    async function ensureStoreDir(_plugin) {
    }
    async function writeAtomic(plugin, fullPath, content) {
      const adapter = plugin.app.vault.adapter;
      const slash = fullPath.lastIndexOf("/");
      const folderPath = slash >= 0 ? fullPath.slice(0, slash) : "";
      if (folderPath) {
        const parts = folderPath.split("/");
        let acc = "";
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          try {
            await adapter.mkdir(acc);
          } catch (_e) {
          }
        }
      }
      const tmpPath = `${fullPath}.tmp`;
      await adapter.write(tmpPath, content);
      try {
        await adapter.rename(tmpPath, fullPath);
      } catch (_renameErr) {
        await adapter.write(fullPath, content);
        try {
          await adapter.remove(tmpPath);
        } catch (_e) {
        }
      }
    }
    async function writeJsonAtomic(plugin, fullPath, data) {
      await writeAtomic(plugin, fullPath, `${JSON.stringify(data, null, 2)}
`);
    }
    module2.exports = {
      VAULT_STORE_DIR,
      /** @deprecated Use VAULT_STORE_DIR. */
      STORE_DIR: VAULT_STORE_DIR,
      DOMAIN_FILES,
      DOMAIN_DEFAULTS,
      SETTINGS_BLOB_KEYS,
      PROFILE_BLOB_KEYS,
      ARRAY_BLOB_TO_DOMAIN,
      DOMAIN_TO_ARRAY_KEY,
      STORE_MARKER,
      storeDir,
      domainPath,
      dataJsonPath,
      vaultStoreDomainPath,
      legacyPluginDomainPath,
      ensureStoreDir,
      loadDomain,
      saveDomain,
      migrateIfNeeded: migrateIfNeeded2,
      isGodBlob,
      beginSaveBatch: beginSaveBatch2,
      endSaveBatch: endSaveBatch2,
      flushBlob,
      getBlob,
      // Deprecated adapter helpers — do not use for live state.
      writeAtomic,
      writeJsonAtomic,
      readJson
    };
  }
});

// src/skills.js
var require_skills = __commonJS({
  "src/skills.js"(exports2, module2) {
    var { loadDomain, saveDomain } = require_storage();
    var DOMAIN = "skills";
    var SKILL_BASE = 100;
    var SKILL_GROWTH = 1600;
    var SKILL_EXPANSION_RATE = 1.15;
    var SKILL_MAX_LEVEL = 100;
    var XP_PHASE_THRESHOLD = 15;
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
        return Math.floor(lvl * (lvl + 1) / 2 * SKILL_BASE * mult);
      }
      const base = 12e3 * mult;
      const ratio = Math.pow(SKILL_EXPANSION_RATE, lvl - XP_PHASE_THRESHOLD);
      return Math.floor(base + SKILL_GROWTH * mult * (ratio - 1) / (SKILL_EXPANSION_RATE - 1));
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
        const mid = lo + hi + 1 >> 1;
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
        created: input.created || (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    async function createSkill(plugin, input) {
      const skill = buildSkill(input);
      const skills2 = await listSkills(plugin);
      skills2.push(skill);
      await saveDomain(plugin, DOMAIN, skills2);
      return skill;
    }
    async function updateSkill(plugin, id, patch) {
      const skills2 = await listSkills(plugin);
      const idx = skills2.findIndex((s) => s && s.id === id);
      if (idx === -1) throw new Error(`Skill not found: ${id}`);
      const current = skills2[idx];
      const next = { ...current, ...patch, id: current.id, created: current.created };
      if (patch.name !== void 0) next.name = String(patch.name).trim() || current.name;
      if (patch.description !== void 0) next.description = String(patch.description).trim();
      if (patch.legendary !== void 0) next.legendary = Boolean(patch.legendary);
      if (patch.xp !== void 0) next.xp = Math.max(0, Number(patch.xp) || 0);
      if (patch.level !== void 0) next.level = Math.max(1, Number(patch.level) || 1);
      skills2[idx] = next;
      await saveDomain(plugin, DOMAIN, skills2);
      return next;
    }
    async function deleteSkill(plugin, id) {
      const skills2 = await listSkills(plugin);
      const idx = skills2.findIndex((s) => s && s.id === id);
      if (idx === -1) return null;
      const [removed] = skills2.splice(idx, 1);
      await saveDomain(plugin, DOMAIN, skills2);
      return removed;
    }
    async function applyXpToSkills(plugin, xp, skillIds, difficulty = 10) {
      if (!skillIds || skillIds.length === 0 || !xp) return [];
      const skills2 = await listSkills(plugin);
      const touched = [];
      for (const skillId of skillIds) {
        const skill = skills2.find((s) => s && s.id === skillId);
        if (skill && !skill.legendary) {
          skill.xp = (skill.xp || 0) + xp;
          skill.level = getSkillLevel(skill.xp, difficulty);
          touched.push(skill);
        }
      }
      if (touched.length) await saveDomain(plugin, DOMAIN, skills2);
      return touched;
    }
    async function revokeSkillXp(plugin, xp, skillIds, difficulty = 10) {
      if (!skillIds || skillIds.length === 0 || !xp) return [];
      const skills2 = await listSkills(plugin);
      const touched = [];
      for (const skillId of skillIds) {
        const skill = skills2.find((s) => s && s.id === skillId);
        if (skill && !skill.legendary) {
          skill.xp = Math.max(0, (skill.xp || 0) - xp);
          skill.level = getSkillLevel(skill.xp, difficulty);
          touched.push(skill);
        }
      }
      if (touched.length) await saveDomain(plugin, DOMAIN, skills2);
      return touched;
    }
    async function saveSkills(plugin, list) {
      await saveDomain(plugin, DOMAIN, Array.isArray(list) ? list : []);
    }
    module2.exports = {
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
      saveSkills
    };
  }
});

// src/profile.js
var require_profile = __commonJS({
  "src/profile.js"(exports2, module2) {
    var { loadDomain, saveDomain } = require_storage();
    var { getXpMultiplier } = require_skills();
    var DOMAIN = "profile";
    var XP_BASE = 1e3;
    var XP_GROWTH = 16e3;
    var XP_EXPANSION_RATE = 1.2;
    var XP_PHASE_THRESHOLD = 15;
    var XP_TRI_MAX = 12e4;
    var DEFAULT_PROFILE = Object.freeze({
      heroName: "Hero",
      currentXp: 0,
      questsCompleted: 0,
      coins: 0,
      rewards: []
    });
    function getXpForLvl(lvl, difficulty = 10) {
      if (lvl <= 0) return 0;
      const mult = getXpMultiplier(difficulty);
      if (lvl <= XP_PHASE_THRESHOLD) {
        return Math.floor(lvl * (lvl + 1) / 2 * XP_BASE * mult);
      }
      const base = XP_TRI_MAX * mult;
      const ratio = Math.pow(XP_EXPANSION_RATE, lvl - XP_PHASE_THRESHOLD);
      return Math.floor(base + XP_GROWTH * mult * (ratio - 1) / (XP_EXPANSION_RATE - 1));
    }
    function getLevel(currentXp, difficulty = 10) {
      const xp = currentXp || 0;
      let lo = 0;
      let hi = 1;
      while (getXpForLvl(hi, difficulty) <= xp) {
        lo = hi;
        hi = hi * 2;
        if (hi > 1e4) break;
      }
      while (lo < hi) {
        const mid = lo + hi + 1 >> 1;
        if (getXpForLvl(mid, difficulty) <= xp) lo = mid;
        else hi = mid - 1;
      }
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
        rewards: []
      };
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
      if (raw.heroName !== void 0) {
        const name = String(raw.heroName).trim();
        base.heroName = name || DEFAULT_PROFILE.heroName;
      }
      if (raw.currentXp !== void 0) base.currentXp = Math.max(0, Number(raw.currentXp) || 0);
      if (raw.questsCompleted !== void 0) {
        base.questsCompleted = Math.max(0, Number(raw.questsCompleted) || 0);
      }
      if (raw.coins !== void 0) base.coins = Math.max(0, Number(raw.coins) || 0);
      if (Array.isArray(raw.rewards)) base.rewards = raw.rewards;
      return base;
    }
    async function loadProfile(plugin) {
      return normalizeProfile(await loadDomain(plugin, DOMAIN));
    }
    async function saveProfile(plugin, profile2) {
      const normalized = normalizeProfile(profile2);
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
    async function awardXp(plugin, xp, opts = {}) {
      const amount = Math.max(0, Number(xp) || 0);
      const difficulty = opts.difficulty != null ? Number(opts.difficulty) : 10;
      const grantCoins = Boolean(opts.grantCoins);
      const profile2 = await loadProfile(plugin);
      const levelBefore = getLevel(profile2.currentXp, difficulty);
      profile2.currentXp += amount;
      if (grantCoins && amount > 0) {
        const coins = Math.max(1, Math.min(50, Math.round(amount / 1e4)));
        profile2.coins += coins;
      }
      const levelAfter = getLevel(profile2.currentXp, difficulty);
      if (levelAfter > levelBefore) {
        profile2.coins += levelAfter * 10;
      }
      await saveProfile(plugin, profile2);
      return {
        profile: profile2,
        leveledUp: levelAfter > levelBefore,
        levelBefore,
        levelAfter
      };
    }
    async function revokeXp(plugin, xp, opts = {}) {
      const amount = Math.max(0, Number(xp) || 0);
      const grantCoins = Boolean(opts.grantCoins);
      const profile2 = await loadProfile(plugin);
      profile2.currentXp = Math.max(0, profile2.currentXp - amount);
      if (grantCoins && amount > 0) {
        const coins = Math.max(1, Math.min(50, Math.round(amount / 1e4)));
        profile2.coins = Math.max(0, profile2.coins - coins);
      }
      await saveProfile(plugin, profile2);
      return profile2;
    }
    async function incrementQuestsCompleted(plugin, delta = 1) {
      const profile2 = await loadProfile(plugin);
      profile2.questsCompleted = Math.max(0, profile2.questsCompleted + delta);
      await saveProfile(plugin, profile2);
      return profile2;
    }
    async function addReward(plugin, input) {
      const name = String(input.name || "").trim();
      if (!name) throw new Error("Reward name is required");
      const profile2 = await loadProfile(plugin);
      const reward = {
        id: input.id != null ? String(input.id) : Date.now().toString(),
        name,
        description: String(input.description || "").trim(),
        price: Math.max(1, parseInt(input.price, 10) || 1),
        stock: input.stock === null || input.stock === void 0 || input.stock === "" ? null : Math.max(1, parseInt(input.stock, 10) || 1),
        createdAt: input.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
      profile2.rewards.push(reward);
      await saveProfile(plugin, profile2);
      return reward;
    }
    async function removeReward(plugin, id) {
      const profile2 = await loadProfile(plugin);
      const idx = profile2.rewards.findIndex((r) => r && r.id === id);
      if (idx === -1) return null;
      const [removed] = profile2.rewards.splice(idx, 1);
      await saveProfile(plugin, profile2);
      return removed;
    }
    module2.exports = {
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
      removeReward
    };
  }
});

// src/settings.js
var require_settings = __commonJS({
  "src/settings.js"(exports2, module2) {
    var { loadDomain, saveDomain } = require_storage();
    var { generateXpCurveTable } = require_profile();
    var DOMAIN = "settings";
    var DEFAULT_SETTINGS = Object.freeze({
      rewardsMode: false,
      userProfileFileName: "User Profile",
      userProfileFolder: "Quest Log",
      questsFolderPath: "Quest Log/Quests",
      habitsFolderPath: "Quest Log/Habits",
      skillsFolderPath: "Quest Log/Skills",
      completedFolderPath: "Quest Log/Completed",
      userDifficulty: 10,
      skillDifficulty: 1,
      showXpCurvePreview: false
    });
    var PATH_KEYS = Object.freeze([
      "questsFolderPath",
      "habitsFolderPath",
      "skillsFolderPath",
      "completedFolderPath",
      "userProfileFolder"
    ]);
    function normalizeSettings(raw) {
      const base = { ...DEFAULT_SETTINGS };
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return base;
      }
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== void 0) {
          base[key] = raw[key];
        }
      }
      for (const key of PATH_KEYS) {
        if (typeof base[key] === "string") {
          base[key] = base[key].trim().replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS[key];
        }
      }
      if (typeof base.userProfileFileName === "string") {
        base.userProfileFileName = base.userProfileFileName.trim() || DEFAULT_SETTINGS.userProfileFileName;
      }
      base.rewardsMode = Boolean(base.rewardsMode);
      base.showXpCurvePreview = Boolean(base.showXpCurvePreview);
      base.userDifficulty = clampDifficulty(base.userDifficulty, 10);
      base.skillDifficulty = clampDifficulty(base.skillDifficulty, 1);
      return base;
    }
    function clampDifficulty(n, fallback) {
      const v = Number(n);
      if (!Number.isFinite(v)) return fallback;
      return Math.max(1, Math.min(20, Math.round(v)));
    }
    async function loadSettings2(plugin) {
      const raw = await loadDomain(plugin, DOMAIN);
      return normalizeSettings(raw);
    }
    async function saveSettings2(plugin, settings) {
      const normalized = normalizeSettings(settings);
      await saveDomain(plugin, DOMAIN, normalized);
      return normalized;
    }
    async function patchSettings(plugin, patch) {
      const current = await loadSettings2(plugin);
      return saveSettings2(plugin, { ...current, ...patch });
    }
    function createSettingTabModule2(obsidian) {
      const { PluginSettingTab, Setting } = obsidian;
      class QuestLogSettingTab extends PluginSettingTab {
        /**
         * @param {*} app
         * @param {import('obsidian').Plugin} plugin
         */
        constructor(app, plugin) {
          super(app, plugin);
          this.plugin = plugin;
        }
        async _load() {
          if (typeof this.plugin.loadQuestSettings === "function") {
            return this.plugin.loadQuestSettings();
          }
          return loadSettings2(this.plugin);
        }
        async _save(settings) {
          if (typeof this.plugin.saveQuestSettings === "function") {
            return this.plugin.saveQuestSettings(settings);
          }
          return saveSettings2(this.plugin, settings);
        }
        /** Keep legacy `plugin.settings` mirror in sync when present. */
        _mirror(settings) {
          if (this.plugin.settings && typeof this.plugin.settings === "object") {
            Object.assign(this.plugin.settings, settings);
          }
        }
        display() {
          const { containerEl } = this;
          containerEl.empty();
          void this._load().then((settings) => {
            this._mirror(settings);
            this._render(containerEl, settings);
          });
        }
        /**
         * @param {HTMLElement} containerEl
         * @param {object} settings
         */
        _render(containerEl, settings) {
          containerEl.empty();
          containerEl.createEl("h3", { text: "Rewards" });
          new Setting(containerEl).setName("Rewards Mode").setDesc(
            "Toggle the Rewards feature to earn coins for completing quests! Spend coins in the Rewards Shop for IRL rewards for working hard!"
          ).addToggle(
            (toggle) => toggle.setValue(Boolean(settings.rewardsMode)).onChange(async (value) => {
              settings.rewardsMode = value;
              await this._save(settings);
              this._mirror(settings);
            })
          );
          containerEl.createEl("h3", { text: "XP Curve" });
          new Setting(containerEl).setName("Show XP curve difficulty preview").setDesc(
            "When on, shows a levels 1\u20135 XP table under each difficulty slider so you can see how the curve changes."
          ).addToggle(
            (toggle) => toggle.setValue(Boolean(settings.showXpCurvePreview)).onChange(async (value) => {
              settings.showXpCurvePreview = value;
              await this._save(settings);
              this._mirror(settings);
              this._render(containerEl, settings);
            })
          );
          const renderPreviewTable = (hostEl, difficulty, title) => {
            hostEl.empty();
            if (!settings.showXpCurvePreview) return;
            hostEl.createEl("h4", { text: title });
            const wrap = hostEl.createEl("div", { cls: "xp-curve-table-container" });
            const table = generateXpCurveTable(difficulty, 5);
            const tableEl = wrap.createEl("table", { cls: "xp-curve-table" });
            const thead = tableEl.createEl("thead");
            const headerRow = thead.createEl("tr");
            headerRow.createEl("th", { text: "Level" });
            headerRow.createEl("th", { text: "Total XP" });
            headerRow.createEl("th", { text: "XP for Level" });
            const tbody = tableEl.createEl("tbody");
            for (const row of table) {
              const tr = tbody.createEl("tr");
              tr.createEl("td", { text: String(row.level) });
              tr.createEl("td", { text: Number(row.totalXp).toLocaleString() });
              tr.createEl("td", { text: Number(row.deltaXp).toLocaleString() });
            }
          };
          new Setting(containerEl).setName("User Leveling Difficulty").setDesc("Adjust how quickly you level up. Lower = faster, Higher = slower. (Default: 10)").addSlider(
            (slider) => slider.setLimits(1, 20, 1).setValue(settings.userDifficulty || 10).setDynamicTooltip().onChange(async (value) => {
              settings.userDifficulty = value;
              if (typeof this.plugin.invalidateLevelCache === "function") {
                this.plugin.invalidateLevelCache();
              }
              await this._save(settings);
              this._mirror(settings);
              renderPreviewTable(
                userPreviewEl,
                settings.userDifficulty || 10,
                "User XP Curve (Levels 1-5)"
              );
            })
          );
          const userPreviewEl = containerEl.createEl("div", { cls: "xp-curve-preview" });
          renderPreviewTable(
            userPreviewEl,
            settings.userDifficulty || 10,
            "User XP Curve (Levels 1-5)"
          );
          new Setting(containerEl).setName("Skill Leveling Difficulty").setDesc("Adjust how quickly skills level up. Lower = faster, Higher = slower. (Default: 10)").addSlider(
            (slider) => slider.setLimits(1, 20, 1).setValue(settings.skillDifficulty || 10).setDynamicTooltip().onChange(async (value) => {
              settings.skillDifficulty = value;
              await this._save(settings);
              this._mirror(settings);
              renderPreviewTable(
                skillPreviewEl,
                settings.skillDifficulty || 10,
                "Skill XP Curve (Levels 1-5)"
              );
            })
          );
          const skillPreviewEl = containerEl.createEl("div", { cls: "xp-curve-preview" });
          renderPreviewTable(
            skillPreviewEl,
            settings.skillDifficulty || 10,
            "Skill XP Curve (Levels 1-5)"
          );
          containerEl.createEl("h3", { text: "Export" });
          new Setting(containerEl).setName("Export markdown sidecars").setDesc(
            "Write quests, habits, skills, completed files, and User Profile.md from live domain stores. Mutations do not write markdown."
          ).addButton(
            (btn) => btn.setButtonText("Export").onClick(async () => {
              if (typeof this.plugin.exportMarkdown === "function") {
                await this.plugin.exportMarkdown();
              }
            })
          );
          containerEl.createEl("h3", { text: "File Paths" });
          const pathField = (name, desc, key, placeholder) => {
            new Setting(containerEl).setName(name).setDesc(desc).addText((text) => {
              text.setPlaceholder(placeholder).setValue(settings[key] || "").onChange(async (value) => {
                settings[key] = value.trim();
                await this._save(settings);
                this._mirror(settings);
              });
            });
          };
          pathField(
            "User Profile File",
            "Name of the user profile markdown file.",
            "userProfileFileName",
            "User Profile"
          );
          pathField(
            "User Profile Folder",
            "Folder where the user profile file is stored.",
            "userProfileFolder",
            "Quest Log"
          );
          pathField(
            "Quests Folder",
            "Folder where quest markdown files are stored.",
            "questsFolderPath",
            "Quest Log/Quests"
          );
          pathField(
            "Habits Folder",
            "Folder where habit markdown files are stored.",
            "habitsFolderPath",
            "Quest Log/Habits"
          );
          pathField(
            "Skills Folder",
            "Folder where skill markdown files are stored.",
            "skillsFolderPath",
            "Quest Log/Skills"
          );
          pathField(
            "Completed Quests Folder",
            "Folder where completed quest markdown files are stored.",
            "completedFolderPath",
            "Quest Log/Completed"
          );
          containerEl.createEl("h3", { text: "Danger Zone" });
          new Setting(containerEl).setName("Reset All Data").setDesc("Reset hero level, xp, and all quest data. This action cannot be undone.").addButton(
            (btn) => btn.setButtonText("Reset").setWarning().onClick(async () => {
              if (typeof this.plugin.resetAllData === "function") {
                await this.plugin.resetAllData();
              }
            })
          );
        }
      }
      return { QuestLogSettingTab };
    }
    module2.exports = {
      DOMAIN,
      DEFAULT_SETTINGS,
      PATH_KEYS,
      normalizeSettings,
      loadSettings: loadSettings2,
      saveSettings: saveSettings2,
      patchSettings,
      createSettingTabModule: createSettingTabModule2
    };
  }
});

// src/quests.js
var require_quests = __commonJS({
  "src/quests.js"(exports2, module2) {
    var {
      loadDomain,
      saveDomain
    } = require_storage();
    var ACTIVE = "active_quests";
    var COMPLETED = "completed_quests";
    function calcQuestXp(d, u, i) {
      const difficulty = clampStat(d);
      const urgency = clampStat(u);
      const impact = clampStat(i);
      const sum = difficulty + urgency + impact;
      if (sum <= 3) return 100;
      if (sum >= 15) return 5e5;
      const exp = (sum - 3) / 12;
      return Math.round(100 * Math.pow(5e3, exp));
    }
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
      const list = await listActive(plugin);
      return list.find((q) => q && q.id === id) || null;
    }
    async function getCompleted(plugin, id) {
      const list = await listCompleted(plugin);
      return list.find((q) => q && q.id === id) || null;
    }
    function buildQuest(input) {
      const title = String(input.title || "").trim();
      if (!title) {
        throw new Error("Quest title is required");
      }
      const difficulty = clampStat(input.difficulty ?? 3);
      const urgency = clampStat(input.urgency ?? 3);
      const impact = clampStat(input.impact ?? 3);
      const skillIds = Array.isArray(input.skillIds) ? input.skillIds.map(String) : [];
      return {
        id: input.id != null ? String(input.id) : Date.now().toString(),
        title,
        description: String(input.description || "").trim(),
        difficulty,
        urgency,
        impact,
        xp: calcQuestXp(difficulty, urgency, impact),
        created: input.created || (/* @__PURE__ */ new Date()).toISOString(),
        skillIds
      };
    }
    async function createQuest(plugin, input) {
      const quest = buildQuest(input);
      const active = await listActive(plugin);
      active.push(quest);
      await saveDomain(plugin, ACTIVE, active);
      return quest;
    }
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
        created: current.created
      };
      if (patch.title !== void 0) {
        next.title = String(patch.title).trim() || current.title;
      }
      if (patch.description !== void 0) {
        next.description = String(patch.description).trim();
      }
      if (patch.difficulty !== void 0) next.difficulty = clampStat(patch.difficulty);
      if (patch.urgency !== void 0) next.urgency = clampStat(patch.urgency);
      if (patch.impact !== void 0) next.impact = clampStat(patch.impact);
      if (patch.skillIds !== void 0) {
        next.skillIds = Array.isArray(patch.skillIds) ? patch.skillIds.map(String) : [];
      }
      next.xp = calcQuestXp(next.difficulty, next.urgency, next.impact);
      active[idx] = next;
      await saveDomain(plugin, ACTIVE, active);
      return next;
    }
    async function deleteActive(plugin, id) {
      const active = await listActive(plugin);
      const idx = active.findIndex((q) => q && q.id === id);
      if (idx === -1) return null;
      const [removed] = active.splice(idx, 1);
      await saveDomain(plugin, ACTIVE, active);
      return removed;
    }
    async function deleteCompleted(plugin, id) {
      const completed = await listCompleted(plugin);
      const idx = completed.findIndex((q) => q && q.id === id);
      if (idx === -1) return null;
      const [removed] = completed.splice(idx, 1);
      await saveDomain(plugin, COMPLETED, completed);
      return removed;
    }
    async function completeQuest(plugin, id) {
      const active = await listActive(plugin);
      const idx = active.findIndex((q) => q && q.id === id);
      if (idx === -1) {
        throw new Error(`Active quest not found: ${id}`);
      }
      const [quest] = active.splice(idx, 1);
      const completedQuest = {
        ...quest,
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const completed = await listCompleted(plugin);
      completed.push(completedQuest);
      await saveDomain(plugin, ACTIVE, active);
      await saveDomain(plugin, COMPLETED, completed);
      return completedQuest;
    }
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
    async function saveActive(plugin, list) {
      await saveDomain(plugin, ACTIVE, Array.isArray(list) ? list : []);
    }
    async function saveCompleted(plugin, list) {
      await saveDomain(plugin, COMPLETED, Array.isArray(list) ? list : []);
    }
    module2.exports = {
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
      saveCompleted
    };
  }
});

// src/habits.js
var require_habits = __commonJS({
  "src/habits.js"(exports2, module2) {
    var { loadDomain, saveDomain } = require_storage();
    var { calcQuestXp } = require_quests();
    var ACTIVE = "habits";
    var COMPLETED = "completed_habits";
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
      return list.find(
        (h) => h && h.id === id && (completedAt == null || h.completedAt === completedAt)
      ) || null;
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
        created: input.created || (/* @__PURE__ */ new Date()).toISOString(),
        skillIds: Array.isArray(input.skillIds) ? input.skillIds.map(String) : []
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
      if (patch.title !== void 0) next.title = String(patch.title).trim() || current.title;
      if (patch.description !== void 0) next.description = String(patch.description).trim();
      if (patch.difficulty !== void 0) next.difficulty = clampStat(patch.difficulty);
      if (patch.urgency !== void 0) next.urgency = clampStat(patch.urgency);
      if (patch.impact !== void 0) next.impact = clampStat(patch.impact);
      if (patch.skillIds !== void 0) {
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
        (h) => h && h.id === id && (completedAt == null || h.completedAt === completedAt)
      );
      if (idx === -1) return null;
      const [removed] = completed.splice(idx, 1);
      await saveDomain(plugin, COMPLETED, completed);
      return removed;
    }
    async function completeHabit(plugin, id) {
      const active = await listActive(plugin);
      const habit = active.find((h) => h && h.id === id);
      if (!habit) throw new Error(`Active habit not found: ${id}`);
      const completedHabit = {
        ...habit,
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const completed = await listCompleted(plugin);
      completed.push(completedHabit);
      await saveDomain(plugin, COMPLETED, completed);
      return completedHabit;
    }
    async function uncompleteHabit(plugin, id, completedAt) {
      const completed = await listCompleted(plugin);
      const idx = completed.findIndex(
        (h) => h && h.id === id && (completedAt == null || h.completedAt === completedAt)
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
    module2.exports = {
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
      saveCompleted
    };
  }
});

// src/render.js
var require_render = __commonJS({
  "src/render.js"(exports2, module2) {
    "use strict";
    var { loadDomain } = require_storage();
    var QUESTLOG_VIEW_TYPE2 = "quest-log-view";
    async function loadSnapshot(plugin) {
      return {
        settings: await loadDomain(plugin, "settings"),
        profile: await loadDomain(plugin, "profile"),
        quests: await loadDomain(plugin, "active_quests"),
        completedQuests: await loadDomain(plugin, "completed_quests"),
        habits: await loadDomain(plugin, "habits"),
        completedHabits: await loadDomain(plugin, "completed_habits"),
        skills: await loadDomain(plugin, "skills")
      };
    }
    function registerQuestLogView2(plugin, obsidian) {
      const { QuestLogView } = createRenderModule(obsidian);
      plugin.registerView(QUESTLOG_VIEW_TYPE2, (leaf) => new QuestLogView(leaf, plugin));
      return { QuestLogView, QUESTLOG_VIEW_TYPE: QUESTLOG_VIEW_TYPE2 };
    }
    function createRenderModule(obsidianNS) {
      const { ItemView, Notice, setIcon } = obsidianNS;
      function __name(fn, _n) {
        return fn;
      }
      function __publicField(obj, key, val) {
        obj[key] = val;
        return val;
      }
      async function writeSidecarAtomic() {
        return;
      }
      async function writeQuestFile() {
        return;
      }
      async function writeCompletedQuestFile() {
        return;
      }
      async function writeHabitFile() {
        return;
      }
      async function writeSkillFile() {
        return;
      }
      async function writeUserProfile() {
        return;
      }
      async function trashIfExists() {
        return false;
      }
      async function retireNote() {
        return false;
      }
      var _Xp = class _Xp {
        static getXpMultiplier(difficulty) {
          const diff = difficulty || 10;
          if (diff <= 10) {
            return 0.5 + (diff - 1) * (1 / 18);
          }
          return 1 + (diff - 10) * 0.1;
        }
        static getXpForLvl(lvl, difficulty = 10) {
          if (lvl <= 0) return 0;
          const mult = this.getXpMultiplier(difficulty);
          if (lvl <= this.XP_PHASE_THRESHOLD) {
            return Math.floor(lvl * (lvl + 1) / 2 * this.XP_BASE * mult);
          }
          const base = this.XP_TRI_MAX * mult;
          const ratio = Math.pow(this.XP_EXPANSION_RATE, lvl - this.XP_PHASE_THRESHOLD);
          return Math.floor(base + this.XP_GROWTH * mult * (ratio - 1) / (this.XP_EXPANSION_RATE - 1));
        }
        static getLevel(currentXp, difficulty = 10) {
          const xp = currentXp || 0;
          let lo = 0;
          let hi = 1;
          while (this.getXpForLvl(hi, difficulty) <= xp) {
            lo = hi;
            hi = hi * 2;
            if (hi > 1e4) break;
          }
          while (lo < hi) {
            const mid = lo + hi + 1 >> 1;
            if (this.getXpForLvl(mid, difficulty) <= xp) lo = mid;
            else hi = mid - 1;
          }
          return lo + 1;
        }
        static xpProgress(level, xp, difficulty = 10) {
          const derivedLevel = this.getLevel(xp, difficulty);
          const xpFromPrev = this.getXpForLvl(derivedLevel - 1, difficulty);
          const xpForNext = this.getXpForLvl(derivedLevel, difficulty);
          const xpNeeded = Math.max(0, xpForNext - xpFromPrev);
          const rawProgress = (xp || 0) - xpFromPrev;
          const into = xpNeeded > 0 ? Math.min(xpNeeded, Math.max(0, rawProgress)) : 0;
          const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, into / xpNeeded * 100)) : 100;
          return { xpForNext, xpFromPrev, xpNeeded, into, pct, level: derivedLevel };
        }
        static generateXpCurveTable(difficulty = 10, maxLevel = 50) {
          const table = [];
          let prevXp = 0;
          for (let lvl = 1; lvl <= maxLevel; lvl++) {
            const totalXp = this.getXpForLvl(lvl, difficulty);
            const deltaXp = totalXp - prevXp;
            table.push({ level: lvl, totalXp, deltaXp });
            prevXp = totalXp;
          }
          return table;
        }
        static getNextMilestones(currentXp, difficulty = 10, count = 8) {
          const currentLevel = this.getLevel(currentXp, difficulty);
          const milestones = [];
          for (let i = 1; i <= count; i++) {
            const targetLevel = currentLevel + i;
            const totalXp = this.getXpForLvl(targetLevel, difficulty);
            const xpRemaining = totalXp - currentXp;
            if (xpRemaining > 0) {
              milestones.push({ level: targetLevel, totalXp, xpRemaining });
            }
          }
          return milestones;
        }
        static getSkillXpForLvl(lvl, difficulty = 10) {
          if (lvl <= 0) return 0;
          if (lvl > this.SKILL_MAX_LEVEL) return this.getSkillXpForLvl(this.SKILL_MAX_LEVEL, difficulty);
          const mult = this.getXpMultiplier(difficulty);
          if (lvl <= this.XP_PHASE_THRESHOLD) {
            return Math.floor(lvl * (lvl + 1) / 2 * this.SKILL_BASE * mult);
          }
          const base = 12e3 * mult;
          const ratio = Math.pow(this.SKILL_EXPANSION_RATE, lvl - this.XP_PHASE_THRESHOLD);
          return Math.floor(base + this.SKILL_GROWTH * mult * (ratio - 1) / (this.SKILL_EXPANSION_RATE - 1));
        }
        static getSkillLevel(currentXp, difficulty = 10) {
          const xp = currentXp || 0;
          let lo = 0;
          let hi = 1;
          while (hi < this.SKILL_MAX_LEVEL && this.getSkillXpForLvl(hi, difficulty) <= xp) {
            lo = hi;
            hi = Math.min(this.SKILL_MAX_LEVEL, hi * 2);
          }
          while (lo < hi) {
            const mid = lo + hi + 1 >> 1;
            if (this.getSkillXpForLvl(mid, difficulty) <= xp) lo = mid;
            else hi = mid - 1;
          }
          return Math.min(this.SKILL_MAX_LEVEL, lo + 1);
        }
        static getSkillXpProgress(skill, difficulty = 10) {
          const xp = skill.xp || 0;
          const level = this.getSkillLevel(xp, difficulty);
          if (skill.level !== level) skill.level = level;
          const xpForCurrent = this.getSkillXpForLvl(level - 1, difficulty);
          const xpForNext = this.getSkillXpForLvl(level, difficulty);
          const xpNeeded = Math.max(0, xpForNext - xpForCurrent);
          const rawProgress = xp - xpForCurrent;
          const xpProgress = xpNeeded > 0 ? Math.min(xpNeeded, Math.max(0, rawProgress)) : 0;
          const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, xpProgress / xpNeeded * 100)) : 100;
          return {
            xp,
            level,
            xpForCurrent,
            xpForNext,
            xpNeeded,
            xpProgress,
            pct
          };
        }
        static calcXp(d, u, i) {
          return this._XP_TABLE[`${d},${u},${i}`] || 100;
        }
        static getLevelTitle(lvl) {
          return this._LEVEL_TITLES[Math.min(lvl, 50)] || "Legendary";
        }
      };
      __name(_Xp, "Xp");
      _Xp.XP_BASE = 1e3;
      _Xp.XP_GROWTH = 16e3;
      _Xp.XP_EXPANSION_RATE = 1.2;
      _Xp.XP_PHASE_THRESHOLD = 15;
      _Xp.XP_TRI_MAX = 12e4;
      _Xp.SKILL_BASE = 100;
      _Xp.SKILL_GROWTH = 1600;
      _Xp.SKILL_EXPANSION_RATE = 1.15;
      _Xp.SKILL_MAX_LEVEL = 100;
      _Xp.DIFFICULTY_LABELS = ["Trivial", "Easy", "Medium", "Hard", "Legendary"];
      _Xp.URGENCY_LABELS = ["Relaxed", "Soon", "Urgent", "Critical", "Immediate"];
      _Xp.IMPACT_LABELS = ["Minor", "Notable", "Major", "Epic", "Legendary"];
      _Xp._XP_TABLE = (() => {
        const table = {};
        for (let d = 1; d <= 5; d++) {
          for (let u = 1; u <= 5; u++) {
            for (let i = 1; i <= 5; i++) {
              const sum = d + u + i;
              let xp;
              if (sum <= 3) xp = 100;
              else if (sum >= 15) xp = 5e5;
              else {
                const exp = (sum - 3) / 12;
                xp = Math.round(100 * Math.pow(5e3, exp));
              }
              table[`${d},${u},${i}`] = xp;
            }
          }
        }
        return table;
      })();
      _Xp._LEVEL_TITLES = [
        "Novice Adventurer",
        "Novice Adventurer",
        "Novice Adventurer",
        "Novice Adventurer",
        "Apprentice",
        "Apprentice",
        "Apprentice",
        "Apprentice",
        "Apprentice",
        "Journeyman",
        "Journeyman",
        "Journeyman",
        "Journeyman",
        "Journeyman",
        "Veteran",
        "Veteran",
        "Veteran",
        "Veteran",
        "Veteran",
        "Master",
        "Master",
        "Master",
        "Master",
        "Master",
        "Grandmaster",
        "Grandmaster",
        "Grandmaster",
        "Grandmaster",
        "Grandmaster",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Champion",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Mythic",
        "Legendary"
      ];
      var Xp = _Xp;
      function stars(n) {
        return "\u2B50".repeat(n);
      }
      __name(stars, "stars");
      function safeName(str) {
        return String(str || "").replace(/[\\/:*?"<>|]/g, "-");
      }
      __name(safeName, "safeName");
      function uniqueStem(list, title, id, key) {
        const base = safeName(title);
        const clash = (list || []).some((item) => item.id !== id && safeName(item[key]) === base);
        return clash ? `${base}-${id}` : base;
      }
      __name(uniqueStem, "uniqueStem");
      async function trashIfExists(plugin, fullPath) {
        const file = plugin.app.vault.getAbstractFileByPath(fullPath);
        if (!file) return false;
        try {
          await plugin.app.vault.trash(file, false);
        } catch (e) {
          await plugin.app.vault.delete(file);
        }
        return true;
      }
      __name(trashIfExists, "trashIfExists");
      function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
      __name(formatDate, "formatDate");
      function formatHabitTimestamp(dateStr) {
        const d = new Date(dateStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, "0");
        const s = String(d.getSeconds()).padStart(2, "0");
        const ms = String(d.getMilliseconds()).padStart(3, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${yyyy}-${mm}-${dd} ${String(h).padStart(2, "0")}_${m}_${s}_${ms} ${ampm}`;
      }
      __name(formatHabitTimestamp, "formatHabitTimestamp");
      function questNotePaths(plugin, quest, list, folderPath) {
        const folder = folderPath;
        const stems = /* @__PURE__ */ new Set([
          uniqueStem(list, quest.title, quest.id, "title"),
          safeName(quest.title)
        ]);
        return [...stems].map((stem) => `${folder}/${stem}.md`);
      }
      __name(questNotePaths, "questNotePaths");
      function habitNotePaths(plugin, habit) {
        const folder = plugin.settings.habitsFolderPath || "Quest Log/Habits";
        const stems = /* @__PURE__ */ new Set([
          uniqueStem(plugin.settings.habits, habit.title, habit.id, "title"),
          safeName(habit.title)
        ]);
        return [...stems].map((stem) => `${folder}/${stem}.md`);
      }
      __name(habitNotePaths, "habitNotePaths");
      function skillNotePaths(plugin, skill) {
        const folder = plugin.settings.skillsFolderPath || "Quest Log/Skills";
        const stems = /* @__PURE__ */ new Set([
          uniqueStem(plugin.settings.skills, skill.name, skill.id, "name"),
          safeName(skill.name)
        ]);
        return [...stems].map((stem) => `${folder}/${stem}.md`);
      }
      __name(skillNotePaths, "skillNotePaths");
      function completedHabitNotePath(plugin, habit, completedAt) {
        const folder = plugin.settings.completedFolderPath || "Quest Log/Completed";
        return `${folder}/${safeName(habit.title)} - ${formatHabitTimestamp(completedAt)}.md`;
      }
      __name(completedHabitNotePath, "completedHabitNotePath");
      var _SkillRadarChart = class _SkillRadarChart {
        /**
         * @param {HTMLElement} container - The container element to render into
         * @param {Array} skills - Array of skill objects { name, level, xp, legendary? }
         * @param {Function} onSkillClick - Callback when a skill is clicked
         */
        constructor(container, skills2, onSkillClick) {
          this.container = container;
          this.skills = skills2;
          this.onSkillClick = onSkillClick;
          const containerRect = container.getBoundingClientRect();
          const maxSize = Math.min(containerRect.width || 340, containerRect.height || 340, 340);
          this.size = Math.max(300, maxSize);
          this.center = this.size / 2;
          this.maxRadius = this.size / 2 - 50;
          this.numCircles = 5;
          this.polygonColor = "#22c55e";
          this.polygonFill = "rgba(34, 197, 94, 0.4)";
          this.lineColor = "#3a3a3a";
          this.radialLineColor = "#444";
          this.textColor = "#aaa";
          this.textHoverColor = "#fff";
          this.bgColor = "transparent";
          this.displaySkills = [...skills2].sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 10);
          this.maxLevel = Math.max(...this.displaySkills.map((s) => s.level || 1), 1);
        }
        /**
         * Calculate point position on the radar chart
         */
        getPoint(angle, radius) {
          return {
            x: this.center + radius * Math.cos(angle - Math.PI / 2),
            y: this.center + radius * Math.sin(angle - Math.PI / 2)
          };
        }
        /**
         * Calculate label position - Top label centered, quadrant-anchored
         * 
         * COORDINATE SYSTEM:
         * - angle=0 maps to 12 o'clock (top) after the -PI/2 offset
         * - deg=0 is the TOP position, NOT 270 degrees
         * 
         * Top (angle≈0, deg≈0): centered on vertical axis
         * Right (deg 45-135): text-anchor="start"
         * Bottom (deg≈180): text-anchor="middle" 
         * Left (deg 225-315): text-anchor="end"
         * Top-ish (deg 315-360, 0-45): text-anchor="middle"
         */
        getRadialLabelPosition(angle, skillName, extraOffset = 0) {
          let normAngle = angle;
          while (normAngle < 0) normAngle += 2 * Math.PI;
          while (normAngle >= 2 * Math.PI) normAngle -= 2 * Math.PI;
          const deg = normAngle * 180 / Math.PI;
          const baseOffset = 30 + extraOffset;
          const labelRadius = this.maxRadius + baseOffset;
          const x = this.center + labelRadius * Math.cos(normAngle - Math.PI / 2);
          const y = this.center + labelRadius * Math.sin(normAngle - Math.PI / 2);
          const isTop = deg < 15 || deg >= 345;
          const isBottom = deg >= 165 && deg <= 195;
          const isLeft = deg >= 255 && deg <= 285;
          const isRight = deg >= 75 && deg <= 105;
          let textAnchor, dy;
          if (isTop) {
            textAnchor = "middle";
            dy = 0;
          } else if (isBottom) {
            textAnchor = "middle";
            dy = 12;
          } else if (isLeft) {
            textAnchor = "end";
            dy = 0;
          } else if (isRight) {
            textAnchor = "start";
            dy = 0;
          } else if (deg < 90) {
            textAnchor = "start";
            dy = -2;
          } else if (deg < 165) {
            textAnchor = "start";
            dy = 10;
          } else if (deg < 255) {
            textAnchor = "end";
            dy = 10;
          } else {
            textAnchor = "end";
            dy = -2;
          }
          const maxLen = this.displaySkills.length <= 4 ? 16 : this.displaySkills.length <= 6 ? 13 : 10;
          let displayName = skillName;
          if (skillName.length > maxLen) {
            displayName = skillName.substring(0, maxLen - 2) + "..";
          }
          return { x, y, textAnchor, dy, displayName, angle: normAngle };
        }
        /**
         * Generate clean, collision-free labels with smart spacing
         * Uses radial positioning without text rotation for readability
         */
        generateAntiOverlapLabels() {
          const angleStep = 2 * Math.PI / this.displaySkills.length;
          let labels = "";
          const positions = this.displaySkills.map((skill, i) => ({
            skill,
            index: i,
            ...this.getRadialLabelPosition(i * angleStep, skill.name)
          }));
          const collisionMap = /* @__PURE__ */ new Map();
          for (let i = 0; i < positions.length; i++) {
            let collisions = 0;
            for (let j = 0; j < positions.length; j++) {
              if (i === j) continue;
              const diff = Math.abs(positions[i].angle - positions[j].angle);
              if (diff < 0.4 || Math.abs(diff - 2 * Math.PI) < 0.4) {
                collisions++;
              }
            }
            collisionMap.set(i, collisions);
          }
          const resolved = positions.map((pos, idx) => {
            const collisions = collisionMap.get(idx) || 0;
            const extraOffset = collisions * 10;
            return {
              ...pos,
              ...this.getRadialLabelPosition(pos.angle, pos.skill.name, extraOffset)
            };
          });
          const fontSize = this.displaySkills.length <= 4 ? 11 : this.displaySkills.length <= 6 ? 10 : 9;
          resolved.forEach((pos, i) => {
            labels += `<text 
        x="${pos.x.toFixed(1)}" 
        y="${(pos.y + pos.dy).toFixed(1)}" 
        fill="${pos.skill.legendary ? "#fbbf24" : this.textColor}" 
        font-size="${fontSize}" 
        font-weight="600"
        font-family="system-ui, -apple-system, sans-serif"
        text-anchor="${pos.textAnchor}"
        style="cursor: pointer; user-select: none;"
        data-skill-index="${i}"
        class="skill-radar-label"
      >${pos.displayName}</text>`;
          });
          return labels;
        }
        /**
         * Generate SVG path for the skill polygon
         */
        generatePolygonPath() {
          const angleStep = 2 * Math.PI / this.displaySkills.length;
          return this.displaySkills.map((skill, i) => {
            const angle = i * angleStep;
            const normalizedLevel = (skill.level || 1) / this.maxLevel;
            const radius = normalizedLevel * this.maxRadius;
            const point = this.getPoint(angle, radius);
            return `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`;
          }).join(" ") + " Z";
        }
        /**
         * Generate all radial lines from center to each skill axis
         * Each line has a unique ID for hover targeting
         */
        generateRadialLines() {
          const angleStep = 2 * Math.PI / this.displaySkills.length;
          let lines = "";
          this.displaySkills.forEach((skill, i) => {
            const angle = i * angleStep;
            const outerPoint = this.getPoint(angle, this.maxRadius);
            lines += `<line 
        x1="${this.center}" 
        y1="${this.center}" 
        x2="${outerPoint.x}" 
        y2="${outerPoint.y}" 
        stroke="${this.radialLineColor}" 
        stroke-width="1" 
        opacity="0.6"
        class="skill-radar-line"
        data-skill-index="${i}"
      />`;
          });
          return lines;
        }
        /**
         * Generate concentric circles - crisp spider-web grid
         */
        generateCircles() {
          let circles = "";
          const circleStep = this.maxRadius / this.numCircles;
          for (let i = 1; i <= this.numCircles; i++) {
            const radius = i * circleStep;
            const opacity = 0.15 + i / this.numCircles * 0.25;
            circles += `<circle 
        cx="${this.center}" 
        cy="${this.center}" 
        r="${radius}" 
        fill="none" 
        stroke="${this.lineColor}" 
        stroke-width="1" 
        opacity="${opacity}"
      />`;
          }
          return circles;
        }
        /**
         * Generate subtle vertex points - tiny dots only, no large circles
         */
        generateVertexPoints() {
          const angleStep = 2 * Math.PI / this.displaySkills.length;
          let points = "";
          this.displaySkills.forEach((skill, i) => {
            const angle = i * angleStep;
            const normalizedLevel = (skill.level || 1) / this.maxLevel;
            const radius = normalizedLevel * this.maxRadius;
            const point = this.getPoint(angle, radius);
            points += `<circle 
        cx="${point.x}" 
        cy="${point.y}" 
        r="3" 
        fill="${skill.legendary ? "#fbbf24" : this.polygonColor}" 
        style="cursor: pointer;"
        data-skill-index="${i}"
        class="skill-radar-point"
      />`;
          });
          return points;
        }
        /**
         * Generate tooltip elements with dynamic sizing based on text content
         */
        generateTooltips() {
          const angleStep = 2 * Math.PI / this.displaySkills.length;
          let tooltips = "";
          this.displaySkills.forEach((skill, i) => {
            const angle = i * angleStep;
            const level = skill.level || 1;
            const text = `${skill.name} (Lv${level})`;
            const tooltipRadius = this.maxRadius + 55;
            const tx = this.center + tooltipRadius * Math.cos(angle - Math.PI / 2);
            const ty = this.center + tooltipRadius * Math.sin(angle - Math.PI / 2);
            const charWidth = 6.5;
            const textWidth = text.length * charWidth;
            const padding = 16;
            const boxWidth = textWidth + padding;
            const boxHeight = 22;
            const halfWidth = boxWidth / 2;
            tooltips += `<g 
        class="skill-radar-tooltip" 
        data-skill-index="${i}"
        style="opacity: 0; pointer-events: none;"
      >
        <rect 
          x="${tx - halfWidth}" 
          y="${ty - boxHeight / 2 + 1}" 
          width="${boxWidth}" 
          height="${boxHeight}" 
          rx="5" 
          fill="#1a1a1c" 
          stroke="#444" 
          stroke-width="1"
        />
        <text 
          x="${tx}" 
          y="${ty + 4}" 
          fill="#fff" 
          font-size="11" 
          font-weight="600"
          font-family="system-ui, -apple-system, sans-serif"
          text-anchor="middle"
        >${text}</text>
      </g>`;
          });
          return tooltips;
        }
        /**
         * Render the complete chart
         */
        render() {
          this.container.innerHTML = "";
          if (this.displaySkills.length === 0) {
            this.container.innerHTML = `
        <div style="text-align: center; color: #888; padding: 60px 20px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5" style="margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6M6 12h6"/>
          </svg>
          <p style="font-size: 15px; margin: 0 0 6px 0; color: #999;">No skills yet</p>
          <p style="font-size: 12px; margin: 0; opacity: 0.7;">Create skills to visualize your power!</p>
        </div>
      `;
            return;
          }
          const svgParts = [
            this.generateCircles(),
            this.generateRadialLines(),
            `<path d="${this.generatePolygonPath()}" fill="${this.polygonFill}" stroke="${this.polygonColor}" stroke-width="2" stroke-linejoin="round"/>`,
            this.generateVertexPoints(),
            this.generateAntiOverlapLabels(),
            this.generateTooltips()
          ];
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", this.size.toString());
          svg.setAttribute("height", this.size.toString());
          svg.setAttribute("viewBox", `0 0 ${this.size} ${this.size}`);
          svg.style.background = "transparent";
          svg.style.overflow = "visible";
          svg.innerHTML = svgParts.join("");
          this.addEventListeners(svg);
          this.container.appendChild(svg);
        }
        /**
         * Add click and hover event listeners
         */
        addEventListeners(svg) {
          const handleSkillClick = /* @__PURE__ */ __name((index) => {
            if (this.onSkillClick && this.displaySkills[index]) {
              this.onSkillClick(this.displaySkills[index]);
            }
          }, "handleSkillClick");
          svg.querySelectorAll(".skill-radar-label").forEach((text) => {
            text.addEventListener("mouseenter", (e) => {
              const el = e.currentTarget;
              const index = parseInt(el.getAttribute("data-skill-index"));
              el.setAttribute("fill", this.textHoverColor);
              const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
              if (line) {
                line.setAttribute("stroke", this.polygonColor);
                line.setAttribute("stroke-width", "2");
                line.setAttribute("opacity", "1");
              }
              const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
              if (tooltip) {
                tooltip.style.opacity = "1";
              }
              const point = svg.querySelector(`.skill-radar-point[data-skill-index="${index}"]`);
              if (point) {
                point.setAttribute("r", "5");
                point.setAttribute("stroke", "#fff");
                point.setAttribute("stroke-width", "1");
              }
            });
            text.addEventListener("mouseleave", (e) => {
              const el = e.currentTarget;
              const index = parseInt(el.getAttribute("data-skill-index"));
              const skill = this.displaySkills[index];
              el.setAttribute("fill", skill.legendary ? "#fbbf24" : this.textColor);
              const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
              if (line) {
                line.setAttribute("stroke", this.radialLineColor);
                line.setAttribute("stroke-width", "1");
                line.setAttribute("opacity", "0.6");
              }
              const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
              if (tooltip) {
                tooltip.style.opacity = "0";
              }
              const point = svg.querySelector(`.skill-radar-point[data-skill-index="${index}"]`);
              if (point) {
                point.setAttribute("r", "3");
                point.setAttribute("stroke", "none");
              }
            });
            text.addEventListener("click", (e) => {
              const el = e.currentTarget;
              const index = parseInt(el.getAttribute("data-skill-index"));
              handleSkillClick(index);
            });
          });
          svg.querySelectorAll(".skill-radar-point").forEach((point) => {
            point.addEventListener("mouseenter", (e) => {
              const el = e.currentTarget;
              const index = parseInt(el.getAttribute("data-skill-index"));
              el.setAttribute("r", "6");
              el.setAttribute("stroke", "#fff");
              el.setAttribute("stroke-width", "1.5");
              const label = svg.querySelector(`.skill-radar-label[data-skill-index="${index}"]`);
              if (label) {
                label.setAttribute("fill", this.textHoverColor);
              }
              const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
              if (line) {
                line.setAttribute("stroke", this.polygonColor);
                line.setAttribute("stroke-width", "2");
                line.setAttribute("opacity", "1");
              }
              const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
              if (tooltip) {
                tooltip.style.opacity = "1";
              }
            });
            point.addEventListener("mouseleave", (e) => {
              const el = e.currentTarget;
              const index = parseInt(el.getAttribute("data-skill-index"));
              const skill = this.displaySkills[index];
              el.setAttribute("r", "3");
              el.setAttribute("stroke", "none");
              const label = svg.querySelector(`.skill-radar-label[data-skill-index="${index}"]`);
              if (label) {
                label.setAttribute("fill", skill.legendary ? "#fbbf24" : this.textColor);
              }
              const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
              if (line) {
                line.setAttribute("stroke", this.radialLineColor);
                line.setAttribute("stroke-width", "1");
                line.setAttribute("opacity", "0.6");
              }
              const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
              if (tooltip) {
                tooltip.style.opacity = "0";
              }
            });
            point.addEventListener("click", function(e) {
              const index = parseInt(this.getAttribute("data-skill-index"));
              handleSkillClick(index);
            });
          });
        }
      };
      __name(_SkillRadarChart, "SkillRadarChart");
      var SkillRadarChart = _SkillRadarChart;
      var _QuestLogView = class _QuestLogView2 extends obsidianNS.ItemView {
        // One view class. Sections below: XP math, sidecar files, sliders, onOpen (draw once), lists, complete/save.
        constructor(leaf, plugin) {
          super(leaf);
          this.plugin = plugin;
          this._activeTab = "QUESTS";
          this._currentView = "active";
        }
        getViewType() {
          return QUESTLOG_VIEW_TYPE2;
        }
        getDisplayText() {
          return "Quest Log";
        }
        getIcon() {
          return "gamepad";
        }
        refreshListsAndHeader() {
          if (this._questListContainer) this.renderQuestList(this._questListContainer);
          if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
          if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
          if (this._completedListContainer) this.renderCompletedList(this._completedListContainer);
          this.updateHeader();
        }
        updateHeader() {
          const currentXp = this.plugin.settings.currentXp;
          const difficulty = this.plugin.settings.userDifficulty || 10;
          const bar = _QuestLogView2.xpProgress(null, currentXp, difficulty);
          const level = bar.level;
          if (this._levelBadgeEl) this._levelBadgeEl.setText(`${level}`);
          if (this._subtitleEl) this._subtitleEl.setText(_QuestLogView2.getLevelTitle(level));
          if (this._xpTextEl) this._xpTextEl.setText(`${bar.into.toLocaleString()} / ${bar.xpNeeded.toLocaleString()}`);
          if (this._xpBarFill) this._xpBarFill.style.width = `${Number(bar.pct.toFixed(4))}%`;
        }
        createSlider(container, label, labels, color, initialValue, onChange) {
          const group = container.createEl("div", { cls: "quest-slider-group" });
          const labelEl = group.createEl("span", { text: label, cls: "quest-slider-label" });
          labelEl.style.color = color;
          const track = group.createEl("div", { cls: "custom-slider-track" });
          const snapPositions = [3, 25, 50, 75, 97];
          const stars2 = [];
          snapPositions.forEach((pct) => {
            const star = track.createEl("span", { cls: "snap-star", text: "\u2605" });
            star.style.position = "absolute";
            star.style.left = pct + "%";
            star.style.top = "calc(50%)";
            star.style.transform = "translate(-50%, -50%)";
            star.style.fontSize = "10.8px";
            star.style.color = "#555";
            star.style.pointerEvents = "none";
            star.style.transition = "color 0.15s ease";
            stars2.push(star);
          });
          const fill = track.createEl("div", { cls: "custom-slider-fill" });
          fill.style.backgroundColor = color;
          fill.style.boxShadow = `0 0 6px ${color}`;
          const thumb = track.createEl("div", { cls: "custom-slider-thumb" });
          thumb.style.backgroundColor = color;
          thumb.style.boxShadow = `0 0 8px ${color}`;
          const valueLabel = group.createEl("span", {
            text: labels[initialValue - 1],
            cls: "quest-slider-value"
          });
          let value = initialValue;
          let onDragEnd = onChange;
          const updateSlider = /* @__PURE__ */ __name((val, notify) => {
            value = Math.max(1, Math.min(5, val));
            const pct = snapPositions[value - 1];
            fill.style.width = (value === 5 ? 100 : pct) + "%";
            thumb.style.left = pct + "%";
            valueLabel.setText(labels[value - 1]);
            stars2.forEach((star, i) => {
              if (i < value) {
                star.style.color = color;
                star.style.fontSize = "12.6px";
                star.style.textShadow = "none";
              } else {
                star.style.color = "#555";
                star.style.fontSize = "10.8px";
                star.style.textShadow = "none";
              }
            });
            if (notify && onDragEnd) onDragEnd();
          }, "updateSlider");
          updateSlider(initialValue, false);
          const getValueFromEvent = /* @__PURE__ */ __name((e) => {
            const rect = track.getBoundingClientRect();
            const x = (e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0)) - rect.left;
            const pct = Math.max(0, Math.min(1, x / rect.width));
            return Math.round(pct * 4) + 1;
          }, "getValueFromEvent");
          let dragging = false;
          let bound = false;
          const onMouseMove = /* @__PURE__ */ __name((e) => {
            if (!dragging) return;
            updateSlider(getValueFromEvent(e), false);
          }, "onMouseMove");
          const onMouseUp = /* @__PURE__ */ __name(() => {
            if (dragging) {
              dragging = false;
              if (onDragEnd) onDragEnd();
            }
            if (bound) {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
              bound = false;
            }
          }, "onMouseUp");
          const onTouchMove = /* @__PURE__ */ __name((e) => {
            if (!dragging) return;
            e.preventDefault();
            updateSlider(getValueFromEvent(e), false);
          }, "onTouchMove");
          let touchBound = false;
          const onTouchEnd = /* @__PURE__ */ __name(() => {
            if (dragging) {
              dragging = false;
              if (onDragEnd) onDragEnd();
            }
            if (touchBound) {
              document.removeEventListener("touchmove", onTouchMove);
              document.removeEventListener("touchend", onTouchEnd);
              touchBound = false;
            }
          }, "onTouchEnd");
          const cleanup = /* @__PURE__ */ __name(() => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            bound = false;
            touchBound = false;
            dragging = false;
          }, "cleanup");
          track.addEventListener("mousedown", (e) => {
            e.preventDefault();
            dragging = true;
            updateSlider(getValueFromEvent(e), false);
            if (!bound) {
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
              bound = true;
            }
          });
          track.addEventListener("touchstart", (e) => {
            e.preventDefault();
            dragging = true;
            updateSlider(getValueFromEvent(e), false);
            if (!touchBound) {
              document.addEventListener("touchmove", onTouchMove, { passive: false });
              document.addEventListener("touchend", onTouchEnd);
              touchBound = true;
            }
          }, { passive: false });
          track.addEventListener("click", (e) => {
            updateSlider(getValueFromEvent(e), true);
          });
          group._getValue = () => value;
          group._setValue = (v) => updateSlider(v, false);
          group._cleanup = cleanup;
          if (this._sliders) this._sliders.push(group);
          return group;
        }
        attachSkillPicker(parentEl, initialIds) {
          const selectedSkillIds = [...initialIds || []];
          const skillsSection = parentEl.createEl("div", { cls: "detail-skills-section quest-detail-reward" });
          const header = skillsSection.createEl("div", { cls: "detail-skills-header" });
          header.createEl("span", { text: "attach skills", cls: "quest-xp-preview-label detail-skills-label" });
          const plusBtn = header.createEl("button", {
            cls: "detail-skills-plus-btn",
            attr: { "aria-label": "plus", type: "button" }
          });
          const plusIcon = plusBtn.createEl("span", { cls: "detail-skills-plus-icon" });
          setIcon(plusIcon, "plus");
          skillsSection.createEl("div", { cls: "quest-detail-reward-divider detail-skills-divider" });
          const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
          const refresh = /* @__PURE__ */ __name(() => {
            selectedSkillsDisplay.empty();
            const skills2 = this.plugin.settings.skills || [];
            const difficulty = this.plugin.settings.skillDifficulty || 10;
            selectedSkillIds.forEach((skillId) => {
              const skill = skills2.find((s) => s.id === skillId);
              if (!skill) return;
              const xpInfo = _QuestLogView2.getSkillXpProgress(skill, difficulty);
              const row = selectedSkillsDisplay.createEl("div", {
                cls: "skills-selector-row skill-selector-row detail-skill-attached-row detail-linked-attached-row"
              });
              const body = row.createEl("span", { cls: "linked-selector-row-body detail-skill-attached-body" });
              const titleRow = body.createEl("span", { cls: "detail-skill-attached-title-row" });
              titleRow.createEl("span", {
                text: skill.name || "Untitled",
                cls: "skills-selector-row-label linked-selector-row-title detail-skill-attached-title"
              });
              titleRow.createEl("span", {
                text: (skill.legendary ? "\u2605 " : "") + "Lvl " + (xpInfo.level || 1),
                cls: "detail-skill-attached-level"
              });
              const xpBar = body.createEl("div", { cls: "skill-xp-bar detail-skill-attached-xp-bar" });
              const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
              xpFill.style.width = `${xpInfo.pct}%`;
              const removeBtn = row.createEl("button", {
                cls: "detail-linked-row-remove",
                attr: { "aria-label": "Detach", type: "button" }
              });
              const removeIcon = removeBtn.createEl("span", { cls: "detail-linked-row-remove-icon" });
              setIcon(removeIcon, "x");
              removeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = selectedSkillIds.indexOf(skillId);
                if (idx > -1) selectedSkillIds.splice(idx, 1);
                refresh();
              });
            });
            if (selectedSkillIds.length === 0) {
              selectedSkillsDisplay.createEl("span", {
                text: "no skills attached",
                cls: "detail-skills-placeholder"
              });
            }
          }, "refreshSkillPicker");
          refresh();
          plusBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openSkillsSelectorModal(selectedSkillIds, refresh);
          });
          selectedSkillIds.refresh = refresh;
          return selectedSkillIds;
        }
        openSkillsSelectorModal(selectedSkillIds, onApplied) {
          const host = this.overlayHost();
          if (!host) return;
          const existing = host.querySelector(".skills-selector-overlay");
          if (existing) existing.remove();
          const overlay = host.createEl("div", {
            cls: "skills-selector-overlay ql-overlay open"
          });
          const box = overlay.createEl("div", {
            cls: "quest-modal skills-selector-modal ql-modal"
          });
          const header = box.createEl("div", { cls: "quest-modal-header skills-selector-header" });
          header.createEl("span", { text: "Skills Selector", cls: "skills-selector-title" });
          const closeBtn = header.createEl("button", {
            cls: "quest-detail-close-btn quest-modal-close-btn",
            attr: { "aria-label": "Close", type: "button" }
          });
          const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
          setIcon(closeIcon, "x");
          const searchInput = box.createEl("input", {
            type: "text",
            placeholder: "Type Skill Name",
            cls: "skills-selector-search ql-input",
            attr: { "aria-label": "Type Skill Name" }
          });
          box.createEl("div", { cls: "quest-detail-reward-divider skills-selector-divider" });
          const listEl = box.createEl("div", { cls: "skills-selector-list" });
          const draft = new Set(selectedSkillIds);
          const difficulty = this.plugin.settings.skillDifficulty || 10;
          const renderList = /* @__PURE__ */ __name((query = "") => {
            listEl.empty();
            const skills2 = [...this.plugin.settings.skills || []].sort(
              (a, b) => (a.name || "").localeCompare(b.name || "")
            );
            const q = query.trim().toLowerCase();
            const filtered = q ? skills2.filter((s) => (s.name || "").toLowerCase().includes(q)) : skills2;
            if (filtered.length === 0) {
              listEl.createEl("div", {
                text: skills2.length === 0 ? "No skills yet" : "No matching skills",
                cls: "skills-selector-empty"
              });
              return;
            }
            filtered.forEach((skill) => {
              const id = skill.id;
              const xpInfo = _QuestLogView2.getSkillXpProgress(skill, difficulty);
              const row = listEl.createEl("label", { cls: "skills-selector-row skill-selector-row" });
              const checkbox = row.createEl("input", {
                type: "checkbox",
                cls: "skills-selector-checkbox"
              });
              checkbox.checked = draft.has(id);
              checkbox.addEventListener("change", () => {
                if (checkbox.checked) draft.add(id);
                else draft.delete(id);
              });
              const body = row.createEl("span", { cls: "linked-selector-row-body" });
              const titleRow = body.createEl("span", { cls: "detail-skill-attached-title-row" });
              titleRow.createEl("span", {
                text: skill.name || "Untitled",
                cls: "skills-selector-row-label linked-selector-row-title detail-skill-attached-title"
              });
              titleRow.createEl("span", {
                text: (skill.legendary ? "\u2605 " : "") + "Lvl " + (xpInfo.level || 1),
                cls: "detail-skill-attached-level"
              });
              const xpBar = body.createEl("div", { cls: "skill-xp-bar detail-skill-attached-xp-bar" });
              const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
              xpFill.style.width = `${xpInfo.pct}%`;
            });
          }, "renderSkillsSelectorList");
          renderList();
          searchInput.addEventListener("input", () => {
            renderList(searchInput.value);
          });
          const btnRow = box.createEl("div", { cls: "quest-modal-buttons skills-selector-actions" });
          const selectBtn = btnRow.createEl("button", {
            cls: "quest-modal-create-btn quest-modal-create-btn-full skills-selector-select-btn",
            attr: { type: "button" }
          });
          selectBtn.createEl("span", { text: "Select" });
          const close = /* @__PURE__ */ __name(() => {
            overlay.remove();
          }, "closeSkillsSelector");
          closeBtn.addEventListener("click", close);
          overlay.addEventListener("mousedown", (e) => {
            overlay._mouseDownOnOverlay = e.target === overlay;
          });
          overlay.addEventListener("click", (e) => {
            if (e.target === overlay && overlay._mouseDownOnOverlay) close();
          });
          selectBtn.addEventListener("click", () => {
            selectedSkillIds.length = 0;
            for (const id of draft) selectedSkillIds.push(id);
            if (typeof onApplied === "function") onApplied();
            close();
          });
          searchInput.focus();
        }
        coinRewardForXp(xp) {
          return Math.max(1, Math.min(50, Math.round(Number(xp) / 1e4 || 0)));
        }
        idsLinkedToSkill(skillId, kind) {
          const list = kind === "habit" ? this.plugin.settings.habits || [] : this.plugin.settings.quests || [];
          const sid = String(skillId);
          return list.filter((item) => item && Array.isArray(item.skillIds) && item.skillIds.map(String).includes(sid)).map((item) => String(item.id));
        }
        syncSkillLinks(skillId, questIds, habitIds) {
          const sid = String(skillId);
          const qSet = new Set((questIds || []).map(String));
          const hSet = new Set((habitIds || []).map(String));
          const patchList = /* @__PURE__ */ __name((list, selected) => {
            for (const item of list || []) {
              if (!item || item.id == null) continue;
              const ids = new Set((item.skillIds || []).map(String));
              if (selected.has(String(item.id))) ids.add(sid);
              else ids.delete(sid);
              item.skillIds = [...ids];
            }
          }, "patchSkillLinkList");
          patchList(this.plugin.settings.quests, qSet);
          patchList(this.plugin.settings.habits, hSet);
        }
        attachLinkedPicker(parentEl, opts) {
          const kind = opts.kind === "habit" ? "habit" : "quest";
          const selectedIds = [...opts.initialIds || []].map(String);
          const typeCls = kind;
          const section = parentEl.createEl("div", {
            cls: `detail-skills-section detail-linked-section detail-${typeCls}-linked-section quest-detail-reward`
          });
          const header = section.createEl("div", { cls: "detail-skills-header" });
          header.createEl("span", {
            text: opts.label,
            cls: "quest-xp-preview-label detail-skills-label"
          });
          const plusBtn = header.createEl("button", {
            cls: `detail-skills-plus-btn detail-linked-plus-btn detail-${typeCls}-plus-btn`,
            attr: { "aria-label": "plus", type: "button" }
          });
          const plusIcon = plusBtn.createEl("span", { cls: "detail-skills-plus-icon" });
          setIcon(plusIcon, "plus");
          section.createEl("div", { cls: "quest-detail-reward-divider detail-skills-divider" });
          const selectedDisplay = section.createEl("div", {
            cls: `detail-selected-skills detail-selected-linked detail-selected-${typeCls}s`
          });
          const refresh = /* @__PURE__ */ __name(() => {
            selectedDisplay.empty();
            const list = kind === "habit" ? this.plugin.settings.habits || [] : this.plugin.settings.quests || [];
            const rewardsOn = Boolean(this.plugin.settings.rewardsMode);
            selectedIds.forEach((id) => {
              const item = list.find((x) => x && String(x.id) === String(id));
              if (!item) return;
              const row = selectedDisplay.createEl("div", {
                cls: `skills-selector-row linked-selector-row ${typeCls}-selector-row detail-linked-attached-row`
              });
              const body = row.createEl("span", { cls: "linked-selector-row-body" });
              body.createEl("span", {
                text: item.title || "Untitled",
                cls: "skills-selector-row-label linked-selector-row-title"
              });
              const meta = body.createEl("span", { cls: "linked-selector-row-meta" });
              const xp = Number(item.xp) || 0;
              meta.createEl("span", {
                text: `${xp.toLocaleString()} XP`,
                cls: "linked-selector-row-xp"
              });
              if (rewardsOn && kind === "quest") {
                const coinWrap = meta.createEl("span", { cls: "linked-selector-row-coins" });
                const coinIcon = coinWrap.createEl("span", { cls: "linked-selector-row-coin-icon" });
                setIcon(coinIcon, "coins");
                coinWrap.createEl("span", {
                  text: `+${this.coinRewardForXp(xp)}`,
                  cls: "linked-selector-row-coin-text"
                });
              }
              const removeBtn = row.createEl("button", {
                cls: "detail-linked-row-remove",
                attr: { "aria-label": "Detach", type: "button" }
              });
              const removeIcon = removeBtn.createEl("span", {
                cls: "detail-linked-row-remove-icon"
              });
              setIcon(removeIcon, "x");
              removeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const i = selectedIds.findIndex((x) => String(x) === String(id));
                if (i > -1) selectedIds.splice(i, 1);
                refresh();
              });
            });
            if (selectedIds.length === 0) {
              selectedDisplay.createEl("span", {
                text: opts.emptyText,
                cls: "detail-skills-placeholder"
              });
            }
          }, kind === "habit" ? "refreshHabitLinkedPicker" : "refreshQuestLinkedPicker");
          refresh();
          plusBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openLinkedSelectorModal(selectedIds, refresh, kind);
          });
          selectedIds.refresh = refresh;
          return selectedIds;
        }
        openLinkedSelectorModal(selectedIds, onApplied, kind) {
          const isHabit = kind === "habit";
          const typeCls = isHabit ? "habit" : "quest";
          const host = this.overlayHost();
          if (!host) return;
          const overlayCls = `${typeCls}s-selector-overlay`;
          const existing = host.querySelector(`.${overlayCls}`);
          if (existing) existing.remove();
          const overlay = host.createEl("div", {
            cls: `${overlayCls} linked-selector-overlay ql-overlay open`
          });
          const box = overlay.createEl("div", {
            cls: `quest-modal ${typeCls}s-selector-modal linked-selector-modal skills-selector-modal ${typeCls}-context ql-modal`
          });
          const header = box.createEl("div", { cls: "quest-modal-header skills-selector-header" });
          header.createEl("span", {
            text: isHabit ? "Habits Selector" : "Quests Selector",
            cls: "skills-selector-title"
          });
          const closeBtn = header.createEl("button", {
            cls: "quest-detail-close-btn quest-modal-close-btn",
            attr: { "aria-label": "Close", type: "button" }
          });
          const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
          setIcon(closeIcon, "x");
          const searchInput = box.createEl("input", {
            type: "text",
            placeholder: isHabit ? "Type Habit Name" : "Type Quest Name",
            cls: "skills-selector-search ql-input",
            attr: { "aria-label": isHabit ? "Type Habit Name" : "Type Quest Name" }
          });
          box.createEl("div", { cls: "quest-detail-reward-divider skills-selector-divider" });
          const listEl = box.createEl("div", { cls: "skills-selector-list linked-selector-list" });
          const draft = new Set([...selectedIds].map(String));
          const rewardsOn = Boolean(this.plugin.settings.rewardsMode);
          const renderList = /* @__PURE__ */ __name((query = "") => {
            listEl.empty();
            const items = [...isHabit ? this.plugin.settings.habits || [] : this.plugin.settings.quests || []].sort(
              (a, b) => (a.title || "").localeCompare(b.title || "")
            );
            const q = query.trim().toLowerCase();
            const filtered = q ? items.filter((it) => (it.title || "").toLowerCase().includes(q)) : items;
            if (filtered.length === 0) {
              listEl.createEl("div", {
                text: items.length === 0 ? isHabit ? "No habits yet" : "No quests yet" : isHabit ? "No matching habits" : "No matching quests",
                cls: "skills-selector-empty"
              });
              return;
            }
            filtered.forEach((item) => {
              const id = String(item.id);
              const row = listEl.createEl("label", {
                cls: `skills-selector-row linked-selector-row ${typeCls}-selector-row`
              });
              const checkbox = row.createEl("input", {
                type: "checkbox",
                cls: "skills-selector-checkbox linked-selector-checkbox"
              });
              checkbox.checked = draft.has(id);
              checkbox.addEventListener("change", () => {
                if (checkbox.checked) draft.add(id);
                else draft.delete(id);
              });
              const body = row.createEl("span", { cls: "linked-selector-row-body" });
              body.createEl("span", {
                text: item.title || "Untitled",
                cls: "skills-selector-row-label linked-selector-row-title"
              });
              const meta = body.createEl("span", { cls: "linked-selector-row-meta" });
              const xp = Number(item.xp) || 0;
              meta.createEl("span", {
                text: `${xp.toLocaleString()} XP`,
                cls: "linked-selector-row-xp"
              });
              if (rewardsOn && !isHabit) {
                const coinWrap = meta.createEl("span", { cls: "linked-selector-row-coins" });
                const coinIcon = coinWrap.createEl("span", { cls: "linked-selector-row-coin-icon" });
                setIcon(coinIcon, "coins");
                coinWrap.createEl("span", {
                  text: `+${this.coinRewardForXp(xp)}`,
                  cls: "linked-selector-row-coin-text"
                });
              }
            });
          }, isHabit ? "renderHabitsSelectorList" : "renderQuestsSelectorList");
          renderList();
          searchInput.addEventListener("input", () => {
            renderList(searchInput.value);
          });
          const btnRow = box.createEl("div", { cls: "quest-modal-buttons skills-selector-actions" });
          const selectBtn = btnRow.createEl("button", {
            cls: `quest-modal-create-btn quest-modal-create-btn-full skills-selector-select-btn linked-selector-select-btn ${typeCls}-selector-select-btn`,
            attr: { type: "button" }
          });
          selectBtn.createEl("span", { text: "Select" });
          const close = /* @__PURE__ */ __name(() => {
            overlay.remove();
          }, isHabit ? "closeHabitsSelector" : "closeQuestsSelector");
          closeBtn.addEventListener("click", close);
          overlay.addEventListener("mousedown", (e) => {
            overlay._mouseDownOnOverlay = e.target === overlay;
          });
          overlay.addEventListener("click", (e) => {
            if (e.target === overlay && overlay._mouseDownOnOverlay) close();
          });
          selectBtn.addEventListener("click", () => {
            selectedIds.length = 0;
            for (const id of draft) selectedIds.push(id);
            if (typeof onApplied === "function") onApplied();
            close();
          });
          searchInput.focus();
        }
        fillStatsTable(table, rows) {
          rows.forEach(([label, value]) => {
            const tr = table.createEl("tr");
            tr.createEl("td", { text: label, cls: "quest-detail-stat-label" });
            tr.createEl("td", { text: value, cls: "quest-detail-stat-value" });
          });
        }
        // Unbind document mouse/touch listeners. Pass a root to drain only sliders inside it
        // (detail sheet empty). No root = wipe the whole bag (remount / onClose).
        drainSliders(root) {
          if (this._sliders) {
            if (root) {
              for (const slider of this._sliders) {
                if (root.contains(slider) && slider._cleanup) slider._cleanup();
              }
              this._sliders = this._sliders.filter((s) => !root.contains(s));
              return;
            }
            for (const slider of this._sliders) {
              if (slider._cleanup) slider._cleanup();
            }
          }
          this._sliders = [];
        }
        overlayHost() {
          return this.containerEl && this.containerEl.children && this.containerEl.children[1] || null;
        }
        // ----------------------------------------
        // UI CREATION
        // ----------------------------------------
        async onOpen() {
          if (!this.containerEl || !this.containerEl.children || !this.containerEl.children[1]) {
            return;
          }
          const container = this.containerEl.children[1];
          const overlayClasses = [
            "quest-menu-overlay",
            "quest-creation-overlay",
            "quest-detail-overlay",
            "delete-confirm-overlay",
            "skills-selector-overlay",
            "quests-selector-overlay",
            "habits-selector-overlay",
            "ql-levelup-overlay",
            "ql-confetti-container",
            "shop-purchase-overlay"
          ];
          Array.from(this.containerEl.children).forEach((el) => {
            if (el === container || !el.classList) return;
            if (overlayClasses.some((cls) => el.classList.contains(cls))) {
              el.remove();
            }
          });
          container.empty();
          container.addClass("quest-log-container");
          const topBar = container.createEl("div", { cls: "quest-log-topbar" });
          const hamburgerBtn = topBar.createEl("button", { cls: "topbar-hamburger" });
          setIcon(hamburgerBtn, "menu");
          topBar.createEl("span", { text: "Quest Log", cls: "topbar-title" });
          const settingsBtn = topBar.createEl("button", { cls: "topbar-settings" });
          setIcon(settingsBtn, "settings");
          const menuOverlay = container.createEl("div", { cls: "quest-menu-overlay ql-overlay" });
          const menuPanel = menuOverlay.createEl("div", { cls: "quest-menu-panel" });
          const buildMenu = /* @__PURE__ */ __name(() => {
            menuPanel.empty();
            const items = currentView === "completed" ? [
              { icon: "scroll-text", label: "Quests", action: /* @__PURE__ */ __name(() => switchView("active", "QUESTS"), "action") },
              { icon: "list-todo", label: "Habits", action: /* @__PURE__ */ __name(() => switchView("active", "HABITS"), "action") },
              { icon: "book-open", label: "Skills", action: /* @__PURE__ */ __name(() => switchView("active", "SKILLS"), "action") }
            ] : [
              { icon: "check", label: "Completed", action: /* @__PURE__ */ __name(() => switchView("completed"), "action") }
            ];
            if (this.plugin.settings.rewardsMode && shopOverlay) {
              items.push(
                { icon: "shopping-cart", label: "Rewards Shop", action: /* @__PURE__ */ __name(() => {
                  shopOverlay.style.display = "flex";
                  this.renderShopList(this._shopListEl);
                  if (this._shopCoinText) this._shopCoinText.setText(`${this.plugin.settings.coins}`);
                  menuOverlay.removeClass("open");
                }, "action") }
              );
            }
            items.push(
              { icon: "radar", label: "Skill Graph", action: /* @__PURE__ */ __name(() => this.showSkillGraphModal(), "action") },
              { icon: "user", label: "User Profile", action: /* @__PURE__ */ __name(() => {
                const folder = this.plugin.settings.userProfileFolder || "Quest Log";
                const fileName = this.plugin.settings.userProfileFileName || "User Profile";
                const fullPath = `${folder}/${fileName}.md`;
                const file = this.app.vault.getAbstractFileByPath(fullPath);
                if (file) {
                  this.app.workspace.openLinkText(fullPath, "", false);
                } else {
                  new obsidianNS.Notice("User Profile not found.");
                }
              }, "action") },
              { icon: "settings", label: "Settings", action: /* @__PURE__ */ __name(() => {
                this.app.setting.open();
                this.app.setting.openTabById("quest-log");
              }, "action") }
            );
            items.forEach((item) => {
              const row = menuPanel.createEl("div", { cls: "quest-menu-item" });
              const iconEl = row.createEl("span");
              setIcon(iconEl, item.icon);
              row.createEl("span", { text: item.label });
              row.addEventListener("click", () => {
                menuOverlay.removeClass("open");
                item.action();
              });
            });
          }, "buildMenu");
          hamburgerBtn.addEventListener("click", () => {
            buildMenu();
            menuOverlay.addClass("open");
          });
          menuOverlay.addEventListener("mousedown", (e) => {
            menuOverlay._mouseDownOnOverlay = e.target === menuOverlay;
          });
          menuOverlay.addEventListener("click", (e) => {
            if (e.target === menuOverlay && menuOverlay._mouseDownOnOverlay) menuOverlay.removeClass("open");
          });
          settingsBtn.addEventListener("click", () => {
            this.app.setting.open();
            this.app.setting.openTabById("quest-log");
          });
          const header = container.createEl("div", { cls: "quest-header" });
          const currentXp = this.plugin.settings.currentXp;
          const difficulty = this.plugin.settings.userDifficulty || 10;
          const bar = _QuestLogView2.xpProgress(null, currentXp, difficulty);
          const calculatedLvl = bar.level;
          const progressXp = bar.into;
          const totalXpInLvl = bar.xpNeeded;
          const percent = bar.pct;
          const levelBadge = header.createEl("div", { cls: "level-badge" });
          this._levelBadgeEl = levelBadge.createEl("h1", { text: `${calculatedLvl}` });
          const heroInfo = header.createEl("div", { cls: "hero-info" });
          const nameContainer = heroInfo.createEl("div", {
            cls: "hero-name-container"
          });
          const heroNameEl = nameContainer.createEl("span", {
            text: this.plugin.settings.heroName,
            cls: "hero-name-input",
            attr: { contenteditable: "true" }
          });
          const editIcon = nameContainer.createEl("span", { cls: "edit-icon" });
          setIcon(editIcon, "pencil");
          editIcon.addEventListener("click", () => {
            heroNameEl.focus();
            const range = document.createRange();
            range.selectNodeContents(heroNameEl);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          });
          heroNameEl.addEventListener("input", () => {
            this.plugin.settings.heroName = heroNameEl.innerText.trim();
            clearTimeout(this._heroNameTimer);
            this._heroNameTimer = activeWindow.setTimeout(() => this.plugin.saveSettings(), 500);
          });
          heroNameEl.addEventListener("blur", () => {
            clearTimeout(this._heroNameTimer);
            if (heroNameEl.innerText.trim() === "") {
              heroNameEl.setText("Hero");
              this.plugin.settings.heroName = "Hero";
            }
            this.plugin.saveSettings();
          });
          const subtitleEl = heroInfo.createEl("div", { cls: "sub-text" });
          subtitleEl.setText(_QuestLogView2.getLevelTitle(calculatedLvl));
          this._subtitleEl = subtitleEl;
          const xpInfo = header.createEl("div", { cls: "xp-info" });
          xpInfo.createEl("div", { text: "Xp Progress", cls: "sub-text" });
          xpInfo.createEl("div", {
            text: `${progressXp.toLocaleString()} / ${totalXpInLvl.toLocaleString()}`,
            cls: "xp-text"
          });
          this._xpTextEl = xpInfo.lastChild;
          const xpBarContainer = container.createEl("div", {
            cls: "xp-bar-container"
          });
          const xpBarFill = xpBarContainer.createEl("div", { cls: "xp-bar-fill" });
          xpBarFill.style.width = `${Number(Number(percent).toFixed(4))}%`;
          this._xpBarFill = xpBarFill;
          const fabBtn = container.createEl("button", { cls: "quest-fab" });
          const fabIcon = fabBtn.createEl("span", { cls: "fab-icon" });
          setIcon(fabIcon, "plus");
          fabBtn.style.display = "flex";
          const createOverlay = container.createEl("div", {
            cls: "quest-creation-overlay ql-overlay"
          });
          createOverlay.addEventListener("mousedown", (e) => {
            createOverlay._mouseDownOnOverlay = e.target === createOverlay;
          });
          createOverlay.addEventListener("click", (e) => {
            if (e.target === createOverlay && createOverlay._mouseDownOnOverlay) {
              createOverlay.removeClass("open");
            }
          });
          const createBox = createOverlay.createEl("div", { cls: "quest-modal ql-modal" });
          this._createOverlay = createOverlay;
          this._createBox = createBox;
          var activeTab = this._activeTab || "QUESTS";
          var currentView = this._currentView || "active";
          fabBtn.addEventListener("click", () => {
            if (activeTab === "QUESTS") {
              this.openCreateModal({ type: "quest" });
            } else if (activeTab === "HABITS") {
              this.openCreateModal({ type: "habit" });
            } else if (activeTab === "SKILLS") {
              skillOverlay.addClass("open");
              skillNameInput.focus();
            }
          });
          let rewardOverlay = null;
          let rewardNameInput = null;
          if (this.plugin.settings.rewardsMode) {
            rewardOverlay = container.createEl("div", {
              cls: "quest-creation-overlay ql-overlay"
            });
            rewardOverlay.addEventListener("mousedown", (e) => {
              rewardOverlay._mouseDownOnOverlay = e.target === rewardOverlay;
            });
            rewardOverlay.addEventListener("click", (e) => {
              if (e.target === rewardOverlay && rewardOverlay._mouseDownOnOverlay) {
                rewardOverlay.removeClass("open");
              }
            });
            const rewardModalBox = rewardOverlay.createEl("div", { cls: "quest-modal reward-context ql-modal" });
            const rewardModalHeader = rewardModalBox.createEl("div", { cls: "quest-modal-header" });
            const rewardHeaderIcon = rewardModalHeader.createEl("span", { cls: "quest-modal-header-icon" });
            setIcon(rewardHeaderIcon, "shopping-bag");
            rewardModalHeader.createEl("span", { text: "New Reward" });
            rewardNameInput = rewardModalBox.createEl("input", {
              type: "text",
              placeholder: "Reward name...",
              cls: "quest-modal-input"
            });
            const rewardDescInput = rewardModalBox.createEl("textarea", {
              placeholder: "Description (optional)...",
              cls: "quest-modal-input quest-modal-desc"
            });
            const rewardPriceRow = rewardModalBox.createEl("div", { cls: "quest-xp-preview-row" });
            rewardPriceRow.createEl("span", { text: "Price (coins)", cls: "quest-xp-preview-label" });
            const rewardPriceInput = rewardPriceRow.createEl("input", {
              type: "number",
              value: "10",
              min: "1",
              cls: "quest-modal-input quest-modal-number"
            });
            const rewardStockRow = rewardModalBox.createEl("div", { cls: "quest-xp-preview-row" });
            rewardStockRow.createEl("span", { text: "Stock (blank = unlimited)", cls: "quest-xp-preview-label" });
            const rewardStockInput = rewardStockRow.createEl("input", {
              type: "number",
              placeholder: "\u221E",
              min: "1",
              cls: "quest-modal-input quest-modal-number"
            });
            const rewardBtnRow = rewardModalBox.createEl("div", { cls: "quest-modal-btn-row" });
            const rewardCancelBtn = rewardBtnRow.createEl("button", {
              text: "Cancel",
              cls: "quest-modal-btn quest-modal-cancel"
            });
            const rewardCreateBtn = rewardBtnRow.createEl("button", {
              text: "Create",
              cls: "quest-modal-btn quest-modal-create"
            });
            rewardCancelBtn.addEventListener("click", () => {
              rewardOverlay.removeClass("open");
            });
            rewardCreateBtn.addEventListener("click", async () => {
              const name = rewardNameInput.value.trim();
              if (!name) {
                new obsidianNS.Notice("Give your reward a name!");
                return;
              }
              const price = Math.max(1, parseInt(rewardPriceInput.value) || 1);
              const stockVal = rewardStockInput.value.trim();
              const stock = stockVal === "" ? null : Math.max(1, parseInt(stockVal) || 1);
              const reward = {
                id: Date.now().toString(),
                name,
                description: rewardDescInput.value.trim(),
                price,
                stock,
                createdAt: (/* @__PURE__ */ new Date()).toISOString()
              };
              this.plugin.settings.rewards.push(reward);
              await this.plugin.saveSettings();
              if (this._shopListEl) this.renderShopList(this._shopListEl);
              new obsidianNS.Notice(`Created Reward: ${reward.name} (${reward.price} coins)`);
              rewardOverlay.removeClass("open");
              rewardNameInput.value = "";
              rewardDescInput.value = "";
              rewardPriceInput.value = "10";
              rewardStockInput.value = "";
            });
          }
          const tabsContainer = container.createEl("div", { cls: "quest-log-tabs" });
          const allTabs = [];
          const createTab = /* @__PURE__ */ __name((icon, text, colorClass) => {
            const btn = tabsContainer.createEl("button");
            const tabIcon = btn.createEl("span", { cls: "tab-icon" });
            setIcon(tabIcon, icon);
            btn.createEl("span", { text });
            if (colorClass) btn.addClass(colorClass);
            allTabs.push(btn);
            btn.addEventListener("click", () => {
              allTabs.forEach((t) => t.removeClass("active-tab"));
              btn.addClass("active-tab");
              fabBtn.style.display = "flex";
              activeTab = text;
              this._activeTab = activeTab;
              if (currentView === "completed") {
                switchView("active");
                return;
              }
              fabBtn.removeClass("fab-habits");
              fabBtn.removeClass("fab-skills");
              fabBtn.removeClass("fab-quests");
              if (colorClass === "tab-habits") fabBtn.addClass("fab-habits");
              else if (colorClass === "tab-skills") fabBtn.addClass("fab-skills");
              else fabBtn.addClass("fab-quests");
              questListContainer.style.display = text === "QUESTS" ? "flex" : "none";
              habitsContent.style.display = text === "HABITS" ? "flex" : "none";
              skillsContent.style.display = text === "SKILLS" ? "flex" : "none";
              if (shopOverlay) shopOverlay.style.display = "none";
            });
            return btn;
          }, "createTab");
          const questTab = createTab("scroll-text", "QUESTS", "tab-quests");
          const habitsTab = createTab("list-todo", "HABITS", "tab-habits");
          const skillsTab = createTab("book-open", "SKILLS", "tab-skills");
          questTab.addClass("active-tab");
          const questListContainer = container.createEl("div", {
            cls: "quest-list-container"
          });
          this.renderQuestList(questListContainer);
          const habitsContent = container.createEl("div", {
            cls: "quest-list-container"
          });
          habitsContent.addClass("habit-list-container");
          this.renderHabitList(habitsContent);
          habitsContent.style.display = "none";
          const skillsContent = container.createEl("div", {
            cls: "quest-list-container skill-list-container"
          });
          skillsContent.style.display = "none";
          this.renderSkillList(skillsContent);
          let shopOverlay = null;
          if (this.plugin.settings.rewardsMode) {
            shopOverlay = container.createEl("div", { cls: "completed-overlay shop-overlay" });
            shopOverlay.style.display = "none";
            const shopHeader = shopOverlay.createEl("div", { cls: "completed-header shop-full-header" });
            const shopBackBtn = shopHeader.createEl("button", { cls: "completed-back-btn" });
            shopBackBtn.setText("\u2190 Back");
            shopBackBtn.addEventListener("click", () => {
              shopOverlay.style.display = "none";
            });
            const shopUserInfo = shopHeader.createEl("div", { cls: "shop-user-info" });
            const heroName = this.plugin.settings.heroName || "Hero";
            const level = this.plugin.getLevel();
            const title = _QuestLogView2.getLevelTitle(level);
            shopUserInfo.createEl("span", { text: heroName, cls: "shop-user-name" });
            const levelBadge2 = shopUserInfo.createEl("span", { cls: "shop-level-badge" });
            levelBadge2.setText(`Lv.${level}`);
            const shopCoinDisplay = shopHeader.createEl("div", { cls: "shop-coin-display" });
            const shopCoinIcon = shopCoinDisplay.createEl("span", { cls: "shop-coin-icon" });
            setIcon(shopCoinIcon, "coins");
            this._shopCoinText = shopCoinDisplay.createEl("span", { text: `${this.plugin.settings.coins}`, cls: "shop-coin-text" });
            const shopListEl = shopOverlay.createEl("div", { cls: "shop-list" });
            this._shopListEl = shopListEl;
            this.renderShopList(shopListEl);
            const shopFab = shopOverlay.createEl("button", { cls: "quest-log-fab fab-shop" });
            const shopFabIcon = shopFab.createEl("span", { cls: "fab-icon" });
            setIcon(shopFabIcon, "plus");
            shopFab.addEventListener("click", () => {
              if (rewardOverlay) {
                rewardOverlay.addClass("open");
                rewardNameInput.focus();
              }
            });
          }
          const completedOverlay = container.createEl("div", { cls: "completed-overlay" });
          const completedHeader = completedOverlay.createEl("div", { cls: "completed-header" });
          const completedHamburger = completedHeader.createEl("button", { cls: "topbar-hamburger" });
          setIcon(completedHamburger, "menu");
          completedHamburger.addEventListener("click", () => {
            buildMenu();
            menuOverlay.addClass("open");
          });
          const backBtn = completedHeader.createEl("button", {
            text: "\u2190 Back",
            cls: "completed-back-btn"
          });
          completedHeader.createEl("span", {
            text: "Completed Quests",
            cls: "completed-title"
          });
          const completedListContainer = completedOverlay.createEl("div", {
            cls: "completed-list-container"
          });
          completedOverlay.style.display = "none";
          const switchView = /* @__PURE__ */ __name((view, targetTab) => {
            currentView = view;
            this._currentView = currentView;
            if (view === "completed") {
              completedOverlay.style.display = "flex";
              this.renderCompletedList(completedListContainer);
            } else {
              completedOverlay.style.display = "none";
              if (targetTab) {
                activeTab = targetTab;
                this._activeTab = activeTab;
                allTabs.forEach((t) => t.removeClass("active-tab"));
                const tabMap = { QUESTS: questTab, HABITS: habitsTab, SKILLS: skillsTab };
                if (tabMap[targetTab]) tabMap[targetTab].addClass("active-tab");
                fabBtn.removeClass("fab-habits");
                fabBtn.removeClass("fab-skills");
                fabBtn.removeClass("fab-quests");
                if (targetTab === "HABITS") fabBtn.addClass("fab-habits");
                else if (targetTab === "SKILLS") fabBtn.addClass("fab-skills");
                else fabBtn.addClass("fab-quests");
              }
              questListContainer.style.display = activeTab === "QUESTS" ? "flex" : "none";
              habitsContent.style.display = activeTab === "HABITS" ? "flex" : "none";
              skillsContent.style.display = activeTab === "SKILLS" ? "flex" : "none";
              if (shopOverlay) shopOverlay.style.display = "none";
            }
          }, "switchView");
          backBtn.addEventListener("click", () => switchView("active"));
          if (currentView === "completed") {
            switchView("completed");
          } else if (activeTab === "HABITS") {
            habitsTab.click();
          } else if (activeTab === "SKILLS") {
            skillsTab.click();
          }
          const skillGraphOverlay = container.createEl("div", { cls: "skill-graph-overlay" });
          const skillGraphHeader = skillGraphOverlay.createEl("div", { cls: "skill-graph-header" });
          const skillGraphHamburger = skillGraphHeader.createEl("button", { cls: "topbar-hamburger" });
          setIcon(skillGraphHamburger, "menu");
          skillGraphHamburger.addEventListener("click", () => {
            buildMenu();
            menuOverlay.addClass("open");
          });
          const skillGraphBackBtn = skillGraphHeader.createEl("button", {
            text: "\u2190 Back",
            cls: "skill-graph-back-btn"
          });
          skillGraphHeader.createEl("span", {
            text: "Skill Graph",
            cls: "skill-graph-title"
          });
          const skillGraphContent = skillGraphOverlay.createEl("div", {
            cls: "skill-graph-content"
          });
          skillGraphOverlay.style.display = "none";
          skillGraphBackBtn.addEventListener("click", () => {
            skillGraphOverlay.style.display = "none";
            questListContainer.style.display = activeTab === "QUESTS" ? "flex" : "none";
            habitsContent.style.display = activeTab === "HABITS" ? "flex" : "none";
            skillsContent.style.display = activeTab === "SKILLS" ? "flex" : "none";
            if (shopOverlay) shopOverlay.style.display = "none";
          });
          this._skillGraphOverlay = skillGraphOverlay;
          this._skillGraphContent = skillGraphContent;
          const detailOverlay = container.createEl("div", {
            cls: "quest-detail-overlay ql-overlay"
          });
          detailOverlay.addEventListener("mousedown", (e) => {
            detailOverlay._mouseDownOnOverlay = e.target === detailOverlay;
          });
          detailOverlay.addEventListener("click", (e) => {
            if (e.target === detailOverlay && detailOverlay._mouseDownOnOverlay) {
              detailOverlay.removeClass("open");
            }
          });
          const detailBox = detailOverlay.createEl("div", {
            cls: "quest-detail-box ql-modal"
          });
          const skillOverlay = container.createEl("div", {
            cls: "quest-creation-overlay ql-overlay"
          });
          skillOverlay.addEventListener("mousedown", (e) => {
            skillOverlay._mouseDownOnOverlay = e.target === skillOverlay;
          });
          skillOverlay.addEventListener("click", (e) => {
            if (e.target === skillOverlay && skillOverlay._mouseDownOnOverlay) {
              skillOverlay.removeClass("open");
            }
          });
          const skillModalBox = skillOverlay.createEl("div", { cls: "quest-modal skill-context ql-modal" });
          const skillModalHeader = skillModalBox.createEl("div", { cls: "quest-modal-header" });
          const skillHeaderIcon = skillModalHeader.createEl("span", { cls: "quest-modal-header-icon" });
          setIcon(skillHeaderIcon, "zap");
          skillModalHeader.createEl("span", { text: "New Skill" });
          const skillCloseBtn = skillModalHeader.createEl("button", {
            cls: "quest-detail-close-btn quest-modal-close-btn",
            attr: { "aria-label": "Close" }
          });
          const skillCloseIcon = skillCloseBtn.createEl("span", { cls: "quest-detail-close-icon" });
          setIcon(skillCloseIcon, "x");
          const skillNameInput = skillModalBox.createEl("input", {
            type: "text",
            placeholder: "Skill Name...",
            cls: "quest-modal-title"
          });
          const skillDescInput = skillModalBox.createEl("textarea", {
            attr: { placeholder: "Description..." },
            cls: "quest-modal-desc"
          });
          const skillInfo = skillModalBox.createEl("div", { cls: "skill-creation-info" });
          skillInfo.createEl("span", {
            text: "Skills level up automatically when attached to quests or habits.",
            cls: "skill-creation-info-text"
          });
          const selectedQuestIds = this.attachLinkedPicker(skillModalBox, {
            kind: "quest",
            label: "attach quests",
            emptyText: "no quests attached",
            initialIds: []
          });
          const selectedHabitIds = this.attachLinkedPicker(skillModalBox, {
            kind: "habit",
            label: "attach habits",
            emptyText: "no habits attached",
            initialIds: []
          });
          skillModalBox.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
          const skillBtnContainer = skillModalBox.createEl("div", {
            cls: "quest-modal-buttons"
          });
          const skillCreateBtn = skillBtnContainer.createEl("button", {
            cls: "quest-modal-create-btn quest-modal-create-btn-full"
          });
          const skillCreateBtnIcon = skillCreateBtn.createEl("span", {
            cls: "quest-modal-create-btn-icon"
          });
          setIcon(skillCreateBtnIcon, "plus");
          skillCreateBtn.createEl("span", { text: "Create Skill" });
          const closeSkillOverlay = /* @__PURE__ */ __name(() => {
            skillOverlay.removeClass("open");
            skillNameInput.value = "";
            skillDescInput.value = "";
            selectedQuestIds.length = 0;
            selectedHabitIds.length = 0;
            if (typeof selectedQuestIds.refresh === "function") selectedQuestIds.refresh();
            if (typeof selectedHabitIds.refresh === "function") selectedHabitIds.refresh();
          }, "closeSkillOverlay");
          skillCloseBtn.addEventListener("click", closeSkillOverlay);
          skillCreateBtn.addEventListener("click", async () => {
            if (skillNameInput.value.trim() !== "") {
              const skill = {
                id: Date.now().toString(),
                name: skillNameInput.value.trim(),
                description: skillDescInput.value.trim(),
                xp: 0,
                level: 1,
                legendary: false,
                created: (/* @__PURE__ */ new Date()).toISOString()
              };
              this.plugin.settings.skills.push(skill);
              this.syncSkillLinks(skill.id, selectedQuestIds, selectedHabitIds);
              await this.plugin.saveSettings();
              this.renderSkillList(skillsContent);
              if (this._questListContainer) this.renderQuestList(this._questListContainer);
              if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
              new obsidianNS.Notice(`Created Skill: ${skill.name}`);
              closeSkillOverlay();
            } else {
              new obsidianNS.Notice("Add Skill Name First!");
            }
          });
          this._questListContainer = questListContainer;
          this._habitListContainer = habitsContent;
          this._skillListContainer = skillsContent;
          this._completedListContainer = completedListContainer;
          this._detailOverlay = detailOverlay;
          this._detailBox = detailBox;
          this._skillOverlay = skillOverlay;
          this._skillModalBox = skillModalBox;
        }
        // ----------------------------------------
        // DELETE CONFIRMATION MODAL
        // ----------------------------------------
        showDeleteConfirm(title, onConfirm) {
          const host = this.overlayHost();
          if (!host) return;
          const confirmOverlay = host.createEl("div", {
            cls: "delete-confirm-overlay ql-overlay open"
          });
          const confirmBox = confirmOverlay.createEl("div", {
            cls: "quest-modal delete-confirm-modal ql-modal"
          });
          const headerRow = confirmBox.createEl("div", { cls: "delete-confirm-header" });
          const warnIcon = headerRow.createEl("span", { cls: "delete-confirm-icon" });
          setIcon(warnIcon, "alert-triangle");
          headerRow.createEl("span", {
            text: "Confirm Delete",
            cls: "delete-confirm-title"
          });
          confirmBox.createEl("p", {
            text: `Are you sure you want to delete "${title}"?`,
            cls: "delete-confirm-desc"
          });
          const btnRow = confirmBox.createEl("div", { cls: "delete-confirm-buttons" });
          const cancelBtn = btnRow.createEl("button", {
            text: "Cancel",
            cls: "quest-modal-cancel-btn"
          });
          cancelBtn.addEventListener("click", () => confirmOverlay.remove());
          confirmOverlay.addEventListener("mousedown", (e) => {
            confirmOverlay._mouseDownOnOverlay = e.target === confirmOverlay;
          });
          confirmOverlay.addEventListener("click", (e) => {
            if (e.target === confirmOverlay && confirmOverlay._mouseDownOnOverlay) confirmOverlay.remove();
          });
          const confirmBtn = btnRow.createEl("button", {
            text: "Delete",
            cls: "delete-confirm-btn"
          });
          confirmBtn.addEventListener("click", async () => {
            confirmOverlay.remove();
            await onConfirm();
          });
        }
        // ----------------------------------------
        // QUEST LIST RENDERING
        // ----------------------------------------
        renderQuestList(container) {
          container.empty();
          const quests2 = this.plugin.settings.quests;
          if (quests2.length === 0) {
            container.createEl("div", {
              text: "No active quests. Tap + to create one.",
              cls: "quest-list-empty"
            });
            return;
          }
          quests2.forEach((quest) => {
            const block = container.createEl("div", { cls: "quest-block" });
            block.createEl("div", {
              text: quest.title,
              cls: "quest-block-title"
            });
            if (quest.description) {
              const descWrap = block.createEl("div", {
                cls: "quest-block-desc-wrap"
              });
              descWrap.createEl("span", {
                text: quest.description,
                cls: "quest-block-desc-text"
              });
            }
            block.createEl("div", {
              text: `${quest.xp.toLocaleString()} XP`,
              cls: "quest-block-xp"
            });
            const completeBtn = block.createEl("button", { cls: "quest-complete-btn" });
            const completeIcon = completeBtn.createEl("span", { cls: "quest-btn-icon" });
            setIcon(completeIcon, "check");
            completeBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              await this.completeQuest(quest);
            });
            block.addEventListener("click", () => {
              this.openQuestDetail(quest);
            });
          });
        }
        // ----------------------------------------
        // SHARED CREATE MODAL (quest | habit)
        // Same type-flag pattern as openDetailModal.
        // ----------------------------------------
        openCreateModal({ type }) {
          const isHabit = type === "habit";
          const overlay = this._createOverlay;
          const box = this._createBox;
          this.drainSliders(box);
          box.empty();
          box.removeClass("habit-context");
          box.removeClass("quest-context");
          box.removeClass("skill-context");
          if (isHabit) box.addClass("habit-context");
          else box.addClass("quest-context");
          overlay.addClass("open");
          const modalHeader = box.createEl("div", { cls: "quest-modal-header" });
          const headerIcon = modalHeader.createEl("span", { cls: "quest-modal-header-icon" });
          setIcon(headerIcon, isHabit ? "repeat" : "scroll");
          modalHeader.createEl("span", { text: isHabit ? "New Habit" : "New Quest" });
          const closeBtn = modalHeader.createEl("button", {
            cls: "quest-detail-close-btn quest-modal-close-btn",
            attr: { "aria-label": "Close" }
          });
          const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
          setIcon(closeIcon, "x");
          const titleInput = box.createEl("input", {
            type: "text",
            placeholder: isHabit ? "Habit Title..." : "Quest Title...",
            cls: "quest-modal-title"
          });
          const descInput = box.createEl("textarea", {
            attr: { placeholder: isHabit ? "Description..." : "Instructions..." },
            cls: "quest-modal-desc"
          });
          const xpRow = box.createEl("div", { cls: "quest-xp-preview-row quest-detail-reward" });
          xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
          xpRow.createEl("div", { cls: "quest-detail-reward-divider" });
          const rewardBody = xpRow.createEl("div", { cls: "quest-detail-reward-body" });
          const xpPreview = { el: null, coinEl: null };
          const showCoins = Boolean(this.plugin.settings.rewardsMode) && !isHabit;
          const defaultXp = _QuestLogView2.calcXp(1, 1, 1);
          if (showCoins) {
            rewardBody.addClass("has-extra");
            const coinSlot = rewardBody.createEl("div", { cls: "quest-detail-reward-slot" });
            const coinWrap = coinSlot.createEl("span", { cls: "quest-detail-reward-coins" });
            const coinIcon = coinWrap.createEl("span", { cls: "quest-detail-reward-coin-icon" });
            setIcon(coinIcon, "coins");
            xpPreview.coinEl = coinWrap.createEl("span", {
              cls: "quest-detail-reward-coin-text",
              text: `+${Math.max(1, Math.min(50, Math.round(defaultXp / 1e4)))}`
            });
          }
          const xpSlot = showCoins ? rewardBody.createEl("div", { cls: "quest-detail-reward-slot" }) : rewardBody;
          xpPreview.el = xpSlot.createEl("span", {
            text: `${defaultXp.toLocaleString()} XP`,
            cls: "quest-xp-preview-value"
          });
          const slidersSection = box.createEl("div", { cls: "quest-sliders-section" });
          const updateXpPreview = /* @__PURE__ */ __name(() => {
            const xp = _QuestLogView2.calcXp(
              diffSlider._getValue(),
              urgSlider._getValue(),
              impSlider._getValue()
            );
            xpPreview.el.setText(`${xp.toLocaleString()} XP`);
            if (xpPreview.coinEl) {
              xpPreview.coinEl.setText(
                `+${Math.max(1, Math.min(50, Math.round(xp / 1e4)))}`
              );
            }
          }, "updateXpPreview");
          const diffSlider = this.createSlider(
            slidersSection,
            "Difficulty",
            _QuestLogView2.DIFFICULTY_LABELS,
            "#3b82f6",
            1,
            updateXpPreview
          );
          const urgSlider = this.createSlider(
            slidersSection,
            "Urgency",
            _QuestLogView2.URGENCY_LABELS,
            "#f59e0b",
            1,
            updateXpPreview
          );
          const impSlider = this.createSlider(
            slidersSection,
            "Impact",
            _QuestLogView2.IMPACT_LABELS,
            "#a855f7",
            1,
            updateXpPreview
          );
          const selectedSkillIds = this.attachSkillPicker(box, []);
          box.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
          const btnContainer = box.createEl("div", { cls: "quest-modal-buttons" });
          const createBtn = btnContainer.createEl("button", {
            cls: "quest-modal-create-btn quest-modal-create-btn-full"
          });
          const createBtnIcon = createBtn.createEl("span", { cls: "quest-modal-create-btn-icon" });
          setIcon(createBtnIcon, "plus");
          createBtn.createEl("span", { text: isHabit ? "Create Habit" : "Create Quest" });
          const closeOverlay = /* @__PURE__ */ __name(() => {
            overlay.removeClass("open");
          }, "closeOverlay");
          closeBtn.addEventListener("click", closeOverlay);
          createBtn.addEventListener("click", async () => {
            if (titleInput.value.trim() !== "") {
              const xp = _QuestLogView2.calcXp(
                diffSlider._getValue(),
                urgSlider._getValue(),
                impSlider._getValue()
              );
              const item = {
                id: Date.now().toString(),
                title: titleInput.value.trim(),
                description: descInput.value.trim(),
                difficulty: diffSlider._getValue(),
                urgency: urgSlider._getValue(),
                impact: impSlider._getValue(),
                xp,
                created: (/* @__PURE__ */ new Date()).toISOString(),
                skillIds: [...selectedSkillIds]
              };
              if (isHabit) {
                this.plugin.settings.habits.push(item);
                await this.plugin.saveSettings();
                this.renderHabitList(this._habitListContainer);
                new obsidianNS.Notice(`Created Habit: ${item.title} (${xp.toLocaleString()} XP)`);
              } else {
                this.plugin.settings.quests.push(item);
                await this.plugin.saveSettings();
                this.renderQuestList(this._questListContainer);
                new obsidianNS.Notice(`Created Quest: ${item.title} (${xp.toLocaleString()} XP)`);
              }
              closeOverlay();
            } else {
              new obsidianNS.Notice(isHabit ? "Add Habit Title First!" : "Add Quest Title First!");
            }
          });
          titleInput.focus();
        }
        // ----------------------------------------
        // SHARED DETAIL MODAL (quest | habit)
        // Branch only type-specific diffs; layout/header/body shared.
        // ----------------------------------------
        openDetailModal({ type, item }) {
          const isHabit = type === "habit";
          const overlay = this._detailOverlay;
          const box = this._detailBox;
          this.drainSliders(box);
          box.empty();
          box.removeClass("habit-context");
          box.removeClass("quest-context");
          box.removeClass("skill-context");
          if (isHabit) box.addClass("habit-context");
          else box.addClass("quest-context");
          overlay.addClass("open");
          const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
          headerRow.createEl("span", {
            text: isHabit ? "Habit Details" : "Quest Details",
            cls: "quest-detail-modal-title"
          });
          const createdDate = _QuestLogView2.formatDate(item.created);
          headerRow.createEl("span", {
            text: `Created ${createdDate}`,
            cls: "quest-detail-meta-text"
          });
          const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
          const deleteBtn = btnGroup.createEl("button", {
            cls: "quest-detail-delete-btn"
          });
          const deleteIcon = deleteBtn.createEl("span", {
            cls: "quest-detail-delete-icon"
          });
          setIcon(deleteIcon, "trash-2");
          deleteBtn.addEventListener("click", () => {
            this.showDeleteConfirm(item.title, async () => {
              if (isHabit) {
                await retireNote(this.plugin, habitNotePaths(this.plugin, item));
                this.plugin.settings.habits = this.plugin.settings.habits.filter(
                  (h) => h.id !== item.id
                );
                await this.plugin.saveSettings();
                overlay.removeClass("open");
                this.renderHabitList(this._habitListContainer);
                new obsidianNS.Notice("Habit deleted.");
              } else {
                await retireNote(
                  this.plugin,
                  questNotePaths(this.plugin, item, this.plugin.settings.quests, this.plugin.settings.questsFolderPath || "Quest Log/Quests")
                );
                this.plugin.settings.quests = this.plugin.settings.quests.filter(
                  (q) => q.id !== item.id
                );
                await this.plugin.saveSettings();
                overlay.removeClass("open");
                this.renderQuestList(this._questListContainer);
                new obsidianNS.Notice("Quest deleted.");
              }
            });
          });
          const openNoteBtn = btnGroup.createEl("button", {
            cls: "quest-detail-open-btn"
          });
          const openNoteIcon = openNoteBtn.createEl("span", {
            cls: "quest-detail-open-icon"
          });
          setIcon(openNoteIcon, "file-text");
          openNoteBtn.addEventListener("click", () => {
            if (isHabit) {
              const folderPath = this.plugin.settings.habitsFolderPath || "Quest Log/Habits";
              const stem = uniqueStem(this.plugin.settings.habits, item.title, item.id, "title");
              const fullPath = `${folderPath}/${stem}.md`;
              this.app.workspace.openLinkText(fullPath, "", false);
            } else {
              const folderPath = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
              const stem = uniqueStem(this.plugin.settings.quests, item.title, item.id, "title");
              const fullPath = `${folderPath}/${stem}.md`;
              this.app.workspace.openLinkText(fullPath, "", false);
            }
          });
          const closeBtn = btnGroup.createEl("button", {
            cls: "quest-detail-close-btn",
            attr: { "aria-label": "Close" }
          });
          const closeIcon = closeBtn.createEl("span", {
            cls: "quest-detail-close-icon"
          });
          setIcon(closeIcon, "x");
          headerRow.addClass("has-divider");
          const titleInput = box.createEl("input", {
            type: "text",
            value: item.title,
            cls: "quest-detail-title-input quest-modal-title"
          });
          const descBox = box.createEl("textarea", {
            text: item.description || "",
            cls: "quest-detail-desc",
            attr: { placeholder: "No description." }
          });
          descBox.style.height = "auto";
          descBox.style.height = descBox.scrollHeight + "px";
          const xpRow = box.createEl("div", { cls: "quest-xp-preview-row quest-detail-reward" });
          xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
          xpRow.createEl("div", { cls: "quest-detail-reward-divider" });
          const rewardBody = xpRow.createEl("div", { cls: "quest-detail-reward-body" });
          const xpPreview = { el: null, coinEl: null };
          const showCoins = Boolean(this.plugin.settings.rewardsMode) && !isHabit;
          if (showCoins) {
            rewardBody.addClass("has-extra");
            const coinSlot = rewardBody.createEl("div", { cls: "quest-detail-reward-slot" });
            const coinWrap = coinSlot.createEl("span", { cls: "quest-detail-reward-coins" });
            const coinIcon = coinWrap.createEl("span", { cls: "quest-detail-reward-coin-icon" });
            setIcon(coinIcon, "coins");
            xpPreview.coinEl = coinWrap.createEl("span", {
              cls: "quest-detail-reward-coin-text",
              text: `+${Math.max(1, Math.min(50, Math.round(item.xp / 1e4)))}`
            });
          }
          const xpSlot = showCoins ? rewardBody.createEl("div", { cls: "quest-detail-reward-slot" }) : rewardBody;
          xpPreview.el = xpSlot.createEl("span", {
            text: `${item.xp.toLocaleString()} XP`,
            cls: "quest-xp-preview-value"
          });
          const slidersSection = box.createEl("div", {
            cls: "quest-sliders-section"
          });
          const updateXpPreview = /* @__PURE__ */ __name(() => {
            const xp = _QuestLogView2.calcXp(
              diffSlider._getValue(),
              urgSlider._getValue(),
              impSlider._getValue()
            );
            xpPreview.el.setText(`${xp.toLocaleString()} XP`);
            if (xpPreview.coinEl) {
              xpPreview.coinEl.setText(
                `+${Math.max(1, Math.min(50, Math.round(xp / 1e4)))}`
              );
            }
          }, "updateXpPreview");
          const diffSlider = this.createSlider(
            slidersSection,
            "Difficulty",
            _QuestLogView2.DIFFICULTY_LABELS,
            "#3b82f6",
            item.difficulty || 3,
            updateXpPreview
          );
          const urgSlider = this.createSlider(
            slidersSection,
            "Urgency",
            _QuestLogView2.URGENCY_LABELS,
            "#f59e0b",
            item.urgency || 3,
            updateXpPreview
          );
          const impSlider = this.createSlider(
            slidersSection,
            "Impact",
            _QuestLogView2.IMPACT_LABELS,
            "#a855f7",
            item.impact || 3,
            updateXpPreview
          );
          const selectedSkillIds = this.attachSkillPicker(box, item.skillIds);
          const saveItem = /* @__PURE__ */ __name(async () => {
            item.title = titleInput.value.trim() || item.title;
            item.description = descBox.value.trim();
            item.difficulty = diffSlider._getValue();
            item.urgency = urgSlider._getValue();
            item.impact = impSlider._getValue();
            item.xp = _QuestLogView2.calcXp(item.difficulty, item.urgency, item.impact);
            item.skillIds = [...selectedSkillIds];
            await this.plugin.saveSettings();
            if (isHabit) this.renderHabitList(this._habitListContainer);
            else this.renderQuestList(this._questListContainer);
          }, "saveItem");
          closeBtn.addEventListener("click", async () => {
            await saveItem();
            overlay.removeClass("open");
          });
          box.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
          const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
          if (isHabit) {
            const failBtn = btnRow.createEl("button", {
              cls: "habit-fail-btn",
              attr: { "aria-label": "Fail" }
            });
            const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
            setIcon(failIcon, "x");
            failBtn.addEventListener("click", async () => {
              await this.failHabit(item);
              overlay.removeClass("open");
            });
          }
          const completeBtn = btnRow.createEl("button", {
            cls: "quest-detail-complete-btn",
            attr: { "aria-label": "Complete" }
          });
          const completeIcon = completeBtn.createEl("span", {
            cls: "quest-detail-complete-icon"
          });
          setIcon(completeIcon, "check");
          completeBtn.addEventListener("click", async () => {
            if (isHabit) {
              await saveItem();
              await this.completeHabit(item);
              overlay.removeClass("open");
            } else {
              await saveItem();
              overlay.removeClass("open");
              await this.completeQuest(item);
              if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
            }
          });
        }
        openQuestDetail(quest) {
          this.openDetailModal({ type: "quest", item: quest });
        }
        // ----------------------------------------
        // QUEST ACTIONS
        // ----------------------------------------
        async moveSidecar(sourcePath, destPath) {
          return moveSidecar(this.app, sourcePath, destPath);
        }
        async completeQuest(quest) {
          const hadNote = await retireNote(
            this.plugin,
            questNotePaths(this.plugin, quest, this.plugin.settings.quests, this.plugin.settings.questsFolderPath || "Quest Log/Quests")
          );
          this.plugin.settings.questsCompleted += 1;
          const completedQuest = { ...quest, completedAt: (/* @__PURE__ */ new Date()).toISOString() };
          this.plugin.settings.completedQuests.push(completedQuest);
          this.plugin.settings.quests = this.plugin.settings.quests.filter(
            (q) => q.id !== quest.id
          );
          await this.plugin.saveSettings();
          if (hadNote) await writeCompletedQuestFile(this.plugin, completedQuest);
          this.renderQuestList(this._questListContainer);
          await this.awardXp(quest.xp, quest.skillIds, "Quest Complete!", true);
        }
        // ----------------------------------------
        // XP AWARDING (shared by quests + habits)
        // ----------------------------------------
        async awardXp(xp, skillIds, sourceName, grantCoins = false) {
          const levelBefore = this.plugin.getLevel();
          this.plugin.settings.currentXp += xp;
          if (grantCoins) {
            const coins = Math.max(1, Math.min(50, Math.round(xp / 1e4)));
            this.plugin.settings.coins += coins;
          }
          if (skillIds && skillIds.length > 0) {
            await this.applyXpToSkills(xp, skillIds);
          }
          await this.plugin.saveSettings();
          this.updateHeader();
          const levelAfter = this.plugin.getLevel();
          if (levelAfter > levelBefore) {
            const title = _QuestLogView2.getLevelTitle(levelAfter);
            const coinsEarned = levelAfter * 10;
            this.plugin.settings.coins += coinsEarned;
            await this.plugin.saveSettings();
            this.showLevelUpPopup(levelAfter, title, coinsEarned);
          } else {
            new obsidianNS.Notice(`${sourceName} +${xp.toLocaleString()} XP`);
          }
        }
        // ----------------------------------------
        // LEVEL UP POPUP
        // ----------------------------------------
        showLevelUpPopup(level, title, coinsEarned) {
          const win = activeWindow;
          const host = this.overlayHost();
          if (!host) return;
          this._playLevelUpSound();
          const confettiContainer = host.createDiv({ cls: "ql-confetti-container" });
          const colors = ["#ffd700", "#ff8c00", "#ff6347", "#00ced1", "#7b68ee", "#ff69b4", "#32cd32"];
          for (let i = 0; i < 40; i++) {
            const piece = confettiContainer.createDiv({ cls: "ql-confetti-piece" });
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.8;
            const duration = 1.5 + Math.random() * 1.5;
            const size = 6 + Math.random() * 6;
            const shape = Math.random() > 0.5 ? "50%" : "2px";
            piece.style.left = `${left}%`;
            piece.style.backgroundColor = color;
            piece.style.width = `${size}px`;
            piece.style.height = `${size}px`;
            piece.style.borderRadius = shape;
            piece.style.animationDuration = `${duration}s`;
            piece.style.animationDelay = `${delay}s`;
          }
          const overlay = host.createDiv({ cls: "ql-levelup-overlay" });
          const card = overlay.createDiv({ cls: "ql-levelup-card" });
          const badge = card.createDiv({ cls: "ql-levelup-badge" });
          badge.createDiv({ cls: "ql-levelup-badge-number", text: `${level}` });
          badge.createDiv({ cls: "ql-levelup-badge-label", text: "LEVEL" });
          card.createEl("h2", { cls: "ql-levelup-title", text: "Level Up!" });
          card.createDiv({ cls: "ql-levelup-subtitle", text: title });
          if (this.plugin.settings.rewardsMode) {
            const coinsRow = card.createDiv({ cls: "ql-levelup-coins" });
            const coinIcon = coinsRow.createSpan({ cls: "ql-levelup-coin-icon" });
            setIcon(coinIcon, "coins");
            coinsRow.createSpan({ cls: "ql-levelup-coin-text", text: `+${coinsEarned} Coins` });
          }
          card.createDiv({ cls: "ql-levelup-hint", text: "Tap anywhere to continue" });
          win.requestAnimationFrame(() => {
            overlay.addClass("active");
          });
          let dismissed = false;
          const dismiss = /* @__PURE__ */ __name(() => {
            if (dismissed) return;
            dismissed = true;
            overlay.addClass("fading-out");
            overlay.removeClass("active");
            win.setTimeout(() => {
              overlay.detach();
              confettiContainer.detach();
            }, 500);
          }, "dismiss");
          this.registerDomEvent(overlay, "click", dismiss);
          const autoTimer = win.setTimeout(dismiss, 3500);
          this.registerDomEvent(overlay, "click", () => win.clearTimeout(autoTimer));
        }
        _playLevelUpSound() {
          try {
            const win = activeWindow;
            const ctx = new (win.AudioContext || win.webkitAudioContext)();
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, i) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.value = freq;
              gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
              gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.05);
              gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.3);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(ctx.currentTime + i * 0.12);
              osc.stop(ctx.currentTime + i * 0.12 + 0.35);
            });
          } catch (e) {
          }
        }
        // ----------------------------------------
        // HABIT LIST RENDERING
        // ----------------------------------------
        renderHabitList(container) {
          container.empty();
          const habits2 = this.plugin.settings.habits;
          if (habits2.length === 0) {
            container.createEl("div", {
              text: "No active habits. Tap + to create one.",
              cls: "quest-list-empty"
            });
            return;
          }
          habits2.forEach((habit) => {
            const block = container.createEl("div", { cls: "quest-block" });
            block.addClass("habit-block");
            block.createEl("div", {
              text: habit.title,
              cls: "quest-block-title"
            });
            if (habit.description) {
              const descWrap = block.createEl("div", {
                cls: "quest-block-desc-wrap"
              });
              descWrap.createEl("span", {
                text: habit.description,
                cls: "quest-block-desc-text"
              });
            }
            block.createEl("div", {
              text: `${habit.xp.toLocaleString()} XP`,
              cls: "quest-block-xp"
            });
            const actionRow = block.createEl("div", { cls: "habit-action-row" });
            const failBtn = actionRow.createEl("button", { cls: "habit-fail-btn-mini" });
            const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
            setIcon(failIcon, "x");
            failBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              await this.failHabit(habit);
            });
            const completeBtn = actionRow.createEl("button", { cls: "habit-complete-btn-mini" });
            const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
            setIcon(completeIcon, "check");
            completeBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              await this.completeHabit(habit);
            });
            block.addEventListener("click", () => {
              this.openHabitDetail(habit);
            });
          });
        }
        // ----------------------------------------
        // HABIT ACTIONS
        // ----------------------------------------
        async completeHabit(habit) {
          const completedAt = (/* @__PURE__ */ new Date()).toISOString();
          const completedHabit = { ...habit, completedAt };
          this.plugin.settings.completedHabits.push(completedHabit);
          await this.plugin.saveSettings();
          this.renderHabitList(this._habitListContainer);
          this.renderSkillList(this._skillListContainer);
          await this.awardXp(habit.xp, habit.skillIds, "Habit completed:");
        }
        async failHabit(habit) {
          this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
          this.revokeSkillXp(habit.xp, habit.skillIds);
          await this.plugin.saveSettings();
          this.updateHeader();
          if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
          new obsidianNS.Notice(`Habit failed: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
        }
        // ----------------------------------------
        // APPLY XP TO SKILLS
        // ----------------------------------------
        async applyXpToSkills(xp, skillIds) {
          if (!skillIds || skillIds.length === 0) return;
          const difficulty = this.plugin.settings.skillDifficulty || 10;
          for (const skillId of skillIds) {
            const skill = this.plugin.settings.skills.find((s) => s.id === skillId);
            if (skill && !skill.legendary) {
              skill.xp = (skill.xp || 0) + xp;
              skill.level = _QuestLogView2.getSkillLevel(skill.xp, difficulty);
            }
          }
        }
        revokeSkillXp(xp, skillIds) {
          if (!skillIds || skillIds.length === 0) return;
          const difficulty = this.plugin.settings.skillDifficulty || 10;
          for (const skillId of skillIds) {
            const skill = this.plugin.settings.skills.find((s) => s.id === skillId);
            if (skill && !skill.legendary) {
              skill.xp = Math.max(0, (skill.xp || 0) - xp);
              skill.level = _QuestLogView2.getSkillLevel(skill.xp, difficulty);
            }
          }
        }
        // ----------------------------------------
        // SHOP LIST RENDERING
        // ----------------------------------------
        renderShopList(container) {
          container.empty();
          const rewards = this.plugin.settings.rewards || [];
          if (rewards.length === 0) {
            const empty = container.createDiv({ cls: "shop-empty" });
            const emptyIcon = empty.createDiv({ cls: "shop-empty-icon" });
            setIcon(emptyIcon, "shopping-bag");
            empty.createDiv({ text: "No rewards yet", cls: "shop-empty-title" });
            empty.createDiv({ text: "Create a reward to treat yourself!", cls: "shop-empty-desc" });
            return;
          }
          rewards.forEach((reward) => {
            const card = container.createEl("div", { cls: "shop-card" });
            const info = card.createEl("div", { cls: "shop-card-info" });
            info.createEl("div", { text: reward.name, cls: "shop-card-name" });
            if (reward.description) {
              info.createEl("div", { text: reward.description, cls: "shop-card-desc" });
            }
            const meta = card.createEl("div", { cls: "shop-card-meta" });
            const priceRow = meta.createEl("div", { cls: "shop-card-price" });
            const coinIcon = priceRow.createSpan({ cls: "shop-card-coin" });
            setIcon(coinIcon, "coins");
            priceRow.createSpan({ text: `${reward.price}` });
            if (reward.stock !== null && reward.stock !== void 0) {
              meta.createEl("div", { text: `Stock: ${reward.stock}`, cls: "shop-card-stock" });
            } else {
              meta.createEl("div", { text: `Stock: \u221E`, cls: "shop-card-stock shop-card-stock-unlimited" });
            }
            card.addEventListener("click", () => {
              this.showPurchasePopup(reward);
            });
            const deleteBtn = card.createEl("button", { cls: "shop-card-delete" });
            setIcon(deleteBtn, "trash-2");
            deleteBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              this.plugin.settings.rewards = this.plugin.settings.rewards.filter((r) => r.id !== reward.id);
              await this.plugin.saveSettings();
              this.renderShopList(container);
            });
          });
        }
        // ----------------------------------------
        // PURCHASE POPUP
        // ----------------------------------------
        showPurchasePopup(reward) {
          const win = activeWindow;
          const host = this.overlayHost();
          if (!host) return;
          const overlay = host.createDiv({ cls: "shop-purchase-overlay" });
          const card = overlay.createEl("div", { cls: "shop-purchase-card" });
          card.createEl("h2", { text: reward.name, cls: "shop-purchase-title" });
          if (reward.description) {
            card.createEl("p", { text: reward.description, cls: "shop-purchase-desc" });
          }
          const priceRow = card.createDiv({ cls: "shop-purchase-price-row" });
          const coinIcon = priceRow.createSpan({ cls: "shop-purchase-coin" });
          setIcon(coinIcon, "coins");
          priceRow.createSpan({ text: `${reward.price} coins each`, cls: "shop-purchase-price-text" });
          const qtyRow = card.createDiv({ cls: "shop-purchase-qty-row" });
          const qtyMinus = qtyRow.createEl("button", { cls: "shop-purchase-qty-btn", text: "\u2212" });
          const qtyDisplay = qtyRow.createEl("span", { text: "1", cls: "shop-purchase-qty-display" });
          const qtyPlus = qtyRow.createEl("button", { cls: "shop-purchase-qty-btn", text: "+" });
          let qty = 1;
          const maxQty = reward.stock !== null && reward.stock !== void 0 ? Math.min(reward.stock, Math.floor(this.plugin.settings.coins / reward.price)) : Math.floor(this.plugin.settings.coins / reward.price);
          const updateQty = /* @__PURE__ */ __name((newQty) => {
            qty = Math.max(1, Math.min(maxQty || 1, newQty));
            qtyDisplay.setText(`${qty}`);
            totalDisplay.setText(`${qty * reward.price} coins`);
          }, "updateQty");
          qtyMinus.addEventListener("click", () => updateQty(qty - 1));
          qtyPlus.addEventListener("click", () => updateQty(qty + 1));
          const totalRow = card.createDiv({ cls: "shop-purchase-total-row" });
          totalRow.createSpan({ text: "Total:", cls: "shop-purchase-total-label" });
          const totalDisplay = totalRow.createSpan({ text: `${reward.price} coins`, cls: "shop-purchase-total-value" });
          const btnRow = card.createDiv({ cls: "shop-purchase-btn-row" });
          const cancelBtn = btnRow.createEl("button", { text: "Close", cls: "quest-modal-btn quest-modal-cancel" });
          const purchaseBtn = btnRow.createEl("button", { text: "Purchase", cls: "quest-modal-btn quest-modal-create shop-purchase-btn" });
          if (maxQty <= 0) {
            purchaseBtn.disabled = true;
            purchaseBtn.setText("Not enough coins");
            purchaseBtn.addClass("shop-purchase-btn-disabled");
          }
          overlay.addEventListener("mousedown", (e) => {
            overlay._mouseDownOnOverlay = e.target === overlay;
          });
          overlay.addEventListener("click", (e) => {
            if (e.target === overlay && overlay._mouseDownOnOverlay) {
              overlay.detach();
            }
          });
          cancelBtn.addEventListener("click", () => {
            overlay.detach();
          });
          purchaseBtn.addEventListener("click", async () => {
            const totalCost = qty * reward.price;
            if (this.plugin.settings.coins < totalCost) return;
            this.plugin.settings.coins -= totalCost;
            if (reward.stock !== null && reward.stock !== void 0) {
              reward.stock = Math.max(0, reward.stock - qty);
              if (reward.stock === 0) {
                this.plugin.settings.rewards = this.plugin.settings.rewards.filter((r) => r.id !== reward.id);
              }
            }
            await this.plugin.saveSettings();
            if (this._shopCoinText) this._shopCoinText.setText(`${this.plugin.settings.coins}`);
            new obsidianNS.Notice(`Purchased ${qty}x ${reward.name}!`);
            overlay.detach();
            if (this._shopListEl) this.renderShopList(this._shopListEl);
          });
          win.requestAnimationFrame(() => {
            overlay.addClass("active");
          });
        }
        // ----------------------------------------
        // SKILL LIST RENDERING
        // ----------------------------------------
        renderSkillList(container) {
          container.empty();
          const skills2 = this.plugin.settings.skills || [];
          if (skills2.length === 0) {
            container.createEl("div", {
              text: "No skills yet. Tap + to create one.",
              cls: "quest-list-empty"
            });
            return;
          }
          const grid = container.createEl("div", { cls: "skill-grid" });
          skills2.forEach((skill) => {
            const block = grid.createEl("div", { cls: "quest-block skill-block" });
            const difficulty = this.plugin.settings.skillDifficulty || 10;
            const xpInfo = _QuestLogView2.getSkillXpProgress(skill, difficulty);
            block.createEl("div", {
              text: skill.name,
              cls: "quest-block-title"
            });
            if (skill.description) {
              const noteIcon = block.createEl("span", { cls: "skill-note-icon" });
              setIcon(noteIcon, "file-text");
            }
            const levelBadge = block.createEl("div", { cls: "skill-level-badge" });
            if (skill.legendary) {
              levelBadge.setText("\u2605 Lvl " + skill.level);
            } else {
              levelBadge.setText("Lvl " + (skill.level || 1));
            }
            const xpBar = block.createEl("div", { cls: "skill-xp-bar" });
            const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
            xpFill.style.width = `${xpInfo.pct}%`;
            block.addEventListener("click", () => {
              this.openSkillDetail(skill);
            });
          });
        }
        // ----------------------------------------
        // SKILL DETAIL VIEW
        // ----------------------------------------
        /**
         * Show the Skill Graph modal with radar chart - Premium RPG style
         */
        showSkillGraphModal() {
          const overlay = this._skillGraphOverlay;
          const content = this._skillGraphContent;
          if (!overlay || !content) return;
          content.empty();
          overlay.style.display = "flex";
          overlay.style.opacity = "0";
          overlay.style.transition = "opacity 0.25s ease-out";
          requestAnimationFrame(() => {
            overlay.style.opacity = "1";
          });
          const skills2 = this.plugin.settings.skills || [];
          const level = this.plugin.getLevel();
          const title = _QuestLogView2.getLevelTitle(level);
          const heroName = this.plugin.settings.heroName || "Hero";
          const headerSection = content.createEl("div", { cls: "skill-graph-header-section" });
          const headerRow = headerSection.createEl("div", { cls: "skill-graph-header-row" });
          const iconSpan = headerRow.createEl("span", { cls: "skill-graph-header-icon" });
          setIcon(iconSpan, "sword");
          const titleGroup = headerRow.createEl("div", { cls: "skill-graph-title-group" });
          titleGroup.createEl("span", {
            text: `${heroName} \u2014 ${title}`,
            cls: "skill-graph-hero-title"
          });
          headerSection.createEl("div", {
            text: `Level ${level}`,
            cls: "skill-graph-hero-subtitle"
          });
          const pickerBar = content.createEl("div", { cls: "skill-graph-picker-bar" });
          const pickerBtn = pickerBar.createEl("button", {
            cls: "skill-graph-picker-icon-btn",
            attr: { "aria-label": "Select skills to display" }
          });
          setIcon(pickerBtn, "square");
          const pickerDropdown = content.createEl("div", { cls: "skill-graph-picker-dropdown hidden" });
          const allSkillsSorted = [...skills2].sort((a, b) => (b.level || 1) - (a.level || 1));
          const defaultSelected = new Set(allSkillsSorted.slice(0, 12).map((s) => s.id || s.name));
          let selectedSkillIds = new Set(defaultSelected);
          const chartSection = content.createEl("div", { cls: "skill-graph-chart-section" });
          const chartContainer = chartSection.createEl("div", { cls: "skill-graph-chart-container" });
          const updateChart = /* @__PURE__ */ __name(() => {
            const selectedSkills = allSkillsSorted.filter(
              (s) => selectedSkillIds.has(s.id || s.name)
            ).slice(0, 12);
            chartContainer.empty();
            if (selectedSkills.length === 0) {
              if (allSkillsSorted.length === 0) {
                chartContainer.createEl("div", {
                  text: "No skills found. Create skills to get started!",
                  cls: "skill-graph-empty"
                });
              } else {
                chartContainer.createEl("div", {
                  text: "No skills selected. Select skills to display!",
                  cls: "skill-graph-empty"
                });
              }
              return;
            }
            const chart = new SkillRadarChart(
              chartContainer,
              selectedSkills,
              (skill) => {
                overlay.style.opacity = "0";
                activeWindow.setTimeout(() => {
                  overlay.style.display = "none";
                  const questListContainer = this._questListContainer;
                  if (questListContainer) questListContainer.style.display = "flex";
                  this.openSkillDetail(skill);
                }, 250);
              }
            );
            chart.render();
          }, "updateChart");
          const renderCheckboxes = /* @__PURE__ */ __name((searchTerm = "") => {
            pickerDropdown.empty();
            const dropdownHeader = pickerDropdown.createEl("div", { cls: "skill-graph-picker-dropdown-header" });
            const searchWrap = dropdownHeader.createEl("div", { cls: "skill-graph-picker-search-wrap" });
            const searchInput = searchWrap.createEl("input", {
              type: "text",
              placeholder: "Search skills...",
              cls: "skill-graph-picker-search",
              value: searchTerm
            });
            searchInput.addEventListener("input", () => {
              renderCheckboxes(searchInput.value.toLowerCase());
            });
            const actionsWrap = dropdownHeader.createEl("div", { cls: "skill-graph-picker-actions" });
            const deselectBtn = actionsWrap.createEl("button", {
              cls: "skill-graph-picker-action-btn",
              attr: { "aria-label": "Deselect all" }
            });
            setIcon(deselectBtn, "square");
            deselectBtn.addEventListener("click", () => {
              selectedSkillIds.clear();
              renderCheckboxes(searchInput.value.toLowerCase());
              updateChart();
            });
            const resetBtn = actionsWrap.createEl("button", {
              cls: "skill-graph-picker-action-btn",
              attr: { "aria-label": "Reset to top 12" }
            });
            setIcon(resetBtn, "list-ordered");
            resetBtn.addEventListener("click", () => {
              selectedSkillIds = new Set(defaultSelected);
              renderCheckboxes(searchInput.value.toLowerCase());
              updateChart();
            });
            const filteredSkills = searchTerm ? allSkillsSorted.filter((s) => s.name.toLowerCase().includes(searchTerm)) : allSkillsSorted;
            if (filteredSkills.length === 0) {
              pickerDropdown.createEl("div", {
                text: "No matching skills",
                cls: "skill-graph-picker-empty"
              });
              return;
            }
            filteredSkills.forEach((skill) => {
              const row = pickerDropdown.createEl("label", { cls: "skill-graph-picker-row" });
              const checkbox = row.createEl("input", {
                type: "checkbox",
                cls: "skill-graph-picker-checkbox"
              });
              checkbox.checked = selectedSkillIds.has(skill.id || skill.name);
              checkbox.addEventListener("change", () => {
                const id = skill.id || skill.name;
                if (checkbox.checked) {
                  if (selectedSkillIds.size < 12) {
                    selectedSkillIds.add(id);
                  } else {
                    checkbox.checked = false;
                    new obsidianNS.Notice("Maximum 12 skills can be displayed at once.");
                  }
                } else {
                  selectedSkillIds.delete(id);
                }
                renderCheckboxes(searchInput.value.toLowerCase());
                updateChart();
              });
              row.createEl("span", {
                text: `${skill.name} (Lvl ${skill.level || 1})`,
                cls: "skill-graph-picker-label"
              });
              if (skill.legendary) {
                row.createEl("span", { text: " \u2605", cls: "skill-graph-picker-legendary" });
              }
            });
            const countRow = pickerDropdown.createEl("div", { cls: "skill-graph-picker-count" });
            countRow.setText(`${selectedSkillIds.size}/12 skills selected`);
          }, "renderCheckboxes");
          let pickerOpen = false;
          pickerBtn.addEventListener("click", () => {
            pickerOpen = !pickerOpen;
            if (pickerOpen) {
              pickerDropdown.removeClass("hidden");
              setIcon(pickerBtn, "check-square");
            } else {
              pickerDropdown.addClass("hidden");
              setIcon(pickerBtn, "square");
            }
          });
          renderCheckboxes();
          updateChart();
          const footerSection = content.createEl("div", { cls: "skill-graph-footer-section" });
          footerSection.createEl("p", {
            text: "Skill levels shown (max 100)",
            cls: "skill-graph-note"
          });
        }
        openSkillDetail(skill) {
          const overlay = this._detailOverlay;
          const box = this._detailBox;
          this.drainSliders(box);
          box.empty();
          box.removeClass("habit-context");
          box.removeClass("quest-context");
          box.removeClass("skill-context");
          box.addClass("skill-context");
          overlay.addClass("open");
          const difficulty = this.plugin.settings.skillDifficulty || 10;
          const headerRow = box.createEl("div", { cls: "quest-detail-header-row has-divider" });
          headerRow.createEl("span", {
            text: "Skill Details",
            cls: "quest-detail-modal-title"
          });
          const createdDate = _QuestLogView2.formatDate(skill.created);
          headerRow.createEl("span", {
            text: `Created on ${createdDate}`,
            cls: "quest-detail-meta-text"
          });
          const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
          const deleteBtn = btnGroup.createEl("button", {
            cls: "quest-detail-delete-btn",
            attr: { "aria-label": "Delete", type: "button" }
          });
          const deleteIcon = deleteBtn.createEl("span", {
            cls: "quest-detail-delete-icon"
          });
          setIcon(deleteIcon, "trash-2");
          deleteBtn.addEventListener("click", () => {
            this.showDeleteConfirm(skill.name, async () => {
              await retireNote(this.plugin, skillNotePaths(this.plugin, skill));
              this.plugin.settings.skills = this.plugin.settings.skills.filter(
                (s) => s.id !== skill.id
              );
              await this.plugin.saveSettings();
              overlay.removeClass("open");
              this.renderSkillList(this._skillListContainer);
              new obsidianNS.Notice("Skill deleted.");
            });
          });
          const openNoteBtn = btnGroup.createEl("button", {
            cls: "quest-detail-open-btn",
            attr: { "aria-label": "Open note", type: "button" }
          });
          const openNoteIcon = openNoteBtn.createEl("span", {
            cls: "quest-detail-open-icon"
          });
          setIcon(openNoteIcon, "file-text");
          openNoteBtn.addEventListener("click", () => {
            const folderPath = this.plugin.settings.skillsFolderPath || "Quest Log/Skills";
            const stem = uniqueStem(this.plugin.settings.skills, skill.name, skill.id, "name");
            const fullPath = `${folderPath}/${stem}.md`;
            this.app.workspace.openLinkText(fullPath, "", false);
          });
          const closeBtn = btnGroup.createEl("button", {
            cls: "quest-detail-close-btn",
            attr: { "aria-label": "Close", type: "button" }
          });
          const closeIcon = closeBtn.createEl("span", {
            cls: "quest-detail-close-icon"
          });
          setIcon(closeIcon, "x");
          const nameInput = box.createEl("input", {
            type: "text",
            value: skill.name,
            cls: "quest-detail-title-input quest-modal-title"
          });
          const descBox = box.createEl("textarea", {
            text: skill.description || "",
            cls: "quest-detail-desc",
            attr: { placeholder: "No description." }
          });
          descBox.style.height = "auto";
          descBox.style.height = descBox.scrollHeight + "px";
          const xpInfo = _QuestLogView2.getSkillXpProgress(skill, difficulty);
          const levelSection = box.createEl("div", { cls: "skill-level-section" });
          const levelRow = levelSection.createEl("div", { cls: "skill-level-row" });
          levelRow.createEl("span", { text: "Level", cls: "skill-level-label" });
          levelRow.createEl("span", {
            text: skill.legendary ? `\u2605 ${skill.level}` : `${skill.level}`,
            cls: "skill-level-value"
          });
          const skillXpBar = levelSection.createEl("div", { cls: "skill-detail-xp-bar" });
          const skillXpFill = skillXpBar.createEl("div", { cls: "skill-detail-xp-fill" });
          skillXpFill.style.width = `${xpInfo.pct}%`;
          levelSection.createEl("span", {
            text: `${xpInfo.xpProgress.toLocaleString()} / ${xpInfo.xpNeeded.toLocaleString()} XP`,
            cls: "skill-xp-progress-text"
          });
          const selectedQuestIds = this.attachLinkedPicker(box, {
            kind: "quest",
            label: "attach quests",
            emptyText: "no quests attached",
            initialIds: this.idsLinkedToSkill(skill.id, "quest")
          });
          const selectedHabitIds = this.attachLinkedPicker(box, {
            kind: "habit",
            label: "attach habits",
            emptyText: "no habits attached",
            initialIds: this.idsLinkedToSkill(skill.id, "habit")
          });
          const saveSkill = /* @__PURE__ */ __name(async () => {
            const previousName = skill.name;
            skill.name = nameInput.value.trim() || skill.name;
            skill.description = descBox.value.trim();
            this.syncSkillLinks(skill.id, selectedQuestIds, selectedHabitIds);
            await this.plugin.saveSettings();
            this.renderSkillList(this._skillListContainer);
            if (this._questListContainer) this.renderQuestList(this._questListContainer);
            if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
          }, "saveSkill");
          closeBtn.addEventListener("click", async () => {
            await saveSkill();
            overlay.removeClass("open");
          });
        }
        // ----------------------------------------
        // HABIT DETAIL VIEW
        // ----------------------------------------
        openHabitDetail(habit) {
          this.openDetailModal({ type: "habit", item: habit });
        }
        // ----------------------------------------
        // COMPLETED LIST RENDERING (Quests + Habits merged)
        // ----------------------------------------
        renderCompletedList(container) {
          container.empty();
          const completedQuests = (this.plugin.settings.completedQuests || []).map((q) => ({
            ...q,
            _type: "quest"
          }));
          const completedHabits = (this.plugin.settings.completedHabits || []).map((h) => ({
            ...h,
            _type: "habit"
          }));
          const allCompleted = [...completedQuests, ...completedHabits];
          if (allCompleted.length === 0) {
            container.createEl("div", {
              text: "No completed quests or habits yet.",
              cls: "quest-list-empty"
            });
            return;
          }
          const sorted = [...allCompleted].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
          sorted.forEach((item) => {
            const block = container.createEl("div", { cls: "completed-block" });
            const titleText = item._type === "habit" ? `${item.title} \u{1F504}` : item.title;
            block.createEl("div", {
              text: titleText,
              cls: "completed-block-title"
            });
            const meta = block.createEl("div", { cls: "completed-block-meta" });
            meta.createEl("span", {
              text: `${item.xp.toLocaleString()} XP`,
              cls: "completed-block-xp"
            });
            meta.createEl("span", {
              text: item._type === "habit" ? "Habit" : "Quest",
              cls: `completed-block-type type-${item._type === "habit" ? "habit" : "quest"}`
            });
            meta.createEl("span", {
              text: _QuestLogView2.formatDate(item.completedAt),
              cls: "completed-block-date"
            });
            block.addEventListener("click", () => {
              if (item._type === "habit") {
                this.openCompletedHabitDetail(item);
              } else {
                this.openCompletedDetail(item);
              }
            });
          });
        }
        // ----------------------------------------
        // COMPLETED QUEST DETAIL (READ-ONLY)
        // ----------------------------------------
        openCompletedDetail(quest) {
          const overlay = this._detailOverlay;
          const box = this._detailBox;
          this.drainSliders(box);
          box.empty();
          box.removeClass("habit-context");
          box.removeClass("skill-context");
          box.removeClass("quest-context");
          box.addClass("quest-context");
          overlay.addClass("open");
          box.createEl("h2", {
            text: quest.title,
            cls: "quest-detail-title"
          });
          if (quest.description) {
            box.createEl("p", {
              text: quest.description,
              cls: "quest-detail-desc quest-detail-desc-plain"
            });
          }
          const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
          const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
          const rows = [
            ["XP Earned", quest.xp.toLocaleString()],
            ["Difficulty", stars2(quest.difficulty)],
            ["Urgency", stars2(quest.urgency)],
            ["Impact", stars2(quest.impact)],
            ["Created", _QuestLogView2.formatDate(quest.created)],
            ["Completed", _QuestLogView2.formatDate(quest.completedAt)]
          ];
          this.fillStatsTable(statsTable, rows);
          const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
          btnRow.style.justifyContent = "center";
          const closeBtn = btnRow.createEl("button", {
            text: "Close",
            cls: "quest-detail-close-btn"
          });
          closeBtn.addEventListener("click", () => {
            overlay.removeClass("open");
          });
          const undoBtn = btnRow.createEl("button", {
            text: "Undo Completion",
            cls: "quest-undo-btn"
          });
          undoBtn.addEventListener("click", async () => {
            const idx = this.plugin.settings.completedQuests.findIndex((q) => q.id === quest.id);
            if (idx === -1) {
              new obsidianNS.Notice("Quest not found.");
              overlay.removeClass("open");
              return;
            }
            const [restored] = this.plugin.settings.completedQuests.splice(idx, 1);
            const hadNote = await retireNote(
              this.plugin,
              questNotePaths(this.plugin, restored, this.plugin.settings.completedQuests.concat([restored]), this.plugin.settings.completedFolderPath || "Quest Log/Completed")
            );
            const { completedAt, ...activeQuest } = restored;
            this.plugin.settings.quests.push(activeQuest);
            this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - restored.xp);
            this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
            const coins = Math.max(1, Math.min(50, Math.round(restored.xp / 1e4)));
            this.plugin.settings.coins = Math.max(0, (this.plugin.settings.coins || 0) - coins);
            this.revokeSkillXp(restored.xp, restored.skillIds);
            await this.plugin.saveSettings();
            if (hadNote) await writeQuestFile(this.plugin, activeQuest);
            overlay.removeClass("open");
            this.updateHeader();
            this.renderCompletedList(this._completedListContainer);
            this.renderQuestList(this._questListContainer);
            new obsidianNS.Notice(`Quest restored: ${restored.title}`);
          });
        }
        // ----------------------------------------
        // COMPLETED HABIT DETAIL (with Undo)
        // ----------------------------------------
        openCompletedHabitDetail(habit) {
          const overlay = this._detailOverlay;
          const box = this._detailBox;
          this.drainSliders(box);
          box.empty();
          box.removeClass("habit-context");
          box.removeClass("skill-context");
          box.removeClass("quest-context");
          box.addClass("habit-context");
          overlay.addClass("open");
          box.createEl("h2", {
            text: habit.title,
            cls: "quest-detail-title"
          });
          if (habit.description) {
            box.createEl("p", {
              text: habit.description,
              cls: "quest-detail-desc quest-detail-desc-plain"
            });
          }
          const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
          const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
          const rows = [
            ["XP Earned", habit.xp.toLocaleString()],
            ["Difficulty", stars2(habit.difficulty)],
            ["Urgency", stars2(habit.urgency)],
            ["Impact", stars2(habit.impact)],
            ["Type", "Habit (Repeatable)"],
            ["Completed", _QuestLogView2.formatDate(habit.completedAt)]
          ];
          this.fillStatsTable(statsTable, rows);
          const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
          btnRow.style.justifyContent = "center";
          const closeBtn = btnRow.createEl("button", {
            text: "Close",
            cls: "quest-detail-close-btn"
          });
          closeBtn.addEventListener("click", () => {
            overlay.removeClass("open");
          });
          const undoBtn = btnRow.createEl("button", {
            text: "Undo Completion",
            cls: "quest-undo-btn"
          });
          undoBtn.addEventListener("click", async () => {
            const idx = this.plugin.settings.completedHabits.findIndex(
              (h) => h.id === habit.id && h.completedAt === habit.completedAt
            );
            if (idx === -1) {
              new obsidianNS.Notice("Completed habit not found.");
              overlay.removeClass("open");
              return;
            }
            this.plugin.settings.completedHabits.splice(idx, 1);
            await retireNote(this.plugin, [completedHabitNotePath(this.plugin, habit, habit.completedAt)]);
            this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
            this.revokeSkillXp(habit.xp, habit.skillIds);
            await this.plugin.saveSettings();
            overlay.removeClass("open");
            this.updateHeader();
            this.renderCompletedList(this._completedListContainer);
            new obsidianNS.Notice(`Habit completion undone: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
          });
        }
        async onClose() {
          this.drainSliders();
          this._sliders = null;
        }
      };
      __name(_QuestLogView, "QuestLogView");
      _QuestLogView.getXpMultiplier = Xp.getXpMultiplier.bind(Xp);
      _QuestLogView.getXpForLvl = Xp.getXpForLvl.bind(Xp);
      _QuestLogView.getLevel = Xp.getLevel.bind(Xp);
      _QuestLogView.xpProgress = Xp.xpProgress.bind(Xp);
      _QuestLogView.generateXpCurveTable = Xp.generateXpCurveTable.bind(Xp);
      _QuestLogView.getNextMilestones = Xp.getNextMilestones.bind(Xp);
      _QuestLogView.getSkillXpForLvl = Xp.getSkillXpForLvl.bind(Xp);
      _QuestLogView.getSkillLevel = Xp.getSkillLevel.bind(Xp);
      _QuestLogView.getSkillXpProgress = Xp.getSkillXpProgress.bind(Xp);
      _QuestLogView.DIFFICULTY_LABELS = Xp.DIFFICULTY_LABELS;
      _QuestLogView.URGENCY_LABELS = Xp.URGENCY_LABELS;
      _QuestLogView.IMPACT_LABELS = Xp.IMPACT_LABELS;
      _QuestLogView.calcXp = Xp.calcXp.bind(Xp);
      _QuestLogView.getLevelTitle = Xp.getLevelTitle.bind(Xp);
      _QuestLogView.safeName = safeName;
      _QuestLogView.formatDate = formatDate;
      _QuestLogView.formatHabitTimestamp = formatHabitTimestamp;
      _QuestLogView.writeSidecarAtomic = writeSidecarAtomic;
      var QuestLogView = _QuestLogView;
      return { QuestLogView, QUESTLOG_VIEW_TYPE: QUESTLOG_VIEW_TYPE2, Xp, loadSnapshot };
    }
    module2.exports = {
      QUESTLOG_VIEW_TYPE: QUESTLOG_VIEW_TYPE2,
      registerQuestLogView: registerQuestLogView2,
      loadSnapshot,
      createRenderModule
    };
  }
});

// src/main.js
var { Plugin } = require("obsidian");
var { migrateIfNeeded, beginSaveBatch, endSaveBatch } = require_storage();
var {
  loadSettings,
  saveSettings,
  createSettingTabModule
} = require_settings();
var quests = require_quests();
var habits = require_habits();
var skills = require_skills();
var profile = require_profile();
var { QUESTLOG_VIEW_TYPE, registerQuestLogView } = require_render();
async function hydrateSettingsMirror(plugin) {
  const settings = await loadSettings(plugin);
  const prof = await profile.loadProfile(plugin);
  const activeQuests = await quests.listActive(plugin);
  const completedQuests = await quests.listCompleted(plugin);
  const activeHabits = await habits.listActive(plugin);
  const completedHabits = await habits.listCompleted(plugin);
  const skillList = await skills.listSkills(plugin);
  plugin.settings = {
    ...settings,
    ...prof,
    quests: activeQuests,
    completedQuests,
    habits: activeHabits,
    completedHabits,
    skills: skillList
  };
  return plugin.settings;
}
async function persistSettingsMirror(plugin) {
  const s = plugin.settings || {};
  beginSaveBatch(plugin);
  try {
    await saveSettings(plugin, {
      rewardsMode: s.rewardsMode,
      userProfileFileName: s.userProfileFileName,
      userProfileFolder: s.userProfileFolder,
      questsFolderPath: s.questsFolderPath,
      habitsFolderPath: s.habitsFolderPath,
      skillsFolderPath: s.skillsFolderPath,
      completedFolderPath: s.completedFolderPath,
      userDifficulty: s.userDifficulty,
      skillDifficulty: s.skillDifficulty,
      showXpCurvePreview: s.showXpCurvePreview
    });
    await profile.saveProfile(plugin, {
      heroName: s.heroName,
      currentXp: s.currentXp,
      questsCompleted: s.questsCompleted,
      coins: s.coins,
      rewards: s.rewards
    });
    await quests.saveActive(plugin, s.quests || []);
    await quests.saveCompleted(plugin, s.completedQuests || []);
    await habits.saveActive(plugin, s.habits || []);
    await habits.saveCompleted(plugin, s.completedHabits || []);
    await skills.saveSkills(plugin, s.skills || []);
  } finally {
    await endSaveBatch(plugin);
  }
}
var QuestLogPlugin = class extends Plugin {
  async onload() {
    this._levelCache = null;
    await migrateIfNeeded(this);
    await hydrateSettingsMirror(this);
    this.loadQuestSettings = () => loadSettings(this);
    this.saveQuestSettings = (settings) => saveSettings(this, settings);
    this.quests = quests;
    this.habits = habits;
    this.skills = skills;
    this.profile = profile;
    const obsidian = require("obsidian");
    const { QuestLogSettingTab } = createSettingTabModule(obsidian);
    this.addSettingTab(new QuestLogSettingTab(this.app, this));
    registerQuestLogView(this, obsidian);
    this.addRibbonIcon("gamepad", "Quest Log", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-quest-log",
      name: "Open Quest Log",
      callback: () => {
        void this.activateView();
      }
    });
  }
  onunload() {
    this._levelCache = null;
  }
  async loadSettings() {
    return hydrateSettingsMirror(this);
  }
  async saveSettings() {
    await persistSettingsMirror(this);
    this.invalidateLevelCache();
  }
  invalidateLevelCache() {
    this._levelCache = null;
  }
  getLevel() {
    const difficulty = this.settings && this.settings.userDifficulty || 10;
    const xp = this.settings && this.settings.currentXp || 0;
    if (this._levelCache && this._levelCache.xp === xp && this._levelCache.d === difficulty) {
      return this._levelCache.level;
    }
    const level = profile.getLevel(xp, difficulty);
    this._levelCache = { xp, d: difficulty, level };
    return level;
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeaf(true);
      await newLeaf.setViewState({ type: QUESTLOG_VIEW_TYPE, active: true });
      leaf = newLeaf;
    }
    workspace.revealLeaf(leaf);
  }
  async onExternalSettingsChange() {
    await hydrateSettingsMirror(this);
    this.invalidateLevelCache();
    const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view && typeof leaf.view.refreshListsAndHeader === "function") {
        leaf.view.refreshListsAndHeader();
      }
    }
  }
};
module.exports = QuestLogPlugin;
module.exports.default = QuestLogPlugin;
module.exports.hydrateSettingsMirror = hydrateSettingsMirror;
module.exports.persistSettingsMirror = persistSettingsMirror;
module.exports.QuestLogPlugin = QuestLogPlugin;
module.exports.QUESTLOG_VIEW_TYPE = QUESTLOG_VIEW_TYPE;
