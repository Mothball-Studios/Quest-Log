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

// ============================================================
// CONSTANTS & DEFAULTS
// ============================================================

var QUESTLOG_VIEW_TYPE = "quest-log-view";

var DEFAULT_SETTINGS = {
  rewardsMode: false,
  currentXp: 0,
  heroName: "Hero",
};

// ============================================================
// PLUGIN CLASS — Entry point, loads/unloads the plugin
// ============================================================

var QuestLog = class extends Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      QUESTLOG_VIEW_TYPE,
      (leaf) => new QuestLogView(leaf, this),
    );
    this.addRibbonIcon("gamepad", "Quest Log", () => this.activateView());
    this.addSettingTab(new QuestLogSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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

    contentEl.createEl("h2", {
      text: "Confirm Reset",
      cls: "reset-modal-header",
    });
    contentEl.createEl("p", {
      text: `Type "${this.plugin.settings.heroName}" to confirm data reset:`,
      cls: "reset-modal-desc",
    });

    const inputEl = contentEl.createEl("input", {
      type: "text",
      cls: "reset-input",
    });
    const btnContainer = contentEl.createEl("div", {
      cls: "reset-btn-container",
    });
    const confirmBtn = btnContainer.createEl("button", {
      text: "Reset Everything",
      cls: "reset-confirm-btn",
    });
    confirmBtn.disabled = true;

    // Enable button only when hero name matches
    inputEl.addEventListener("input", () => {
      confirmBtn.disabled = inputEl.value !== this.plugin.settings.heroName;
    });

    // Reset all settings to defaults
    confirmBtn.addEventListener("click", async () => {
      this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
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

  // ----------------------------------------
  // XP & LEVEL CALCULATIONS
  // ----------------------------------------

  getXpForLvl(xpReq) {
    if (xpReq === 0) return 0;
    const curve = 8 * Math.pow(xpReq, 2.7);
    const linear = xpReq * 1000;
    return Math.floor(Math.max(linear, curve));
  }

  getLevel(currentXp) {
    if (currentXp < 1000) return 1;
    const linearLevel = currentXp / 1000;
    const rawLevel = Math.pow(currentXp / 8, 1 / 2.7);
    return Math.floor(Math.max(linearLevel, rawLevel));
  }

  // ----------------------------------------
  // UI CREATION
  // ----------------------------------------

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("quest-log-container");

    // --- HEADER ---
    const header = container.createEl("div", { cls: "quest-header" });
    const currentXp = this.plugin.settings.currentXp;
    const calculatedLvl = this.getLevel(currentXp);
    const xpFrmPrevLvls = this.getXpForLvl(calculatedLvl - 1);
    const xpForNextLvl = this.getXpForLvl(calculatedLvl);
    const progressXp = currentXp - xpFrmPrevLvls;
    const totalXpInLvl = xpForNextLvl - xpFrmPrevLvls;
    const percent = (progressXp / totalXpInLvl) * 100;

    // Level badge
    const levelBadge = header.createEl("div", { cls: "level-badge" });
    levelBadge.createEl("h1", { text: `${calculatedLvl}` });

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
    heroInfo.createEl("div", { text: "Novice Adventurer", cls: "sub-text" });

    // XP info
    const xpInfo = header.createEl("div", { cls: "xp-info" });
    xpInfo.createEl("div", { text: "Xp Progress", cls: "sub-text" });
    xpInfo.createEl("div", {
      text: `${progressXp.toLocaleString()} / ${totalXpInLvl.toLocaleString()}`,
      cls: "xp-text",
    });

    // XP bar
    const xpBarContainer = container.createEl("div", {
      cls: "xp-bar-container",
    });
    const xpBarFill = xpBarContainer.createEl("div", { cls: "xp-bar-fill" });
    xpBarFill.style.width = `${percent}%`;

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
    const modalHeader = modalBox.createEl("h2", { cls: "quest-modal-header" });
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
      overlay.style.display = "none";
      titleInput.value = "";
      descInput.value = "";
    };

    fabBtn.addEventListener("click", () => {
      overlay.style.display = "flex";
      titleInput.focus();
    });

    cancelBtn.addEventListener("click", closeOverlay);

    createBtn.addEventListener("click", () => {
      if (titleInput.value.trim() !== "") {
        new Notice(`Created Quest: ${titleInput.value}`);
        closeOverlay();
      } else {
        new Notice("Add Quest Title First!");
      }
    });

    overlay.style.display = "none";

    // --- TABS ---
    const tabsContainer = container.createEl("div", { cls: "quest-log-tabs" });
    const allTabs = [];

    const createTab = (icon, text) => {
      const btn = tabsContainer.createEl("button");
      const tabIcon = btn.createEl("span", { cls: "tab-icon" });
      setIcon(tabIcon, icon);
      btn.createEl("span", { text });
      allTabs.push(btn);

      btn.addEventListener("click", () => {
        allTabs.forEach((t) => t.removeClass("active-tab"));
        btn.addClass("active-tab");
        fabBtn.style.display = "flex";
      });

      return btn;
    };

    const questTab = createTab("scroll-text", "QUESTS");
    createTab("list-todo", "HABITS");
    createTab("book-open", "SKILLS");
    questTab.addClass("active-tab");
  }

  async onClose() {}
};

module.exports = QuestLog;
