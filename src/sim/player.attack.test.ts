import { describe, it, expect } from 'vitest'
import { Player } from './player'
import type { PlayerInput } from './player'
import {
  TICK,
  WALK_SPEED,
  ATTACK_DURATIONS,
  ATTACK_COMBO_WINDOW,
  ATTACK_MOVE_MULT,
} from './constants'

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}
const runRight: PlayerInput = { ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 }
const swing: PlayerInput = { ...idle, attack: true }

const SWING_1 = ATTACK_DURATIONS[0]!
const SWING_2 = ATTACK_DURATIONS[1]!
const SWING_3 = ATTACK_DURATIONS[2]!

function advance(p: Player, seconds: number, input: PlayerInput = idle): void {
  for (let i = 0; i < Math.round(seconds / TICK); i++) p.tick(input)
}

describe('Player attack', () => {
  it('enters the attacking state and starts at combo step 0', () => {
    const p = new Player()
    p.tick(swing)
    expect(p.state).toBe('attacking')
    expect(p.comboStep).toBe(0)
  })

  it('finishes a swing and returns to idle', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, SWING_1)
    expect(p.state).toBe('idle')
  })

  it('chains to the next combo step inside the window', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, SWING_1)
    p.tick(swing)
    expect(p.comboStep).toBe(1)
  })

  it('wraps back to step 0 after the third swing', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, SWING_1)
    p.tick(swing)
    advance(p, SWING_2)
    p.tick(swing)
    expect(p.comboStep).toBe(2)
    advance(p, SWING_3)
    p.tick(swing)
    expect(p.comboStep).toBe(0)
  })

  it('resets the combo once the window lapses', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, SWING_1 + ATTACK_COMBO_WINDOW + 0.05)
    p.tick(swing)
    expect(p.comboStep).toBe(0)
  })

  it('holding the button does not restart a swing mid-swing', () => {
    const p = new Player()
    p.tick(swing)
    const t = p.attackTimer
    p.tick(swing)
    expect(p.attackTimer).toBeLessThan(t)
  })

  // Rooting the player mid-swing feels awful on a touchscreen: you commit to a
  // punch and then watch yourself get hit. Slowed, never stopped.
  it('moves slowly while swinging instead of being rooted', () => {
    const p = new Player()
    p.tick({ ...runRight, attack: true })
    const before = p.pos.x
    p.tick(runRight)
    const step = p.pos.x - before
    expect(step).toBeGreaterThan(0)
    expect(step).toBeCloseTo(WALK_SPEED * ATTACK_MOVE_MULT * TICK, 4)
  })

  it('cannot attack while rolling', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    p.tick(swing)
    expect(p.state).toBe('rolling')
  })

  // The escape hatch that keeps combat feeling responsive rather than committal.
  it('rolling cancels an attack', () => {
    const p = new Player()
    p.tick(swing)
    p.tick({ ...idle, roll: true })
    expect(p.state).toBe('rolling')
  })

  it('exposes swing progress 0..1 for the animation', () => {
    const p = new Player()
    p.tick(swing)
    expect(p.attackProgress).toBeGreaterThanOrEqual(0)
    advance(p, SWING_1 * 0.5)
    expect(p.attackProgress).toBeGreaterThan(0.4)
    expect(p.attackProgress).toBeLessThan(0.7)
  })

  it('reports zero swing progress when not attacking', () => {
    const p = new Player()
    p.tick(idle)
    expect(p.attackProgress).toBe(0)
  })
})
