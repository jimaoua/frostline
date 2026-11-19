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

## Chapter 2 — The Frozen Lake (Phase 7)
Opens after the gatehouse (end of Phase 6). The forest west of the walls is
cleared on entry; walling it in reveals a frozen lake with five fishing holes.

| # | Mission | Cost / goal |
|---|---|---|
| 1 | Push the stockade west | $700 (new West Yard + west gate) |
| 2 | Raise a watchtower by the lake | $450 (guards the new gate) |
| 3 | Build the Smokehouse | $250 |
| 4 | Catch 5 salmon through the ice | fish at the lake holes |
| 5 | Smoke 5 salmon | drop salmon at the Smokehouse (2 racks, 3.2 s each) |
| 6 | Open the Fish Market | $350 |
| 7 | Sell 5 smoked fish | $18 each at the market mat |
| 8 | Build the Ice Fishers' Hut | $700 → two ice fishers (lake → smokehouse) |
| 9 | Upgrade the Smokehouse | station level pad, $400 → faster racks (up to Lv 4) |
| 10 | Hire a market porter | $400 → carries smoked fish to the market; cash waits on the mat |
| 11 | Endure the frontier | endless |

Code: `systems/lake.ts` (reveal, smokehouse, player interactions),
`render/lake.ts` (lake, holes, smokehouse, market, hut), worker roles
`icefisher` / `porter` in `systems/workers.ts`, layout in `world/layout.ts`
(`QUADRANTS.west`, `LAKE`, `ICE_HOLES`). Bot pacing: about 8 minutes for the chapter.

## Losing is no longer a wipe
When the fire goes out the camp is kept: **Relight the fire** drives off the
raid, costs 25% of cash and 15 morale, and the fire comes back at 60%.
Wolf packs now level off at 9 animals (and +5 toughness) so long games stay winnable.

## Save compatibility
Saves from before Chapter 2 load normally: new buildings, pads and stats are
merged in, and a save that was on the old "endless" step moves straight to
Chapter 2's first mission.

## Stage 3 — Materials and visible construction
Buildings and expansions now take real materials plus some money. Station
upgrades, hires and the optional shop pads keep their money price. Prices live
in `BUILD_COSTS` (`world/createWorld.ts`). Before Stage 3, every price below
was money only.

| Pad | Before | Now |
|---|---|---|
| Fisher's Shack | $60 | 10 logs + $40 |
| Bonfire | $80 | 12 logs + $40 |
| Lumberjack Hut | $120 | 15 logs + $60 |
| East Yard | $300 | 20 logs + $150 |
| Quarry Camp | $200 | 20 logs + $100 |
| North Yard | $600 | 20 logs + 15 stone + $250 |
| Watchtower | $400 | 12 logs + 10 stone + $150 |
| Second Watchtower | $600 | 12 stone + 3 ore + $200 |
| Workshop | $500 | 20 logs + 15 stone + $200 |
| Sharp Axes | $200 | 3 ore + $100 |
| Shelter | $450 | 25 logs + 15 stone |
| Gate Traps | $300 | 4 ore + $150 |
| Gatehouse | $500 | 20 stone + 4 ore |
| West Yard | $700 | 30 logs + 20 stone + $300 |
| Lake Watchtower | $450 | 15 stone + 4 ore |
| Smokehouse | $250 | 20 logs + $150 |
| Fish Market | $350 | 25 logs + 10 stone + $200 |
| Ice Fishers' Hut | $700 | 30 logs + 20 stone + $300 |

* Stone is only asked for after the quarry opens (phase 4). Ore is only asked
  for after the first ore run (phase 5).
* Each pad shows one row per requirement: logs/stone/ore as "delivered/needed",
  money as dollars still to pay. Each row has a ring that fills as items land
  and turns green with a ✓ when done. The mission card shows one percentage.
* What you carry is unloaded first, then money flies off your back. Progress
  only counts what has landed. Walking off keeps everything delivered so far.
* The player can take stone from the miners' stonepile while a pad still
  needs stone.
* Old saves: a pad that was not started gets the new price. A pad that was
  already part-paid keeps its old money price, so nothing paid is lost.

### Construction stages (13 buildings)
Grill, Lumberjack Hut, Fisher's Shack, Trading Post, Quarry Camp, Workshop,
Shelter, Smokehouse, Fish Market, Ice Fishers' Hut and the three watchtowers
rise on their pad while you pay:

1. **Foundations (0–25%):** a dirt patch, then a stone plinth spreads out,
   with corner stakes.
2. **Frame (25–60%):** scaffold posts climb and cross beams appear.
3. **Walls (60–90%):** the real building rises inside the scaffold.
4. **Finishing (90–100%):** walls reach the eaves. When the last item lands,
   the roof goes on, the scaffold falls away and the building lands with a
   bounce, confetti and the success haptic.

Progress is weighted per unit: $1 = 1, log = 4, stone = 6, ore = 15. Every
landing nudges the site. Each new stage pops it, throws dust and wood or stone
chips, and plays the "stage" sound with a medium haptic. Expansions and
upgrades take materials too, but have no construction stages yet.

## Playtest round 1 (friends' feedback)
* **Kitchen spots:** the grill and the serving counter each have a glowing
  "stand here" tile with the item they take. The grill spot is in front of
  the grill, the counter spot just inside the counter. A spot turns gold and
  pulses when you carry something for it. The guide arrow points at them.
* **Locked pads:** "coming next" pads show a small lock chip instead of their
  full price, so they no longer cover the stations in use.
* **Tap a building:** you see its name and a one-line description for 5 s
  (`world/buildingInfo.ts`). Tapping empty ground closes it.
* **Top-left counts:** money, plus what is in your arms right now (logs and
  stone always; ore, fish, meals, salmon only while carried). Before, these
  chips showed the woodpile, which the hauler kept emptying.
* **Storage lists:** two buttons under the counts. "Stash" lists what you
  stored. "Workers" lists the workers' stockpiles: woodpile, stonepile, grill
  tray, counter, cash pad, trade mat, smokehouse and market mat.
* **Stash** (starting yard, west of the south gate): stop on it with full
  hands and everything you carry (never money) drops in. Stop on it
  empty-handed and you take things back, starting with what open buildings
  need. A visit only goes one way, and walking across never triggers it.
  The stash is saved; old saves start with an empty one.
