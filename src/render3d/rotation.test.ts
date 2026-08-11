import { describe, it, expect } from 'vitest'
import { rotateX, rotateY, rotateZ, rotateAbout, NO_ROTATION } from './rotation'
import { length, sub } from './vec3'

const ORIGIN = { x: 0, y: 0, z: 0 }
const QUARTER = Math.PI / 2

describe('axis rotations', () => {
  it('are the identity at zero', () => {
    const p = { x: 1, y: 2, z: 3 }
    for (const rot of [rotateX, rotateY, rotateZ]) {
      const r = rot(p, 0)
      expect(r.x).toBeCloseTo(1)
      expect(r.y).toBeCloseTo(2)
      expect(r.z).toBeCloseTo(3)
    }
  })

  // +y to +z is what makes a hanging arm swing FORWARD into a punch, and a
  // body tumble go forward rather than backward.
  it('rotateX sends +y to +z', () => {
    const r = rotateX({ x: 0, y: 1, z: 0 }, QUARTER)
    expect(r.y).toBeCloseTo(0)
    expect(r.z).toBeCloseTo(1)
  })

  it('rotateY sends +z to +x, so yaw follows the facing angle', () => {
    const r = rotateY({ x: 0, y: 0, z: 1 }, QUARTER)
    expect(r.x).toBeCloseTo(1)
    expect(r.z).toBeCloseTo(0)
  })

  it('rotateZ sends +x to +y', () => {
    const r = rotateZ({ x: 1, y: 0, z: 0 }, QUARTER)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(1)
  })

  it('leave their own axis untouched', () => {
    expect(rotateX({ x: 7, y: 1, z: 1 }, 1.3).x).toBeCloseTo(7)
    expect(rotateY({ x: 1, y: 7, z: 1 }, 1.3).y).toBeCloseTo(7)
    expect(rotateZ({ x: 1, y: 1, z: 7 }, 1.3).z).toBeCloseTo(7)
  })

  it('preserve length', () => {
    const p = { x: 1, y: -2, z: 3 }
    for (const rot of [rotateX, rotateY, rotateZ]) {
      for (const a of [0.4, 1.9, 3.7, 5.5]) {
        expect(length(rot(p, a))).toBeCloseTo(length(p))
      }
    }
  })

  it('return to start after a full turn', () => {
    const p = { x: 1, y: -2, z: 3 }
    const r = rotateX(rotateY(rotateZ(p, Math.PI * 2), Math.PI * 2), Math.PI * 2)
    expect(r.x).toBeCloseTo(1)
    expect(r.y).toBeCloseTo(-2)
    expect(r.z).toBeCloseTo(3)
  })
})

describe('rotateAbout', () => {
  const HIP = { x: -2, y: 12, z: 0 }

  it('leaves the pivot itself fixed', () => {
    const r = rotateAbout(HIP, HIP, { x: 1.1, y: 0.4, z: -0.7 })
    expect(r.x).toBeCloseTo(HIP.x)
    expect(r.y).toBeCloseTo(HIP.y)
    expect(r.z).toBeCloseTo(HIP.z)
  })

  it('does nothing with no rotation', () => {
    const p = { x: -2, y: 6, z: 0 }
    const r = rotateAbout(p, HIP, NO_ROTATION)
    expect(r.x).toBeCloseTo(p.x)
    expect(r.y).toBeCloseTo(p.y)
    expect(r.z).toBeCloseTo(p.z)
  })

  // The single most important property in the whole renderer: limbs must
  // rotate about their joint, never stretch away from it.
  it('preserves distance from the pivot', () => {
    const foot = { x: -2, y: 1.5, z: 0 }
    const rest = length(sub(foot, HIP))
    for (const a of [0.3, 1.2, 2.4, 4.8]) {
      expect(length(sub(rotateAbout(foot, HIP, { x: a, y: 0, z: 0 }), HIP))).toBeCloseTo(rest)
      expect(length(sub(rotateAbout(foot, HIP, { x: a, y: a, z: a }), HIP))).toBeCloseTo(rest)
    }
  })

  // Sign convention, worth pinning down because limbs hang BELOW their joint:
  // a negative pitch swings a hanging limb forward, positive swings it back.
  // Getting this backwards makes the character punch and walk in reverse.
  it('swings a hanging limb forward on a negative pitch', () => {
    const knee = { x: -2, y: 6, z: 0 }
    const swung = rotateAbout(knee, HIP, { x: -QUARTER, y: 0, z: 0 })
    expect(swung.z).toBeGreaterThan(4)
    expect(swung.y).toBeCloseTo(HIP.y)
  })

  it('swings a hanging limb backward on a positive pitch', () => {
    const knee = { x: -2, y: 6, z: 0 }
    expect(rotateAbout(knee, HIP, { x: QUARTER, y: 0, z: 0 }).z).toBeLessThan(-4)
  })

  it('rotates about the origin when the pivot is the origin', () => {
    const p = { x: 0, y: 1, z: 0 }
    const r = rotateAbout(p, ORIGIN, { x: QUARTER, y: 0, z: 0 })
    expect(r.z).toBeCloseTo(1)
  })
})
