import type { Prop } from './prop'
import { boundingRadius } from './prop'
import type { V3 } from '../render3d/vec3'
import { dot, normalize } from '../render3d/vec3'
import { faces } from '../render3d/cuboid'
import { project, depthOf, TO_CAMERA, PITCH } from '../render3d/camera'
import type { DrawFace, Pose } from '../render3d/scene'
import { buildScene } from '../render3d/scene'
import type { ModelPart } from '../render3d/model'

/**
 * Static props never rotate, so their projected shape never changes — only
 * where they sit on screen. Baking culls, shades and projects once at load;
 * per frame the renderer does a single translate.
 *
 * Both `project` and `depthOf` are linear, so a face baked relative to the
 * prop's origin stays correct at any world position and any camera position.
 */

// Matches the character renderer so props and people are lit alike.
const LIGHT = normalize({ x: -0.35, y: 1, z: 0.45 })
const AMBIENT = 0.62
const DIFFUSE = 0.38

export interface BakedProp {
  id: string
  pos: V3
  faces: DrawFace[]
  radius: number
  shadow?: number
  depthBias?: number
  noFade?: boolean
}

/**
 * Bake a prop built from rotatable parts, using a fixed pose.
 *
 * Plain props are axis-aligned, which is fine for walls and barrels but cannot
 * express a signpost arm pointing north-east. Running the character renderer
 * once at load gives arbitrary rotation for the same per-frame cost.
 */
export function bakeParts(
  id: string,
  pos: V3,
  parts: ModelPart[],
  pose: Pose,
  extra?: { collider?: { w: number; d: number }; shadow?: number },
): BakedProp {
  const faces = buildScene(parts, pose)
  let radius = 0
  for (const part of parts) {
    for (const c of part.cuboids) {
      radius = Math.max(
        radius,
        Math.hypot(
          Math.abs(c.pos.x) + c.size.w / 2,
          Math.abs(c.pos.y) + c.size.h / 2,
          Math.abs(c.pos.z) + c.size.d / 2,
        ),
      )
    }
  }
  return {
    id,
    pos,
    faces,
    radius,
    ...(extra?.shadow !== undefined ? { shadow: extra.shadow } : {}),
  }
}

/**
 * How much of the sort key comes from a prop being TALL.
 *
 * Every prop's origin sits on the floor, so sorting by the origin alone makes a
 * 90-unit tower and a 6-unit barrel standing on the same spot sort identically —
 * and anything whose geometry lives high above its base sorts far too early.
 * The camera looks down at 45 degrees, so height and depth contribute equally;
 * sorting by the geometry's centre rather than its base is simply correct.
 */
function heightBias(prop: Prop): number {
  if (prop.cuboids.length === 0) return 0
  const mean = prop.cuboids.reduce((sum, c) => sum + c.pos.y, 0) / prop.cuboids.length
  return mean * Math.sin(PITCH)
}

export function bakeProp(prop: Prop): BakedProp {
  const out: DrawFace[] = []

  for (const cuboid of prop.cuboids) {
    for (const face of faces(cuboid)) {
      // No rotation, so the raw normal is the final one.
      if (dot(face.normal, TO_CAMERA) <= 1e-9) continue

      out.push({
        id: cuboid.id,
        points: face.corners.map(project),
        depth: face.corners.reduce((s, c) => s + depthOf(c), 0) / face.corners.length,
        normal: face.normal,
        color: cuboid.color,
        lit: AMBIENT + DIFFUSE * Math.max(0, dot(face.normal, LIGHT)),
      })
    }
  }

  out.sort((a, b) => a.depth - b.depth)

  return {
    id: prop.id,
    pos: prop.pos,
    faces: out,
    radius: boundingRadius(prop),
    ...(prop.shadow !== undefined ? { shadow: prop.shadow } : {}),
    depthBias: heightBias(prop) + (prop.depthBias ?? 0),
    ...(prop.noFade ? { noFade: true } : {}),
  }
}
