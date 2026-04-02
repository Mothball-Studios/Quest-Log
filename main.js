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
  userProfileFileName: "User Profile",
  userProfileFolder: "Quest Log",
  questsFolderPath: "Quest Log/Quests",
  habitsFolderPath: "Quest Log/Habits",
  skillsFolderPath: "Quest Log/Skills",
  completedFolderPath: "Quest Log/Completed",
};

// ============================================================
// PLUGIN CLASS — Entry point, loads/unloads the plugin
// ============================================================

var QuestLog = class extends Plugin {
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
            const safeName = file.path.replace(questsFolder + "/", "").replace(".md", "");
            const before = this.settings.quests.length;
            this.settings.quests = this.settings.quests.filter(
              (q) => q.title.replace(/[\\/:*?"<>|]/g, "-") !== safeName
            );
            if (this.settings.quests.length !== before) changed = true;
          } else if (file.path.startsWith(habitsFolder + "/")) {
            const safeName = file.path.replace(habitsFolder + "/", "").replace(".md", "");
            const before = this.settings.habits.length;
            this.settings.habits = this.settings.habits.filter(
              (h) => h.title.replace(/[\\/:*?"<>|]/g, "-") !== safeName
            );
            if (this.settings.habits.length !== before) changed = true;
          } else if (file.path.startsWith(completedFolder + "/")) {
            // Revoke XP for completed quests
            const beforeQ = this.settings.completedQuests.length;
            const removedQuest = this.settings.completedQuests.find(
              (q) => q.title.replace(/[\\/:*?"<>|]/g, "-") === file.path.replace(completedFolder + "/", "").replace(".md", "")
            );
            if (removedQuest) {
              this.settings.currentXp = Math.max(0, this.settings.currentXp - removedQuest.xp);
              this.settings.questsCompleted = Math.max(0, this.settings.questsCompleted - 1);
            }
            this.settings.completedQuests = this.settings.completedQuests.filter(
              (q) => q.title.replace(/[\\/:*?"<>|]/g, "-") !== file.path.replace(completedFolder + "/", "").replace(".md", "")
            );
            if (this.settings.completedQuests.length !== beforeQ) changed = true;

            // Revoke XP for completed habits
            const beforeH = (this.settings.completedHabits || []).length;
            const removedHabit = (this.settings.completedHabits || []).find((h) => {
              const dateStr = new Date(h.completedAt).toLocaleString("en-US", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", hour12: true,
              }).replace(/[/:]/g, "-").replace(", ", " ");
              const expected = h.title.replace(/[\\/:*?"<>|]/g, "-") + " - " + dateStr;
              return expected === file.path.replace(completedFolder + "/", "").replace(".md", "");
            });
            if (removedHabit) {
              this.settings.currentXp = Math.max(0, this.settings.currentXp - removedHabit.xp);
              this.settings.questsCompleted = Math.max(0, this.settings.questsCompleted - 1);
            }
            this.settings.completedHabits = (this.settings.completedHabits || []).filter((h) => {
              const dateStr = new Date(h.completedAt).toLocaleString("en-US", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", hour12: true,
              }).replace(/[/:]/g, "-").replace(", ", " ");
              const expected = h.title.replace(/[\\/:*?"<>|]/g, "-") + " - " + dateStr;
              return expected !== file.path.replace(completedFolder + "/", "").replace(".md", "");
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
    await this.writeUserProfile();
  }

  async writeUserProfile() {
    const { settings, app } = this;
    const level = QuestLogView.getLevel(settings.currentXp);
    const title = QuestLogView.getLevelTitle(level);
    const xpForNext = QuestLogView.getXpForLvl(level);
    const xpFromPrev = QuestLogView.getXpForLvl(level - 1);
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
    const files = this.app.vault.getAllLoadedFiles();
    const folders = [];
    for (const f of files) {
      if (f.children) {
        // TFolder — this is a folder
        folders.push(f.path);
      }
      if (f.parent && f.parent.path !== "") {
        folders.push(f.parent.path);
      }
    }

    // Deduplicate and sort
    const unique = [...new Set(folders)].filter((p) => p !== "").sort();
    const lowerQuery = query.toLowerCase();
    return unique.filter((f) => f.toLowerCase().includes(lowerQuery));
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

    // --- FILE PATHS SECTION ---
    containerEl.createEl("h3", { text: "File Paths" });

    // User Profile — split into file name + folder
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

    // --- GENERAL SECTION ---
    containerEl.createEl("h3", { text: "General" });

    // Rewards Mode toggle
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

    // Reset Data button
    new Setting(containerEl)
      .setName("DANGER ZONE: Reset All Data")
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
    confirmBtn.disabled = true;

    // Enable button only when hero name matches
    inputEl.addEventListener("input", () => {
      confirmBtn.disabled = inputEl.value !== this.plugin.settings.heroName;
      confirmBtn.setAttr("aria-disabled", confirmBtn.disabled);
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

      // Helper: delete all files in a folder, then remove the folder itself
      const wipeFolder = async (folderPath) => {
        try {
          const listing = await adapter.list(folderPath);
          for (const file of listing.files) {
            try { await adapter.remove(file); } catch (e) {}
          }
          // Remove the folder recursively (catches subdirs too)
          try { await adapter.rmdir(folderPath, true); } catch (e) {}
        } catch (e) {
          // Folder may not exist — ignore
        }
      };

      // Wipe all subfolders
      for (const folder of foldersToWipe) {
        await wipeFolder(folder);
      }

      // Delete User Profile .md
      const userProfileFolder = settings.userProfileFolder || "Quest Log";
      const userProfileFile = settings.userProfileFileName || "User Profile";
      const userProfilePath = `${userProfileFolder}/${userProfileFile}.md`;
      try { await adapter.remove(userProfilePath); } catch (e) {}

      // Wipe any loose .md files in the Quest Log root folder
      try {
        const rootListing = await adapter.list(userProfileFolder);
        for (const file of rootListing.files) {
          if (file.endsWith(".md")) {
            try { await adapter.remove(file); } catch (e) {}
          }
        }
      } catch (e) {}

      // Reset settings to defaults
      this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      await this.plugin.saveSettings();

      // Refresh the view if it's open
      const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
      if (leaves.length > 0) {
        leaves[0].view.onOpen();
      }

      new Notice(
        "Your legend begins anew! All history has been wiped from the scrolls.",
      );
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

  // XP threshold to reach a given level
  // Levels 1-15: per-level cost = lvl * 1000 (1k, 2k, 3k... 15k)
  // Level 16+: exponential (20% increase per level starting from 16k)
  static getXpForLvl(lvl) {
    if (lvl <= 0) return 0;
    if (lvl <= 15) return Math.floor(lvl * (lvl + 1) / 2 * 1000);
    const base = 15 * 16 / 2 * 1000; // 120000 at level 15
    let xp = base;
    let cost = 16000;
    for (let i = 16; i <= lvl; i++) {
      xp += cost;
      cost = Math.floor(cost * 1.20);
    }
    return xp;
  }

  // Determine level from current XP — find highest level whose threshold we've met
  static getLevel(currentXp) {
    let lvl = 1;
    while (QuestLogView.getXpForLvl(lvl) <= currentXp) {
      lvl++;
    }
    return lvl;
  }

  // ----------------------------------------
  // XP CONSTANTS & HELPERS
  // ----------------------------------------

  static DIFFICULTY_LABELS = ["Trivial", "Easy", "Medium", "Hard", "Legendary"];
  static URGENCY_LABELS = ["Relaxed", "Soon", "Urgent", "Critical", "Immediate"];
  static IMPACT_LABELS = ["Minor", "Notable", "Major", "Epic", "Legendary"];

  // Exponential XP: exactly 100 at min (sum=3), exactly 500,000 at max (sum=15)
  static calcXp(d, u, i) {
    const sum = d + u + i;
    if (sum <= 3) return 100;
    if (sum >= 15) return 500000;
    return Math.round(100 * Math.pow(5000, (sum - 3) / 12));
  }

  static getLevelTitle(lvl) {
    if (lvl >= 50) return "Legendary";
    if (lvl >= 40) return "Mythic";
    if (lvl >= 30) return "Champion";
    if (lvl >= 25) return "Grandmaster";
    if (lvl >= 20) return "Master";
    if (lvl >= 15) return "Veteran";
    if (lvl >= 10) return "Journeyman";
    if (lvl >= 5) return "Apprentice";
    return "Novice Adventurer";
  }

  // ----------------------------------------
  // HEADER REFRESH
  // ----------------------------------------

  updateHeader() {
    const currentXp = this.plugin.settings.currentXp;
    const level = QuestLogView.getLevel(currentXp);
    const xpForNext = QuestLogView.getXpForLvl(level);
    const xpFromPrev = QuestLogView.getXpForLvl(level - 1);
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
    const safeName = quest.title.replace(/[\\/:*?"<>|]/g, "-");
    const fullPath = `${folderPath}/${safeName}.md`;

    // Ensure folder exists
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    // Star rating helper
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
| **Created** | ${new Date(quest.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} |
| **Completed** | — |
`;

    // Create or update
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
    const safeName = quest.title.replace(/[\\/:*?"<>|]/g, "-");
    const fullPath = `${folderPath}/${safeName}.md`;

    const stars = (n) => "⭐".repeat(n);
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
| **Created** | ${new Date(quest.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} |
| **Completed** | ${now} |
`;

    const existing = app.vault.getAbstractFileByPath(fullPath);
    if (existing) {
      await app.vault.modify(existing, content);
    }
  }

  static async deleteQuestFile(plugin, quest) {
    const { app, settings } = plugin;
    const folderPath = settings.questsFolderPath || "Quest Log/Quests";
    const safeName = quest.title.replace(/[\\/:*?"<>|]/g, "-");
    const fullPath = `${folderPath}/${safeName}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  static async deleteHabitFile(plugin, habit) {
    const { app, settings } = plugin;
    const folderPath = settings.habitsFolderPath || "Quest Log/Habits";
    const safeName = habit.title.replace(/[\\/:*?"<>|]/g, "-");
    const fullPath = `${folderPath}/${safeName}.md`;
    const file = app.vault.getAbstractFileByPath(fullPath);
    if (file) {
      try { await app.vault.delete(file); } catch (e) {}
    }
  }

  static async writeHabitFile(plugin, habit) {
    const { app, settings } = plugin;
    const folderPath = settings.habitsFolderPath || "Quest Log/Habits";
    const safeName = habit.title.replace(/[\\/:*?"<>|]/g, "-");
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
| **Created** | ${new Date(habit.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} |
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

  static async writeCompletedHabitFile(plugin, habit, completedAt) {
    const { app, settings } = plugin;
    const folderPath = settings.completedFolderPath || "Quest Log/Completed";
    const safeName = habit.title.replace(/[\\/:*?"<>|]/g, "-");
    const dateObj = new Date(completedAt);
    const dateStr = dateObj.toLocaleString("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).replace(/[/:]/g, "-").replace(", ", " ");
    const fullPath = `${folderPath}/${safeName} - ${dateStr}.md`;

    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try { await app.vault.createFolder(folderPath); } catch (e) {}
    }

    const stars = (n) => "⭐".repeat(n);
    const completedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
| **Completed** | ${completedDate} |
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
    const safeName = habit.title.replace(/[\\/:*?"<>|]/g, "-");
    const dateObj = new Date(completedAt);
    const dateStr = dateObj.toLocaleString("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).replace(/[/:]/g, "-").replace(", ", " ");
    const fullPath = `${folderPath}/${safeName} - ${dateStr}.md`;
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
      star.style.top = "50%";
      star.style.transform = "translate(-50%, -50%)";
      star.style.fontSize = "7px";
      star.style.color = "#555";
      star.style.pointerEvents = "none";
      star.style.transition = "font-size 0.15s ease, color 0.15s ease, text-shadow 0.15s ease";
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
          star.style.fontSize = "10px";
          star.style.textShadow = `0 0 4px ${color}`;
        } else {
          star.style.color = "#555";
          star.style.fontSize = "7px";
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
    const calculatedLvl = QuestLogView.getLevel(currentXp);
    const xpFrmPrevLvls = QuestLogView.getXpForLvl(calculatedLvl - 1);
    const xpForNextLvl = QuestLogView.getXpForLvl(calculatedLvl);
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
    const habitModalBox = habitOverlay.createEl("div", { cls: "quest-modal" });

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
      cls: "tab-content-placeholder",
    });
    skillsContent.createEl("div", {
      text: "Skills coming soon.",
      cls: "quest-list-empty",
    });
    skillsContent.style.display = "none";

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
    const detailBox = detailOverlay.createEl("div", {
      cls: "quest-detail-box",
    });

    // Store references for rendering
    this._questListContainer = questListContainer;
    this._habitListContainer = habitsContent;
    this._completedListContainer = completedListContainer;
    this._detailOverlay = detailOverlay;
    this._detailBox = detailBox;
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
    overlay.addClass("open");

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
      "#5e87ff", quest.difficulty || 3, updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection, "Urgency", QuestLogView.URGENCY_LABELS,
      "#f59e0b", quest.urgency || 3, updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection, "Impact", QuestLogView.IMPACT_LABELS,
      "#a855f7", quest.impact || 3, updateXpPreview
    );

    // XP preview
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${quest.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value",
    });

    // Helper to save current values back to quest
    const saveQuest = async () => {
      quest.title = titleInput.value.trim() || quest.title;
      quest.description = descBox.value.trim();
      quest.difficulty = diffSlider._getValue();
      quest.urgency = urgSlider._getValue();
      quest.impact = impSlider._getValue();
      quest.xp = QuestLogView.calcXp(quest.difficulty, quest.urgency, quest.impact);
      await this.plugin.saveSettings();
      await QuestLogView.writeQuestFile(this.plugin, quest);
      this.renderQuestList(this._questListContainer);
    };

    // Buttons
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });

    // Delete button
    const deleteBtn = btnRow.createEl("button", {
      cls: "quest-detail-delete-btn",
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon",
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.createEl("span", { text: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      await QuestLogView.deleteQuestFile(this.plugin, quest);
      this.plugin.settings.quests = this.plugin.settings.quests.filter(
        (q) => q.id !== quest.id,
      );
      this.plugin.saveSettings();
      overlay.removeClass("open");
      this.renderQuestList(this._questListContainer);
      new Notice("Quest deleted.");
    });

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
      // Save final values and award XP
      await saveQuest();
      await QuestLogView.completeQuestFile(this.plugin, quest);

      // Move quest .md from Quests folder to Completed folder
      const adapter = this.app.vault.adapter;
      const questsFolder = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
      const completedFolder = this.plugin.settings.completedFolderPath || "Quest Log/Completed";
      const safeName = quest.title.replace(/[\\/:*?"<>|]/g, "-");
      const sourcePath = `${questsFolder}/${safeName}.md`;
      const destPath = `${completedFolder}/${safeName}.md`;
      try {
        // Ensure Completed folder exists
        try { await adapter.mkdir(completedFolder); } catch (e) {}
        await adapter.rename(sourcePath, destPath);
      } catch (e) {}

      this.plugin.settings.currentXp += quest.xp;
      this.plugin.settings.questsCompleted += 1;
      // Push to completedQuests with timestamp
      const completedQuest = { ...quest, completedAt: new Date().toISOString() };
      this.plugin.settings.completedQuests.push(completedQuest);
      this.plugin.settings.quests = this.plugin.settings.quests.filter(
        (q) => q.id !== quest.id,
      );
      this.plugin.saveSettings();
      overlay.removeClass("open");
      new Notice(`Quest Complete! +${quest.xp.toLocaleString()} XP`);
      this.onOpen();
    });
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

      // Complete button
      const completeBtn = actionRow.createEl("button", {
        text: "Complete",
        cls: "habit-complete-btn",
      });
      const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(completeIcon, "check");
      completeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.completeHabit(habit);
      });

      // Fail button
      const failBtn = actionRow.createEl("button", {
        text: "Fail",
        cls: "habit-fail-btn",
      });
      const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(failIcon, "x");
      failBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.failHabit(habit);
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
    await this.plugin.saveSettings();
    await QuestLogView.writeCompletedHabitFile(this.plugin, habit, completedAt);
    this.updateHeader();
    this.renderHabitList(this._habitListContainer);
    new Notice(`Habit completed: ${habit.title}`);
  }

  async failHabit(habit) {
    this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
    await this.plugin.saveSettings();
    this.updateHeader();
    new Notice(`Habit failed: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
  }

  // ----------------------------------------
  // HABIT DETAIL VIEW
  // ----------------------------------------

  openHabitDetail(habit) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    box.empty();
    overlay.addClass("open");

    // Title row with delete icon
    const titleRow = box.createEl("div", { cls: "habit-detail-title-row" });
    titleRow.createEl("h2", {
      text: habit.title,
      cls: "quest-detail-title",
    });
    const topDeleteBtn = titleRow.createEl("button", {
      cls: "habit-detail-title-delete",
    });
    const topDeleteIcon = topDeleteBtn.createEl("span");
    setIcon(topDeleteIcon, "trash-2");
    topDeleteBtn.addEventListener("click", async () => {
      await QuestLogView.deleteHabitFile(this.plugin, habit);
      this.plugin.settings.habits = this.plugin.settings.habits.filter(
        (h) => h.id !== habit.id,
      );
      this.plugin.saveSettings();
      overlay.removeClass("open");
      this.renderHabitList(this._habitListContainer);
      new Notice("Habit deleted.");
    });

    // Description
    if (habit.description) {
      box.createEl("p", {
        text: habit.description,
        cls: "quest-detail-desc",
        attr: { style: "background: transparent; border: none; padding: 0; color: #ccc; resize: none;" },
      });
    }

    // Stats table
    const stars = (n) => "\u2B50".repeat(n);
    const createdDate = new Date(habit.created).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Reward", habit.xp.toLocaleString()],
      ["Difficulty", stars(habit.difficulty)],
      ["Urgency", stars(habit.urgency)],
      ["Impact", stars(habit.impact)],
      ["Created", createdDate],
      ["Type", "Habit (Repeatable)"],
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

    // Fail button
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

    // Spacer
    btnRow.createEl("div", { cls: "quest-detail-spacer" });

    // Close button
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn",
    });
    closeBtn.addEventListener("click", () => {
      overlay.removeClass("open");
    });

    // Complete button
    const completeBtn = btnRow.createEl("button", {
      text: "Complete",
      cls: "habit-complete-btn",
    });
    const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
    setIcon(completeIcon, "check");
    completeBtn.addEventListener("click", async () => {
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
      const dateStr = new Date(item.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      meta.createEl("span", {
        text: dateStr,
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

    // Stats table
    const stars = (n) => "\u2B50".repeat(n);
    const createdDate = new Date(quest.created).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    const completedDate = new Date(quest.completedAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", quest.xp.toLocaleString()],
      ["Difficulty", stars(quest.difficulty)],
      ["Urgency", stars(quest.urgency)],
      ["Impact", stars(quest.impact)],
      ["Created", createdDate],
      ["Completed", completedDate],
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
        const safeName = activeQuest.title.replace(/[\\/:*?"<>|]/g, "-");
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

    // Stats table
    const stars = (n) => "\u2B50".repeat(n);
    const completedDate = new Date(habit.completedAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", habit.xp.toLocaleString()],
      ["Difficulty", stars(habit.difficulty)],
      ["Urgency", stars(habit.urgency)],
      ["Impact", stars(habit.impact)],
      ["Type", "Habit (Repeatable)"],
      ["Completed", completedDate],
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
