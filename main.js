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
  quests: [],
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

    // Reset all settings to defaults (deep clone to avoid shared array refs)
    confirmBtn.addEventListener("click", async () => {
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

  // ----------------------------------------
  // XP & LEVEL CALCULATIONS
  // ----------------------------------------

  // XP threshold to reach a given level (0-indexed: level 0 = 0 XP)
  getXpForLvl(lvl) {
    if (lvl <= 0) return 0;
    const curve = 8 * Math.pow(lvl, 2.7);
    const linear = lvl * 1000;
    return Math.floor(Math.max(linear, curve));
  }

  // Determine level from current XP — find highest level whose threshold we've met
  getLevel(currentXp) {
    let lvl = 1;
    while (this.getXpForLvl(lvl) <= currentXp) {
      lvl++;
    }
    return lvl;
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
    const difficultyLabels = ["Trivial", "Easy", "Medium", "Hard", "Legendary"];
    const urgencyLabels = ["Relaxed", "Soon", "Urgent", "Critical", "Immediate"];
    const impactLabels = ["Minor", "Notable", "Major", "Epic", "Legendary"];

    const createSlider = (container, label, labels, color, onChange) => {
      const group = container.createEl("div", { cls: "quest-slider-group" });
      const labelEl = group.createEl("span", { text: label, cls: "quest-slider-label" });
      labelEl.style.color = color;

      // Custom slider track + thumb
      const track = group.createEl("div", { cls: "custom-slider-track" });
      const fill = track.createEl("div", { cls: "custom-slider-fill" });
      fill.style.backgroundColor = color;
      const thumb = track.createEl("div", { cls: "custom-slider-thumb" });
      thumb.style.backgroundColor = color;

      const valueLabel = group.createEl("span", {
        text: labels[2],
        cls: "quest-slider-value",
      });

      let value = 3;
      let onDragEnd = onChange; // called only on release, not during init

      const updateSlider = (val, notify) => {
        value = Math.max(1, Math.min(5, val));
        const pct = ((value - 1) / 4) * 100;
        fill.style.width = pct + "%";
        thumb.style.left = pct + "%";
        valueLabel.setText(labels[value - 1]);
        if (notify && onDragEnd) onDragEnd();
      };

      // Set initial position (no callback)
      updateSlider(3, false);

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
        e.preventDefault();
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

      // Touch drag support for mobile
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

      // Expose getter/setter
      group._getValue = () => value;
      group._setValue = (v) => updateSlider(v, false);

      return group;
    };

    // Exponential XP: exactly 100 at min (sum=3), exactly 500,000 at max (sum=15)
    // r = 5000^(1/12) ≈ 1.9958
    const calcXp = (d, u, i) => {
      const sum = d + u + i;
      if (sum <= 3) return 100;
      if (sum >= 15) return 500000;
      return Math.round(100 * Math.pow(5000, (sum - 3) / 12));
    };

    // --- SLIDERS ---
    const slidersSection = modalBox.createEl("div", {
      cls: "quest-sliders-section",
    });

    var diffSlider, urgSlider, impSlider;
    const xpPreview = { el: null };

    const updateXpPreview = () => {
      const xp = calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue(),
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
    };

    diffSlider = createSlider(
      slidersSection, "Difficulty", difficultyLabels, "#5e87ff", updateXpPreview
    );
    urgSlider = createSlider(
      slidersSection, "Urgency", urgencyLabels, "#f59e0b", updateXpPreview
    );
    impSlider = createSlider(
      slidersSection, "Impact", impactLabels, "#a855f7", updateXpPreview
    );

    // XP preview
    const xpRow = modalBox.createEl("div", { cls: "quest-xp-preview-row" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpPreview.el = xpRow.createEl("span", {
      text: `${calcXp(3, 3, 3).toLocaleString()} XP`,
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
      overlay.style.display = "none";
      titleInput.value = "";
      descInput.value = "";
      diffSlider._setValue(3);
      urgSlider._setValue(3);
      impSlider._setValue(3);
      updateXpPreview();
    };

    // Track active tab
    var activeTab = "QUESTS";

    fabBtn.addEventListener("click", () => {
      if (activeTab === "QUESTS") {
        overlay.style.display = "flex";
        titleInput.focus();
      } else {
        comingSoonOverlay.style.display = "flex";
      }
    });

    cancelBtn.addEventListener("click", closeOverlay);

    createBtn.addEventListener("click", () => {
      if (titleInput.value.trim() !== "") {
        const xp = calcXp(
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
        this.plugin.saveSettings();
        this.renderQuestList(questListContainer);
        new Notice(`Created Quest: ${quest.title} (${xp.toLocaleString()} XP)`);
        closeOverlay();
      } else {
        new Notice("Add Quest Title First!");
      }
    });

    overlay.style.display = "none";

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
      comingSoonOverlay.style.display = "none";
    });
    comingSoonOverlay.style.display = "none";

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
      cls: "tab-content-placeholder",
    });
    habitsContent.createEl("div", {
      text: "Habits coming soon.",
      cls: "quest-list-empty",
    });
    habitsContent.style.display = "none";

    const skillsContent = container.createEl("div", {
      cls: "tab-content-placeholder",
    });
    skillsContent.createEl("div", {
      text: "Skills coming soon.",
      cls: "quest-list-empty",
    });
    skillsContent.style.display = "none";

    // --- QUEST DETAIL OVERLAY ---
    const detailOverlay = this.containerEl.createEl("div", {
      cls: "quest-detail-overlay",
    });
    const detailBox = detailOverlay.createEl("div", {
      cls: "quest-detail-box",
    });
    detailOverlay.style.display = "none";

    // Store references for rendering
    this._questListContainer = questListContainer;
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
        text: `${quest.xp} XP`,
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
    overlay.style.display = "flex";

    // Header row: editable title + XP
    const headerRow = box.createEl("div", { cls: "quest-detail-header" });
    const titleInput = headerRow.createEl("input", {
      type: "text",
      value: quest.title,
      cls: "quest-detail-title-input",
    });
    headerRow.createEl("div", {
      text: `${quest.xp} XP`,
      cls: "quest-detail-xp",
    });

    // Editable description
    const descBox = box.createEl("textarea", {
      text: quest.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." },
    });

    // Auto-size the textarea to content
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";

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
    deleteBtn.addEventListener("click", () => {
      this.plugin.settings.quests = this.plugin.settings.quests.filter(
        (q) => q.id !== quest.id,
      );
      this.plugin.saveSettings();
      overlay.style.display = "none";
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
    closeBtn.addEventListener("click", () => {
      // Save any edits
      const updatedTitle = titleInput.value.trim();
      const updatedDesc = descBox.value.trim();
      if (updatedTitle !== quest.title || updatedDesc !== quest.description) {
        quest.title = updatedTitle || quest.title;
        quest.description = updatedDesc;
        this.plugin.saveSettings();
        this.renderQuestList(this._questListContainer);
      }
      overlay.style.display = "none";
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
    completeBtn.addEventListener("click", () => {
      // Award XP
      this.plugin.settings.currentXp += quest.xp;
      // Remove quest from list
      this.plugin.settings.quests = this.plugin.settings.quests.filter(
        (q) => q.id !== quest.id,
      );
      this.plugin.saveSettings();
      overlay.style.display = "none";
      new Notice(`Quest Complete! +${quest.xp} XP`);
      // Refresh the whole view to update XP bar and quest list
      this.onOpen();
    });
  }

  async onClose() {}
};

module.exports = QuestLog;
