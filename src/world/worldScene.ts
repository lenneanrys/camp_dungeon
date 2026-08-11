import type { BakedProp } from './bake'
import type { V3 } from '../render3d/vec3'
import type { DrawFace } from '../render3d/scene'
import type { Screen } from '../render3d/camera'
import { project, depthOf, SCALE, PITCH } from '../render3d/camera'

/** A humanoid's centre of mass above the feet, in model units. */
export const HUMANOID_CENTRE = 18

export interface Actor {
  id: string
  faces: DrawFace[]
  /** Position of the FEET. */
  pos: V3
  radius: number
  shadow?: number
  /**
   * Height of the body's centre above its feet.
   *
   * Props sort by their geometry's centroid, so characters must too — sorting
   * a character by his feet against a prop sorted by its middle biases every
   * wall in front of anyone standing before it.
   */
  centreY?: number
}

export interface SceneEntry {
  id: string
  /** Pre-sorted, camera-relative geometry. Translate by `screen` to draw. */
  faces: DrawFace[]
  screen: Screen
  depth: number
  /**
   * Depth of the object's footprint on the floor, with no height bias.
   *
   * A contact shadow is a flat decal lying on the ground, so it must sort by
   * where it lies — not by where its owner's geometry happens to be. Drawing it
   * at the owner's depth painted house shadows over their own front walls,
   * because a roof deliberately sorts last.
   */
  groundDepth: number
  shadow?: number
  /**
   * Whether this may be faded when it hides the player. True for scenery,
   * false for anything alive — a see-through character reads as a bug.
   */
  fadeable: boolean
  /** True for anything alive. Entities never fade and never hide the player. */
  entity: boolean
}

/**
 * Pool everything visible and order it back to front.
 *
 * Sorting happens per OBJECT, using its position on the ground, rather than per
 * face. For things standing on a floor that is exactly right, and it is far
 * cheaper: one translate per object instead of transforming every corner every
 * frame. The constraint it buys is that props must stay small and must not
 * interpenetrate — a long fence is many short props, not one long one.
 */
export function collectScene(
  props: BakedProp[],
  actors: Actor[],
  camera: V3,
  viewport: { w: number; h: number },
): SceneEntry[] {
  const entries: SceneEntry[] = []

  const consider = (
    id: string,
    pos: V3,
    faces: DrawFace[],
    radius: number,
    fadeable: boolean,
    entity: boolean,
    shadow?: number,
    depthBias = 0,
  ): void => {
    const offset = { x: pos.x - camera.x, y: pos.y - camera.y, z: pos.z - camera.z }
    const screen = project(offset)

    // Viewport cull with the prop's bounding circle, in screen pixels.
    const margin = radius * SCALE
    if (Math.abs(screen.sx) > viewport.w / 2 + margin) return
    if (Math.abs(screen.sy) > viewport.h / 2 + margin) return

    entries.push({
      id,
      faces,
      screen,
      depth: depthOf(offset) + depthBias,
      groundDepth: depthOf({ x: offset.x, y: 0, z: offset.z }),
      fadeable,
      entity,
      ...(shadow !== undefined ? { shadow } : {}),
    })
  }

  for (const p of props) {
    consider(p.id, p.pos, p.faces, p.radius, !p.noFade, false, p.shadow, p.depthBias)
  }
  for (const a of actors) {
    const centre = (a.centreY ?? HUMANOID_CENTRE) * Math.sin(PITCH)
    consider(a.id, a.pos, a.faces, a.radius, false, true, a.shadow, centre)
  }

  return entries.sort((a, b) => a.depth - b.depth)
}
