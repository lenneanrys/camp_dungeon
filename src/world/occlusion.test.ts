import { describe, it, expect } from 'vitest'
import { occluders, hiddenBySolid, pointInFace, OCCLUDED_ALPHA } from './occlusion'
import type { SceneEntry } from './worldScene'

/** A wall 100 wide and 160 tall, standing on the entry's own origin. */
const wall = (
  id: string,
  sx: number,
  sy: number,
  depth: number,
  fadeable = true,
): SceneEntry => ({
  id,
  faces: [
    {
      id,
      points: [
        { sx: -50, sy: -160 },
        { sx: 50, sy: -160 },
        { sx: 50, sy: 0 },
        { sx: -50, sy: 0 },
      ],
      depth,
      normal: { x: 0, y: 0, z: 1 },
      color: '#ffffff',
      lit: 1,
    },
  ],
  screen: { sx, sy },
  depth,
  groundDepth: depth,
  fadeable,
  entity: false,
})

/** A wall whose sort depth is inflated by its height, as a real wall's is. */
const tallWall = (
  id: string,
  sx: number,
  sy: number,
  groundDepth: number,
  heightBias: number,
): SceneEntry => ({
  ...wall(id, sx, sy, groundDepth),
  depth: groundDepth + heightBias,
  groundDepth,
})

const PLAYER = { screen: { sx: 0, sy: -30 }, depth: 0 }

describe('pointInFace', () => {
  const square = [
    { sx: 0, sy: 0 },
    { sx: 10, sy: 0 },
    { sx: 10, sy: 10 },
    { sx: 0, sy: 10 },
  ]

  it('finds a point inside', () => {
    expect(pointInFace(5, 5, square)).toBe(true)
  })

  it('rejects points outside on every side', () => {
    expect(pointInFace(-1, 5, square)).toBe(false)
    expect(pointInFace(11, 5, square)).toBe(false)
    expect(pointInFace(5, -1, square)).toBe(false)
    expect(pointInFace(5, 11, square)).toBe(false)
  })

  // Bounding boxes cannot do this; the roof of a gable is a genuine triangle.
  it('respects a sloped edge instead of its bounding box', () => {
    const triangle = [
      { sx: 0, sy: 10 },
      { sx: 10, sy: 10 },
      { sx: 5, sy: 0 },
    ]
    expect(pointInFace(5, 5, triangle)).toBe(true)
    expect(pointInFace(0.5, 1, triangle)).toBe(false) // inside the box, outside the shape
  })
})

describe('hiddenBySolid', () => {
  const solid = (id: string, sx: number, sy: number, groundDepth: number): SceneEntry => ({
    ...wall(id, sx, sy, groundDepth, false),
    groundDepth,
  })

  // A curtain wall stays solid on purpose, so it swallows the player when he
  // walks up against it. The caller draws his silhouette on top instead.
  it('spots a solid wall covering the player', () => {
    expect(hiddenBySolid([solid('wall', 0, 40, 20)], PLAYER)).toBe(true)
  })

  it('ignores a solid wall behind the player', () => {
    expect(hiddenBySolid([solid('wall', 0, 40, -20)], PLAYER)).toBe(false)
  })

  it('ignores a solid wall off to the side', () => {
    expect(hiddenBySolid([solid('wall', 400, 40, 20)], PLAYER)).toBe(false)
  })

  // Something that fades already leaves him visible; no silhouette needed.
  it('ignores scenery that will fade anyway', () => {
    expect(hiddenBySolid([wall('house', 0, 40, 20, true)], PLAYER)).toBe(false)
  })

  it('never counts another character as hiding the player', () => {
    const npc: SceneEntry = { ...solid('npc', 0, 40, 20), entity: true }
    expect(hiddenBySolid([npc], PLAYER)).toBe(false)
  })

  it('finds nothing in an empty world', () => {
    expect(hiddenBySolid([], PLAYER)).toBe(false)
  })
})

describe('occluders', () => {
  it('fades a building that genuinely covers the player', () => {
    expect(occluders([wall('house', 0, 40, 100)], PLAYER).has('house')).toBe(true)
  })

  it('ignores a building behind the player', () => {
    expect(occluders([wall('house', 0, 40, -100)], PLAYER).size).toBe(0)
  })

  // The reported bug: walking up ALONGSIDE a building faded it, because its
  // bounding box is far wider than the wall you are actually standing beside.
  it('does not fade a building you are merely standing next to', () => {
    expect(occluders([wall('house', 120, 40, 100)], PLAYER).size).toBe(0)
  })

  it('does not fade a building you are standing just below', () => {
    expect(occluders([wall('house', 0, 400, 100)], PLAYER).size).toBe(0)
  })

  // Entities are never made see-through — that reads as a bug, not as depth.
  it('never fades an entity, however squarely it covers the player', () => {
    expect(occluders([wall('npc', 0, 40, 100, false)], PLAYER).size).toBe(0)
  })

  it('never fades a straw dummy', () => {
    expect(occluders([wall('dummy0', 0, 40, 100, false)], PLAYER).size).toBe(0)
  })

  it('fades several buildings at once when they stack up', () => {
    const found = occluders([wall('a', 0, 40, 100), wall('b', 20, 40, 120)], PLAYER)
    expect(found.size).toBe(2)
  })

  // The reported bug: walking up to a house from outside faded its front wall,
  // because the wall's height bias made it look nearer than the player.
  it('does not fade a wall the player is standing in front of', () => {
    // Ground depth 20 BEHIND the player, but a tall height bias on top.
    expect(occluders([tallWall('house', 0, 40, -20, 60)], PLAYER).size).toBe(0)
  })

  it('still fades a wall the player is genuinely behind', () => {
    expect(occluders([tallWall('house', 0, 40, 20, 60)], PLAYER).size).toBe(1)
  })

  it('finds nothing in an empty world', () => {
    expect(occluders([], PLAYER).size).toBe(0)
  })

  it('fades to something you can see through but still see', () => {
    expect(OCCLUDED_ALPHA).toBeGreaterThan(0.1)
    expect(OCCLUDED_ALPHA).toBeLessThan(0.7)
  })
})
