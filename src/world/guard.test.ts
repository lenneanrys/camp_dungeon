import { describe, it, expect } from 'vitest'
import { buildGuards, updateGuard, guardPose, guardOffset, guardMoving } from './guard'
import type { Guard } from './guard'
import { WALL, GATES, GATE_HEIGHT } from './fortifications'
import { GATE_STANDOFF } from './guard'
import { PITCH } from '../render3d/camera'
import { TICK } from '../sim/constants'

const run = (guard: Guard, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / TICK); i++) updateGuard(guard, TICK)
}

describe('the garrison', () => {
  it('posts a full garrison: wall sentries, gate pairs and street patrols', () => {
    const guards = buildGuards()
    expect(guards.filter((g) => g.id.startsWith('wall_')).length).toBe(8)
    expect(guards.filter((g) => g.id.startsWith('gate_')).length).toBe(8)
    expect(guards.filter((g) => g.id.startsWith('street')).length).toBe(4)
    expect(guards.length).toBeGreaterThanOrEqual(20)
  })

  // Sentries stand ON the wall; everyone else is at street level.
  it('puts the wall sentries up on the walkway', () => {
    for (const g of buildGuards()) {
      const onWall = g.id.startsWith('wall_')
      expect(g.elevation > 0, g.id).toBe(onWall)
    }
  })

  it('gives each a unique id', () => {
    const ids = buildGuards().map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // Guards marching in lockstep look like clones rather than a garrison.
  it('starts each street patrol on a different corner at its own pace', () => {
    const patrol = buildGuards().filter((g) => g.id.startsWith('street'))
    expect(new Set(patrol.map((g) => `${g.path[0]!.x},${g.path[0]!.z}`)).size).toBe(patrol.length)
    expect(new Set(patrol.map((g) => g.speed)).size).toBe(patrol.length)
  })

  it('gives every sentry a beat with somewhere to walk to', () => {
    for (const g of buildGuards()) {
      expect(g.path.length, g.id).toBeGreaterThanOrEqual(2)
      const a = g.path[0]!
      const b = g.path[1]!
      expect(Math.hypot(a.x - b.x, a.z - b.z), g.id).toBeGreaterThan(10)
    }
  })

  /**
   * The bug this locks in: a guard standing just inside a 72-unit gatehouse has
   * his legs covered by it, whatever the draw order says. His feet must project
   * ABOVE the top of the wall behind him.
   */
  it('stands every street-level soldier clear of the wall behind them', () => {
    const SIN = Math.sin(PITCH)
    const COS = Math.cos(PITCH)

    for (const g of buildGuards()) {
      if (g.elevation > 0) continue // sentries are on top of the wall already

      for (const gate of GATES) {
        if (!gate.horizontal) continue // depth only depends on z
        const feetY = g.pos.z * SIN
        const wallTopY = gate.z * SIN - GATE_HEIGHT * COS
        // Only the wall nearer the camera than the guard can cover him.
        if (gate.z <= g.pos.z) continue
        expect(feetY, `${g.id} is swallowed by the ${gate.side} gate`).toBeLessThan(wallTopY)
      }
    }
  })

  it('derives the gate standoff from the wall height rather than guessing', () => {
    expect(GATE_STANDOFF).toBeGreaterThan(GATE_HEIGHT)
  })

  it('keeps every soldier inside the walls', () => {
    const guards = buildGuards()
    for (let i = 0; i < 2400; i++) {
      for (const g of guards) {
        updateGuard(g, TICK)
        expect(g.pos.x, g.id).toBeGreaterThan(WALL.minX)
        expect(g.pos.x, g.id).toBeLessThan(WALL.maxX)
        expect(g.pos.z, g.id).toBeGreaterThan(WALL.minZ)
        expect(g.pos.z, g.id).toBeLessThan(WALL.maxZ)
      }
    }
  })
})

describe('patrolling', () => {
  const patroller = () => buildGuards().find((g) => g.id.startsWith('street'))!

  it('walks toward its next corner', () => {
    const g = patroller()
    const start = { ...g.pos }
    run(g, 1)
    expect(Math.hypot(g.pos.x - start.x, g.pos.z - start.z)).toBeGreaterThan(10)
  })

  it('works its way round the whole circuit', () => {
    const g = patroller()
    const visited = new Set<number>()
    for (let i = 0; i < 6000; i++) {
      updateGuard(g, TICK)
      visited.add(g.leg)
    }
    expect(visited.size).toBe(g.path.length)
  })

  it('pauses at each corner instead of marching forever', () => {
    const g = patroller()
    let paused = false
    for (let i = 0; i < 4000 && !paused; i++) {
      updateGuard(g, TICK)
      if (!guardMoving(g)) paused = true
    }
    expect(paused).toBe(true)
  })

  it('stands still while paused', () => {
    const g = patroller()
    g.pause = 1
    const before = { ...g.pos }
    run(g, 0.5)
    expect(g.pos.x).toBeCloseTo(before.x)
    expect(g.pos.z).toBeCloseTo(before.z)
  })

  // Snapping round a corner reads as a glitch; easing reads as a soldier.
  it('eases round each corner rather than pivoting on the spot', () => {
    const g = patroller()
    const seen: number[] = []
    for (let i = 0; i < 20; i++) {
      updateGuard(g, TICK)
      seen.push(g.yaw)
    }
    for (let i = 1; i < seen.length; i++) {
      expect(Math.abs(seen[i]! - seen[i - 1]!)).toBeLessThan(0.35)
    }
  })

  it('animates its legs only while actually walking', () => {
    const g = patroller()
    run(g, 1)
    expect(Math.abs(guardPose(g).legL!.x)).toBeGreaterThan(0)

    g.pause = 1
    expect(guardPose(g).legL).toBeUndefined()
    expect(guardOffset(g).y).toBe(g.elevation)
  })

  // Regression: height must live in the guard's POSITION so the depth sort
  // sees it. Applied as a pure render offset, the wall he stands on draws over
  // the top of him and the sentries vanish.
  it('keeps elevation out of the render offset', () => {
    for (const g of buildGuards()) {
      g.pause = 0
      expect(Math.abs(guardOffset(g).y), g.id).toBeLessThan(2)
    }
  })

  it('bobs while marching', () => {
    const g = patroller()
    const heights = new Set<number>()
    for (let i = 0; i < 60; i++) {
      updateGuard(g, TICK)
      heights.add(Math.round(guardOffset(g).y * 100))
    }
    expect(heights.size).toBeGreaterThan(3)
  })

  it('faces the way it is heading', () => {
    const g = patroller()
    run(g, 2)
    const target = g.path[g.leg]!
    const want = Math.atan2(target.x - g.pos.x, target.z - g.pos.z)
    expect(Math.abs(g.yaw - want)).toBeLessThan(0.4)
  })
})
