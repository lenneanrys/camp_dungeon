# Day 1b — Feel Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the seven problems found on the first phone test: broken box layering,
disappearing joystick, bad icons, over-long roll cooldown, an unreadable roll, a punch that
doesn't reach, and a lifeless walk.

**Architecture:** The renderer currently poses boxes inline inside `drawCharacter`, which
makes none of it testable. This plan extracts posing into `src/render/pose.ts` — a pure
function from `(boxes, player)` to transformed boxes with an explicit draw order. Limb
motion moves from *translation* to *rotation about a pivot*, which fixes the punch reach
and the walk in one go.

**Tech Stack:** unchanged — TypeScript, Vitest, Canvas 2D.

---

## Root causes

| Symptom | Actual cause |
|---|---|
| Hair behind the head | `depthKey` sorts purely on z. Hair sits at `z=-0.6`, so it sorts *behind* the head — and yaw rotation reshuffles it every time he turns, hence "sometimes" |
| Joystick vanishes mid-drag | `main.ts` treats `pointerout` and `pointerleave` as releases. iOS fires both spuriously during a drag. **This is a bug I introduced.** |
| Roll looks wrong | He spins upright like a helicopter. A real dodge roll *tucks* — knees to chest, arms wrapping the shins — and the tuck is what makes the spin read as rolling |
| Punch doesn't reach | The arm is *translated* forward 11 units. A punch is the arm *rotating* at the shoulder from hanging to horizontal |
| Walk is lifeless | Legs translate instead of swinging on an arc, and there's no hip sway, no lean, no proper bob |

---

## Task 1: Fix the disappearing joystick

**Files:** Modify `src/main.ts`, Create `src/input/pointerEvents.ts`, Test `src/input/pointerEvents.test.ts`

**Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { RELEASE_EVENTS, DOWN_EVENT, MOVE_EVENT } from './pointerEvents'

describe('pointer event binding', () => {
  it('releases on pointerup and pointercancel', () => {
    expect(RELEASE_EVENTS).toContain('pointerup')
    expect(RELEASE_EVENTS).toContain('pointercancel')
  })

  // Regression guard: iOS fires these spuriously mid-drag. Treating them as a
  // release kills the joystick while the thumb is still down.
  it('never releases on pointerout or pointerleave', () => {
    expect(RELEASE_EVENTS).not.toContain('pointerout')
    expect(RELEASE_EVENTS).not.toContain('pointerleave')
  })

  it('uses pointerdown and pointermove', () => {
    expect(DOWN_EVENT).toBe('pointerdown')
    expect(MOVE_EVENT).toBe('pointermove')
  })
})
```

**Step 3: Implementation**

```ts
export const DOWN_EVENT = 'pointerdown' as const
export const MOVE_EVENT = 'pointermove' as const
export const RELEASE_EVENTS = ['pointerup', 'pointercancel'] as const
```

Wire `main.ts` to use these constants. Keep `setPointerCapture` — that is what keeps
events flowing to the canvas once a thumb drags off it.

**Checkpoint:** `fix: stop pointerout killing the joystick mid-drag`

---

## Task 2: Explicit draw layering

**Files:** Modify `src/render/costume.ts`, Create `src/render/pose.ts`, Test `src/render/pose.test.ts`

Add a `layer` number to every `Box`. Sort by depth **and then** by layer, but crucially,
covering pieces inherit their parent's depth so yaw can never separate them.

Layers within a group: skin `0`, clothing `1`, hair `2`, headgear `3`, detail (eyes) `4`.

**Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { poseCharacter } from './pose'
import { jungleExplorer, buildModel } from './costume'
import { Player } from '../sim/player'

const order = (boxes: { id: string }[], id: string) => boxes.findIndex((b) => b.id === id)

describe('draw layering', () => {
  const angles = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]

  // This is the bug: hair drew behind the head at some facings.
  it('always draws hair after the head, at every facing', () => {
    for (const a of angles) {
      const p = new Player()
      p.facing = { x: Math.sin(a), y: Math.cos(a) }
      const posed = poseCharacter(buildModel(jungleExplorer), p)
      expect(order(posed, 'hair')).toBeGreaterThan(order(posed, 'head'))
    }
  })

  it('always draws the hat above the hair', () => { /* same loop, hatCrown > hair */ })
  it('always draws the vest over the torso', () => { /* vest > torso */ })
  it('always draws eyes last on the head', () => { /* eyeL > head */ })
  it('always draws boots over the legs', () => { /* bootL > legL */ })
})
```

**Step 3: Implementation sketch**

```ts
// Cover pieces share their parent's depth so yaw can never split them apart.
const DEPTH_ANCHOR: Record<string, string> = {
  hair: 'head', hatBrim: 'head', hatBand: 'head', hatCrown: 'head',
  eyeL: 'head', eyeR: 'head',
  vest: 'torso', bootL: 'legL', bootR: 'legR',
}

sorted = boxes.sort((a, b) => {
  const d = depthOf(anchor(a)) - depthOf(anchor(b))
  return Math.abs(d) > 0.001 ? d : a.layer - b.layer
})
```

**Checkpoint:** `fix: stable box layering via explicit layers and depth anchors`

---

## Task 3: Rotation primitives

**Files:** Create `src/render/transform3d.ts`, Test `src/render/transform3d.test.ts`

Everything else needs these.

```ts
export interface P3 { x: number; y: number; z: number }

/** Rotate about the X axis through `pivot`. Positive tips the top toward +z. */
export function rotateX(p: P3, pivot: P3, angle: number): P3

/** Rotate about the Y (vertical) axis through the origin. */
export function rotateY(p: P3, angle: number): P3
```

**Tests:** identity at angle 0; a quarter turn moves a point above the pivot to directly
in front of it; a full turn returns to start; distance from the pivot is preserved.

**Checkpoint:** `feat: add 3d rotation primitives`

---

## Task 4: Shorter roll cooldown

**Files:** Modify `src/sim/constants.ts`

`ROLL_COOLDOWN: 3.0 → 1.1`. Every existing test reads the constant, so they keep passing.

The 3.0 figure is Minecraft Dungeons' real number, but that game has i-frame armour,
artifacts and a much slower combat pace. With fists and no enemies it just feels like
being punished.

**Checkpoint:** `tune: drop roll cooldown to 1.1s`

---

## Task 5: The tuck-and-roll

**Files:** Modify `src/render/pose.ts`, `src/render/animate.ts`, Test `src/render/pose.roll.test.ts`

**Why the current one reads wrong:** he stays standing while spinning. A dodge roll is a
*ball*. Tuck first, spin second — the tuck is what sells it.

Tuck targets, blended in over the first 20% of the roll and out over the last 20%:

| Group | Idle y | Tucked y | Tucked z |
|---|---|---|---|
| head | 28 | 22 | +3 (chin down) |
| torso | 18 | 15 | +1 |
| legL/R | 6 | 12 | +5 (knees to chest) |
| armL/R | 18 | 13 | +5 (wrapping the shins) |

Arms also pull inward on x to read as *grabbing* the legs.

Spin: the tucked ball rotates in screen space through a full turn, signed by travel
direction — rolling right spins clockwise, rolling left anticlockwise.

**Tests:**
- at mid-roll the head is far below its standing height
- at mid-roll the knees are above their standing height (tucked up)
- at mid-roll the hands are near the shins (`|armY - legY| < 3`)
- the tuck is fully released by the end of the roll
- spin sign flips with travel direction
- a full roll is exactly one turn

**Checkpoint:** `feat: proper tuck-and-roll`

---

## Task 6: Full-extension punch

**Files:** Modify `src/render/pose.ts`

The punch becomes a **shoulder rotation**: the arm swings from hanging (down) to
horizontal (pointing forward) — `rotateX(-π/2 × extension)` about the shoulder pivot.
That geometrically guarantees full extension instead of guessing a translation distance.

Add a small torso lunge forward and a shoulder shrug so the whole body commits.

**Tests:**
- at peak extension the fist is at least 9 units in front of the torso's front face
- at peak the punching arm is roughly level with the shoulder, not hanging
- the non-punching arm stays back
- the leading fist alternates with the combo step
- at rest the arm returns to hanging

**Checkpoint:** `feat: punch extends fully from the shoulder`

---

## Task 7: A better walk

**Files:** Modify `src/render/pose.ts`, `src/render/animate.ts`

Five things, all of which the current walk lacks:

1. **Limbs swing on an arc** — rotate about hip `(±2, 12, 0)` and shoulder `(±6, 24, 0)`
   instead of sliding on z.
2. **Arms counter-swing the legs** — opposite phase. This is what makes a walk read as a
   walk rather than a shuffle.
3. **Hip sway** — the torso yaws slightly, twice per stride.
4. **Vertical bob** — the body rises on each footfall, at double stride frequency.
5. **Lean into travel** — a slight forward pitch while moving.

**Tests:**
- a foot's distance from the hip pivot stays constant through the swing (it rotates, it
  does not stretch)
- arms and legs are in opposite phase
- the bob completes two cycles per stride
- the character stands perfectly still when not moving — no idle jitter
- no box ever sinks below the ground plane

**Checkpoint:** `feat: rotation-based walk cycle with sway, bob and lean`

---

## Task 8: Real icons

**Files:** Create `src/render/icons.ts`, `CREDITS.md`, Modify `src/render/hud.ts`

From [game-icons.net](https://game-icons.net/), CC BY 3.0, single SVG paths on a 512×512
viewBox rendered through `Path2D`:

- **attack** — "Punch" by Lorc
- **roll** — "Acrobatic" by DarkZaitzev
- **magic** — "Magic swirl" by Lorc

`CREDITS.md` carries the attribution the licence requires.

**Tests:** every `ButtonId` has an icon; each path is non-empty and starts with a move
command; the 512-viewBox scale factor maps an icon to the requested pixel size.

**Checkpoint:** `feat: replace emoji with game-icons artwork`

---

## Done when

On the phone: hair never flickers behind the head, the joystick survives a long drag with
the other thumb hammering attack, the roll reads as a tuck-and-roll in the direction of
travel, the punch visibly reaches out in front, and the walk has weight.
