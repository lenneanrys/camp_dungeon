import { describe, it, expect } from 'vitest'
import { jungleExplorer, buildParts, PART_IDS } from './model'
import type { PartId } from './model'

const PARTS = buildParts(jungleExplorer)
const partOf = (id: PartId) => PARTS.find((p) => p.id === id)!
const allCuboids = () => PARTS.flatMap((p) => p.cuboids)
const cuboid = (id: string) => allCuboids().find((c) => c.id === id)!

describe('model parts', () => {
  it('has every body part', () => {
    for (const id of PART_IDS) expect(PARTS.some((p) => p.id === id)).toBe(true)
  })

  it('starts with no rotation anywhere', () => {
    for (const p of PARTS) expect(p.rotation).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('puts joints where joints belong', () => {
    expect(partOf('legL').pivot).toEqual({ x: -2, y: 12, z: 0 })
    expect(partOf('legR').pivot).toEqual({ x: 2, y: 12, z: 0 })
    expect(partOf('armL').pivot).toEqual({ x: -6, y: 24, z: 0 })
    expect(partOf('armR').pivot).toEqual({ x: 6, y: 24, z: 0 })
    expect(partOf('head').pivot).toEqual({ x: 0, y: 24, z: 0 })
  })

  it('hangs each limb below its joint', () => {
    for (const id of ['legL', 'legR', 'armL', 'armR'] as PartId[]) {
      const part = partOf(id)
      for (const c of part.cuboids) expect(c.pos.y).toBeLessThan(part.pivot.y)
    }
  })

  // Boots are cuboids INSIDE the leg part, so they rotate with the leg. As
  // separate top-level boxes they slid up the shin during the walk.
  it('parents the boots to the legs', () => {
    expect(partOf('legL').cuboids.some((c) => c.id === 'bootL')).toBe(true)
    expect(partOf('legR').cuboids.some((c) => c.id === 'bootR')).toBe(true)
  })

  it('dresses the explorer', () => {
    for (const id of ['vest', 'hatBrim', 'hatCrown', 'eyeL', 'eyeR', 'hair']) {
      expect(cuboid(id)).toBeDefined()
    }
  })

  it('keeps the head pieces on the head', () => {
    for (const id of ['hair', 'hatBrim', 'hatCrown', 'eyeL', 'eyeR']) {
      expect(partOf('head').cuboids.some((c) => c.id === id)).toBe(true)
    }
  })

  // Coplanar faces z-fight. Every layered piece must stand proud of what it covers.
  it('stands the eyes proud of the face', () => {
    const head = cuboid('head')
    const eye = cuboid('eyeL')
    expect(eye.pos.z - eye.size.d / 2).toBeGreaterThanOrEqual(head.pos.z + head.size.d / 2)
  })

  it('stands the vest proud of the shirt', () => {
    expect(cuboid('vest').size.w).toBeGreaterThan(cuboid('torso').size.w)
    expect(cuboid('vest').size.d).toBeGreaterThan(cuboid('torso').size.d)
  })

  it('stands on the ground', () => {
    for (const c of allCuboids()) {
      expect(c.pos.y - c.size.h / 2).toBeGreaterThanOrEqual(-0.001)
    }
  })

  it('uses Minecraft proportions', () => {
    expect(cuboid('head').size).toEqual({ w: 8, h: 8, d: 8 })
    expect(cuboid('torso').size).toEqual({ w: 8, h: 12, d: 4 })
    expect(cuboid('armL').size).toEqual({ w: 4, h: 12, d: 4 })
    expect(cuboid('legL').size).toEqual({ w: 4, h: 12, d: 4 })
  })

  it('is recolourable without changing geometry', () => {
    const custom = {
      ...jungleExplorer,
      colors: { ...jungleExplorer.colors, vest: '#ff0000' },
    }
    const recoloured = buildParts(custom)
      .flatMap((p) => p.cuboids)
      .find((c) => c.id === 'vest')!
    expect(recoloured.color).toBe('#ff0000')
    expect(recoloured.pos).toEqual(cuboid('vest').pos)
    expect(recoloured.size).toEqual(cuboid('vest').size)
  })
})
