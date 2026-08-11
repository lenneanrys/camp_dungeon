import { describe, it, expect } from 'vitest'
import {
  buildWalls,
  WALL,
  SEGMENT,
  GATE_W,
  GATES,
  tower,
  wallSegment,
  wallCrown,
  gatehouse,
  towerPositions,
  WALL_T,
  WALKWAY_Y,
  WALKWAY_INSET,
  CROWN_OFFSET,
} from './fortifications'
import { bakeProp } from './bake'
import { depthOf } from '../render3d/camera'
import { footprint } from './prop'
import type { AABB } from './prop'
import { buildVillage, SPAWN, BUILDINGS, DUMMY_SPOTS, STATIONS } from './village'

const WALLS = buildWalls()
const wallBoxes = WALLS.map(footprint).filter((f): f is AABB => f !== null)

describe('the curtain wall', () => {
  it('encloses the town on all four sides', () => {
    for (const [name, test] of [
      ['north', (b: AABB) => b.maxZ < WALL.minZ + 40],
      ['south', (b: AABB) => b.minZ > WALL.maxZ - 40],
      ['west', (b: AABB) => b.maxX < WALL.minX + 40],
      ['east', (b: AABB) => b.minX > WALL.maxX - 40],
    ] as const) {
      expect(wallBoxes.some(test), `no ${name} wall`).toBe(true)
    }
  })

  it('leaves no gap you could slip through', () => {
    // Walk the inside of each run and confirm something blocks the way out.
    // Inclusive bounds: segments tile edge to edge, so a probe landing exactly
    // on a seam is still inside the wall.
    const E = 0.01
    const blocked = (x: number, z: number): boolean =>
      wallBoxes.some(
        (b) => x >= b.minX - E && x <= b.maxX + E && z >= b.minZ - E && z <= b.maxZ + E,
      )

    for (let x = WALL.minX; x <= WALL.maxX; x += 8) {
      expect(blocked(x, WALL.minZ), `gap in the north wall at x=${x}`).toBe(true)
      expect(blocked(x, WALL.maxZ), `gap in the south wall at x=${x}`).toBe(true)
    }
    for (let z = WALL.minZ; z <= WALL.maxZ; z += 8) {
      expect(blocked(WALL.minX, z), `gap in the west wall at z=${z}`).toBe(true)
      expect(blocked(WALL.maxX, z), `gap in the east wall at z=${z}`).toBe(true)
    }
  })

  // Segments and towers standing on the same ground would wedge the player.
  it('never overlaps two pieces of masonry', () => {
    for (let i = 0; i < wallBoxes.length; i++) {
      for (let k = i + 1; k < wallBoxes.length; k++) {
        const a = wallBoxes[i]!
        const b = wallBoxes[k]!
        // Sharing an edge is fine; genuinely occupying the same ground is not.
        const E = 0.05
        const hit =
          a.minX < b.maxX - E && a.maxX > b.minX + E && a.minZ < b.maxZ - E && a.maxZ > b.minZ + E
        expect(hit, `${WALLS[i]?.id} overlaps ${WALLS[k]?.id}`).toBe(false)
      }
    }
  })

  it('stands towers with flags at the corners', () => {
    expect(WALLS.filter((p) => p.id.startsWith('tower')).length).toBeGreaterThanOrEqual(4)
    expect(tower('#ff0000').some((c) => c.color === '#ff0000')).toBe(true)
    expect(tower('#ff0000').some((c) => c.id === 'towerPole')).toBe(true)
  })

  it('builds a gatehouse on every side, all firmly shut', () => {
    for (const g of GATES) {
      expect(WALLS.some((p) => p.id === `gate_${g.side}`), `no ${g.side} gate`).toBe(true)
      const gate = gatehouse(g.horizontal, g.outward)
      expect(gate.some((c) => c.id === 'gateDoorL')).toBe(true)
      expect(gate.some((c) => c.id === 'gateDoorR')).toBe(true)
    }
  })

  it('flanks every gate with a tower on each side', () => {
    const towers = towerPositions()
    for (const g of GATES) {
      const flanking = towers.filter((t) =>
        g.horizontal ? t.z === g.z && t.x !== g.x : t.x === g.x && t.z !== g.z,
      )
      // Two flanks plus the two corners of that run.
      expect(flanking.length, `${g.side} gate`).toBeGreaterThanOrEqual(2)
    }
  })

  it('stands twelve towers: four corners and two per gate', () => {
    expect(towerPositions()).toHaveLength(12)
  })

  it('is thick enough to walk along', () => {
    expect(WALL_T).toBeGreaterThanOrEqual(24)
  })

  // The reported gap: a centred merlon row leaves bare wall at each end.
  it('tiles battlements right to both ends of a segment', () => {
    for (const length of [24, 37.5, 40, 52.25]) {
      const merlons = wallCrown(true, length)
      const minX = Math.min(...merlons.map((m) => m.pos.x - m.size.w / 2))
      const maxX = Math.max(...merlons.map((m) => m.pos.x + m.size.w / 2))
      // First and last merlon start within a fraction of the segment ends.
      expect(minX, `length ${length}`).toBeLessThan(-length / 2 + length * 0.25)
      expect(maxX, `length ${length}`).toBeGreaterThan(length / 2 - length * 0.25)
    }
  })

  it('never fades — a see-through wall reads as a bug', () => {
    for (const p of WALLS) expect(p.noFade, p.id).toBe(true)
  })

  // The battlements are their own prop: a sentry stands on the wall body but
  // BEHIND the merlons, and one object cannot be both sides of him.
  it('keeps the merlons out of the wall segment itself', () => {
    expect(wallSegment(true).some((c) => c.id.includes('Merlon'))).toBe(false)
    expect(wallSegment(false).some((c) => c.id.includes('Merlon'))).toBe(false)
  })

  it('crowns every wall segment with a separate battlement prop', () => {
    const segments = WALLS.filter((p) => p.id.startsWith('wallH_') || p.id.startsWith('wallV_'))
    const crowns = WALLS.filter((p) => p.id.startsWith('crownH_') || p.id.startsWith('crownV_'))
    expect(crowns.length).toBe(segments.length)
    for (const c of crowns) expect(c.cuboids.every((q) => q.id.includes('Merlon'))).toBe(true)
  })

  it('stands the crown on the outward half of each wall', () => {
    for (const c of WALLS.filter((p) => p.id.startsWith('crownH_'))) {
      const onNorth = c.pos.z < 0
      // North wall faces -z, south wall faces +z.
      expect(onNorth ? c.pos.z < WALL.minZ : c.pos.z > WALL.maxZ).toBe(true)
    }
    for (const c of WALLS.filter((p) => p.id.startsWith('crownV_'))) {
      const onWest = c.pos.x < 0
      expect(onWest ? c.pos.x < WALL.minX : c.pos.x > WALL.maxX).toBe(true)
    }
  })

  it('never gives the battlements a collider — you walk under them', () => {
    for (const c of WALLS.filter((p) => p.id.startsWith('crown'))) {
      expect(c.collider, c.id).toBeUndefined()
    }
  })

  // The three reported symptoms, expressed as sort-order facts.
  it('sorts a tower after the wall it joins', () => {
    const baked = WALLS.map(bakeProp)
    const tower = baked.find((p) => p.id === 'tower0')!
    const neighbours = baked.filter(
      (p) => p.id.startsWith('wallH_') && Math.abs(p.pos.z - tower.pos.z) < 1,
    )
    expect(neighbours.length).toBeGreaterThan(0)
    for (const w of neighbours) {
      expect(depthOf(tower.pos) + tower.depthBias!).toBeGreaterThan(
        depthOf(w.pos) + w.depthBias!,
      )
    }
  })

  it('sorts the battlements after a sentry standing on the walkway behind them', () => {
    const baked = WALLS.map(bakeProp)
    // South wall: the crown must occlude a guard on the inner walkway.
    const crown = baked.find((p) => p.id.startsWith('crownH_') && p.pos.z > WALL.maxZ)!
    const guard = { x: crown.pos.x, y: WALKWAY_Y, z: WALL.maxZ - WALKWAY_INSET }
    expect(depthOf(crown.pos) + crown.depthBias!).toBeGreaterThan(depthOf(guard))
  })

  it('sorts the wall body before that same sentry, so he stands on top of it', () => {
    const baked = WALLS.map(bakeProp)
    const body = baked.find((p) => p.id.startsWith('wallH_') && Math.abs(p.pos.z - WALL.maxZ) < 1)!
    const guard = { x: body.pos.x, y: WALKWAY_Y, z: WALL.maxZ - WALKWAY_INSET }
    expect(depthOf(body.pos) + body.depthBias!).toBeLessThan(depthOf(guard))
  })

  it('gives every segment a walkway deck to stand on', () => {
    expect(wallSegment(true).some((c) => c.id === 'wallDeck')).toBe(true)
  })

  // A tower's shaft is narrower than its base, so a segment that stops at the
  // base leaves a hole in the wall face above it. Segments must overrun.
  it('overruns each end so junctions with towers close up', () => {
    const length = 40
    const body = wallSegment(true, length, 1).find((c) => c.id === 'wallBody')!
    expect(body.size.w).toBeGreaterThan(length + 10)
  })

  it('reaches past the gate piers into the flanking towers', () => {
    const gate = gatehouse(true, 1)
    const piers = gate.filter((c) => c.id.startsWith('gatePier'))
    const base = gate.find((c) => c.id === 'gateBase')!
    const outerEdge = Math.max(...piers.map((p) => p.pos.x + p.size.w / 2))
    // Piers must reach the gate's own footprint edge, not stop short of it.
    expect(outerEdge).toBeCloseTo(base.size.w / 2)
  })

  it('keeps every stone above the ground', () => {
    for (const p of WALLS) {
      for (const c of p.cuboids) {
        expect(c.pos.y - c.size.h / 2, `${p.id}/${c.id}`).toBeGreaterThanOrEqual(-0.001)
      }
    }
  })

  it('puts a gate where each road meets the wall', () => {
    for (const g of GATES) {
      const gate = WALLS.find((p) => p.id === `gate_${g.side}`)!
      expect(gate.pos.x).toBe(g.x)
      expect(gate.pos.z).toBe(g.z)
    }
    expect(GATE_W).toBeGreaterThan(SEGMENT)
  })
})

describe('the wall contains the village', () => {
  const props = buildVillage()

  const within = (x: number, z: number): boolean =>
    x > WALL.minX && x < WALL.maxX && z > WALL.minZ && z < WALL.maxZ

  it('fits every building inside', () => {
    for (const spec of BUILDINGS) {
      expect(within(spec.x, spec.z), `${spec.id} is outside the walls`).toBe(true)
    }
  })

  it('fits the spawn, the stations and the training yard inside', () => {
    expect(within(SPAWN.x, SPAWN.z)).toBe(true)
    for (const s of STATIONS) expect(within(s.x, s.z), `${s.id} outside`).toBe(true)
    for (const d of DUMMY_SPOTS) expect(within(d.x, d.z)).toBe(true)
  })

  // The battlements deliberately overhang the wall line, so allow for that.
  it('fits every prop inside, allowing for the battlements overhang', () => {
    const OUT = CROWN_OFFSET + 1
    for (const p of props) {
      expect(p.pos.x, p.id).toBeGreaterThanOrEqual(WALL.minX - OUT)
      expect(p.pos.x, p.id).toBeLessThanOrEqual(WALL.maxX + OUT)
      expect(p.pos.z, p.id).toBeGreaterThanOrEqual(WALL.minZ - OUT)
      expect(p.pos.z, p.id).toBeLessThanOrEqual(WALL.maxZ + OUT)
    }
  })

  it('keeps everything that is not masonry strictly inside', () => {
    for (const p of props.filter((q) => !q.id.startsWith('crown'))) {
      expect(p.pos.x, p.id).toBeGreaterThanOrEqual(WALL.minX)
      expect(p.pos.x, p.id).toBeLessThanOrEqual(WALL.maxX)
      expect(p.pos.z, p.id).toBeGreaterThanOrEqual(WALL.minZ)
      expect(p.pos.z, p.id).toBeLessThanOrEqual(WALL.maxZ)
    }
  })
})
