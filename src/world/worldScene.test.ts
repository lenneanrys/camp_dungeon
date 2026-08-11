import { describe, it, expect } from 'vitest'
import { collectScene } from './worldScene'
import { bakeProp } from './bake'
import { makeProp } from './prop'
import { PALETTE } from './palette'

const cube = [
  { id: 'body', pos: { x: 0, y: 8, z: 0 }, size: { w: 16, h: 16, d: 16 }, color: PALETTE.timber },
]

const at = (id: string, x: number, z: number) =>
  bakeProp(makeProp(id, { x, y: 0, z }, cube))

const VIEWPORT = { w: 800, h: 400 }
const ORIGIN = { x: 0, y: 0, z: 0 }

const ids = (entries: { id: string }[]) => entries.map((e) => e.id)

describe('collectScene', () => {
  // Ground position decides draw order: anything standing further back is
  // painted first. This is what makes walking behind a house work.
  it('sorts by ground depth, back to front', () => {
    const entries = collectScene([at('far', 0, -100), at('near', 0, 100)], [], ORIGIN, VIEWPORT)
    expect(ids(entries)).toEqual(['far', 'near'])
  })

  // Moving the camera shifts every depth by the same amount, so the order it
  // produces must not depend on where the camera stands. Uses a huge viewport
  // so culling cannot quietly answer the question instead of sorting.
  it('keeps the same order wherever the camera stands', () => {
    const props = [at('a', 0, -100), at('b', 0, 100)]
    const big = { w: 100000, h: 100000 }
    for (const z of [-500, -40, 0, 40, 500]) {
      expect(ids(collectScene(props, [], { x: 0, y: 0, z }, big))).toEqual(['a', 'b'])
    }
  })

  it('places an actor between the props it stands between', () => {
    const actor = { id: 'player', faces: [], pos: { x: 0, y: 0, z: 0 }, radius: 20 }
    const entries = collectScene([at('behind', 0, -100), at('front', 0, 100)], [actor], ORIGIN, VIEWPORT)
    expect(ids(entries)).toEqual(['behind', 'player', 'front'])
  })

  it('offsets each entry to its screen position relative to the camera', () => {
    const [entry] = collectScene([at('p', 100, 0)], [], ORIGIN, VIEWPORT)
    expect(entry!.screen.sx).toBeGreaterThan(0)
    const [shifted] = collectScene([at('p', 100, 0)], [], { x: 100, y: 0, z: 0 }, VIEWPORT)
    expect(shifted!.screen.sx).toBeCloseTo(0)
  })

  it('culls props far outside the viewport', () => {
    expect(collectScene([at('miles', 100000, 0)], [], ORIGIN, VIEWPORT)).toHaveLength(0)
  })

  // A building whose centre is off screen may still have half of it on screen.
  it('keeps a prop that straddles the viewport edge', () => {
    const edgeX = VIEWPORT.w / 2 / 2.4 // half the viewport in model units
    expect(collectScene([at('edge', edgeX, 0)], [], ORIGIN, VIEWPORT)).toHaveLength(1)
  })

  it('keeps everything when the camera sits in the middle of the village', () => {
    const props = [at('a', -60, -60), at('b', 60, -60), at('c', -60, 60), at('d', 60, 60)]
    expect(collectScene(props, [], ORIGIN, VIEWPORT)).toHaveLength(4)
  })

  it('returns nothing for an empty world', () => {
    expect(collectScene([], [], ORIGIN, VIEWPORT)).toHaveLength(0)
  })

  // A shadow lies flat on the floor, so it must sort by its footprint rather
  // than by however high its owner's geometry reaches.
  it('reports a ground depth that ignores the height bias', () => {
    const tall = bakeProp(
      makeProp('tower', { x: 0, y: 0, z: 0 }, [
        { id: 't', pos: { x: 0, y: 45, z: 0 }, size: { w: 20, h: 90, d: 20 }, color: PALETTE.stone },
      ]),
    )
    const [entry] = collectScene([tall], [], ORIGIN, VIEWPORT)
    expect(entry!.groundDepth).toBeLessThan(entry!.depth)
    expect(entry!.groundDepth).toBeCloseTo(0)
  })

  it('gives a flat prop the same ground depth as its sort depth', () => {
    const flat = bakeProp(
      makeProp('rug', { x: 0, y: 0, z: 40 }, [
        { id: 'r', pos: { x: 0, y: 0.5, z: 0 }, size: { w: 30, h: 1, d: 30 }, color: PALETTE.dirt },
      ]),
    )
    const [entry] = collectScene([flat], [], ORIGIN, VIEWPORT)
    expect(entry!.groundDepth).toBeCloseTo(entry!.depth, 0)
  })

  // Props sort by their centroid, so characters must too. Sorting a character
  // by his feet against a prop sorted by its middle puts every wall in front of
  // anyone standing before it.
  it('sorts a character by his centre of mass, not his feet', () => {
    const actor = { id: 'npc', faces: [], pos: { x: 0, y: 0, z: 0 }, radius: 20 }
    const [entry] = collectScene([], [actor], ORIGIN, VIEWPORT)
    expect(entry!.depth).toBeGreaterThan(entry!.groundDepth)
  })

  it('puts an NPC in front of a wall he is standing before', () => {
    // Wall 30 units further from the camera than the NPC.
    const theWall = bakeProp(
      makeProp('wall', { x: 0, y: 0, z: -30 }, [
        { id: 'w', pos: { x: 0, y: 22, z: 0 }, size: { w: 60, h: 44, d: 6 }, color: PALETTE.plaster },
      ]),
    )
    const npc = { id: 'npc', faces: [], pos: { x: 0, y: 0, z: 0 }, radius: 20 }
    expect(ids(collectScene([theWall], [npc], ORIGIN, VIEWPORT))).toEqual(['wall', 'npc'])
  })

  it('lets a character be overridden for an unusually tall body', () => {
    const short = { id: 'a', faces: [], pos: ORIGIN, radius: 20, centreY: 4 }
    const tall = { id: 'b', faces: [], pos: ORIGIN, radius: 20, centreY: 40 }
    const entries = collectScene([], [short, tall], ORIGIN, { w: 100000, h: 100000 })
    expect(ids(entries)).toEqual(['a', 'b'])
  })

  it('carries the shadow radius through to the entry', () => {
    const shadowed = bakeProp(makeProp('s', { x: 0, y: 0, z: 0 }, cube, { shadow: 9 }))
    expect(collectScene([shadowed], [], ORIGIN, VIEWPORT)[0]!.shadow).toBe(9)
  })
})
