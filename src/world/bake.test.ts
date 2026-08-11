import { describe, it, expect } from 'vitest'
import { bakeProp } from './bake'
import { makeProp } from './prop'
import { PALETTE } from './palette'

const cube = (color: string) => [
  { id: 'body', pos: { x: 0, y: 8, z: 0 }, size: { w: 16, h: 16, d: 16 }, color },
]

const BARREL = makeProp('barrel', { x: 40, y: 0, z: -20 }, cube(PALETTE.timber), { shadow: 8 })

const box = (x: number, y: number, z: number, w: number, h: number, d: number) => ({
  id: 'x',
  pos: { x, y: y + h / 2, z },
  size: { w, h, d },
  color: PALETTE.stone,
})

const ORIGIN = { x: 0, y: 0, z: 0 }

/**
 * Every prop's origin sits on the floor, so sorting by the origin alone makes a
 * 90-unit tower and a 6-unit barrel standing on the same spot sort identically.
 * The sort key has to account for how high the geometry actually is.
 */
describe('height in the sort key', () => {
  it('sorts a tall prop after a short one standing in the same place', () => {
    const tall = bakeProp(makeProp('tall', ORIGIN, [box(0, 0, 0, 20, 90, 20)]))
    const short = bakeProp(makeProp('short', ORIGIN, [box(0, 0, 0, 20, 10, 20)]))
    expect(tall.depthBias!).toBeGreaterThan(short.depthBias!)
  })

  it('leaves a flat prop essentially unbiased', () => {
    expect(bakeProp(makeProp('rug', ORIGIN, [box(0, 0, 0, 30, 1, 30)])).depthBias!).toBeLessThan(2)
  })

  it('adds an explicit bias on top of the height bias', () => {
    const plain = bakeProp(makeProp('a', ORIGIN, [box(0, 0, 0, 10, 40, 10)]))
    const nudged = bakeProp(
      makeProp('b', ORIGIN, [box(0, 0, 0, 10, 40, 10)], { depthBias: 8 }),
    )
    expect(nudged.depthBias! - plain.depthBias!).toBeCloseTo(8)
  })

  it('measures from the geometry, not the prop position', () => {
    const here = bakeProp(makeProp('a', ORIGIN, [box(0, 0, 0, 10, 40, 10)]))
    const far = bakeProp(makeProp('b', { x: 300, y: 0, z: -200 }, [box(0, 0, 0, 10, 40, 10)]))
    expect(far.depthBias!).toBeCloseTo(here.depthBias!)
  })

  it('gives an empty prop no bias', () => {
    expect(bakeProp(makeProp('nothing', ORIGIN, [])).depthBias ?? 0).toBe(0)
  })
})

describe('bakeProp', () => {
  it('keeps only the faces the camera can see', () => {
    // One axis-aligned cube shows two faces from this camera; six would mean
    // the normals are inverted.
    expect(bakeProp(BARREL).faces).toHaveLength(2)
  })

  it('is pure — baking twice gives identical geometry', () => {
    expect(bakeProp(BARREL)).toEqual(bakeProp(BARREL))
  })

  it('bakes faces already sorted back to front', () => {
    const { faces } = bakeProp(BARREL)
    for (let i = 1; i < faces.length; i++) {
      expect(faces[i]!.depth).toBeGreaterThanOrEqual(faces[i - 1]!.depth)
    }
  })

  it('gives every face four screen points', () => {
    for (const f of bakeProp(BARREL).faces) {
      expect(f.points).toHaveLength(4)
      for (const p of f.points) {
        expect(Number.isFinite(p.sx)).toBe(true)
        expect(Number.isFinite(p.sy)).toBe(true)
      }
    }
  })

  // Geometry is baked relative to the prop's own origin so the same bake stays
  // valid wherever the prop stands, and moving the camera costs one translate.
  it('bakes relative to the prop origin, not its world position', () => {
    const here = bakeProp(BARREL)
    const far = bakeProp(makeProp('barrel', { x: 900, y: 0, z: 700 }, cube(PALETTE.timber)))
    expect(far.faces.map((f) => f.points)).toEqual(here.faces.map((f) => f.points))
  })

  it('carries the world position through for the renderer', () => {
    expect(bakeProp(BARREL).pos).toEqual({ x: 40, y: 0, z: -20 })
  })

  it('measures a bounding radius that covers the geometry', () => {
    expect(bakeProp(BARREL).radius).toBeGreaterThan(8)
  })

  it('carries the shadow radius through', () => {
    expect(bakeProp(BARREL).shadow).toBe(8)
  })

  it('shades the top brighter than the front', () => {
    const { faces } = bakeProp(BARREL)
    const top = faces.find((f) => f.normal.y > 0.9)!
    const front = faces.find((f) => f.normal.z > 0.9)!
    expect(top.lit).toBeGreaterThan(front.lit)
  })

  it('handles an empty prop without crashing', () => {
    const empty = bakeProp(makeProp('nothing', { x: 0, y: 0, z: 0 }, []))
    expect(empty.faces).toHaveLength(0)
    expect(empty.radius).toBe(0)
  })
})
