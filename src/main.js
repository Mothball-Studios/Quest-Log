/**
 * Quest Log — modular plugin entry (W6/W7).
 * Bundled by esbuild to root main.js (external: obsidian).
 */

const { Plugin } = require("obsidian");
const { migrateIfNeeded, beginSaveBatch, endSaveBatch } = require("./storage");
const { createLiveSync, canonD } = require("./sync");
const {
  loadSettings,
  saveSettings,
  createSettingTabModule,
} = require("./settings");
const quests = require("./quests");
const habits = require("./habits");
const skills = require("./skills");
const profile = require("./profile");
const { QUESTLOG_VIEW_TYPE, registerQuestLogView } = require("./render");

/**
 * Mirror domain data onto `plugin.settings` so the ItemView can read one object.
 * @param {import('obsidian').Plugin} plugin
 */
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
    skills: skillList,
  };
  plugin._qlMirrorSig = mirrorSig(plugin);
  return plugin.settings;
}

/**
 * 0.6.52 — signature of the data-bearing part of the settings mirror. Recorded after every hydrate/persist;
 * if it differs at adoption time the mirror holds a mutation that has not been saved yet → live-sync defers
 * (never replaces the mirror under an in-flight edit).
 * @param {import('obsidian').Plugin} plugin
 */
function mirrorSig(plugin) {
  const s = plugin.settings || {};
  const out = {};
  for (const k of Object.keys(s)) out[k] = s[k];
  return canonD(out);
}

/**
 * Persist mirror back out to domain files via domain modules.
 * @param {import('obsidian').Plugin} plugin
 */
async function persistSettingsMirror(plugin) {
  const s = plugin.settings || {};
  // One Plugin.saveData for the whole mirror (single data.json).
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
      showXpCurvePreview: s.showXpCurvePreview,
    });
    await profile.saveProfile(plugin, {
      heroName: s.heroName,
      currentXp: s.currentXp,
      questsCompleted: s.questsCompleted,
      coins: s.coins,
      rewards: s.rewards,
    });
    await quests.saveActive(plugin, s.quests || []);
    await quests.saveCompleted(plugin, s.completedQuests || []);
    await habits.saveActive(plugin, s.habits || []);
    await habits.saveCompleted(plugin, s.completedHabits || []);
    await skills.saveSkills(plugin, s.skills || []);
  } finally {
    await endSaveBatch(plugin);
  }
  plugin._qlMirrorSig = mirrorSig(plugin);
}

class QuestLogPlugin extends Plugin {
  async onload() {
    this._levelCache = null;
    await migrateIfNeeded(this);
    // 0.6.52 live-sync: baseline = what disk holds now; guards saves against clobbering newer disk data and
    // adopts external data.json changes (vault modify/raw + stat poll + Obsidian's onExternalSettingsChange).
    this._qlSync = createLiveSync(this, {
      hydrate: async () => {
        await hydrateSettingsMirror(this);
        this.invalidateLevelCache();
      },
      refresh: () => this.refreshOpenViews(),
      isBusy: () => this.isSyncBusy(),
      hasOpenViews: () => this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE).length > 0,
    });
    await this._qlSync.baseline();
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
    // 0.6.51 — one command per unified-overlay state (shows as "Quest Log: <name>" in the palette)
    this.addCommand({
      id: "open-reward-shop-overlay",
      name: "Open reward shop (overlay)",
      callback: () => {
        void this.openOverlayState("shop");
      },
    });
    this.addCommand({
      id: "open-skill-graph-overlay",
      name: "Open skill graph (overlay)",
      callback: () => {
        void this.openOverlayState("skill-graph");
      },
    });
    this.addCommand({
      id: "open-quest-log",
      name: "Open Quest Log",
      callback: () => {
        void this.activateView();
      },
    });
    this._qlSync.start();
  }

  onunload() {
    this._levelCache = null;
    if (this._qlSync) {
      this._qlSync.stop();
      this._qlSync = null;
    }
  }

  /** True while a Quest Log view is mid-edit (modal / popup / focused field) or the mirror has an unsaved mutation. */
  isSyncBusy() {
    if (this._qlMirrorSig !== mirrorSig(this)) return true;
    const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
    return leaves.some((l) => l.view && typeof l.view.isSyncBusy === "function" && l.view.isSyncBusy());
  }

  markMirrorClean() {
    this._qlMirrorSig = mirrorSig(this);
  }

  refreshOpenViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE)) {
      if (leaf.view && typeof leaf.view.refreshExternal === "function") leaf.view.refreshExternal();
    }
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
    const difficulty = (this.settings && this.settings.userDifficulty) || 10;
    const xp = (this.settings && this.settings.currentXp) || 0;
    if (this._levelCache && this._levelCache.xp === xp && this._levelCache.d === difficulty) {
      return this._levelCache.level;
    }
    const level = profile.getLevel(xp, difficulty);
    this._levelCache = { xp, d: difficulty, level };
    return level;
  }

  async activateView() {
    const { workspace } = this.app;
    if (this._qlSync) await this._qlSync.checkNow("activate");
    let leaf = workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeaf(true);
      await newLeaf.setViewState({ type: QUESTLOG_VIEW_TYPE, active: true });
      leaf = newLeaf;
    }
    workspace.revealLeaf(leaf);
  }

  /**
   * Activate the Quest Log view, then open a unified-overlay state on it ("shop" | "skill-graph").
   * @param {"shop"|"skill-graph"} stateId
   */
  async openOverlayState(stateId) {
    await this.activateView();
    const { workspace } = this.app;
    // onOpen() may still be finishing right after a fresh setViewState; wait briefly for the shell.
    for (let i = 0; i < 40; i++) {
      const leaf = workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE)[0];
      const view = leaf && leaf.view;
      if (view && view._overlayShell && typeof view.openOverlay === "function") {
        return view.openOverlay(stateId);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    new (require("obsidian").Notice)("Quest Log view is not ready yet; try again.");
    return false;
  }

  /** Obsidian calls this when it detects data.json changed on disk (Sync etc.). Same debounce-free content check. */
  async onExternalSettingsChange() {
    if (this._qlSync) await this._qlSync.checkNow("external-hook");
  }
}

module.exports = QuestLogPlugin;
module.exports.default = QuestLogPlugin;
module.exports.hydrateSettingsMirror = hydrateSettingsMirror;
module.exports.persistSettingsMirror = persistSettingsMirror;
module.exports.mirrorSig = mirrorSig;
module.exports.QuestLogPlugin = QuestLogPlugin;
module.exports.QUESTLOG_VIEW_TYPE = QUESTLOG_VIEW_TYPE;
