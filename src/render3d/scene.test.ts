import { describe, it, expect } from 'vitest'
import { buildScene } from './scene'
import { dot } from './vec3'
import { TO_CAMERA } from './camera'
import { jungleExplorer, buildParts, PART_IDS } from './model'
import type { ModelPart, PartId } from './model'
import { NO_ROTATION } from './rotation'
import type { Rotation } from './rotation'

const noPose = (): Record<PartId, Rotation> =>
  Object.fromEntries(PART_IDS.map((id) => [id, { ...NO_ROTATION }])) as Record<PartId, Rotation>

const CUBE_PART: ModelPart[] = [
  {
    id: 'torso',
    pivot: { x: 0, y: 0, z: 0 },
    rotation: { ...NO_ROTATION },
    cuboids: [
      { id: 'cube', pos: { x: 0, y: 0, z: 0 }, size: { w: 10, h: 10, d: 10 }, color: '#808080' },
    ],
  },
]

const EXPLORER = buildParts(jungleExplorer)

describe('backface culling', () => {
  // The camera has elevation but no yaw, which keeps left and right perfectly
  // symmetric for gameplay. The cost is that an axis-aligned cube shows exactly
  // two faces — front and top — because both side normals are edge-on.
  it('shows exactly two faces of an axis-aligned cube', () => {
    const faces = buildScene(CUBE_PART, { torso: { x: 0, y: 0, z: 0 } })
    expect(faces.length).toBe(2)
    expect(faces.some((f) => f.normal.z > 0.9)).toBe(true)
    expect(faces.some((f) => f.normal.y > 0.9)).toBe(true)
  })

  it('shows a side face once the cube turns', () => {
    const faces = buildScene(CUBE_PART, { torso: { x: 0, y: 0.6, z: 0 } })
    expect(faces.some((f) => f.normal.x > 0.3)).toBe(true)
  })

  // Six would mean normals are inverted and the model renders inside-out.
  it('never shows more than three faces of a cube, at any rotation', () => {
    for (const a of [0.3, 1.1, Math.PI, 4.2, 5.9]) {
      const n = buildScene(CUBE_PART, { torso: { x: a, y: a * 0.7, z: a * 0.3 } }).length
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(3)
    }
  })

  // This used to assert `lit > 0`, which is true for EVERY face because
  // ambient light is 0.62 — it could not fail and said nothing about culling.
  // Test the actual culling criterion instead.
  it('never emits a face pointing away from the camera', () => {
    for (const f of buildScene(EXPLORER, noPose())) {
      expect(dot(f.normal, TO_CAMERA)).toBeGreaterThan(0)
    }
  })
})

describe('face sorting', () => {
  it('returns faces back to front', () => {
    const faces = buildScene(EXPLORER, noPose())
    for (let i = 1; i < faces.length; i++) {
      expect(faces[i]!.depth).toBeGreaterThanOrEqual(faces[i - 1]!.depth)
    }
  })

  it('projects four screen points per face', () => {
    for (const f of buildScene(EXPLORER, noPose())) {
      expect(f.points).toHaveLength(4)
      for (const p of f.points) {
        expect(Number.isFinite(p.sx)).toBe(true)
        expect(Number.isFinite(p.sy)).toBe(true)
      }
    }
  })

  it('never emits a zero-area face', () => {
    for (const f of buildScene(EXPLORER, noPose())) {
      const [a, b, c] = f.points
      const area = Math.abs((b!.sx - a!.sx) * (c!.sy - a!.sy) - (c!.sx - a!.sx) * (b!.sy - a!.sy))
      expect(area).toBeGreaterThan(1e-6)
    }
  })
})

describe('the face is visible', () => {
  const eyeFaces = <T extends { id: string }>(faces: T[]): T[] =>
    faces.filter((f) => f.id.startsWith('eye'))

  // The reported bug: standing still facing the camera, you could not see his
  // face at all.
  it('shows the eyes when standing still facing the camera', () => {
    expect(eyeFaces(buildScene(EXPLORER, noPose())).length).toBeGreaterThan(0)
  })

  it('draws the eyes after the front of the head, so they are not buried', () => {
    const faces = buildScene(EXPLORER, noPose())
    const eye = faces.findIndex((f) => f.id === 'eyeL' && f.normal.z > 0.9)
    const headFront = faces.findIndex((f) => f.id === 'head' && f.normal.z > 0.9)
    expect(eye).toBeGreaterThan(-1)
    expect(headFront).toBeGreaterThan(-1)
    expect(eye).toBeGreaterThan(headFront)
  })

  // The previous version of this test only compared draw ORDER among surviving
  // faces, so it passed vacuously when no eye faces survived AND passed when
  // they did survive but happened to be covered by the hat. It never checked
  // the thing it was named after. Eyes must not EXIST when facing away.
  it('emits no eye geometry at all when facing away from the camera', () => {
    for (let deg = 100; deg <= 260; deg += 20) {
      const pose = noPose()
      pose.root = { x: 0, y: (deg * Math.PI) / 180, z: 0 }
      expect(eyeFaces(buildScene(EXPLORER, pose)), `at ${deg} degrees`).toHaveLength(0)
    }
  })

  it('emits eye geometry across the whole front arc', () => {
    for (const deg of [-70, -35, 0, 35, 70]) {
      const pose = noPose()
      pose.root = { x: 0, y: (deg * Math.PI) / 180, z: 0 }
      expect(eyeFaces(buildScene(EXPLORER, pose)).length, `at ${deg} degrees`).toBeGreaterThan(0)
    }
  })

  // A decal has one face, so it can never present a back face to the camera.
  it('treats the eyes as decals rather than solids', () => {
    const eyes = eyeFaces(buildScene(EXPLORER, noPose()))
    expect(eyes).toHaveLength(2)
  })
})

describe('shading', () => {
  it('lights the top of a cube more brightly than its front', () => {
    const faces = buildScene(CUBE_PART, { torso: { x: 0, y: 0, z: 0 } })
    const top = faces.find((f) => f.normal.y > 0.9)!
    const front = faces.find((f) => f.normal.z > 0.9)!
    expect(top.lit).toBeGreaterThan(front.lit)
  })

  // Shading that follows the normal is most of what makes a rotation readable.
  it('changes face brightness as its part rotates', () => {
    const flat = buildScene(CUBE_PART, { torso: { x: 0, y: 0, z: 0 } }).map((f) => f.lit)
    const tipped = buildScene(CUBE_PART, { torso: { x: 0.9, y: 0, z: 0 } }).map((f) => f.lit)
    expect(tipped).not.toEqual(flat)
  })

  it('keeps every face within the ambient-to-full range', () => {
    for (const f of buildScene(EXPLORER, noPose())) {
      expect(f.lit).toBeGreaterThan(0.5)
      expect(f.lit).toBeLessThanOrEqual(1.0001)
    }
  })
})
