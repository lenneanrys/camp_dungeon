import { describe, it, expect } from 'vitest'
import { length, normalize, clampLength, scale } from './vec2'

describe('vec2', () => {
  it('measures length', () => {
    expect(length({ x: 3, y: 4 })).toBe(5)
  })

  it('normalizes to unit length', () => {
    const n = normalize({ x: 0, y: 9 })
    expect(n.x).toBeCloseTo(0)
    expect(n.y).toBeCloseTo(1)
  })

  // A joystick released exactly on its origin divides by zero. NaN positions
  // silently teleport the player into nowhere, so this case must be explicit.
  it('normalizing a zero vector returns zero, not NaN', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('clampLength caps long vectors but leaves short ones alone', () => {
    expect(length(clampLength({ x: 10, y: 0 }, 4))).toBeCloseTo(4)
    expect(clampLength({ x: 1, y: 0 }, 4)).toEqual({ x: 1, y: 0 })
  })

  it('scales', () => {
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 })
  })
})
