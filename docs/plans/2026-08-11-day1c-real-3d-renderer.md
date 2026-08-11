# Day 1c — Replace the Fake Renderer With a Real One

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A character whose limbs actually rotate in 3D, so the roll, the punch, the walk
and the layering are all correct by construction instead of by patching.

**Why a rewrite:** every outstanding bug is the same bug. Boxes are drawn as
screen-aligned rectangles with only their *centres* moved. A screen-aligned rectangle
cannot represent a 3D rotation, so:

| Symptom | Same root cause |
|---|---|
| Roll wrong at every angle | Boxes cannot tumble, only orbit |
| Punch looks vertical | The arm box cannot lie down |
| Legs detach from the body | The thigh cannot tilt, only slide |
| Layering needs anchors, clusters, layers | Sorting *boxes* because we cannot sort *faces* |
| Face invisible when idle | Half-depth draw offset moves the head 7px and the flat eyes 0.2px |

Patching this further is throwing good time after bad. A real renderer is ~500 lines and
deletes more code than it adds.

**Architecture:** Copy Minecraft's own model system. A `ModelPart` has a **pivot**, a
**rotation**, and a list of **cuboids**. Animation sets part rotations; the renderer
transforms the 8 corners of every cuboid, builds 6 faces, culls the ones facing away,
shades each by its normal, sorts every face in the scene back-to-front, and fills them as
polygons.

**Tech Stack:** unchanged — TypeScript, Vitest, Canvas 2D. No libraries.

---

## What gets deleted

- `src/render/project.ts` — replaced by a real camera
- `src/render/pose.ts` — the entire layer/anchor/cluster/chunk-rounding apparatus, ~230 lines
- `src/render/transform3d.ts` — folded into `rotation.ts`
- `Box.layer`, `Box.bottom`, `DEPTH_ANCHOR`, `CHUNK_ROUNDING`, footprint blending

Correct face sorting makes all of it unnecessary. Boots become real boxes again, because a
box parented to the leg now rotates *with* the leg.

---

## Task 1: Vector maths — `src/render3d/vec3.ts`

`add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize`.

**Tests:** cross product is perpendicular to both inputs and follows the right-hand rule;
normalize of zero returns zero, not NaN; dot of perpendicular vectors is 0.

---

## Task 2: Rotation — `src/render3d/rotation.ts`

```ts
export function rotateX(p: V3, angle: number): V3
export function rotateY(p: V3, angle: number): V3
export function rotateZ(p: V3, angle: number): V3
/** Euler XYZ about an arbitrary pivot — the ModelPart transform. */
export function rotateAbout(p: V3, pivot: V3, r: Rotation): V3
```

**Tests:** identity at zero; a quarter turn about X sends `+y` to `+z`; distance from the
pivot is always preserved (this is what makes limbs rotate instead of stretch); a full turn
returns to start; rotating about a pivot leaves the pivot itself fixed.

---

## Task 3: Camera — `src/render3d/camera.ts`

A proper orthographic three-quarter camera, elevation 45°:

```ts
const PITCH = Math.PI / 4
const COS = Math.cos(PITCH), SIN = Math.sin(PITCH)

project(p) => ({
  sx: p.x * SCALE,
  sy: (-p.y * COS + p.z * SIN) * SCALE,
  depth: p.y * SIN + p.z * COS,        // larger = nearer the camera
})

export const TO_CAMERA: V3 = { x: 0, y: SIN, z: COS }
```

This replaces the ad-hoc `Y_SQUASH = 0.85` / `Z_SHIFT = 0.9` pair, which was not a real
projection — no camera produces those two numbers, which is why "forward" never looked
consistent. **The ground must use the same camera**, otherwise the world and the character
disagree about which way forward is.

**Tests:** the origin projects to screen zero; height moves up-screen; depth moves
down-screen *and* increases `depth`; two points at equal height sort by z; `TO_CAMERA` is a
unit vector.

---

## Task 4: Cuboids — `src/render3d/cuboid.ts`

```ts
export interface Cuboid { pos: V3; size: {w,h,d}; color: string }
export interface Face { corners: [V3,V3,V3,V3]; normal: V3; color: string }

export function corners(c: Cuboid): V3[]      // 8, fixed order
export function faces(c: Cuboid): Face[]      // 6, normals pointing OUT
```

**Tests:** 8 distinct corners; every corner is `size/2` from the centre on each axis; 6
faces; each face's normal points away from the centre (`dot(normal, faceCentre - centre) > 0`);
each face has exactly 4 corners; every corner appears in exactly 3 faces.

---

## Task 5: The model — `src/render3d/model.ts`

```ts
export interface Rotation { x: number; y: number; z: number }
export interface ModelPart {
  id: PartId          // 'root' | 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR'
  pivot: V3
  rotation: Rotation
  cuboids: Cuboid[]
}
```

Pivots are real joints: head `(0,24,0)`, torso `(0,12,0)`, shoulders `(±6,24,0)`,
hips `(±2,12,0)`. Every part is transformed by its own rotation about its own pivot, then
by the **root** rotation about the body centre.

Boots return as cuboids inside the leg part — parented to the leg, they now rotate with it,
so they cannot climb the shin.

**Tests:** every part exists; the explorer still has a vest, a hat and eyes; recolouring
changes colour and not geometry; nothing starts below the ground; the eyes sit proud of the
head's front face.

---

## Task 6: The renderer — `src/render3d/renderModel.ts`

```ts
export function buildScene(parts: ModelPart[], root: Rotation, rootPivot: V3): DrawFace[]
```

1. For each part, for each cuboid, transform all 8 corners: part rotation about part pivot,
   then root rotation about the root pivot.
2. Build 6 faces per cuboid, transforming normals the same way (rotation only).
3. **Cull** faces with `dot(normal, TO_CAMERA) <= 0`.
4. **Shade** by Lambert against a fixed light, so a rotating limb visibly changes tone —
   this is most of what makes rotation readable.
5. **Sort** every surviving face in the scene by centroid depth, ascending.

**Tests:**
- a lone cube shows exactly 3 faces from this camera, never 6
- rotating the cube 180° still shows exactly 3
- faces come back sorted strictly back-to-front
- **the eyes are visible and sort in front of the head when facing the camera**
- **the eyes are culled or sort behind the head when facing away** — no face on the back of
  his head
- no face has a degenerate (zero-area) projection

---

## Task 7: Animation — `src/render3d/animate.ts`

Pure: `(player) => Record<PartId, Rotation>` plus a root translation. No positions, only
angles — that is the whole point.

**Walk:** `legL.x = swing`, `legR.x = -swing`, arms counter-swing at 0.85×,
torso yaws for hip sway, root bobs vertically at double stride rate, torso pitches forward
slightly.

**Punch:** `arm.x = -π/2 × extension`. At full extension the arm's long axis lies along
`+z`, so it renders as a genuinely horizontal bar. Fists alternate on `swingCount`.

**Tuck and roll:** a real curl — hips `+2.2 rad` (knees to chest), shoulders `-2.6 rad`
(hands down to the shins), torso `+0.5`, head `+0.6`. Then `root.x = 2π × progress` about
the ball centre.

**Tests:**
- **punch:** the vector from shoulder to fist points along `+z` at peak (`dot > 0.85`), and
  the projected arm is wider than tall when facing east
- **roll:** at half-way the head is below the hips; the body's vertical extent is under 60%
  of standing; **verified at all 8 compass directions, not just north–south**
- **walk:** the foot's distance from the hip is constant; arms and legs are in opposite
  phase; the character is perfectly still when idle
- rotations return to zero when the action ends

---

## Task 8: Wire up — `src/main.ts`

Ground drawn through the **same camera**, so forward means the same thing for the world and
the character. Delete the old render modules.

**Manual check on the phone:**
1. Face is visible standing still, facing the camera
2. Nothing visible on the back of his head when walking away
3. Punch reads as a horizontal jab, alternating fists
4. Roll is a tuck-and-somersault in **all eight** directions
5. Boots stay on the feet
6. Joystick always visible

---

## Done when

The roll is right in every direction, the punch is visibly horizontal, and the layering
code is gone rather than fixed.
