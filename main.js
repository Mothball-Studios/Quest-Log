// ============================================================
// QUEST LOG — RPG-style quest tracker for Obsidian
// ============================================================

var import_obsidian = require("obsidian");
var Plugin = import_obsidian.Plugin;
var ItemView = import_obsidian.ItemView;
var PluginSettingTab = import_obsidian.PluginSettingTab;
var Setting = import_obsidian.Setting;
var Modal = import_obsidian.Modal;
var Notice = import_obsidian.Notice;
var setIcon = import_obsidian.setIcon;
var AbstractInputSuggest = import_obsidian.AbstractInputSuggest;

// ============================================================
// CONSTANTS & DEFAULTS
// ============================================================

var QUESTLOG_VIEW_TYPE = "quest-log-view";

var DEFAULT_SETTINGS = {
  rewardsMode: false,
  currentXp: 0,
  questsCompleted: 0,
  heroName: "Hero",
  quests: [],
  completedQuests: [],
  habits: [],
  completedHabits: [],
  skills: [],
  userProfileFileName: "User Profile",
  userProfileFolder: "Quest Log",
  questsFolderPath: "Quest Log/Quests",
  habitsFolderPath: "Quest Log/Habits",
  skillsFolderPath: "Quest Log/Skills",
  completedFolderPath: "Quest Log/Completed",
  userDifficulty: 10,
  skillDifficulty: 10,
};

// ============================================================
// PLUGIN CLASS — Entry point, loads/unloads the plugin
// ============================================================

var QuestLog = class extends Plugin {
  _cachedLevel = null;
  _cachedXp = null;
  _cachedDifficulty = null;

  getLevel() {
    const xp = this.settings.currentXp;
    const difficulty = this.settings.userDifficulty || 10;
    if (this._cachedXp !== xp || this._cachedDifficulty !== difficulty) {
      this._cachedXp = xp;
      this._cachedDifficulty = difficulty;
      this._cachedLevel = QuestLogView.getLevel(xp, difficulty);
    }
    return this._cachedLevel;
  }

  invalidateLevelCache() {
    this._cachedXp = null;
    this._cachedDifficulty = null;
  }

  async onload() {
    await this.loadSettings();
    await this.writeUserProfile();
    this.registerView(
      QUESTLOG_VIEW_TYPE,
      (leaf) => new QuestLogView(leaf, this),
    );
    this.addRibbonIcon("gamepad", "Quest Log", () => this.activateView());
    this.addSettingTab(new QuestLogSettingTab(this.app, this));

    // Watch for external .md file deletions
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file.path && file.path.endsWith(".md")) {
          const questsFolder = this.settings.questsFolderPath || "Quest Log/Quests";
          const habitsFolder = this.settings.habitsFolderPath || "Quest Log/Habits";
          const completedFolder = this.settings.completedFolderPath || "Quest Log/Completed";
          let changed = false;

          if (file.path.startsWith(questsFolder + "/")) {
            const safeName = file.path.slice(questsFolder.length + 1, -3);
            const before = this.settings.quests.length;
            this.settings.quests = this.settings.quests.filter(
              (q) => QuestLogView.safeName(q.title) !== safeName
            );
            if (this.settings.quests.length !== before) changed = true;
          } else if (file.path.startsWith(habitsFolder + "/")) {
            const safeName = file.path.slice(habitsFolder.length + 1, -3);
            const before = this.settings.habits.length;
            this.settings.habits = this.settings.habits.filter(
              (h) => QuestLogView.safeName(h.title) !== safeName
            );
            if (this.settings.habits.length !== before) changed = true;
          } else if (file.path.startsWith(settings.skillsFolderPath + "/")) {
            const safeName = file.path.slice(settings.skillsFolderPath.length + 1, -3);
            const before = (this.settings.skills || []).length;
            this.settings.skills = (this.settings.skills || []).filter(
              (s) => QuestLogView.safeName(s.name) !== safeName
            );
            if (this.settings.skills.length !== before) changed = true;
          } else if (file.path.startsWith(completedFolder + "/")) {
            const fileName = file.path.slice(completedFolder.length + 1, -3);
            const beforeQ = this.settings.completedQuests.length;
            const removedQuest = this.settings.completedQuests.find(
              (q) => QuestLogView.safeName(q.title) === fileName
            );
            if (removedQuest) {
              this.settings.currentXp = Math.max(0, this.settings.currentXp - removedQuest.xp);
              this.settings.questsCompleted = Math.max(0, this.settings.questsCompleted - 1);
            }
            this.settings.completedQuests = this.settings.completedQuests.filter(
              (q) => QuestLogView.safeName(q.title) !== fileName
            );
            if (this.settings.completedQuests.length !== beforeQ) changed = true;

            const beforeH = (this.settings.completedHabits || []).length;
            const removedHabit = (this.settings.completedHabits || []).find((h) => {
              const timeStr = QuestLogView.formatHabitTimestamp(h.completedAt);
              return QuestLogView.safeName(h.title) + " - " + timeStr === fileName;
            });
            if (removedHabit) {
              this.settings.currentXp = Math.max(0, this.settings.currentXp - removedHabit.xp);
              this.settings.questsCompleted = Math.max(0, this.settings.questsCompleted - 1);
            }
            this.settings.completedHabits = (this.settings.completedHabits || []).filter((h) => {
              const timeStr = QuestLogView.formatHabitTimestamp(h.completedAt);
              return QuestLogView.safeName(h.title) + " - " + timeStr !== fileName;
            });
            if ((this.settings.completedHabits || []).length !== beforeH) changed = true;
          }

          if (changed) {
            this.saveSettings();
            // Refresh the active view
            const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
            if (leaves.length > 0 && leaves[0].view) {
              const view = leaves[0].view;
              view.onOpen();
            }
          }
        }
      })
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.invalidateLevelCache();
    await this.writeUserProfile();
  }

  async writeUserProfile() {
    const { settings, app } = this;
    const level = this.getLevel();
    const title = QuestLogView.getLevelTitle(level);
    const difficulty = settings.userDifficulty || 10;
    const xpForNext = QuestLogView.getXpForLvl(level, difficulty);
    const xpFromPrev = QuestLogView.getXpForLvl(level - 1, difficulty);
    const xpNeeded = xpForNext - xpFromPrev;
    const xpProgress = settings.currentXp - xpFromPrev;
    const pct = xpNeeded > 0 ? Math.min(100, Math.round((xpProgress / xpNeeded) * 100)) : 100;
    const questsDone = settings.questsCompleted || 0;

    // Build progress bar
    const barLen = 16;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

    const content = `# 🛡️ Adventurer Profile

> *"Every legend starts somewhere."*

---

## Hero Name
### **${settings.heroName}**

---

## Level
### ⚔️ Level ${level} — ${title}

---

## XP Progress

| Current XP | Next Level | Progress |
|:----------:|:----------:|:--------:|
| ${settings.currentXp.toLocaleString()} | ${xpNeeded.toLocaleString()} | ${bar} ${pct}% |

---

## Stats Summary

| Stat | Value |
|:-----|:-----:|
| **Level** | ${level} |
| **Title** | ${title} |
| **Current XP** | ${settings.currentXp.toLocaleString()} |
| **XP to Next Level** | ${(xpForNext - settings.currentXp).toLocaleString()} |
| **Quests Completed** | ${questsDone} |

---

*This file is auto-generated by Quest Log. Do not edit.*
`;

    const folderPath = settings.userProfileFolder || "Quest Log";
    const fileName = settings.userProfileFileName || "User Profile";
    const fullPath = `${folderPath}/${fileName}.md`;

    // Ensure folder exists
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try {
        await app.vault.createFolder(folderPath);
      } catch (e) {
        // Folder may already exist or parent missing — try creating parents
      }
    }

    // Create or update the file
    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    } else {
      try {
        await app.vault.create(fullPath, content);
      } catch (e) {
        // File may exist at a slightly different path — find and modify it
        const fallback = app.vault.getAbstractFileByPath(fullPath);
        if (fallback) {
          await app.vault.modify(fallback, content);
        }
      }
    }
  }

  // Opens or reveals the Quest Log panel
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
};

// ============================================================
// FOLDER SUGGEST — Autocomplete for vault folder paths
// ============================================================

var FolderSuggest = class extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query) {
    const folders = new Set();
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f.children && f.path) folders.add(f.path);
    }
    const lowerQuery = query.toLowerCase();
    return [...folders].filter((f) => f.toLowerCase().includes(lowerQuery)).sort();
  }

  renderSuggestion(folder, el) {
    el.setText(folder || "/");
  }

  selectSuggestion(folder) {
    this.inputEl.value = folder;
    this.inputEl.trigger("input");
    this.close();
  }
};

// ============================================================
// SKILL SUGGEST — Autocomplete for skills
// ============================================================

var SkillSuggest = class extends AbstractInputSuggest {
  constructor(app, inputEl, plugin) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.plugin = plugin;
  }

  getSuggestions(query) {
    const skills = this.plugin.settings.skills || [];
    const lowerQuery = query.toLowerCase();
    return skills.filter((s) => s.name.toLowerCase().includes(lowerQuery));
  }

  renderSuggestion(skill, el) {
    el.setText(skill.name + ` (Lvl ${skill.level || 1})`);
  }

  selectSuggestion(skill) {
    this.inputEl.value = "";
    this.close();
    this.onSelect(skill);
  }
};

// ============================================================
// SETTINGS TAB — Plugin settings panel
// ============================================================

var QuestLogSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // --- REWARDS SECTION ---
    containerEl.createEl("h3", { text: "Rewards" });

    new Setting(containerEl)
      .setName("Rewards Mode")
      .setDesc(
        "Toggle the Rewards feature to earn coins for completing quests! Spend coins in the Rewards Shop for IRL rewards for working hard!",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rewardsMode)
          .onChange(async (value) => {
            this.plugin.settings.rewardsMode = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- XP CURVE SLIDERS ---
    containerEl.createEl("h3", { text: "XP Curve" });

    new Setting(containerEl)
      .setName("User Leveling Difficulty")
      .setDesc("Adjust how quickly you level up. Lower = faster, Higher = slower. (Default: 10)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.userDifficulty || 10)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.userDifficulty = value;
            this.plugin.invalidateLevelCache();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Skill Leveling Difficulty")
      .setDesc("Adjust how quickly skills level up. Lower = faster, Higher = slower. (Default: 10)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.skillDifficulty || 10)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.skillDifficulty = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- FILE PATHS SECTION ---
    containerEl.createEl("h3", { text: "File Paths" });

    new Setting(containerEl)
      .setName("User Profile File")
      .setDesc("Name of the user profile markdown file.")
      .addText((text) =>
        text
          .setPlaceholder("User Profile")
          .setValue(this.plugin.settings.userProfileFileName)
          .onChange(async (value) => {
            this.plugin.settings.userProfileFileName = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("User Profile Folder")
      .setDesc("Folder where the user profile file is stored.")
      .addText((text) => {
        text
          .setPlaceholder("Quest Log")
          .setValue(this.plugin.settings.userProfileFolder)
          .onChange(async (value) => {
            this.plugin.settings.userProfileFolder = value.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Quests Folder")
      .setDesc("Folder where quest markdown files are stored.")
      .addText((text) => {
        text
          .setPlaceholder("Quest Log/Quests")
          .setValue(this.plugin.settings.questsFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.questsFolderPath = value.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Habits Folder")
      .setDesc("Folder where habit markdown files are stored.")
      .addText((text) => {
        text
          .setPlaceholder("Quest Log/Habits")
          .setValue(this.plugin.settings.habitsFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.habitsFolderPath = value.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Skills Folder")
      .setDesc("Folder where skill markdown files are stored.")
      .addText((text) => {
        text
          .setPlaceholder("Quest Log/Skills")
          .setValue(this.plugin.settings.skillsFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.skillsFolderPath = value.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Completed Quests Folder")
      .setDesc("Folder where completed quest markdown files are stored.")
      .addText((text) => {
        text
          .setPlaceholder("Quest Log/Completed")
          .setValue(this.plugin.settings.completedFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.completedFolderPath = value.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    // --- DANGER ZONE ---
    containerEl.createEl("h3", { text: "Danger Zone" });

    new Setting(containerEl)
      .setName("Reset All Data")
      .setDesc(
        "Reset your hero's level, xp, and all quest data. This action cannot be undone.",
      )
      .addButton((btn) =>
        btn
          .setButtonText("Reset Data")
          .setWarning()
          .onClick(() => new ResetConfirmModal(this.app, this.plugin).open()),
      );
  }
};

// ============================================================
// RESET CONFIRM MODAL — Confirms before wiping all data
// ============================================================

var ResetConfirmModal = class extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("reset-modal-content");

    // Warning icon + header
    const headerRow = contentEl.createEl("div", { cls: "reset-modal-header-row" });
    const warnIcon = headerRow.createEl("span", { cls: "reset-modal-warn-icon" });
    setIcon(warnIcon, "alert-triangle");
    headerRow.createEl("h2", {
      text: "Reset All Data",
      cls: "reset-modal-header",
    });

    contentEl.createEl("p", {
      text: "This will wipe your hero's level, XP, and all quest data. This cannot be undone.",
      cls: "reset-modal-desc",
    });

    // Confirmation input
    const confirmLabel = contentEl.createEl("div", {
      cls: "reset-modal-confirm-label",
    });
    confirmLabel.createEl("span", { text: "Type " });
    confirmLabel.createEl("span", {
      text: `"${this.plugin.settings.heroName}"`,
      cls: "reset-modal-hero-inline",
    });
    confirmLabel.createEl("span", { text: " to confirm:" });
    const inputEl = contentEl.createEl("input", {
      type: "text",
      placeholder: "Hero name...",
      cls: "reset-modal-input",
    });

    // Buttons
    const btnRow = contentEl.createEl("div", { cls: "reset-modal-btn-row" });
    const cancelBtn = btnRow.createEl("button", {
      text: "Cancel",
      cls: "reset-modal-cancel-btn",
    });
    const confirmBtn = btnRow.createEl("button", {
      text: "Reset Everything",
      cls: "reset-modal-confirm-btn",
    });

    cancelBtn.addEventListener("click", () => this.close());

    // Reset all settings to defaults (deep clone to avoid shared array refs)
    confirmBtn.addEventListener("click", async () => {
      const adapter = this.app.vault.adapter;
      const settings = this.plugin.settings;

      // Gather all Quest Log folder paths from settings
      const foldersToWipe = [
        settings.questsFolderPath || "Quest Log/Quests",
        settings.habitsFolderPath || "Quest Log/Habits",
        settings.skillsFolderPath || "Quest Log/Skills",
        settings.completedFolderPath || "Quest Log/Completed",
      ];

      // Delete User Profile .md first
      const userProfileFolder = settings.userProfileFolder || "Quest Log";
      const userProfileFile = settings.userProfileFileName || "User Profile";
      const userProfilePath = `${userProfileFolder}/${userProfileFile}.md`;
      try { await adapter.remove(userProfilePath); } catch (e) {}

      // Delete all folders recursively
      for (const folder of foldersToWipe) {
        try { await adapter.rmdir(folder, true); } catch (e) {}
      }

      // Reset settings to defaults
      this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      
      // Save data
      await this.saveData(this.plugin.settings);

      // Close this modal
      this.close();
    });
  }
};

// ============================================================
// QUEST LOG VIEW — Main panel (header, XP bar, quest creation, tabs)
// ============================================================

var QuestLogView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return QUESTLOG_VIEW_TYPE;
  }
  getDisplayText() {
    return "Quest Log";
  }
  getIcon() {
    return "gamepad";
  }

  // ----------------------------------------
  // XP & LEVEL CALCULATIONS
  // ----------------------------------------

  static getXpMultiplier(difficulty) {
    const diff = difficulty || 10;
    return 0.5 + (diff - 1) * 0.05;
  }

  static getXpForLvl(lvl, difficulty = 10) {
    if (lvl <= 0) return 0;
    const mult = this.getXpMultiplier(difficulty);
    if (lvl <= 15) return Math.floor(lvl * (lvl + 1) / 2 * 1000 * mult);
    const base = 120000 * mult;
    const ratio = Math.pow(1.2, lvl - 15);
    return Math.floor(base + 16000 * mult * (ratio - 1) / 0.2);
  }

  static getLevel(currentXp, difficulty = 10) {
    if (currentXp < 1000 * this.getXpMultiplier(difficulty)) return 1;
    const threshold15 = 120000 * this.getXpMultiplier(difficulty);
    if (currentXp >= threshold15) {
      const mult = this.getXpMultiplier(difficulty);
      const lvl = Math.floor(Math.log((currentXp - threshold15) * 0.2 / (16000 * mult) + 1) / Math.log(1.2)) + 15;
      return Math.max(16, lvl + (this.getXpForLvl(lvl + 1, difficulty) <= currentXp ? 1 : 0));
    }
    let lo = 1, hi = 15;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.getXpForLvl(mid, difficulty) <= currentXp) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  // ----------------------------------------
  // SKILL XP & LEVEL CALCULATIONS
  // ----------------------------------------

  static SKILL_MAX_LEVEL = 100;

  static getSkillXpForLvl(lvl, difficulty = 10) {
    if (lvl <= 0) return 0;
    if (lvl > this.SKILL_MAX_LEVEL) return this.getSkillXpForLvl(this.SKILL_MAX_LEVEL, difficulty);
    const mult = this.getXpMultiplier(difficulty);
    if (lvl <= 15) return Math.floor(lvl * (lvl + 1) / 2 * 100 * mult);
    const base = 12000 * mult;
    const ratio = Math.pow(1.15, lvl - 15);
    return Math.floor(base + 1600 * mult * (ratio - 1) / 0.15);
  }

  static getSkillLevel(currentXp, difficulty = 10) {
    if (currentXp < 100 * this.getXpMultiplier(difficulty)) return 1;
    const threshold15 = 12000 * this.getXpMultiplier(difficulty);
    if (currentXp >= threshold15) {
      const mult = this.getXpMultiplier(difficulty);
      const lvl = Math.floor(Math.log((currentXp - threshold15) * 0.15 / (1600 * mult) + 1) / Math.log(1.15)) + 15;
      return Math.min(this.SKILL_MAX_LEVEL, Math.max(16, lvl + (this.getSkillXpForLvl(lvl + 1, difficulty) <= currentXp ? 1 : 0)));
    }
    let lo = 1, hi = 15;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.getSkillXpForLvl(mid, difficulty) <= currentXp) lo = mid;
      else hi = mid - 1;
    }
    return Math.min(this.SKILL_MAX_LEVEL, lo + 1);
  }

  static getSkillXpProgress(skill, difficulty = 10) {
    const level = skill.level || 1;
    const xpForCurrent = this.getSkillXpForLvl(level - 1, difficulty);
    const xpForNext = this.getSkillXpForLvl(level, difficulty);
    return {
      xp: skill.xp || 0,
      xpForCurrent,
      xpForNext,
      xpNeeded: xpForNext - xpForCurrent,
      xpProgress: (skill.xp || 0) - xpForCurrent,
      pct: Math.min(100, Math.round(((skill.xp || 0) - xpForCurrent) / (xpForNext - xpForCurrent) * 100))
    };
  }

  // ----------------------------------------
  // XP CONSTANTS & HELPERS
  // ----------------------------------------

  static DIFFICULTY_LABELS = ["Trivial", "Easy", "Medium", "Hard", "Legendary"];
  static URGENCY_LABELS = ["Relaxed", "Soon", "Urgent", "Critical", "Immediate"];
  static IMPACT_LABELS = ["Minor", "Notable", "Major", "Epic", "Legendary"];

  static _XP_TABLE = (() => {
    const table = {};
    for (let d = 1; d <= 5; d++) {
      for (let u = 1; u <= 5; u++) {
        for (let i = 1; i <= 5; i++) {
          const sum = d + u + i;
          let xp;
          if (sum <= 3) xp = 100;
          else if (sum >= 15) xp = 500000;
          else {
            const exp = (sum - 3) / 12;
            xp = Math.round(100 * Math.pow(5000, exp));
          }
          table[`${d},${u},${i}`] = xp;
        }
      }
    }
    return table;
  })();

  static calcXp(d, u, i) {
    return this._XP_TABLE[`${d},${u},${i}`] || 100;
  }

  static safeName(str) {
    return str.replace(/[\\/:*?"<>|]/g, "-");
  }

  static formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  static _LEVEL_TITLES = [
    "Novice Adventurer", "Novice Adventurer", "Novice Adventurer", "Novice Adventurer", "Apprentice",
    "Apprentice", "Apprentice", "Apprentice", "Apprentice", "Journeyman",
    "Journeyman", "Journeyman", "Journeyman", "Journeyman", "Veteran",
    "Veteran", "Veteran", "Veteran", "Veteran", "Master",
    "Master", "Master", "Master", "Master", "Grandmaster",
    "Grandmaster", "Grandmaster", "Grandmaster", "Grandmaster", "Champion",
    "Champion", "Champion", "Champion", "Champion", "Champion",
    "Champion", "Champion", "Champion", "Champion", "Mythic",
    "Mythic", "Mythic", "Mythic", "Mythic", "Mythic",
    "Mythic", "Mythic", "Mythic", "Mythic", "Legendary",
  ];

  static getLevelTitle(lvl) {
    return this._LEVEL_TITLES[Math.min(lvl, 50)] || "Legendary";
  }

  // ----------------------------------------
  // HEADER REFRESH
  // ----------------------------------------

  updateHeader() {
    const currentXp = this.plugin.settings.currentXp;
    const level = this.plugin.getLevel();
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const xpForNext = QuestLogView.getXpForLvl(level, difficulty);
    const xpFromPrev = QuestLogView.getXpForLvl(level - 1, difficulty);
    const xpNeeded = xpForNext - xpFromPrev;
    const xpProgress = currentXp - xpFromPrev;
    const pct = xpNeeded > 0 ? Math.min(100, Math.round((xpProgress / xpNeeded) * 100)) : 100;

    if (this._levelBadgeEl) this._levelBadgeEl.setText(`${level}`);
    if (this._subtitleEl) this._subtitleEl.setText(QuestLogView.getLevelTitle(level));
    if (this._xpTextEl) this._xpTextEl.setText(`${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()}`);
    if (this._xpBarFill) this._xpBarFill.style.width = `${pct}%`;
  }

  // ----------------------------------------
  // MARKDOWN FILE PERSISTENCE
  // ----------------------------------------

  static async writeQuestFile(plugin, quest) {
    const { app, settings } = plugin;
    const folderPath = settings.questsFolderPath || "Quest Log/Quests";
    const safeName = QuestLogView.safeName(quest.title);
    const fullPath = `${folderPath}/${safeName}.md`;

    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    const stars = (n) => "⭐".repeat(n);

    const content = `---
id: "${quest.id}"
---
# ${quest.title}

${quest.description || ""}

---

| Field | Value |
| :--- | :--- |
| **XP** | ${quest.xp.toLocaleString()} |
| **Difficulty** | ${stars(quest.difficulty)} |
| **Urgency** | ${stars(quest.urgency)} |
| **Impact** | ${stars(quest.impact)} |
| **Status** | In Progress |
| **Created** | ${QuestLogView.formatDate(quest.created)} |
| **Completed** | — |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    } else {
      try {
        await app.vault.create(fullPath, content);
      } catch (e) {
        const fallback = app.vault.getAbstractFileByPath(fullPath);
        if (fallback) await app.vault.modify(fallback, content);
      }
    }
  }

  static async completeQuestFile(plugin, quest) {
    const { app, settings } = plugin;
    const folderPath = settings.questsFolderPath || "Quest Log/Quests";
    const safeName = QuestLogView.safeName(quest.title);
    const fullPath = `${folderPath}/${safeName}.md`;

    const stars = (n) => "⭐".repeat(n);

    const content = `---
id: "${quest.id}"
---
# ${quest.title}

${quest.description || ""}

---

| Field | Value |
| :--- | :--- |
| **XP** | ${quest.xp.toLocaleString()} |
| **Difficulty** | ${stars(quest.difficulty)} |
| **Urgency** | ${stars(quest.urgency)} |
| **Impact** | ${stars(quest.impact)} |
| **Status** | ✅ Completed |
| **Created** | ${QuestLogView.formatDate(quest.created)} |
| **Completed** | ${QuestLogView.formatDate(new Date().toISOString())} |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    }
  }

  static async deleteQuestFile(plugin, quest) {
    const { app, settings } = plugin;
    const folderPath = settings.questsFolderPath || "Quest Log/Quests";
    const safeName = QuestLogView.safeName(quest.title);
    const fullPath = `${folderPath}/${safeName}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  static async deleteHabitFile(plugin, habit) {
    const { app, settings } = plugin;
    const folderPath = settings.habitsFolderPath || "Quest Log/Habits";
    const safeName = QuestLogView.safeName(habit.title);
    const fullPath = `${folderPath}/${safeName}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  static async writeHabitFile(plugin, habit) {
    const { app, settings } = plugin;
    const folderPath = settings.habitsFolderPath || "Quest Log/Habits";
    const safeName = QuestLogView.safeName(habit.title);
    const fullPath = `${folderPath}/${safeName}.md`;

    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    const stars = (n) => "⭐".repeat(n);

    const content = `---
id: "${habit.id}"
---
# ${habit.title}

${habit.description || ""}

---

| Field | Value |
| :--- | :--- |
| **XP** | ${habit.xp.toLocaleString()} |
| **Difficulty** | ${stars(habit.difficulty)} |
| **Urgency** | ${stars(habit.urgency)} |
| **Impact** | ${stars(habit.impact)} |
| **Status** | Active Habit |
| **Created** | ${QuestLogView.formatDate(habit.created)} |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    } else {
      try {
        await app.vault.create(fullPath, content);
      } catch (e) {
        const fallback = app.vault.getAbstractFileByPath(fullPath);
        if (fallback) await app.vault.modify(fallback, content);
      }
    }
  }

  static formatHabitTimestamp(dateStr) {
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

  static async writeCompletedHabitFile(plugin, habit, completedAt) {
    const { app, settings } = plugin;
    const folderPath = settings.completedFolderPath || "Quest Log/Completed";
    const safeName = QuestLogView.safeName(habit.title);
    const timeStr = QuestLogView.formatHabitTimestamp(completedAt);
    const fullPath = `${folderPath}/${safeName} - ${timeStr}.md`;

    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    const stars = (n) => "⭐".repeat(n);

    const content = `---
id: "${habit.id}"
---
# ${habit.title}

${habit.description || ""}

---

| Field | Value |
| :--- | :--- |
| **XP** | ${habit.xp.toLocaleString()} |
| **Difficulty** | ${stars(habit.difficulty)} |
| **Urgency** | ${stars(habit.urgency)} |
| **Impact** | ${stars(habit.impact)} |
| **Status** | Completed ✓ |
| **Completed** | ${QuestLogView.formatDate(completedAt)} |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    } else {
      try {
        await app.vault.create(fullPath, content);
      } catch (e) {}
    }
  }

  static async deleteCompletedHabitFile(plugin, habit, completedAt) {
    const { app, settings } = plugin;
    const folderPath = settings.completedFolderPath || "Quest Log/Completed";
    const safeName = QuestLogView.safeName(habit.title);
    const timeStr = QuestLogView.formatHabitTimestamp(completedAt);
    const fullPath = `${folderPath}/${safeName} - ${timeStr}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  // ----------------------------------------
  // SKILL FILE PERSISTENCE
  // ----------------------------------------

  static async writeSkillFile(plugin, skill) {
    const { app, settings } = plugin;
    const folderPath = settings.skillsFolderPath || "Quest Log/Skills";
    const safeName = QuestLogView.safeName(skill.name);
    const fullPath = `${folderPath}/${safeName}.md`;

    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    const legendaryStar = skill.legendary ? " ★" : "";

    const content = `---
id: "${skill.id}"
---
# ${skill.name}${legendaryStar}

${skill.description || ""}

---

| Field | Value |
| :--- | :--- |
| **Level** | ${skill.level || 1} |
| **XP** | ${(skill.xp || 0).toLocaleString()} |
| **Legendary** | ${skill.legendary ? "Yes" : "No"} |
| **Created** | ${this.formatDate(skill.created)} |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    } else {
      try {
        await app.vault.create(fullPath, content);
      } catch (e) {
        const fallback = app.vault.getAbstractFileByPath(fullPath);
        if (fallback) await app.vault.modify(fallback, content);
      }
    }
  }

  static async deleteSkillFile(plugin, skill) {
    const { app, settings } = plugin;
    const folderPath = settings.skillsFolderPath || "Quest Log/Skills";
    const safeName = QuestLogView.safeName(skill.name);
    const fullPath = `${folderPath}/${safeName}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  createSlider(container, label, labels, color, initialValue, onChange) {
    const group = container.createEl("div", { cls: "quest-slider-group" });
    const labelEl = group.createEl("span", { text: label, cls: "quest-slider-label" });
    labelEl.style.color = color;

    const track = group.createEl("div", { cls: "custom-slider-track" });

    // Add snap point stars (first and last pulled in slightly)
    const snapPositions = [3, 25, 50, 75, 97];
    const stars = [];
    snapPositions.forEach((pct, i) => {
      const star = track.createEl("span", { cls: "snap-star", text: "★" });
      star.style.position = "absolute";
      star.style.left = pct + "%";
      star.style.top = "calc(50% - 1px)";
      star.style.transform = "translate(-50%, -50%)";
      star.style.fontSize = "12px";
      star.style.color = "#555";
      star.style.pointerEvents = "none";
      star.style.transition = "color 0.15s ease";
      stars.push(star);
    });

    const fill = track.createEl("div", { cls: "custom-slider-fill" });
    fill.style.backgroundColor = color;
    fill.style.boxShadow = `0 0 6px ${color}`;
    const thumb = track.createEl("div", { cls: "custom-slider-thumb" });
    thumb.style.backgroundColor = color;

    const valueLabel = group.createEl("span", {
      text: labels[initialValue - 1],
      cls: "quest-slider-value",
    });

    let value = initialValue;
    let onDragEnd = onChange;

    const updateSlider = (val, notify) => {
      value = Math.max(1, Math.min(5, val));
      const pct = ((value - 1) / 4) * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      valueLabel.setText(labels[value - 1]);

      // Light up stars that the fill has passed
      stars.forEach((star, i) => {
        if (i < value) {
          star.style.color = color;
          star.style.fontSize = "14px";
          star.style.textShadow = "none";
        } else {
          star.style.color = "#555";
          star.style.fontSize = "12px";
          star.style.textShadow = "none";
        }
      });

      if (notify && onDragEnd) onDragEnd();
    };

    updateSlider(initialValue, false);

    const getValueFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0)) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(pct * 4) + 1;
    };

    let dragging = false;
    let bound = false;

    const onMouseMove = (e) => {
      if (!dragging) return;
      updateSlider(getValueFromEvent(e), false);
    };
    const onMouseUp = () => {
      if (dragging) {
        dragging = false;
        if (onDragEnd) onDragEnd();
      }
      if (bound) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        bound = false;
      }
    };

    const onTouchMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      updateSlider(getValueFromEvent(e), false);
    };
    const onTouchEnd = () => {
      if (dragging) {
        dragging = false;
        if (onDragEnd) onDragEnd();
      }
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };

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
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    }, { passive: false });

    track.addEventListener("click", (e) => {
      updateSlider(getValueFromEvent(e), true);
    });

    group._getValue = () => value;
    group._setValue = (v) => updateSlider(v, false);
    return group;
  }

  // ----------------------------------------
  // UI CREATION
  // ----------------------------------------

  async onOpen() {
    if (!this.containerEl || !this.containerEl.children || !this.containerEl.children[1]) {
      return;
    }
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("quest-log-container");

    // --- TOP BAR ---
    const topBar = container.createEl("div", { cls: "quest-log-topbar" });
    const hamburgerBtn = topBar.createEl("button", { cls: "topbar-hamburger" });
    setIcon(hamburgerBtn, "menu");
    topBar.createEl("span", { text: "Quest Log", cls: "topbar-title" });
    const settingsBtn = topBar.createEl("button", { cls: "topbar-settings" });
    setIcon(settingsBtn, "settings");

    // --- HAMBURGER MENU OVERLAY ---
    const menuOverlay = this.containerEl.createEl("div", { cls: "quest-menu-overlay" });
    const menuPanel = menuOverlay.createEl("div", { cls: "quest-menu-panel" });

    const buildMenu = () => {
      menuPanel.empty();

      const items = currentView === "completed"
        ? [
            { icon: "scroll-text", label: "Quests", action: () => switchView("active", "QUESTS") },
            { icon: "list-todo", label: "Habits", action: () => switchView("active", "HABITS") },
            { icon: "book-open", label: "Skills", action: () => switchView("active", "SKILLS") },
          ]
        : [
            { icon: "check", label: "Completed", action: () => switchView("completed") },
          ];

      // Shared items
      if (this.plugin.settings.rewardsMode) {
        items.push(
          { icon: "shopping-cart", label: "Rewards Shop", action: () => new Notice("Coming Soon!") },
        );
      }
      items.push(
        { icon: "user", label: "User Profile", action: () => {
          const folder = this.plugin.settings.userProfileFolder || "Quest Log";
          const fileName = this.plugin.settings.userProfileFileName || "User Profile";
          const fullPath = `${folder}/${fileName}.md`;
          const file = this.app.vault.getAbstractFileByPath(fullPath);
          if (file) {
            this.app.workspace.openLinkText(fullPath, "", false);
          } else {
            new Notice("User Profile not found.");
          }
        }},
        { icon: "settings", label: "Settings", action: () => {
          this.app.setting.open();
          this.app.setting.openTabById('quest-log');
        }},
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
    };

    // Hamburger open/close
    hamburgerBtn.addEventListener("click", () => {
      buildMenu();
      menuOverlay.addClass("open");
    });
    menuOverlay.addEventListener("click", (e) => {
      if (e.target === menuOverlay) menuOverlay.removeClass("open");
    });

    // Settings gear
    settingsBtn.addEventListener("click", () => {
      this.app.setting.open();
      this.app.setting.openTabById('quest-log');
    });

    // --- HEADER ---
    const header = container.createEl("div", { cls: "quest-header" });
    const currentXp = this.plugin.settings.currentXp;
    const calculatedLvl = this.plugin.getLevel();
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const xpFrmPrevLvls = QuestLogView.getXpForLvl(calculatedLvl - 1, difficulty);
    const xpForNextLvl = QuestLogView.getXpForLvl(calculatedLvl, difficulty);
    const progressXp = currentXp - xpFrmPrevLvls;
    const totalXpInLvl = xpForNextLvl - xpFrmPrevLvls;
    const percent = (progressXp / totalXpInLvl) * 100;

    // Level badge
    const levelBadge = header.createEl("div", { cls: "level-badge" });
    this._levelBadgeEl = levelBadge.createEl("h1", { text: `${calculatedLvl}` });

    // Hero info
    const heroInfo = header.createEl("div", { cls: "hero-info" });
    const nameContainer = heroInfo.createEl("div", {
      cls: "hero-name-container",
    });
    const heroNameEl = nameContainer.createEl("span", {
      text: this.plugin.settings.heroName,
      cls: "hero-name-input",
      attr: { contenteditable: "true" },
    });
    const editIcon = nameContainer.createEl("span", { cls: "edit-icon" });
    setIcon(editIcon, "pencil");
    editIcon.addEventListener("click", () => {
      heroNameEl.focus();
      // Place cursor at end of text
      const range = document.createRange();
      range.selectNodeContents(heroNameEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    // Hero name — debounced save
    let heroNameTimer;
    heroNameEl.addEventListener("input", () => {
      const nameInput = heroNameEl.innerText;
      this.plugin.settings.heroName = nameInput.trim();
      clearTimeout(heroNameTimer);
      heroNameTimer = setTimeout(() => this.plugin.saveSettings(), 500);
    });
    heroNameEl.addEventListener("blur", () => {
      clearTimeout(heroNameTimer);
      if (heroNameEl.innerText.trim() === "") {
        heroNameEl.setText("Hero");
        this.plugin.settings.heroName = "Hero";
      }
      this.plugin.saveSettings();
    });

    // Subtitle
    const subtitleEl = heroInfo.createEl("div", { cls: "sub-text" });
    subtitleEl.setText(QuestLogView.getLevelTitle(calculatedLvl));
    this._subtitleEl = subtitleEl;

    // XP info
    const xpInfo = header.createEl("div", { cls: "xp-info" });
    xpInfo.createEl("div", { text: "Xp Progress", cls: "sub-text" });
    xpInfo.createEl("div", {
      text: `${progressXp.toLocaleString()} / ${totalXpInLvl.toLocaleString()}`,
      cls: "xp-text",
    });
    this._xpTextEl = xpInfo.lastChild;

    // XP bar
    const xpBarContainer = container.createEl("div", {
      cls: "xp-bar-container",
    });
    const xpBarFill = xpBarContainer.createEl("div", { cls: "xp-bar-fill" });
    xpBarFill.style.width = `${percent}%`;
    this._xpBarFill = xpBarFill;

    // --- FAB BUTTON (Create Quest) ---
    const fabBtn = container.createEl("button", { cls: "quest-fab" });
    const fabIcon = fabBtn.createEl("span", { cls: "fab-icon" });
    setIcon(fabIcon, "plus");
    fabBtn.style.display = "flex";

    // --- QUEST CREATION MODAL ---
    const overlay = this.containerEl.createEl("div", {
      cls: "quest-creation-overlay",
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.removeClass("open");
      }
    });
    const modalBox = overlay.createEl("div", { cls: "quest-modal" });

    // Modal header
    const modalHeader = modalBox.createEl("div", { cls: "quest-modal-header" });
    const headerIcon = modalHeader.createEl("span", {
      cls: "quest-modal-header-icon",
    });
    setIcon(headerIcon, "scroll");
    modalHeader.createEl("span", { text: "New Quest" });

    // Modal inputs
    const titleInput = modalBox.createEl("input", {
      type: "text",
      placeholder: "Quest Title...",
      cls: "quest-modal-title",
    });
    const descInput = modalBox.createEl("textarea", {
      attr: { placeholder: "Instructions..." },
      cls: "quest-modal-desc",
    });

    // --- SLIDER HELPERS ---
    // --- SLIDERS ---
    const slidersSection = modalBox.createEl("div", {
      cls: "quest-sliders-section",
    });

    var diffSlider, urgSlider, impSlider;
    const xpPreview = { el: null };

    const updateXpPreview = () => {
      const xp = QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue(),
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    };

    diffSlider = this.createSlider(
      slidersSection, "Difficulty", QuestLogView.DIFFICULTY_LABELS, "#5e87ff", 3, updateXpPreview
    );
    urgSlider = this.createSlider(
      slidersSection, "Urgency", QuestLogView.URGENCY_LABELS, "#f59e0b", 3, updateXpPreview
    );
    impSlider = this.createSlider(
      slidersSection, "Impact", QuestLogView.IMPACT_LABELS, "#a855f7", 3, updateXpPreview
    );

    // XP preview
    const xpRow = modalBox.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${QuestLogView.calcXp(3, 3, 3).toLocaleString()} XP`,
      cls: "quest-xp-preview-value",
    });

    // --- SKILL ATTACHMENT ---
    const skillsSection = modalBox.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });

    const selectedSkillIds = [];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });

    const updateSelectedSkillsDisplay = () => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          setIcon(removeBtn, "x");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = selectedSkillIds.indexOf(skillId);
            if (idx > -1) selectedSkillIds.splice(idx, 1);
            updateSelectedSkillsDisplay();
          });
        }
      });
      if (selectedSkillIds.length === 0) {
        selectedSkillsDisplay.createEl("span", {
          text: "No skills attached",
          cls: "detail-skills-placeholder",
        });
      }
    };
    updateSelectedSkillsDisplay();

    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input",
    });

    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };

    // Modal buttons
    const btnContainer = modalBox.createEl("div", {
      cls: "quest-modal-buttons",
    });
    const cancelBtn = btnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn",
    });
    const createBtn = btnContainer.createEl("button", {
      cls: "quest-modal-create-btn",
    });
    const createBtnIcon = createBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon",
    });
    setIcon(createBtnIcon, "plus");
    createBtn.createEl("span", { text: "Create Quest" });

    // Modal events
    const closeOverlay = () => {
      overlay.removeClass("open");
      titleInput.value = "";
      descInput.value = "";
      diffSlider._setValue(3);
      urgSlider._setValue(3);
      impSlider._setValue(3);
      updateXpPreview();
      selectedSkillIds.length = 0;
      updateSelectedSkillsDisplay();
    };

    // Track active tab
    var activeTab = "QUESTS";
    var currentView = "active";

    fabBtn.addEventListener("click", () => {
      if (activeTab === "QUESTS") {
        overlay.addClass("open");
        titleInput.focus();
      } else if (activeTab === "HABITS") {
        habitOverlay.addClass("open");
        habitTitleInput.focus();
      } else if (activeTab === "SKILLS") {
        skillOverlay.addClass("open");
        skillNameInput.focus();
      } else {
        comingSoonOverlay.addClass("open");
      }
    });

    cancelBtn.addEventListener("click", closeOverlay);

    createBtn.addEventListener("click", async () => {
      if (titleInput.value.trim() !== "") {
        const xp = QuestLogView.calcXp(
          diffSlider._getValue(),
          urgSlider._getValue(),
          impSlider._getValue(),
        );
        const quest = {
          id: Date.now().toString(),
          title: titleInput.value.trim(),
          description: descInput.value.trim(),
          difficulty: diffSlider._getValue(),
          urgency: urgSlider._getValue(),
          impact: impSlider._getValue(),
          xp: xp,
          created: new Date().toISOString(),
          skillIds: [...selectedSkillIds],
        };
        this.plugin.settings.quests.push(quest);
        await this.plugin.saveSettings();
        await QuestLogView.writeQuestFile(this.plugin, quest);
        this.renderQuestList(questListContainer);
        new Notice(`Created Quest: ${quest.title} (${xp.toLocaleString()} XP)`);
        closeOverlay();
      } else {
        new Notice("Add Quest Title First!");
      }
    });

    // --- HABIT CREATION MODAL ---
    const habitOverlay = this.containerEl.createEl("div", {
      cls: "quest-creation-overlay",
    });
    habitOverlay.addEventListener("click", (e) => {
      if (e.target === habitOverlay) {
        habitOverlay.removeClass("open");
      }
    });
    const habitModalBox = habitOverlay.createEl("div", { cls: "quest-modal habit-context" });

    // Habit modal header
    const habitModalHeader = habitModalBox.createEl("div", { cls: "quest-modal-header" });
    const habitHeaderIcon = habitModalHeader.createEl("span", { cls: "quest-modal-header-icon" });
    setIcon(habitHeaderIcon, "repeat");
    habitModalHeader.createEl("span", { text: "New Habit" });

    // Habit modal inputs
    const habitTitleInput = habitModalBox.createEl("input", {
      type: "text",
      placeholder: "Habit Title...",
      cls: "quest-modal-title",
    });
    const habitDescInput = habitModalBox.createEl("textarea", {
      attr: { placeholder: "Description..." },
      cls: "quest-modal-desc",
    });

    // Habit sliders
    const habitSlidersSection = habitModalBox.createEl("div", {
      cls: "quest-sliders-section",
    });

    var habitDiffSlider, habitUrgSlider, habitImpSlider;
    const habitXpPreview = { el: null };

    const updateHabitXpPreview = () => {
      const xp = QuestLogView.calcXp(
        habitDiffSlider._getValue(),
        habitUrgSlider._getValue(),
        habitImpSlider._getValue(),
      );
      habitXpPreview.el.setText(`${xp.toLocaleString()} XP`);
    };

    habitDiffSlider = this.createSlider(
      habitSlidersSection, "Difficulty", QuestLogView.DIFFICULTY_LABELS, "#5e87ff", 3, updateHabitXpPreview
    );
    habitUrgSlider = this.createSlider(
      habitSlidersSection, "Urgency", QuestLogView.URGENCY_LABELS, "#f59e0b", 3, updateHabitXpPreview
    );
    habitImpSlider = this.createSlider(
      habitSlidersSection, "Impact", QuestLogView.IMPACT_LABELS, "#a855f7", 3, updateHabitXpPreview
    );

    // Habit XP preview
    const habitXpRow = habitModalBox.createEl("div", { cls: "quest-xp-preview-row" });
    habitXpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    habitXpPreview.el = habitXpRow.createEl("span", {
      text: `${QuestLogView.calcXp(3, 3, 3).toLocaleString()} XP`,
      cls: "quest-xp-preview-value",
    });

    // --- SKILL ATTACHMENT ---
    const habitSkillsSection = habitModalBox.createEl("div", { cls: "detail-skills-section" });
    habitSkillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });

    const habitSelectedSkillIds = [];
    const habitSelectedSkillsDisplay = habitSkillsSection.createEl("div", { cls: "detail-selected-skills" });
    const habitSkillInputContainer = habitSkillsSection.createEl("div", { cls: "detail-skill-input-container" });

    const updateHabitSelectedSkillsDisplay = () => {
      habitSelectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      habitSelectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = habitSelectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          setIcon(removeBtn, "x");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = habitSelectedSkillIds.indexOf(skillId);
            if (idx > -1) habitSelectedSkillIds.splice(idx, 1);
            updateHabitSelectedSkillsDisplay();
          });
        }
      });
      if (habitSelectedSkillIds.length === 0) {
        habitSelectedSkillsDisplay.createEl("span", {
          text: "No skills attached",
          cls: "detail-skills-placeholder",
        });
      }
    };
    updateHabitSelectedSkillsDisplay();

    const habitSkillInput = habitSkillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input",
    });

    const habitSkillSuggest = new SkillSuggest(this.app, habitSkillInput, this.plugin);
    habitSkillSuggest.onSelect = (skill) => {
      if (!habitSelectedSkillIds.includes(skill.id)) {
        habitSelectedSkillIds.push(skill.id);
        updateHabitSelectedSkillsDisplay();
      }
    };

    // Habit modal buttons
    const habitBtnContainer = habitModalBox.createEl("div", {
      cls: "quest-modal-buttons",
    });
    const habitCancelBtn = habitBtnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn",
    });
    const habitCreateBtn = habitBtnContainer.createEl("button", {
      cls: "quest-modal-create-btn",
    });
    const habitCreateBtnIcon = habitCreateBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon",
    });
    setIcon(habitCreateBtnIcon, "plus");
    habitCreateBtn.createEl("span", { text: "Create Habit" });

    // Habit modal events
    const closeHabitOverlay = () => {
      habitOverlay.removeClass("open");
      habitTitleInput.value = "";
      habitDescInput.value = "";
      habitDiffSlider._setValue(3);
      habitUrgSlider._setValue(3);
      habitImpSlider._setValue(3);
      updateHabitXpPreview();
      habitSelectedSkillIds.length = 0;
      updateHabitSelectedSkillsDisplay();
    };

    habitCancelBtn.addEventListener("click", closeHabitOverlay);

    habitCreateBtn.addEventListener("click", async () => {
      if (habitTitleInput.value.trim() !== "") {
        const xp = QuestLogView.calcXp(
          habitDiffSlider._getValue(),
          habitUrgSlider._getValue(),
          habitImpSlider._getValue(),
        );
        const habit = {
          id: Date.now().toString(),
          title: habitTitleInput.value.trim(),
          description: habitDescInput.value.trim(),
          difficulty: habitDiffSlider._getValue(),
          urgency: habitUrgSlider._getValue(),
          impact: habitImpSlider._getValue(),
          xp: xp,
          created: new Date().toISOString(),
          skillIds: [...habitSelectedSkillIds],
        };
        this.plugin.settings.habits.push(habit);
        await this.plugin.saveSettings();
        await QuestLogView.writeHabitFile(this.plugin, habit);
        this.renderHabitList(habitsContent);
        new Notice(`Created Habit: ${habit.title} (${xp.toLocaleString()} XP)`);
        closeHabitOverlay();
      } else {
        new Notice("Add Habit Title First!");
      }
    });

    // --- COMING SOON OVERLAY ---
    const comingSoonOverlay = this.containerEl.createEl("div", {
      cls: "quest-creation-overlay",
    });
    comingSoonOverlay.addEventListener("click", (e) => {
      if (e.target === comingSoonOverlay) {
        comingSoonOverlay.removeClass("open");
      }
    });
    const comingSoonBox = comingSoonOverlay.createEl("div", {
      cls: "coming-soon-box",
    });
    comingSoonBox.createEl("h2", {
      text: "Coming Soon!",
      cls: "coming-soon-header",
    });
    comingSoonBox.createEl("p", {
      text: "This feature is still in development.",
      cls: "coming-soon-desc",
    });
    const comingSoonCloseBtn = comingSoonBox.createEl("button", {
      text: "Close",
      cls: "coming-soon-close-btn",
    });
    comingSoonCloseBtn.addEventListener("click", () => {
      comingSoonOverlay.removeClass("open");
    });

    // --- TABS ---
    const tabsContainer = container.createEl("div", { cls: "quest-log-tabs" });
    const allTabs = [];

    const createTab = (icon, text, colorClass) => {
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
        // Update active tab tracker
        activeTab = text;
        // If in completed view, switch back to active
        if (currentView === "completed") {
          switchView("active");
          return;
        }
        // Update FAB color
        fabBtn.removeClass("fab-habits");
        fabBtn.removeClass("fab-skills");
        if (colorClass === "tab-habits") fabBtn.addClass("fab-habits");
        if (colorClass === "tab-skills") fabBtn.addClass("fab-skills");
        // Show/hide quest list based on active tab
        questListContainer.style.display =
          text === "QUESTS" ? "flex" : "none";
        habitsContent.style.display =
          text === "HABITS" ? "flex" : "none";
        skillsContent.style.display =
          text === "SKILLS" ? "flex" : "none";
      });

      return btn;
    };

    const questTab = createTab("scroll-text", "QUESTS");
    const habitsTab = createTab("list-todo", "HABITS", "tab-habits");
    const skillsTab = createTab("book-open", "SKILLS", "tab-skills");
    questTab.addClass("active-tab");

    // --- TAB CONTENT AREAS ---
    const questListContainer = container.createEl("div", {
      cls: "quest-list-container",
    });
    this.renderQuestList(questListContainer);

    const habitsContent = container.createEl("div", {
      cls: "quest-list-container",
    });
    habitsContent.addClass("habit-list-container");
    this.renderHabitList(habitsContent);
    habitsContent.style.display = "none";

    const skillsContent = container.createEl("div", {
      cls: "quest-list-container skill-list-container",
    });
    skillsContent.style.display = "none";
    this.renderSkillList(skillsContent);

    // --- COMPLETED VIEW OVERLAY ---
    const completedOverlay = container.createEl("div", { cls: "completed-overlay" });
    const completedHeader = completedOverlay.createEl("div", { cls: "completed-header" });
    const completedHamburger = completedHeader.createEl("button", { cls: "topbar-hamburger" });
    setIcon(completedHamburger, "menu");
    completedHamburger.addEventListener("click", () => {
      buildMenu();
      menuOverlay.addClass("open");
    });
    const backBtn = completedHeader.createEl("button", {
      text: "← Back",
      cls: "completed-back-btn",
    });
    completedHeader.createEl("span", {
      text: "Completed Quests",
      cls: "completed-title",
    });
    const completedListContainer = completedOverlay.createEl("div", {
      cls: "completed-list-container",
    });
    completedOverlay.style.display = "none";

    // Helper: switch between active and completed views
    const switchView = (view, targetTab) => {
      currentView = view;
      if (view === "completed") {
        completedOverlay.style.display = "flex";
        this.renderCompletedList(completedListContainer);
      } else {
        completedOverlay.style.display = "none";
        // If a target tab was specified, update activeTab and tab bar
        if (targetTab) {
          activeTab = targetTab;
          allTabs.forEach((t) => t.removeClass("active-tab"));
          const tabMap = { QUESTS: questTab, HABITS: habitsTab, SKILLS: skillsTab };
          if (tabMap[targetTab]) tabMap[targetTab].addClass("active-tab");
          fabBtn.removeClass("fab-habits");
          fabBtn.removeClass("fab-skills");
          if (targetTab === "HABITS") fabBtn.addClass("fab-habits");
          if (targetTab === "SKILLS") fabBtn.addClass("fab-skills");
        }
        // Restore the right content based on active tab
        questListContainer.style.display = activeTab === "QUESTS" ? "flex" : "none";
        habitsContent.style.display = activeTab === "HABITS" ? "flex" : "none";
        skillsContent.style.display = activeTab === "SKILLS" ? "flex" : "none";
      }
    };

    backBtn.addEventListener("click", () => switchView("active"));

    // --- QUEST DETAIL OVERLAY ---
    const detailOverlay = this.containerEl.createEl("div", {
      cls: "quest-detail-overlay",
    });
    detailOverlay.addEventListener("click", (e) => {
      if (e.target === detailOverlay) {
        detailOverlay.removeClass("open");
      }
    });
    const detailBox = detailOverlay.createEl("div", {
      cls: "quest-detail-box",
    });

    // --- SKILL CREATION MODAL ---
    const skillOverlay = this.containerEl.createEl("div", {
      cls: "quest-creation-overlay",
    });
    skillOverlay.addEventListener("click", (e) => {
      if (e.target === skillOverlay) {
        skillOverlay.removeClass("open");
      }
    });
    const skillModalBox = skillOverlay.createEl("div", { cls: "quest-modal skill-context" });

    const skillModalHeader = skillModalBox.createEl("div", { cls: "quest-modal-header" });
    const skillHeaderIcon = skillModalHeader.createEl("span", { cls: "quest-modal-header-icon" });
    setIcon(skillHeaderIcon, "zap");
    skillModalHeader.createEl("span", { text: "New Skill" });

    const skillNameInput = skillModalBox.createEl("input", {
      type: "text",
      placeholder: "Skill Name...",
      cls: "quest-modal-title",
    });
    const skillDescInput = skillModalBox.createEl("textarea", {
      attr: { placeholder: "Description..." },
      cls: "quest-modal-desc",
    });

    const skillInfo = skillModalBox.createEl("div", { cls: "skill-creation-info" });
    skillInfo.createEl("span", {
      text: "Skills level up automatically when attached to quests or habits.",
      cls: "skill-creation-info-text",
    });

    const skillBtnContainer = skillModalBox.createEl("div", {
      cls: "quest-modal-buttons",
    });
    const skillCancelBtn = skillBtnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn",
    });
    const skillCreateBtn = skillBtnContainer.createEl("button", {
      cls: "quest-modal-create-btn",
    });
    const skillCreateBtnIcon = skillCreateBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon",
    });
    setIcon(skillCreateBtnIcon, "plus");
    skillCreateBtn.createEl("span", { text: "Create Skill" });

    const closeSkillOverlay = () => {
      skillOverlay.removeClass("open");
      skillNameInput.value = "";
      skillDescInput.value = "";
    };

    skillCancelBtn.addEventListener("click", closeSkillOverlay);

    skillCreateBtn.addEventListener("click", async () => {
      if (skillNameInput.value.trim() !== "") {
        const skill = {
          id: Date.now().toString(),
          name: skillNameInput.value.trim(),
          description: skillDescInput.value.trim(),
          xp: 0,
          level: 1,
          legendary: false,
          created: new Date().toISOString(),
        };
        this.plugin.settings.skills.push(skill);
        await this.plugin.saveSettings();
        await QuestLogView.writeSkillFile(this.plugin, skill);
        this.renderSkillList(skillsContent);
        new Notice(`Created Skill: ${skill.name}`);
        closeSkillOverlay();
      } else {
        new Notice("Add Skill Name First!");
      }
    });

    // Store references for rendering
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
    const confirmOverlay = this.containerEl.createEl("div", {
      cls: "delete-confirm-overlay open",
    });
    const confirmBox = confirmOverlay.createEl("div", {
      cls: "quest-modal delete-confirm-modal",
    });

    const headerRow = confirmBox.createEl("div", { cls: "delete-confirm-header" });
    const warnIcon = headerRow.createEl("span", { cls: "delete-confirm-icon" });
    setIcon(warnIcon, "alert-triangle");
    headerRow.createEl("span", {
      text: "Confirm Delete",
      cls: "delete-confirm-title",
    });

    confirmBox.createEl("p", {
      text: `Are you sure you want to delete "${title}"?`,
      cls: "delete-confirm-desc",
    });

    const btnRow = confirmBox.createEl("div", { cls: "delete-confirm-buttons" });
    const cancelBtn = btnRow.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn",
    });
    cancelBtn.addEventListener("click", () => confirmOverlay.remove());
    confirmOverlay.addEventListener("click", (e) => {
      if (e.target === confirmOverlay) confirmOverlay.remove();
    });

    const confirmBtn = btnRow.createEl("button", {
      text: "Delete",
      cls: "delete-confirm-btn",
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
    const quests = this.plugin.settings.quests;

    if (quests.length === 0) {
      container.createEl("div", {
        text: "No active quests. Tap + to create one.",
        cls: "quest-list-empty",
      });
      return;
    }

    quests.forEach((quest) => {
      const block = container.createEl("div", { cls: "quest-block" });

      // Title
      block.createEl("div", {
        text: quest.title,
        cls: "quest-block-title",
      });

      // Description with fade
      if (quest.description) {
        const descWrap = block.createEl("div", {
          cls: "quest-block-desc-wrap",
        });
        descWrap.createEl("span", {
          text: quest.description,
          cls: "quest-block-desc-text",
        });
      }

      // XP badge
      block.createEl("div", {
        text: `${quest.xp.toLocaleString()} XP`,
        cls: "quest-block-xp",
      });

      // Complete button
      const completeBtn = block.createEl("button", { cls: "quest-complete-btn" });
      const completeIcon = completeBtn.createEl("span", { cls: "quest-btn-icon" });
      setIcon(completeIcon, "check");
      completeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.completeQuest(quest);
      });

      // Click to open detail
      block.addEventListener("click", () => {
        this.openQuestDetail(quest);
      });
    });
  }

  // ----------------------------------------
  // QUEST DETAIL VIEW
  // ----------------------------------------

  openQuestDetail(quest) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    box.empty();
    box.removeClass("habit-context");
    overlay.addClass("open");

    // Header row: "Quest Details" title + [open note + delete icon]
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Quest Details",
      cls: "quest-detail-modal-title",
    });

    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });

    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn",
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon",
    });
    setIcon(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
      const safeName = QuestLogView.safeName(quest.title);
      const fullPath = `${folderPath}/${safeName}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });

    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn",
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon",
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(quest.title, async () => {
        await QuestLogView.deleteQuestFile(this.plugin, quest);
        this.plugin.settings.quests = this.plugin.settings.quests.filter(
          (q) => q.id !== quest.id,
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderQuestList(this._questListContainer);
        new Notice("Quest deleted.");
      });
    });

    // Editable title
    const titleInput = box.createEl("input", {
      type: "text",
      value: quest.title,
      cls: "quest-detail-title-input",
    });

    // Editable description
    const descBox = box.createEl("textarea", {
      text: quest.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." },
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";

    // --- SLIDERS ---
    const slidersSection = box.createEl("div", {
      cls: "quest-sliders-section",
    });

    const xpPreview = { el: null };

    const updateXpPreview = () => {
      const xp = QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue(),
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    };

    const diffSlider = this.createSlider(
      slidersSection, "Difficulty", QuestLogView.DIFFICULTY_LABELS,
      "#4A9FFF", quest.difficulty || 3, updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection, "Urgency", QuestLogView.URGENCY_LABELS,
      "#FFB800", quest.urgency || 3, updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection, "Impact", QuestLogView.IMPACT_LABELS,
      "#C05BFF", quest.impact || 3, updateXpPreview
    );

    // XP preview
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${quest.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value",
    });

    // --- SKILL ATTACHMENT ---
    const skillsSection = box.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });

    const selectedSkillIds = [...(quest.skillIds || [])];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });

    const updateSelectedSkillsDisplay = () => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          setIcon(removeBtn, "x");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = selectedSkillIds.indexOf(skillId);
            if (idx > -1) selectedSkillIds.splice(idx, 1);
            updateSelectedSkillsDisplay();
          });
        }
      });
      if (selectedSkillIds.length === 0) {
        selectedSkillsDisplay.createEl("span", {
          text: "No skills attached",
          cls: "detail-skills-placeholder",
        });
      }
    };
    updateSelectedSkillsDisplay();

    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input",
    });

    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };

    // Helper to save current values back to quest
    const saveQuest = async () => {
      quest.title = titleInput.value.trim() || quest.title;
      quest.description = descBox.value.trim();
      quest.difficulty = diffSlider._getValue();
      quest.urgency = urgSlider._getValue();
      quest.impact = impSlider._getValue();
      quest.xp = QuestLogView.calcXp(quest.difficulty, quest.urgency, quest.impact);
      quest.skillIds = [...selectedSkillIds];
      await this.plugin.saveSettings();
      await QuestLogView.writeQuestFile(this.plugin, quest);
      this.renderQuestList(this._questListContainer);
    };

    // Buttons
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });

    // Spacer to push Close/Complete to the right
    btnRow.createEl("div", { cls: "quest-detail-spacer" });

    // Close button (saves edits before closing)
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.addEventListener("click", async () => {
      await saveQuest();
      overlay.removeClass("open");
    });

    // Complete button
    const completeBtn = btnRow.createEl("button", {
      text: "Complete",
      cls: "quest-detail-complete-btn",
    });
    const completeIcon = completeBtn.createEl("span", {
      cls: "quest-detail-complete-icon",
    });
    setIcon(completeIcon, "check");
    completeBtn.addEventListener("click", async () => {
      await saveQuest();
      overlay.removeClass("open");
      await this.completeQuest(quest);
      this.renderSkillList(this._skillListContainer);
      this.onOpen();
    });
  }


  // ----------------------------------------
  // QUEST ACTIONS
  // ----------------------------------------

  async completeQuest(quest) {
    await QuestLogView.completeQuestFile(this.plugin, quest);

    const adapter = this.app.vault.adapter;
    const questsFolder = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
    const completedFolder = this.plugin.settings.completedFolderPath || "Quest Log/Completed";
    const safeName = QuestLogView.safeName(quest.title);
    const sourcePath = `${questsFolder}/${safeName}.md`;
    const destPath = `${completedFolder}/${safeName}.md`;
    try {
      try { await adapter.mkdir(completedFolder); } catch (e) {}
      await adapter.rename(sourcePath, destPath);
    } catch (e) {}

    this.plugin.settings.currentXp += quest.xp;
    this.plugin.settings.questsCompleted += 1;

    if (quest.skillIds && quest.skillIds.length > 0) {
      await this.applyXpToSkills(quest.xp, quest.skillIds);
    }

    const completedQuest = { ...quest, completedAt: new Date().toISOString() };
    this.plugin.settings.completedQuests.push(completedQuest);
    this.plugin.settings.quests = this.plugin.settings.quests.filter(
      (q) => q.id !== quest.id,
    );
    await this.plugin.saveSettings();
    this.renderQuestList(this._questListContainer);
    this.updateHeader();
    new Notice(`Quest Complete! +${quest.xp.toLocaleString()} XP`);
  }

  // ----------------------------------------
  // HABIT LIST RENDERING
  // ----------------------------------------

  renderHabitList(container) {
    container.empty();
    const habits = this.plugin.settings.habits;

    if (habits.length === 0) {
      container.createEl("div", {
        text: "No active habits. Tap + to create one.",
        cls: "quest-list-empty",
      });
      return;
    }

    habits.forEach((habit) => {
      const block = container.createEl("div", { cls: "quest-block" });
      block.addClass("habit-block");

      // Title
      block.createEl("div", {
        text: habit.title,
        cls: "quest-block-title",
      });

      // Description with fade
      if (habit.description) {
        const descWrap = block.createEl("div", {
          cls: "quest-block-desc-wrap",
        });
        descWrap.createEl("span", {
          text: habit.description,
          cls: "quest-block-desc-text",
        });
      }

      // XP badge
      block.createEl("div", {
        text: `${habit.xp.toLocaleString()} XP`,
        cls: "quest-block-xp",
      });

      // Action buttons row
      const actionRow = block.createEl("div", { cls: "habit-action-row" });

      // Fail button (left) - minimal X icon
      const failBtn = actionRow.createEl("button", { cls: "habit-fail-btn-mini" });
      const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(failIcon, "x");
      failBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.failHabit(habit);
      });

      // Complete button (right) - minimal check icon
      const completeBtn = actionRow.createEl("button", { cls: "habit-complete-btn-mini" });
      const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(completeIcon, "check");
      completeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.completeHabit(habit);
      });

      // Click to open detail
      block.addEventListener("click", () => {
        this.openHabitDetail(habit);
      });
    });
  }

  // ----------------------------------------
  // HABIT ACTIONS
  // ----------------------------------------

  async completeHabit(habit) {
    const completedAt = new Date().toISOString();
    const completedHabit = { ...habit, completedAt };
    this.plugin.settings.completedHabits.push(completedHabit);
    this.plugin.settings.currentXp += habit.xp;
    this.plugin.settings.questsCompleted += 1;

    if (habit.skillIds && habit.skillIds.length > 0) {
      await this.applyXpToSkills(habit.xp, habit.skillIds);
    }
    
    await this.plugin.saveSettings();
    await QuestLogView.writeCompletedHabitFile(this.plugin, habit, completedAt);
    this.updateHeader();
    this.renderHabitList(this._habitListContainer);
    this.renderSkillList(this._skillListContainer);
    new Notice(`Habit completed: ${habit.title}`);
  }

  async failHabit(habit) {
    this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
    await this.plugin.saveSettings();
    this.updateHeader();
    new Notice(`Habit failed: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
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
        skill.level = QuestLogView.getSkillLevel(skill.xp, difficulty);
        await QuestLogView.writeSkillFile(this.plugin, skill);
      }
    }
  }

  // ----------------------------------------
  // SKILL LIST RENDERING
  // ----------------------------------------

  renderSkillList(container) {
    container.empty();
    const skills = this.plugin.settings.skills || [];

    if (skills.length === 0) {
      container.createEl("div", {
        text: "No skills yet. Tap + to create one.",
        cls: "quest-list-empty",
      });
      return;
    }

    const grid = container.createEl("div", { cls: "skill-grid" });

    skills.forEach((skill) => {
      const block = grid.createEl("div", { cls: "quest-block skill-block" });

      const difficulty = this.plugin.settings.userDifficulty || 10;
      const xpInfo = QuestLogView.getSkillXpProgress(skill, difficulty);

      block.createEl("div", {
        text: skill.name,
        cls: "quest-block-title",
      });

      if (skill.description) {
        const noteIcon = block.createEl("span", { cls: "skill-note-icon" });
        setIcon(noteIcon, "file-text");
      }

      const levelBadge = block.createEl("div", { cls: "skill-level-badge" });
      if (skill.legendary) {
        levelBadge.setText("★ Lvl " + skill.level);
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

  openSkillDetail(skill) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    box.empty();
    box.addClass("skill-context");
    overlay.addClass("open");

    const difficulty = this.plugin.settings.skillDifficulty || 10;

    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Skill Details",
      cls: "quest-detail-modal-title",
    });

    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });

    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn",
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon",
    });
    setIcon(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.skillsFolderPath || "Quest Log/Skills";
      const safeName = QuestLogView.safeName(skill.name);
      const fullPath = `${folderPath}/${safeName}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });

    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn",
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon",
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(skill.name, async () => {
        await QuestLogView.deleteSkillFile(this.plugin, skill);
        this.plugin.settings.skills = this.plugin.settings.skills.filter(
          (s) => s.id !== skill.id,
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderSkillList(this._skillListContainer);
        new Notice("Skill deleted.");
      });
    });

    const nameInput = box.createEl("input", {
      type: "text",
      value: skill.name,
      cls: "quest-detail-title-input",
    });

    const descBox = box.createEl("textarea", {
      text: skill.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." },
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";

    const xpInfo = QuestLogView.getSkillXpProgress(skill, difficulty);

    const levelSection = box.createEl("div", { cls: "skill-level-section" });
    const levelRow = levelSection.createEl("div", { cls: "skill-level-row" });
    levelRow.createEl("span", { text: "Level", cls: "skill-level-label" });
    levelRow.createEl("span", {
      text: skill.legendary ? `★ ${skill.level}` : `${skill.level}`,
      cls: "skill-level-value",
    });

    const skillXpBar = levelSection.createEl("div", { cls: "skill-detail-xp-bar" });
    const skillXpFill = skillXpBar.createEl("div", { cls: "skill-detail-xp-fill" });
    skillXpFill.style.width = `${xpInfo.pct}%`;
    levelSection.createEl("span", {
      text: `${xpInfo.xpProgress.toLocaleString()} / ${xpInfo.xpNeeded.toLocaleString()} XP`,
      cls: "skill-xp-progress-text",
    });

    const skillInfo = box.createEl("div", { cls: "skill-detail-info" });
    skillInfo.createEl("span", {
      text: "Attach this skill to quests or habits to gain XP.",
      cls: "skill-detail-info-text",
    });

    const saveSkill = async () => {
      skill.name = nameInput.value.trim() || skill.name;
      skill.description = descBox.value.trim();
      await this.plugin.saveSettings();
      await QuestLogView.writeSkillFile(this.plugin, skill);
      this.renderSkillList(this._skillListContainer);
    };

    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });

    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.style.flex = "1";
    closeBtn.addEventListener("click", async () => {
      await saveSkill();
      overlay.removeClass("open");
    });
  }

  // ----------------------------------------
  // HABIT DETAIL VIEW
  // ----------------------------------------

  openHabitDetail(habit) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    box.empty();
    box.addClass("habit-context");
    overlay.addClass("open");

    // Header row: "Habit Details" title + [open note + delete icon]
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Habit Details",
      cls: "quest-detail-modal-title",
    });

    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });

    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn",
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon",
    });
    setIcon(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.habitsFolderPath || "Quest Log/Habits";
      const safeName = QuestLogView.safeName(habit.title);
      const fullPath = `${folderPath}/${safeName}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });

    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn",
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon",
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(habit.title, async () => {
        await QuestLogView.deleteHabitFile(this.plugin, habit);
        this.plugin.settings.habits = this.plugin.settings.habits.filter(
          (h) => h.id !== habit.id,
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderHabitList(this._habitListContainer);
        new Notice("Habit deleted.");
      });
    });

    // Editable title
    const titleInput = box.createEl("input", {
      type: "text",
      value: habit.title,
      cls: "quest-detail-title-input",
    });

    // Editable description
    const descBox = box.createEl("textarea", {
      text: habit.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." },
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";

    // --- SLIDERS ---
    const slidersSection = box.createEl("div", {
      cls: "quest-sliders-section",
    });

    const xpPreview = { el: null };

    const updateXpPreview = () => {
      const xp = QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue(),
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    };

    const diffSlider = this.createSlider(
      slidersSection, "Difficulty", QuestLogView.DIFFICULTY_LABELS,
      "#5e87ff", habit.difficulty || 3, updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection, "Urgency", QuestLogView.URGENCY_LABELS,
      "#f59e0b", habit.urgency || 3, updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection, "Impact", QuestLogView.IMPACT_LABELS,
      "#a855f7", habit.impact || 3, updateXpPreview
    );

    // XP preview
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${habit.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value",
    });

    const createdDate = QuestLogView.formatDate(habit.created);
    const metaRow = box.createEl("div", { cls: "habit-detail-meta" });
    metaRow.createEl("span", {
      text: `Created ${createdDate}`,
      cls: "habit-detail-meta-text",
    });

    // --- SKILL ATTACHMENT ---
    const skillsSection = box.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });

    const selectedSkillIds = [...(habit.skillIds || [])];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });

    const updateSelectedSkillsDisplay = () => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          setIcon(removeBtn, "x");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = selectedSkillIds.indexOf(skillId);
            if (idx > -1) selectedSkillIds.splice(idx, 1);
            updateSelectedSkillsDisplay();
          });
        }
      });
      if (selectedSkillIds.length === 0) {
        selectedSkillsDisplay.createEl("span", {
          text: "No skills attached",
          cls: "detail-skills-placeholder",
        });
      }
    };
    updateSelectedSkillsDisplay();

    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input",
    });

    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };

    // Helper to save current values back to habit
    const saveHabit = async () => {
      habit.title = titleInput.value.trim() || habit.title;
      habit.description = descBox.value.trim();
      habit.difficulty = diffSlider._getValue();
      habit.urgency = urgSlider._getValue();
      habit.impact = impSlider._getValue();
      habit.xp = QuestLogView.calcXp(habit.difficulty, habit.urgency, habit.impact);
      habit.skillIds = [...selectedSkillIds];
      await this.plugin.saveSettings();
      await QuestLogView.writeHabitFile(this.plugin, habit);
      this.renderHabitList(this._habitListContainer);
    };

    // Buttons
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });

    // Fail button (left)
    const failBtn = btnRow.createEl("button", {
      text: "Fail",
      cls: "habit-fail-btn",
    });
    const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
    setIcon(failIcon, "x");
    failBtn.addEventListener("click", async () => {
      await this.failHabit(habit);
      overlay.removeClass("open");
    });

    // Close button (center)
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.addEventListener("click", async () => {
      await saveHabit();
      overlay.removeClass("open");
    });

    // Complete button (right)
    const completeBtn = btnRow.createEl("button", {
      text: "Complete",
      cls: "habit-complete-btn",
    });
    const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
    setIcon(completeIcon, "check");
    completeBtn.addEventListener("click", async () => {
      await saveHabit();
      await this.completeHabit(habit);
      overlay.removeClass("open");
    });
  }

  // ----------------------------------------
  // COMPLETED LIST RENDERING (Quests + Habits merged)
  // ----------------------------------------

  renderCompletedList(container) {
    container.empty();

    const completedQuests = (this.plugin.settings.completedQuests || []).map((q) => ({
      ...q,
      _type: "quest",
    }));
    const completedHabits = (this.plugin.settings.completedHabits || []).map((h) => ({
      ...h,
      _type: "habit",
    }));

    const allCompleted = [...completedQuests, ...completedHabits];

    if (allCompleted.length === 0) {
      container.createEl("div", {
        text: "No completed quests or habits yet.",
        cls: "quest-list-empty",
      });
      return;
    }

    // Sort by completedAt descending (newest first)
    const sorted = [...allCompleted].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    sorted.forEach((item) => {
      const block = container.createEl("div", { cls: "completed-block" });

      // Title (habits show with repeat indicator)
      const titleText = item._type === "habit"
        ? `${item.title} \u{1F504}`
        : item.title;
      block.createEl("div", {
        text: titleText,
        cls: "completed-block-title",
      });

      // Meta row
      const meta = block.createEl("div", { cls: "completed-block-meta" });

      // XP earned
      meta.createEl("span", {
        text: `${item.xp.toLocaleString()} XP`,
        cls: "completed-block-xp",
      });

      // Type label for habits
      if (item._type === "habit") {
        meta.createEl("span", {
          text: "Habit",
          cls: "completed-block-type",
        });
      }

      // Completed date
      meta.createEl("span", {
        text: QuestLogView.formatDate(item.completedAt),
        cls: "completed-block-date",
      });

      // Click to open detail
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
    box.empty();
    box.removeClass("habit-context");
    overlay.addClass("open");

    // Read-only title
    box.createEl("h2", {
      text: quest.title,
      cls: "quest-detail-title",
    });

    // Read-only description
    if (quest.description) {
      box.createEl("p", {
        text: quest.description,
        cls: "quest-detail-desc",
        attr: { style: "background: transparent; border: none; padding: 0; color: #ccc; resize: none;" },
      });
    }

    const stars = (n) => "\u2B50".repeat(n);

    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", quest.xp.toLocaleString()],
      ["Difficulty", stars(quest.difficulty)],
      ["Urgency", stars(quest.urgency)],
      ["Impact", stars(quest.impact)],
      ["Created", QuestLogView.formatDate(quest.created)],
      ["Completed", QuestLogView.formatDate(quest.completedAt)],
    ];
    rows.forEach(([label, value]) => {
      const tr = statsTable.createEl("tr");
      const td1 = tr.createEl("td", { text: label });
      td1.style.cssText = "color: #888; padding: 4px 8px 4px 0; font-weight: bold;";
      const td2 = tr.createEl("td", { text: value });
      td2.style.cssText = "color: #fff; padding: 4px 0; text-align: right;";
    });

    // Buttons
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    btnRow.style.justifyContent = "center";

    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.addEventListener("click", () => {
      overlay.removeClass("open");
    });

    const undoBtn = btnRow.createEl("button", {
      text: "Undo Completion",
      cls: "quest-undo-btn",
    });
    undoBtn.addEventListener("click", async () => {
      const idx = this.plugin.settings.completedQuests.findIndex((q) => q.id === quest.id);
      if (idx === -1) {
        new Notice("Quest not found.");
        overlay.removeClass("open");
        return;
      }
      const [restored] = this.plugin.settings.completedQuests.splice(idx, 1);
      const { completedAt, ...activeQuest } = restored;
      this.plugin.settings.quests.push(activeQuest);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - restored.xp);
      this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
      await this.plugin.saveSettings();
      try {
        const adapter = this.app.vault.adapter;
        const questsFolder = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
        const completedFolder = this.plugin.settings.completedFolderPath || "Quest Log/Completed";
        const safeName = QuestLogView.safeName(activeQuest.title);
        const srcPath = `${completedFolder}/${safeName}.md`;
        const destPath = `${questsFolder}/${safeName}.md`;
        try { await adapter.mkdir(questsFolder); } catch (e) {}
        await adapter.rename(srcPath, destPath);
      } catch (e) {
        await QuestLogView.writeQuestFile(this.plugin, activeQuest);
      }
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      this.renderQuestList(this._questListContainer);
      new Notice(`Quest restored: ${restored.title}`);
    });
  }

  // ----------------------------------------
  // COMPLETED HABIT DETAIL (with Undo)
  // ----------------------------------------

  openCompletedHabitDetail(habit) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    box.empty();
    box.addClass("habit-context");
    overlay.addClass("open");

    // Title
    box.createEl("h2", {
      text: habit.title,
      cls: "quest-detail-title",
    });

    // Description
    if (habit.description) {
      box.createEl("p", {
        text: habit.description,
        cls: "quest-detail-desc",
        attr: { style: "background: transparent; border: none; padding: 0; color: #ccc; resize: none;" },
      });
    }

    const stars = (n) => "\u2B50".repeat(n);

    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", habit.xp.toLocaleString()],
      ["Difficulty", stars(habit.difficulty)],
      ["Urgency", stars(habit.urgency)],
      ["Impact", stars(habit.impact)],
      ["Type", "Habit (Repeatable)"],
      ["Completed", QuestLogView.formatDate(habit.completedAt)],
    ];
    rows.forEach(([label, value]) => {
      const tr = statsTable.createEl("tr");
      const td1 = tr.createEl("td", { text: label });
      td1.style.cssText = "color: #888; padding: 4px 8px 4px 0; font-weight: bold;";
      const td2 = tr.createEl("td", { text: value });
      td2.style.cssText = "color: #fff; padding: 4px 0; text-align: right;";
    });

    // Buttons
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    btnRow.style.justifyContent = "center";

    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.addEventListener("click", () => {
      overlay.removeClass("open");
    });

    const undoBtn = btnRow.createEl("button", {
      text: "Undo Completion",
      cls: "quest-undo-btn",
    });
    undoBtn.addEventListener("click", async () => {
      const idx = this.plugin.settings.completedHabits.findIndex(
        (h) => h.id === habit.id && h.completedAt === habit.completedAt
      );
      if (idx === -1) {
        new Notice("Completed habit not found.");
        overlay.removeClass("open");
        return;
      }
      this.plugin.settings.completedHabits.splice(idx, 1);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
      this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
      await this.plugin.saveSettings();
      await QuestLogView.deleteCompletedHabitFile(this.plugin, habit, habit.completedAt);
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      new Notice(`Habit completion undone: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
    });
  }

  async onClose() {}
};

module.exports = QuestLog;
