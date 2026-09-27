# Quest Log — Changelog

Vault project notes (design / ship history). Durable code tree: `/workspace/Quest-Log-src`. Ship folder: `.obsidian/plugins/quest-log` (four files only).

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
