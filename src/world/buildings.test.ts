import { describe, it, expect } from 'vitest'
import {
  b,
  decal,
  house,
  gableRoof,
  barrel,
  well,
  stall,
  tree,
  lamp,
  anvil,
  forge,
  cauldron,
  bottleShelf,
  runeStones,
  bookStand,
  bench,
  banner,
  crate,
  fencePost,
  herbBox,
  sign,
} from './buildings'
import { PALETTE } from './palette'
import type { PartCuboid } from '../render3d/model'

const SPEC = {
  w: 60,
  d: 48,
  wallH: 40,
  wall: PALETTE.plaster,
  trim: PALETTE.timber,
  roof: PALETTE.roofTile,
}

const ALL: Record<string, PartCuboid[]> = {
  house: house(SPEC, 'h'),
  barrel: barrel(),
  crate: crate(),
  well: well(),
  stall: stall(),
  tree: tree(),
  lamp: lamp(),
  anvil: anvil(),
  forge: forge(),
  cauldron: cauldron(),
  bottleShelf: bottleShelf(),
  runeStones: runeStones(),
  bookStand: bookStand(),
  bench: bench(),
  banner: banner(PALETTE.cloth),
  fencePost: fencePost(),
  herbBox: herbBox(),
  sign: sign(PALETTE.iron),
}

describe('b()', () => {
  // Every piece is authored by its FOOTPRINT, not its centre, so nothing can
  // accidentally be sunk halfway into the ground.
  it('places a block sitting on the y it is given', () => {
    const block = b('x', 0, 10, 0, 4, 6, 4, '#ffffff')
    expect(block.pos.y).toBe(13) // centre = base + half height
    expect(block.pos.y - block.size.h / 2).toBe(10)
  })

  it('makes decals single-faced', () => {
    expect(decal('d', 0, 0, 0, 4, 4, '#ffffff').decal).toBe(true)
  })
})

describe('every kit piece', () => {
  for (const [name, cuboids] of Object.entries(ALL)) {
    it(`${name} sits on or above the ground`, () => {
      for (const c of cuboids) {
        expect(c.pos.y - c.size.h / 2, `${name}/${c.id}`).toBeGreaterThanOrEqual(-0.001)
      }
    })

    it(`${name} has positive dimensions everywhere`, () => {
      for (const c of cuboids) {
        expect(c.size.w, `${name}/${c.id}`).toBeGreaterThan(0)
        expect(c.size.h, `${name}/${c.id}`).toBeGreaterThan(0)
        expect(c.size.d, `${name}/${c.id}`).toBeGreaterThan(0)
      }
    })

    it(`${name} gives every cuboid a unique id`, () => {
      const ids = cuboids.map((c) => c.id)
      expect(new Set(ids).size, `${name} has duplicate ids`).toBe(ids.length)
    })

    it(`${name} is not empty`, () => {
      expect(cuboids.length).toBeGreaterThan(0)
    })
  }
})

describe('house', () => {
  it('puts the roof above the walls', () => {
    const walls = house(SPEC, 'h').find((c) => c.id === 'hwalls')!
    const roof = house(SPEC, 'h').filter((c) => c.id.startsWith('hroof'))
    const wallTop = walls.pos.y + walls.size.h / 2
    for (const r of roof) {
      expect(r.pos.y - r.size.h / 2).toBeGreaterThanOrEqual(wallTop - 0.001)
    }
  })

  it('puts the door on the front, reaching the ground', () => {
    const door = house(SPEC, 'h').find((c) => c.id === 'hdoor')!
    expect(door.pos.z).toBeGreaterThan(0) // front face is +z
    expect(door.pos.y - door.size.h / 2).toBeCloseTo(0)
  })

  it('narrows each roof course as it rises, forming a pitch', () => {
    const roof = gableRoof(SPEC, 'h')
    for (let i = 1; i < roof.length; i++) {
      expect(roof[i]!.size.d).toBeLessThan(roof[i - 1]!.size.d)
      expect(roof[i]!.pos.y).toBeGreaterThan(roof[i - 1]!.pos.y)
    }
  })

  it('overhangs the walls so the roof casts a lip', () => {
    const roof = gableRoof(SPEC, 'h')[0]!
    expect(roof.size.w).toBeGreaterThan(SPEC.w)
  })

  it('glazes its windows with decals so they never show from inside', () => {
    const glass = house(SPEC, 'h').filter((c) => c.id.includes('glass'))
    expect(glass.length).toBe(2)
    for (const g of glass) expect(g.decal).toBe(true)
  })
})

describe('stall', () => {
  it('stripes the canopy in two alternating colours', () => {
    const canopy = stall().filter((c) => c.id.startsWith('canopy') && c.id !== 'canopyRidge')
    const colors = new Set(canopy.map((c) => c.color))
    expect(colors.size).toBe(2)
    expect(canopy.length).toBeGreaterThan(4)
  })

  it('puts the canopy above head height so you can walk under it', () => {
    const canopy = stall().find((c) => c.id === 'canopy0')!
    expect(canopy.pos.y - canopy.size.h / 2).toBeGreaterThan(36)
  })

  it('can be recoloured per merchant', () => {
    const blue = stall('#123456', '#654321')
    expect(blue.some((c) => c.color === '#123456')).toBe(true)
  })
})
