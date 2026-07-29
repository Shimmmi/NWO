import gsap from "gsap";
import type { CharacterPoseType } from "./types";
import type * as THREE from "three";

/**
 * GSAP pose animations on character mesh (Ace Attorney / fighting-game body language).
 * Idle bob should be paused while a pose runs (caller tracks lastPoseId).
 */
export function playCharacterPose(
  mesh: THREE.Object3D,
  pose: CharacterPoseType,
  facingSign: number,
): gsap.core.Timeline {
  const tl = gsap.timeline();
  const baseScaleX = facingSign;

  switch (pose) {
    case "point":
      tl.to(mesh.scale, {
        x: baseScaleX * 1.15,
        y: 1.15,
        z: 1.15,
        duration: 0.08,
        ease: "power2.out",
      })
        .to(
          mesh.position,
          { z: 0.5, duration: 0.08, ease: "power2.out" },
          "<",
        )
        .to(mesh.position, {
          z: 0,
          duration: 0.35,
          ease: "power2.out",
        })
        .to(
          mesh.scale,
          {
            x: baseScaleX,
            y: 1,
            z: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          "<",
        );
      break;

    case "slam":
      tl.to(mesh.position, {
        y: -0.3,
        duration: 0.06,
        ease: "power4.in",
      }).to(mesh.position, {
        y: 0,
        duration: 0.3,
        ease: "elastic.out(1, 0.45)",
      });
      break;

    case "rise":
      tl.to(mesh.scale, {
        x: baseScaleX * 1.3,
        y: 1.3,
        z: 1.3,
        duration: 0.4,
        ease: "power2.out",
      }).to(mesh.scale, {
        x: baseScaleX,
        y: 1,
        z: 1,
        duration: 0.45,
        ease: "power2.out",
      });
      break;

    case "charge":
      tl.to(mesh.position, {
        x: facingSign * 0.5,
        duration: 0.08,
        ease: "power4.in",
      }).to(mesh.position, {
        x: 0,
        duration: 0.35,
        ease: "power2.out",
      });
      break;

    case "shield":
      tl.to(mesh.scale, {
        x: baseScaleX * 1.4,
        y: 1.25,
        z: 1,
        duration: 0.2,
        ease: "power2.out",
      }).to(mesh.scale, {
        x: baseScaleX,
        y: 1,
        z: 1,
        duration: 0.3,
        ease: "power2.out",
      });
      break;
  }

  return tl;
}
