import type { UserRecord } from "@/lib/schema";
import { ECONOMY } from "@/lib/shop/economy";

/** Default economy fields for newly created users (starter applied separately). */
export function economyDefaults(): Pick<
  UserRecord,
  "credits" | "legendaryPity" | "starterGranted"
> {
  return {
    credits: 0,
    legendaryPity: 0,
    starterGranted: false,
  };
}

export { ECONOMY };
