import type { V3 } from './vec3'

export interface Cuboid {
  pos: V3 // centre
  size: { w: number; h: number; d: number }
  color: string
  /**
   * A decal is painted on a surface rather than being a solid: only its front
   * face exists. Eyes were solid boxes made "proud" of the head, so turning
   * around presented their back face to the camera and painted a face on the
   * back of his head. As a decal, facing away culls them by construction.
   */
  decal?: boolean
}

export interface Face {
  corners: V3[]
  normal: V3
  color: string
}

/**
 * Corner order is a fixed 3-bit code: bit 0 = +x, bit 1 = +y, bit 2 = +z.
 * Faces index into this, so the ordering must not change.
 */
export function corners(c: Cuboid): V3[] {
  const hx = c.size.w / 2
  const hy = c.size.h / 2
  const hz = c.size.d / 2
  const out: V3[] = []
  for (let i = 0; i < 8; i++) {
    out.push({
      x: c.pos.x + (i & 1 ? hx : -hx),
      y: c.pos.y + (i & 2 ? hy : -hy),
      z: c.pos.z + (i & 4 ? hz : -hz),
    })
  }
  return out
}

/**
 * Each face lists its corners counter-clockwise when seen from outside, so a
 * cross product of consecutive edges agrees with the stored normal.
 */
export interface FaceDef {
  indices: number[]
  normal: V3
}

export const FACE_DEFS: FaceDef[] = [
  { indices: [3, 7, 5, 1], normal: { x: 1, y: 0, z: 0 } }, // +x
  { indices: [6, 2, 0, 4], normal: { x: -1, y: 0, z: 0 } }, // -x
  { indices: [6, 7, 3, 2], normal: { x: 0, y: 1, z: 0 } }, // +y (top)
  { indices: [0, 1, 5, 4], normal: { x: 0, y: -1, z: 0 } }, // -y (bottom)
  { indices: [7, 6, 4, 5], normal: { x: 0, y: 0, z: 1 } }, // +z (front)
  { indices: [2, 3, 1, 0], normal: { x: 0, y: 0, z: -1 } }, // -z (back)
]

/** Just the front face for a decal; all six for a solid. */
export const faceDefsFor = (c: Cuboid): FaceDef[] =>
  c.decal ? [FACE_DEFS[4]!] : FACE_DEFS

export function faces(c: Cuboid): Face[] {
  const pts = corners(c)
  return faceDefsFor(c).map((def) => ({
    corners: def.indices.map((i) => pts[i]!),
    normal: def.normal,
    color: c.color,
  }))
}
