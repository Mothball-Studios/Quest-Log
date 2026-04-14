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
  skillDifficulty: 1,
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

  /**
   * Delete a folder and all its contents if it exists.
   * @param {string} folderPath - The path to the folder to delete
   */
  async deleteFolderIfExists(folderPath) {
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (folder) {
        await this.app.vault.delete(folder, true);
      }
    } catch (e) {
      // Folder doesn't exist or can't be deleted - that's fine
    }
  }

  /**
   * Delete a file if it exists.
   * @param {string} filePath - The path to the file to delete
   */
  async deleteFileIfExists(filePath) {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.vault.delete(file, true);
      }
    } catch (e) {
      // File doesn't exist or can't be deleted - that's fine
    }
  }

  /**
   * Perform a factory reset: delete all data folders, files, and reset settings.
   */
  async performFactoryReset() {
    const settings = this.settings;

    // Build list of folders to wipe
    const foldersToWipe = [
      settings.questsFolderPath || "Quest Log/Quests",
      settings.habitsFolderPath || "Quest Log/Habits",
      settings.skillsFolderPath || "Quest Log/Skills",
      settings.completedFolderPath || "Quest Log/Completed",
    ];

    // Delete all folders recursively
    for (const folder of foldersToWipe) {
      await this.deleteFolderIfExists(folder);
    }

    // Delete User Profile file
    const userProfileFolder = settings.userProfileFolder || "Quest Log";
    const userProfileFile = settings.userProfileFileName || "User Profile";
    const userProfilePath = userProfileFolder + "/" + userProfileFile + ".md";
    await this.deleteFileIfExists(userProfilePath);

    // Reset settings to defaults
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    
    // Save settings (this also invalidates cache and writes user profile)
    await this.saveSettings();

    return true;
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

    // Generate next level milestones
    const milestones = QuestLogView.getNextMilestones(settings.currentXp, difficulty, 6);
    const milestonesRows = milestones.map(m => 
      `| ${m.level} | ${m.totalXp.toLocaleString()} | ${m.xpRemaining.toLocaleString()} |`
    ).join('\n');

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

| Current XP | XP for Next Level | Progress |
|:----------:|:-----------------:|:--------:|
| ${settings.currentXp.toLocaleString()} | ${xpNeeded.toLocaleString()} | ${bar} ${pct}% |

---

## Next Level Milestones

| Target Level | Total XP Needed | XP Remaining |
|:------------:|:---------------:|:------------:|
${milestonesRows}

---

## Stats Summary

| Stat | Value |
|:-----|:-----:|
| **Level** | ${level} |
| **Title** | ${title} |
| **Current XP** | ${settings.currentXp.toLocaleString()} |
| **XP to Next Level** | ${(xpForNext - settings.currentXp).toLocaleString()} |
| **Quests Completed** | ${questsDone} |
| **Difficulty** | ${difficulty} |

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

    let userDifficultySetting;
    userDifficultySetting = new Setting(containerEl)
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
            if (typeof renderUserXpTable === 'function') renderUserXpTable();
          }),
      );

    let skillDifficultySetting;
    skillDifficultySetting = new Setting(containerEl)
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
            if (typeof renderSkillXpTable === 'function') renderSkillXpTable();
          }),
      );

    // --- USER XP CURVE PREVIEW ---
    containerEl.createEl("h4", { text: "⚔️ User XP Curve (Levels 1-5)" });

    const userCurveContainer = containerEl.createEl("div", { cls: "xp-curve-table-container" });
    
    const renderUserXpTable = () => {
      userCurveContainer.empty();
      const difficulty = this.plugin.settings.userDifficulty || 10;
      const table = QuestLogView.generateXpCurveTable(difficulty, 5);
      
      const tableEl = userCurveContainer.createEl("table", { cls: "xp-curve-table" });
      const thead = tableEl.createEl("thead");
      const headerRow = thead.createEl("tr");
      headerRow.createEl("th", { text: "Level" });
      headerRow.createEl("th", { text: "Total XP" });
      headerRow.createEl("th", { text: "XP for Level" });
      
      const tbody = tableEl.createEl("tbody");
      table.forEach(row => {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: row.level.toString() });
        tr.createEl("td", { text: row.totalXp.toLocaleString() });
        tr.createEl("td", { text: row.deltaXp.toLocaleString() });
      });
    };
    
    renderUserXpTable();

    // --- SKILL XP CURVE PREVIEW ---
    containerEl.createEl("h4", { text: "🌟 Skill XP Curve (Levels 1-5)" });

    const skillCurveContainer = containerEl.createEl("div", { cls: "xp-curve-table-container" });
    
    const renderSkillXpTable = () => {
      skillCurveContainer.empty();
      const difficulty = this.plugin.settings.skillDifficulty || 10;
      const table = QuestLogView.generateXpCurveTable(difficulty, 5);
      
      const tableEl = skillCurveContainer.createEl("table", { cls: "xp-curve-table" });
      const thead = tableEl.createEl("thead");
      const headerRow = thead.createEl("tr");
      headerRow.createEl("th", { text: "Level" });
      headerRow.createEl("th", { text: "Total XP" });
      headerRow.createEl("th", { text: "XP for Level" });
      
      const tbody = tableEl.createEl("tbody");
      table.forEach(row => {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: row.level.toString() });
        tr.createEl("td", { text: row.totalXp.toLocaleString() });
        tr.createEl("td", { text: row.deltaXp.toLocaleString() });
      });
    };
    
    renderSkillXpTable();

    // View Full Curve buttons
    const btnRow = containerEl.createEl("div", { cls: "xp-curve-btn-row" });
    
    const viewUserCurveBtn = btnRow.createEl("button", {
      text: "View User Curve (1-100)",
      cls: "xp-curve-full-btn",
    });
    viewUserCurveBtn.addEventListener("click", () => {
      new XpCurveModal(this.app, this.plugin.settings.userDifficulty || 10, "user").open();
    });

    const viewSkillCurveBtn = btnRow.createEl("button", {
      text: "View Skill Curve (1-100)",
      cls: "xp-curve-full-btn",
    });
    viewSkillCurveBtn.addEventListener("click", () => {
      new XpCurveModal(this.app, this.plugin.settings.skillDifficulty || 10, "skill").open();
    });

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

/**
 * XP Curve Modal — Shows the full XP curve table for levels 1-100
 */
var XpCurveModal = class extends Modal {
  constructor(app, difficulty, type = "user") {
    super(app);
    this.difficulty = difficulty;
    this.type = type;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("xp-curve-modal-content");

    // Header
    const header = contentEl.createEl("div", { cls: "xp-curve-modal-header" });
    const title = this.type === "skill" ? "🌟 Skill XP Curve" : "⚔️ User XP Curve";
    header.createEl("h2", { text: `📊 ${title} — Difficulty ${this.difficulty}` });
    
    const desc = contentEl.createEl("p", {
      text: "Total XP needed to reach each level. The delta column shows XP required FOR that specific level.",
      cls: "xp-curve-modal-desc"
    });

    // Generate and display full table
    const table = QuestLogView.generateXpCurveTable(this.difficulty, 100);
    
    const tableWrapper = contentEl.createEl("div", { cls: "xp-curve-modal-table-wrapper" });
    const tableEl = tableWrapper.createEl("table", { cls: "xp-curve-modal-table" });
    
    // Header
    const thead = tableEl.createEl("thead");
    const headerRow = thead.createEl("tr");
    ["Level", "Total XP", "XP for Level", "Level", "Total XP", "XP for Level"].forEach(text => {
      headerRow.createEl("th", { text });
    });

    // Split into 2 columns for compact display
    const tbody = tableEl.createEl("tbody");
    const midPoint = 50;
    
    for (let i = 0; i < midPoint; i++) {
      const tr = tbody.createEl("tr");
      const row1 = table[i];
      const row2 = table[i + midPoint];
      
      [row1.level, row1.totalXp, row1.deltaXp].forEach(val => {
        const td = tr.createEl("td");
        td.setText(typeof val === 'number' && val >= 1000 ? val.toLocaleString() : val.toString());
      });
      
      [row2.level, row2.totalXp, row2.deltaXp].forEach(val => {
        const td = tr.createEl("td");
        td.setText(typeof val === 'number' && val >= 1000 ? val.toLocaleString() : val.toString());
      });
    }

    // Close button
    const btnRow = contentEl.createEl("div", { cls: "xp-curve-modal-btn-row" });
    const closeBtn = btnRow.createEl("button");
    closeBtn.setText("Close");
    closeBtn.addClass("xp-curve-modal-close-btn");
    closeBtn.addEventListener("click", () => this.close());
  }
};

/**
 * Reset Confirm Modal — Factory Reset for Quest Log plugin
 * Requires user to type their Hero Name to confirm the destructive action.
 */
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
    const headerRow = contentEl.createEl("div");
    headerRow.addClass("reset-modal-header-row");
    const warnIcon = headerRow.createEl("span");
    warnIcon.addClass("reset-modal-warn-icon");
    setIcon(warnIcon, "alert-triangle");
    const title = headerRow.createEl("h2");
    title.setText("⚠️ Factory Reset — Quest Log");
    title.addClass("reset-modal-header");

    // Description
    const desc1 = contentEl.createEl("p");
    desc1.setText("This will permanently delete all Quests, Habits, Skills, and Completed folders and files.");
    desc1.addClass("reset-modal-desc");
    const desc2 = contentEl.createEl("p");
    desc2.setText("It will also delete your User Profile and reset all plugin data to factory defaults.");
    desc2.addClass("reset-modal-desc");
    const desc3 = contentEl.createEl("p");
    desc3.setText("This action is irreversible.");
    desc3.addClass("reset-modal-desc");

    // Confirmation input label
    const confirmLabel = contentEl.createEl("div");
    confirmLabel.addClass("reset-modal-confirm-label");
    confirmLabel.createEl("span").setText("Type your Hero Name to confirm: ");

    // Confirmation input
    const inputEl = contentEl.createEl("input");
    inputEl.type = "text";
    inputEl.placeholder = this.plugin.settings.heroName;
    inputEl.addClass("reset-modal-input");

    // Buttons row
    const btnRow = contentEl.createEl("div");
    btnRow.addClass("reset-modal-btn-row");

    // Cancel button
    const cancelBtn = btnRow.createEl("button");
    cancelBtn.setText("Cancel");
    cancelBtn.addClass("reset-modal-cancel-btn");
    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    // Confirm button (disabled until hero name matches)
    const confirmBtn = btnRow.createEl("button");
    confirmBtn.setText("Reset to Factory Defaults");
    confirmBtn.addClass("reset-modal-confirm-btn");
    confirmBtn.disabled = true;

    // Enable/disable confirm button based on input
    inputEl.addEventListener("input", () => {
      const matches = inputEl.value === this.plugin.settings.heroName;
      confirmBtn.disabled = !matches;
    });

    // Handle reset confirmation
    confirmBtn.addEventListener("click", async () => {
      try {
        // Disable button during reset
        confirmBtn.disabled = true;
        confirmBtn.setText("Resetting...");

        // Perform the factory reset via plugin method
        await this.plugin.performFactoryReset();

        // Close this modal
        this.close();

        // Close settings tab
        try {
          this.app.setting.close();
        } catch (e) {
          // Settings may already be closed
        }

        // Refresh the Quest Log view by calling onOpen to fully rebuild
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
            if (leaves.length > 0 && leaves[0].view) {
              try {
                leaves[0].view.onOpen();
              } catch (e) {
                console.error("Quest Log: Error refreshing view", e);
              }
            }
          });
        });

        // Success notice
        new Notice("Quest Log has been reset to factory defaults.");
      } catch (error) {
        console.error("Quest Log: Factory reset failed", error);
        new Notice("Reset failed: " + error.message);
        confirmBtn.disabled = false;
        confirmBtn.setText("Reset to Factory Defaults");
      }
    });
  }
};

// ============================================================
// SKILL RADAR CHART — Premium SVG-based spider graph for skill visualization
// ============================================================
/**
 * SkillRadarChart - A premium SVG-based radar/spider chart for visualizing skills.
 * Features:
 * - Dark theme with premium RPG aesthetics
 * - Crisp spider-web concentric circles and radial lines
 * - Smooth blue filled polygon with proper opacity
 * - Smart radially-aligned labels with no overlapping
 * - Subtle vertex points (no large dots)
 * - Hover effects highlighting skill axis + tooltip
 * - Click to open skill detail
 */
var SkillRadarChart = class {
  /**
   * @param {HTMLElement} container - The container element to render into
   * @param {Array} skills - Array of skill objects { name, level, xp, legendary? }
   * @param {Function} onSkillClick - Callback when a skill is clicked
   */
  constructor(container, skills, onSkillClick) {
    this.container = container;
    this.skills = skills;
    this.onSkillClick = onSkillClick;
    
    // Calculate responsive size based on container
    const containerRect = container.getBoundingClientRect();
    const maxSize = Math.min(containerRect.width || 340, containerRect.height || 340, 340);
    this.size = Math.max(300, maxSize);
    this.center = this.size / 2;
    this.maxRadius = this.size / 2 - 50; // More room for labels
    this.numCircles = 5;
    this.polygonColor = "#5e87ff";
    this.polygonFill = "rgba(94, 135, 255, 0.4)";
    this.lineColor = "#3a3a3a";
    this.radialLineColor = "#444";
    this.textColor = "#aaa";
    this.textHoverColor = "#fff";
    this.bgColor = "transparent";
    
    // Limit to max 10 skills for clarity, sorted by level
    this.displaySkills = [...skills]
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 10);
    
    // Find max level for normalization
    this.maxLevel = Math.max(...this.displaySkills.map(s => s.level || 1), 1);
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
   * Calculate label position - SIMPLE and STABLE approach
   * Position along radial axis with simple quadrant-based anchoring
   */
  getRadialLabelPosition(angle, skillName, extraOffset = 0) {
    // Normalize angle
    let normAngle = angle;
    while (normAngle < 0) normAngle += 2 * Math.PI;
    while (normAngle >= 2 * Math.PI) normAngle -= 2 * Math.PI;
    const deg = normAngle * 180 / Math.PI;
    
    // Fixed offset beyond outer ring
    const baseOffset = 30 + extraOffset;
    const labelRadius = this.maxRadius + baseOffset;
    
    // Position along axis
    const x = this.center + labelRadius * Math.cos(normAngle - Math.PI / 2);
    const y = this.center + labelRadius * Math.sin(normAngle - Math.PI / 2);
    
    // Simple 4-quadrant anchoring
    let textAnchor, dy;
    if (deg >= 315 || deg < 45) {
      // Right: text extends right from anchor point
      textAnchor = "start";
      dy = 0;
    } else if (deg >= 45 && deg < 135) {
      // Bottom: text centered, sits below
      textAnchor = "middle";
      dy = 12;
    } else if (deg >= 135 && deg < 225) {
      // Left: text extends left from anchor point
      textAnchor = "end";
      dy = 0;
    } else {
      // Top: text centered, sits above
      textAnchor = "middle";
      dy = -4;
    }
    
    // Shorten long names
    const maxLen = this.displaySkills.length <= 4 ? 16 : (this.displaySkills.length <= 6 ? 13 : 10);
    let displayName = skillName;
    if (skillName.length > maxLen) {
      displayName = skillName.substring(0, maxLen - 2) + '..';
    }
    
    return { x, y, textAnchor, dy, displayName, angle: normAngle };
  }

  /**
   * Generate clean, collision-free labels with smart spacing
   * Uses radial positioning without text rotation for readability
   */
  generateAntiOverlapLabels() {
    const angleStep = (2 * Math.PI) / this.displaySkills.length;
    let labels = '';
    
    // Get base positions
    const positions = this.displaySkills.map((skill, i) => ({
      skill,
      index: i,
      ...this.getRadialLabelPosition(i * angleStep, skill.name)
    }));
    
    // Detect angular collisions - labels too close together
    const collisionMap = new Map();
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
    
    // Resolve collisions by pushing outward
    const resolved = positions.map((pos, idx) => {
      const collisions = collisionMap.get(idx) || 0;
      const extraOffset = collisions * 10; // Push 10px per collision
      return {
        ...pos,
        ...this.getRadialLabelPosition(pos.angle, pos.skill.name, extraOffset)
      };
    });
    
    // Font size based on skill count
    const fontSize = this.displaySkills.length <= 4 ? 11 : (this.displaySkills.length <= 6 ? 10 : 9);
    
    // Generate labels
    resolved.forEach((pos, i) => {
      labels += `<text 
        x="${pos.x.toFixed(1)}" 
        y="${(pos.y + pos.dy).toFixed(1)}" 
        fill="${pos.skill.legendary ? '#fbbf24' : this.textColor}" 
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
    const angleStep = (2 * Math.PI) / this.displaySkills.length;
    
    return this.displaySkills.map((skill, i) => {
      const angle = i * angleStep;
      const normalizedLevel = (skill.level || 1) / this.maxLevel;
      const radius = normalizedLevel * this.maxRadius;
      const point = this.getPoint(angle, radius);
      return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    }).join(' ') + ' Z';
  }

  /**
   * Generate all radial lines from center to each skill axis
   * Each line has a unique ID for hover targeting
   */
  generateRadialLines() {
    const angleStep = (2 * Math.PI) / this.displaySkills.length;
    let lines = '';
    
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
    let circles = '';
    const circleStep = this.maxRadius / this.numCircles;
    
    for (let i = 1; i <= this.numCircles; i++) {
      const radius = i * circleStep;
      const opacity = 0.15 + (i / this.numCircles) * 0.25;
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
    const angleStep = (2 * Math.PI) / this.displaySkills.length;
    let points = '';
    
    this.displaySkills.forEach((skill, i) => {
      const angle = i * angleStep;
      const normalizedLevel = (skill.level || 1) / this.maxLevel;
      const radius = normalizedLevel * this.maxRadius;
      const point = this.getPoint(angle, radius);
      
      points += `<circle 
        cx="${point.x}" 
        cy="${point.y}" 
        r="3" 
        fill="${skill.legendary ? '#fbbf24' : this.polygonColor}" 
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
    const angleStep = (2 * Math.PI) / this.displaySkills.length;
    let tooltips = '';
    
    this.displaySkills.forEach((skill, i) => {
      const angle = i * angleStep;
      const level = skill.level || 1;
      const text = `${skill.name} (Lv${level})`;
      
      // Position tooltip near label (outside the chart)
      const tooltipRadius = this.maxRadius + 55;
      const tx = this.center + tooltipRadius * Math.cos(angle - Math.PI / 2);
      const ty = this.center + tooltipRadius * Math.sin(angle - Math.PI / 2);
      
      // Calculate text dimensions (approximate)
      const charWidth = 6.5; // avg char width in px at font-size 11
      const textWidth = text.length * charWidth;
      const padding = 16; // horizontal padding
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
          y="${ty - boxHeight/2 + 1}" 
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
    this.container.innerHTML = '';
    
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

    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", this.size.toString());
    svg.setAttribute("height", this.size.toString());
    svg.setAttribute("viewBox", `0 0 ${this.size} ${this.size}`);
    svg.style.background = "transparent";
    svg.style.overflow = "visible";
    
    // Build layers in order (back to front)
    // 1. Concentric circles (spider-web grid)
    svg.innerHTML += this.generateCircles();
    
    // 2. Radial lines
    svg.innerHTML += this.generateRadialLines();
    
    // 3. Filled polygon
    svg.innerHTML += `<path 
      d="${this.generatePolygonPath()}" 
      fill="${this.polygonFill}" 
      stroke="${this.polygonColor}" 
      stroke-width="2"
      stroke-linejoin="round"
    />`;
    
    // 4. Tiny vertex points (subtle)
    svg.innerHTML += this.generateVertexPoints();
    
    // 5. Skill labels (anti-overlap)
    svg.innerHTML += this.generateAntiOverlapLabels();
    
    // 6. Tooltips (hidden)
    svg.innerHTML += this.generateTooltips();
    
    // 7. Clear center - NO text in center
    // (center intentionally left empty for clean look)
    
    // Add event listeners
    this.addEventListeners(svg);
    
    this.container.appendChild(svg);
  }

  /**
   * Add click and hover event listeners
   */
  addEventListeners(svg) {
    const self = this;
    
    const handleSkillClick = (index) => {
      if (self.onSkillClick && self.displaySkills[index]) {
        self.onSkillClick(self.displaySkills[index]);
      }
    };
    
    // Handle hover on labels - show tooltip and highlight radial line
    svg.querySelectorAll('.skill-radar-label').forEach(text => {
      text.addEventListener('mouseenter', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        
        // Highlight label
        this.setAttribute('fill', self.textHoverColor);
        
        // Highlight radial line
        const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
        if (line) {
          line.setAttribute('stroke', self.polygonColor);
          line.setAttribute('stroke-width', '2');
          line.setAttribute('opacity', '1');
        }
        
        // Show tooltip
        const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
        if (tooltip) {
          tooltip.style.opacity = '1';
        }
        
        // Enlarge vertex point
        const point = svg.querySelector(`.skill-radar-point[data-skill-index="${index}"]`);
        if (point) {
          point.setAttribute('r', '5');
          point.setAttribute('stroke', '#fff');
          point.setAttribute('stroke-width', '1');
        }
      });
      
      text.addEventListener('mouseleave', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        const skill = self.displaySkills[index];
        
        // Reset label
        this.setAttribute('fill', skill.legendary ? '#fbbf24' : self.textColor);
        
        // Reset radial line
        const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
        if (line) {
          line.setAttribute('stroke', self.radialLineColor);
          line.setAttribute('stroke-width', '1');
          line.setAttribute('opacity', '0.6');
        }
        
        // Hide tooltip
        const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
        if (tooltip) {
          tooltip.style.opacity = '0';
        }
        
        // Reset vertex point
        const point = svg.querySelector(`.skill-radar-point[data-skill-index="${index}"]`);
        if (point) {
          point.setAttribute('r', '3');
          point.setAttribute('stroke', 'none');
        }
      });
      
      text.addEventListener('click', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        handleSkillClick(index);
      });
    });
    
    // Handle hover on vertex points
    svg.querySelectorAll('.skill-radar-point').forEach(point => {
      point.addEventListener('mouseenter', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        
        // Enlarge point
        this.setAttribute('r', '6');
        this.setAttribute('stroke', '#fff');
        this.setAttribute('stroke-width', '1.5');
        
        // Highlight corresponding label
        const label = svg.querySelector(`.skill-radar-label[data-skill-index="${index}"]`);
        if (label) {
          label.setAttribute('fill', self.textHoverColor);
        }
        
        // Highlight radial line
        const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
        if (line) {
          line.setAttribute('stroke', self.polygonColor);
          line.setAttribute('stroke-width', '2');
          line.setAttribute('opacity', '1');
        }
        
        // Show tooltip
        const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
        if (tooltip) {
          tooltip.style.opacity = '1';
        }
      });
      
      point.addEventListener('mouseleave', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        const skill = self.displaySkills[index];
        
        // Reset point
        this.setAttribute('r', '3');
        this.setAttribute('stroke', 'none');
        
        // Reset label
        const label = svg.querySelector(`.skill-radar-label[data-skill-index="${index}"]`);
        if (label) {
          label.setAttribute('fill', skill.legendary ? '#fbbf24' : self.textColor);
        }
        
        // Reset radial line
        const line = svg.querySelector(`.skill-radar-line[data-skill-index="${index}"]`);
        if (line) {
          line.setAttribute('stroke', self.radialLineColor);
          line.setAttribute('stroke-width', '1');
          line.setAttribute('opacity', '0.6');
        }
        
        // Hide tooltip
        const tooltip = svg.querySelector(`.skill-radar-tooltip[data-skill-index="${index}"]`);
        if (tooltip) {
          tooltip.style.opacity = '0';
        }
      });
      
      point.addEventListener('click', function(e) {
        const index = parseInt(this.getAttribute('data-skill-index'));
        handleSkillClick(index);
      });
    });
  }
};

// ============================================================
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

  // ============================================================
  // XP CURVE SYSTEM — Refactored for transparency and motivation
  // ============================================================
  // 
  // The XP curve is designed with three phases:
  //
  // PHASE 1 — Early Game (Levels 1-15): Triangular Number Sequence
  //   XP(n) = n(n+1)/2 * BASE * multiplier
  //   This creates a gentle ramp-up where early levels feel fast and rewarding.
  //   At difficulty 10, Level 15 requires 120,000 total XP.
  //
  // PHASE 2 — Mid Game (Levels 16+): Exponential Growth
  //   XP(n) = BASE_15 + GROWTH * multiplier * (1.2^(n-15) - 1) / 0.2
  //   Where BASE_15 = 120,000 * multiplier (XP at level 15)
  //   And GROWTH = 16,000 * multiplier
  //   The 1.2 base creates a ~20% increase per level, which feels fair but challenging.
  //
  // DIFFICULTY MULTIPLIER:
  //   multiplier = 0.5 + (difficulty - 1) * 0.05
  //   At difficulty 10: multiplier = 1.0 (baseline)
  //   At difficulty 1:  multiplier = 0.5 (50% XP needed = fast leveling)
  //   At difficulty 20: multiplier = 1.5 (150% XP needed = slow/challenging)
  // ============================================================

  // --- XP CONSTANTS ---
  static XP_BASE = 1000;                    // Base XP for triangular calculation
  static XP_GROWTH = 16000;                // Growth rate for exponential phase
  static XP_EXPANSION_RATE = 1.2;          // 20% increase per level in exp phase
  static XP_PHASE_THRESHOLD = 15;         // Level where we switch from tri to exp
  static XP_TRI_MAX = 120000;              // Total XP needed to reach level 15 at mult=1.0

  // --- SKILL XP CONSTANTS (scaled down 10x for faster skill progression) ---
  static SKILL_BASE = 100;                 // Skill XP base
  static SKILL_GROWTH = 1600;             // Skill growth rate
  static SKILL_EXPANSION_RATE = 1.15;      // 15% increase per level for skills
  static SKILL_MAX_LEVEL = 100;           // Maximum skill level

  // ============================================================
  // XP MULTIPLIER — Difficulty scaling
  // ============================================================
  /**
   * Calculate the XP multiplier based on difficulty setting.
   * @param difficulty - Number from 1-20 (default 10)
   * @returns Multiplier from 0.5 to 1.5
   * 
   * Formula: multiplier = 0.5 + (difficulty - 1) * 0.05
   * 
   * Examples:
   *   difficulty 1  → 0.50 (Fastest leveling, Level 1 = 500 XP)
   *   difficulty 10 → 1.00 (Baseline, Level 1 = 1000 XP)
   *   difficulty 20 → 2.00 (Slowest/challenging, Level 1 = 2000 XP)
   */
  static getXpMultiplier(difficulty) {
    const diff = difficulty || 10;
    if (diff <= 10) {
      return 0.5 + (diff - 1) * (1/18);
    } else {
      return 1.0 + (diff - 10) * 0.1;
    }
  }

  // ============================================================
  // USER XP — Total XP required to reach a specific level
  // ============================================================
  /**
   * Calculate TOTAL cumulative XP required to reach a given level.
   * @param lvl - Target level (1-100+)
   * @param difficulty - Difficulty setting (1-20, default 10)
   * @returns Total XP needed to reach that level
   * 
   * Level 1 = 0 XP (starting point)
   * Level 2 = 1,000 * multiplier (at difficulty 10)
   * Level 15 = 120,000 * multiplier (end of early game)
   * Level 30 ≈ 680,000 * multiplier (example mid-game)
   */
  static getXpForLvl(lvl, difficulty = 10) {
    if (lvl <= 0) return 0;
    const mult = this.getXpMultiplier(difficulty);
    
    // PHASE 1: Early game (levels 1-15) — Triangular sequence
    // XP(n) = n(n+1)/2 * 1000 * multiplier
    if (lvl <= this.XP_PHASE_THRESHOLD) {
      return Math.floor(lvl * (lvl + 1) / 2 * this.XP_BASE * mult);
    }
    
    // PHASE 2: Mid/late game (levels 16+) — Exponential growth
    // XP(n) = BASE_15 + GROWTH * mult * (1.2^(n-15) - 1) / 0.2
    const base = this.XP_TRI_MAX * mult;
    const ratio = Math.pow(this.XP_EXPANSION_RATE, lvl - this.XP_PHASE_THRESHOLD);
    return Math.floor(base + this.XP_GROWTH * mult * (ratio - 1) / (this.XP_EXPANSION_RATE - 1));
  }

  // ============================================================
  // USER LEVEL — Calculate level from current XP
  // ============================================================
  /**
   * Invert getXpForLvl() to find the level for a given XP amount.
   * @param currentXp - Total XP the player has earned
   * @param difficulty - Difficulty setting (1-20, default 10)
   * @returns Current level (minimum 1)
   */
  static getLevel(currentXp, difficulty = 10) {
    const mult = this.getXpMultiplier(difficulty);
    const threshold15 = this.XP_TRI_MAX * mult;
    
    // Below level 2 threshold
    if (currentXp < this.XP_BASE * mult) return 1;
    
    // Mid/late game: use inverse exponential formula with binary search correction
    if (currentXp >= threshold15) {
      const lvl = Math.floor(
        Math.log((currentXp - threshold15) * (this.XP_EXPANSION_RATE - 1) / (this.XP_GROWTH * mult) + 1) 
        / Math.log(this.XP_EXPANSION_RATE)
      ) + this.XP_PHASE_THRESHOLD;
      
      // Binary search to handle floating point errors
      return Math.max(16, lvl + (this.getXpForLvl(lvl + 1, difficulty) <= currentXp ? 1 : 0));
    }
    
    // Early game: binary search within levels 1-15
    let lo = 1, hi = this.XP_PHASE_THRESHOLD;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.getXpForLvl(mid, difficulty) <= currentXp) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  // ============================================================
  // XP CURVE TABLE — Generate lookup table for UI display
  // ============================================================
  /**
   * Generate a complete XP curve table for display purposes.
   * @param difficulty - Difficulty setting (1-20)
   * @param maxLevel - Maximum level to calculate (default 50)
   * @returns Array of { level, totalXp, deltaXp } objects
   */
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

  // ============================================================
  // NEXT LEVEL MILESTONES — For user profile display
  // ============================================================
  /**
   * Generate upcoming level milestones for user motivation.
   * @param currentXp - Player's current XP
   * @param difficulty - Difficulty setting
   * @param count - Number of milestones to show (default 8)
   * @returns Array of { level, totalXp, xpRemaining } objects
   */
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

  // ============================================================
  // SKILL XP — Skill-specific calculations (scaled for faster progression)
  // ============================================================
  /**
   * Calculate TOTAL XP required for a skill to reach a specific level.
   * Skills use a slightly gentler curve (15% expansion) for more frequent rewards.
   */
  static getSkillXpForLvl(lvl, difficulty = 10) {
    if (lvl <= 0) return 0;
    if (lvl > this.SKILL_MAX_LEVEL) return this.getSkillXpForLvl(this.SKILL_MAX_LEVEL, difficulty);
    
    const mult = this.getXpMultiplier(difficulty);
    
    // Same triangular base, scaled down 10x
    if (lvl <= this.XP_PHASE_THRESHOLD) {
      return Math.floor(lvl * (lvl + 1) / 2 * this.SKILL_BASE * mult);
    }
    
    // Exponential phase with gentler 15% growth
    const base = 12000 * mult;
    const ratio = Math.pow(this.SKILL_EXPANSION_RATE, lvl - this.XP_PHASE_THRESHOLD);
    return Math.floor(base + this.SKILL_GROWTH * mult * (ratio - 1) / (this.SKILL_EXPANSION_RATE - 1));
  }

  /**
   * Calculate skill level from accumulated XP.
   */
  static getSkillLevel(currentXp, difficulty = 10) {
    const mult = this.getXpMultiplier(difficulty);
    const threshold15 = 12000 * mult;
    
    if (currentXp < this.SKILL_BASE * mult) return 1;
    
    if (currentXp >= threshold15) {
      const lvl = Math.floor(
        Math.log((currentXp - threshold15) * (this.SKILL_EXPANSION_RATE - 1) / (this.SKILL_GROWTH * mult) + 1) 
        / Math.log(this.SKILL_EXPANSION_RATE)
      ) + this.XP_PHASE_THRESHOLD;
      
      return Math.min(
        this.SKILL_MAX_LEVEL,
        Math.max(16, lvl + (this.getSkillXpForLvl(lvl + 1, difficulty) <= currentXp ? 1 : 0))
      );
    }
    
    // Binary search for early levels
    let lo = 1, hi = this.XP_PHASE_THRESHOLD;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.getSkillXpForLvl(mid, difficulty) <= currentXp) lo = mid;
      else hi = mid - 1;
    }
    return Math.min(this.SKILL_MAX_LEVEL, lo + 1);
  }

  /**
   * Calculate skill XP progress within current level.
   */
  static getSkillXpProgress(skill, difficulty = 10) {
    const level = skill.level || 1;
    const xpForCurrent = this.getSkillXpForLvl(level - 1, difficulty);
    const xpForNext = this.getSkillXpForLvl(level, difficulty);
    const xpNeeded = xpForNext - xpForCurrent;
    const xpProgress = (skill.xp || 0) - xpForCurrent;
    
    return {
      xp: skill.xp || 0,
      xpForCurrent,
      xpForNext,
      xpNeeded,
      xpProgress,
      pct: Math.min(100, Math.round((xpProgress / xpNeeded) * 100))
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
        { icon: "radar", label: "Skill Graph", action: () => this.showSkillGraphModal() },
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

    // --- SKILL GRAPH OVERLAY ---
    const skillGraphOverlay = container.createEl("div", { cls: "skill-graph-overlay" });
    const skillGraphHeader = skillGraphOverlay.createEl("div", { cls: "skill-graph-header" });
    const skillGraphHamburger = skillGraphHeader.createEl("button", { cls: "topbar-hamburger" });
    setIcon(skillGraphHamburger, "menu");
    skillGraphHamburger.addEventListener("click", () => {
      buildMenu();
      menuOverlay.addClass("open");
    });
    const skillGraphBackBtn = skillGraphHeader.createEl("button", {
      text: "← Back",
      cls: "skill-graph-back-btn",
    });
    skillGraphHeader.createEl("span", {
      text: "Skill Graph",
      cls: "skill-graph-title",
    });
    const skillGraphContent = skillGraphOverlay.createEl("div", {
      cls: "skill-graph-content",
    });
    skillGraphOverlay.style.display = "none";

    skillGraphBackBtn.addEventListener("click", () => {
      skillGraphOverlay.style.display = "none";
      // Restore original tab visibility
      questListContainer.style.display = activeTab === "QUESTS" ? "flex" : "none";
      habitsContent.style.display = activeTab === "HABITS" ? "flex" : "none";
      skillsContent.style.display = activeTab === "SKILLS" ? "flex" : "none";
    });

    // Store reference for later
    this._skillGraphOverlay = skillGraphOverlay;
    this._skillGraphContent = skillGraphContent;

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

  /**
   * Show the Skill Graph modal with radar chart - Premium RPG style
   */
  showSkillGraphModal() {
    const overlay = this._skillGraphOverlay;
    const content = this._skillGraphContent;
    
    if (!overlay || !content) return;
    
    // Clear and show overlay with fade animation
    content.empty();
    overlay.style.display = "flex";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.25s ease-out";
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });
    
    const skills = this.plugin.settings.skills || [];
    const level = this.plugin.getLevel();
    const title = QuestLogView.getLevelTitle(level);
    const heroName = this.plugin.settings.heroName || "Hero";
    
    // ========== HERO HEADER SECTION (divided, lighter background) ==========
    const headerSection = content.createEl("div", { cls: "skill-graph-header-section" });
    
    // Icon + Title Row
    const headerRow = headerSection.createEl("div", { cls: "skill-graph-header-row" });
    
    // Sword icon
    const iconSpan = headerRow.createEl("span", { cls: "skill-graph-header-icon" });
    setIcon(iconSpan, "sword");
    
    // Hero name + title
    const titleGroup = headerRow.createEl("div", { cls: "skill-graph-title-group" });
    titleGroup.createEl("span", { 
      text: `${heroName} — ${title}`,
      cls: "skill-graph-hero-title"
    });
    
    // Subtitle: Level only (no skill count)
    headerSection.createEl("div", {
      text: `Level ${level}`,
      cls: "skill-graph-hero-subtitle"
    });
    
    // ========== CHART SECTION ==========
    const chartSection = content.createEl("div", { cls: "skill-graph-chart-section" });
    
    // Chart container with fade-in animation
    const chartContainer = chartSection.createEl("div", { cls: "skill-graph-chart-container" });
    
    // Render the radar chart
    const chart = new SkillRadarChart(
      chartContainer,
      skills,
      (skill) => {
        // Close overlay with fade
        overlay.style.opacity = "0";
        setTimeout(() => {
          overlay.style.display = "none";
          // Restore tab visibility
          const questListContainer = this._questListContainer;
          if (questListContainer) questListContainer.style.display = "flex";
          this.openSkillDetail(skill);
        }, 250);
      }
    );
    chart.render();
    
    // ========== FOOTER SECTION ==========
    const footerSection = content.createEl("div", { cls: "skill-graph-footer-section" });
    footerSection.createEl("p", {
      text: "Skill levels shown (max 100)",
      cls: "skill-graph-note"
    });
  }

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
