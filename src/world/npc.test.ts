import { describe, it, expect } from 'vitest'
import {
  buildNpcs,
  npcPose,
  npcOffset,
  updateNpc,
  turnToward,
  shortestAngleDelta,
  LOOK_RADIUS,
} from './npc'
import type { Npc } from './npc'
import { STATIONS } from './village'
import { TICK } from '../sim/constants'

const PI = Math.PI

const fresh = (): Npc => buildNpcs()[0]!

/** Stand the player `d` units due south of an NPC and let time pass. */
function watchFrom(npc: Npc, x: number, z: number, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / TICK); i++) updateNpc(npc, { x, z }, TICK)
}

describe('npcs', () => {
  it('makes one per station', () => {
    expect(buildNpcs()).toHaveLength(STATIONS.length)
  })

  it('gives each a distinct costume', () => {
    const skins = buildNpcs().map(
      (n) => n.parts.flatMap((p) => p.cuboids).find((c) => c.id === 'head')!.color,
    )
    expect(new Set(skins).size).toBe(skins.length)
  })

  it('starts each facing its station', () => {
    for (const npc of buildNpcs()) expect(npc.yaw).toBeCloseTo(npc.homeYaw)
  })

  it('breathes out of sync with the others', () => {
    const phases = buildNpcs().map((n) => n.phase)
    expect(new Set(phases).size).toBe(phases.length)
  })

  it('never lifts an NPC off the ground', () => {
    for (let t = 0; t < 6; t += 0.1) {
      expect(Math.abs(npcOffset(fresh(), t).y)).toBeLessThan(1)
    }
  })
})

describe('shortestAngleDelta', () => {
  it('is zero for the same angle', () => {
    expect(shortestAngleDelta(1.2, 1.2)).toBeCloseTo(0)
  })

  // Without wrapping, an NPC turning past due north spins almost all the way
  // round to look a couple of degrees to the side.
  it('takes the short way across the wrap point', () => {
    const delta = shortestAngleDelta(3.0, -3.0)
    expect(Math.abs(delta)).toBeLessThan(0.6)
    expect(delta).toBeGreaterThan(0)
  })

  it('takes the short way the other direction too', () => {
    const delta = shortestAngleDelta(-3.0, 3.0)
    expect(Math.abs(delta)).toBeLessThan(0.6)
    expect(delta).toBeLessThan(0)
  })

  it('never exceeds half a turn', () => {
    for (let a = -8; a < 8; a += 0.37) {
      for (let b = -8; b < 8; b += 0.53) {
        expect(Math.abs(shortestAngleDelta(a, b))).toBeLessThanOrEqual(PI + 1e-9)
      }
    }
  })
})

describe('turnToward', () => {
  it('does not arrive in a single step', () => {
    const next = turnToward(0, 1, TICK, 3.4)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(0.5)
  })

  it('gets there eventually', () => {
    let a = 0
    for (let i = 0; i < 240; i++) a = turnToward(a, 1, TICK, 3.4)
    expect(a).toBeCloseTo(1, 2)
  })

  it('never overshoots, however large the step', () => {
    expect(turnToward(0, 1, 10, 3.4)).toBeCloseTo(1)
  })

  it('stays put when it is already there', () => {
    expect(turnToward(0.8, 0.8, TICK, 3.4)).toBeCloseTo(0.8)
  })
})

describe('watching the player', () => {
  it('ignores a player standing well outside the radius', () => {
    const npc = fresh()
    watchFrom(npc, npc.pos.x, npc.pos.z + LOOK_RADIUS * 3, 2)
    expect(npc.yaw).toBeCloseTo(npc.homeYaw, 2)
    expect(npc.attention).toBeCloseTo(0, 2)
  })

  it('turns to face a player who comes within four tiles', () => {
    const npc = fresh()
    watchFrom(npc, npc.pos.x, npc.pos.z + LOOK_RADIUS * 0.5, 2)
    // Player due south (+z), so the NPC should face +z, which is yaw 0.
    expect(npc.yaw).toBeCloseTo(0, 1)
    expect(npc.attention).toBeGreaterThan(0.9)
  })

  it('faces the right way whichever side you approach from', () => {
    const east = fresh()
    watchFrom(east, east.pos.x + 40, east.pos.z, 2)
    expect(east.yaw).toBeCloseTo(PI / 2, 1)

    const west = fresh()
    watchFrom(west, west.pos.x - 40, west.pos.z, 2)
    expect(west.yaw).toBeCloseTo(-PI / 2, 1)
  })

  // "don't do it directly, let them slide to me"
  it('slides round over several frames rather than snapping', () => {
    const npc = fresh()
    npc.yaw = PI // facing away
    const seen: number[] = []
    for (let i = 0; i < 12; i++) {
      updateNpc(npc, { x: npc.pos.x, z: npc.pos.z + 40 }, TICK)
      seen.push(npc.yaw)
    }
    // Still moving after a dozen frames, and every step is small.
    expect(seen[0]).not.toBeCloseTo(0, 2)
    for (let i = 1; i < seen.length; i++) {
      expect(Math.abs(seen[i]! - seen[i - 1]!)).toBeLessThan(0.4)
    }
  })

  it('drifts back to its station facing once you walk away', () => {
    const npc = fresh()
    watchFrom(npc, npc.pos.x + 40, npc.pos.z, 2)
    expect(npc.yaw).not.toBeCloseTo(npc.homeYaw, 1)
    watchFrom(npc, npc.pos.x + LOOK_RADIUS * 4, npc.pos.z, 3)
    expect(npc.yaw).toBeCloseTo(npc.homeYaw, 1)
  })

  it('tracks a player who walks around it', () => {
    const npc = fresh()
    for (let a = 0; a < PI * 2; a += 0.05) {
      const x = npc.pos.x + Math.sin(a) * 40
      const z = npc.pos.z + Math.cos(a) * 40
      for (let i = 0; i < 4; i++) updateNpc(npc, { x, z }, TICK)
      expect(Number.isFinite(npc.yaw)).toBe(true)
    }
  })

  it('steadies its gaze while watching, and wanders again after', () => {
    const npc = fresh()
    watchFrom(npc, npc.pos.x, npc.pos.z + 40, 2)
    const watching = npcPose(npc, 3).head!.y

    watchFrom(npc, npc.pos.x, npc.pos.z + LOOK_RADIUS * 4, 3)
    const idle = npcPose(npc, 3).head!.y

    expect(Math.abs(watching)).toBeLessThan(Math.abs(idle))
  })

  it('points the body at the player, not just the head', () => {
    const npc = fresh()
    watchFrom(npc, npc.pos.x, npc.pos.z + 40, 2)
    expect(npcPose(npc, 1).root!.y).toBeCloseTo(npc.yaw)
  })
})
