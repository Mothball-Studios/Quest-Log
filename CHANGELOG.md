# Quest Log — Changelog

Vault project notes (design / ship history). Durable code tree: `/workspace/Quest-Log-src`. Ship folder: `.obsidian/plugins/quest-log` (four files only).

## 2026-09-26 — detail modal polish, skill XP fix, studio rename

Session work on Quest Log UI/UX plus studio seat rename. Manifest still **0.5.5** (no stamp this entry).

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
