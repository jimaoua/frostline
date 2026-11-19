import type { StructureId } from '../core/types';

/** Name and one-line description shown when you tap a building. */
export const BUILDING_INFO: Record<StructureId, { title: string; text: string }> = {
  campfire: { title: 'Campfire', text: 'The heart of the camp. Keep it fed with logs or the cold wins.' },
  fishPond: { title: 'Fishing Hole', text: 'Stand at the edge to fish. Bring the catch to the grill.' },
  grill: { title: 'Grill', text: 'Hand raw fish over at the glowing spot. It cooks them into hot meals.' },
  counter: { title: 'Serving Counter', text: 'Put meals out here. Hungry survivors pay at the counter.' },
  cashPad: { title: 'Cash Pad', text: "Guests' money piles up here. Walk over it to scoop it up." },
  lumberHut: { title: 'Lumberjack Hut', text: 'Home of the lumberjacks. They chop trees and fill the woodpile.' },
  woodpile: { title: 'Woodpile', text: "The lumberjacks' logs. Take what you need to build." },
  fishShack: { title: "Fisher's Shack", text: 'A fisher and a cook live here. They keep the kitchen running.' },
  tradingPost: { title: 'Trading Post', text: 'Sell logs, stone and ore on the mat. The hauler brings goods here too.' },
  tradeMat: { title: 'Trade Mat', text: 'Drop logs, stone or ore here to sell them. Coins pile up on the mat.' },
  quarryCamp: { title: 'Quarry Camp', text: 'Miners break rocks and fill the stonepile.' },
  stonepile: { title: 'Stonepile', text: "The miners' stone. Take it to a construction site." },
  stash: { title: 'Stash', text: 'Step on with full hands to drop everything. Step on empty-handed to take things back.' },
  tower1: { title: 'Watchtower', text: 'Shoots arrows at wolves that come too close.' },
  tower2: { title: 'Watchtower', text: 'Shoots arrows at wolves that come too close.' },
  tower3: { title: 'Lake Watchtower', text: 'Guards the west yard and the frozen lake.' },
  workshop: { title: 'Workshop', text: 'Unlocks better tools: sharper axes, bigger packs, iron arrows.' },
  shelter: { title: 'Shelter', text: 'Warm beds for the survivors. Keeps the camp in good spirits.' },
  smokehouse: { title: 'Smokehouse', text: 'Drop raw salmon here. It turns into valuable smoked salmon.' },
  market: { title: 'Fish Market', text: 'Sell smoked salmon on the mat for the best prices in camp.' },
  marketMat: { title: 'Market Mat', text: 'Drop smoked salmon here to sell it. Coins pile up on the mat.' },
  lakeCamp: { title: "Ice Fishers' Hut", text: 'Ice fishers catch salmon at the holes in the frozen lake.' },
};
