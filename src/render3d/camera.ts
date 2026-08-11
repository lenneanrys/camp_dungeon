import type { V3 } from './vec3'

/**
 * A real orthographic three-quarter camera, elevated 45 degrees above the
 * horizon and looking along -z.
 *
 * This replaces an ad-hoc pair of squash factors that no actual camera could
 * produce — which is why "forward" never looked consistent between the ground
 * and the character. The ground must be drawn through this same camera.
 */
export const PITCH = Math.PI / 4
const COS = Math.cos(PITCH)
const SIN = Math.sin(PITCH)

/** Screen pixels per model unit. The explorer is ~36 units tall. */
export const SCALE = 2.4

export interface Screen {
  sx: number
  sy: number
}

export function project(p: V3): Screen {
  return {
    sx: p.x * SCALE,
    // Screen y grows downward: height climbs the screen, depth descends it.
    sy: (-p.y * COS + p.z * SIN) * SCALE,
  }
}

/** Distance toward the camera. Larger is nearer, so faces sort ascending. */
export const depthOf = (p: V3): number => p.y * SIN + p.z * COS

/** Unit vector from the scene toward the camera. Used for backface culling. */
export const TO_CAMERA: V3 = { x: 0, y: SIN, z: COS }
