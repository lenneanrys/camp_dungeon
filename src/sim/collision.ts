import type { Vec2 } from './vec2'
import type { AABB } from '../world/prop'

/**
 * Circle-versus-box push-out.
 *
 * The player is resolved to the NEAREST edge rather than pushed away from the
 * box centre. Pushing from the centre shoves anyone who gets deep enough out
 * through the far side, which reads as walking through walls.
 *
 * World x/z map to Vec2 x/y here — the sim is top-down, the renderer is not.
 */
export function resolveCollisions(pos: Vec2, radius: number, boxes: AABB[]): Vec2 {
  let { x, y } = pos

  for (const b of boxes) {
    // Closest point on the box to the circle centre.
    const cx = Math.max(b.minX, Math.min(x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(y, b.maxZ))

    const dx = x - cx
    const dz = y - cz
    const distSq = dx * dx + dz * dz

    if (distSq >= radius * radius) continue // clear of this box

    if (distSq > 1e-9) {
      // Outside the box but overlapping: push straight out along the contact.
      const dist = Math.sqrt(distSq)
      x = cx + (dx / dist) * radius
      y = cz + (dz / dist) * radius
      continue
    }

    // Centre is inside the box. Leave by whichever wall is closest.
    const toLeft = x - b.minX
    const toRight = b.maxX - x
    const toBack = y - b.minZ
    const toFront = b.maxZ - y
    const least = Math.min(toLeft, toRight, toBack, toFront)

    if (least === toLeft) x = b.minX - radius
    else if (least === toRight) x = b.maxX + radius
    else if (least === toBack) y = b.minZ - radius
    else y = b.maxZ + radius
  }

  return { x, y }
}
