import { describe, it, expect } from 'vitest'
import { makeProp, boundingRadius, footprint } from './prop'
import { PALETTE } from './palette'

const barrel = makeProp('barrel', { x: 0, y: 0, z: 0 }, [
  { id: 'body', pos: { x: 0, y: 6, z: 0 }, size: { w: 10, h: 12, d: 10 }, color: PALETTE.timber },
  { id: 'lid', pos: { x: 0, y: 12.5, z: 0 }, size: { w: 10.5, h: 1, d: 10.5 }, color: PALETTE.iron },
])

describe('props', () => {
  it('keeps cuboid positions relative to the prop origin', () => {
    // Placing the prop elsewhere must not move its cuboids — the offset is
    // applied at render time, so baking stays valid wherever it stands.
    const moved = makeProp('barrel', { x: 500, y: 0, z: -200 }, barrel.cuboids)
    expect(moved.cuboids[0]!.pos).toEqual(barrel.cuboids[0]!.pos)
  })

  it('sits on the ground by default', () => {
    for (const c of barrel.cuboids) {
      expect(c.pos.y - c.size.h / 2).toBeGreaterThanOrEqual(-0.001)
    }
  })

  it('is decoration unless given a collider', () => {
    expect(barrel.collider).toBeUndefined()
  })

  it('accepts a collider and a shadow', () => {
    const solid = makeProp('crate', { x: 0, y: 0, z: 0 }, barrel.cuboids, {
      collider: { w: 10, d: 10 },
      shadow: 7,
    })
    expect(solid.collider).toEqual({ w: 10, d: 10 })
    expect(solid.shadow).toBe(7)
  })
})

describe('boundingRadius', () => {
  it('covers every corner of every cuboid', () => {
    const r = boundingRadius(barrel)
    for (const c of barrel.cuboids) {
      const far = Math.hypot(
        Math.abs(c.pos.x) + c.size.w / 2,
        Math.abs(c.pos.y) + c.size.h / 2,
        Math.abs(c.pos.z) + c.size.d / 2,
      )
      expect(r).toBeGreaterThanOrEqual(far - 0.001)
    }
  })

  it('is zero for an empty prop', () => {
    expect(boundingRadius(makeProp('nothing', { x: 0, y: 0, z: 0 }, []))).toBe(0)
  })
})

describe('footprint', () => {
  it('returns a world-space box for a prop with a collider', () => {
    const p = makeProp('crate', { x: 100, y: 0, z: 40 }, barrel.cuboids, {
      collider: { w: 10, d: 8 },
    })
    expect(footprint(p)).toEqual({ minX: 95, maxX: 105, minZ: 36, maxZ: 44 })
  })

  it('returns null for decoration', () => {
    expect(footprint(barrel)).toBeNull()
  })
})
