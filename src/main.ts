import { Player } from './sim/player'
import type { PlayerInput } from './sim/player'
import { TICK } from './sim/constants'
import { resolveCollisions } from './sim/collision'
import { resolveHits, tickTarget, Feedback } from './sim/combat'
import { TouchRouter } from './input/touchRouter'
import { DOWN_EVENT, MOVE_EVENT, RELEASE_EVENTS } from './input/pointerEvents'
import { jungleExplorer, buildParts } from './render3d/model'
import { buildScene } from './render3d/scene'
import { poseFor, rootOffset } from './render3d/pose'
import { drawFaces, drawShadow, drawSilhouette } from './render3d/draw'
import { SCALE, PITCH, project, depthOf } from './render3d/camera'
import { drawHud } from './render/hud'
import {
  buildVillage,
  SPAWN,
  villageColliders,
  buildingAt,
  plazaSignpost,
  SIGNPOST_POS,
} from './world/village'
import { bakeProp, bakeParts } from './world/bake'
import type { AABB } from './world/prop'
import { collectScene } from './world/worldScene'
import type { Actor, SceneEntry } from './world/worldScene'
import { occluders, hiddenBySolid, OCCLUDED_ALPHA } from './world/occlusion'
import { shellIds } from './world/interiors'
import { buildNpcs, npcPose, npcOffset, updateNpc } from './world/npc'
import { buildDummies, dummyPose } from './world/dummy'
import { buildGuards, updateGuard, guardPose, guardOffset } from './world/guard'
import { PALETTE, tint } from './world/palette'

/** Model units per world tile. The explorer is 36 units — a bit over two tiles. */
const TILE = 16
const TILE_W = TILE * SCALE
const TILE_H = TILE_W * Math.sin(PITCH) // the ground uses the same camera
const PLAYER_RADIUS = 5 / TILE
/** Colour of the player's outline when he is behind solid scenery. */
const SILHOUETTE = 'rgba(255, 233, 168, 0.92)'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

const player = new Player()
player.pos = { x: SPAWN.x / TILE, y: SPAWN.z / TILE }

const playerParts = buildParts(jungleExplorer)
const props = buildVillage()
const signpostModel = plazaSignpost()
const baked = [
  ...props.map(bakeProp),
  // Built from parts so its arms can point at real directions, then baked once
  // like any other prop.
  bakeParts('signpost', SIGNPOST_POS, signpostModel.parts, signpostModel.pose, { shadow: 9 }),
]

// Colliders are authored in model units; the sim thinks in tiles.
const simColliders: AABB[] = villageColliders(props).map((c) => ({
  minX: c.minX / TILE,
  maxX: c.maxX / TILE,
  minZ: c.minZ / TILE,
  maxZ: c.maxZ / TILE,
}))

const npcs = buildNpcs()
const guards = buildGuards()
const dummies = buildDummies()
const feedback = new Feedback()
const router = new TouchRouter(window.innerWidth, window.innerHeight)

let cssWidth = 0
let cssHeight = 0
let elapsed = 0

function resize(): void {
  const dpr = window.devicePixelRatio || 1
  cssWidth = canvas.clientWidth
  cssHeight = canvas.clientHeight
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  router.resize(cssWidth, cssHeight)
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => setTimeout(resize, 100))

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

canvas.addEventListener(DOWN_EVENT, (e) => {
  e.preventDefault()
  canvas.setPointerCapture(e.pointerId)
  const { x, y } = toCanvas(e)
  router.onDown(x, y, e.pointerId)
})

canvas.addEventListener(MOVE_EVENT, (e) => {
  e.preventDefault()
  const { x, y } = toCanvas(e)
  router.onMove(x, y, e.pointerId)
})

for (const type of RELEASE_EVENTS) {
  canvas.addEventListener(type, (e) => router.onUp(e.pointerId))
}

function readInput(): PlayerInput {
  return {
    move: router.joystick.direction,
    moveMagnitude: router.joystick.magnitude,
    attack: router.button('attack').justPressed,
    roll: router.button('roll').justPressed,
    magic: router.button('magic').justPressed,
  }
}

// ---------------------------------------------------------------- ground ---

const PLAZA = 150 // model units, half-width of the cobbled centre

/** Grass, worn dirt paths radiating from the plaza, cobbles in the middle. */
function groundColour(tx: number, tz: number): string {
  const x = tx * TILE
  const z = tz * TILE
  // Deterministic per-tile jitter so the ground is textured, not a chequerboard.
  const jitter = (((tx * 73856093) ^ (tz * 19349663)) % 100) / 100 - 0.5

  if (Math.abs(x) < PLAZA && Math.abs(z) < PLAZA) {
    return tint(PALETTE.cobble, jitter * 0.16)
  }
  // Paths along the two axes, linking the plaza to each shop.
  if (Math.abs(x) < 26 || Math.abs(z) < 26) {
    return tint(PALETTE.dirt, jitter * 0.14)
  }
  return tint(PALETTE.grass, jitter * 0.18)
}

function drawGround(camX: number, camZ: number): void {
  ctx.fillStyle = '#1d2716'
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  const originX = cssWidth / 2 - camX * TILE_W
  const originY = cssHeight / 2 - camZ * TILE_H

  const firstX = Math.floor(-originX / TILE_W) - 1
  const firstZ = Math.floor(-originY / TILE_H) - 1
  const cols = Math.ceil(cssWidth / TILE_W) + 2
  const rows = Math.ceil(cssHeight / TILE_H) + 2

  for (let i = 0; i < cols; i++) {
    for (let k = 0; k < rows; k++) {
      const tx = firstX + i
      const tz = firstZ + k
      ctx.fillStyle = groundColour(tx, tz)
      ctx.fillRect(originX + tx * TILE_W, originY + tz * TILE_H, TILE_W + 1, TILE_H + 1)
    }
  }
}

// ------------------------------------------------------------ damage text ---

function drawDamageNumbers(camera: { x: number; y: number; z: number }): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const n of feedback.numbers) {
    const t = n.age / n.life
    const world = {
      x: n.pos.x * TILE - camera.x,
      y: 34 + t * 26, // floats upward as it ages
      z: n.pos.y * TILE - camera.z,
    }
    const { sx, sy } = project(world)
    const alpha = 1 - t * t

    ctx.font = `bold ${Math.round(26 - t * 6)}px system-ui, sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.75})`
    ctx.strokeText(String(n.value), cssWidth / 2 + sx, cssHeight / 2 + sy)
    ctx.fillStyle = `rgba(255,226,140,${alpha})`
    ctx.fillText(String(n.value), cssWidth / 2 + sx, cssHeight / 2 + sy)
  }
}

// ------------------------------------------------------------------ loop ---

let accumulator = 0
let last = performance.now()

function step(): void {
  // Hitstop freezes the world for a few frames on impact — the single
  // cheapest thing that makes a punch feel like it landed.
  if (feedback.tick()) return

  const before = { ...player.pos }
  player.tick(readInput())
  player.pos = resolveCollisions(player.pos, PLAYER_RADIUS, simColliders)
  // Walking into a wall should stop the walk cycle, not moonwalk on the spot.
  if (player.pos.x === before.x && player.pos.y === before.y) player.isMoving = false

  for (const hit of resolveHits(player, dummies)) feedback.onHit(hit)
  for (const d of dummies) tickTarget(d)

  // Townsfolk notice you when you come within four tiles and turn to watch.
  const playerModel = { x: player.pos.x * TILE, z: player.pos.y * TILE }
  for (const npc of npcs) updateNpc(npc, playerModel, TICK)
  for (const guard of guards) updateGuard(guard, TICK)

  router.endTick()
  elapsed += TICK
}

function frame(now: number): void {
  accumulator += Math.min((now - last) / 1000, 0.25)
  last = now
  while (accumulator >= TICK) {
    step()
    accumulator -= TICK
  }

  const camera = { x: player.pos.x * TILE, y: 0, z: player.pos.y * TILE }
  drawGround(player.pos.x, player.pos.y)

  /**
   * Only build geometry for characters near the camera. Posing a body is the
   * most expensive thing in the frame, and with a full garrison most of them
   * are behind a wall on the far side of town.
   */
  const ACTOR_RANGE = 760
  const nearCamera = (x: number, z: number): boolean =>
    Math.abs(x - camera.x) < ACTOR_RANGE && Math.abs(z - camera.z) < ACTOR_RANGE

  const actors: Actor[] = [
    {
      id: 'player',
      faces: buildScene(playerParts, poseFor(player), rootOffset(player)),
      pos: { x: camera.x, y: 0, z: camera.z },
      radius: 24,
      shadow: player.state === 'rolling' ? 8 : 10,
    },
    ...npcs
      .filter((npc) => nearCamera(npc.pos.x, npc.pos.z))
      .map((npc) => ({
        id: npc.id,
        faces: buildScene(npc.parts, npcPose(npc, elapsed), npcOffset(npc, elapsed)),
        pos: npc.pos,
        radius: 24,
        shadow: 10,
      })),
    // A sentry's height goes into his POSITION, so the camera lifts him up the
    // screen and the depth sort puts him in front of the wall he stands on.
    ...guards
      .filter((g) => nearCamera(g.pos.x, g.pos.z))
      .map((g) => ({
        id: g.id,
        faces: buildScene(g.parts, guardPose(g), guardOffset(g)),
        pos: { x: g.pos.x, y: g.elevation, z: g.pos.z },
        radius: 24 + g.elevation,
        ...(g.elevation === 0 ? { shadow: 10 } : {}),
      })),
    ...dummies
      .filter((d) => nearCamera(d.pos.x * TILE, d.pos.y * TILE))
      .map((d) => ({
        id: d.id,
        faces: buildScene(d.parts, dummyPose(d)),
        pos: { x: d.pos.x * TILE, y: 0, z: d.pos.y * TILE },
        radius: 26,
        shadow: 9,
      })),
  ]

  const entries = collectScene(baked, actors, camera, { w: cssWidth, h: cssHeight })

  // Indoors, exactly two things get out of your way: the roof and the front
  // wall. Letting the general occlusion rule run inside would fade the side
  // walls too, and the room would stop reading as a room.
  //
  // Outdoors, anything genuinely covering the player fades.
  const inside = buildingAt(camera.x, camera.z)
  const playerPoint = {
    screen: project({ x: 0, y: 22, z: 0 }),
    depth: depthOf({ x: 0, y: 0, z: 0 }),
  }
  const hidden = inside ? new Set(shellIds(inside)) : occluders(entries, playerPoint)

  // Walls stay solid on purpose, so they swallow the player when he walks up
  // against one. Rather than fade them, draw his outline over the top — he
  // stays findable and the masonry stays masonry.
  const behindSolid = hiddenBySolid(entries, playerPoint)

  const cx = cssWidth / 2
  const cy = cssHeight / 2

  /**
   * Shadows and geometry go into ONE sorted stream, but a shadow sorts by its
   * footprint on the floor while geometry sorts by where it stands. A shadow
   * drawn at its owner's depth ends up on top of whatever the owner sorts
   * behind — which is how houses got a shadow painted across their front wall.
   */
  type Draw =
    | { depth: number; kind: 'shadow'; entry: SceneEntry }
    | { depth: number; kind: 'faces'; entry: SceneEntry }

  const stream: Draw[] = []
  for (const entry of entries) {
    if (entry.shadow !== undefined) {
      stream.push({ depth: entry.groundDepth, kind: 'shadow', entry })
    }
    stream.push({ depth: entry.depth, kind: 'faces', entry })
  }
  stream.sort((a, b) => a.depth - b.depth)

  for (const item of stream) {
    const { entry } = item
    const x = cx + entry.screen.sx
    const y = cy + entry.screen.sy

    if (item.kind === 'shadow') {
      drawShadow(ctx, x, y, entry.shadow!, 0.28)
      continue
    }

    const fade = hidden.has(entry.id)
    if (fade) ctx.globalAlpha = OCCLUDED_ALPHA
    drawFaces(ctx, entry.faces, x, y)
    if (fade) ctx.globalAlpha = 1
  }

  if (behindSolid) {
    const self = entries.find((e) => e.id === 'player')
    if (self) {
      drawSilhouette(ctx, self.faces, cx + self.screen.sx, cy + self.screen.sy, SILHOUETTE)
    }
  }

  drawDamageNumbers(camera)

  drawHud(ctx, router, player)
  requestAnimationFrame(frame)
}

resize()
requestAnimationFrame(frame)
