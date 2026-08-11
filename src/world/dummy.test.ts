import { describe, it, expect } from 'vitest'
import { buildDummies, dummyPose } from './dummy'
import { buildScene, posedCentres } from '../render3d/scene'
import { DUMMY_SPOTS } from './village'
import { tickTarget } from '../sim/combat'

const DUMMIES = buildDummies()

describe('dummies', () => {
  it('makes one per spot in the training yard', () => {
    expect(DUMMIES).toHaveLength(DUMMY_SPOTS.length)
  })

  it('gives each a unique id', () => {
    expect(new Set(DUMMIES.map((d) => d.id)).size).toBe(DUMMIES.length)
  })

  it('starts unhit', () => {
    for (const d of DUMMIES) {
      expect(d.hitTimer).toBe(0)
      expect(d.lastHitSwing).toBe(-1)
    }
  })

  it('stands on the ground', () => {
    for (const part of DUMMIES[0]!.parts) {
      for (const c of part.cuboids) {
        expect(c.pos.y - c.size.h / 2).toBeGreaterThanOrEqual(-0.001)
      }
    }
  })

  it('renders something visible', () => {
    expect(buildScene(DUMMIES[0]!.parts, dummyPose(DUMMIES[0]!)).length).toBeGreaterThan(5)
  })

  it('paints its face as a decal so it never shows from behind', () => {
    const face = DUMMIES[0]!.parts.flatMap((p) => p.cuboids).find((c) => c.id === 'dFace')!
    expect(face.decal).toBe(true)
  })
})

describe('rock-back', () => {
  const hit = (facing = { x: 0, y: 1 }) => {
    const d = buildDummies()[0]!
    d.hitTimer = 0.32
    d.facingHit = facing
    return d
  }

  it('stands straight when it has not been hit', () => {
    expect(dummyPose(buildDummies()[0]!).torso!.x).toBeCloseTo(0)
  })

  it('leans when struck', () => {
    expect(Math.abs(dummyPose(hit()).torso!.x)).toBeGreaterThan(0.1)
  })

  // The post is driven into the ground; only what is lashed above the collar
  // takes the punch.
  it('never moves the post, whichever way it is hit', () => {
    for (const facing of [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]) {
      const d = hit(facing)
      const post = posedCentres(d.parts, dummyPose(d)).get('dPost')!
      const rest = d.parts.flatMap((p) => p.cuboids).find((c) => c.id === 'dPost')!.pos
      expect(post.x).toBeCloseTo(rest.x)
      expect(post.y).toBeCloseTo(rest.y)
      expect(post.z).toBeCloseTo(rest.z)
    }
  })

  it('does move the head', () => {
    const d = hit()
    const head = posedCentres(d.parts, dummyPose(d)).get('dHead')!
    const rest = d.parts.flatMap((p) => p.cuboids).find((c) => c.id === 'dHead')!.pos
    expect(Math.hypot(head.x - rest.x, head.y - rest.y, head.z - rest.z)).toBeGreaterThan(2)
  })

  it('folds away along the direction the punch travelled', () => {
    const north = posedCentres(hit({ x: 0, y: 1 }).parts, dummyPose(hit({ x: 0, y: 1 }))).get('dHead')!
    expect(north.z).toBeGreaterThan(1)

    const east = posedCentres(hit({ x: 1, y: 0 }).parts, dummyPose(hit({ x: 1, y: 0 }))).get('dHead')!
    expect(east.x).toBeGreaterThan(1)

    const west = posedCentres(hit({ x: -1, y: 0 }).parts, dummyPose(hit({ x: -1, y: 0 }))).get('dHead')!
    expect(west.x).toBeLessThan(-1)
  })

  it('never spins to face the blow, so the painted face stays put', () => {
    for (const facing of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
      expect(dummyPose(hit(facing)).root!.y).toBeCloseTo(0)
    }
  })

  it('settles back upright', () => {
    const d = hit()
    for (let i = 0; i < 100; i++) tickTarget(d)
    expect(d.hitTimer).toBe(0)
    expect(dummyPose(d).torso!.x).toBeCloseTo(0)
  })

  it('overshoots once rather than snapping straight back', () => {
    const d = hit()
    const samples: number[] = []
    for (let i = 0; i < 20; i++) {
      samples.push(dummyPose(d).torso!.x)
      tickTarget(d)
    }
    // A pure decay never changes sign; a wobble does.
    const signs = new Set(samples.filter((s) => Math.abs(s) > 0.01).map(Math.sign))
    expect(signs.size).toBeGreaterThan(1)
  })
})
