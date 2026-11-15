# Frostline progression (step-by-step structure)

Same story as before (fire → survivors → kitchen → expansion → stone → defense →
frontier), cut into 27 short missions. Each mission introduces one thing,
shows one target (yellow chevron, plus a tapping hand during the opening), and
pays a reward when it completes.

## Reward loops
* **Mission reward:** every mission pays cash (`reward`, default 10 + 5×phase)
  and +20 camp XP, with a "Mission complete!" toast.
* **Camp level:** XP from missions (+20), meals served (+2), builds (+10),
  station upgrades (+15) and wolves (+3). XP for the next level:
  `40 + 35(L−1) + 6(L−1)²`. Each level pays `$15 + 10L`; levels 3, 6, 9, 12 also
  grow the pack by +2.
* **Station upgrades:** four pads that re-open at ×2.1 the price after each
  purchase, up to Lv 4 (`systems/levels.ts`):
  | Pad | Station | Effect per level | Lv 2 price |
  |---|---|---|---|
  | upGrill | Grill | cook time ÷ (1 + 0.4·(L−1)) | $40 |
  | upHatch | Serving hatch | +$4 per meal | $90 |
  | upFishing | Fishing | +35% fishing speed (player + fisher) | $120 |
  | upLumber | Lumber camp | +35% lumberjack speed | $150 |

## Tutorial
* "Drag to move" hand until the player has walked 1.5 tiles.
* A tapping hand marks the target in phase 1, the first steps of phase 2 and
  the first station upgrade.

## Wolves later and gentler
* Phase 5 now opens with the north expansion; the watchtower and first pack
  come after it. First pack: 3 wolves (was 4), later packs 5, 7, …; 75 s
  between packs (was 55 s).

## Pacing (no-cheat bot, buys only what missions ask for)
First mission 1 s, fire lit ~20 s, kitchen running ~45 s, first upgrade ~70 s,
phase 3 ~100 s, phase 4 ~2:45, phase 5 ~4:50, phase 6 ~7:50, endless ~10:20.
27 missions in about ten minutes, ~22 s each on average.
