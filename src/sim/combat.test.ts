import { describe, it, expect } from 'vitest'
import {
  attackHitbox,
  resolveHits,
  comboDamage,
  Feedback,
  tickTarget,
  STRIKE_START,
  STRIKE_END,
  FIST_REACH,
  HITSTOP_SECONDS,
} from './combat'
import type { Target } from './combat'
import { Player } from './player'
import type { PlayerInput } from './player'
import { TICK } from './constants'

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}
const swing: PlayerInput = { ...idle, attack: true }

const dummy = (x: number, y: number): Target => ({
  pos: { x, y },
  radius: 0.8,
  lastHitSwing: -1,
  hitTimer: 0,
  facingHit: { x: 0, y: 0 },
})

/** Swing and advance into the strike window. */
function striking(): Player {
  const p = new Player()
  p.tick(swing)
  while (p.state === 'attacking' && p.attackProgress < STRIKE_START + 0.05) p.tick(idle)
  return p
}

describe('attackHitbox', () => {
  it('is absent when standing still', () => {
    expect(attackHitbox(new Player())).toBeNull()
  })

  it('is absent while rolling', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 0, y: 1 }, moveMagnitude: 1, roll: true })
    expect(attackHitbox(p)).toBeNull()
  })

  // A swing should have a MOMENT of impact, not a damage aura for its whole
  // duration — that is the difference between a punch and a lawnmower.
  it('is absent at the very start of a swing', () => {
    const p = new Player()
    p.tick(swing)
    expect(p.attackProgress).toBeLessThan(STRIKE_START)
    expect(attackHitbox(p)).toBeNull()
  })

  it('appears inside the strike window', () => {
    expect(attackHitbox(striking())).not.toBeNull()
  })

  it('is gone again by the end of the swing', () => {
    const p = new Player()
    p.tick(swing)
    while (p.state === 'attacking' && p.attackProgress < STRIKE_END + 0.05) p.tick(idle)
    if (p.state === 'attacking') expect(attackHitbox(p)).toBeNull()
  })

  it('sits in front of the player', () => {
    const p = striking()
    const box = attackHitbox(p)!
    expect(box.pos.y).toBeCloseTo(FIST_REACH) // default facing is +y
    expect(box.pos.x).toBeCloseTo(0)
  })

  // Measured relative to the player, who has taken a step while turning east.
  it('follows the direction the player faces', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 })
    p.tick(swing)
    while (p.state === 'attacking' && p.attackProgress < STRIKE_START + 0.05) p.tick(idle)
    const box = attackHitbox(p)!
    expect(box.pos.x - p.pos.x).toBeCloseTo(FIST_REACH)
    expect(box.pos.y - p.pos.y).toBeCloseTo(0)
  })
})

describe('resolveHits', () => {
  it('hits a dummy standing in front', () => {
    expect(resolveHits(striking(), [dummy(0, FIST_REACH)])).toHaveLength(1)
  })

  it('misses a dummy standing behind', () => {
    expect(resolveHits(striking(), [dummy(0, -FIST_REACH)])).toHaveLength(0)
  })

  it('misses a dummy standing out of reach', () => {
    expect(resolveHits(striking(), [dummy(0, 8)])).toHaveLength(0)
  })

  // The bug this exists to prevent: the hitbox is live for roughly a dozen
  // ticks, so without a guard one punch deals a dozen hits.
  it('lands exactly once per swing, however long the hitbox is live', () => {
    const p = new Player()
    const target = dummy(0, FIST_REACH)
    let hits = 0
    p.tick(swing)
    while (p.state === 'attacking') {
      hits += resolveHits(p, [target]).length
      p.tick(idle)
    }
    expect(hits).toBe(1)
  })

  it('can hit again on the next swing', () => {
    const p = new Player()
    const target = dummy(0, FIST_REACH)
    let hits = 0
    for (let s = 0; s < 3; s++) {
      p.tick(swing)
      while (p.state === 'attacking') {
        hits += resolveHits(p, [target]).length
        p.tick(idle)
      }
    }
    expect(hits).toBe(3)
  })

  it('hits several dummies at once', () => {
    const targets = [dummy(-0.5, FIST_REACH), dummy(0.5, FIST_REACH)]
    expect(resolveHits(striking(), targets)).toHaveLength(2)
  })

  it('rocks the dummy it hits', () => {
    const target = dummy(0, FIST_REACH)
    resolveHits(striking(), [target])
    expect(target.hitTimer).toBeGreaterThan(0)
  })

  it('does nothing when nobody is swinging', () => {
    expect(resolveHits(new Player(), [dummy(0, FIST_REACH)])).toHaveLength(0)
  })
})

describe('damage', () => {
  it('makes the third combo hit the heavy one', () => {
    expect(comboDamage(2)).toBeGreaterThan(comboDamage(0))
    expect(comboDamage(2)).toBeGreaterThan(comboDamage(1))
  })

  it('falls back safely for an out-of-range step', () => {
    expect(comboDamage(99)).toBeGreaterThan(0)
  })
})

describe('Feedback', () => {
  const hit = (damage: number) => ({
    target: dummy(0, 1),
    damage,
    at: { x: 0, y: 1 },
  })

  it('pops a damage number on a hit', () => {
    const f = new Feedback()
    f.onHit(hit(9))
    expect(f.numbers).toHaveLength(1)
    expect(f.numbers[0]!.value).toBe(9)
  })

  // Screenshake was removed on purpose: on a handheld screen it reads as the
  // picture wobbling rather than as impact.
  it('does not shake the screen', () => {
    const f = new Feedback()
    f.onHit(hit(30))
    expect('shake' in f).toBe(false)
  })

  it('freezes the sim briefly on impact, then releases it', () => {
    const f = new Feedback()
    f.onHit(hit(10))
    let frozen = 0
    for (let i = 0; i < 60; i++) if (f.tick()) frozen++
    expect(frozen).toBeGreaterThan(0)
    expect(frozen).toBeCloseTo(HITSTOP_SECONDS / TICK, 0)
    expect(f.tick()).toBe(false) // and it never wedges
  })

  // Numbers that are never removed are an unbounded array in a game loop.
  it('retires damage numbers once they expire', () => {
    const f = new Feedback()
    f.onHit(hit(10))
    for (let i = 0; i < 600; i++) f.tick()
    expect(f.numbers).toHaveLength(0)
  })
})

describe('tickTarget', () => {
  it('runs the rock-back down to zero and stops', () => {
    const t = dummy(0, 1)
    t.hitTimer = 0.2
    for (let i = 0; i < 100; i++) tickTarget(t)
    expect(t.hitTimer).toBe(0)
  })
})
