import type { V3 } from './vec3'
import { dot, normalize } from './vec3'
import type { Rotation } from './rotation'
import { rotateAbout, rotateDir, NO_ROTATION } from './rotation'
import { corners, faceDefsFor } from './cuboid'
import type { PartId, ModelPart } from './model'
import { project, depthOf, TO_CAMERA } from './camera'
import type { Screen } from './camera'

export interface DrawFace {
  id: string
  points: Screen[]
  depth: number
  normal: V3
  color: string
  /** Lambert term. Zero would mean culled, so every emitted face is > 0. */
  lit: number
}

export type Pose = Partial<Record<PartId, Rotation>>

/** Fixed key light, up and slightly front-left. */
const LIGHT = normalize({ x: -0.35, y: 1, z: 0.45 })
const AMBIENT = 0.62
const DIFFUSE = 0.38

const rotationOf = (part: ModelPart, pose: Pose): Rotation => pose[part.id] ?? part.rotation

/**
 * The part tree never changes, only its angles do — so resolve each part's
 * ancestor chain once and cache it. Walking it with `find()` and allocating a
 * cycle-guard Set per corner per frame was pure GC churn for an answer that is
 * always the same.
 */
const CHAIN_CACHE = new WeakMap<ModelPart[], Map<PartId, ModelPart[]>>()

function chainFor(part: ModelPart, parts: ModelPart[]): ModelPart[] {
  let byId = CHAIN_CACHE.get(parts)
  if (!byId) {
    byId = new Map()
    CHAIN_CACHE.set(parts, byId)
  }
  const cached = byId.get(part.id)
  if (cached) return cached

  const chain: ModelPart[] = [part]
  const guard = new Set<PartId>([part.id])
  let current = part
  while (current.parent) {
    const parent = parts.find((q) => q.id === current.parent)
    if (!parent || guard.has(parent.id)) break // malformed tree; fail safe
    guard.add(parent.id)
    chain.push(parent)
    current = parent
  }

  byId.set(part.id, chain)
  return chain
}

/**
 * Apply a part's rotation and every ancestor's, innermost first. This is what
 * makes curling the torso carry the head and arms with it.
 */
function applyChain(p: V3, part: ModelPart, parts: ModelPart[], pose: Pose): V3 {
  const chain = chainFor(part, parts)
  let out = p
  for (const link of chain) out = rotateAbout(out, link.pivot, rotationOf(link, pose))
  return out
}

function applyChainDir(v: V3, part: ModelPart, parts: ModelPart[], pose: Pose): V3 {
  const chain = chainFor(part, parts)
  let out = v
  for (const link of chain) out = rotateDir(out, rotationOf(link, pose))
  return out
}

/**
 * Push an arbitrary point through one part's joint chain. Useful for asking
 * where a joint itself ended up — a shoulder moves when the torso curls.
 */
export function transformViaPart(
  parts: ModelPart[],
  pose: Pose,
  partId: PartId,
  point: V3,
): V3 {
  const part = parts.find((p) => p.id === partId)
  if (!part) throw new Error(`no part ${partId}`)
  return applyChain(point, part, parts, pose)
}

/** Every cuboid centre after joint rotations, before the whole-body rotation. */
export function posedCentres(parts: ModelPart[], pose: Pose): Map<string, V3> {
  const out = new Map<string, V3>()
  for (const part of parts) {
    for (const c of part.cuboids) {
      out.set(c.id, applyChain(c.pos, part, parts, pose))
    }
  }
  return out
}

/**
 * The axis the body turns about — the centroid of wherever the body actually
 * is, not a fixed point. A hardcoded pivot works while standing but is nowhere
 * near the middle of a tucked body, which made the roll swing the character
 * around a point outside himself instead of rolling him.
 */
export function bodyCentre(parts: ModelPart[], pose: Pose): V3 {
  const centres = [...posedCentres(parts, pose).values()]
  if (centres.length === 0) return { x: 0, y: 0, z: 0 }
  const sum = centres.reduce((a, c) => ({ x: a.x + c.x, y: a.y + c.y, z: a.z + c.z }))
  return { x: sum.x / centres.length, y: sum.y / centres.length, z: sum.z / centres.length }
}

/** Final position of one cuboid centre, including the whole-body rotation. */
export function finalCentre(parts: ModelPart[], pose: Pose, cuboidId: string): V3 {
  const local = posedCentres(parts, pose).get(cuboidId)
  if (!local) throw new Error(`no cuboid ${cuboidId}`)
  return rotateAbout(local, bodyCentre(parts, pose), pose.root ?? NO_ROTATION)
}

/**
 * Transform every cuboid into camera space, drop the faces pointing away,
 * shade the rest by their normal, and sort the whole scene back to front.
 *
 * Sorting individual faces rather than whole boxes is what removes the need for
 * draw layers and depth anchors. Correct geometry sorts itself.
 */
export function buildScene(parts: ModelPart[], pose: Pose, offset?: V3): DrawFace[] {
  const root = pose.root ?? NO_ROTATION
  const centre = bodyCentre(parts, pose)
  const shift = offset ?? { x: 0, y: 0, z: 0 }
  const out: DrawFace[] = []

  for (const part of parts) {
    for (const cuboid of part.cuboids) {
      // Transform the 8 corners ONCE. Each corner is shared by three faces, so
      // transforming per face did the same work up to three times over.
      const pts = corners(cuboid).map((c) => {
        const posed = rotateAbout(applyChain(c, part, parts, pose), centre, root)
        return { x: posed.x + shift.x, y: posed.y + shift.y, z: posed.z + shift.z }
      })
      const screen = pts.map(project)
      const depths = pts.map(depthOf)

      for (const def of faceDefsFor(cuboid)) {
        const normal = rotateDir(applyChainDir(def.normal, part, parts, pose), root)
        if (dot(normal, TO_CAMERA) <= 1e-9) continue // pointing away

        out.push({
          id: cuboid.id,
          points: def.indices.map((i) => screen[i]!),
          // Centroid depth. Sorting on the nearest corner instead lets a tall
          // face win on its top corner alone, which buried the eyes behind the
          // front of the head they sit on.
          depth: def.indices.reduce((s, i) => s + depths[i]!, 0) / def.indices.length,
          normal,
          color: cuboid.color,
          lit: AMBIENT + DIFFUSE * Math.max(0, dot(normal, LIGHT)),
        })
      }
    }
  }

  return out.sort((a, b) => a.depth - b.depth)
}
