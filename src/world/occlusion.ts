import type { SceneEntry } from './worldScene'
import type { Screen } from '../render3d/camera'

/** How much of an occluding building still shows. */
export const OCCLUDED_ALPHA = 0.28

/** Ray-casting point-in-polygon, for a single projected face. */
export function pointInFace(px: number, py: number, points: Screen[]): boolean {
  let inside = false
  for (let i = 0, k = points.length - 1; i < points.length; k = i++) {
    const a = points[i]!
    const b = points[k]!
    const straddles = a.sy > py !== b.sy > py
    if (!straddles) continue
    const crossX = ((b.sx - a.sx) * (py - a.sy)) / (b.sy - a.sy) + a.sx
    if (px < crossX) inside = !inside
  }
  return inside
}

/**
 * Which props actually stand between the player and the camera.
 *
 * Two rules, both learned the hard way:
 *
 * 1. Coverage is tested against the prop's real faces, not its bounding box. A
 *    building's box is a tall rectangle that swallows anyone standing beside
 *    it, so a box test faded things you were merely walking past rather than
 *    standing behind.
 * 2. Only props fade. Entities — the player, NPCs, straw dummies — are never
 *    made transparent; a translucent character reads as a bug, not as depth.
 */
/** Does this entry's geometry cover the given screen point? */
function covers(entry: SceneEntry, sx: number, sy: number): boolean {
  for (const face of entry.faces) {
    const points = face.points.map((p) => ({
      sx: p.sx + entry.screen.sx,
      sy: p.sy + entry.screen.sy,
    }))
    if (pointInFace(sx, sy, points)) return true
  }
  return false
}

/**
 * Is the player hidden behind scenery that will NOT fade?
 *
 * Walls are deliberately solid — a curtain wall turning translucent reads as a
 * rendering fault. But solid scenery still swallows the player when he walks up
 * against it, so the caller draws his silhouette on top instead.
 */
export function hiddenBySolid(
  entries: SceneEntry[],
  player: { screen: Screen; depth: number },
): boolean {
  for (const entry of entries) {
    if (entry.entity) continue // characters never hide the player
    if (entry.fadeable) continue // this one fades, so he stays visible anyway
    if (entry.groundDepth <= player.depth) continue // behind him
    if (covers(entry, player.screen.sx, player.screen.sy)) return true
  }
  return false
}

export function occluders(
  entries: SceneEntry[],
  player: { screen: Screen; depth: number },
): Set<string> {
  const found = new Set<string>()

  for (const entry of entries) {
    if (!entry.fadeable) continue // never fade an entity
    // Compare where things STAND, not where their geometry averages out. A tall
    // wall just behind the player has a high sort depth from its height bias,
    // and comparing that made walls fade as you walked up to them from outside.
    if (entry.groundDepth <= player.depth) continue

    if (covers(entry, player.screen.sx, player.screen.sy)) found.add(entry.id)
  }

  return found
}
