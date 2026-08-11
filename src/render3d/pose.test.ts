import { describe, it, expect } from 'vitest'
import { poseFor, rootOffset } from './pose'
import { jungleExplorer, buildParts } from './model'
import { buildScene, bodyCentre, finalCentre, posedCentres, transformViaPart } from './scene'
import { rotateAbout } from './rotation'
import { normalize, sub, length, dot } from './vec3'
import { Player } from '../sim/player'
import type { PlayerInput } from '../sim/player'
import { TICK } from '../sim/constants'

const PARTS = buildParts(jungleExplorer)

const idle: PlayerInput = {
  move: { x: 0, y: 0 },
  moveMagnitude: 0,
  attack: false,
  roll: false,
  magic: false,
}
const swing: PlayerInput = { ...idle, attack: true }

const COMPASS = [
  { name: 'N', x: 0, y: 1 },
  { name: 'NE', x: 0.707, y: 0.707 },
  { name: 'E', x: 1, y: 0 },
  { name: 'SE', x: 0.707, y: -0.707 },
  { name: 'S', x: 0, y: -1 },
  { name: 'SW', x: -0.707, y: -0.707 },
  { name: 'W', x: -1, y: 0 },
  { name: 'NW', x: -0.707, y: 0.707 },
]

/** Where a cuboid's centre ends up, using the renderer's own transform. */
const centreOf = (player: Player, cuboidId: string) =>
  finalCentre(PARTS, poseFor(player), cuboidId)

/** Same, but before the whole-body rotation — for inspecting the tuck alone. */
const tuckedCentreOf = (player: Player, cuboidId: string) =>
  posedCentres(PARTS, poseFor(player)).get(cuboidId)!

function walkFor(seconds: number, dir = { x: 0, y: 1 }): Player {
  const p = new Player()
  const input = { ...idle, move: dir, moveMagnitude: 1 }
  for (let i = 0; i < Math.round(seconds / TICK); i++) p.tick(input)
  return p
}

function rollTo(progress: number, dir = { x: 0, y: 1 }): Player {
  const p = new Player()
  p.tick({ ...idle, move: dir, moveMagnitude: 1, roll: true })
  while (p.state === 'rolling' && p.rollProgress < progress) {
    p.tick({ ...idle, move: dir, moveMagnitude: 1 })
  }
  return p
}

function punchPeak(extraSwings = 0): Player {
  const p = new Player()
  p.tick(swing)
  for (let i = 0; i < extraSwings; i++) {
    while (p.state === 'attacking') p.tick(idle)
    p.tick(swing)
  }
  while (p.state === 'attacking' && p.attackProgress < 0.35) p.tick(idle)
  return p
}

describe('standing still', () => {
  it('has no rotation anywhere', () => {
    const pose = poseFor(new Player())
    for (const r of Object.values(pose)) {
      expect(r!.x).toBeCloseTo(0)
      expect(r!.z).toBeCloseTo(0)
    }
  })

  it('does not bob', () => {
    expect(rootOffset(new Player()).y).toBeCloseTo(0)
  })

  it('turns the body to face travel', () => {
    const p = new Player()
    p.facing = { x: 1, y: 0 }
    expect(poseFor(p).root!.y).toBeCloseTo(Math.PI / 2)
  })
})

describe('punch', () => {
  const SHOULDER_R = { x: 6, y: 24, z: 0 }

  // "irl they box with their arm stretched to the front". At full extension
  // the shoulder-to-fist vector must genuinely point forward.
  it('points the arm straight forward at full extension', () => {
    const p = punchPeak()
    const armId = poseFor(p).armR!.x < poseFor(p).armL!.x ? 'armR' : 'armL'
    const shoulder = armId === 'armR' ? SHOULDER_R : { x: -6, y: 24, z: 0 }
    const axis = normalize(sub(centreOf(p, armId), shoulder))
    expect(dot(axis, { x: 0, y: 0, z: 1 })).toBeGreaterThan(0.85)
  })

  // The shoulder itself moves when the torso leans, so this measures against
  // the transformed joint, not the rest-pose one.
  it('keeps the arm attached to the shoulder', () => {
    const p = punchPeak()
    const pose = poseFor(p)
    const rest = length(sub({ x: 6, y: 18, z: 0 }, SHOULDER_R))
    const shoulder = transformViaPart(PARTS, pose, 'armR', SHOULDER_R)
    expect(length(sub(posedCentres(PARTS, pose).get('armR')!, shoulder))).toBeCloseTo(rest)
  })

  // Facing east, the outstretched arm must render WIDER than it is tall. This
  // is the assertion that "it still looks vertical" would fail.
  it('renders the punching arm as a horizontal bar when facing east', () => {
    const p = punchPeak()
    p.facing = { x: 1, y: 0 }
    const pose = poseFor(p)
    const punchingId = Math.abs(pose.armL!.x) > Math.abs(pose.armR!.x) ? 'armL' : 'armR'
    const armFaces = buildScene(PARTS, pose).filter((f) => f.id === punchingId)
    expect(armFaces.length).toBeGreaterThan(0)
    const xs = armFaces.flatMap((f) => f.points.map((q) => q.sx))
    const ys = armFaces.flatMap((f) => f.points.map((q) => q.sy))
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys))
  })

  // Reach comes from the shoulder, not just the elbow: the torso twists so the
  // punching shoulder drives forward, exactly as a real jab does.
  it('drives the punching shoulder forward', () => {
    const p = punchPeak()
    const pose = poseFor(p)
    const punchingArm = Math.abs(pose.armL!.x) > Math.abs(pose.armR!.x) ? 'armL' : 'armR'
    const rest = punchingArm === 'armR' ? SHOULDER_R : { x: -6, y: 24, z: 0 }
    expect(transformViaPart(PARTS, pose, punchingArm, rest).z).toBeGreaterThan(1.5)
  })

  it('twists the other shoulder back', () => {
    const p = punchPeak()
    const pose = poseFor(p)
    const idleArm = Math.abs(pose.armL!.x) > Math.abs(pose.armR!.x) ? 'armR' : 'armL'
    const rest = idleArm === 'armR' ? SHOULDER_R : { x: -6, y: 24, z: 0 }
    expect(transformViaPart(PARTS, pose, idleArm, rest).z).toBeLessThan(0)
  })

  it('twists the opposite way for the opposite fist', () => {
    const a = poseFor(punchPeak(0)).torso!.y
    const b = poseFor(punchPeak(1)).torso!.y
    expect(Math.sign(a)).not.toBe(Math.sign(b))
  })

  it('reaches further than the arm length alone', () => {
    const p = punchPeak()
    const pose = poseFor(p)
    const punchingArm = Math.abs(pose.armL!.x) > Math.abs(pose.armR!.x) ? 'armL' : 'armR'
    const armCentre = posedCentres(PARTS, pose).get(punchingArm)!
    // Arm is 12 long, so its centre sits 6 ahead of a stationary shoulder.
    expect(armCentre.z).toBeGreaterThan(7.5)
  })

  it('leans the body into the punch rather than away from it', () => {
    expect(posedCentres(PARTS, poseFor(punchPeak())).get('torso')!.z).toBeGreaterThan(0)
  })

  it('unwinds the twist once the swing ends', () => {
    const p = new Player()
    p.tick(swing)
    while (p.state === 'attacking') p.tick(idle)
    expect(poseFor(p).torso!.y).toBeCloseTo(0)
  })

  it('leaves the other arm hanging', () => {
    const p = punchPeak()
    expect(Math.abs(poseFor(p).armL!.x)).toBeLessThan(0.3)
  })

  it('strictly alternates fists', () => {
    const leading: string[] = []
    for (let i = 0; i < 6; i++) {
      const pose = poseFor(punchPeak(i))
      leading.push(Math.abs(pose.armL!.x) > Math.abs(pose.armR!.x) ? 'L' : 'R')
    }
    for (let i = 1; i < leading.length; i++) expect(leading[i]).not.toBe(leading[i - 1])
  })

  it('returns the arm to hanging afterwards', () => {
    const p = new Player()
    p.tick(swing)
    while (p.state === 'attacking') p.tick(idle)
    expect(poseFor(p).armR!.x).toBeCloseTo(0)
  })
})

describe('roll', () => {
  // Asserted as geometry, not as a raw angle: the sign that curls a limb
  // forward depends on whether it hangs below its joint or sits above it, so
  // an angle assertion would happily pass while he tucked backwards.
  // Asserted as geometry, not as a raw angle: the sign that curls a limb
  // forward depends on whether it hangs below its joint or sits above it, so
  // an angle assertion would happily pass while he tucked backwards.
  it('tucks the knees up and forward toward the chest', () => {
    const knee = tuckedCentreOf(rollTo(0.5), 'legL')
    expect(knee.y).toBeGreaterThan(6 + 6) // standing knee is at y=6
    expect(knee.z).toBeGreaterThan(2)
  })

  it('folds the head down over the knees', () => {
    const head = tuckedCentreOf(rollTo(0.5), 'head')
    expect(head.y).toBeLessThan(22) // standing head is at y=28
    expect(head.z).toBeGreaterThan(4)
  })

  // A ball means everything is close to the axis it turns about.
  it('keeps every part close to the roll axis', () => {
    const pose = poseFor(rollTo(0.5))
    const centre = bodyCentre(PARTS, pose)
    for (const [, p] of posedCentres(PARTS, pose)) {
      expect(length(sub(p, centre))).toBeLessThan(13)
    }
  })

  it('brings the hands down to the shins', () => {
    const p = rollTo(0.5)
    const hand = centreOf(p, 'armL')
    const shin = centreOf(p, 'legL')
    expect(length(sub(hand, shin))).toBeLessThan(7)
  })

  it('somersaults a full turn', () => {
    const near = rollTo(0.95)
    expect(poseFor(near).root!.x).toBeGreaterThan(Math.PI * 1.8)
  })

  it('stands up again afterwards', () => {
    const p = rollTo(0.5)
    while (p.state === 'rolling') p.tick(idle)
    const pose = poseFor(p)
    expect(pose.legL!.x).toBeCloseTo(0)
    expect(pose.root!.x).toBeCloseTo(0)
  })

  // The whole point of the rewrite: correct in EVERY direction, not just N/S.
  for (const dir of COMPASS) {
    it(`folds into a ball rolling ${dir.name}`, () => {
      const rolling = buildScene(PARTS, poseFor(rollTo(0.5, dir)))
      const standing = buildScene(PARTS, poseFor(new Player()))
      const height = (fs: typeof rolling) => {
        const ys = fs.flatMap((f) => f.points.map((p) => p.sy))
        return Math.max(...ys) - Math.min(...ys)
      }
      expect(height(rolling)).toBeLessThan(height(standing) * 0.75)
    })

    // Upside down halfway through, expressed relative to the body's own centre
    // rather than a magic height, so retuning the tuck cannot silently break it.
    it(`turns upside down halfway through the roll going ${dir.name}`, () => {
      const p = rollTo(0.5, dir)
      const pose = poseFor(p)
      const centre = bodyCentre(PARTS, pose)
      const tuckedHead = posedCentres(PARTS, pose).get('head')!
      expect(tuckedHead.y).toBeGreaterThan(centre.y) // head above centre when tucked
      expect(centreOf(p, 'head').y).toBeLessThan(centre.y) // and below it mid-roll
    })

    // Probe a point directly ABOVE the body centre. A quarter of the way into
    // a forward somersault it must have swung toward travel. Probing the head
    // instead would measure the tuck, since a tucked head starts low already.
    it(`somersaults forward, not backward, going ${dir.name}`, () => {
      const pose = poseFor(rollTo(0.25, dir))
      const centre = bodyCentre(PARTS, pose)
      const above = { x: centre.x, y: centre.y + 10, z: centre.z }
      const swung = rotateAbout(above, centre, pose.root!)
      const forward = { x: dir.x, y: 0, z: dir.y }
      expect(dot(normalize(sub(swung, centre)), forward)).toBeGreaterThan(0.6)
    })
  }
})

describe('walk', () => {
  it('swings the legs in opposite phase to the arms', () => {
    let sawOpposite = false
    for (let i = 1; i < 50; i++) {
      const pose = poseFor(walkFor(i * 0.02))
      if (Math.abs(pose.legL!.x) > 0.15) {
        expect(Math.sign(pose.armL!.x)).not.toBe(Math.sign(pose.legL!.x))
        sawOpposite = true
      }
    }
    expect(sawOpposite).toBe(true)
  })

  it('swings the two legs against each other', () => {
    const pose = poseFor(walkFor(0.3))
    expect(Math.sign(pose.legL!.x)).not.toBe(Math.sign(pose.legR!.x))
  })

  // Rotation, not translation: the boot can never leave the end of the leg.
  it('keeps the boot at the end of the leg throughout', () => {
    const hip = { x: -2, y: 12, z: 0 }
    const rest = length(sub({ x: -2, y: 1.5, z: 0.3 }, hip))
    for (let i = 1; i < 30; i++) {
      expect(length(sub(centreOf(walkFor(i * 0.02), 'bootL'), hip))).toBeCloseTo(rest, 4)
    }
  })

  // Asserted as geometry rather than as an angle sign, because nothing guarded
  // this before and the torso was quietly leaning AWAY from travel.
  it('leans into the walk rather than away from it', () => {
    expect(posedCentres(PARTS, poseFor(walkFor(0.3))).get('torso')!.z).toBeGreaterThan(0)
  })

  it('stands upright again when it stops', () => {
    const p = walkFor(0.3)
    p.tick(idle)
    expect(posedCentres(PARTS, poseFor(p)).get('torso')!.z).toBeCloseTo(0)
  })

  it('bobs the body up and down', () => {
    const heights = new Set<number>()
    for (let i = 1; i < 30; i++) heights.add(Math.round(rootOffset(walkFor(i * 0.02)).y * 100))
    expect(heights.size).toBeGreaterThan(3)
  })

  it('never drives a foot through the floor', () => {
    for (let i = 1; i < 40; i++) {
      const p = walkFor(i * 0.02)
      for (const f of buildScene(PARTS, poseFor(p))) {
        for (const q of f.points) expect(q.sy).toBeLessThan(40)
      }
    }
  })
})
