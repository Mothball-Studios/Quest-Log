var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);

// src/plugin.ts
var import_obsidian3 = require("obsidian");

// src/constants.ts
var QUESTLOG_VIEW_TYPE = "quest-log-view";
var DEFAULT_SETTINGS = {
  rewardsMode: false,
  coins: 0,
  rewards: [],
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
  skillDifficulty: 1
};

// src/xp.ts
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
    const xpForNext = this.getXpForLvl(level, difficulty);
    const xpFromPrev = this.getXpForLvl(level - 1, difficulty);
    const xpNeeded = xpForNext - xpFromPrev;
    const into = (xp || 0) - xpFromPrev;
    const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, Math.round(into / xpNeeded * 100))) : 100;
    return { xpForNext, xpFromPrev, xpNeeded, into, pct };
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
      pct: Math.min(100, Math.round(xpProgress / xpNeeded * 100))
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

// src/persist.ts
function stars(n) {
  return "\u2B50".repeat(n);
}
__name(stars, "stars");
function safeName(str) {
  return String(str || "").replace(/[\\/:*?"<>|]/g, "-");
}
__name(safeName, "safeName");
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
async function writeSidecarAtomic(plugin, fullPath, content) {
  const adapter = plugin.app.vault.adapter;
  const slash = fullPath.lastIndexOf("/");
  const folderPath = slash >= 0 ? fullPath.slice(0, slash) : "";
  if (folderPath) {
    try {
      await adapter.mkdir(folderPath);
    } catch (e) {
    }
  }
  const tmpPath = `${fullPath}.tmp`;
  await adapter.write(tmpPath, content);
  try {
    await adapter.rename(tmpPath, fullPath);
  } catch (e) {
    try {
      await adapter.write(fullPath, content);
    } catch (e2) {
    }
    try {
      await adapter.remove(tmpPath);
    } catch (e3) {
    }
  }
}
__name(writeSidecarAtomic, "writeSidecarAtomic");
async function moveSidecar(app, sourcePath, destPath) {
  const vault = app.vault;
  const slash = destPath.lastIndexOf("/");
  const destFolder = slash >= 0 ? destPath.slice(0, slash) : "";
  if (destFolder && !vault.getAbstractFileByPath(destFolder)) {
    try {
      await vault.createFolder(destFolder);
    } catch (e) {
    }
  }
  const file = vault.getAbstractFileByPath(sourcePath);
  if (file) {
    await vault.rename(file, destPath);
    return;
  }
  const adapter = vault.adapter;
  if (destFolder) {
    try {
      await adapter.mkdir(destFolder);
    } catch (e) {
    }
  }
  await adapter.rename(sourcePath, destPath);
}
__name(moveSidecar, "moveSidecar");
function questBody(quest, status, completed) {
  return `---
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
| **Status** | ${status} |
| **Created** | ${formatDate(quest.created)} |
| **Completed** | ${completed} |
`;
}
__name(questBody, "questBody");
async function writeQuestFile(plugin, quest) {
  const folderPath = plugin.settings.questsFolderPath || "Quest Log/Quests";
  const fullPath = `${folderPath}/${safeName(quest.title)}.md`;
  await writeSidecarAtomic(plugin, fullPath, questBody(quest, "In Progress", "\u2014"));
}
__name(writeQuestFile, "writeQuestFile");
async function writeCompletedQuestFile(plugin, quest) {
  const folderPath = plugin.settings.completedFolderPath || "Quest Log/Completed";
  const fullPath = `${folderPath}/${safeName(quest.title)}.md`;
  const completed = quest.completedAt ? formatDate(quest.completedAt) : formatDate((/* @__PURE__ */ new Date()).toISOString());
  await writeSidecarAtomic(plugin, fullPath, questBody(quest, "\u2705 Completed", completed));
}
__name(writeCompletedQuestFile, "writeCompletedQuestFile");
async function writeHabitFile(plugin, habit) {
  const folderPath = plugin.settings.habitsFolderPath || "Quest Log/Habits";
  const fullPath = `${folderPath}/${safeName(habit.title)}.md`;
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
| **Created** | ${formatDate(habit.created)} |
`;
  await writeSidecarAtomic(plugin, fullPath, content);
}
__name(writeHabitFile, "writeHabitFile");
async function writeCompletedHabitFile(plugin, habit, completedAt) {
  const folderPath = plugin.settings.completedFolderPath || "Quest Log/Completed";
  const timeStr = formatHabitTimestamp(completedAt);
  const fullPath = `${folderPath}/${safeName(habit.title)} - ${timeStr}.md`;
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
| **Status** | Completed \u2713 |
| **Completed** | ${formatDate(completedAt)} |
`;
  await writeSidecarAtomic(plugin, fullPath, content);
}
__name(writeCompletedHabitFile, "writeCompletedHabitFile");
async function writeSkillFile(plugin, skill) {
  const folderPath = plugin.settings.skillsFolderPath || "Quest Log/Skills";
  const fullPath = `${folderPath}/${safeName(skill.name)}.md`;
  const legendaryStar = skill.legendary ? " \u2605" : "";
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
| **Created** | ${formatDate(skill.created)} |
`;
  await writeSidecarAtomic(plugin, fullPath, content);
}
__name(writeSkillFile, "writeSkillFile");
async function writeUserProfile(plugin) {
  const { settings, app } = plugin;
  const level = plugin.getLevel();
  const title = Xp.getLevelTitle(level);
  const difficulty = settings.userDifficulty || 10;
  const xpBar = Xp.xpProgress(level, settings.currentXp, difficulty);
  const xpForNext = xpBar.xpForNext;
  const xpNeeded = xpBar.xpNeeded;
  const pct = xpBar.pct;
  const questsDone = settings.questsCompleted || 0;
  const barLen = 16;
  const filled = Math.round(pct / 100 * barLen);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);
  const milestones = Xp.getNextMilestones(settings.currentXp, difficulty, 6);
  const milestonesRows = milestones.map((m) => `| ${m.level} | ${m.totalXp.toLocaleString()} | ${m.xpRemaining.toLocaleString()} |`).join("\n");
  const content = `# \u{1F6E1}\uFE0F Adventurer Profile

> *"Every legend starts somewhere."*

---

## Hero Name
### **${settings.heroName}**

---

## Level
### \u2694\uFE0F Level ${level} \u2014 ${title}

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
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder) {
    try {
      await app.vault.createFolder(folderPath);
    } catch (e) {
    }
  }
  await writeSidecarAtomic(plugin, fullPath, content);
}
__name(writeUserProfile, "writeUserProfile");
async function exportAllSidecars(plugin) {
  await writeUserProfile(plugin);
  for (const quest of plugin.settings.quests || []) {
    await writeQuestFile(plugin, quest);
  }
  for (const habit of plugin.settings.habits || []) {
    await writeHabitFile(plugin, habit);
  }
  for (const skill of plugin.settings.skills || []) {
    await writeSkillFile(plugin, skill);
  }
  for (const quest of plugin.settings.completedQuests || []) {
    await writeCompletedQuestFile(plugin, quest);
  }
  for (const habit of plugin.settings.completedHabits || []) {
    await writeCompletedHabitFile(plugin, habit, habit.completedAt || (/* @__PURE__ */ new Date()).toISOString());
  }
}
__name(exportAllSidecars, "exportAllSidecars");

// src/settings.ts
var import_obsidian = require("obsidian");
var _FolderSuggest = class _FolderSuggest extends import_obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const folders = /* @__PURE__ */ new Set();
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
__name(_FolderSuggest, "FolderSuggest");
var FolderSuggest = _FolderSuggest;
var _SkillSuggest = class _SkillSuggest extends import_obsidian.AbstractInputSuggest {
  constructor(app, inputEl, plugin) {
    super(app, inputEl);
    this.onSelect = null;
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
    if (this.onSelect) this.onSelect(skill);
  }
};
__name(_SkillSuggest, "SkillSuggest");
var SkillSuggest = _SkillSuggest;
var _XpCurveModal = class _XpCurveModal extends import_obsidian.Modal {
  constructor(app, difficulty, type = "user") {
    super(app);
    this.difficulty = difficulty;
    this.type = type;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("xp-curve-modal-content");
    const header = contentEl.createEl("div", { cls: "xp-curve-modal-header" });
    const title = this.type === "skill" ? "\u{1F31F} Skill XP Curve" : "\u2694\uFE0F User XP Curve";
    header.createEl("h2", { text: `\u{1F4CA} ${title} \u2014 Difficulty ${this.difficulty}` });
    contentEl.createEl("p", {
      text: "Total XP needed to reach each level. The delta column shows XP required FOR that specific level.",
      cls: "xp-curve-modal-desc"
    });
    const table = Xp.generateXpCurveTable(this.difficulty, 100);
    const tableWrapper = contentEl.createEl("div", { cls: "xp-curve-modal-table-wrapper" });
    const tableEl = tableWrapper.createEl("table", { cls: "xp-curve-modal-table" });
    const thead = tableEl.createEl("thead");
    const headerRow = thead.createEl("tr");
    ["Level", "Total XP", "XP for Level", "Level", "Total XP", "XP for Level"].forEach((text) => {
      headerRow.createEl("th", { text });
    });
    const tbody = tableEl.createEl("tbody");
    const midPoint = 50;
    for (let i = 0; i < midPoint; i++) {
      const tr = tbody.createEl("tr");
      const row1 = table[i];
      const row2 = table[i + midPoint];
      [row1.level, row1.totalXp, row1.deltaXp].forEach((val) => {
        const td = tr.createEl("td");
        td.setText(typeof val === "number" && val >= 1e3 ? val.toLocaleString() : val.toString());
      });
      [row2.level, row2.totalXp, row2.deltaXp].forEach((val) => {
        const td = tr.createEl("td");
        td.setText(typeof val === "number" && val >= 1e3 ? val.toLocaleString() : val.toString());
      });
    }
    const btnRow = contentEl.createEl("div", { cls: "xp-curve-modal-btn-row" });
    const closeBtn = btnRow.createEl("button");
    closeBtn.setText("Close");
    closeBtn.addClass("xp-curve-modal-close-btn");
    closeBtn.addEventListener("click", () => this.close());
  }
};
__name(_XpCurveModal, "XpCurveModal");
var XpCurveModal = _XpCurveModal;
var _ResetConfirmModal = class _ResetConfirmModal extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("reset-modal-content");
    const headerRow = contentEl.createEl("div");
    headerRow.addClass("reset-modal-header-row");
    const warnIcon = headerRow.createEl("span");
    warnIcon.addClass("reset-modal-warn-icon");
    (0, import_obsidian.setIcon)(warnIcon, "alert-triangle");
    const title = headerRow.createEl("h2");
    title.setText("\u26A0\uFE0F Factory Reset \u2014 Quest Log");
    title.addClass("reset-modal-header");
    const desc1 = contentEl.createEl("p");
    desc1.setText("This will permanently delete all Quests, Habits, Skills, and Completed folders and files.");
    desc1.addClass("reset-modal-desc");
    const desc2 = contentEl.createEl("p");
    desc2.setText("It will also delete your User Profile and reset all plugin data to factory defaults.");
    desc2.addClass("reset-modal-desc");
    const desc3 = contentEl.createEl("p");
    desc3.setText("This action is irreversible.");
    desc3.addClass("reset-modal-desc");
    const confirmLabel = contentEl.createEl("div");
    confirmLabel.addClass("reset-modal-confirm-label");
    confirmLabel.createEl("span").setText("Type your Hero Name to confirm: ");
    const inputEl = contentEl.createEl("input");
    inputEl.type = "text";
    inputEl.placeholder = this.plugin.settings.heroName;
    inputEl.addClass("reset-modal-input");
    const btnRow = contentEl.createEl("div");
    btnRow.addClass("reset-modal-btn-row");
    const cancelBtn = btnRow.createEl("button");
    cancelBtn.setText("Cancel");
    cancelBtn.addClass("reset-modal-cancel-btn");
    cancelBtn.addEventListener("click", () => {
      this.close();
    });
    const confirmBtn = btnRow.createEl("button");
    confirmBtn.setText("Reset to Factory Defaults");
    confirmBtn.addClass("reset-modal-confirm-btn");
    confirmBtn.disabled = true;
    inputEl.addEventListener("input", () => {
      const matches = inputEl.value === this.plugin.settings.heroName;
      confirmBtn.disabled = !matches;
    });
    confirmBtn.addEventListener("click", async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.setText("Resetting...");
        await this.plugin.performFactoryReset();
        this.close();
        try {
          this.app.setting.close();
        } catch (e) {
        }
        new import_obsidian.Notice("Quest Log has been reset to factory defaults.");
      } catch (error) {
        console.error("Quest Log: Factory reset failed", error);
        new import_obsidian.Notice("Reset failed: " + error.message);
        confirmBtn.disabled = false;
        confirmBtn.setText("Reset to Factory Defaults");
      }
    });
  }
};
__name(_ResetConfirmModal, "ResetConfirmModal");
var ResetConfirmModal = _ResetConfirmModal;
var _QuestLogSettingTab = class _QuestLogSettingTab extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "Rewards" });
    new import_obsidian.Setting(containerEl).setName("Rewards Mode").setDesc(
      "Toggle the Rewards feature to earn coins for completing quests! Spend coins in the Rewards Shop for IRL rewards for working hard!"
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.rewardsMode).onChange(async (value) => {
        this.plugin.settings.rewardsMode = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "XP Curve" });
    new import_obsidian.Setting(containerEl).setName("User Leveling Difficulty").setDesc("Adjust how quickly you level up. Lower = faster, Higher = slower. (Default: 10)").addSlider(
      (slider) => slider.setLimits(1, 20, 1).setValue(this.plugin.settings.userDifficulty || 10).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.userDifficulty = value;
        this.plugin.invalidateLevelCache();
        await this.plugin.saveSettings();
        renderUserXpTable();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Skill Leveling Difficulty").setDesc("Adjust how quickly skills level up. Lower = faster, Higher = slower. (Default: 10)").addSlider(
      (slider) => slider.setLimits(1, 20, 1).setValue(this.plugin.settings.skillDifficulty || 10).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.skillDifficulty = value;
        await this.plugin.saveSettings();
        renderSkillXpTable();
      })
    );
    containerEl.createEl("h4", { text: "\u2694\uFE0F User XP Curve (Levels 1-5)" });
    const userCurveContainer = containerEl.createEl("div", { cls: "xp-curve-table-container" });
    const renderUserXpTable = /* @__PURE__ */ __name(() => {
      userCurveContainer.empty();
      const difficulty = this.plugin.settings.userDifficulty || 10;
      const table = Xp.generateXpCurveTable(difficulty, 5);
      const tableEl = userCurveContainer.createEl("table", { cls: "xp-curve-table" });
      const thead = tableEl.createEl("thead");
      const headerRow = thead.createEl("tr");
      headerRow.createEl("th", { text: "Level" });
      headerRow.createEl("th", { text: "Total XP" });
      headerRow.createEl("th", { text: "XP for Level" });
      const tbody = tableEl.createEl("tbody");
      table.forEach((row) => {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: row.level.toString() });
        tr.createEl("td", { text: row.totalXp.toLocaleString() });
        tr.createEl("td", { text: row.deltaXp.toLocaleString() });
      });
    }, "renderUserXpTable");
    renderUserXpTable();
    containerEl.createEl("h4", { text: "\u{1F31F} Skill XP Curve (Levels 1-5)" });
    const skillCurveContainer = containerEl.createEl("div", { cls: "xp-curve-table-container" });
    const renderSkillXpTable = /* @__PURE__ */ __name(() => {
      skillCurveContainer.empty();
      const difficulty = this.plugin.settings.skillDifficulty || 10;
      const table = Xp.generateXpCurveTable(difficulty, 5);
      const tableEl = skillCurveContainer.createEl("table", { cls: "xp-curve-table" });
      const thead = tableEl.createEl("thead");
      const headerRow = thead.createEl("tr");
      headerRow.createEl("th", { text: "Level" });
      headerRow.createEl("th", { text: "Total XP" });
      headerRow.createEl("th", { text: "XP for Level" });
      const tbody = tableEl.createEl("tbody");
      table.forEach((row) => {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: row.level.toString() });
        tr.createEl("td", { text: row.totalXp.toLocaleString() });
        tr.createEl("td", { text: row.deltaXp.toLocaleString() });
      });
    }, "renderSkillXpTable");
    renderSkillXpTable();
    const btnRow = containerEl.createEl("div", { cls: "xp-curve-btn-row" });
    const viewUserCurveBtn = btnRow.createEl("button", {
      text: "View User Curve (1-100)",
      cls: "xp-curve-full-btn"
    });
    viewUserCurveBtn.addEventListener("click", () => {
      new XpCurveModal(this.app, this.plugin.settings.userDifficulty || 10, "user").open();
    });
    const viewSkillCurveBtn = btnRow.createEl("button", {
      text: "View Skill Curve (1-100)",
      cls: "xp-curve-full-btn"
    });
    viewSkillCurveBtn.addEventListener("click", () => {
      new XpCurveModal(this.app, this.plugin.settings.skillDifficulty || 10, "skill").open();
    });
    containerEl.createEl("h3", { text: "Export" });
    new import_obsidian.Setting(containerEl).setName("Export markdown sidecars").setDesc("Write quests, habits, skills, completed files, and User Profile.md from the live data.json store. Mutations do not write markdown.").addButton(
      (btn) => btn.setButtonText("Export").onClick(async () => {
        await this.plugin.exportMarkdown();
      })
    );
    containerEl.createEl("h3", { text: "File Paths" });
    new import_obsidian.Setting(containerEl).setName("User Profile File").setDesc("Name of the user profile markdown file.").addText(
      (text) => text.setPlaceholder("User Profile").setValue(this.plugin.settings.userProfileFileName).onChange(async (value) => {
        this.plugin.settings.userProfileFileName = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("User Profile Folder").setDesc("Folder where the user profile file is stored.").addText((text) => {
      text.setPlaceholder("Quest Log").setValue(this.plugin.settings.userProfileFolder).onChange(async (value) => {
        this.plugin.settings.userProfileFolder = value.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian.Setting(containerEl).setName("Quests Folder").setDesc("Folder where quest markdown files are stored.").addText((text) => {
      text.setPlaceholder("Quest Log/Quests").setValue(this.plugin.settings.questsFolderPath).onChange(async (value) => {
        this.plugin.settings.questsFolderPath = value.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian.Setting(containerEl).setName("Habits Folder").setDesc("Folder where habit markdown files are stored.").addText((text) => {
      text.setPlaceholder("Quest Log/Habits").setValue(this.plugin.settings.habitsFolderPath).onChange(async (value) => {
        this.plugin.settings.habitsFolderPath = value.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian.Setting(containerEl).setName("Skills Folder").setDesc("Folder where skill markdown files are stored.").addText((text) => {
      text.setPlaceholder("Quest Log/Skills").setValue(this.plugin.settings.skillsFolderPath).onChange(async (value) => {
        this.plugin.settings.skillsFolderPath = value.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian.Setting(containerEl).setName("Completed Quests Folder").setDesc("Folder where completed quest markdown files are stored.").addText((text) => {
      text.setPlaceholder("Quest Log/Completed").setValue(this.plugin.settings.completedFolderPath).onChange(async (value) => {
        this.plugin.settings.completedFolderPath = value.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    containerEl.createEl("h3", { text: "Danger Zone" });
    new import_obsidian.Setting(containerEl).setName("Reset All Data").setDesc("Reset your hero's level, xp, and all quest data. This action cannot be undone.").addButton(
      (btn) => btn.setButtonText("Reset Data").setWarning().onClick(() => new ResetConfirmModal(this.app, this.plugin).open())
    );
  }
};
__name(_QuestLogSettingTab, "QuestLogSettingTab");
var QuestLogSettingTab = _QuestLogSettingTab;

// src/view.js
var import_obsidian2 = require("obsidian");

// src/radar.js
var _SkillRadarChart = class _SkillRadarChart {
  /**
   * @param {HTMLElement} container - The container element to render into
   * @param {Array} skills - Array of skill objects { name, level, xp, legendary? }
   * @param {Function} onSkillClick - Callback when a skill is clicked
   */
  constructor(container, skills, onSkillClick) {
    this.container = container;
    this.skills = skills;
    this.onSkillClick = onSkillClick;
    const containerRect = container.getBoundingClientRect();
    const maxSize = Math.min(containerRect.width || 340, containerRect.height || 340, 340);
    this.size = Math.max(300, maxSize);
    this.center = this.size / 2;
    this.maxRadius = this.size / 2 - 50;
    this.numCircles = 5;
    this.polygonColor = "#5e87ff";
    this.polygonFill = "rgba(94, 135, 255, 0.4)";
    this.lineColor = "#3a3a3a";
    this.radialLineColor = "#444";
    this.textColor = "#aaa";
    this.textHoverColor = "#fff";
    this.bgColor = "transparent";
    this.displaySkills = [...skills].sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 10);
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

// src/view.js
var _QuestLogView = class _QuestLogView extends import_obsidian2.ItemView {
  // One view class. Sections below: XP math, sidecar files, sliders, onOpen (draw once), lists, complete/save.
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._activeTab = "QUESTS";
    this._currentView = "active";
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
  refreshListsAndHeader() {
    if (this._questListContainer) this.renderQuestList(this._questListContainer);
    if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
    if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
    if (this._completedListContainer) this.renderCompletedList(this._completedListContainer);
    this.updateHeader();
  }
  updateHeader() {
    const currentXp = this.plugin.settings.currentXp;
    const level = this.plugin.getLevel();
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const bar = _QuestLogView.xpProgress(level, currentXp, difficulty);
    if (this._levelBadgeEl) this._levelBadgeEl.setText(`${level}`);
    if (this._subtitleEl) this._subtitleEl.setText(_QuestLogView.getLevelTitle(level));
    if (this._xpTextEl) this._xpTextEl.setText(`${bar.into.toLocaleString()} / ${bar.xpNeeded.toLocaleString()}`);
    if (this._xpBarFill) this._xpBarFill.style.width = `${bar.pct}%`;
  }
  createSlider(container, label, labels, color, initialValue, onChange) {
    const group = container.createEl("div", { cls: "quest-slider-group" });
    const labelEl = group.createEl("span", { text: label, cls: "quest-slider-label" });
    labelEl.style.color = color;
    const track = group.createEl("div", { cls: "custom-slider-track" });
    const snapPositions = [3, 25, 50, 75, 97];
    const stars2 = [];
    snapPositions.forEach((pct, i) => {
      const star = track.createEl("span", { cls: "snap-star", text: "\u2605" });
      star.style.position = "absolute";
      star.style.left = pct + "%";
      star.style.top = "calc(50% - 1px)";
      star.style.transform = "translate(-50%, -50%)";
      star.style.fontSize = "12px";
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
    const valueLabel = group.createEl("span", {
      text: labels[initialValue - 1],
      cls: "quest-slider-value"
    });
    let value = initialValue;
    let onDragEnd = onChange;
    const updateSlider = /* @__PURE__ */ __name((val, notify) => {
      value = Math.max(1, Math.min(5, val));
      const pct = (value - 1) / 4 * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      valueLabel.setText(labels[value - 1]);
      stars2.forEach((star, i) => {
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
    (0, import_obsidian2.setIcon)(hamburgerBtn, "menu");
    topBar.createEl("span", { text: "Quest Log", cls: "topbar-title" });
    const settingsBtn = topBar.createEl("button", { cls: "topbar-settings" });
    (0, import_obsidian2.setIcon)(settingsBtn, "settings");
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
            new import_obsidian2.Notice("User Profile not found.");
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
        (0, import_obsidian2.setIcon)(iconEl, item.icon);
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
    const calculatedLvl = this.plugin.getLevel();
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const bar = _QuestLogView.xpProgress(calculatedLvl, currentXp, difficulty);
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
    (0, import_obsidian2.setIcon)(editIcon, "pencil");
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
    subtitleEl.setText(_QuestLogView.getLevelTitle(calculatedLvl));
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
    xpBarFill.style.width = `${percent}%`;
    this._xpBarFill = xpBarFill;
    const fabBtn = container.createEl("button", { cls: "quest-fab" });
    const fabIcon = fabBtn.createEl("span", { cls: "fab-icon" });
    (0, import_obsidian2.setIcon)(fabIcon, "plus");
    fabBtn.style.display = "flex";
    const overlay = container.createEl("div", {
      cls: "quest-creation-overlay ql-overlay"
    });
    overlay.addEventListener("mousedown", (e) => {
      overlay._mouseDownOnOverlay = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && overlay._mouseDownOnOverlay) {
        overlay.removeClass("open");
      }
    });
    const modalBox = overlay.createEl("div", { cls: "quest-modal ql-modal" });
    const modalHeader = modalBox.createEl("div", { cls: "quest-modal-header" });
    const headerIcon = modalHeader.createEl("span", {
      cls: "quest-modal-header-icon"
    });
    (0, import_obsidian2.setIcon)(headerIcon, "scroll");
    modalHeader.createEl("span", { text: "New Quest" });
    const titleInput = modalBox.createEl("input", {
      type: "text",
      placeholder: "Quest Title...",
      cls: "quest-modal-title"
    });
    const descInput = modalBox.createEl("textarea", {
      attr: { placeholder: "Instructions..." },
      cls: "quest-modal-desc"
    });
    const slidersSection = modalBox.createEl("div", {
      cls: "quest-sliders-section"
    });
    var diffSlider, urgSlider, impSlider;
    this.drainSliders();
    this._sliders = [];
    const xpPreview = { el: null };
    const updateXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue()
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    }, "updateXpPreview");
    diffSlider = this.createSlider(
      slidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#5e87ff",
      3,
      updateXpPreview
    );
    urgSlider = this.createSlider(
      slidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#f59e0b",
      3,
      updateXpPreview
    );
    impSlider = this.createSlider(
      slidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#a855f7",
      3,
      updateXpPreview
    );
    const xpRow = modalBox.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${_QuestLogView.calcXp(3, 3, 3).toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const skillsSection = modalBox.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });
    const selectedSkillIds = [];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });
    const updateSelectedSkillsDisplay = /* @__PURE__ */ __name(() => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          (0, import_obsidian2.setIcon)(removeBtn, "x");
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
          cls: "detail-skills-placeholder"
        });
      }
    }, "updateSelectedSkillsDisplay");
    updateSelectedSkillsDisplay();
    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input"
    });
    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };
    const btnContainer = modalBox.createEl("div", {
      cls: "quest-modal-buttons"
    });
    const cancelBtn = btnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn"
    });
    const createBtn = btnContainer.createEl("button", {
      cls: "quest-modal-create-btn"
    });
    const createBtnIcon = createBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon"
    });
    (0, import_obsidian2.setIcon)(createBtnIcon, "plus");
    createBtn.createEl("span", { text: "Create Quest" });
    const closeOverlay = /* @__PURE__ */ __name(() => {
      overlay.removeClass("open");
      titleInput.value = "";
      descInput.value = "";
      diffSlider._setValue(3);
      urgSlider._setValue(3);
      impSlider._setValue(3);
      updateXpPreview();
      selectedSkillIds.length = 0;
      updateSelectedSkillsDisplay();
    }, "closeOverlay");
    var activeTab = this._activeTab || "QUESTS";
    var currentView = this._currentView || "active";
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
      }
    });
    cancelBtn.addEventListener("click", closeOverlay);
    createBtn.addEventListener("click", async () => {
      if (titleInput.value.trim() !== "") {
        const xp = _QuestLogView.calcXp(
          diffSlider._getValue(),
          urgSlider._getValue(),
          impSlider._getValue()
        );
        const quest = {
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
        this.plugin.settings.quests.push(quest);
        await this.plugin.saveSettings();
        this.renderQuestList(questListContainer);
        new import_obsidian2.Notice(`Created Quest: ${quest.title} (${xp.toLocaleString()} XP)`);
        closeOverlay();
      } else {
        new import_obsidian2.Notice("Add Quest Title First!");
      }
    });
    const habitOverlay = container.createEl("div", {
      cls: "quest-creation-overlay ql-overlay"
    });
    habitOverlay.addEventListener("mousedown", (e) => {
      habitOverlay._mouseDownOnOverlay = e.target === habitOverlay;
    });
    habitOverlay.addEventListener("click", (e) => {
      if (e.target === habitOverlay && habitOverlay._mouseDownOnOverlay) {
        habitOverlay.removeClass("open");
      }
    });
    const habitModalBox = habitOverlay.createEl("div", { cls: "quest-modal habit-context ql-modal" });
    const habitModalHeader = habitModalBox.createEl("div", { cls: "quest-modal-header" });
    const habitHeaderIcon = habitModalHeader.createEl("span", { cls: "quest-modal-header-icon" });
    (0, import_obsidian2.setIcon)(habitHeaderIcon, "repeat");
    habitModalHeader.createEl("span", { text: "New Habit" });
    const habitTitleInput = habitModalBox.createEl("input", {
      type: "text",
      placeholder: "Habit Title...",
      cls: "quest-modal-title"
    });
    const habitDescInput = habitModalBox.createEl("textarea", {
      attr: { placeholder: "Description..." },
      cls: "quest-modal-desc"
    });
    const habitSlidersSection = habitModalBox.createEl("div", {
      cls: "quest-sliders-section"
    });
    var habitDiffSlider, habitUrgSlider, habitImpSlider;
    const habitXpPreview = { el: null };
    const updateHabitXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        habitDiffSlider._getValue(),
        habitUrgSlider._getValue(),
        habitImpSlider._getValue()
      );
      habitXpPreview.el.setText(`${xp.toLocaleString()} XP`);
    }, "updateHabitXpPreview");
    habitDiffSlider = this.createSlider(
      habitSlidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#5e87ff",
      3,
      updateHabitXpPreview
    );
    habitUrgSlider = this.createSlider(
      habitSlidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#f59e0b",
      3,
      updateHabitXpPreview
    );
    habitImpSlider = this.createSlider(
      habitSlidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#a855f7",
      3,
      updateHabitXpPreview
    );
    const habitXpRow = habitModalBox.createEl("div", { cls: "quest-xp-preview-row" });
    habitXpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    habitXpPreview.el = habitXpRow.createEl("span", {
      text: `${_QuestLogView.calcXp(3, 3, 3).toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const habitSkillsSection = habitModalBox.createEl("div", { cls: "detail-skills-section" });
    habitSkillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });
    const habitSelectedSkillIds = [];
    const habitSelectedSkillsDisplay = habitSkillsSection.createEl("div", { cls: "detail-selected-skills" });
    const habitSkillInputContainer = habitSkillsSection.createEl("div", { cls: "detail-skill-input-container" });
    const updateHabitSelectedSkillsDisplay = /* @__PURE__ */ __name(() => {
      habitSelectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      habitSelectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = habitSelectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          (0, import_obsidian2.setIcon)(removeBtn, "x");
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
          cls: "detail-skills-placeholder"
        });
      }
    }, "updateHabitSelectedSkillsDisplay");
    updateHabitSelectedSkillsDisplay();
    const habitSkillInput = habitSkillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input"
    });
    const habitSkillSuggest = new SkillSuggest(this.app, habitSkillInput, this.plugin);
    habitSkillSuggest.onSelect = (skill) => {
      if (!habitSelectedSkillIds.includes(skill.id)) {
        habitSelectedSkillIds.push(skill.id);
        updateHabitSelectedSkillsDisplay();
      }
    };
    const habitBtnContainer = habitModalBox.createEl("div", {
      cls: "quest-modal-buttons"
    });
    const habitCancelBtn = habitBtnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn"
    });
    const habitCreateBtn = habitBtnContainer.createEl("button", {
      cls: "quest-modal-create-btn"
    });
    const habitCreateBtnIcon = habitCreateBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon"
    });
    (0, import_obsidian2.setIcon)(habitCreateBtnIcon, "plus");
    habitCreateBtn.createEl("span", { text: "Create Habit" });
    const closeHabitOverlay = /* @__PURE__ */ __name(() => {
      habitOverlay.removeClass("open");
      habitTitleInput.value = "";
      habitDescInput.value = "";
      habitDiffSlider._setValue(3);
      habitUrgSlider._setValue(3);
      habitImpSlider._setValue(3);
      updateHabitXpPreview();
      habitSelectedSkillIds.length = 0;
      updateHabitSelectedSkillsDisplay();
    }, "closeHabitOverlay");
    habitCancelBtn.addEventListener("click", closeHabitOverlay);
    habitCreateBtn.addEventListener("click", async () => {
      if (habitTitleInput.value.trim() !== "") {
        const xp = _QuestLogView.calcXp(
          habitDiffSlider._getValue(),
          habitUrgSlider._getValue(),
          habitImpSlider._getValue()
        );
        const habit = {
          id: Date.now().toString(),
          title: habitTitleInput.value.trim(),
          description: habitDescInput.value.trim(),
          difficulty: habitDiffSlider._getValue(),
          urgency: habitUrgSlider._getValue(),
          impact: habitImpSlider._getValue(),
          xp,
          created: (/* @__PURE__ */ new Date()).toISOString(),
          skillIds: [...habitSelectedSkillIds]
        };
        this.plugin.settings.habits.push(habit);
        await this.plugin.saveSettings();
        this.renderHabitList(habitsContent);
        new import_obsidian2.Notice(`Created Habit: ${habit.title} (${xp.toLocaleString()} XP)`);
        closeHabitOverlay();
      } else {
        new import_obsidian2.Notice("Add Habit Title First!");
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
      (0, import_obsidian2.setIcon)(rewardHeaderIcon, "shopping-bag");
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
          new import_obsidian2.Notice("Give your reward a name!");
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
        new import_obsidian2.Notice(`Created Reward: ${reward.name} (${reward.price} coins)`);
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
      (0, import_obsidian2.setIcon)(tabIcon, icon);
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
        if (colorClass === "tab-habits") fabBtn.addClass("fab-habits");
        if (colorClass === "tab-skills") fabBtn.addClass("fab-skills");
        questListContainer.style.display = text === "QUESTS" ? "flex" : "none";
        habitsContent.style.display = text === "HABITS" ? "flex" : "none";
        skillsContent.style.display = text === "SKILLS" ? "flex" : "none";
        if (shopOverlay) shopOverlay.style.display = "none";
      });
      return btn;
    }, "createTab");
    const questTab = createTab("scroll-text", "QUESTS");
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
      const title = _QuestLogView.getLevelTitle(level);
      shopUserInfo.createEl("span", { text: heroName, cls: "shop-user-name" });
      const levelBadge2 = shopUserInfo.createEl("span", { cls: "shop-level-badge" });
      levelBadge2.setText(`Lv.${level}`);
      const shopCoinDisplay = shopHeader.createEl("div", { cls: "shop-coin-display" });
      const shopCoinIcon = shopCoinDisplay.createEl("span", { cls: "shop-coin-icon" });
      (0, import_obsidian2.setIcon)(shopCoinIcon, "coins");
      this._shopCoinText = shopCoinDisplay.createEl("span", { text: `${this.plugin.settings.coins}`, cls: "shop-coin-text" });
      const shopListEl = shopOverlay.createEl("div", { cls: "shop-list" });
      this._shopListEl = shopListEl;
      this.renderShopList(shopListEl);
      const shopFab = shopOverlay.createEl("button", { cls: "quest-log-fab fab-shop" });
      const shopFabIcon = shopFab.createEl("span", { cls: "fab-icon" });
      (0, import_obsidian2.setIcon)(shopFabIcon, "plus");
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
    (0, import_obsidian2.setIcon)(completedHamburger, "menu");
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
          if (targetTab === "HABITS") fabBtn.addClass("fab-habits");
          if (targetTab === "SKILLS") fabBtn.addClass("fab-skills");
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
    (0, import_obsidian2.setIcon)(skillGraphHamburger, "menu");
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
    (0, import_obsidian2.setIcon)(skillHeaderIcon, "zap");
    skillModalHeader.createEl("span", { text: "New Skill" });
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
    const skillBtnContainer = skillModalBox.createEl("div", {
      cls: "quest-modal-buttons"
    });
    const skillCancelBtn = skillBtnContainer.createEl("button", {
      text: "Cancel",
      cls: "quest-modal-cancel-btn"
    });
    const skillCreateBtn = skillBtnContainer.createEl("button", {
      cls: "quest-modal-create-btn"
    });
    const skillCreateBtnIcon = skillCreateBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon"
    });
    (0, import_obsidian2.setIcon)(skillCreateBtnIcon, "plus");
    skillCreateBtn.createEl("span", { text: "Create Skill" });
    const closeSkillOverlay = /* @__PURE__ */ __name(() => {
      skillOverlay.removeClass("open");
      skillNameInput.value = "";
      skillDescInput.value = "";
    }, "closeSkillOverlay");
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
          created: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.plugin.settings.skills.push(skill);
        await this.plugin.saveSettings();
        this.renderSkillList(skillsContent);
        new import_obsidian2.Notice(`Created Skill: ${skill.name}`);
        closeSkillOverlay();
      } else {
        new import_obsidian2.Notice("Add Skill Name First!");
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
    (0, import_obsidian2.setIcon)(warnIcon, "alert-triangle");
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
    const quests = this.plugin.settings.quests;
    if (quests.length === 0) {
      container.createEl("div", {
        text: "No active quests. Tap + to create one.",
        cls: "quest-list-empty"
      });
      return;
    }
    quests.forEach((quest) => {
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
      (0, import_obsidian2.setIcon)(completeIcon, "check");
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
  // QUEST DETAIL VIEW
  // ----------------------------------------
  openQuestDetail(quest) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    this.drainSliders(box);
    box.empty();
    box.removeClass("habit-context");
    overlay.addClass("open");
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Quest Details",
      cls: "quest-detail-modal-title"
    });
    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn"
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon"
    });
    (0, import_obsidian2.setIcon)(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
      const safeName2 = _QuestLogView.safeName(quest.title);
      const fullPath = `${folderPath}/${safeName2}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });
    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn"
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon"
    });
    (0, import_obsidian2.setIcon)(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(quest.title, async () => {
        this.plugin.settings.quests = this.plugin.settings.quests.filter(
          (q) => q.id !== quest.id
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderQuestList(this._questListContainer);
        new import_obsidian2.Notice("Quest deleted.");
      });
    });
    const titleInput = box.createEl("input", {
      type: "text",
      value: quest.title,
      cls: "quest-detail-title-input"
    });
    const descBox = box.createEl("textarea", {
      text: quest.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." }
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";
    const slidersSection = box.createEl("div", {
      cls: "quest-sliders-section"
    });
    const xpPreview = { el: null };
    const updateXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue()
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    }, "updateXpPreview");
    const diffSlider = this.createSlider(
      slidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#4A9FFF",
      quest.difficulty || 3,
      updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#FFB800",
      quest.urgency || 3,
      updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#C05BFF",
      quest.impact || 3,
      updateXpPreview
    );
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${quest.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const skillsSection = box.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });
    const selectedSkillIds = [...quest.skillIds || []];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });
    const updateSelectedSkillsDisplay = /* @__PURE__ */ __name(() => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          (0, import_obsidian2.setIcon)(removeBtn, "x");
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
          cls: "detail-skills-placeholder"
        });
      }
    }, "updateSelectedSkillsDisplay");
    updateSelectedSkillsDisplay();
    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input"
    });
    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };
    const saveQuest = /* @__PURE__ */ __name(async () => {
      const previousTitle = quest.title;
      quest.title = titleInput.value.trim() || quest.title;
      quest.description = descBox.value.trim();
      quest.difficulty = diffSlider._getValue();
      quest.urgency = urgSlider._getValue();
      quest.impact = impSlider._getValue();
      quest.xp = _QuestLogView.calcXp(quest.difficulty, quest.urgency, quest.impact);
      quest.skillIds = [...selectedSkillIds];
      await this.plugin.saveSettings();
      this.renderQuestList(this._questListContainer);
    }, "saveQuest");
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    btnRow.createEl("div", { cls: "quest-detail-spacer" });
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn"
    });
    closeBtn.addEventListener("click", async () => {
      await saveQuest();
      overlay.removeClass("open");
    });
    const completeBtn = btnRow.createEl("button", {
      text: "Complete",
      cls: "quest-detail-complete-btn"
    });
    const completeIcon = completeBtn.createEl("span", {
      cls: "quest-detail-complete-icon"
    });
    (0, import_obsidian2.setIcon)(completeIcon, "check");
    completeBtn.addEventListener("click", async () => {
      await saveQuest();
      overlay.removeClass("open");
      await this.completeQuest(quest);
      if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
    });
  }
  // ----------------------------------------
  // QUEST ACTIONS
  // ----------------------------------------
  async moveSidecar(sourcePath, destPath) {
    return moveSidecar(this.app, sourcePath, destPath);
  }
  async completeQuest(quest) {
    this.plugin.settings.questsCompleted += 1;
    const completedQuest = { ...quest, completedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.plugin.settings.completedQuests.push(completedQuest);
    this.plugin.settings.quests = this.plugin.settings.quests.filter(
      (q) => q.id !== quest.id
    );
    await this.plugin.saveSettings();
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
      const title = _QuestLogView.getLevelTitle(levelAfter);
      const coinsEarned = levelAfter * 10;
      this.plugin.settings.coins += coinsEarned;
      await this.plugin.saveSettings();
      this.showLevelUpPopup(levelAfter, title, coinsEarned);
    } else {
      new import_obsidian2.Notice(`${sourceName} +${xp.toLocaleString()} XP`);
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
      (0, import_obsidian2.setIcon)(coinIcon, "coins");
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
    const habits = this.plugin.settings.habits;
    if (habits.length === 0) {
      container.createEl("div", {
        text: "No active habits. Tap + to create one.",
        cls: "quest-list-empty"
      });
      return;
    }
    habits.forEach((habit) => {
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
      (0, import_obsidian2.setIcon)(failIcon, "x");
      failBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.failHabit(habit);
      });
      const completeBtn = actionRow.createEl("button", { cls: "habit-complete-btn-mini" });
      const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
      (0, import_obsidian2.setIcon)(completeIcon, "check");
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
    this.plugin.settings.questsCompleted += 1;
    await this.plugin.saveSettings();
    this.renderHabitList(this._habitListContainer);
    this.renderSkillList(this._skillListContainer);
    await this.awardXp(habit.xp, habit.skillIds, "Habit completed:");
  }
  async failHabit(habit) {
    this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
    await this.plugin.saveSettings();
    this.updateHeader();
    new import_obsidian2.Notice(`Habit failed: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
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
        skill.level = _QuestLogView.getSkillLevel(skill.xp, difficulty);
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
      (0, import_obsidian2.setIcon)(emptyIcon, "shopping-bag");
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
      (0, import_obsidian2.setIcon)(coinIcon, "coins");
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
      (0, import_obsidian2.setIcon)(deleteBtn, "trash-2");
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
    (0, import_obsidian2.setIcon)(coinIcon, "coins");
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
      new import_obsidian2.Notice(`Purchased ${qty}x ${reward.name}!`);
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
    const skills = this.plugin.settings.skills || [];
    if (skills.length === 0) {
      container.createEl("div", {
        text: "No skills yet. Tap + to create one.",
        cls: "quest-list-empty"
      });
      return;
    }
    const grid = container.createEl("div", { cls: "skill-grid" });
    skills.forEach((skill) => {
      const block = grid.createEl("div", { cls: "quest-block skill-block" });
      const difficulty = this.plugin.settings.userDifficulty || 10;
      const xpInfo = _QuestLogView.getSkillXpProgress(skill, difficulty);
      block.createEl("div", {
        text: skill.name,
        cls: "quest-block-title"
      });
      if (skill.description) {
        const noteIcon = block.createEl("span", { cls: "skill-note-icon" });
        (0, import_obsidian2.setIcon)(noteIcon, "file-text");
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
    const skills = this.plugin.settings.skills || [];
    const level = this.plugin.getLevel();
    const title = _QuestLogView.getLevelTitle(level);
    const heroName = this.plugin.settings.heroName || "Hero";
    const headerSection = content.createEl("div", { cls: "skill-graph-header-section" });
    const headerRow = headerSection.createEl("div", { cls: "skill-graph-header-row" });
    const iconSpan = headerRow.createEl("span", { cls: "skill-graph-header-icon" });
    (0, import_obsidian2.setIcon)(iconSpan, "sword");
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
    (0, import_obsidian2.setIcon)(pickerBtn, "square");
    const pickerDropdown = content.createEl("div", { cls: "skill-graph-picker-dropdown hidden" });
    const allSkillsSorted = [...skills].sort((a, b) => (b.level || 1) - (a.level || 1));
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
      (0, import_obsidian2.setIcon)(deselectBtn, "square");
      deselectBtn.addEventListener("click", () => {
        selectedSkillIds.clear();
        renderCheckboxes(searchInput.value.toLowerCase());
        updateChart();
      });
      const resetBtn = actionsWrap.createEl("button", {
        cls: "skill-graph-picker-action-btn",
        attr: { "aria-label": "Reset to top 12" }
      });
      (0, import_obsidian2.setIcon)(resetBtn, "list-ordered");
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
              new import_obsidian2.Notice("Maximum 12 skills can be displayed at once.");
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
        (0, import_obsidian2.setIcon)(pickerBtn, "check-square");
      } else {
        pickerDropdown.addClass("hidden");
        (0, import_obsidian2.setIcon)(pickerBtn, "square");
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
    box.addClass("skill-context");
    overlay.addClass("open");
    const difficulty = this.plugin.settings.skillDifficulty || 10;
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Skill Details",
      cls: "quest-detail-modal-title"
    });
    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn"
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon"
    });
    (0, import_obsidian2.setIcon)(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.skillsFolderPath || "Quest Log/Skills";
      const safeName2 = _QuestLogView.safeName(skill.name);
      const fullPath = `${folderPath}/${safeName2}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });
    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn"
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon"
    });
    (0, import_obsidian2.setIcon)(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(skill.name, async () => {
        this.plugin.settings.skills = this.plugin.settings.skills.filter(
          (s) => s.id !== skill.id
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderSkillList(this._skillListContainer);
        new import_obsidian2.Notice("Skill deleted.");
      });
    });
    const nameInput = box.createEl("input", {
      type: "text",
      value: skill.name,
      cls: "quest-detail-title-input"
    });
    const descBox = box.createEl("textarea", {
      text: skill.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." }
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";
    const xpInfo = _QuestLogView.getSkillXpProgress(skill, difficulty);
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
    const skillInfo = box.createEl("div", { cls: "skill-detail-info" });
    skillInfo.createEl("span", {
      text: "Attach this skill to quests or habits to gain XP.",
      cls: "skill-detail-info-text"
    });
    const saveSkill = /* @__PURE__ */ __name(async () => {
      const previousName = skill.name;
      skill.name = nameInput.value.trim() || skill.name;
      skill.description = descBox.value.trim();
      await this.plugin.saveSettings();
      this.renderSkillList(this._skillListContainer);
    }, "saveSkill");
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn"
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
    this.drainSliders(box);
    box.empty();
    box.addClass("habit-context");
    overlay.addClass("open");
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: "Habit Details",
      cls: "quest-detail-modal-title"
    });
    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn"
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon"
    });
    (0, import_obsidian2.setIcon)(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.habitsFolderPath || "Quest Log/Habits";
      const safeName2 = _QuestLogView.safeName(habit.title);
      const fullPath = `${folderPath}/${safeName2}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });
    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn"
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon"
    });
    (0, import_obsidian2.setIcon)(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(habit.title, async () => {
        this.plugin.settings.habits = this.plugin.settings.habits.filter(
          (h) => h.id !== habit.id
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderHabitList(this._habitListContainer);
        new import_obsidian2.Notice("Habit deleted.");
      });
    });
    const titleInput = box.createEl("input", {
      type: "text",
      value: habit.title,
      cls: "quest-detail-title-input"
    });
    const descBox = box.createEl("textarea", {
      text: habit.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." }
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";
    const slidersSection = box.createEl("div", {
      cls: "quest-sliders-section"
    });
    const xpPreview = { el: null };
    const updateXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue()
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    }, "updateXpPreview");
    const diffSlider = this.createSlider(
      slidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#5e87ff",
      habit.difficulty || 3,
      updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#f59e0b",
      habit.urgency || 3,
      updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#a855f7",
      habit.impact || 3,
      updateXpPreview
    );
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${habit.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const createdDate = _QuestLogView.formatDate(habit.created);
    const metaRow = box.createEl("div", { cls: "habit-detail-meta" });
    metaRow.createEl("span", {
      text: `Created ${createdDate}`,
      cls: "habit-detail-meta-text"
    });
    const skillsSection = box.createEl("div", { cls: "detail-skills-section" });
    skillsSection.createEl("span", { text: "Attached Skills", cls: "detail-skills-label" });
    const selectedSkillIds = [...habit.skillIds || []];
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const skillInputContainer = skillsSection.createEl("div", { cls: "detail-skill-input-container" });
    const updateSelectedSkillsDisplay = /* @__PURE__ */ __name(() => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (skill) {
          const tag = selectedSkillsDisplay.createEl("span", { cls: "detail-skill-tag" });
          tag.createEl("span", { text: skill.name });
          const removeBtn = tag.createEl("span", { cls: "detail-skill-tag-remove" });
          (0, import_obsidian2.setIcon)(removeBtn, "x");
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
          cls: "detail-skills-placeholder"
        });
      }
    }, "updateSelectedSkillsDisplay");
    updateSelectedSkillsDisplay();
    const skillInput = skillInputContainer.createEl("input", {
      type: "text",
      placeholder: "Type to add skill...",
      cls: "detail-skill-input"
    });
    const skillSuggest = new SkillSuggest(this.app, skillInput, this.plugin);
    skillSuggest.onSelect = (skill) => {
      if (!selectedSkillIds.includes(skill.id)) {
        selectedSkillIds.push(skill.id);
        updateSelectedSkillsDisplay();
      }
    };
    const saveHabit = /* @__PURE__ */ __name(async () => {
      const previousTitle = habit.title;
      habit.title = titleInput.value.trim() || habit.title;
      habit.description = descBox.value.trim();
      habit.difficulty = diffSlider._getValue();
      habit.urgency = urgSlider._getValue();
      habit.impact = impSlider._getValue();
      habit.xp = _QuestLogView.calcXp(habit.difficulty, habit.urgency, habit.impact);
      habit.skillIds = [...selectedSkillIds];
      await this.plugin.saveSettings();
      this.renderHabitList(this._habitListContainer);
    }, "saveHabit");
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    const failBtn = btnRow.createEl("button", {
      text: "Fail",
      cls: "habit-fail-btn"
    });
    const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
    (0, import_obsidian2.setIcon)(failIcon, "x");
    failBtn.addEventListener("click", async () => {
      await this.failHabit(habit);
      overlay.removeClass("open");
    });
    const closeBtn = btnRow.createEl("button", {
      text: "Close",
      cls: "quest-detail-close-btn"
    });
    closeBtn.addEventListener("click", async () => {
      await saveHabit();
      overlay.removeClass("open");
    });
    const completeBtn = btnRow.createEl("button", {
      text: "Complete",
      cls: "habit-complete-btn"
    });
    const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
    (0, import_obsidian2.setIcon)(completeIcon, "check");
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
      if (item._type === "habit") {
        meta.createEl("span", {
          text: "Habit",
          cls: "completed-block-type"
        });
      }
      meta.createEl("span", {
        text: _QuestLogView.formatDate(item.completedAt),
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
    overlay.addClass("open");
    box.createEl("h2", {
      text: quest.title,
      cls: "quest-detail-title"
    });
    if (quest.description) {
      box.createEl("p", {
        text: quest.description,
        cls: "quest-detail-desc",
        attr: { style: "background: transparent; border: none; padding: 0; color: #ccc; resize: none;" }
      });
    }
    const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", quest.xp.toLocaleString()],
      ["Difficulty", stars2(quest.difficulty)],
      ["Urgency", stars2(quest.urgency)],
      ["Impact", stars2(quest.impact)],
      ["Created", _QuestLogView.formatDate(quest.created)],
      ["Completed", _QuestLogView.formatDate(quest.completedAt)]
    ];
    rows.forEach(([label, value]) => {
      const tr = statsTable.createEl("tr");
      const td1 = tr.createEl("td", { text: label });
      td1.style.cssText = "color: #888; padding: 4px 8px 4px 0; font-weight: bold;";
      const td2 = tr.createEl("td", { text: value });
      td2.style.cssText = "color: #fff; padding: 4px 0; text-align: right;";
    });
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
        new import_obsidian2.Notice("Quest not found.");
        overlay.removeClass("open");
        return;
      }
      const [restored] = this.plugin.settings.completedQuests.splice(idx, 1);
      const { completedAt, ...activeQuest } = restored;
      this.plugin.settings.quests.push(activeQuest);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - restored.xp);
      this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
      await this.plugin.saveSettings();
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      this.renderQuestList(this._questListContainer);
      new import_obsidian2.Notice(`Quest restored: ${restored.title}`);
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
    box.addClass("habit-context");
    overlay.addClass("open");
    box.createEl("h2", {
      text: habit.title,
      cls: "quest-detail-title"
    });
    if (habit.description) {
      box.createEl("p", {
        text: habit.description,
        cls: "quest-detail-desc",
        attr: { style: "background: transparent; border: none; padding: 0; color: #ccc; resize: none;" }
      });
    }
    const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    statsTable.style.cssText = "width: 100%; border-collapse: collapse; font-size: 12px;";
    const rows = [
      ["XP Earned", habit.xp.toLocaleString()],
      ["Difficulty", stars2(habit.difficulty)],
      ["Urgency", stars2(habit.urgency)],
      ["Impact", stars2(habit.impact)],
      ["Type", "Habit (Repeatable)"],
      ["Completed", _QuestLogView.formatDate(habit.completedAt)]
    ];
    rows.forEach(([label, value]) => {
      const tr = statsTable.createEl("tr");
      const td1 = tr.createEl("td", { text: label });
      td1.style.cssText = "color: #888; padding: 4px 8px 4px 0; font-weight: bold;";
      const td2 = tr.createEl("td", { text: value });
      td2.style.cssText = "color: #fff; padding: 4px 0; text-align: right;";
    });
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
        new import_obsidian2.Notice("Completed habit not found.");
        overlay.removeClass("open");
        return;
      }
      this.plugin.settings.completedHabits.splice(idx, 1);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
      this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
      await this.plugin.saveSettings();
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      new import_obsidian2.Notice(`Habit completion undone: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
    });
  }
  async onClose() {
    this.drainSliders();
    this._sliders = null;
  }
};
__name(_QuestLogView, "QuestLogView");
__publicField(_QuestLogView, "getXpMultiplier", Xp.getXpMultiplier);
__publicField(_QuestLogView, "getXpForLvl", Xp.getXpForLvl);
__publicField(_QuestLogView, "getLevel", Xp.getLevel);
__publicField(_QuestLogView, "xpProgress", Xp.xpProgress);
__publicField(_QuestLogView, "generateXpCurveTable", Xp.generateXpCurveTable);
__publicField(_QuestLogView, "getNextMilestones", Xp.getNextMilestones);
__publicField(_QuestLogView, "getSkillXpForLvl", Xp.getSkillXpForLvl);
__publicField(_QuestLogView, "getSkillLevel", Xp.getSkillLevel);
__publicField(_QuestLogView, "getSkillXpProgress", Xp.getSkillXpProgress);
__publicField(_QuestLogView, "DIFFICULTY_LABELS", Xp.DIFFICULTY_LABELS);
__publicField(_QuestLogView, "URGENCY_LABELS", Xp.URGENCY_LABELS);
__publicField(_QuestLogView, "IMPACT_LABELS", Xp.IMPACT_LABELS);
__publicField(_QuestLogView, "calcXp", Xp.calcXp);
__publicField(_QuestLogView, "getLevelTitle", Xp.getLevelTitle);
__publicField(_QuestLogView, "safeName", safeName);
__publicField(_QuestLogView, "formatDate", formatDate);
__publicField(_QuestLogView, "formatHabitTimestamp", formatHabitTimestamp);
__publicField(_QuestLogView, "writeSidecarAtomic", writeSidecarAtomic);
var QuestLogView = _QuestLogView;

// src/plugin.ts
var _QuestLog = class _QuestLog extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this._cachedLevel = null;
    this._cachedXp = null;
    this._cachedDifficulty = null;
    this._isResetting = false;
    this._heroNameTimer = null;
    this._refreshTimer = null;
  }
  getLevel() {
    const xp = this.settings.currentXp;
    const difficulty = this.settings.userDifficulty || 10;
    if (this._cachedXp !== xp || this._cachedDifficulty !== difficulty) {
      this._cachedXp = xp;
      this._cachedDifficulty = difficulty;
      this._cachedLevel = Xp.getLevel(xp, difficulty);
    }
    return this._cachedLevel;
  }
  invalidateLevelCache() {
    this._cachedXp = null;
    this._cachedDifficulty = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(QUESTLOG_VIEW_TYPE, (leaf) => new QuestLogView(leaf, this));
    this.addRibbonIcon("gamepad", "Quest Log", () => this.activateView());
    this.addSettingTab(new QuestLogSettingTab(this.app, this));
    this.addCommand({
      id: "export-markdown",
      name: "Export Quest Log to markdown",
      callback: /* @__PURE__ */ __name(() => {
        void this.exportMarkdown();
      }, "callback")
    });
  }
  async exportMarkdown() {
    try {
      await exportAllSidecars(this);
      new import_obsidian3.Notice("Quest Log exported to markdown.");
    } catch (e) {
      console.error("Quest Log: export failed", e);
      new import_obsidian3.Notice("Export failed: " + (e && e.message ? e.message : e));
    }
  }
  async deleteFolderIfExists(folderPath) {
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (folder) {
        await this.app.vault.delete(folder, true);
      }
    } catch (e) {
    }
  }
  async deleteFileIfExists(filePath) {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.vault.delete(file, true);
      }
    } catch (e) {
    }
  }
  async performFactoryReset() {
    this._isResetting = true;
    try {
      const settings = this.settings;
      const { vault } = this.app;
      const foldersToWipe = [
        settings.questsFolderPath || "Quest Log/Quests",
        settings.habitsFolderPath || "Quest Log/Habits",
        settings.skillsFolderPath || "Quest Log/Skills",
        settings.completedFolderPath || "Quest Log/Completed"
      ];
      for (const folderPath of foldersToWipe) {
        const folder = vault.getAbstractFileByPath(folderPath);
        if (folder) {
          try {
            await vault.trash(folder, true);
          } catch (e) {
            try {
              await vault.delete(folder, true);
            } catch (e2) {
            }
          }
        }
      }
      const userProfileFolder = settings.userProfileFolder || "Quest Log";
      const userProfileFile = settings.userProfileFileName || "User Profile";
      const userProfilePath = userProfileFolder + "/" + userProfileFile + ".md";
      const profileFile = vault.getAbstractFileByPath(userProfilePath);
      if (profileFile) {
        try {
          await vault.trash(profileFile, true);
        } catch (e) {
          try {
            await vault.delete(profileFile, true);
          } catch (e2) {
          }
        }
      }
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      await this.saveSettings();
    } finally {
      this._isResetting = false;
    }
    const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
    if (leaves.length > 0 && leaves[0].view && typeof leaves[0].view.refreshListsAndHeader === "function") {
      leaves[0].view.refreshListsAndHeader();
    }
    return true;
  }
  onunload() {
    if (this._heroNameTimer) {
      clearTimeout(this._heroNameTimer);
      this._heroNameTimer = null;
    }
    if (this._refreshTimer) {
      activeWindow.clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign(
      {},
      JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      loaded || {}
    );
    const pathKeys = [
      "questsFolderPath",
      "habitsFolderPath",
      "skillsFolderPath",
      "completedFolderPath",
      "userProfileFolder"
    ];
    for (const key of pathKeys) {
      if (this.settings[key]) {
        this.settings[key] = (0, import_obsidian3.normalizePath)(this.settings[key]);
      }
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.invalidateLevelCache();
  }
  async onExternalSettingsChange() {
    await this.loadSettings();
    this.invalidateLevelCache();
    const leaves = this.app.workspace.getLeavesOfType(QUESTLOG_VIEW_TYPE);
    if (leaves.length > 0 && leaves[0].view && typeof leaves[0].view.refreshListsAndHeader === "function") {
      leaves[0].view.refreshListsAndHeader();
    }
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
};
__name(_QuestLog, "QuestLog");
var QuestLog = _QuestLog;

// src/main.ts
var main_default = QuestLog;
