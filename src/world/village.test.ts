import { describe, it, expect } from 'vitest'
import { buildVillage, SPAWN, STATIONS, DUMMY_SPOTS, BUILDINGS, plazaSignpost, SIGNPOST_POS } from './village'
import { footprint } from './prop'
import type { AABB } from './prop'

const PROPS = buildVillage()
const boxes = PROPS.map(footprint).filter((f): f is AABB => f !== null)

// Wall segments tile edge to edge, so touching is correct; only genuine
// shared ground is a bug.
const E = 0.05
const overlaps = (a: AABB, b: AABB): boolean =>
  a.minX < b.maxX - E && a.maxX > b.minX + E && a.minZ < b.maxZ - E && a.maxZ > b.minZ + E

const prop = (id: string) => PROPS.find((p) => p.id === id)!

describe('village layout', () => {
  it('has all four trades', () => {
    // Shops are walk-in buildings now, so they arrive as wall/roof/floor props
    // rather than one solid box.
    for (const id of ['blacksmith', 'alchemist', 'enchanter']) {
      expect(BUILDINGS.some((s) => s.id === id), `missing ${id}`).toBe(true)
      expect(PROPS.some((p) => p.id.startsWith(`${id}_`))).toBe(true)
    }
    expect(prop('stallA')).toBeDefined()
  })

  it('has homes as well as shops, so the town looks lived in', () => {
    expect(BUILDINGS.filter((s) => s.id.startsWith('home')).length).toBeGreaterThanOrEqual(3)
  })

  it('has a signpost standing dead centre of the plaza', () => {
    expect(SIGNPOST_POS.x).toBe(0)
    expect(SIGNPOST_POS.z).toBe(0)
    expect(plazaSignpost().parts.length).toBeGreaterThan(2)
  })

  it('points a signpost arm at every destination', () => {
    expect(plazaSignpost().parts.filter((p) => p.id.startsWith('arm')).length).toBe(5)
  })

  it('has no well and no archway in the way of it', () => {
    expect(PROPS.some((p) => p.id === 'well')).toBe(false)
    expect(PROPS.some((p) => p.id === 'archway')).toBe(false)
  })

  it('gives every prop a unique id', () => {
    const ids = PROPS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // Two buildings on the same ground is a bug you cannot see until you walk
  // into it and get stuck between them.
  it('never lets two colliders overlap', () => {
    for (let i = 0; i < boxes.length; i++) {
      for (let k = i + 1; k < boxes.length; k++) {
        const a = boxes[i]!
        const b = boxes[k]!
        expect(overlaps(a, b), `${PROPS.filter(footprint)[i]?.id} overlaps ${PROPS.filter(footprint)[k]?.id}`).toBe(false)
      }
    }
  })

  it('spawns the player somewhere walkable', () => {
    for (const box of boxes) {
      const inside =
        SPAWN.x > box.minX - 6 && SPAWN.x < box.maxX + 6 &&
        SPAWN.z > box.minZ - 6 && SPAWN.z < box.maxZ + 6
      expect(inside).toBe(false)
    }
  })

  it('keeps the plaza around the well clear enough to walk', () => {
    // A ring at radius 45 around the well should be free of obstacles.
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const x = Math.cos(a) * 45
      const z = Math.sin(a) * 45
      const blocked = boxes.some(
        (bx) => x > bx.minX && x < bx.maxX && z > bx.minZ && z < bx.maxZ,
      )
      expect(blocked, `blocked at angle ${a.toFixed(2)}`).toBe(false)
    }
  })
})

describe('reachability', () => {
  // A shop you cannot walk to is decoration. Flood-fill the walkable ground
  // from the spawn and confirm every NPC station is connected to it.
  const STEP = 8
  const LIMIT = 340

  const blocked = (x: number, z: number): boolean =>
    boxes.some(
      (b) => x > b.minX - 5 && x < b.maxX + 5 && z > b.minZ - 5 && z < b.maxZ + 5,
    )

  const reachable = (): Set<string> => {
    const seen = new Set<string>()
    const key = (x: number, z: number) => `${x},${z}`
    const start: [number, number] = [
      Math.round(SPAWN.x / STEP) * STEP,
      Math.round(SPAWN.z / STEP) * STEP,
    ]
    const queue: [number, number][] = [start]
    seen.add(key(...start))

    while (queue.length) {
      const [x, z] = queue.shift()!
      const neighbours: [number, number][] = [
        [STEP, 0],
        [-STEP, 0],
        [0, STEP],
        [0, -STEP],
      ]
      for (const [dx, dz] of neighbours) {
        const nx = x + dx
        const nz = z + dz
        if (Math.abs(nx) > LIMIT || Math.abs(nz) > LIMIT) continue
        if (seen.has(key(nx, nz)) || blocked(nx, nz)) continue
        seen.add(key(nx, nz))
        queue.push([nx, nz])
      }
    }
    return seen
  }

  const WALKABLE = reachable()

  const nearestWalkable = (x: number, z: number): boolean => {
    for (let r = 0; r <= 40; r += STEP) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const gx = Math.round((x + Math.cos(a) * r) / STEP) * STEP
        const gz = Math.round((z + Math.sin(a) * r) / STEP) * STEP
        if (WALKABLE.has(`${gx},${gz}`)) return true
      }
    }
    return false
  }

  it('opens up a large connected area, not a pocket', () => {
    expect(WALKABLE.size).toBeGreaterThan(500)
  })

  for (const s of STATIONS) {
    it(`can walk from spawn to the ${s.id}`, () => {
      expect(nearestWalkable(s.x, s.z)).toBe(true)
    })
  }

  for (const [i, d] of DUMMY_SPOTS.entries()) {
    it(`can walk from spawn to training dummy ${i}`, () => {
      expect(nearestWalkable(d.x, d.z)).toBe(true)
    })
  }
})

describe('NPC stations', () => {
  it('stands each NPC clear of every collider', () => {
    for (const s of STATIONS) {
      for (const b of boxes) {
        const inside = s.x > b.minX - 4 && s.x < b.maxX + 4 && s.z > b.minZ - 4 && s.z < b.maxZ + 4
        expect(inside, `${s.id} is inside something`).toBe(false)
      }
    }
  })

  it('gives every NPC a facing direction', () => {
    for (const s of STATIONS) {
      expect(Math.hypot(s.facing.x, s.facing.y)).toBeGreaterThan(0)
    }
  })

  it('keeps the dummies clear of colliders', () => {
    for (const d of DUMMY_SPOTS) {
      for (const b of boxes) {
        const inside = d.x > b.minX - 6 && d.x < b.maxX + 6 && d.z > b.minZ - 6 && d.z < b.maxZ + 6
        expect(inside).toBe(false)
      }
    }
  })
})
