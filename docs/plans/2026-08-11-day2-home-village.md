# Day 2 — Home Village Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A hand-built village hub you can walk around — four shops with NPCs outside them,
a central marketplace, solid collision, contact shadows, buildings that fade when they hide
you, and a training yard of straw dummies that pop damage numbers when you punch them.

**Architecture:** The renderer already turns `ModelPart` trees into sorted, shaded, culled
faces. A village is the same thing at world scale: every building, barrel and NPC is a bag
of cuboids placed at a world position. The two new ideas are (1) **baking** — static props
never rotate, so their projected face shapes are computed once at load and only translated
per frame, and (2) a **world scene** that pools faces from every visible object and sorts
them together, so a barrel in front of a house just works.

**Tech Stack:** unchanged — TypeScript, Vitest, Canvas 2D, no libraries.

**Scope note:** this is a full day. It takes the slot Day 2 held for netcode, so 1v1/2v2
PvP is unlikely to ship. That trade was made deliberately.

---

## Conventions

- **1 world tile = 16 model units.** The player is 36 units tall, so a bit over two tiles.
- A building footprint is 4×4 tiles = 64×64 units, walls ~40 units, roof on top.
- Everything static lives in `src/world/`. Nothing there imports from `src/sim/`.
- Art comes from **one shared palette**. A coherent palette is the single biggest lever on
  whether a procedural village reads as a place rather than a pile of boxes.

---

## Task 1: The block palette

**Files:** Create `src/world/palette.ts`, Test `src/world/palette.test.ts`

One table of named colours for the whole village — timber, plaster, thatch, roof tile,
stone, cobble, grass, dirt, iron, copper, glass, straw, cloth. Every prop draws from it.

**Tests:** every colour is a valid `#rrggbb`; no two entries are identical (a duplicate
means two materials that will never read as different); the palette exports at least the 12
materials the props need.

---

## Task 2: Props as data

**Files:** Create `src/world/prop.ts`, Test `src/world/prop.test.ts`

```ts
export interface Prop {
  id: string
  pos: V3              // world position, model units, y=0 on the ground
  cuboids: PartCuboid[]  // relative to pos
  collider?: { w: number; d: number }   // AABB footprint; omit for decoration
  shadow?: number      // contact shadow radius
}
```

**Tests:** a prop's cuboids are all relative to its own origin (nothing further than its
bounding box); a prop with a collider has positive dimensions; props with no collider are
explicitly walkable.

---

## Task 3: Baked geometry

**Files:** Create `src/world/bake.ts`, Test `src/world/bake.test.ts`

Static props never rotate. Bake each prop's faces **once**: cull, shade, project relative to
the prop's own origin, and store the resulting polygon plus its depth. Per frame the
renderer only adds the prop's screen offset.

```ts
export interface BakedProp { id: string; pos: V3; faces: DrawFace[]; radius: number }
export function bakeProp(prop: Prop): BakedProp
```

**Tests:** baking is pure (same input twice gives identical output); baked faces are already
back-to-front; every baked face has 4 points; the bounding `radius` covers every corner;
baking a prop twice does not re-run culling (assert by counting faces, not by timing).

---

## Task 4: The world scene

**Files:** Create `src/world/worldScene.ts`, Test `src/world/worldScene.test.ts`

```ts
export function collectFaces(
  props: BakedProp[],
  actors: { faces: DrawFace[]; pos: V3 }[],
  camera: V3,
  viewport: { w: number; h: number },
): DrawFace[]
```

Offsets every face by `pos - camera`, drops props outside the viewport, pools everything,
sorts by depth.

**Tests:** a prop behind another sorts first; a prop far off screen is culled; an actor
between two props lands between them; the camera translating does not change relative
order; nothing is dropped that overlaps the viewport edge.

---

## Task 5: Collision

**Files:** Create `src/sim/collision.ts`, Test `src/sim/collision.test.ts`

Circle-vs-AABB push-out. The player is a circle of radius 5 units.

```ts
export function resolveCollisions(pos: V2, radius: number, boxes: AABB[]): V2
```

**Tests:** a free position is unchanged; a position inside a box is pushed to the nearest
edge, never through it; a corner overlap resolves diagonally; overlapping two boxes at once
resolves both; a fast-moving player cannot tunnel through a wall in one tick; resolution is
idempotent (resolving twice equals resolving once).

Wire into `Player.tick` **after** movement so the roll cannot punch through walls either.

---

## Task 6: Occlusion fade

**Files:** Create `src/world/occlusion.ts`, Test `src/world/occlusion.test.ts`

When a building stands between you and the camera, it fades so you can still see yourself.

```ts
export function occluders(props: BakedProp[], playerScreen: Screen, playerDepth: number): Set<string>
```

A prop occludes if its depth is **greater** than the player's (nearer the camera) and its
screen bounding box contains the player's position.

**Tests:** a prop behind the player never occludes; a prop in front but off to the side never
occludes; a prop in front and overlapping does occlude; the player standing clear of
everything yields an empty set; the fade is applied to whole props, never to single faces
(otherwise a half-faded building looks broken).

---

## Task 7: The building kit

**Files:** Create `src/world/buildings.ts`, Test `src/world/buildings.test.ts`

Reusable pieces so every building shares a visual language: `wall`, `gableRoof`, `door`,
`window`, `chimney`, `awning`, `sign`, `crate`, `barrel`, `fence`, `lamp`, `tree`, `well`,
`stall`.

**Tests:** a building's roof sits above its walls; the door is on the front face and reaches
the ground; nothing dips below y=0; a building with a collider has a footprint no smaller
than its walls; two buildings built from the same kit share palette colours.

---

## Task 8: The four shops

**Files:** Create `src/world/village.ts`, Test `src/world/village.test.ts`

- **Blacksmith** — dark timber, stone forge, anvil out front, tall chimney, iron accents
- **Alchemist** — pale plaster, thatch roof, bottle shelves, bubbling cauldron, herb boxes
- **Enchanter** — deep blue roof, rune-carved stones, floating book, lantern glow
- **Merchant** — an open market stall with a striped canopy, crates, barrels, hanging wares

Plus a **central marketplace**: a stone well, more stalls, banners, benches, cobbled plaza.

**Tests:** all four shops exist and are distinct positions; no two colliders overlap (you
cannot build a village where two buildings occupy the same ground); every shop is reachable
(a path of walkable tiles connects the spawn to each door); the plaza is clear of colliders.

---

## Task 9: NPCs

**Files:** Create `src/world/npc.ts`, Test `src/world/npc.test.ts`

Reuse the humanoid `ModelPart` tree with different costumes — the costume system already
supports this, so an NPC is a recolour plus a hat. Blacksmith in a leather apron, alchemist
in robes, enchanter hooded, merchant in bright cloth. Idle animation: slow breathing bob and
an occasional head turn, driven by a per-NPC phase offset so they do not move in lockstep.

**No interaction yet** — they stand at their stations and look alive.

**Tests:** each NPC has a distinct costume; each stands near its own shop; idle phases
differ so no two NPCs are synchronised; an NPC's idle animation never leaves the ground; the
NPC model reuses the shared part tree rather than duplicating it.

---

## Task 10: The training yard

**Files:** Create `src/world/dummy.ts`, `src/sim/combat.ts`, Test both

Straw dummies on posts: a cross-post body, straw head, rope bindings, a little sway.

Combat, finally:

```ts
export function attackHitbox(player: Player): { pos: V2; radius: number } | null
```

Active only during the strike window of a swing (`attackProgress` between 0.25 and 0.55),
placed in front of the player at fist range.

**Tests:** no hitbox when idle, rolling, or between swings; the hitbox appears only during
the strike window; it sits in front of the player and follows facing; a dummy inside it is
hit exactly **once** per swing (the bug that would otherwise deal damage every tick); a
dummy outside is not hit; the third combo hit deals more damage than the first.

**Feedback:** damage number floats up and fades; dummy rocks back and returns; hitstop
freezes the sim ~60ms on connect; screenshake scaled to damage.

**Tests for feel:** hitstop expires and never wedges the sim; a damage number is removed
after its lifetime (no unbounded array growth); screenshake decays to zero.

---

## Task 11: Ground and wiring

**Files:** Modify `src/main.ts`

Ground gets three surfaces — grass, worn dirt paths between buildings, cobbles in the plaza —
with slight per-tile colour variation so it does not look like a checkerboard. Camera
follows the player. Draw order: ground → pooled world faces → HUD.

**Manual check on the phone:**
1. You can walk around the village and cannot walk through buildings
2. Standing behind the blacksmith fades it so you stay visible
3. Every building casts a contact shadow
4. Four shops are visually distinct at a glance
5. NPCs stand outside their shops, idling out of sync
6. Punching a straw dummy pops a damage number, shakes the screen, rocks the dummy
7. Frame rate holds up on the phone

---

## Done when

The village looks like somewhere you would want to stand around in, you cannot walk through
walls, and hitting a straw dummy feels good enough that the arena is worth building.
