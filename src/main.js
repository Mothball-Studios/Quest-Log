/**
 * Quest Log — modular plugin entry (W6/W7).
 * Bundled by esbuild to root main.js (external: obsidian).
 */

const { Plugin } = require("obsidian");
const { migrateIfNeeded, beginSaveBatch, endSaveBatch } = require("./storage");
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
  return plugin.settings;
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
}

class QuestLogPlugin extends Plugin {
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
      },
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
}

module.exports = QuestLogPlugin;
module.exports.default = QuestLogPlugin;
module.exports.hydrateSettingsMirror = hydrateSettingsMirror;
module.exports.persistSettingsMirror = persistSettingsMirror;
module.exports.QuestLogPlugin = QuestLogPlugin;
module.exports.QUESTLOG_VIEW_TYPE = QUESTLOG_VIEW_TYPE;
