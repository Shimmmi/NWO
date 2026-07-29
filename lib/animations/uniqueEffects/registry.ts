import { lazy, type ComponentType } from "react";
import type { EffectProps } from "./effectShell";

type LazyEffect = ComponentType<EffectProps>;

export const UNIQUE_EFFECTS: Record<string, LazyEffect> = {
  mushroom_cloud: lazy(() =>
    import("./MushroomCloudEffect").then((m) => ({
      default: m.MushroomCloudEffect,
    })),
  ),
  phoenix_rise: lazy(() =>
    import("./PhoenixRiseEffect").then((m) => ({
      default: m.PhoenixRiseEffect,
    })),
  ),
  screen_blackout: lazy(() =>
    import("./ScreenBlackoutEffect").then((m) => ({
      default: m.ScreenBlackoutEffect,
    })),
  ),
  clock_freeze: lazy(() =>
    import("./ClockFreezeEffect").then((m) => ({
      default: m.ClockFreezeEffect,
    })),
  ),
  bear_roar: lazy(() =>
    import("./BearRoarEffect").then((m) => ({ default: m.BearRoarEffect })),
  ),
  dragon_rise: lazy(() =>
    import("./DragonRiseEffect").then((m) => ({
      default: m.DragonRiseEffect,
    })),
  ),
  dragon_fire: lazy(() =>
    import("./DragonFireEffect").then((m) => ({
      default: m.DragonFireEffect,
    })),
  ),
  great_wall: lazy(() =>
    import("./GreatWallEffect").then((m) => ({ default: m.GreatWallEffect })),
  ),
  ukraine_flag: lazy(() =>
    import("./UkraineFlagEffect").then((m) => ({
      default: m.UkraineFlagEffect,
    })),
  ),
  iron_shield: lazy(() =>
    import("./IronShieldEffect").then((m) => ({
      default: m.IronShieldEffect,
    })),
  ),
  trident_strike: lazy(() =>
    import("./TridentStrikeEffect").then((m) => ({
      default: m.TridentStrikeEffect,
    })),
  ),
  freedom_wave: lazy(() =>
    import("./FreedomWaveEffect").then((m) => ({
      default: m.FreedomWaveEffect,
    })),
  ),
};
