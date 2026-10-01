/**
 * Quest Log — live sync of external data.json changes (0.6.52).
 *
 * Problem: sync (phone / other computer / external edit) rewrites .../quest-log/data.json but the open
 * Quest Log kept showing its in-memory copy until the plugin was reloaded.
 *
 * Mechanisms (mobile-safe: Obsidian vault/adapter API only — no fs/chokidar/require("fs")):
 *   1. vault.on("modify" | "create") for the data.json path (covers it if Obsidian fires it).
 *   2. vault.on("raw") (adapter-level, fires for dotfolder paths such as .obsidian/…) — guarded; absent → skipped.
 *   3. Poll fallback: adapter.stat() every POLL_MS (1500 ms) while a Quest Log view is open and the document is
 *      visible. Only when mtime/size changed (or a deferred change is pending) does it read the file.
 *   4. Forced content check on window focus / document visibility regained, on view open, and in activateView.
 * All paths feed ONE debounced (DEBOUNCE_MS), single-flight check(). Truth is file CONTENT (text compare,
 * canonical-JSON compare), never mtime — so granularity / rewound mtimes / duplicate events are harmless.
 *
 * Own-write tracking: after every save we read the file back; if it equals what we wrote it becomes the new
 * "synced" baseline (text + parsed). Any later event/poll whose text equals the baseline is a no-op → no reload,
 * no render, no loop. Reload never triggers a save.
 *
 * Clobber guard (beforeSave): if disk != baseline when a save is about to run, memory is stale relative to disk.
 * CHOICE: 3-way merge (baseline, memory, disk) and write the MERGE — disk-only changes (phone-added quests,
 * completions …) survive, our pending mutation is re-applied on top; if the merge equals disk nothing is written.
 * Merge rules are in mergeBlobs(). Afterwards the watcher adopts disk into memory when the UI is idle.
 *
 * Defer: adoption into memory + re-render is deferred while the view is busy (any modal/popup/overlay input,
 * focused text field, open skill-graph picker). The pending change is applied by a later tick once idle.
 * Invalid/empty/partial JSON is ignored and retried on the next event/tick.
 */
"use strict";

const { dataJsonPath, adoptBlob, peekBlob, normalizeLoadedBlob, runExclusive, ARRAY_BLOB_TO_DOMAIN } = require("./storage");

const POLL_MS = 1500;
const DEBOUNCE_MS = 250;
/** Numeric profile counters merged additively (disk + my delta) so XP/coins earned on two devices both count. */
const ADDITIVE_KEYS = Object.freeze(["currentXp", "coins", "questsCompleted"]);
/** Arrays merged by item id. `rewards` lives in the profile slice but is an id list too. */
const ID_ARRAY_KEYS = Object.freeze([...Object.keys(ARRAY_BLOB_TO_DOMAIN), "rewards"]);

/** Canonical (key-sorted) JSON — order/whitespace independent equality. */
function canon(v) {
  return JSON.stringify(sortKeys(v));
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] !== undefined) out[k] = sortKeys(v[k]);
    }
    return out;
  }
  return v;
}
/**
 * Canonical JSON that ignores DERIVED skill `level` (render recomputes skill.level from xp in place — see
 * getSkillXpProgress — so that normalisation must not look like an unsaved user mutation or a divergence from disk).
 */
function canonD(v) {
  if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.skills)) {
    const c = Object.assign({}, v);
    c.skills = v.skills.map(stripLevel);
    return canon(c);
  }
  return canon(v);
}
function stripLevel(it) {
  if (it && typeof it === "object" && !Array.isArray(it)) {
    const c = Object.assign({}, it);
    delete c.level;
    return c;
  }
  return it;
}
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * 3-way merge of god blobs. Pure; returns a new blob.
 *  - id arrays: start from DISK order; mem-removed items dropped; mem-added items appended;
 *    item changed by mem (vs base) → mem version; else disk version; disk-removed + mem-edited → removal wins
 *    (avoids resurrecting an item completed elsewhere → no duplicate in completed lists).
 *  - currentXp / coins / questsCompleted: disk + (mem - base), floored at 0.
 *  - other scalars: mem if mem changed it vs base, else disk.
 * @param {object} base  blob memory last synced from disk
 * @param {object} mem   current in-memory blob
 * @param {object} disk  current disk blob
 */
function mergeBlobs(base, mem, disk) {
  const out = clone(disk);
  const b = base || {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(mem), ...Object.keys(disk)])) {
    if (ID_ARRAY_KEYS.includes(key)) {
      out[key] = mergeIdArray(b[key], mem[key], disk[key], key === "skills");
    } else if (ADDITIVE_KEYS.includes(key)) {
      const bv = Number(b[key]) || 0;
      const mv = Number(mem[key]) || 0;
      const dv = Number(disk[key]) || 0;
      if (mem[key] === undefined && disk[key] === undefined) continue;
      out[key] = Math.max(0, dv + (mv - bv));
    } else if (canon(mem[key]) !== canon(b[key])) {
      if (mem[key] === undefined) delete out[key];
      else out[key] = clone(mem[key]);
    }
  }
  out.store = disk.store || mem.store || out.store;
  return out;
}

function mergeIdArray(baseArr, memArr, diskArr, derivedLevel) {
  const cmp = derivedLevel ? (x) => canon(stripLevel(x)) : canon;
  const base = Array.isArray(baseArr) ? baseArr : [];
  const mem = Array.isArray(memArr) ? memArr : [];
  const disk = Array.isArray(diskArr) ? diskArr : [];
  const idOf = (it) => (it && typeof it === "object" && it.id != null ? String(it.id) : "~" + canon(it));
  const map = (arr) => {
    const m = new Map();
    for (const it of arr) m.set(idOf(it), it);
    return m;
  };
  const bm = map(base), mm = map(mem), dm = map(disk);
  const out = [];
  const seen = new Set();
  for (const it of disk) {
    const id = idOf(it);
    if (seen.has(id)) continue;
    seen.add(id);
    const inBase = bm.has(id), inMem = mm.has(id);
    if (inBase && !inMem) continue; // I deleted/completed it
    if (inBase && inMem && cmp(mm.get(id)) !== cmp(bm.get(id))) out.push(clone(mm.get(id))); // I edited it
    else out.push(clone(it));
  }
  for (const it of mem) {
    const id = idOf(it);
    if (seen.has(id)) continue;
    if (!bm.has(id) && !dm.has(id)) {
      seen.add(id);
      out.push(clone(it)); // I added it
    }
    // in base but not on disk: removed elsewhere → stays removed
  }
  return out;
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @param {{hydrate:()=>Promise<*>, refresh:()=>void, isBusy:()=>boolean, hasOpenViews:()=>boolean}} hooks
 * @param {{pollMs?:number, debounceMs?:number}} [opts]
 */
function createLiveSync(plugin, hooks, opts) {
  const o = opts || {};
  const pollMs = o.pollMs || POLL_MS;
  const debounceMs = o.debounceMs || DEBOUNCE_MS;
  const path = dataJsonPath(plugin);
  const g = globalThis;

  /** disk state memory reflects: { text, parsed } */
  let synced = null;
  let lastSig = null;
  let pending = null; // { text, parsed } valid external state not yet adopted
  let running = null;
  let rerun = false;
  let stopped = true;
  let timer = null;
  let interval = null;
  let mergeInfo = null;
  const refs = [];
  const domHandlers = [];
  const stats = { events: 0, polls: 0, statCalls: 0, reads: 0, reloads: 0, noops: 0, deferred: 0, ignoredInvalid: 0, mergedSaves: 0, mergeWrites: 0, ownWrites: 0 };

  const adapter = () => plugin.app && plugin.app.vault && plugin.app.vault.adapter;
  const flushing = () => (plugin._qlPendingFlush || 0) > 0 || Boolean(plugin._qlDeferSave);

  async function statSig() {
    stats.statCalls++;
    try {
      const st = await adapter().stat(path);
      return st ? `${st.mtime}:${st.size}` : null;
    } catch (_e) {
      return null;
    }
  }

  /** @returns {Promise<{state:'ok'|'missing'|'invalid', text?:string, parsed?:object}>} */
  async function readDisk() {
    stats.reads++;
    let text;
    try {
      text = await adapter().read(path);
    } catch (_e) {
      return { state: "missing" };
    }
    if (typeof text !== "string" || text.trim() === "") return { state: "invalid" };
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      return { state: "invalid" };
    }
    // Shape check: must look like a Quest Log god blob (marker or at least one known array/key).
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { state: "invalid" };
    const looksRight = parsed.store === "data.json" || ID_ARRAY_KEYS.some((k) => Array.isArray(parsed[k]));
    if (!looksRight) return { state: "invalid" };
    return { state: "ok", text, parsed: normalizeLoadedBlob(parsed) };
  }

  function setSynced(text, parsed) {
    synced = { text, parsed: clone(parsed) };
  }

  /** Called once after migrate: memory := disk, record baseline. */
  async function baseline() {
    const d = await readDisk();
    if (d.state !== "ok") return false;
    adoptBlob(plugin, clone(d.parsed));
    setSynced(d.text, d.parsed);
    lastSig = await statSig();
    return true;
  }

  function schedule(ms, reason) {
    if (stopped) return;
    if (timer) g.clearTimeout(timer);
    timer = g.setTimeout(() => {
      timer = null;
      void check(reason || "event");
    }, ms == null ? debounceMs : ms);
  }

  function check(reason) {
    if (stopped) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerun = false;
          await checkOnce(reason);
        } while (rerun && !stopped);
      } catch (_e) {
        /* never let a sync hiccup break the plugin */
      } finally {
        running = null;
      }
    })();
    return running;
  }

  async function checkOnce(reason) {
    if (flushing()) {
      schedule(debounceMs, reason); // our own save is in flight; re-check after it recorded itself
      return;
    }
    let sig = null;
    if (reason === "poll") {
      stats.polls++;
      sig = await statSig();
      if (sig == null) return; // deleted / mid-rename: keep state, try next tick
      if (sig === lastSig) {
        if (pending) await applyPending();
        return;
      }
      // changed on disk: go through the SAME debounce as events so a burst (sync writing in chunks) is read once
      lastSig = sig;
      schedule(debounceMs, "poll-changed");
      return;
    }
    const d = await readDisk();
    if (stopped) return;
    if (d.state !== "ok") {
      stats.ignoredInvalid++;
      lastSig = null; // force the next poll tick / event to look again
      return; // keep current state (partial / empty / garbage / deleted file)
    }
    if (sig == null) sig = await statSig();
    lastSig = sig;
    if (synced && (d.text === synced.text || canonD(d.parsed) === canonD(synced.parsed))) {
      if (synced) synced.text = d.text;
      pending = null;
      stats.noops++;
      return;
    }
    pending = { text: d.text, parsed: d.parsed };
    await applyPending();
  }

  async function applyPending() {
    if (!pending || stopped) return;
    if (flushing() || hooks.isBusy()) {
      stats.deferred++;
      return;
    }
    const p = pending;
    pending = null;
    let applied = false;
    await runExclusive(plugin, async () => {
      if (stopped) return;
      const mem = peekBlob(plugin);
      let target = p.parsed;
      let text = p.text;
      if (synced && mem && canonD(mem) !== canonD(synced.parsed)) {
        // memory holds changes disk doesn't know about → merge and write ONCE, then adopt the merge
        const merged = mergeBlobs(synced.parsed, mem, p.parsed);
        if (canonD(merged) !== canonD(p.parsed)) {
          await plugin.saveData(merged);
          stats.mergeWrites++;
          const rb = await readDisk();
          if (rb.state === "ok" && canonD(rb.parsed) === canonD(merged)) {
            target = rb.parsed;
            text = rb.text;
          } else {
            return; // disk moved again; next tick handles it
          }
        }
      }
      adoptBlob(plugin, clone(target));
      setSynced(text, target);
      lastSig = await statSig();
      await hooks.hydrate();
      applied = true;
    });
    if (applied) {
      stats.reloads++;
      hooks.refresh();
    }
  }

  // ---- hooks called by storage.flushBlob (inside runExclusive) -------------------------------------------------
  /** @param {object} mem current in-memory blob @returns {Promise<{blob?:object, skipWrite?:boolean}>} */
  async function beforeSave(mem) {
    mergeInfo = null;
    if (!synced || stopped) return {};
    let d = await readDisk();
    for (let i = 0; i < 3 && d.state === "invalid"; i++) {
      await new Promise((r) => g.setTimeout(r, 200)); // partial file mid-sync? give it a moment
      d = await readDisk();
    }
    if (d.state !== "ok") return {}; // missing / still unusable → plain write (nothing valid to protect)
    if (d.text === synced.text || canonD(d.parsed) === canonD(synced.parsed)) return {};
    const merged = mergeBlobs(synced.parsed, mem, d.parsed);
    stats.mergedSaves++;
    const nums = {};
    for (const k of ADDITIVE_KEYS) nums[k] = mem[k];
    mergeInfo = { nums };
    return { blob: merged, skipWrite: canonD(merged) === canonD(d.parsed) };
  }

  async function afterSave(out, info) {
    if (stopped) return;
    if (mergeInfo) {
      // Disk now holds merge(disk, mine). Memory is still the stale mirror: keep the 3-way base but fold my numeric
      // deltas into it so a repeated merge (while adoption is deferred) cannot double-count them.
      for (const k of ADDITIVE_KEYS) if (mergeInfo.nums[k] !== undefined && synced) synced.parsed[k] = mergeInfo.nums[k];
      mergeInfo = null;
      lastSig = null;
      schedule(50, "merge");
      return;
    }
    const d = await readDisk();
    if (d.state === "ok" && canon(d.parsed) === canon(out)) {
      setSynced(d.text, d.parsed);
      lastSig = await statSig();
      stats.ownWrites++;
    } else {
      // someone else touched the file between our write and the read-back: let the watcher sort it out
      lastSig = null;
      schedule(debounceMs, "own-write-race");
    }
  }

  // ---- lifecycle ------------------------------------------------------------------------------------------------
  function onVaultEvent(fileOrPath) {
    const p = typeof fileOrPath === "string" ? fileOrPath : fileOrPath && fileOrPath.path;
    if (p !== path) return;
    stats.events++;
    schedule(debounceMs, "event");
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    const vault = plugin.app && plugin.app.vault;
    if (vault && typeof vault.on === "function") {
      for (const name of ["modify", "create", "raw"]) {
        try {
          const ref = vault.on(name, onVaultEvent);
          if (ref) {
            refs.push(ref);
            if (typeof plugin.registerEvent === "function") plugin.registerEvent(ref);
          }
        } catch (_e) {
          /* event name unsupported on this platform/version → poll fallback covers it */
        }
      }
    }
    interval = g.setInterval(() => {
      if (stopped) return;
      if (g.document && g.document.hidden) return; // no polling while backgrounded (battery)
      if (!hooks.hasOpenViews()) return;
      void check("poll");
    }, pollMs);
    if (typeof plugin.registerInterval === "function") plugin.registerInterval(interval);
    const doc = g.document;
    if (doc && doc.addEventListener) {
      const onVis = () => {
        if (!doc.hidden) void check("visible");
      };
      const onFocus = () => void check("focus");
      doc.addEventListener("visibilitychange", onVis);
      g.addEventListener && g.addEventListener("focus", onFocus);
      domHandlers.push(["doc", "visibilitychange", onVis], ["win", "focus", onFocus]);
    }
  }

  function stop() {
    stopped = true;
    const vault = plugin.app && plugin.app.vault;
    for (const ref of refs.splice(0)) {
      try {
        vault.offref(ref);
      } catch (_e) {
        /* ignore */
      }
    }
    if (interval) g.clearInterval(interval);
    interval = null;
    if (timer) g.clearTimeout(timer);
    timer = null;
    for (const [w, ev, fn] of domHandlers.splice(0)) {
      try {
        (w === "doc" ? g.document : g).removeEventListener(ev, fn);
      } catch (_e) {
        /* ignore */
      }
    }
    pending = null;
  }

  return {
    start,
    stop,
    baseline,
    /** Force an immediate content check (view open / activateView). Resolves after the check (and adoption). */
    checkNow: (reason) => check(reason || "manual"),
    beforeSave,
    afterSave,
    stats,
    pollMs,
    debounceMs,
    isStopped: () => stopped,
    hasPending: () => Boolean(pending),
    _state: () => ({ synced, lastSig, pending }),
  };
}

module.exports = { createLiveSync, mergeBlobs, canon, canonD, POLL_MS, DEBOUNCE_MS };
