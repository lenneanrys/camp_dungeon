import { describe, it, expect } from 'vitest'
import {
  buildingProps,
  interiorRegion,
  doorway,
  roofId,
  put,
  bed,
  interiorColliders,
  DOOR_W,
  WALL_T,
} from './interiors'
import type { BuildingSpec } from './interiors'
import { footprint } from './prop'
import type { AABB } from './prop'
import { BUILDINGS, buildingAt, SPAWN, villageColliders, buildVillage } from './village'
import { PALETTE } from './palette'

const SPEC: BuildingSpec = {
  id: 'test',
  x: 0,
  z: 0,
  w: 80,
  d: 64,
  wallH: 44,
  wall: PALETTE.plaster,
  trim: PALETTE.timber,
  roof: PALETTE.roofTile,
  floor: PALETTE.timber,
}

const PROPS = buildingProps(SPEC)
const boxes = PROPS.map(footprint).filter((f): f is AABB => f !== null)

const blocked = (x: number, z: number, r = 5): boolean =>
  boxes.some((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r)

describe('a building you can walk into', () => {
  it('builds walls, a floor and a roof', () => {
    const ids = PROPS.map((p) => p.id)
    expect(ids).toContain('test_floor')
    expect(ids).toContain('test_wallN')
    expect(ids).toContain(roofId(SPEC))
  })

  // The whole point: a single box collider would seal the door shut.
  it('leaves the doorway walkable', () => {
    const door = doorway(SPEC)
    expect(blocked(door.x, door.z)).toBe(false)
  })

  it('blocks the walls either side of the door', () => {
    expect(blocked(SPEC.x - SPEC.w / 2 + 4, SPEC.z + SPEC.d / 2 - 2, 0)).toBe(true)
    expect(blocked(SPEC.x + SPEC.w / 2 - 4, SPEC.z + SPEC.d / 2 - 2, 0)).toBe(true)
  })

  it('blocks all three solid walls', () => {
    expect(blocked(0, -SPEC.d / 2 + WALL_T / 2, 0)).toBe(true) // back
    expect(blocked(-SPEC.w / 2 + WALL_T / 2, 0, 0)).toBe(true) // west
    expect(blocked(SPEC.w / 2 - WALL_T / 2, 0, 0)).toBe(true) // east
  })

  it('gives the doorway room for the player to fit through', () => {
    // A 10-unit-wide player needs meaningfully more than 10 units of gap.
    expect(DOOR_W).toBeGreaterThan(16)
    for (let x = -DOOR_W / 2 + 6; x <= DOOR_W / 2 - 6; x += 2) {
      expect(blocked(x, SPEC.z + SPEC.d / 2, 5)).toBe(false)
    }
  })

  it('leaves the inside clear to stand in', () => {
    const r = interiorRegion(SPEC)
    for (let x = r.minX + 8; x < r.maxX - 8; x += 8) {
      for (let z = r.minZ + 8; z < r.maxZ - 8; z += 8) {
        expect(blocked(x, z, 4), `blocked inside at ${x},${z}`).toBe(false)
      }
    }
  })

  it('never gives the roof a collider — you walk under it, not into it', () => {
    expect(PROPS.find((p) => p.id === roofId(SPEC))!.collider).toBeUndefined()
  })

  it('puts the roof above head height', () => {
    const roof = PROPS.find((p) => p.id === roofId(SPEC))!
    for (const c of roof.cuboids) {
      expect(c.pos.y - c.size.h / 2).toBeGreaterThanOrEqual(SPEC.wallH - 0.001)
    }
  })

  it('keeps furniture inside the walls', () => {
    const withStuff = buildingProps({
      ...SPEC,
      interior: [put(bed(), 10, 6, { w: 22, d: 38 })],
    })
    const inner = withStuff.find((p) => p.id === 'test_interior')!
    const r = interiorRegion(SPEC)
    for (const c of inner.cuboids) {
      expect(SPEC.x + c.pos.x).toBeGreaterThan(r.minX)
      expect(SPEC.x + c.pos.x).toBeLessThan(r.maxX)
    }
  })
})

describe('furniture you cannot walk through', () => {
  // The reported bug: you could stroll straight through every bed and table.
  it('gives solid furniture a footprint', () => {
    const spec = { ...SPEC, interior: [put(bed(), 10, 6, { w: 22, d: 38 })] }
    const solids = interiorColliders(spec)
    expect(solids).toHaveLength(1)
    expect(solids[0]!.minX).toBeCloseTo(SPEC.x + 10 - 11)
    expect(solids[0]!.maxZ).toBeCloseTo(SPEC.z + 6 + 19)
  })

  // Rugs are furniture you are supposed to stand on.
  it('leaves rugs walkable', () => {
    expect(interiorColliders({ ...SPEC, interior: [put(bed(), 0, 0)] })).toHaveLength(0)
  })

  it('moves the footprint with the furniture, so the two cannot drift apart', () => {
    const here = interiorColliders({ ...SPEC, interior: [put(bed(), 0, 0, { w: 22, d: 38 })] })[0]!
    const there = interiorColliders({ ...SPEC, interior: [put(bed(), 20, 0, { w: 22, d: 38 })] })[0]!
    expect(there.minX - here.minX).toBeCloseTo(20)
  })

  it('makes every bed and chair in the village solid', () => {
    for (const spec of BUILDINGS) {
      const solids = interiorColliders(spec)
      expect(solids.length, `${spec.id} has no solid furniture`).toBeGreaterThan(2)
    }
  })

  // Furniture may line the walls, but the strip of floor directly inside the
  // door has to stay clear or you cannot get in.
  it('keeps an entry lane clear inside every door', () => {
    const LANE_HALF = 14
    for (const spec of BUILDINGS) {
      const lane = {
        minX: spec.x - LANE_HALF,
        maxX: spec.x + LANE_HALF,
        minZ: spec.z + spec.d / 2 - WALL_T - 22,
        maxZ: spec.z + spec.d / 2 - WALL_T,
      }
      for (const f of interiorColliders(spec)) {
        const inLane =
          f.minX < lane.maxX && f.maxX > lane.minX && f.minZ < lane.maxZ && f.maxZ > lane.minZ
        expect(inLane, `${spec.id} furniture blocks its own entry lane`).toBe(false)
      }
    }
  })

  it('keeps furniture inside the room it belongs to', () => {
    for (const spec of BUILDINGS) {
      const r = interiorRegion(spec)
      for (const f of interiorColliders(spec)) {
        expect(f.minX, `${spec.id}`).toBeGreaterThanOrEqual(r.minX - 1)
        expect(f.maxX, `${spec.id}`).toBeLessThanOrEqual(r.maxX + 1)
        expect(f.minZ, `${spec.id}`).toBeGreaterThanOrEqual(r.minZ - 1)
        expect(f.maxZ, `${spec.id}`).toBeLessThanOrEqual(r.maxZ + 1)
      }
    }
  })
})

describe('buildingAt', () => {
  it('knows when you are inside a shop', () => {
    const spec = BUILDINGS[0]!
    expect(buildingAt(spec.x, spec.z)?.id).toBe(spec.id)
  })

  it('knows when you are outside everything', () => {
    expect(buildingAt(SPAWN.x, SPAWN.z)).toBeNull()
  })

  it('does not count standing in the doorway as inside', () => {
    const spec = BUILDINGS[0]!
    const door = doorway(spec)
    expect(buildingAt(door.x, door.z + 4)).toBeNull()
  })
})

describe('the whole village', () => {
  const props = buildVillage()
  const colliders = villageColliders(props)

  const free = (x: number, z: number, r: number): boolean =>
    !colliders.some((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r)

  it('gives every prop a unique id', () => {
    const ids = props.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // Flood-fill the walkable ground and confirm you can get into every building.
  const STEP = 6
  const LIMIT = 400
  const walkable = new Set<string>()
  const key = (x: number, z: number) => `${x},${z}`
  const queue: [number, number][] = [
    [Math.round(SPAWN.x / STEP) * STEP, Math.round(SPAWN.z / STEP) * STEP],
  ]
  walkable.add(key(queue[0]![0], queue[0]![1]))
  while (queue.length) {
    const [x, z] = queue.shift()!
    const steps: [number, number][] = [
      [STEP, 0],
      [-STEP, 0],
      [0, STEP],
      [0, -STEP],
    ]
    for (const [dx, dz] of steps) {
      const nx = x + dx
      const nz = z + dz
      if (Math.abs(nx) > LIMIT || Math.abs(nz) > LIMIT) continue
      if (walkable.has(key(nx, nz)) || !free(nx, nz, 5)) continue
      walkable.add(key(nx, nz))
      queue.push([nx, nz])
    }
  }

  const reaches = (x: number, z: number): boolean => {
    for (let r = 0; r <= 24; r += STEP) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const gx = Math.round((x + Math.cos(a) * r) / STEP) * STEP
        const gz = Math.round((z + Math.sin(a) * r) / STEP) * STEP
        if (walkable.has(key(gx, gz))) return true
      }
    }
    return false
  }

  for (const spec of BUILDINGS) {
    it(`can walk in through the door of ${spec.id}`, () => {
      // Just inside the threshold — the centre of a room may hold a table.
      const inside = spec.z + spec.d / 2 - WALL_T - 10
      expect(reaches(spec.x, inside), `${spec.id} interior unreachable`).toBe(true)
    })
  }

  it('opens up a large connected town, not a pocket', () => {
    expect(walkable.size).toBeGreaterThan(2000)
  })
})
