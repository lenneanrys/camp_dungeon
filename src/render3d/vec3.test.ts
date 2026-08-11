import { describe, it, expect } from 'vitest'
import { add, sub, scale, dot, cross, length, normalize } from './vec3'

const X = { x: 1, y: 0, z: 0 }
const Y = { x: 0, y: 1, z: 0 }
const Z = { x: 0, y: 0, z: 1 }

describe('vec3', () => {
  it('adds and subtracts', () => {
    expect(add(X, Y)).toEqual({ x: 1, y: 1, z: 0 })
    expect(sub(X, X)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('scales', () => {
    expect(scale({ x: 1, y: -2, z: 3 }, 2)).toEqual({ x: 2, y: -4, z: 6 })
  })

  it('dots perpendicular vectors to zero', () => {
    expect(dot(X, Y)).toBe(0)
    expect(dot(X, X)).toBe(1)
  })

  // Right-hand rule: this decides which way face normals point, which decides
  // what gets culled. Getting it backwards turns the character inside out.
  it('crosses following the right-hand rule', () => {
    expect(cross(X, Y)).toEqual(Z)
    expect(cross(Y, Z)).toEqual(X)
    expect(cross(Z, X)).toEqual(Y)
  })

  it('produces a cross product perpendicular to both inputs', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { x: -2, y: 0.5, z: 1 }
    const c = cross(a, b)
    expect(dot(c, a)).toBeCloseTo(0)
    expect(dot(c, b)).toBeCloseTo(0)
  })

  it('measures length', () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBe(5)
  })

  it('normalizes to unit length', () => {
    expect(length(normalize({ x: 3, y: 4, z: 12 }))).toBeCloseTo(1)
  })

  it('normalizing zero returns zero, not NaN', () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})
