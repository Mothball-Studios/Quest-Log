/**
 * Quest Log — ItemView UI (W6).
 * Ported from 0.5.5 _QuestLogView. Domain reads via loadDomain (data.json) / plugin.settings mirror.
 * Mutations via plugin.saveSettings (persistSettingsMirror → domain modules) or domain facades.
 * MUST NOT call saveDomain / writeJsonAtomic / writeAtomic for live state from this file.
 * Markdown sidecar writes are stubbed no-ops for modular v1.
 */
"use strict";

const { loadDomain } = require("./storage");
const { createOverlayShell } = require("./overlay");

const QUESTLOG_VIEW_TYPE = "quest-log-view";

async function loadSnapshot(plugin) {
  return {
    settings: await loadDomain(plugin, "settings"),
    profile: await loadDomain(plugin, "profile"),
    quests: await loadDomain(plugin, "active_quests"),
    completedQuests: await loadDomain(plugin, "completed_quests"),
    habits: await loadDomain(plugin, "habits"),
    completedHabits: await loadDomain(plugin, "completed_habits"),
    skills: await loadDomain(plugin, "skills"),
  };
}

function registerQuestLogView(plugin, obsidian) {
  const { QuestLogView } = createRenderModule(obsidian);
  plugin.registerView(QUESTLOG_VIEW_TYPE, (leaf) => new QuestLogView(leaf, plugin));
  return { QuestLogView, QUESTLOG_VIEW_TYPE };
}

function createRenderModule(obsidianNS) {
  const { ItemView, Notice, setIcon } = obsidianNS;
  // Never assign onto obsidianNS.setIcon — Obsidian exports it as getter-only.

  // esbuild helpers kept as no-ops / identity so ported bodies stay intact
  function __name(fn, _n) { return fn; }
  function __publicField(obj, key, val) { obj[key] = val; return val; }


/** Sidecar markdown helpers intentionally no-op in modular render (JSON writes forbidden here). */
async function writeSidecarAtomic() { return; }
async function writeQuestFile() { return; }
async function writeCompletedQuestFile() { return; }
async function writeHabitFile() { return; }
async function writeSkillFile() { return; }
async function writeUserProfile() { return; }
async function trashIfExists() { return false; }
async function retireNote() { return false; }


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
    // Always derive level from xp + userDifficulty curve (same class of bug as
    // getSkillXpProgress). Ignore caller-passed level — profile.getLevel used
    // to return lo (off-by-one vs this band math) and any stale value would
    // push into > xpNeeded → full bar + wrong "X / Y" text.
    const derivedLevel = this.getLevel(xp, difficulty);
    const xpFromPrev = this.getXpForLvl(derivedLevel - 1, difficulty);
    const xpForNext = this.getXpForLvl(derivedLevel, difficulty);
    const xpNeeded = Math.max(0, xpForNext - xpFromPrev);
    const rawProgress = (xp || 0) - xpFromPrev;
    const into = xpNeeded > 0 ? Math.min(xpNeeded, Math.max(0, rawProgress)) : 0;
    // Continuous % (not Math.round): integer % stepped the master bar at high
    // levels — e.g. ~7k quest XP is <<1% of a wide band, so fill sat until a
    // whole-percent threshold then jumped. Sub-percent precision keeps width
    // tracking into/xpNeeded; CSS accepts fractional %.
    const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, into / xpNeeded * 100)) : 100;
    return { xpForNext, xpFromPrev, xpNeeded, into, pct, level: derivedLevel };
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
    const xp = skill.xp || 0;
    // Always derive level from xp + curve; stored skill.level can lag after difficulty changes.
    const level = this.getSkillLevel(xp, difficulty);
    if (skill.level !== level) skill.level = level;
    const xpForCurrent = this.getSkillXpForLvl(level - 1, difficulty);
    const xpForNext = this.getSkillXpForLvl(level, difficulty);
    const xpNeeded = Math.max(0, xpForNext - xpForCurrent);
    const rawProgress = xp - xpForCurrent;
    const xpProgress = xpNeeded > 0 ? Math.min(xpNeeded, Math.max(0, rawProgress)) : 0;
    const pct = xpNeeded > 0 ? Math.min(100, Math.max(0, xpProgress / xpNeeded * 100)) : 100;
    return {
      xp,
      level,
      xpForCurrent,
      xpForNext,
      xpNeeded,
      xpProgress,
      pct
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

function stars(n) {
  return "\u2B50".repeat(n);
}
__name(stars, "stars");
function safeName(str) {
  return String(str || "").replace(/[\\/:*?"<>|]/g, "-");
}
__name(safeName, "safeName");
function uniqueStem(list, title, id, key) {
  const base = safeName(title);
  const clash = (list || []).some((item) => item.id !== id && safeName(item[key]) === base);
  return clash ? `${base}-${id}` : base;
}
__name(uniqueStem, "uniqueStem");
async function trashIfExists(plugin, fullPath) {
  const file = plugin.app.vault.getAbstractFileByPath(fullPath);
  if (!file) return false;
  try {
    await plugin.app.vault.trash(file, false);
  } catch (e) {
    await plugin.app.vault.delete(file);
  }
  return true;
}
__name(trashIfExists, "trashIfExists");
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


function questNotePaths(plugin, quest, list, folderPath) {
  const folder = folderPath;
  const stems = new Set([
    uniqueStem(list, quest.title, quest.id, "title"),
    safeName(quest.title)
  ]);
  return [...stems].map((stem) => `${folder}/${stem}.md`);
}
__name(questNotePaths, "questNotePaths");
function habitNotePaths(plugin, habit) {
  const folder = plugin.settings.habitsFolderPath || "Quest Log/Habits";
  const stems = new Set([
    uniqueStem(plugin.settings.habits, habit.title, habit.id, "title"),
    safeName(habit.title)
  ]);
  return [...stems].map((stem) => `${folder}/${stem}.md`);
}
__name(habitNotePaths, "habitNotePaths");
function skillNotePaths(plugin, skill) {
  const folder = plugin.settings.skillsFolderPath || "Quest Log/Skills";
  const stems = new Set([
    uniqueStem(plugin.settings.skills, skill.name, skill.id, "name"),
    safeName(skill.name)
  ]);
  return [...stems].map((stem) => `${folder}/${stem}.md`);
}
__name(skillNotePaths, "skillNotePaths");
function completedHabitNotePath(plugin, habit, completedAt) {
  const folder = plugin.settings.completedFolderPath || "Quest Log/Completed";
  return `${folder}/${safeName(habit.title)} - ${formatHabitTimestamp(completedAt)}.md`;
}
__name(completedHabitNotePath, "completedHabitNotePath");

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
    this.polygonColor = "#22c55e";
    this.polygonFill = "rgba(34, 197, 94, 0.4)";
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

var _QuestLogView = class _QuestLogView extends obsidianNS.ItemView {
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
  /**
   * 0.6.52 live-sync: true while the user is mid-edit (any modal/popup/overlay open, a text field focused, skill-graph
   * picker open). The plugin then DEFERS adopting external data.json changes until this returns false.
   */
  isSyncBusy() {
    const c = this.overlayHost();
    if (!c || !c.querySelector) return false;
    if (c.querySelector(".ql-overlay.open, .shop-purchase-overlay, .ql-levelup-overlay, .delete-confirm-overlay, .skill-graph-picker-dropdown:not(.hidden)")) return true;
    const ae = (c.ownerDocument || document).activeElement;
    if (ae && c.contains(ae)) {
      // a field left focused inside a modal that has since closed (.ql-overlay without .open) is not an edit in progress
      if (ae.closest && ae.closest(".ql-overlay:not(.open)")) return false;
      const tag = (ae.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || ae.isContentEditable || ae.getAttribute && ae.getAttribute("contenteditable") === "true") return true;
    }
    return false;
  }
  /**
   * 0.6.52 live-sync: re-render the open view from plugin.settings after an external data.json change.
   * Reuses the existing renderers only (no markup changes). Shell stays open: shop list/coins refreshed in place,
   * skill graph rebuilt silently (no fade) only when skills actually changed.
   */
  refreshExternal() {
    const c = this.overlayHost();
    if (!c || !this._questListContainer) return;
    const st = this.plugin.settings;
    this.refreshListsAndHeader();
    if (this._heroNameEl && this._heroNameEl.innerText !== st.heroName && (c.ownerDocument || document).activeElement !== this._heroNameEl) {
      this._heroNameEl.setText(st.heroName);
    }
    if (this._shopListEl) {
      this.renderShopList(this._shopListEl);
      if (this._shopCoinText) this._shopCoinText.setText(`${st.coins}`);
      const nm = c.querySelector(".shop-user-name");
      if (nm) nm.setText(st.heroName || "Hero");
      const lv = c.querySelector(".shop-level-badge");
      if (lv) lv.setText(`Lv.${this.plugin.getLevel()}`);
    }
    if (this._overlayShell && this._overlayShell.current() === "skill-graph") {
      const sig = JSON.stringify([st.heroName, st.currentXp, (st.skills || []).map((s) => [s.id, s.name, s.xp, s.level])]);
      if (sig !== this._graphSig) {
        this._silentGraph = true;
        try {
          this.showSkillGraphModal();
        } finally {
          this._silentGraph = false;
        }
      }
    }
  }
  updateHeader() {
    const currentXp = this.plugin.settings.currentXp;
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const bar = _QuestLogView.xpProgress(null, currentXp, difficulty);
    const level = bar.level;
    if (this._levelBadgeEl) this._levelBadgeEl.setText(`${level}`);
    if (this._subtitleEl) this._subtitleEl.setText(_QuestLogView.getLevelTitle(level));
    if (this._xpTextEl) this._xpTextEl.setText(`${bar.into.toLocaleString()} / ${bar.xpNeeded.toLocaleString()}`);
    if (this._xpBarFill) this._xpBarFill.style.width = `${Number(bar.pct.toFixed(4))}%`;
  }
  createSlider(container, label, labels, color, initialValue, onChange) {
    const group = container.createEl("div", { cls: "quest-slider-group" });
    const labelEl = group.createEl("span", { text: label, cls: "quest-slider-label" });
    labelEl.style.color = color;
    const track = group.createEl("div", { cls: "custom-slider-track" });
    // Marker + thumb/fill share this array so values 1–5 center exactly on each ★.
    const snapPositions = [3, 25, 50, 75, 97];
    const stars2 = [];
    snapPositions.forEach((pct) => {
      const star = track.createEl("span", { cls: "snap-star", text: "\u2605" });
      star.style.position = "absolute";
      star.style.left = pct + "%";
      star.style.top = "calc(50%)";  // down 1px from prior (50% - 1px); Micah may bump later
      star.style.transform = "translate(-50%, -50%)";
      star.style.fontSize = "10.8px";
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
    thumb.style.boxShadow = `0 0 8px ${color}`;
    const valueLabel = group.createEl("span", {
      text: labels[initialValue - 1],
      cls: "quest-slider-value"
    });
    let value = initialValue;
    let onDragEnd = onChange;
    const updateSlider = /* @__PURE__ */ __name((val, notify) => {
      value = Math.max(1, Math.min(5, val));
      const pct = snapPositions[value - 1];
      // At max (5), extend fill to 100% so the bar end has no gap; thumb stays on the 97% mark.
      fill.style.width = (value === 5 ? 100 : pct) + "%";
      thumb.style.left = pct + "%";
      valueLabel.setText(labels[value - 1]);
      stars2.forEach((star, i) => {
        if (i < value) {
          star.style.color = color;
          star.style.fontSize = "12.6px";
          star.style.textShadow = "none";
        } else {
          star.style.color = "#555";
          star.style.fontSize = "10.8px";
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
  attachSkillPicker(parentEl, initialIds) {
    const selectedSkillIds = [...initialIds || []];
    // Mirror reward-section layout: centered header label + plus on far right, divider, pretty skill blocks
    const skillsSection = parentEl.createEl("div", { cls: "detail-skills-section quest-detail-reward" });
    const header = skillsSection.createEl("div", { cls: "detail-skills-header" });
    header.createEl("span", { text: "attach skills", cls: "quest-xp-preview-label detail-skills-label" });
    const plusBtn = header.createEl("button", {
      cls: "detail-skills-plus-btn",
      attr: { "aria-label": "plus", type: "button" }
    });
    const plusIcon = plusBtn.createEl("span", { cls: "detail-skills-plus-icon" });
    setIcon(plusIcon, "plus");
    skillsSection.createEl("div", { cls: "quest-detail-reward-divider detail-skills-divider" });
    const selectedSkillsDisplay = skillsSection.createEl("div", { cls: "detail-selected-skills" });
    const refresh = /* @__PURE__ */ __name(() => {
      selectedSkillsDisplay.empty();
      const skills = this.plugin.settings.skills || [];
      const difficulty = this.plugin.settings.skillDifficulty || 10;
      selectedSkillIds.forEach((skillId) => {
        const skill = skills.find((s) => s.id === skillId);
        if (!skill) return;
        const xpInfo = _QuestLogView.getSkillXpProgress(skill, difficulty);
        // Pretty blocks: title|level band (level top-right pin) + XP flush bottom — NO desc (Skills tab only)
        const row = selectedSkillsDisplay.createEl("div", {
          cls: "skills-selector-row skill-selector-row detail-skill-attached-row detail-linked-attached-row"
        });
        const body = row.createEl("span", { cls: "linked-selector-row-body detail-skill-attached-body" });
        // Top band: title | level (same Y). No description here — desc is Skills tab only.
        const titleRow = body.createEl("span", { cls: "detail-skill-attached-title-row skill-selector-band" });
        titleRow.createEl("span", {
          text: skill.name || "Untitled",
          cls: "skills-selector-row-label linked-selector-row-title detail-skill-attached-title"
        });
        titleRow.createEl("span", {
          text: (skill.legendary ? "\u2605 " : "") + "Lvl " + (xpInfo.level || 1),
          cls: "detail-skill-attached-level"
        });
        const xpBar = body.createEl("div", { cls: "skill-xp-bar detail-skill-attached-xp-bar" });
        const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
        xpFill.style.width = `${xpInfo.pct}%`;
        const removeBtn = row.createEl("button", {
          cls: "detail-linked-row-remove",
          attr: { "aria-label": "Detach", type: "button" }
        });
        const removeIcon = removeBtn.createEl("span", { cls: "detail-linked-row-remove-icon" });
        setIcon(removeIcon, "x");
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = selectedSkillIds.indexOf(skillId);
          if (idx > -1) selectedSkillIds.splice(idx, 1);
          refresh();
        });
      });
      if (selectedSkillIds.length === 0) {
        selectedSkillsDisplay.createEl("span", {
          text: "no skills attached",
          cls: "detail-skills-placeholder"
        });
      } else {
        this.bindSkillGridWrapSpans(selectedSkillsDisplay, 3);
      }
    }, "refreshSkillPicker");
    refresh();
    plusBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openSkillsSelectorModal(selectedSkillIds, refresh);
    });
    selectedSkillIds.refresh = refresh;
    return selectedSkillIds;
  }
  openSkillsSelectorModal(selectedSkillIds, onApplied) {
    const host = this.overlayHost();
    if (!host) return;
    const existing = host.querySelector(".skills-selector-overlay");
    if (existing) existing.remove();
    const overlay = host.createEl("div", {
      cls: "skills-selector-overlay ql-overlay open"
    });
    const box = overlay.createEl("div", {
      cls: "quest-modal skills-selector-modal ql-modal"
    });
    const header = box.createEl("div", { cls: "quest-modal-header skills-selector-header" });
    header.createEl("span", { text: "Skills Selector", cls: "skills-selector-title" });
    const closeBtn = header.createEl("button", {
      cls: "quest-detail-close-btn quest-modal-close-btn",
      attr: { "aria-label": "Close", type: "button" }
    });
    const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
    setIcon(closeIcon, "x");
    const searchInput = box.createEl("input", {
      type: "text",
      placeholder: "Type Skill Name",
      cls: "skills-selector-search ql-input",
      attr: { "aria-label": "Type Skill Name" }
    });
    box.createEl("div", { cls: "quest-detail-reward-divider skills-selector-divider" });
    const listEl = box.createEl("div", { cls: "skills-selector-list" });
    const draft = new Set(selectedSkillIds);
    const difficulty = this.plugin.settings.skillDifficulty || 10;
    const renderList = /* @__PURE__ */ __name((query = "") => {
      listEl.empty();
      const skills = [...(this.plugin.settings.skills || [])].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
      const q = query.trim().toLowerCase();
      const filtered = q ? skills.filter((s) => (s.name || "").toLowerCase().includes(q)) : skills;
      if (filtered.length === 0) {
        listEl.createEl("div", {
          text: skills.length === 0 ? "No skills yet" : "No matching skills",
          cls: "skills-selector-empty"
        });
        return;
      }
      filtered.forEach((skill) => {
        const id = skill.id;
        const xpInfo = _QuestLogView.getSkillXpProgress(skill, difficulty);
        // Pretty skill rows: title|level band (level top-right pin) + XP flush bottom — NO desc (Skills tab only)
        const row = listEl.createEl("label", { cls: "skills-selector-row skill-selector-row" });
        const checkbox = row.createEl("input", {
          type: "checkbox",
          cls: "skills-selector-checkbox"
        });
        checkbox.checked = draft.has(id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) draft.add(id);
          else draft.delete(id);
        });
        const body = row.createEl("span", { cls: "linked-selector-row-body" });
        // Top band: title | level (same Y). No description here — desc is Skills tab only.
        const titleRow = body.createEl("span", { cls: "detail-skill-attached-title-row skill-selector-band" });
        titleRow.createEl("span", {
          text: skill.name || "Untitled",
          cls: "skills-selector-row-label linked-selector-row-title detail-skill-attached-title"
        });
        titleRow.createEl("span", {
          text: (skill.legendary ? "\u2605 " : "") + "Lvl " + (xpInfo.level || 1),
          cls: "detail-skill-attached-level"
        });
        const xpBar = body.createEl("div", { cls: "skill-xp-bar detail-skill-attached-xp-bar" });
        const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
        xpFill.style.width = `${xpInfo.pct}%`;
      });
      this.bindSkillGridWrapSpans(listEl);
    }, "renderSkillsSelectorList");
    renderList();
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });
    const btnRow = box.createEl("div", { cls: "quest-modal-buttons skills-selector-actions" });
    const selectBtn = btnRow.createEl("button", {
      cls: "quest-modal-create-btn quest-modal-create-btn-full skills-selector-select-btn",
      attr: { type: "button" }
    });
    selectBtn.createEl("span", { text: "Select" });
    const close = /* @__PURE__ */ __name(() => {
      overlay.remove();
    }, "closeSkillsSelector");
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => {
      overlay._mouseDownOnOverlay = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && overlay._mouseDownOnOverlay) close();
    });
    selectBtn.addEventListener("click", () => {
      selectedSkillIds.length = 0;
      for (const id of draft) selectedSkillIds.push(id);
      if (typeof onApplied === "function") onApplied();
      close();
    });
    searchInput.focus();
  }
  coinRewardForXp(xp) {
    return Math.max(1, Math.min(50, Math.round(Number(xp) / 1e4 || 0)));
  }
  idsLinkedToSkill(skillId, kind) {
    const list = kind === "habit" ? this.plugin.settings.habits || [] : this.plugin.settings.quests || [];
    const sid = String(skillId);
    return list.filter((item) => item && Array.isArray(item.skillIds) && item.skillIds.map(String).includes(sid)).map((item) => String(item.id));
  }
  syncSkillLinks(skillId, questIds, habitIds) {
    const sid = String(skillId);
    const qSet = new Set((questIds || []).map(String));
    const hSet = new Set((habitIds || []).map(String));
    const patchList = /* @__PURE__ */ __name((list, selected) => {
      for (const item of list || []) {
        if (!item || item.id == null) continue;
        const ids = new Set((item.skillIds || []).map(String));
        if (selected.has(String(item.id))) ids.add(sid);
        else ids.delete(sid);
        item.skillIds = [...ids];
      }
    }, "patchSkillLinkList");
    patchList(this.plugin.settings.quests, qSet);
    patchList(this.plugin.settings.habits, hSet);
  }
  attachLinkedPicker(parentEl, opts) {
    const kind = opts.kind === "habit" ? "habit" : "quest";
    const selectedIds = [...opts.initialIds || []].map(String);
    const typeCls = kind;
    const section = parentEl.createEl("div", {
      cls: `detail-skills-section detail-linked-section detail-${typeCls}-linked-section quest-detail-reward`
    });
    const header = section.createEl("div", { cls: "detail-skills-header" });
    header.createEl("span", {
      text: opts.label,
      cls: "quest-xp-preview-label detail-skills-label"
    });
    const plusBtn = header.createEl("button", {
      cls: `detail-skills-plus-btn detail-linked-plus-btn detail-${typeCls}-plus-btn`,
      attr: { "aria-label": "plus", type: "button" }
    });
    const plusIcon = plusBtn.createEl("span", { cls: "detail-skills-plus-icon" });
    setIcon(plusIcon, "plus");
    section.createEl("div", { cls: "quest-detail-reward-divider detail-skills-divider" });
    const selectedDisplay = section.createEl("div", {
      cls: `detail-selected-skills detail-selected-linked detail-selected-${typeCls}s`
    });
    const refresh = /* @__PURE__ */ __name(() => {
      selectedDisplay.empty();
      const list = kind === "habit" ? this.plugin.settings.habits || [] : this.plugin.settings.quests || [];
      const rewardsOn = Boolean(this.plugin.settings.rewardsMode);
      selectedIds.forEach((id) => {
        const item = list.find((x) => x && String(x.id) === String(id));
        if (!item) return;
        // 0.6.49 — same block structure as attached Skills (attachSkillPicker rows / .skill-block):
        // body = title band (wrapping title, same word-wrap + full-row span rule) + bottom meta row
        // (where Skills show the XP bar): XP left, coins right (quests + rewardsMode only; habits NEVER).
        const row = selectedDisplay.createEl("div", {
          cls: `skills-selector-row skill-selector-row linked-selector-row ${typeCls}-selector-row detail-skill-attached-row detail-linked-attached-row`
        });
        const body = row.createEl("span", { cls: "linked-selector-row-body detail-skill-attached-body" });
        const titleRow = body.createEl("span", { cls: "detail-skill-attached-title-row skill-selector-band" });
        titleRow.createEl("span", {
          text: item.title || "Untitled",
          cls: "skills-selector-row-label linked-selector-row-title detail-skill-attached-title"
        });
        const meta = body.createEl("span", { cls: "linked-selector-row-meta detail-linked-attached-meta" });
        const xp = Number(item.xp) || 0;
        meta.createEl("span", {
          text: `${xp.toLocaleString()} XP`,
          cls: "linked-selector-row-xp"
        });
        // Habits never grant coins — omit coin display on habit attached rows always
        if (rewardsOn && kind === "quest") {
          const coinWrap = meta.createEl("span", { cls: "linked-selector-row-coins" });
          const coinIcon = coinWrap.createEl("span", { cls: "linked-selector-row-coin-icon" });
          setIcon(coinIcon, "coins");
          coinWrap.createEl("span", {
            text: `+${this.coinRewardForXp(xp)}`,
            cls: "linked-selector-row-coin-text"
          });
        }
        const removeBtn = row.createEl("button", {
          cls: "detail-linked-row-remove",
          attr: { "aria-label": "Detach", type: "button" }
        });
        const removeIcon = removeBtn.createEl("span", {
          cls: "detail-linked-row-remove-icon"
        });
        setIcon(removeIcon, "x");
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const i = selectedIds.findIndex((x) => String(x) === String(id));
          if (i > -1) selectedIds.splice(i, 1);
          refresh();
        });
      });
      if (selectedIds.length === 0) {
        selectedDisplay.createEl("span", {
          text: opts.emptyText,
          cls: "detail-skills-placeholder"
        });
      } else {
        this.bindSkillGridWrapSpans(selectedDisplay, 3);
      }
    }, kind === "habit" ? "refreshHabitLinkedPicker" : "refreshQuestLinkedPicker");
    refresh();
    plusBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openLinkedSelectorModal(selectedIds, refresh, kind);
    });
    selectedIds.refresh = refresh;
    return selectedIds;
  }
  openLinkedSelectorModal(selectedIds, onApplied, kind) {
    const isHabit = kind === "habit";
    const typeCls = isHabit ? "habit" : "quest";
    const host = this.overlayHost();
    if (!host) return;
    const overlayCls = `${typeCls}s-selector-overlay`;
    const existing = host.querySelector(`.${overlayCls}`);
    if (existing) existing.remove();
    const overlay = host.createEl("div", {
      cls: `${overlayCls} linked-selector-overlay ql-overlay open`
    });
    const box = overlay.createEl("div", {
      cls: `quest-modal ${typeCls}s-selector-modal linked-selector-modal skills-selector-modal ${typeCls}-context ql-modal`
    });
    const header = box.createEl("div", { cls: "quest-modal-header skills-selector-header" });
    header.createEl("span", {
      text: isHabit ? "Habits Selector" : "Quests Selector",
      cls: "skills-selector-title"
    });
    const closeBtn = header.createEl("button", {
      cls: "quest-detail-close-btn quest-modal-close-btn",
      attr: { "aria-label": "Close", type: "button" }
    });
    const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
    setIcon(closeIcon, "x");
    const searchInput = box.createEl("input", {
      type: "text",
      placeholder: isHabit ? "Type Habit Name" : "Type Quest Name",
      cls: "skills-selector-search ql-input",
      attr: { "aria-label": isHabit ? "Type Habit Name" : "Type Quest Name" }
    });
    box.createEl("div", { cls: "quest-detail-reward-divider skills-selector-divider" });
    const listEl = box.createEl("div", { cls: "skills-selector-list linked-selector-list" });
    const draft = new Set([...selectedIds].map(String));
    const rewardsOn = Boolean(this.plugin.settings.rewardsMode);
    const renderList = /* @__PURE__ */ __name((query = "") => {
      listEl.empty();
      const items = [...(isHabit ? this.plugin.settings.habits || [] : this.plugin.settings.quests || [])].sort(
        (a, b) => (a.title || "").localeCompare(b.title || "")
      );
      const q = query.trim().toLowerCase();
      const filtered = q ? items.filter((it) => (it.title || "").toLowerCase().includes(q)) : items;
      if (filtered.length === 0) {
        listEl.createEl("div", {
          text: items.length === 0 ? isHabit ? "No habits yet" : "No quests yet" : isHabit ? "No matching habits" : "No matching quests",
          cls: "skills-selector-empty"
        });
        return;
      }
      filtered.forEach((item) => {
        const id = String(item.id);
        const row = listEl.createEl("label", {
          cls: `skills-selector-row linked-selector-row ${typeCls}-selector-row`
        });
        const checkbox = row.createEl("input", {
          type: "checkbox",
          cls: "skills-selector-checkbox linked-selector-checkbox"
        });
        checkbox.checked = draft.has(id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) draft.add(id);
          else draft.delete(id);
        });
        const body = row.createEl("span", { cls: "linked-selector-row-body" });
        body.createEl("span", {
          text: item.title || "Untitled",
          cls: "skills-selector-row-label linked-selector-row-title"
        });
        const meta = body.createEl("span", { cls: "linked-selector-row-meta" });
        const xp = Number(item.xp) || 0;
        meta.createEl("span", {
          text: `${xp.toLocaleString()} XP`,
          cls: "linked-selector-row-xp"
        });
        // Habits never grant coins — omit coin display on habit selector rows always
        if (rewardsOn && !isHabit) {
          const coinWrap = meta.createEl("span", { cls: "linked-selector-row-coins" });
          const coinIcon = coinWrap.createEl("span", { cls: "linked-selector-row-coin-icon" });
          setIcon(coinIcon, "coins");
          coinWrap.createEl("span", {
            text: `+${this.coinRewardForXp(xp)}`,
            cls: "linked-selector-row-coin-text"
          });
        }
      });
    }, isHabit ? "renderHabitsSelectorList" : "renderQuestsSelectorList");
    renderList();
    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
    });
    const btnRow = box.createEl("div", { cls: "quest-modal-buttons skills-selector-actions" });
    const selectBtn = btnRow.createEl("button", {
      cls: `quest-modal-create-btn quest-modal-create-btn-full skills-selector-select-btn linked-selector-select-btn ${typeCls}-selector-select-btn`,
      attr: { type: "button" }
    });
    selectBtn.createEl("span", { text: "Select" });
    const close = /* @__PURE__ */ __name(() => {
      overlay.remove();
    }, isHabit ? "closeHabitsSelector" : "closeQuestsSelector");
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => {
      overlay._mouseDownOnOverlay = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && overlay._mouseDownOnOverlay) close();
    });
    selectBtn.addEventListener("click", () => {
      selectedIds.length = 0;
      for (const id of draft) selectedIds.push(id);
      if (typeof onApplied === "function") onApplied();
      close();
    });
    searchInput.focus();
  }
    fillStatsTable(table, rows) {
    rows.forEach(([label, value]) => {
      const tr = table.createEl("tr");
      tr.createEl("td", { text: label, cls: "quest-detail-stat-label" });
      tr.createEl("td", { text: value, cls: "quest-detail-stat-value" });
    });
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
    // 0.6.52 live-sync: a freshly opened view re-verifies the file (fire-and-forget; never awaited here).
    if (this.plugin && this.plugin._qlSync && !this._qlOpenCheck) {
      this._qlOpenCheck = true;
      activeWindow.setTimeout(() => {
        this._qlOpenCheck = false;
        if (this.plugin._qlSync) void this.plugin._qlSync.checkNow("view-open");
      }, 0);
    }
    const overlayClasses = [
      "quest-menu-overlay",
      "quest-creation-overlay",
      "quest-detail-overlay",
      "delete-confirm-overlay",
      "skills-selector-overlay",
      "quests-selector-overlay",
      "habits-selector-overlay",
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
    setIcon(hamburgerBtn, "menu");
    topBar.createEl("span", { text: "Quest Log", cls: "topbar-title" });
    const settingsBtn = topBar.createEl("button", { cls: "topbar-settings" });
    setIcon(settingsBtn, "settings");
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
            // 0.6.51: opens via the unified overlay shell (state "shop"); panel show logic unchanged (see shell state below)
            this.openOverlay("shop");
            menuOverlay.removeClass("open");
          }, "action") }
        );
      }
      items.push(
        { icon: "radar", label: "Skill Graph", action: /* @__PURE__ */ __name(() => this.openOverlay("skill-graph"), "action") },
        { icon: "user", label: "User Profile", action: /* @__PURE__ */ __name(() => {
          const folder = this.plugin.settings.userProfileFolder || "Quest Log";
          const fileName = this.plugin.settings.userProfileFileName || "User Profile";
          const fullPath = `${folder}/${fileName}.md`;
          const file = this.app.vault.getAbstractFileByPath(fullPath);
          if (file) {
            this.app.workspace.openLinkText(fullPath, "", false);
          } else {
            new obsidianNS.Notice("User Profile not found.");
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
        setIcon(iconEl, item.icon);
        row.createEl("span", { text: item.label });
        row.addEventListener("click", () => {
          menuOverlay.removeClass("open");
          // 0.6.51: any menu navigation first closes the unified overlay shell (it sits above the lists);
          // overlay-opening items re-open their state right after.
          if (this._overlayShell) this._overlayShell.close();
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
    const difficulty = this.plugin.settings.userDifficulty || 10;
    const bar = _QuestLogView.xpProgress(null, currentXp, difficulty);
    const calculatedLvl = bar.level;
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
    setIcon(editIcon, "pencil");
    this._heroNameEl = heroNameEl;
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
    xpBarFill.style.width = `${Number(Number(percent).toFixed(4))}%`;
    this._xpBarFill = xpBarFill;
    const fabBtn = container.createEl("button", { cls: "quest-fab" });
    const fabIcon = fabBtn.createEl("span", { cls: "fab-icon" });
    setIcon(fabIcon, "plus");
    fabBtn.style.display = "flex";
    // Shared create overlay (quest | habit) — content rebuilt by openCreateModal
    const createOverlay = container.createEl("div", {
      cls: "quest-creation-overlay ql-overlay"
    });
    createOverlay.addEventListener("mousedown", (e) => {
      createOverlay._mouseDownOnOverlay = e.target === createOverlay;
    });
    createOverlay.addEventListener("click", (e) => {
      if (e.target === createOverlay && createOverlay._mouseDownOnOverlay) {
        createOverlay.removeClass("open");
      }
    });
    const createBox = createOverlay.createEl("div", { cls: "quest-modal ql-modal" });
    this._createOverlay = createOverlay;
    this._createBox = createBox;
    var activeTab = this._activeTab || "QUESTS";
    var currentView = this._currentView || "active";
    fabBtn.addEventListener("click", () => {
      if (activeTab === "QUESTS") {
        this.openCreateModal({ type: "quest" });
      } else if (activeTab === "HABITS") {
        this.openCreateModal({ type: "habit" });
      } else if (activeTab === "SKILLS") {
        skillOverlay.addClass("open");
        skillNameInput.focus();
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
      setIcon(rewardHeaderIcon, "shopping-bag");
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
          new obsidianNS.Notice("Give your reward a name!");
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
        new obsidianNS.Notice(`Created Reward: ${reward.name} (${reward.price} coins)`);
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
      setIcon(tabIcon, icon);
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
        fabBtn.removeClass("fab-quests");
        if (colorClass === "tab-habits") fabBtn.addClass("fab-habits");
        else if (colorClass === "tab-skills") fabBtn.addClass("fab-skills");
        else fabBtn.addClass("fab-quests");
        questListContainer.style.display = text === "QUESTS" ? "flex" : "none";
        habitsContent.style.display = text === "HABITS" ? "flex" : "none";
        skillsContent.style.display = text === "SKILLS" ? "flex" : "none";
        if (shopOverlay) shopOverlay.style.display = "none";
      });
      return btn;
    }, "createTab");
    const questTab = createTab("scroll-text", "QUESTS", "tab-quests");
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
      setIcon(shopCoinIcon, "coins");
      this._shopCoinText = shopCoinDisplay.createEl("span", { text: `${this.plugin.settings.coins}`, cls: "shop-coin-text" });
      const shopListEl = shopOverlay.createEl("div", { cls: "shop-list" });
      this._shopListEl = shopListEl;
      this.renderShopList(shopListEl);
      const shopFab = shopOverlay.createEl("button", { cls: "quest-log-fab fab-shop" });
      const shopFabIcon = shopFab.createEl("span", { cls: "fab-icon" });
      setIcon(shopFabIcon, "plus");
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
    setIcon(completedHamburger, "menu");
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
          fabBtn.removeClass("fab-quests");
          if (targetTab === "HABITS") fabBtn.addClass("fab-habits");
          else if (targetTab === "SKILLS") fabBtn.addClass("fab-skills");
          else fabBtn.addClass("fab-quests");
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
    setIcon(skillGraphHamburger, "menu");
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
    // 0.6.52 — with the FAB now reachable while the list is scrolled, the absolute-positioned .ql-overlay modals it opens
    // (menu, create, detail) must appear in the visible area, not at the scroll origin. When a direct-child overlay gets
    // `.open` on a scrolled view, offset its top by scrollTop (cleared when it closes). No-op at scrollTop 0 and on mobile
    // (<=600px overlays are position:fixed). Purely positional; no markup/behaviour change.
    if (this._overlayAnchorObs) this._overlayAnchorObs.disconnect();
    if (this._overlayScrollFn) container.removeEventListener("scroll", this._overlayScrollFn);
    this._lastListScroll = container.scrollTop;
    this._overlayScrollFn = () => {
      this._lastListScroll = container.scrollTop;
    };
    container.addEventListener("scroll", this._overlayScrollFn, { passive: true });
    if (typeof MutationObserver !== "undefined") {
      this._overlayAnchorObs = new MutationObserver((muts) => {
        for (const m of muts) {
          const el = m.target;
          if (!el.classList || !el.classList.contains("ql-overlay") || el.parentNode !== container) continue;
          if (el.classList.contains("open")) {
            if (getComputedStyle(el).position !== "absolute") continue;
            // opening code may have focused an input inside the overlay (still at the scroll origin) → the browser jumped
            // the list to the top; put the list back where the user was, then anchor the overlay to the visible area.
            if (container.scrollTop !== this._lastListScroll) container.scrollTop = this._lastListScroll;
            if (container.scrollTop > 0) el.style.top = `${container.scrollTop}px`;
          } else if (el.style.top) {
            el.style.top = "";
          }
        }
      });
      this._overlayAnchorObs.observe(container, { attributes: true, attributeFilter: ["class"], subtree: true });
    }
    // 0.6.51 — unified whole-view overlay shell. Hosts the existing Rewards Shop and Skill Graph panels as
    // states (panel elements moved into the shell stage; their render/show functions are reused verbatim).
    if (this._overlayShell) this._overlayShell.destroy();
    const overlayShell = createOverlayShell(container, {
      // Esc closes the shell only when nothing sits above it (purchase popup, menu, detail/creation/reward modals)
      canEscClose: /* @__PURE__ */ __name(() => !container.querySelector(".shop-purchase-overlay, .ql-overlay.open"), "canEscClose"),
      onClose: /* @__PURE__ */ __name(() => {
        if (this._preShellScroll != null) {
          container.scrollTop = this._preShellScroll;
          this._preShellScroll = null;
        }
      }, "onShellClose")
    });
    this._overlayShell = overlayShell;
    if (shopOverlay) {
      overlayShell.registerState("shop", {
        label: "Rewards Shop",
        el: shopOverlay,
        // same three steps the menu's "Rewards Shop" action ran before 0.6.51
        show: /* @__PURE__ */ __name(() => {
          shopOverlay.style.display = "flex";
          this.renderShopList(this._shopListEl);
          if (this._shopCoinText) this._shopCoinText.setText(`${this.plugin.settings.coins}`);
        }, "showShopState"),
        hide: /* @__PURE__ */ __name(() => {
          shopOverlay.style.display = "none";
        }, "hideShopState")
      });
    }
    overlayShell.registerState("skill-graph", {
      label: "Skill Graph",
      el: skillGraphOverlay,
      show: /* @__PURE__ */ __name(() => this.showSkillGraphModal(), "showSkillGraphState"),
      hide: /* @__PURE__ */ __name(() => {
        skillGraphOverlay.style.display = "none";
      }, "hideSkillGraphState")
    });
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
    setIcon(skillHeaderIcon, "zap");
    skillModalHeader.createEl("span", { text: "New Skill" });
    const skillCloseBtn = skillModalHeader.createEl("button", {
      cls: "quest-detail-close-btn quest-modal-close-btn",
      attr: { "aria-label": "Close" }
    });
    const skillCloseIcon = skillCloseBtn.createEl("span", { cls: "quest-detail-close-icon" });
    setIcon(skillCloseIcon, "x");
    const skillNameInput = skillModalBox.createEl("textarea", {
      attr: { placeholder: "Skill Name...", rows: "1" },
      cls: "quest-modal-title"
    });
    const autosizeSkillTitle = /* @__PURE__ */ __name((el) => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }, "autosizeSkillTitle");
    autosizeSkillTitle(skillNameInput);
    skillNameInput.addEventListener("input", () => autosizeSkillTitle(skillNameInput));
    const skillDescInput = skillModalBox.createEl("textarea", {
      attr: { placeholder: "Description..." },
      cls: "quest-modal-desc"
    });
    // Identical level block as skill details (new skill = Lvl 1, 0 / xpNeeded, empty bar).
    // No info blurb between desc and level — Atlas rejected divider/blurb there.
    this.renderSkillLevelBlock(skillModalBox, { xp: 0, level: 1, legendary: false });
    const selectedQuestIds = this.attachLinkedPicker(skillModalBox, {
      kind: "quest",
      label: "attach quests",
      emptyText: "no quests attached",
      initialIds: []
    });
    const selectedHabitIds = this.attachLinkedPicker(skillModalBox, {
      kind: "habit",
      label: "attach habits",
      emptyText: "no habits attached",
      initialIds: []
    });
    skillModalBox.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
    const skillBtnContainer = skillModalBox.createEl("div", {
      cls: "quest-modal-buttons"
    });
    const skillCreateBtn = skillBtnContainer.createEl("button", {
      cls: "quest-modal-create-btn quest-modal-create-btn-full"
    });
    const skillCreateBtnIcon = skillCreateBtn.createEl("span", {
      cls: "quest-modal-create-btn-icon"
    });
    setIcon(skillCreateBtnIcon, "plus");
    skillCreateBtn.createEl("span", { text: "Create Skill" });
    const closeSkillOverlay = /* @__PURE__ */ __name(() => {
      skillOverlay.removeClass("open");
      skillNameInput.value = "";
      skillDescInput.value = "";
      selectedQuestIds.length = 0;
      selectedHabitIds.length = 0;
      if (typeof selectedQuestIds.refresh === "function") selectedQuestIds.refresh();
      if (typeof selectedHabitIds.refresh === "function") selectedHabitIds.refresh();
    }, "closeSkillOverlay");
    skillCloseBtn.addEventListener("click", closeSkillOverlay);
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
        this.syncSkillLinks(skill.id, selectedQuestIds, selectedHabitIds);
        await this.plugin.saveSettings();
        this.renderSkillList(skillsContent);
        if (this._questListContainer) this.renderQuestList(this._questListContainer);
        if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
        new obsidianNS.Notice(`Created Skill: ${skill.name}`);
        closeSkillOverlay();
      } else {
        new obsidianNS.Notice("Add Skill Name First!");
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
    setIcon(warnIcon, "alert-triangle");
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
    const rewardsOn = Boolean(this.plugin.settings.rewardsMode);
    quests.forEach((quest) => {
      const block = container.createEl("div", { cls: "quest-block" });
      // Title | coins? + XP band above complete; desc fades into complete (Skills-style).
      const band = block.createEl("div", { cls: "quest-block-band" });
      band.createEl("div", {
        text: quest.title,
        cls: "quest-block-title"
      });
      const meta = band.createEl("div", { cls: "quest-block-meta" });
      const xp = Number(quest.xp) || 0;
      if (rewardsOn) {
        const coinWrap = meta.createEl("span", { cls: "quest-block-coins" });
        const coinIcon = coinWrap.createEl("span", { cls: "quest-block-coin-icon" });
        setIcon(coinIcon, "coins");
        coinWrap.createEl("span", {
          text: `+${this.coinRewardForXp(xp)}`,
          cls: "quest-block-coin-text"
        });
      }
      meta.createEl("span", {
        text: `${xp.toLocaleString()} XP`,
        cls: "quest-block-xp"
      });
      const body = block.createEl("div", { cls: "quest-block-body" });
      if (quest.description) {
        const descWrap = body.createEl("div", {
          cls: "quest-block-desc-wrap"
        });
        descWrap.createEl("span", {
          text: quest.description,
          cls: "quest-block-desc-text"
        });
      } else {
        body.createEl("div", { cls: "quest-block-desc-spacer" });
      }
      const completeBtn = body.createEl("button", { cls: "quest-complete-btn" });
      const completeIcon = completeBtn.createEl("span", { cls: "quest-btn-icon" });
      setIcon(completeIcon, "check");
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
  // SHARED CREATE MODAL (quest | habit)
  // Same type-flag pattern as openDetailModal.
  // ----------------------------------------
  openCreateModal({ type }) {
    const isHabit = type === "habit";
    const overlay = this._createOverlay;
    const box = this._createBox;
    this.drainSliders(box);
    box.empty();
    box.removeClass("habit-context");
    box.removeClass("quest-context");
    box.removeClass("skill-context");
    if (isHabit) box.addClass("habit-context");
    else box.addClass("quest-context");
    overlay.addClass("open");
    const modalHeader = box.createEl("div", { cls: "quest-modal-header" });
    const headerIcon = modalHeader.createEl("span", { cls: "quest-modal-header-icon" });
    setIcon(headerIcon, isHabit ? "repeat" : "scroll");
    modalHeader.createEl("span", { text: isHabit ? "New Habit" : "New Quest" });
    const closeBtn = modalHeader.createEl("button", {
      cls: "quest-detail-close-btn quest-modal-close-btn",
      attr: { "aria-label": "Close" }
    });
    const closeIcon = closeBtn.createEl("span", { cls: "quest-detail-close-icon" });
    setIcon(closeIcon, "x");
    const titleInput = box.createEl("input", {
      type: "text",
      placeholder: isHabit ? "Habit Title..." : "Quest Title...",
      cls: "quest-modal-title"
    });
    const descInput = box.createEl("textarea", {
      attr: { placeholder: isHabit ? "Description..." : "Instructions..." },
      cls: "quest-modal-desc"
    });
    // Reward above sliders (match details order): centered Reward + divider;
    // XP centered; coins + XP equal flex halves under header when rewardsMode (quests grant coins).
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row quest-detail-reward" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpRow.createEl("div", { cls: "quest-detail-reward-divider" });
    const rewardBody = xpRow.createEl("div", { cls: "quest-detail-reward-body" });
    const xpPreview = { el: null, coinEl: null };
    const showCoins = Boolean(this.plugin.settings.rewardsMode) && !isHabit;
    const defaultXp = _QuestLogView.calcXp(1, 1, 1);
    if (showCoins) {
      rewardBody.addClass("has-extra");
      const coinSlot = rewardBody.createEl("div", { cls: "quest-detail-reward-slot" });
      const coinWrap = coinSlot.createEl("span", { cls: "quest-detail-reward-coins" });
      const coinIcon = coinWrap.createEl("span", { cls: "quest-detail-reward-coin-icon" });
      setIcon(coinIcon, "coins");
      xpPreview.coinEl = coinWrap.createEl("span", {
        cls: "quest-detail-reward-coin-text",
        text: `+${Math.max(1, Math.min(50, Math.round(defaultXp / 1e4)))}`
      });
    }
    const xpSlot = showCoins
      ? rewardBody.createEl("div", { cls: "quest-detail-reward-slot" })
      : rewardBody;
    xpPreview.el = xpSlot.createEl("span", {
      text: `${defaultXp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const slidersSection = box.createEl("div", { cls: "quest-sliders-section" });
    const updateXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue()
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
      if (xpPreview.coinEl) {
        xpPreview.coinEl.setText(
          `+${Math.max(1, Math.min(50, Math.round(xp / 1e4)))}`
        );
      }
    }, "updateXpPreview");
    // Defaults: first slot (1 / lowest) — players raise manually
    const diffSlider = this.createSlider(
      slidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#3b82f6",
      1,
      updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#f59e0b",
      1,
      updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#a855f7",
      1,
      updateXpPreview
    );
    const selectedSkillIds = this.attachSkillPicker(box, []);
    box.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
    const btnContainer = box.createEl("div", { cls: "quest-modal-buttons" });
    const createBtn = btnContainer.createEl("button", {
      cls: "quest-modal-create-btn quest-modal-create-btn-full"
    });
    const createBtnIcon = createBtn.createEl("span", { cls: "quest-modal-create-btn-icon" });
    setIcon(createBtnIcon, "plus");
    createBtn.createEl("span", { text: isHabit ? "Create Habit" : "Create Quest" });
    const closeOverlay = /* @__PURE__ */ __name(() => {
      overlay.removeClass("open");
    }, "closeOverlay");
    closeBtn.addEventListener("click", closeOverlay);
    createBtn.addEventListener("click", async () => {
      if (titleInput.value.trim() !== "") {
        const xp = _QuestLogView.calcXp(
          diffSlider._getValue(),
          urgSlider._getValue(),
          impSlider._getValue()
        );
        const item = {
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
        if (isHabit) {
          this.plugin.settings.habits.push(item);
          await this.plugin.saveSettings();
          this.renderHabitList(this._habitListContainer);
          new obsidianNS.Notice(`Created Habit: ${item.title} (${xp.toLocaleString()} XP)`);
        } else {
          this.plugin.settings.quests.push(item);
          await this.plugin.saveSettings();
          this.renderQuestList(this._questListContainer);
          new obsidianNS.Notice(`Created Quest: ${item.title} (${xp.toLocaleString()} XP)`);
        }
        closeOverlay();
      } else {
        new obsidianNS.Notice(isHabit ? "Add Habit Title First!" : "Add Quest Title First!");
      }
    });
    titleInput.focus();
  }

  // ----------------------------------------
  // SHARED DETAIL MODAL (quest | habit)
  // Branch only type-specific diffs; layout/header/body shared.
  // ----------------------------------------
  openDetailModal({ type, item }) {
    const isHabit = type === "habit";
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    this.drainSliders(box);
    box.empty();
    box.removeClass("habit-context");
    box.removeClass("quest-context");
    box.removeClass("skill-context");
    if (isHabit) box.addClass("habit-context");
    else box.addClass("quest-context");
    overlay.addClass("open");
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row" });
    headerRow.createEl("span", {
      text: isHabit ? "Habit Details" : "Quest Details",
      cls: "quest-detail-modal-title"
    });
    const createdDate = _QuestLogView.formatDate(item.created);
    headerRow.createEl("span", {
      text: `Created ${createdDate}`,
      cls: "quest-detail-meta-text"
    });
    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
    // Micah order: trash → open note → close
    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn"
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon"
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(item.title, async () => {
        if (isHabit) {
          await retireNote(this.plugin, habitNotePaths(this.plugin, item));
          this.plugin.settings.habits = this.plugin.settings.habits.filter(
            (h) => h.id !== item.id
          );
          await this.plugin.saveSettings();
          overlay.removeClass("open");
          this.renderHabitList(this._habitListContainer);
          new obsidianNS.Notice("Habit deleted.");
        } else {
          await retireNote(
            this.plugin,
            questNotePaths(this.plugin, item, this.plugin.settings.quests, this.plugin.settings.questsFolderPath || "Quest Log/Quests")
          );
          this.plugin.settings.quests = this.plugin.settings.quests.filter(
            (q) => q.id !== item.id
          );
          await this.plugin.saveSettings();
          overlay.removeClass("open");
          this.renderQuestList(this._questListContainer);
          new obsidianNS.Notice("Quest deleted.");
        }
      });
    });
    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn"
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon"
    });
    setIcon(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      if (isHabit) {
        const folderPath = this.plugin.settings.habitsFolderPath || "Quest Log/Habits";
        const stem = uniqueStem(this.plugin.settings.habits, item.title, item.id, "title");
        const fullPath = `${folderPath}/${stem}.md`;
        this.app.workspace.openLinkText(fullPath, "", false);
      } else {
        const folderPath = this.plugin.settings.questsFolderPath || "Quest Log/Quests";
        const stem = uniqueStem(this.plugin.settings.quests, item.title, item.id, "title");
        const fullPath = `${folderPath}/${stem}.md`;
        this.app.workspace.openLinkText(fullPath, "", false);
      }
    });
    const closeBtn = btnGroup.createEl("button", {
      cls: "quest-detail-close-btn",
      attr: { "aria-label": "Close" }
    });
    const closeIcon = closeBtn.createEl("span", {
      cls: "quest-detail-close-icon"
    });
    setIcon(closeIcon, "x");
    // Creation-modal-style header divider (between header row and title field)
    headerRow.addClass("has-divider");
    const titleInput = box.createEl("input", {
      type: "text",
      value: item.title,
      cls: "quest-detail-title-input quest-modal-title"
    });
    const descBox = box.createEl("textarea", {
      text: item.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." }
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";
    // Reward block above sliders (Micah): open/inline, centered label + divider;
    // XP alone centered, or coins + XP equal flex halves under header when rewardsMode (quests grant coins).
    const xpRow = box.createEl("div", { cls: "quest-xp-preview-row quest-detail-reward" });
    xpRow.createEl("span", { text: "Reward", cls: "quest-xp-preview-label" });
    xpRow.createEl("div", { cls: "quest-detail-reward-divider" });
    const rewardBody = xpRow.createEl("div", { cls: "quest-detail-reward-body" });
    const xpPreview = { el: null, coinEl: null };
    const showCoins = Boolean(this.plugin.settings.rewardsMode) && !isHabit;
    if (showCoins) {
      rewardBody.addClass("has-extra");
      const coinSlot = rewardBody.createEl("div", { cls: "quest-detail-reward-slot" });
      const coinWrap = coinSlot.createEl("span", { cls: "quest-detail-reward-coins" });
      const coinIcon = coinWrap.createEl("span", { cls: "quest-detail-reward-coin-icon" });
      setIcon(coinIcon, "coins");
      xpPreview.coinEl = coinWrap.createEl("span", {
        cls: "quest-detail-reward-coin-text",
        text: `+${Math.max(1, Math.min(50, Math.round(item.xp / 1e4)))}`
      });
    }
    const xpSlot = showCoins
      ? rewardBody.createEl("div", { cls: "quest-detail-reward-slot" })
      : rewardBody;
    xpPreview.el = xpSlot.createEl("span", {
      text: `${item.xp.toLocaleString()} XP`,
      cls: "quest-xp-preview-value"
    });
    const slidersSection = box.createEl("div", {
      cls: "quest-sliders-section"
    });
    const updateXpPreview = /* @__PURE__ */ __name(() => {
      const xp = _QuestLogView.calcXp(
        diffSlider._getValue(),
        urgSlider._getValue(),
        impSlider._getValue()
      );
      xpPreview.el.setText(`${xp.toLocaleString()} XP`);
      if (xpPreview.coinEl) {
        xpPreview.coinEl.setText(
          `+${Math.max(1, Math.min(50, Math.round(xp / 1e4)))}`
        );
      }
    }, "updateXpPreview");
    // Shared D/U/I accent colors (same quest + habit; matches create modals)
    const diffSlider = this.createSlider(
      slidersSection,
      "Difficulty",
      _QuestLogView.DIFFICULTY_LABELS,
      "#3b82f6",
      item.difficulty || 3,
      updateXpPreview
    );
    const urgSlider = this.createSlider(
      slidersSection,
      "Urgency",
      _QuestLogView.URGENCY_LABELS,
      "#f59e0b",
      item.urgency || 3,
      updateXpPreview
    );
    const impSlider = this.createSlider(
      slidersSection,
      "Impact",
      _QuestLogView.IMPACT_LABELS,
      "#a855f7",
      item.impact || 3,
      updateXpPreview
    );
    const selectedSkillIds = this.attachSkillPicker(box, item.skillIds);
    const saveItem = /* @__PURE__ */ __name(async () => {
      item.title = titleInput.value.trim() || item.title;
      item.description = descBox.value.trim();
      item.difficulty = diffSlider._getValue();
      item.urgency = urgSlider._getValue();
      item.impact = impSlider._getValue();
      item.xp = _QuestLogView.calcXp(item.difficulty, item.urgency, item.impact);
      item.skillIds = [...selectedSkillIds];
      await this.plugin.saveSettings();
      if (isHabit) this.renderHabitList(this._habitListContainer);
      else this.renderQuestList(this._questListContainer);
    }, "saveItem");
    closeBtn.addEventListener("click", async () => {
      await saveItem();
      overlay.removeClass("open");
    });
    box.createEl("div", { cls: "quest-detail-reward-divider detail-actions-divider" });
    const btnRow = box.createEl("div", { cls: "quest-detail-buttons" });
    // Fail: habits only (icon/color match main habit list)
    if (isHabit) {
      const failBtn = btnRow.createEl("button", {
        cls: "habit-fail-btn",
        attr: { "aria-label": "Fail" }
      });
      const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(failIcon, "x");
      failBtn.addEventListener("click", async () => {
        await this.failHabit(item);
        overlay.removeClass("open");
      });
    }
    // Complete: same class/size for quest + habit; green whole-button + check icon
    const completeBtn = btnRow.createEl("button", {
      cls: "quest-detail-complete-btn",
      attr: { "aria-label": "Complete" }
    });
    const completeIcon = completeBtn.createEl("span", {
      cls: "quest-detail-complete-icon"
    });
    setIcon(completeIcon, "check");
    completeBtn.addEventListener("click", async () => {
      if (isHabit) {
        await saveItem();
        await this.completeHabit(item);
        overlay.removeClass("open");
      } else {
        await saveItem();
        overlay.removeClass("open");
        await this.completeQuest(item);
        if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
      }
    });
  }
  openQuestDetail(quest) {
    this.openDetailModal({ type: "quest", item: quest });
  }
  // ----------------------------------------
  // QUEST ACTIONS
  // ----------------------------------------
  async moveSidecar(sourcePath, destPath) {
    return moveSidecar(this.app, sourcePath, destPath);
  }
  async completeQuest(quest) {
    const hadNote = await retireNote(
      this.plugin,
      questNotePaths(this.plugin, quest, this.plugin.settings.quests, this.plugin.settings.questsFolderPath || "Quest Log/Quests")
    );
    this.plugin.settings.questsCompleted += 1;
    const completedQuest = { ...quest, completedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.plugin.settings.completedQuests.push(completedQuest);
    this.plugin.settings.quests = this.plugin.settings.quests.filter(
      (q) => q.id !== quest.id
    );
    await this.plugin.saveSettings();
    if (hadNote) await writeCompletedQuestFile(this.plugin, completedQuest);
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
      new obsidianNS.Notice(`${sourceName} +${xp.toLocaleString()} XP`);
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
      setIcon(coinIcon, "coins");
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
      // Title | XP band (habits never show coins); desc row | Fail|Complete 2:1 rects on the right.
      const band = block.createEl("div", { cls: "quest-block-band" });
      band.createEl("div", {
        text: habit.title,
        cls: "quest-block-title"
      });
      const meta = band.createEl("div", { cls: "quest-block-meta" });
      meta.createEl("span", {
        text: `${(Number(habit.xp) || 0).toLocaleString()} XP`,
        cls: "quest-block-xp"
      });
      const body = block.createEl("div", { cls: "quest-block-body" });
      if (habit.description) {
        const descWrap = body.createEl("div", {
          cls: "quest-block-desc-wrap"
        });
        descWrap.createEl("span", {
          text: habit.description,
          cls: "quest-block-desc-text"
        });
      } else {
        body.createEl("div", { cls: "quest-block-desc-spacer" });
      }
      const actionRow = body.createEl("div", { cls: "habit-action-row" });
      const failBtn = actionRow.createEl("button", { cls: "habit-fail-btn-mini" });
      const failIcon = failBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(failIcon, "x");
      failBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.failHabit(habit);
      });
      const completeBtn = actionRow.createEl("button", { cls: "habit-complete-btn-mini" });
      const completeIcon = completeBtn.createEl("span", { cls: "habit-btn-icon" });
      setIcon(completeIcon, "check");
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
    await this.plugin.saveSettings();
    this.renderHabitList(this._habitListContainer);
    this.renderSkillList(this._skillListContainer);
    await this.awardXp(habit.xp, habit.skillIds, "Habit completed:");
  }
  async failHabit(habit) {
    this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
    this.revokeSkillXp(habit.xp, habit.skillIds);
    await this.plugin.saveSettings();
    this.updateHeader();
    if (this._skillListContainer) this.renderSkillList(this._skillListContainer);
    new obsidianNS.Notice(`Habit failed: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
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
  revokeSkillXp(xp, skillIds) {
    if (!skillIds || skillIds.length === 0) return;
    const difficulty = this.plugin.settings.skillDifficulty || 10;
    for (const skillId of skillIds) {
      const skill = this.plugin.settings.skills.find((s) => s.id === skillId);
      if (skill && !skill.legendary) {
        skill.xp = Math.max(0, (skill.xp || 0) - xp);
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
      setIcon(emptyIcon, "shopping-bag");
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
      setIcon(coinIcon, "coins");
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
      setIcon(deleteBtn, "trash-2");
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
    setIcon(coinIcon, "coins");
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
      new obsidianNS.Notice(`Purchased ${qty}x ${reward.name}!`);
      overlay.detach();
      if (this._shopListEl) this.renderShopList(this._shopListEl);
    });
    win.requestAnimationFrame(() => {
      overlay.addClass("active");
    });
  }
  // ----------------------------------------
  // Skill 2-col grids: wrap → full-row + pack longs top (shared)
  // ----------------------------------------
  /**
   * True when the title needs at least `minLines` lines in its current (2-col) column.
   * minLines 2 (default, Skills tab / selector pickers) = original 0.6.34 rule, byte-for-byte behavior.
   * minLines 3 (0.6.50, attach blocks in details/creation) = up to two lines stay in-column.
   */
  skillTitleWraps(titleEl, minLines = 2) {
    if (!titleEl) return false;
    if (minLines > 2) {
      let lh3 = parseFloat(getComputedStyle(titleEl).lineHeight);
      if (!lh3 || Number.isNaN(lh3)) lh3 = (parseFloat(getComputedStyle(titleEl).fontSize) || 14) * 1.25;
      let lines = 0;
      try {
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top / (lh3 / 2))));
        lines = tops.size;
      } catch (_) {
        /* ignore */
      }
      if (!lines) lines = Math.round(titleEl.scrollHeight / lh3);
      return lines >= minLines;
    }
    try {
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      if (range.getClientRects().length >= 2) return true;
    } catch (_) {
      /* ignore */
    }
    const cs = getComputedStyle(titleEl);
    let lh = parseFloat(cs.lineHeight);
    if (!lh || Number.isNaN(lh)) {
      lh = (parseFloat(cs.fontSize) || 14) * 1.25;
    }
    return titleEl.scrollHeight > lh * 1.4;
  }
  applySkillGridWrapSpans(gridEl) {
    if (!gridEl) return;
    // Selector-modal linked list stays single-column; attached quest/habit grids (.detail-selected-linked) wrap like skills (0.6.49).
    if (gridEl.classList.contains("linked-selector-list")) {
      return;
    }
    const items = Array.from(gridEl.children).filter((el) => {
      return el.classList.contains("skill-block") || el.classList.contains("skill-selector-row") || el.classList.contains("skills-selector-row") || el.classList.contains("detail-skill-attached-row");
    });
    if (items.length === 0) return;
    const others = Array.from(gridEl.children).filter((el) => !items.includes(el));
    const ro = gridEl._qlSkillWrapRo;
    if (ro) ro.disconnect();
    try {
      // Measure at 2-col widths (clear spans) so wrap state does not oscillate
      for (const el of items) el.classList.remove("skill-span-full");
      void gridEl.offsetWidth;
      const longs = [];
      const shorts = [];
      for (const el of items) {
        const title = el.querySelector(".detail-skill-attached-title");
        if (title && this.skillTitleWraps(title, gridEl._qlWrapMinLines || 2)) longs.push(el);
        else shorts.push(el);
      }
      // Pack: longs (full-row) first, then shorts 2-across — stable within each partition
      const desired = longs.concat(shorts);
      let needReorder = desired.length !== items.length;
      if (!needReorder) {
        for (let i = 0; i < desired.length; i++) {
          if (desired[i] !== items[i]) {
            needReorder = true;
            break;
          }
        }
      }
      if (needReorder) {
        for (const el of desired) gridEl.appendChild(el);
        for (const el of others) gridEl.appendChild(el);
      }
      for (const el of longs) el.classList.add("skill-span-full");
      for (const el of shorts) el.classList.remove("skill-span-full");
    } finally {
      if (ro) ro.observe(gridEl);
    }
  }
  // minLines: lines a title needs before the item goes full-row. Default 2 (Skills tab, selector pickers).
  // Attach blocks in details/creation pass 3 (0.6.50). Stored per grid so the ResizeObserver re-run keeps it.
  bindSkillGridWrapSpans(gridEl, minLines = 2) {
    if (!gridEl) return;
    gridEl._qlWrapMinLines = minLines;
    // Selector-modal linked list stays single-column; attached quest/habit grids (.detail-selected-linked) wrap like skills (0.6.49).
    if (gridEl.classList.contains("linked-selector-list")) {
      return;
    }
    const run = () => {
      requestAnimationFrame(() => this.applySkillGridWrapSpans(gridEl));
    };
    run();
    if (typeof ResizeObserver === "undefined") return;
    if (gridEl._qlSkillWrapRo) gridEl._qlSkillWrapRo.disconnect();
    const ro = new ResizeObserver(() => run());
    ro.observe(gridEl);
    gridEl._qlSkillWrapRo = ro;
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
      const difficulty = this.plugin.settings.skillDifficulty || 10;
      const xpInfo = _QuestLogView.getSkillXpProgress(skill, difficulty);
      // Top band: title | level (same row / same Y). Desc (if any) is a sibling
      // under the band — never inside a left column that bottom-aligns level.
      const band = block.createEl("div", { cls: "detail-skill-attached-title-row skill-block-band" });
      band.createEl("span", {
        text: skill.name || "Untitled",
        cls: "detail-skill-attached-title"
      });
      band.createEl("span", {
        text: (skill.legendary ? "\u2605 " : "") + "Lvl " + (xpInfo.level || skill.level || 1),
        cls: "detail-skill-attached-level"
      });
      const desc = (skill.description || "").trim();
      if (desc) {
        const descWrap = block.createEl("span", { cls: "quest-block-desc-wrap" });
        descWrap.createEl("span", {
          text: desc,
          cls: "quest-block-desc-text"
        });
      }
      const xpBar = block.createEl("div", { cls: "skill-xp-bar" });
      const xpFill = xpBar.createEl("div", { cls: "skill-xp-fill" });
      xpFill.style.width = `${xpInfo.pct}%`;
      block.addEventListener("click", () => {
        this.openSkillDetail(skill);
      });
    });
    this.bindSkillGridWrapSpans(grid);
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
    if (!this._silentGraph) {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.25s ease-out";
      requestAnimationFrame(() => {
        overlay.style.opacity = "1";
      });
    }
    const skills = this.plugin.settings.skills || [];
    {
      const gs = this.plugin.settings;
      this._graphSig = JSON.stringify([gs.heroName, gs.currentXp, (gs.skills || []).map((s) => [s.id, s.name, s.xp, s.level])]);
    }
    const level = this.plugin.getLevel();
    const title = _QuestLogView.getLevelTitle(level);
    const heroName = this.plugin.settings.heroName || "Hero";
    const headerSection = content.createEl("div", { cls: "skill-graph-header-section" });
    const headerRow = headerSection.createEl("div", { cls: "skill-graph-header-row" });
    const iconSpan = headerRow.createEl("span", { cls: "skill-graph-header-icon" });
    setIcon(iconSpan, "sword");
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
    setIcon(pickerBtn, "square");
    const pickerDropdown = content.createEl("div", { cls: "skill-graph-picker-dropdown hidden" });
    const allSkillsSorted = [...skills].sort((a, b) => (b.level || 1) - (a.level || 1));
    const defaultSelected = new Set(allSkillsSorted.slice(0, 12).map((s) => s.id || s.name));
    let selectedSkillIds = new Set(defaultSelected);
    // live-sync rebuild keeps a user-customised selection; an untouched (default top-12) selection follows the new data
    const sameSet = (a, b) => a && b && a.size === b.size && Array.from(a).every((x) => b.has(x));
    const userCustomised = this._graphKeepSel && this._graphPrevDefault && !sameSet(this._graphKeepSel, this._graphPrevDefault);
    this._graphPrevDefault = new Set(defaultSelected);
    if (this._silentGraph && userCustomised) {
      // live-sync rebuild: keep the user's skill selection (drop ids that no longer exist)
      const valid = new Set(allSkillsSorted.map((s) => s.id || s.name));
      const kept = Array.from(this._graphKeepSel).filter((id) => valid.has(id));
      if (kept.length) selectedSkillIds = new Set(kept);
    }
    const chartSection = content.createEl("div", { cls: "skill-graph-chart-section" });
    const chartContainer = chartSection.createEl("div", { cls: "skill-graph-chart-container" });
    const updateChart = /* @__PURE__ */ __name(() => {
      this._graphKeepSel = new Set(selectedSkillIds);
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
      setIcon(deselectBtn, "square");
      deselectBtn.addEventListener("click", () => {
        selectedSkillIds.clear();
        renderCheckboxes(searchInput.value.toLowerCase());
        updateChart();
      });
      const resetBtn = actionsWrap.createEl("button", {
        cls: "skill-graph-picker-action-btn",
        attr: { "aria-label": "Reset to top 12" }
      });
      setIcon(resetBtn, "list-ordered");
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
              new obsidianNS.Notice("Maximum 12 skills can be displayed at once.");
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
        setIcon(pickerBtn, "check-square");
      } else {
        pickerDropdown.addClass("hidden");
        setIcon(pickerBtn, "square");
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
  /**
   * Shared Skills level block for DETAILS + CREATION modals (identical DOM).
   * Inside section, top→bottom (mirrors Attach Quests / Attach Habits headers):
   *   1. Centered "Level" header ABOVE the top divider
   *   2. Top divider
   *   3. Level number LEFT | xpProgress / xpNeeded XP RIGHT
   *   4. XP bar
   * No bottom divider under the bar (Attach sections have none).
   * No divider above the section (between title/desc and level) — rejected.
   */
  renderSkillLevelBlock(parentEl, skill) {
    const difficulty = this.plugin.settings.skillDifficulty || 10;
    const xpInfo = _QuestLogView.getSkillXpProgress(skill || { xp: 0, level: 1 }, difficulty);
    const levelSection = parentEl.createEl("div", { cls: "skill-level-section" });
    // Centered "Level" ABOVE top divider — same treatment as Attach Quests / Attach Habits (0.6.48).
    levelSection.createEl("span", { text: "Level", cls: "skill-level-label" });
    levelSection.createEl("div", { cls: "quest-detail-reward-divider skill-level-top-divider" });
    const levelRow = levelSection.createEl("div", { cls: "skill-level-row" });
    const levelNum = xpInfo.level || 1;
    levelRow.createEl("span", {
      text: (skill && skill.legendary ? "\u2605 " : "") + String(levelNum),
      cls: "skill-level-value"
    });
    levelRow.createEl("span", {
      text: `${xpInfo.xpProgress.toLocaleString()} / ${xpInfo.xpNeeded.toLocaleString()} XP`,
      cls: "skill-xp-progress-text"
    });
    const skillXpBar = levelSection.createEl("div", { cls: "skill-detail-xp-bar" });
    const skillXpFill = skillXpBar.createEl("div", { cls: "skill-detail-xp-fill" });
    skillXpFill.style.width = `${xpInfo.pct}%`;
    return { levelSection, xpInfo };
  }
  openSkillDetail(skill) {
    const overlay = this._detailOverlay;
    const box = this._detailBox;
    this.drainSliders(box);
    box.empty();
    box.removeClass("habit-context");
    box.removeClass("quest-context");
    box.removeClass("skill-context");
    box.addClass("skill-context");
    overlay.addClass("open");
    // One-line header matching quest/habit: title | Created on … | trash → open note → close
    const headerRow = box.createEl("div", { cls: "quest-detail-header-row has-divider" });
    headerRow.createEl("span", {
      text: "Skill Details",
      cls: "quest-detail-modal-title"
    });
    const createdDate = _QuestLogView.formatDate(skill.created);
    headerRow.createEl("span", {
      text: `Created on ${createdDate}`,
      cls: "quest-detail-meta-text"
    });
    const btnGroup = headerRow.createEl("div", { cls: "quest-detail-btn-group" });
    // Micah order: trash → open note → close
    const deleteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-delete-btn",
      attr: { "aria-label": "Delete", type: "button" }
    });
    const deleteIcon = deleteBtn.createEl("span", {
      cls: "quest-detail-delete-icon"
    });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm(skill.name, async () => {
        await retireNote(this.plugin, skillNotePaths(this.plugin, skill));
        this.plugin.settings.skills = this.plugin.settings.skills.filter(
          (s) => s.id !== skill.id
        );
        await this.plugin.saveSettings();
        overlay.removeClass("open");
        this.renderSkillList(this._skillListContainer);
        new obsidianNS.Notice("Skill deleted.");
      });
    });
    const openNoteBtn = btnGroup.createEl("button", {
      cls: "quest-detail-open-btn",
      attr: { "aria-label": "Open note", type: "button" }
    });
    const openNoteIcon = openNoteBtn.createEl("span", {
      cls: "quest-detail-open-icon"
    });
    setIcon(openNoteIcon, "file-text");
    openNoteBtn.addEventListener("click", () => {
      const folderPath = this.plugin.settings.skillsFolderPath || "Quest Log/Skills";
      const stem = uniqueStem(this.plugin.settings.skills, skill.name, skill.id, "name");
      const fullPath = `${folderPath}/${stem}.md`;
      this.app.workspace.openLinkText(fullPath, "", false);
    });
    const closeBtn = btnGroup.createEl("button", {
      cls: "quest-detail-close-btn",
      attr: { "aria-label": "Close", type: "button" }
    });
    const closeIcon = closeBtn.createEl("span", {
      cls: "quest-detail-close-icon"
    });
    setIcon(closeIcon, "x");
    const nameInput = box.createEl("textarea", {
      text: skill.name,
      cls: "quest-detail-title-input quest-modal-title",
      attr: { rows: "1" }
    });
    const autosizeSkillDetailTitle = /* @__PURE__ */ __name((el) => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }, "autosizeSkillDetailTitle");
    autosizeSkillDetailTitle(nameInput);
    nameInput.addEventListener("input", () => autosizeSkillDetailTitle(nameInput));
    const descBox = box.createEl("textarea", {
      text: skill.description || "",
      cls: "quest-detail-desc",
      attr: { placeholder: "No description." }
    });
    descBox.style.height = "auto";
    descBox.style.height = descBox.scrollHeight + "px";
    // Shared level block (identical to skill creation): Level (centered) → divider → level|xp → bar.
    // No bottom divider; no divider between title/desc and this section.
    this.renderSkillLevelBlock(box, skill);
    const selectedQuestIds = this.attachLinkedPicker(box, {
      kind: "quest",
      label: "attach quests",
      emptyText: "no quests attached",
      initialIds: this.idsLinkedToSkill(skill.id, "quest")
    });
    const selectedHabitIds = this.attachLinkedPicker(box, {
      kind: "habit",
      label: "attach habits",
      emptyText: "no habits attached",
      initialIds: this.idsLinkedToSkill(skill.id, "habit")
    });
    const saveSkill = /* @__PURE__ */ __name(async () => {
      const previousName = skill.name;
      skill.name = nameInput.value.trim() || skill.name;
      skill.description = descBox.value.trim();
      this.syncSkillLinks(skill.id, selectedQuestIds, selectedHabitIds);
      await this.plugin.saveSettings();
      this.renderSkillList(this._skillListContainer);
      if (this._questListContainer) this.renderQuestList(this._questListContainer);
      if (this._habitListContainer) this.renderHabitList(this._habitListContainer);
    }, "saveSkill");
    closeBtn.addEventListener("click", async () => {
      await saveSkill();
      overlay.removeClass("open");
    });
  }
  // ----------------------------------------
  // HABIT DETAIL VIEW
  // ----------------------------------------
  openHabitDetail(habit) {
    this.openDetailModal({ type: "habit", item: habit });
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
      meta.createEl("span", {
        text: item._type === "habit" ? "Habit" : "Quest",
        cls: `completed-block-type type-${item._type === "habit" ? "habit" : "quest"}`
      });
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
    box.removeClass("skill-context");
    box.removeClass("quest-context");
    box.addClass("quest-context");
    overlay.addClass("open");
    box.createEl("h2", {
      text: quest.title,
      cls: "quest-detail-title"
    });
    if (quest.description) {
      box.createEl("p", {
        text: quest.description,
        cls: "quest-detail-desc quest-detail-desc-plain"
      });
    }
    const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    const rows = [
      ["XP Earned", quest.xp.toLocaleString()],
      ["Difficulty", stars2(quest.difficulty)],
      ["Urgency", stars2(quest.urgency)],
      ["Impact", stars2(quest.impact)],
      ["Created", _QuestLogView.formatDate(quest.created)],
      ["Completed", _QuestLogView.formatDate(quest.completedAt)]
    ];
    this.fillStatsTable(statsTable, rows);
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
        new obsidianNS.Notice("Quest not found.");
        overlay.removeClass("open");
        return;
      }
      const [restored] = this.plugin.settings.completedQuests.splice(idx, 1);
      const hadNote = await retireNote(
        this.plugin,
        questNotePaths(this.plugin, restored, this.plugin.settings.completedQuests.concat([restored]), this.plugin.settings.completedFolderPath || "Quest Log/Completed")
      );
      const { completedAt, ...activeQuest } = restored;
      this.plugin.settings.quests.push(activeQuest);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - restored.xp);
      this.plugin.settings.questsCompleted = Math.max(0, this.plugin.settings.questsCompleted - 1);
      const coins = Math.max(1, Math.min(50, Math.round(restored.xp / 1e4)));
      this.plugin.settings.coins = Math.max(0, (this.plugin.settings.coins || 0) - coins);
      this.revokeSkillXp(restored.xp, restored.skillIds);
      await this.plugin.saveSettings();
      if (hadNote) await writeQuestFile(this.plugin, activeQuest);
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      this.renderQuestList(this._questListContainer);
      new obsidianNS.Notice(`Quest restored: ${restored.title}`);
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
    box.removeClass("habit-context");
    box.removeClass("skill-context");
    box.removeClass("quest-context");
    box.addClass("habit-context");
    overlay.addClass("open");
    box.createEl("h2", {
      text: habit.title,
      cls: "quest-detail-title"
    });
    if (habit.description) {
      box.createEl("p", {
        text: habit.description,
        cls: "quest-detail-desc quest-detail-desc-plain"
      });
    }
    const stars2 = /* @__PURE__ */ __name((n) => "\u2B50".repeat(n), "stars");
    const statsTable = box.createEl("table", { cls: "quest-detail-stats-table" });
    const rows = [
      ["XP Earned", habit.xp.toLocaleString()],
      ["Difficulty", stars2(habit.difficulty)],
      ["Urgency", stars2(habit.urgency)],
      ["Impact", stars2(habit.impact)],
      ["Type", "Habit (Repeatable)"],
      ["Completed", _QuestLogView.formatDate(habit.completedAt)]
    ];
    this.fillStatsTable(statsTable, rows);
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
        new obsidianNS.Notice("Completed habit not found.");
        overlay.removeClass("open");
        return;
      }
      this.plugin.settings.completedHabits.splice(idx, 1);
      await retireNote(this.plugin, [completedHabitNotePath(this.plugin, habit, habit.completedAt)]);
      this.plugin.settings.currentXp = Math.max(0, this.plugin.settings.currentXp - habit.xp);
      this.revokeSkillXp(habit.xp, habit.skillIds);
      await this.plugin.saveSettings();
      overlay.removeClass("open");
      this.updateHeader();
      this.renderCompletedList(this._completedListContainer);
      new obsidianNS.Notice(`Habit completion undone: ${habit.title}. -${habit.xp.toLocaleString()} XP`);
    });
  }
  /**
   * 0.6.51 — open a state in the unified overlay shell: "shop" (Rewards Shop) | "skill-graph" (Skill Graph).
   * Returns true when opened; false (with a Notice) when the state is unavailable (e.g. shop needs rewardsMode).
   */
  openOverlay(stateId) {
    const shell = this._overlayShell;
    if (!shell) return false;
    if (!shell.has(stateId)) {
      const why = stateId === "shop" ? "Rewards Shop is only available when Rewards mode is on (reopen Quest Log after enabling)." : "Unknown overlay state.";
      new obsidianNS.Notice(why);
      return false;
    }
    // 0.6.52: .ql-shell is absolute inset-0 inside the scrolling Quest Log container, so with the list scrolled it would
    // sit off-screen (reachable via the command palette; the menu button is only at the top). Pin the view to the top
    // while the shell is open and restore the list scroll on close.
    const host = this.overlayHost();
    if (host && !shell.isOpen()) {
      this._preShellScroll = host.scrollTop;
      host.scrollTop = 0;
    }
    return shell.open(stateId);
  }
  closeOverlay() {
    return this._overlayShell ? this._overlayShell.close() : false;
  }
  async onClose() {
    if (this._overlayScrollFn && this.overlayHost()) {
      this.overlayHost().removeEventListener("scroll", this._overlayScrollFn);
      this._overlayScrollFn = null;
    }
    if (this._overlayAnchorObs) {
      this._overlayAnchorObs.disconnect();
      this._overlayAnchorObs = null;
    }
    if (this._overlayShell) {
      this._overlayShell.destroy();
      this._overlayShell = null;
    }
    this.drainSliders();
    this._sliders = null;
  }
};
__name(_QuestLogView, "QuestLogView");
_QuestLogView.getXpMultiplier = Xp.getXpMultiplier.bind(Xp);
_QuestLogView.getXpForLvl = Xp.getXpForLvl.bind(Xp);
_QuestLogView.getLevel = Xp.getLevel.bind(Xp);
_QuestLogView.xpProgress = Xp.xpProgress.bind(Xp);
_QuestLogView.generateXpCurveTable = Xp.generateXpCurveTable.bind(Xp);
_QuestLogView.getNextMilestones = Xp.getNextMilestones.bind(Xp);
_QuestLogView.getSkillXpForLvl = Xp.getSkillXpForLvl.bind(Xp);
_QuestLogView.getSkillLevel = Xp.getSkillLevel.bind(Xp);
_QuestLogView.getSkillXpProgress = Xp.getSkillXpProgress.bind(Xp);
_QuestLogView.DIFFICULTY_LABELS = Xp.DIFFICULTY_LABELS;
_QuestLogView.URGENCY_LABELS = Xp.URGENCY_LABELS;
_QuestLogView.IMPACT_LABELS = Xp.IMPACT_LABELS;
_QuestLogView.calcXp = Xp.calcXp.bind(Xp);
_QuestLogView.getLevelTitle = Xp.getLevelTitle.bind(Xp);
_QuestLogView.safeName = safeName;
_QuestLogView.formatDate = formatDate;
_QuestLogView.formatHabitTimestamp = formatHabitTimestamp;
_QuestLogView.writeSidecarAtomic = writeSidecarAtomic;
var QuestLogView = _QuestLogView;

  return { QuestLogView, QUESTLOG_VIEW_TYPE, Xp, loadSnapshot };
}

module.exports = {
  QUESTLOG_VIEW_TYPE,
  registerQuestLogView,
  loadSnapshot,
  createRenderModule,
};
