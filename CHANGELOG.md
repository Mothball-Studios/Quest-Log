# Quest Log — Changelog

Vault project notes (design / ship history). Durable code tree: `/workspace/Quest-Log-src`. Ship folder: `.obsidian/plugins/quest-log` (four files only).

## 0.6.45 — 2026-09-26

Luke via Atlas COO REPLACE — Skills selector/attached: NO description (Skills tab only):

1. **Skills selector** picker + quest/habit **attached-skills** grids: title | level (top-right pin) + XP bar flush bottom only. Kill `quest-block-desc-wrap` from those DOM paths.
2. Main **Skills** tab `.skill-block` still shows description below the title|level band (0.6.43). Quests / Habits list untouched.
3. Supersedes 0.6.44 selector-desc work (desc stays Skills-tab-only).

## 0.6.44 — 2026-09-26

Luke via Atlas COO APPROVED — Skills SELECTOR picker level pinned to title row:

1. **Skills selector** `.skills-selector-row` / `.skill-selector-row` (picker list + attached display): top band = title | level (same row / same Y, `align-items:flex-start`). Description (if any) is a sibling **below** the band — never bottom-aligning level with desc.
2. Side-by-side with-desc / no-desc: level tops align; XP bar `margin-top:auto` flush bottom of picker block. Checkbox / remove chrome unchanged.
3. Main Skills tab (0.6.43), Quests / Habits / quest-habit linked selectors untouched. Shared title-row flex-end kept for non-band usages.

## 0.6.43 — 2026-09-26

Luke via Atlas COO APPROVED — Skills tab level pinned to title row:

1. **Skills** list `.skill-block`: top band = title | level (same row / same Y, `align-items:flex-start`). Description (if any) is a sibling **below** the band — never inside a left column that bottom-aligns level with desc.
2. Side-by-side with-desc / no-desc: level tops align; XP bar stays `margin-top:auto` flush bottom (0.6.42). Gap between band and XP on no-desc is OK.
3. Selector / details / creation / Quests / Habits untouched (shared title-row flex-end kept; Skills list overrides scoped).

## 0.6.42 — 2026-09-26

Luke via Atlas COO APPROVED — Skills tab XP bar flush to block bottom:

1. **Skills** list `.skill-block`: flex column already; `.skill-xp-bar { margin-top: auto }` (band stays content-sized) so the XP bar locks to the bottom edge with or without a description.
2. Side-by-side mixed desc/no-desc: blocks may stretch to match row height; gap between band and XP bar is OK — bar must never float mid-block.
3. Quests / Habits / selector / details / creation untouched.

## 0.6.41 — 2026-09-26

Micah via Atlas COO APPROVED — Quests complete size parity + Habits list icon parity:

1. **Quests** list `.quest-complete-btn`: square 28×28 → Habits-style **56×28** 2:1 rect (same outer size as `.habit-complete-btn-mini`). Habits fail/complete outer size unchanged (stay 56×28).
2. **Habits** list icons: check SVG raised to match Quests list check; fail X raised to that same size — Habits check ≡ Habits X ≡ Quests check (18×18 list-scoped; Quests locks Obsidian --icon-m).
3. Details/creation untouched (list-scoped selectors only).

## 0.6.40 — 2026-09-26

Micah via Atlas COO APPROVED — Habits tab list Fail|Complete layout:

1. **Habits** (`renderHabitList` / `.habit-block`): Fail + Complete move RIGHT on the desc row (same horizontal alignment as Quests tab complete — desc | buttons). Not a full-width bottom row.
2. Size: each habit fail/complete is a **2:1 rectangle** (width = 2× Quests complete square height; height matches that square). Adjacent fail|complete equal 50/50 rects.
3. Quests complete stays square. Details/creation untouched.

## 0.6.39 — 2026-09-26

Micah via Atlas COO APPROVED — Main Quests + Habits tab list redesigns:

1. **Quests** (`renderQuestList` / `.quest-block`): title | XP band (coins left of XP when `rewardsMode` ON; hide coins when OFF) above complete; description truncates + gradient-fades into the complete control (Skills desc→level pattern).
2. **Habits** (`renderHabitList` / `.habit-block`): title | XP band (never coins); Fail + Complete stretch full bottom width 50/50 (`flex:1`, match detail `.quest-detail-buttons`).
3. Details/creation unchanged. No habit coins.

## 0.6.38 — 2026-09-26

Micah via Atlas COO APPROVED — Skills tab title-wrap + long-name pack:

- Root: `.skill-grid` `1fr` tracks expanded to fit long titles (`min-width:auto`), so wrap measure never fired → no `.skill-span-full` / no longs-top pack.
- Fix: `repeat(2, minmax(0, 1fr))` + `.skill-block { min-width: 0 }`; title `display:block` full left-col width (drop column `flex-basis:100%`).
- Desc fade + selector/details/creation UIs untouched. JS pack helpers unchanged.

## 0.6.37 — 2026-09-26

Micah via Atlas COO APPROVED — Skills tab title-wrap regression (CSS-only):

- Title wraps on its own row(s); desc stays single-line fade under.
- `main.js` unchanged from 0.6.36.

## 0.6.36 — 2026-09-26

Micah via Atlas COO APPROVED — Skills tab skill cards:

- Band layout: title + inline desc | level; XP bar under.
- Drop note icon (and has-note pad).

## 0.6.35 — 2026-09-26

Micah via Atlas COO APPROVED — skill grid pack:

- Long (wrapping) titles full-row at top; shorts pack 2-across below — no orphan gaps beside a full-span card.
- Reorder within `applySkillGridWrapSpans` (stable within longs/shorts partitions).

## 0.6.34 — 2026-09-26

Micah via Atlas COO APPROVED — skill grid wrap span:

- Skill 2-col grids: full-row span (`.skill-span-full`) when title wraps 2+ lines; short titles stay 2-across.
- Shared `bindSkillGridWrapSpans` on Skills tab, selector list, and attached skills display.

## 0.6.33 — 2026-09-26

Micah via Atlas COO APPROVED — Main Skills tab skill cards:

- Skill-block title wrap + level bottom-align matching selector/details (`detail-skill-attached-title-row` / title / level).
- CSS: skill-block title sizing + padding-right when note icon present.

## 0.6.32 — 2026-09-26

Micah via Atlas COO APPROVED — reward slot layout:

- Abandon 2fr/4fr grid; equal flex reward slots (button-style) for coins + XP under Reward header.
- `src/render.js` comment-only (docs the equal-flex halves). `main.js` md5 unchanged from 0.6.31.

## 0.6.31 — 2026-09-26

Micah via Atlas COO APPROVED — leftover CSS after 0.6.30:

- Skill title|level same-row CSS specificity tighten (`!important` + scoped `.skill-selector-row` / `.detail-skill-attached-row` selectors) so title and level stay on one row when other rules fight.
- `main.js` unchanged from 0.6.30.

## 0.6.30 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.29:

1. Skill attach + picker: title and level on the **same row** again (level bottom-aligned; title wraps).
2. Quest reward: structural `.quest-detail-reward-slot` wrappers so coin + XP stay centered in **2fr / 4fr** cells.

## 0.6.29 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.28:

1. Quest reward coins / XP values centered inside their **2fr / 4fr** slots (CSS-only; `main.js` unchanged).

## 0.6.28 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.27:

1. Attached / selector skill pretty blocks: level sits **under** the title (stacked title → level → XP bar), not beside it.
2. Quest reward coins / XP grid: **2fr / 4fr** under the Reward header (was 2fr / 3fr).

## 0.6.27 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.26:

1. Unify Create FAB baseline: `.quest-fab` + `.quest-log-fab` share **30px** desktop / **80px** mobile.
2. Drop shop-separate **50px / 125px** bottoms; shop keeps gold color only.
3. CSS + manifest only; `main.js` unchanged from 0.6.26.

## 0.6.26 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.25:

1. Shop create FAB: restore base `.quest-log-fab` geometry (50×50 absolute).
2. Desktop shop FAB `bottom: 50px` (a little above main FAB's 30px).
3. Mobile shop FAB `bottom: 125px` (~1.5 FAB heights above desktop) to clear Obsidian action bar.
4. CSS + manifest only; `main.js` unchanged from 0.6.25.

## 0.6.25 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.24:

1. Mobile only: FAB `bottom` **30px → 80px** (~one FAB height / 50px raise). Desktop unchanged at 30px. CSS + manifest only; `main.js` same as 0.6.24.

## 0.6.24 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.23:

1. Details title input matches creation for skill / quest / habit: shared `quest-modal-title` chrome (full width, bold, 16px, same padding).
2. Mobile: keep title inputs at **16px** (do not shrink details below creation).

## 0.6.23 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.22:

1. Capitalize selector UI copy: placeholders **Type Skill Name** / **Type Quest Name** / **Type Habit Name**; action button **Select**.
2. Mobile: skills/quests/habits/linked selector overlays fixed full-viewport and `z-index: 10050` above detail/creation modals (`9999`), so selectors are usable on phone.

## 0.6.22 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.21:

1. Quest/habit details attach-skills grid: **3 → 2** pretty blocks per row (`repeat(2, 1fr)`). Pretty block chrome unchanged.
2. Skills Selector picker still **2-across**. CSS + manifest only; `main.js` unchanged from 0.6.21.

## 0.6.21 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.20. Ship once when all three done:

1. Quest details + quest creation reward layout: coins / XP no longer pinned to extremes. Coins in **2fr** slot, XP in **3fr** slot (`grid-template-columns: 2fr 3fr` = two-fifths / three-fifths of a 5-unit row under the Reward header; coherent reading of "two-fifths / rest"). Habits unaffected (no coins).
2. Attach skills in quest details + habit details: attached skills as pretty blocks (skill-green left edge `--ql-skill` `#22c55e`, light green bg, skill title, small green XP bar, level in green on the right in line with title). Three skills per row, evenly spaced L→R, wrap. Bare detach X preserved from 0.6.20.
3. Skills selector picker: available skills as pretty rows (green left edge, green bg, title, level, green XP bar). Two skills side by side per row, fill L→R.

## 0.6.20 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.19. Skill details + creation:

1. Detach X completely bare in all states (rest / hover / focus / active): no background, border, or box-shadow; plain 28×28 hit area.
2. Hover (and focus-visible) may recolor ink only (`#c4c9d0` → danger red). `main.js` unchanged from 0.6.19.

## 0.6.19 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.18. Skill details + creation, attach quests + attach habits:

1. Detach X: keep 28×28 size, strip bordered/button container — bare X only, no border or background block.
2. Habit rows: never show coin count, even when rewardsMode on. Remove coin display from habit rows entirely (attached + selector). Display-only — habits do not give coins; no habit coin economy change.
3. Quest rows: always show coin count when rewardsMode on (attached + selector).

## 0.6.18 — 2026-09-26

Micah via Atlas COO APPROVED — Quest Log UI post 0.6.17:

1. Unify detail-modal header across skill / habit / quest: one line with title, created meta, and trash → open-note → close (undo skill-only flush-top actions row from 0.6.17).
2. Skill details only: readable **Created on …** date blurb near header (e.g. `Created on Sep 27, 2026`); habit/quest keep existing `Created …` wording.
3. Skill details + creation: detach (X) on each attached quest/habit row is a slightly bigger bordered button-style control (not a bare icon), clearly tappable and distinct from the row.

## 0.6.17 — 2026-09-26

Micah via Atlas COO APPROVED — UI fix post 0.6.16:

1. Skill details + skill creation: attached quests/habits no longer render as chip/tag jumble.
2. Attached items reuse selector row chrome exactly: colored left edge + tinted background (`--ql-quest` `#3b82f6` / `--ql-habit` `#a855f7`), title, XP, and coin amount when rewardsMode is on.
3. Detach (X) control kept on each row. Identical on skill details and skill creation.
4. Skill details ONLY: trash → open-note → close icons moved to very top of modal (flush with top edge, above header); divider between header ("Skill Details") and skill title field. Creation modal unchanged.

## 0.6.16 — 2026-09-26

Micah via Atlas COO — skill details + skill creation: separate quest / habit attach:

1. Skill details and skill creation each get sequential **attach quests** and **attach habits** sections (reward-style header + plus → selector modal → chips under divider; empty blurbs when none).
2. Quest selector rows use `--ql-quest` `#3b82f6`; habit selector rows use `--ql-habit` `#a855f7`. Rows show title, XP, and coin reward when rewardsMode is on.
3. Selecting quests/habits from a skill syncs that skill into each item's `skillIds` (active lists). Identical treatment on details and creation.

Preserves 0.6.13–0.6.15 attach-skills patterns on quest/habit modals.

## 0.6.15 — 2026-09-26

Micah via Atlas/Riku — UI follow-on post 0.6.14 (details + creation):

1. Skills Selector search placeholder: **type skill name** (was "search bar").
2. Attach-skills header plus: keep position; slightly bigger (18px); color match close X (`#c4c9d0`) for visibility.
3. Details + creation modals: horizontal divider above confirm (and fail if present) — line between skills list and bottom action buttons; no extra padding.

## 0.6.14 — 2026-09-26

Micah via Atlas/Riku — skills attach polish (follow-on on 0.6.13; details + creation identical):

1. Plus on far right of attach-skills header; **attach skills** truly centered across full header width (absolute-positioned plus).
2. Selector title capitalized: **Skills Selector** (was lowercase "skills selector").
3. Exactly one divider between search bar and scrollable skill list (removed duplicate second divider).
4. Skill list scrolls when count exceeds visible area (`min-height: 0` + `overflow-y: auto` inside modal; modal `overflow: hidden`).

Preserves 0.6.13: no skills attached empty, chips under divider, X close, search, select, multi-select.

## 0.6.13 — 2026-09-26

Micah via Atlas/Riku — skills attach redesign (details + creation):

1. Kill collapsible / persistent text-field skill picker (`SkillSuggest` + type-to-add input).
2. Attach-skills block mirrors Reward layout: centered **attach skills** header with small plus to the right of the label, divider under header.
3. Empty state blurb: **no skills attached**.
4. Plus opens **skills selector** modal: X close, search bar, dual dividers, scrollable multi-select list, **select** applies chips.
5. Identical treatment on details and shared create (quest/habit) modals.
6. Preserves type tokens / master XP bar fixes from 0.6.9–0.6.12.

## 0.6.12 — 2026-09-26

Micah via Atlas/Riku — creation ↔ details slider polish (follow-on after 0.6.11):

1. Creation-modal slider thumb star size matches details (20×20 clip-path thumb).
2. Details Difficulty/Urgency/Impact labels + scale words inherit creation typography (weight/size/color); slider bars untouched.
3. Creation Reward block moved above Difficulty/Urgency/Impact sliders (same order as details).

## 0.6.11 — 2026-09-26

Micah via Atlas/Riku — creation + details modal sync:

1. Unify quest + habit creation into one shared `openCreateModal({ type })` (same type-flag pattern as `openDetailModal`).
2. Creation Cancel → X icon top-right (same 16px-ink / 24px-box treatment as details close: default `#c4c9d0`, red hover).
3. Create button spans full bottom width.
4. Keep creation-modal slider LABEL styling; details-modal slider labels updated to match (bars untouched).
5. Creation rewards section matches details reward layout (centered Reward + divider; XP centered; coins left / XP right when rewardsMode).
6. Creation sliders default to first slot (1 / lowest); default XP = lowest band (100), not middle ~7071.
7. Skill creation only: Cancel → X top-right; Create Skill button full bottom width.
8. Details: creation-modal-style header divider between header row (created date / trash / open note / close X) and the title field.

Preserves type tokens (`--ql-quest`, `--ql-habit`, `--ql-skill`, `--ql-xp-master`), 0.6.9 master XP recompute, and 0.6.10 continuous % fill.

## 0.6.10 — 2026-09-26

Micah via Atlas/Riku — master XP bar fill stepped in notches instead of tracking continuously:

- Symptom: XP text (`into / needed`) updated after quests, but the soft-blue master bar sat still until a threshold then jumped; worse at high levels (~20 × ~7k XP invisible).
- Root cause: `Xp.xpProgress` used `Math.round(into / xpNeeded * 100)` → integer CSS `%`. At high levels one percent of the band is tens of thousands of XP, so quest-sized gains never moved the fill until a whole-percent boundary.
- Fix: continuous percent (`into / xpNeeded * 100`, no integer round); header/`updateHeader` set fill width with 4-decimal `%`. Soft blue `--ql-xp-master` `#4b6cb7` unchanged. 0.6.9 level recompute (`getLevel` lo+1, clamp into) preserved. Skill `getSkillXpProgress` same continuous `%` (same quantization).

## 0.6.9 — 2026-09-26

Micah via Atlas/Riku — master XP bar progress fix (same class as skill XP bug):

- Header showed full bar + impossible progress (e.g. `89,644 / 82,556` into > needed) for `currentXp` past the displayed level threshold.
- Root cause: `profile.getLevel` returned binary-search `lo` (attained threshold index) while `Xp.xpProgress` used skill-style bands (`getXpForLvl(level-1)` → `getXpForLvl(level)`), i.e. expected `lo+1`. Wrong band → into > xpNeeded → clamped-looking 100% fill + wrong XP text. Color token `--ql-xp-master` `#4b6cb7` was already correct.
- Fix: `profile.getLevel` now returns `lo + 1` (matches `Xp.getLevel` / skill `getSkillLevel`). `Xp.xpProgress` always recomputes level from `currentXp` + `userDifficulty`, clamps into-level progress to `[0, xpNeeded]`, and header/`updateHeader` use `bar.level` (do not trust a caller-passed level).

## 0.6.8 — 2026-09-26

Micah — habit details Reward XP color fix:

- Habit details modal Reward XP value now uses `--ql-habit` `#a855f7` (was stuck on quest blue `#3b82f6`).
- Root cause: override used `.habit-context .quest-detail-box …` but both classes are on the same element, so the descendant selector never matched; `.quest-detail-box .quest-detail-reward .quest-xp-preview-value` kept winning.
- Fix: `.habit-context .quest-detail-reward .quest-xp-preview-value` → `var(--ql-habit)`. Quest details Reward XP stays `--ql-quest`.

## 0.6.7 — 2026-09-26

Micah via Atlas/Riku — XP color surface split (kill soft-purple bleed):

- New `--ql-xp-master` `#4b6cb7` for master level badge + master XP bar only (gradient dark end restored to `#182848`).
- Skill list/panel: LVL number + XP bar use `--ql-skill` `#22c55e` (only green XP surface this pass).
- Quest blocks + quest detail/create Reward XP → `--ql-quest` `#3b82f6`.
- Habit blocks + habit detail/create Reward XP → `--ql-habit` `#a855f7`.
- Removed global soft-purple `--ql-xp` `#c084fc` so changing one surface never bleeds.
- Skill details modal unchanged.

## 0.6.6 — 2026-09-26

Micah via Atlas/Riku — detail modal type-bleed + unified soft XP purple:

- Detail modal header titles (Quest/Habit/Skill Details) no longer inherit type color; stay neutral white. Type colors remain on accents (icons, badges, focus borders, create buttons).
- Reward label stays neutral (`#888`); Reward XP values no longer pick up quest blue / habit purple.
- `--ql-xp` softened from blue `#4b6cb7` → soft purple `#c084fc` (softer than habit `#a855f7`) for XP bars, XP values, and level badges across quest/habit/skill list surfaces.
- Skill details modal: header only neutralized; skill-internal XP (level value, detail XP bar, "XP / XP" progress text) left as-is.

## 0.6.5 — 2026-09-26

Split quest chrome from XP chrome (Micah via Atlas/Riku):

- Keep `--ql-quest` `#3b82f6` for quest type chrome only
- New independent `--ql-xp` `#4b6cb7` for XP bar fill, XP text, and level badge
- Changing one token no longer affects the other

## 0.6.4 — 2026-09-26

Quest type blue bumped for vibrancy (Micah via Atlas/Riku):

- `--ql-quest` `#4b6cb7` → `#3b82f6` (hover `#3d5a9a` → `#2563eb`)
- Matching hard-coded fallbacks + `rgba(59, 130, 246, …)` glow/tint; Habit/Skill unchanged

## 0.6.3 — 2026-09-26

Luke consistency pass on Scope's 0.6.1/0.6.2 type tokens:

- Habit list cards: hover border + XP text use `--ql-habit` (no longer inherit quest blue)
- Detail modal context classes cleared/set so skill/quest/habit accents cannot bleed
- Completed list labels both Quest (blue) and Habit (purple)
- Skill radar polygon fill + leftover `#5e87ff`-era glows aligned to type tokens

## 0.6.2 — 2026-09-26

Skill graph hover/glow leftovers switched from quest blue to skill green.

## 0.6.1 — 2026-09-26

Type color coding restored and locked (not theme `interactive-accent`):

- **Quest:** XP-bar blue `#4b6cb7` (`--ql-quest`) — tabs, FAB, list accents, create/detail context
- **Habit:** purple `#a855f7` (`--ql-habit`)
- **Skill:** green `#22c55e` (`--ql-skill`) — including skill graph chrome

## 0.6.0 — 2026-09-26

Version bump for the session that landed as `4a82388` (detail modal polish, skill XP fix, slider/star/icon polish, reward block reorg, modular `src/` + ship rail).

**Standing:** bump `manifest.json` / `package.json` on every future Quest Log push.

## 2026-09-26 — detail modal polish, skill XP fix, studio rename

Session work on Quest Log UI/UX plus studio seat rename. Stamped as **0.6.0** in the follow-up bump commit.

### Skill XP renderer
- Fixed stale stored skill level and wrong curve usage (`userDifficulty` vs `skillDifficulty`).
- Level and progress bar now recompute from XP instead of trusting a cached level.

### Detail modal / shared layout
- Shared `openDetailModal` refactor with a type flag (`quest` / `habit`).
- Quest detail modal matched to habit layout, minus Fail.
- Created date centered in the detail header.
- Top buttons reordered: trash → open note → close.
- Close control is Lucide X, sized for 16px ink, default `#c4c9d0`, red on hover.
- Bottom buttons icon-only check / X at 50/50; quests use Complete full-width (no Fail).

### Sliders & rewards
- Slider max-fill gap closed; fill uses a rounded right edge.
- Notch stars scaled down ~10% total, repositioned; close-X ink matched to 16px (same as trash / note).
- Reward block moved above the sliders, unboxed: centered “Reward” label + divider, XP centered alone.
- When `rewardsMode` is coins: coins left / XP right.
- Slider gaps halved; reward → slider gap tightened.

### Studio (docs / org)
- Agent **Loom** renamed to **MC Func** across studio surfaces; pairings are now **Apace/MC Func** (also Apace · MC Func / Apace, MC Func).
