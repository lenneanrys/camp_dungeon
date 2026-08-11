import { describe, it, expect } from 'vitest'
import { resolveCollisions } from './collision'
import type { AABB } from '../world/prop'

const box = (minX: number, maxX: number, minZ: number, maxZ: number): AABB => ({
  minX,
  maxX,
  minZ,
  maxZ,
})

// A 20-wide box centred on the origin.
const WALL = box(-10, 10, -10, 10)
const R = 5

describe('resolveCollisions', () => {
  it('leaves a free position alone', () => {
    expect(resolveCollisions({ x: 100, y: 100 }, R, [WALL])).toEqual({ x: 100, y: 100 })
  })

  it('leaves a position exactly at arm’s length alone', () => {
    const p = { x: 15.01, y: 0 }
    expect(resolveCollisions(p, R, [WALL]).x).toBeCloseTo(15.01)
  })

  it('pushes out to the nearest edge, never through the box', () => {
    const out = resolveCollisions({ x: 12, y: 0 }, R, [WALL])
    expect(out.x).toBeCloseTo(15) // wall edge + radius
    expect(out.y).toBeCloseTo(0)
  })

  it('pushes out the shortest way, not always the same way', () => {
    expect(resolveCollisions({ x: -12, y: 0 }, R, [WALL]).x).toBeCloseTo(-15)
    expect(resolveCollisions({ x: 0, y: 12 }, R, [WALL]).y).toBeCloseTo(15)
    expect(resolveCollisions({ x: 0, y: -12 }, R, [WALL]).y).toBeCloseTo(-15)
  })

  it('resolves a corner overlap diagonally', () => {
    const out = resolveCollisions({ x: 12, y: 12 }, R, [WALL])
    expect(Math.hypot(out.x - 10, out.y - 10)).toBeCloseTo(R)
  })

  // Walking straight at a wall must not shove the player out the far side,
  // which is what happens if you resolve toward the box centre.
  it('never teleports the player to the other side', () => {
    for (let x = 5.5; x < 10; x += 0.5) {
      expect(resolveCollisions({ x, y: 0 }, R, [WALL]).x).toBeGreaterThan(0)
    }
  })

  it('handles a player standing dead centre without producing NaN', () => {
    const out = resolveCollisions({ x: 0, y: 0 }, R, [WALL])
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.y)).toBe(true)
    expect(Math.hypot(out.x, out.y)).toBeGreaterThan(0)
  })

  // Squeezed into a corridor, the player must end up clear of BOTH walls.
  it('resolves overlaps with two boxes at once', () => {
    const corridor = [box(-40, -10, -40, 40), box(10, 40, -40, 40)]
    for (const startX of [-8, -6, 0, 6, 8]) {
      const out = resolveCollisions({ x: startX, y: 0 }, R, corridor)
      expect(out.x).toBeGreaterThanOrEqual(-5 - 0.001) // clear of the left wall
      expect(out.x).toBeLessThanOrEqual(5 + 0.001) // clear of the right wall
    }
  })

  // Applying resolution to an already-resolved position must change nothing,
  // or the player jitters against every wall.
  it('is idempotent', () => {
    const once = resolveCollisions({ x: 12, y: 3 }, R, [WALL])
    expect(resolveCollisions(once, R, [WALL]).x).toBeCloseTo(once.x)
    expect(resolveCollisions(once, R, [WALL]).y).toBeCloseTo(once.y)
  })

  it('does nothing when there is nothing to hit', () => {
    expect(resolveCollisions({ x: 3, y: 4 }, R, [])).toEqual({ x: 3, y: 4 })
  })
})
