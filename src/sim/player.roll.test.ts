import { describe, it, expect } from 'vitest'
import { Player } from './player'
import type { PlayerInput } from './player'
import {
  TICK,
  WALK_SPEED,
  ROLL_DURATION,
  ROLL_SPEED_MULT,
  ROLL_TAIL_DURATION,
  ROLL_COOLDOWN,
} from './constants'

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}
const rollPress: PlayerInput = { ...idle, roll: true }
const runRight: PlayerInput = { ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 }

function advance(p: Player, seconds: number, input: PlayerInput = idle): void {
  for (let i = 0; i < Math.round(seconds / TICK); i++) p.tick(input)
}

describe('Player roll', () => {
  it('enters the rolling state on press', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    expect(p.state).toBe('rolling')
  })

  it('covers much more ground than a walk over the same time', () => {
    const walker = new Player()
    advance(walker, ROLL_DURATION, runRight)

    const roller = new Player()
    roller.tick({ ...runRight, roll: true })
    advance(roller, ROLL_DURATION - TICK, runRight)

    expect(roller.pos.x).toBeGreaterThan(walker.pos.x * 1.5)
  })

  // Easing DOWN from the peak is what makes it read as a launch rather than
  // a slide. Easing up feels like the character is wading through mud.
  it('starts at peak speed and eases down', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    const firstStep = p.pos.x
    expect(firstStep).toBeCloseTo(WALK_SPEED * ROLL_SPEED_MULT * TICK, 3)

    advance(p, ROLL_DURATION * 0.8, runRight)
    const before = p.pos.x
    p.tick(runRight)
    expect(p.pos.x - before).toBeLessThan(firstStep)
  })

  it('locks direction — steering mid-roll does nothing', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION, { ...idle, move: { x: 0, y: 1 }, moveMagnitude: 1 })
    expect(Math.abs(p.pos.y)).toBeLessThan(0.001)
    expect(p.pos.x).toBeGreaterThan(0)
  })

  it('locks facing for the whole roll', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    p.tick({ ...idle, move: { x: 0, y: 1 }, moveMagnitude: 1 })
    expect(p.facing.x).toBeCloseTo(1)
    expect(p.facing.y).toBeCloseTo(0)
  })

  it('rolls the way it faces when the stick is neutral', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: -1, y: 0 }, moveMagnitude: 1 })
    p.tick(rollPress)
    advance(p, ROLL_DURATION)
    expect(p.pos.x).toBeLessThan(0)
  })

  it('returns to idle and keeps a faster tail', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION)
    expect(p.state).toBe('idle')

    const before = p.pos.x
    p.tick(runRight)
    expect(p.pos.x - before).toBeGreaterThan(WALK_SPEED * TICK)
  })

  it('the tail expires back to walking speed', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION + ROLL_TAIL_DURATION)
    const before = p.pos.x
    p.tick(runRight)
    expect(p.pos.x - before).toBeCloseTo(WALK_SPEED * TICK, 4)
  })

  it('cannot roll again until the cooldown expires', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION + 0.1)
    p.tick(rollPress)
    expect(p.state).not.toBe('rolling')

    advance(p, ROLL_COOLDOWN)
    p.tick(rollPress)
    expect(p.state).toBe('rolling')
  })

  it('cannot re-roll while already rolling', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    const timerAfterFirst = p.rollTimer
    p.tick({ ...runRight, roll: true })
    expect(p.rollTimer).toBeLessThan(timerAfterFirst)
  })

  it('exposes roll progress 0..1 for the tumble animation', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    expect(p.rollProgress).toBeGreaterThanOrEqual(0)
    advance(p, ROLL_DURATION * 0.5, runRight)
    expect(p.rollProgress).toBeGreaterThan(0.4)
    expect(p.rollProgress).toBeLessThan(0.75)
  })
})
