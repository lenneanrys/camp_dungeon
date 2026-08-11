import { describe, it, expect } from 'vitest'
import { Player } from './player'
import type { PlayerInput } from './player'
import { WALK_SPEED, TICK } from './constants'

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}

describe('Player movement', () => {
  it('starts still', () => {
    const p = new Player()
    p.tick(idle)
    expect(p.pos).toEqual({ x: 0, y: 0 })
  })

  it('walks at WALK_SPEED with the stick fully pushed', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 })
    expect(p.pos.x).toBeCloseTo(WALK_SPEED * TICK)
  })

  it('walks slower with a partly pushed stick', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 0.5 })
    expect(p.pos.x).toBeCloseTo(WALK_SPEED * 0.5 * TICK)
  })

  it('moves diagonally at the same speed as straight', () => {
    const straight = new Player()
    straight.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 })

    const diagonal = new Player()
    diagonal.tick({ ...idle, move: { x: 1, y: 1 }, moveMagnitude: 1 })

    expect(Math.hypot(diagonal.pos.x, diagonal.pos.y)).toBeCloseTo(straight.pos.x)
  })

  it('faces the direction it moves', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 0, y: 1 }, moveMagnitude: 1 })
    expect(p.facing.y).toBeCloseTo(1)
  })

  it('keeps facing the last direction after the stick is released', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: -1, y: 0 }, moveMagnitude: 1 })
    p.tick(idle)
    expect(p.facing.x).toBeCloseTo(-1)
  })

  it('tracks distance travelled so the walk animation can use it', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 })
    expect(p.distanceTravelled).toBeCloseTo(WALK_SPEED * TICK)
  })
})
