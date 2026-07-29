import { getSkuById, type BoosterSkuId } from "@/lib/shop/catalog";
import {
  adjustCredits,
  applyPackOpenToCollection,
  consumePack,
  getIdempotentResult,
  getPack,
  grantPack,
  ownedCountsMap,
  setIdempotentResult,
  writeLedger,
  findUserByIdSafe,
} from "@/lib/shop/models";
import { normalizeUser } from "@/lib/schema";
import { rollPack, type PackOpenResult } from "@/lib/shop/packRoll";

export type ShopErrorCode =
  | "unauthorized"
  | "insufficient_credits"
  | "unknown_sku"
  | "pack_not_found"
  | "pack_already_opened"
  | "craft_invalid"
  | "craft_insufficient"
  | "daily_already_claimed"
  | "rate_limited";

export class ShopError extends Error {
  constructor(
    public code: ShopErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function buyBooster(opts: {
  userId: string;
  skuId: string;
  open: boolean;
  idempotencyKey?: string;
}): Promise<{
  credits: number;
  packInstanceId: string;
  openResult?: PackOpenResult;
}> {
  if (opts.idempotencyKey) {
    const cached = getIdempotentResult<ReturnType<typeof buyBooster> extends Promise<infer R> ? R : never>(
      `buy:${opts.userId}:${opts.idempotencyKey}`,
    );
    if (cached) return cached;
  }

  const sku = getSkuById(opts.skuId);
  if (!sku) throw new ShopError("unknown_sku");

  const user = await findUserByIdSafe(opts.userId);
  if (!user) throw new ShopError("unauthorized");
  const credits = normalizeUser(user).credits;
  if (credits < sku.priceCredits) {
    throw new ShopError("insufficient_credits");
  }

  let newCredits: number;
  try {
    newCredits = await adjustCredits(opts.userId, -sku.priceCredits, {
      requireNonNegative: true,
    });
  } catch {
    throw new ShopError("insufficient_credits");
  }

  await writeLedger(opts.userId, "pack_purchase", -sku.priceCredits, {
    skuId: sku.id,
  });

  const pack = await grantPack(opts.userId, sku.id as BoosterSkuId, "purchase");

  let openResult: PackOpenResult | undefined;
  if (opts.open) {
    openResult = await openPackInternal(opts.userId, pack.packInstanceId);
  }

  const response = {
    credits: openResult
      ? (await findUserByIdSafe(opts.userId).then((u) => normalizeUser(u!).credits))
      : newCredits,
    packInstanceId: pack.packInstanceId,
    openResult,
  };

  if (opts.idempotencyKey) {
    setIdempotentResult(`buy:${opts.userId}:${opts.idempotencyKey}`, response);
  }
  return response;
}

export async function openPack(
  userId: string,
  packInstanceId: string,
  idempotencyKey?: string,
): Promise<PackOpenResult> {
  if (idempotencyKey) {
    const cached = getIdempotentResult<PackOpenResult>(
      `open:${userId}:${idempotencyKey}`,
    );
    if (cached) return cached;
  }
  const result = await openPackInternal(userId, packInstanceId);
  if (idempotencyKey) {
    setIdempotentResult(`open:${userId}:${idempotencyKey}`, result);
  }
  return result;
}

async function openPackInternal(
  userId: string,
  packInstanceId: string,
): Promise<PackOpenResult> {
  const pack = await getPack(userId, packInstanceId);
  if (!pack) throw new ShopError("pack_not_found");

  const sku = getSkuById(pack.skuId);
  if (!sku) throw new ShopError("unknown_sku");

  const consumed = await consumePack(userId, packInstanceId);
  if (!consumed) throw new ShopError("pack_already_opened");

  const user = await findUserByIdSafe(userId);
  const pity = normalizeUser(user!).legendaryPity;
  const owned = await ownedCountsMap(userId);
  const result = rollPack(sku, pity, owned, packInstanceId);
  await applyPackOpenToCollection(userId, result);
  return result;
}
