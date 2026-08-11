import type { V3 } from './vec3'
import { add, sub } from './vec3'

export interface Rotation {
  x: number // pitch — swings limbs forward and back
  y: number // yaw   — turns the body
  z: number // roll  — leans sideways
}

export const NO_ROTATION: Rotation = { x: 0, y: 0, z: 0 }

export function rotateX(p: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}

export function rotateY(p: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}

export function rotateZ(p: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }
}

/** Rotate a direction (no pivot). Used for face normals. */
export function rotateDir(v: V3, r: Rotation): V3 {
  let out = v
  if (r.x !== 0) out = rotateX(out, r.x)
  if (r.y !== 0) out = rotateY(out, r.y)
  if (r.z !== 0) out = rotateZ(out, r.z)
  return out
}

/**
 * Euler XYZ about an arbitrary pivot — the ModelPart transform.
 * Distance from the pivot is always preserved, which is what makes a limb
 * rotate at its joint rather than stretch away from it.
 */
export function rotateAbout(p: V3, pivot: V3, r: Rotation): V3 {
  return add(rotateDir(sub(p, pivot), r), pivot)
}
