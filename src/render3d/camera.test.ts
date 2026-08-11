import { describe, it, expect } from 'vitest'
import { project, depthOf, TO_CAMERA, SCALE } from './camera'
import { length } from './vec3'

const O = { x: 0, y: 0, z: 0 }

describe('camera', () => {
  it('projects the origin to screen zero', () => {
    expect(project(O)).toEqual({ sx: 0, sy: 0 })
  })

  it('maps world x straight across the screen', () => {
    expect(project({ x: 10, y: 0, z: 0 }).sx).toBeCloseTo(10 * SCALE)
  })

  it('maps height up the screen', () => {
    expect(project({ x: 0, y: 10, z: 0 }).sy).toBeLessThan(0)
  })

  it('maps depth down the screen', () => {
    expect(project({ x: 0, y: 0, z: 10 }).sy).toBeGreaterThan(0)
  })

  // A three-quarter view: height must be foreshortened, not drawn full size,
  // or the camera is looking side-on.
  it('foreshortens height', () => {
    expect(Math.abs(project({ x: 0, y: 10, z: 0 }).sy)).toBeLessThan(10 * SCALE)
  })

  it('treats height and depth symmetrically at 45 degrees', () => {
    expect(Math.abs(project({ x: 0, y: 10, z: 0 }).sy)).toBeCloseTo(
      project({ x: 0, y: 0, z: 10 }).sy,
    )
  })
})

describe('depth', () => {
  it('is larger for points nearer the camera', () => {
    expect(depthOf({ x: 0, y: 0, z: 5 })).toBeGreaterThan(depthOf({ x: 0, y: 0, z: -5 }))
  })

  it('increases with height, since the camera looks down', () => {
    expect(depthOf({ x: 0, y: 5, z: 0 })).toBeGreaterThan(depthOf({ x: 0, y: -5, z: 0 }))
  })

  it('ignores sideways movement', () => {
    expect(depthOf({ x: 99, y: 1, z: 1 })).toBeCloseTo(depthOf({ x: -99, y: 1, z: 1 }))
  })
})

describe('TO_CAMERA', () => {
  it('is a unit vector', () => {
    expect(length(TO_CAMERA)).toBeCloseTo(1)
  })

  it('points up and toward the viewer', () => {
    expect(TO_CAMERA.y).toBeGreaterThan(0)
    expect(TO_CAMERA.z).toBeGreaterThan(0)
    expect(TO_CAMERA.x).toBe(0)
  })
})
