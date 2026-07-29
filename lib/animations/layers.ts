/** Marker type for animation layer registry (TZ v3 architecture). */
export interface AnimationLayer {
  id: string;
  mount?: () => void;
  unmount?: () => void;
}
