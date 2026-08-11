import { describe, it, expect } from 'vitest'
import { Player } from './player'
import type { PlayerInput } from './player'

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}
const castMagic: PlayerInput = { ...idle, magic: true }

describe('Player magic', () => {
  it('starts with no magic item', () => {
    expect(new Player().hasMagicItem).toBe(false)
  })

  it('does nothing when no magic item is equipped', () => {
    const p = new Player()
    p.tick(castMagic)
    expect(p.state).toBe('idle')
    expect(p.magicUses).toBe(0)
  })

  it('fires once a magic item is equipped', () => {
    const p = new Player()
    p.hasMagicItem = true
    p.tick(castMagic)
    expect(p.magicUses).toBe(1)
  })

  it('cannot cast mid-roll', () => {
    const p = new Player()
    p.hasMagicItem = true
    p.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1, roll: true })
    p.tick(castMagic)
    expect(p.magicUses).toBe(0)
  })
})
