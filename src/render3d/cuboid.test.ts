import { describe, it, expect } from 'vitest'
import { corners, faces } from './cuboid'
import type { Cuboid } from './cuboid'
import { dot, sub, length } from './vec3'

const CUBE: Cuboid = {
  pos: { x: 0, y: 0, z: 0 },
  size: { w: 2, h: 2, d: 2 },
  color: '#ffffff',
}

const BRICK: Cuboid = {
  pos: { x: 1, y: 5, z: -2 },
  size: { w: 4, h: 12, d: 6 },
  color: '#abcdef',
}

const key = (p: { x: number; y: number; z: number }) => `${p.x},${p.y},${p.z}`

describe('corners', () => {
  it('produces 8 distinct corners', () => {
    const c = corners(CUBE)
    expect(c).toHaveLength(8)
    expect(new Set(c.map(key)).size).toBe(8)
  })

  it('places every corner at half-size on each axis', () => {
    for (const c of corners(BRICK)) {
      expect(Math.abs(c.x - BRICK.pos.x)).toBeCloseTo(BRICK.size.w / 2)
      expect(Math.abs(c.y - BRICK.pos.y)).toBeCloseTo(BRICK.size.h / 2)
      expect(Math.abs(c.z - BRICK.pos.z)).toBeCloseTo(BRICK.size.d / 2)
    }
  })
})

describe('faces', () => {
  it('produces 6 faces of 4 corners each', () => {
    const f = faces(BRICK)
    expect(f).toHaveLength(6)
    for (const face of f) expect(face.corners).toHaveLength(4)
  })

  // If a normal points inward the face gets culled when it should be drawn,
  // and the character renders inside-out.
  it('points every normal outward', () => {
    for (const face of faces(BRICK)) {
      const centre = face.corners.reduce(
        (a, c) => ({ x: a.x + c.x / 4, y: a.y + c.y / 4, z: a.z + c.z / 4 }),
        { x: 0, y: 0, z: 0 },
      )
      expect(dot(face.normal, sub(centre, BRICK.pos))).toBeGreaterThan(0)
    }
  })

  it('gives every normal unit length', () => {
    for (const face of faces(BRICK)) expect(length(face.normal)).toBeCloseTo(1)
  })

  it('covers all six axis directions exactly once', () => {
    const normals = faces(BRICK).map((f) => key(f.normal))
    expect(new Set(normals).size).toBe(6)
    for (const n of ['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1']) {
      expect(normals).toContain(n)
    }
  })

  it('uses each corner in exactly three faces', () => {
    const counts = new Map<string, number>()
    for (const face of faces(CUBE)) {
      for (const c of face.corners) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1)
    }
    expect(counts.size).toBe(8)
    for (const n of counts.values()) expect(n).toBe(3)
  })

  it('carries the cuboid colour onto every face', () => {
    for (const face of faces(BRICK)) expect(face.color).toBe(BRICK.color)
  })

  it('winds every face consistently, so a normal computed from the corners agrees', () => {
    for (const face of faces(BRICK)) {
      const [a, b, c] = face.corners
      const u = sub(b!, a!)
      const v = sub(c!, b!)
      const computed = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      }
      expect(dot(computed, face.normal)).toBeGreaterThan(0)
    }
  })
})
