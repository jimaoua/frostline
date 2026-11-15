export const C = {
  snow: '#e9f0f8',
  snowShadow: '#c6d5e6',
  snowDeep: '#b3c7dd',
  ink: '#1f2a37',
  outline: 'rgba(28,36,52,0.55)',

  dirt: '#d9a06c',
  dirtDark: '#bf8452',
  dirtGrain: '#b67a49',

  wood: '#c47e45',
  woodDark: '#8d5330',
  woodDeep: '#5f3519',
  woodLight: '#e2a96f',
  logEnd: '#f1c890',
  logRing: '#c78a52',
  band: '#3c88cf',
  bandDark: '#2c6aa4',

  pine: '#2e6f73',
  pineDark: '#1f5357',
  pineLight: '#3f8b86',
  pineSnow: '#f8fbff',
  trunk: '#7a4b2a',

  rock: '#97a3b1',
  rockLight: '#bcc6d1',
  rockDark: '#6a7686',

  roof: '#c0503f',
  roofDark: '#8c342a',
  roofLight: '#dc6a55',

  coin: '#4fbf5a',
  coinDark: '#2b8537',
  coinLight: '#9be3a1',
  stone: '#9aa6b4',

  window: '#ffd77a',
  windowNight: '#ffe7a8',

  shadow: 'rgba(40, 64, 98, 0.22)',
} as const;

export interface HumanStyle {
  coat: string;
  coatDark: string;
  coatLight: string;
  trim: string;
  hat: string;
  hatType: 'hood' | 'beanie' | 'helmet' | 'cap' | 'chef' | 'bare';
  skin: string;
  hair: string;
  pants: string;
  boots: string;
  scarf?: string;
}

export const PLAYER_STYLE: HumanStyle = {
  coat: '#2f7fd8',
  coatDark: '#1f5ba3',
  coatLight: '#5fa3ee',
  trim: '#f6f8fc',
  hat: '#2f7fd8',
  hatType: 'hood',
  skin: '#f3c9a1',
  hair: '#5b3b25',
  pants: '#2e3d55',
  boots: '#3b2a22',
  scarf: '#e9493a',
};

export type StyledRole = 'lumberjack' | 'miner' | 'hauler' | 'fisher' | 'cook' | 'icefisher' | 'porter';

export const WORKER_STYLES: Record<StyledRole, HumanStyle> = {
  lumberjack: {
    coat: '#d4602f', coatDark: '#9f441b', coatLight: '#ef8a57', trim: '#f1ece4', hat: '#b8322b', hatType: 'beanie',
    skin: '#eec09a', hair: '#6b4429', pants: '#4a3a30', boots: '#2e231c',
  },
  miner: {
    coat: '#8a7560', coatDark: '#5f4e3e', coatLight: '#a99178', trim: '#e9e2d6', hat: '#e8b83a', hatType: 'helmet',
    skin: '#e7b893', hair: '#3a2a20', pants: '#3b3d45', boots: '#2a2420',
  },
  hauler: {
    coat: '#3f9a6a', coatDark: '#2a7048', coatLight: '#62bb8a', trim: '#eef4ef', hat: '#2d7550', hatType: 'cap',
    skin: '#f0c49c', hair: '#4a3020', pants: '#3a3f4c', boots: '#2c2520',
  },
  fisher: {
    coat: '#e0a32a', coatDark: '#a8761a', coatLight: '#f4c55a', trim: '#f5efe0', hat: '#2a5d8f', hatType: 'beanie',
    skin: '#e9bb93', hair: '#7a4b2a', pants: '#36506e', boots: '#2b2a2e', scarf: '#2a5d8f',
  },
  cook: {
    coat: '#f2f2ee', coatDark: '#c9ccd2', coatLight: '#ffffff', trim: '#e9493a', hat: '#ffffff', hatType: 'chef',
    skin: '#f0c49c', hair: '#3a2a20', pants: '#3d3a40', boots: '#2b2420',
  },
  // Chapter 2: teal fur-hooded ice fishers and a plum-coated market porter.
  icefisher: {
    coat: '#2f9ea0', coatDark: '#1f7476', coatLight: '#5cc4c4', trim: '#f4efe4', hat: '#1f7476', hatType: 'hood',
    skin: '#e9bb93', hair: '#4a3020', pants: '#2f3a4c', boots: '#2b2a2e', scarf: '#ff9a3c',
  },
  porter: {
    coat: '#8c4a7a', coatDark: '#663457', coatLight: '#b06e9e', trim: '#f3ece6', hat: '#3b3d45', hatType: 'cap',
    skin: '#d9a982', hair: '#2a1d16', pants: '#3a3f4c', boots: '#2a2420', scarf: '#e9c46a',
  },
};

/** Survivors who come to eat: a handful of outfits. */
export const SURVIVOR_STYLES: HumanStyle[] = [
  { coat: '#7d6bb8', coatDark: '#584a8c', coatLight: '#a291d6', trim: '#f2eee8', hat: '#584a8c', hatType: 'beanie', skin: '#f0c49c', hair: '#3a2a20', pants: '#3b3d45', boots: '#2a2420', scarf: '#ffd34d' },
  { coat: '#4f8c9e', coatDark: '#356676', coatLight: '#76b2c2', trim: '#eef4f6', hat: '#356676', hatType: 'hood', skin: '#d9a982', hair: '#2a1d16', pants: '#43404a', boots: '#2a2420' },
  { coat: '#b8564f', coatDark: '#8a3a35', coatLight: '#d77c74', trim: '#f4ece6', hat: '#3b3d45', hatType: 'cap', skin: '#f3d0b0', hair: '#c9873f', pants: '#2f3a4c', boots: '#2a2420' },
  { coat: '#8a9a5b', coatDark: '#66733f', coatLight: '#aebd7c', trim: '#f2f0e6', hat: '#c9873f', hatType: 'bare', skin: '#c99272', hair: '#4a3020', pants: '#4a3a30', boots: '#2a2420', scarf: '#e9493a' },
  { coat: '#c98a3f', coatDark: '#9a652a', coatLight: '#e6ae68', trim: '#f6efe2', hat: '#6b4429', hatType: 'beanie', skin: '#f0c49c', hair: '#2a1d16', pants: '#3a3f4c', boots: '#2a2420', scarf: '#4aa3ff' },
];

export const TRADER_STYLE: HumanStyle = {
  coat: '#6b4a8f', coatDark: '#4a3266', coatLight: '#8f6cb6', trim: '#e9c46a', hat: '#4a3266', hatType: 'hood',
  skin: '#d9a982', hair: '#2a1d16', pants: '#3b3d45', boots: '#2a2420', scarf: '#e9c46a',
};
