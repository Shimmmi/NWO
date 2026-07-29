import assert from "node:assert/strict";
import { getSkuById } from "../lib/shop/catalog";
import { eliteLegendaryChance, rollPack, PACK_ODDS } from "../lib/shop/packRoll";

const sku = getSkuById("booster-mix-standard")!;
assert.ok(sku);

for (let i = 0; i < 50; i++) {
  const result = rollPack(sku, 0, new Map(), `pack_test_${i}`);
  const commons = result.cards.filter((c) =>
    ["c1", "c2", "c3", "c4"].includes(c.slot),
  );
  const rares = result.cards.filter((c) => ["r1", "r2"].includes(c.slot));
  const elite = result.cards.filter((c) => c.slot === "elite");
  assert.equal(commons.length, 4);
  assert.equal(rares.length, 2);
  assert.equal(elite.length, 1);
  assert.ok(elite[0]!.rarity === "epic" || elite[0]!.rarity === "legendary");
  for (const c of commons) assert.equal(c.rarity, "common");
  for (const c of rares) assert.equal(c.rarity, "rare");
}

assert.equal(eliteLegendaryChance(PACK_ODDS.PITY_HARD, 0), 1);
assert.ok(eliteLegendaryChance(0, 0) < 0.1);

const forced = rollPack(sku, PACK_ODDS.PITY_HARD, new Map(), "pack_pity");
assert.equal(
  forced.cards.find((c) => c.slot === "elite")!.rarity,
  "legendary",
);
assert.equal(forced.pityAfter, 0);

console.log("packRoll ok");
