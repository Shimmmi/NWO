export type BoosterSkuId =
  | "booster-rumpf-standard"
  | "booster-pu-standard"
  | "booster-shi-standard"
  | "booster-zelenko-standard"
  | "booster-mix-standard"
  | "booster-mix-premium";

export type BoosterPool =
  | { type: "character"; characterId: string }
  | { type: "mix" };

export interface BoosterSku {
  id: BoosterSkuId;
  name: string;
  description: string;
  priceCredits: number;
  pool: BoosterPool;
  artKey: string;
  bonusChanceMultiplier: number;
  legendaryWeightBonus: number;
}

export const BOOSTER_CATALOG: BoosterSku[] = [
  {
    id: "booster-rumpf-standard",
    name: "Rumpf Protocol Pack",
    description: "4C + 2R + 1E/L from Donald Rumpf",
    priceCredits: 100,
    pool: { type: "character", characterId: "donald-rumpf" },
    artKey: "pack-usa",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-pu-standard",
    name: "Bear Doctrine Pack",
    description: "4C + 2R + 1E/L from Vladimir Pu",
    priceCredits: 100,
    pool: { type: "character", characterId: "vladimir-pu" },
    artKey: "pack-russia",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-shi-standard",
    name: "Silk Road Pack",
    description: "4C + 2R + 1E/L from Jin Shi",
    priceCredits: 100,
    pool: { type: "character", characterId: "jin-shi" },
    artKey: "pack-china",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-zelenko-standard",
    name: "Trident Pack",
    description: "4C + 2R + 1E/L from Vlado Zelenko",
    priceCredits: 100,
    pool: { type: "character", characterId: "vlado-zelenko" },
    artKey: "pack-ukraine",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-mix-standard",
    name: "World Order Mix",
    description: "4C + 2R + 1E/L from any leader",
    priceCredits: 120,
    pool: { type: "mix" },
    artKey: "pack-mix",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-mix-premium",
    name: "Summit Pack",
    description: "Same slots, higher bonus & legendary weight (soft currency only)",
    priceCredits: 200,
    pool: { type: "mix" },
    artKey: "pack-summit",
    bonusChanceMultiplier: 1.5,
    legendaryWeightBonus: 0.02,
  },
];

export function getSkuById(id: string): BoosterSku | undefined {
  return BOOSTER_CATALOG.find((s) => s.id === id);
}
