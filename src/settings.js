/**
 * Quest Log — settings domain (W1).
 * Owns settings slice of data.json via src/storage.js. Setting tab UI is optional (needs Obsidian).
 * No quests/habits/skills/profile domain logic.
 */

const { loadDomain, saveDomain } = require("./storage");
const { generateXpCurveTable } = require("./profile");

const DOMAIN = "settings";

/** Defaults for settings.json only (not profile / list domains). */
const DEFAULT_SETTINGS = Object.freeze({
  rewardsMode: false,
  userProfileFileName: "User Profile",
  userProfileFolder: "Quest Log",
  questsFolderPath: "Quest Log/Quests",
  habitsFolderPath: "Quest Log/Habits",
  skillsFolderPath: "Quest Log/Skills",
  completedFolderPath: "Quest Log/Completed",
  userDifficulty: 10,
  skillDifficulty: 1,
  showXpCurvePreview: false,
});

const PATH_KEYS = Object.freeze([
  "questsFolderPath",
  "habitsFolderPath",
  "skillsFolderPath",
  "completedFolderPath",
  "userProfileFolder",
]);

/**
 * Merge stored settings over defaults.
 * @param {*} raw
 */
function normalizeSettings(raw) {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined) {
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

/** @param {*} n @param {number} fallback */
function clampDifficulty(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(1, Math.min(20, Math.round(v)));
}

/**
 * @param {import('obsidian').Plugin} plugin
 */
async function loadSettings(plugin) {
  const raw = await loadDomain(plugin, DOMAIN);
  return normalizeSettings(raw);
}

/**
 * @param {import('obsidian').Plugin} plugin
 * @param {object} settings
 */
async function saveSettings(plugin, settings) {
  const normalized = normalizeSettings(settings);
  await saveDomain(plugin, DOMAIN, normalized);
  return normalized;
}

/**
 * Patch settings and persist.
 * @param {import('obsidian').Plugin} plugin
 * @param {object} patch
 */
async function patchSettings(plugin, patch) {
  const current = await loadSettings(plugin);
  return saveSettings(plugin, { ...current, ...patch });
}

/**
 * Build PluginSettingTab class. Pass Obsidian exports from W7:
 *   const { QuestLogSettingTab } = createSettingTabModule(require("obsidian"));
 *   this.addSettingTab(new QuestLogSettingTab(this.app, this));
 *
 * Expects plugin.loadQuestSettings / plugin.saveQuestSettings OR falls back
 * to this module's loadSettings/saveSettings. Optional hooks:
 *   plugin.exportMarkdown?.()
 *   plugin.resetAllData?.()
 *   plugin.invalidateLevelCache?.()
 *
 * @param {{ PluginSettingTab: Function, Setting: Function }} obsidian
 */
function createSettingTabModule(obsidian) {
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
      return loadSettings(this.plugin);
    }

    async _save(settings) {
      if (typeof this.plugin.saveQuestSettings === "function") {
        return this.plugin.saveQuestSettings(settings);
      }
      return saveSettings(this.plugin, settings);
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
      new Setting(containerEl)
        .setName("Rewards Mode")
        .setDesc(
          "Toggle the Rewards feature to earn coins for completing quests! Spend coins in the Rewards Shop for IRL rewards for working hard!"
        )
        .addToggle((toggle) =>
          toggle.setValue(Boolean(settings.rewardsMode)).onChange(async (value) => {
            settings.rewardsMode = value;
            await this._save(settings);
            this._mirror(settings);
          })
        );

      containerEl.createEl("h3", { text: "XP Curve" });
      new Setting(containerEl)
        .setName("Show XP curve difficulty preview")
        .setDesc(
          "When on, shows a levels 1–5 XP table under each difficulty slider so you can see how the curve changes."
        )
        .addToggle((toggle) =>
          toggle.setValue(Boolean(settings.showXpCurvePreview)).onChange(async (value) => {
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

      new Setting(containerEl)
        .setName("User Leveling Difficulty")
        .setDesc("Adjust how quickly you level up. Lower = faster, Higher = slower. (Default: 10)")
        .addSlider((slider) =>
          slider
            .setLimits(1, 20, 1)
            .setValue(settings.userDifficulty || 10)
            .setDynamicTooltip()
            .onChange(async (value) => {
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

      new Setting(containerEl)
        .setName("Skill Leveling Difficulty")
        .setDesc("Adjust how quickly skills level up. Lower = faster, Higher = slower. (Default: 10)")
        .addSlider((slider) =>
          slider
            .setLimits(1, 20, 1)
            .setValue(settings.skillDifficulty || 10)
            .setDynamicTooltip()
            .onChange(async (value) => {
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
      new Setting(containerEl)
        .setName("Export markdown sidecars")
        .setDesc(
          "Write quests, habits, skills, completed files, and User Profile.md from live domain stores. Mutations do not write markdown."
        )
        .addButton((btn) =>
          btn.setButtonText("Export").onClick(async () => {
            if (typeof this.plugin.exportMarkdown === "function") {
              await this.plugin.exportMarkdown();
            }
          })
        );

      containerEl.createEl("h3", { text: "File Paths" });

      const pathField = (name, desc, key, placeholder) => {
        new Setting(containerEl)
          .setName(name)
          .setDesc(desc)
          .addText((text) => {
            text
              .setPlaceholder(placeholder)
              .setValue(settings[key] || "")
              .onChange(async (value) => {
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
      new Setting(containerEl)
        .setName("Reset All Data")
        .setDesc("Reset hero level, xp, and all quest data. This action cannot be undone.")
        .addButton((btn) =>
          btn
            .setButtonText("Reset")
            .setWarning()
            .onClick(async () => {
              if (typeof this.plugin.resetAllData === "function") {
                await this.plugin.resetAllData();
              }
            })
        );
    }
  }

  return { QuestLogSettingTab };
}

module.exports = {
  DOMAIN,
  DEFAULT_SETTINGS,
  PATH_KEYS,
  normalizeSettings,
  loadSettings,
  saveSettings,
  patchSettings,
  createSettingTabModule,
};
