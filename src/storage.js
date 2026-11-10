/**
 * Quest Log — single data.json via Plugin.loadData / Plugin.saveData only.
 * All live state (settings, profile/XP, quests, habits, skills, completed) lives in
 * one god blob under `.obsidian/plugins/quest-log/data.json`.
 * Per-domain JSON files and `Quest Log/_store/` are migrate-read sources only;
 * after a successful merge they are left in place unread and never written.
 */

/** @typedef {'settings'|'active_quests'|'completed_quests'|'habits'|'completed_habits'|'skills'|'profile'} DomainName */

/** Abandoned vault-note store. Read-only migrate source; never write. */
const VAULT_STORE_DIR = "Quest Log/_store";

/** Legacy domain filenames (migrate-read only; not live save paths). */
const DOMAIN_FILES = Object.freeze({
  settings: "settings.json",
  active_quests: "active_quests.json",
  completed_quests: "completed_quests.json",
  habits: "habits.json",
  completed_habits: "completed_habits.json",
  skills: "skills.json",
  profile: "profile.json",
});

/** Empty defaults when a domain slice is missing. */
const DOMAIN_DEFAULTS = Object.freeze({
  settings: {},
  active_quests: [],
  completed_quests: [],
  habits: [],
  completed_habits: [],
  skills: [],
  profile: {},
});

/** Settings keys flattened onto the god blob. */
const SETTINGS_BLOB_KEYS = Object.freeze([
  "rewardsMode",
  "userProfileFileName",
  "userProfileFolder",
  "questsFolderPath",
  "habitsFolderPath",
  "skillsFolderPath",
  "completedFolderPath",
  "userDifficulty",
  "skillDifficulty",
  "showXpCurvePreview",
]);

/** Profile keys flattened onto the god blob. */
const PROFILE_BLOB_KEYS = Object.freeze([
  "heroName",
  "currentXp",
  "questsCompleted",
  "coins",
  "rewards",
]);

/** God-blob array key → domain name. */
const ARRAY_BLOB_TO_DOMAIN = Object.freeze({
  quests: "active_quests",
  completedQuests: "completed_quests",
  habits: "habits",
  completedHabits: "completed_habits",
  skills: "skills",
});

/** Domain name → god-blob array key (arrays only). */
const DOMAIN_TO_ARRAY_KEY = Object.freeze(
  Object.fromEntries(
    Object.entries(ARRAY_BLOB_TO_DOMAIN).map(([k, v]) => [v, k])
  )
);

/** Marker written into data.json after a successful domain→god merge. */
const STORE_MARKER = "data.json";

/** @type {WeakMap<object, object>} */
const blobCache = new WeakMap();

/**
 * Path to a leftover domain file under plugin.manifest.dir (migrate-read only).
 * @param {import('obsidian').Plugin} plugin
 * @param {DomainName} name
 */
function domainPath(plugin, name) {
  const file = DOMAIN_FILES[name];
  if (!file) throw new Error(`Unknown Quest Log domain: ${name}`);
  return `${plugin.manifest.dir}/${file}`;
}

/** @param {import('obsidian').Plugin} plugin */
function dataJsonPath(plugin) {
  return `${plugin.manifest.dir}/data.json`;
}

/**
 * Abandoned vault-store path. Migrate-read only.
 * @param {import('obsidian').Plugin} plugin
 * @param {DomainName} name
 */
function vaultStoreDomainPath(plugin, name) {
  void plugin;
  const file = DOMAIN_FILES[name];
  if (!file) throw new Error(`Unknown Quest Log domain: ${name}`);
  return `${VAULT_STORE_DIR}/${file}`;
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @param {string} fullPath
 */
async function pathExists(plugin, fullPath) {
  try {
    return await plugin.app.vault.adapter.exists(fullPath);
  } catch (_e) {
    return false;
  }
}

/**
 * Read JSON from adapter. Missing → fallback. Corrupt → throw.
 * @param {import('obsidian').Plugin} plugin
 * @param {string} fullPath
 * @param {*} fallback
 */
async function readJson(plugin, fullPath, fallback) {
  const adapter = plugin.app.vault.adapter;
  if (!(await pathExists(plugin, fullPath))) return fallback;
  const raw = await adapter.read(fullPath);
  if (raw == null || String(raw).trim() === "") return fallback;
  return JSON.parse(raw);
}

/**
 * True when an object looks like the monolithic god blob (has domain keys).
 * @param {*} blob
 */
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

/**
 * Extract one domain slice from a god blob.
 * @param {object} blob
 * @param {DomainName} name
 */
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

/**
 * Write one domain slice onto a god blob (mutates).
 * @param {object} blob
 * @param {DomainName} name
 * @param {*} data
 */
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

/** Richness score for profile (higher XP wins). */
function richnessProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return -1;
  const xp = Number(p.currentXp);
  if (Number.isFinite(xp) && xp > 0) return xp;
  // Non-empty but zero XP still beats missing.
  return Object.keys(p).length > 0 ? 0 : -1;
}

/** Richness score for array domains (more items wins). */
function richnessArray(a) {
  if (!Array.isArray(a)) return -1;
  return a.length;
}

/** Richness score for settings (more keys wins). */
function richnessSettings(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return -1;
  return Object.keys(s).length;
}

/**
 * Pick richer candidate. On tie, prefer earlier entry in `ranked` (plugin-dir first).
 * @param {Array<{value:*, source:string}>} ranked  richest-preferred order already applied via score; tie → first
 * @param {(v:*) => number} scoreFn
 */
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

/**
 * Build empty god blob with array defaults present (stable shape for Sync).
 */
function emptyGodBlob() {
  return {
    store: STORE_MARKER,
    quests: [],
    completedQuests: [],
    habits: [],
    completedHabits: [],
    skills: [],
  };
}

/**
 * Normalize a parsed data.json value into a god blob (marker + array keys guaranteed).
 * @param {*} loaded
 */
function normalizeLoadedBlob(loaded) {
  const blob =
    loaded && typeof loaded === "object" && !Array.isArray(loaded)
      ? { ...emptyGodBlob(), ...loaded, store: STORE_MARKER }
      : emptyGodBlob();
  for (const key of Object.keys(ARRAY_BLOB_TO_DOMAIN)) {
    if (!Array.isArray(blob[key])) blob[key] = [];
  }
  return blob;
}

/**
 * 0.6.52 live-sync — replace the in-memory god blob with a freshly parsed disk blob
 * (same normalization as the load path). Caller owns re-hydrating the settings mirror.
 * @param {import('obsidian').Plugin} plugin
 * @param {object} parsed  JSON.parse result of data.json (must not be shared with other holders)
 */
function adoptBlob(plugin, parsed) {
  const blob = normalizeLoadedBlob(parsed);
  blobCache.set(plugin, blob);
  return blob;
}

/**
 * 0.6.52 — serialize storage-affecting work (flushes + adoptions) per plugin.
 * @param {import('obsidian').Plugin} plugin
 * @param {() => Promise<*>} fn
 */
function runExclusive(plugin, fn) {
  const prev = plugin._qlChain || Promise.resolve();
  const next = prev.then(fn);
  plugin._qlChain = next.catch(() => {});
  return next;
}

/**
 * Load god blob via Plugin.loadData into cache.
 * @param {import('obsidian').Plugin} plugin
 */
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
  const blob = normalizeLoadedBlob(loaded);
  blobCache.set(plugin, blob);
  return blob;
}

/**
 * Persist god blob via Plugin.saveData only. No adapter domain-file writes.
 * @param {import('obsidian').Plugin} plugin
 * @param {object} [blob]
 */
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
  // 0.6.52 — serialized flush with clobber guard (see src/sync.js beforeSave/afterSave):
  // if data.json changed on disk since we last loaded/saved it, we MERGE (disk + our changes) instead of
  // overwriting; own writes are recorded so the watcher never reloads them.
  plugin._qlPendingFlush = (plugin._qlPendingFlush || 0) + 1;
  try {
    await runExclusive(plugin, async () => {
      const mem = blobCache.get(plugin) || next;
      let toWrite = mem;
      const sync = plugin._qlSync;
      let skip = false;
      if (sync && typeof sync.beforeSave === "function") {
        const r = await sync.beforeSave(mem);
        if (r && r.blob) {
          toWrite = r.blob; // merged (disk + my changes); memory (blobCache) stays as-is until the watcher adopts
          skip = Boolean(r.skipWrite);
        }
      }
      toWrite.store = STORE_MARKER;
      if (!skip) await plugin.saveData(toWrite);
      plugin._qlDirty = false;
      if (sync && typeof sync.afterSave === "function") await sync.afterSave(toWrite, { skipped: skip });
    });
  } finally {
    plugin._qlPendingFlush -= 1;
  }
}

/**
 * Begin a deferred multi-domain save (one saveData at end).
 * @param {import('obsidian').Plugin} plugin
 */
function beginSaveBatch(plugin) {
  plugin._qlDeferSave = true;
}

/**
 * Flush a deferred save batch.
 * @param {import('obsidian').Plugin} plugin
 */
async function endSaveBatch(plugin) {
  plugin._qlDeferSave = false;
  if (plugin._qlDirty) {
    await flushBlob(plugin);
  }
}

/**
 * Load one domain slice from the god blob (loadData).
 * @param {import('obsidian').Plugin} plugin
 * @param {DomainName} name
 */
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

/**
 * Save one domain slice into the god blob via saveData only.
 * Never writes settings.json / profile.json / etc.
 * @param {import('obsidian').Plugin} plugin
 * @param {DomainName} name
 * @param {*} data
 */
async function saveDomain(plugin, name, data) {
  if (!(name in DOMAIN_FILES)) {
    throw new Error(`Unknown Quest Log domain: ${name}`);
  }
  const blob = await getBlob(plugin);
  applyDomain(blob, name, data);
  await flushBlob(plugin, blob);
}

/**
 * Read a leftover domain file if present (migrate only).
 * @param {import('obsidian').Plugin} plugin
 * @param {string} fullPath
 * @param {*} fallback
 */
async function readDomainFileQuiet(plugin, fullPath, fallback) {
  try {
    if (!(await pathExists(plugin, fullPath))) return null;
    return await readJson(plugin, fullPath, fallback);
  } catch (_e) {
    return null;
  }
}

/**
 * Merge loadData ∪ plugin-dir domain files ∪ _store into one god blob.
 * Prefer richest non-empty; never overwrite good profile with empty.
 * Tie-break order (when equal richness): plugin-dir domain > loadData > _store.
 * @param {import('obsidian').Plugin} plugin
 * @param {object} existingBlob
 */
async function mergeSourcesIntoGod(plugin, existingBlob) {
  const god = emptyGodBlob();
  // Seed from existing loadData first (will lose to richer plugin-dir on conflict).
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

  const domains = /** @type {DomainName[]} */ (Object.keys(DOMAIN_FILES));

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

    // Tie-break: plugin-dir first, then loadData, then _store.
    const ranked = [
      { value: fromPlugin, source: "plugin-dir" },
      { value: fromLoad, source: "loadData" },
      { value: fromStore, source: "_store" },
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

/**
 * One-shot migrate (idempotent):
 * If data.json is already a marked god blob → leave leftover domain files unread.
 * Else merge loadData ∪ domain files ∪ _store (richest wins) and saveData once.
 * Never writes domain filenames; never deletes leftovers (don't wipe L25).
 *
 * @param {import('obsidian').Plugin} plugin
 * @returns {Promise<{ migrated: boolean, reason: string }>}
 */
async function migrateIfNeeded(plugin) {
  let loaded = null;
  if (typeof plugin.loadData === "function") {
    try {
      loaded = await plugin.loadData();
    } catch (_e) {
      loaded = null;
    }
  }

  // Already unified — do not re-read leftover domain JSON.
  if (
    loaded &&
    typeof loaded === "object" &&
    !Array.isArray(loaded) &&
    (loaded.store === STORE_MARKER || isGodBlob(loaded))
  ) {
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

  // Detect whether anything non-empty came from leftovers / blob.
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
  // Fresh install / empty — still wrote marked empty god blob.
  return { migrated: true, reason: "init-empty-god-blob" };
}

module.exports = {
  VAULT_STORE_DIR,
  DOMAIN_FILES,
  DOMAIN_DEFAULTS,
  SETTINGS_BLOB_KEYS,
  PROFILE_BLOB_KEYS,
  ARRAY_BLOB_TO_DOMAIN,
  DOMAIN_TO_ARRAY_KEY,
  STORE_MARKER,
  domainPath,
  dataJsonPath,
  vaultStoreDomainPath,
  loadDomain,
  saveDomain,
  migrateIfNeeded,
  isGodBlob,
  beginSaveBatch,
  endSaveBatch,
  flushBlob,
  getBlob,
  adoptBlob,
  peekBlob: (plugin) => blobCache.get(plugin) || null,
  normalizeLoadedBlob,
  runExclusive,
  readJson,
};
