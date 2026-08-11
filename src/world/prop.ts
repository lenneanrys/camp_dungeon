import type { V3 } from '../render3d/vec3'
import type { PartCuboid } from '../render3d/model'

export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface Prop {
  id: string
  /** World position, model units. y = 0 is the ground. */
  pos: V3
  /** Cuboids relative to `pos`, so the same geometry can be baked once. */
  cuboids: PartCuboid[]
  /** Footprint that blocks movement. Omit for pure decoration. */
  collider?: { w: number; d: number }
  /** Contact shadow radius. Omit for no shadow. */
  shadow?: number
  /**
   * Nudge to the sort depth, for props that share a footprint.
   *
   * A roof and the furniture under it stand at the same spot on the ground, so
   * ground-position sorting cannot separate them and the furniture ends up
   * painted over the roof. A bias breaks the tie deliberately.
   */
  depthBias?: number
  /**
   * Never fade this, even when it stands between the player and the camera.
   * A curtain wall turning translucent as you walk past reads as a rendering
   * fault rather than as depth.
   */
  noFade?: boolean
}

export function makeProp(
  id: string,
  pos: V3,
  cuboids: PartCuboid[],
  extra?: {
    collider?: { w: number; d: number }
    shadow?: number
    depthBias?: number
    noFade?: boolean
  },
): Prop {
  return { id, pos, cuboids, ...extra }
}

/** Distance from the prop's origin to its furthest corner, for viewport culling. */
export function boundingRadius(prop: Prop): number {
  let max = 0
  for (const c of prop.cuboids) {
    max = Math.max(
      max,
      Math.hypot(
        Math.abs(c.pos.x) + c.size.w / 2,
        Math.abs(c.pos.y) + c.size.h / 2,
        Math.abs(c.pos.z) + c.size.d / 2,
      ),
    )
  }
  return max
}

/** The prop's collider in world space, or null if it is decoration. */
export function footprint(prop: Prop): AABB | null {
  if (!prop.collider) return null
  return {
    minX: prop.pos.x - prop.collider.w / 2,
    maxX: prop.pos.x + prop.collider.w / 2,
    minZ: prop.pos.z - prop.collider.d / 2,
    maxZ: prop.pos.z + prop.collider.d / 2,
  }
}
