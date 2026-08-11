# Depth Sorting for Tall Geometry — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make tall scenery sort correctly against other tall scenery and against
characters, so walls stop covering towers, sentries stop appearing to stand on top of the
battlements, and gate guards stop being swallowed by the wall behind them.

**Architecture:** All three reported bugs are one bug. `collectScene` sorts each object by
`depthOf(its origin)`, and every prop's origin sits on the ground at `y = 0`. So a 90-unit
tower and a 6-unit barrel standing on the same spot sort **identically**, and any object
whose geometry lives high above its base sorts far too early. Fix the sort key, not the
symptoms.

**Tech Stack:** unchanged — TypeScript, Vitest, Canvas 2D.

---

## Why the three symptoms are one cause

`depthOf(p) = (p.y + p.z) × sin(45°)` — height and depth contribute equally, because the
camera looks down at 45°. But props are sorted by their **origin**, which is always on the
floor. Height is therefore ignored for scenery and counted for characters.

| Symptom | What the sort key says |
|---|---|
| Wall draws over the tower beside it | Both origins at `z = 420`, so depth ties, and insertion order decides. The 9-unit overrun that closes the junction now covers the tower |
| Sentry appears to stand on the battlements | Guard depth includes his height (`58 + 413`), the wall's does not (`420 + 0`). He beats the whole wall, merlons included, so nothing ever occludes his legs |
| Gate guard vanishes behind the wall | He genuinely is behind it — but he stands only 58 units in, so the 72-unit gatehouse covers him on screen. A placement problem, not a sorting one |

---

## Task 1: Sort props by their geometric centre, not their base

**Files:** Modify `src/world/bake.ts`, Test `src/world/bake.test.ts`

`bakeProp` already walks every cuboid. While it does, compute the mean height of the
geometry and fold `centroidY × sin(PITCH)` into the prop's depth bias.

This is the whole fix for "wall over tower": a tower's geometry averages ~45 units up, a
wall segment's ~30, so the tower sorts later and covers the overrun that was meant to be
hidden inside it.

**Step 1: Write the failing test**

```ts
it('sorts a tall prop after a short one standing in the same place', () => {
  const tall = bakeProp(makeProp('tall', ORIGIN, [box(0, 0, 0, 20, 90, 20)]))
  const short = bakeProp(makeProp('short', ORIGIN, [box(0, 0, 0, 20, 10, 20)]))
  expect(tall.depthBias!).toBeGreaterThan(short.depthBias!)
})

it('leaves a flat prop essentially unbiased', () => {
  expect(bakeProp(makeProp('rug', ORIGIN, [box(0, 0, 0, 30, 1, 30)])).depthBias!)
    .toBeLessThan(2)
})

it('adds an explicit bias on top of the height bias', () => {
  const plain = bakeProp(makeProp('a', ORIGIN, [box(0, 0, 0, 10, 40, 10)]))
  const nudged = bakeProp(makeProp('b', ORIGIN, [box(0, 0, 0, 10, 40, 10)], { depthBias: 8 }))
  expect(nudged.depthBias! - plain.depthBias!).toBeCloseTo(8)
})
```

**Step 2–4:** fail, implement, pass.

**Regression risk:** this changes sorting for every prop in the village. Existing tests that
assert relative draw order must still pass — the roof/interior bias in `interiors.ts` is
already explicit and stays additive, so it keeps working.

---

## Task 2: Split the battlements into their own prop

**Files:** Modify `src/world/fortifications.ts`, Test `src/world/fortifications.test.ts`

Height bias fixes prop-versus-prop, but a sentry stands *inside* the wall's bounding volume
— behind the merlons, on top of the body. One object cannot be both in front of and behind
him, so the merlons must be their own object.

- `wallSegment()` returns base, body and deck only.
- New `wallCrown()` returns the merlons, emitted as a separate prop positioned on the outer
  half of the wall.

With Task 1 in place the crown's centroid is ~63 units up, so it sorts after a sentry
standing at 58 — his legs are correctly hidden behind the battlements, which is what
"walking on the kantelen" was complaining about.

**Tests:**
- a segment prop contains no merlons
- a crown prop contains only merlons
- the crown sits on the outward half for all four walls
- the crown's depth bias exceeds a sentry's depth on the same wall
- the crown carries no collider — you walk under battlements, not into them

---

## Task 3: Stand the gate guards clear of the wall

**Files:** Modify `src/world/guard.ts`, Test `src/world/guard.test.ts`

Nothing to do with sorting: the gatehouse is 72 units tall and the guards stand 58 units
inside it, so on screen the gate covers them. They have to stand far enough in that their
feet clear the top of the wall.

The threshold is geometric, so derive it rather than guessing:

```
feetScreenY   = z_guard × sin(PITCH) × SCALE
wallTopScreenY = z_wall × sin(PITCH) × SCALE − height × cos(PITCH) × SCALE
```

Guards must satisfy `feetScreenY < wallTopScreenY`, which for a 72-unit gate means standing
at least ~74 units inside. Use 110 for comfort.

**Tests:**
- every gate guard's feet project above the top of the wall behind them
- the same holds for street patrols
- guards remain inside the walls

---

## Task 4: Verify on the phone

1. No gap anywhere along the wall, including beside every tower and gate
2. Towers draw in front of the wall they join, not behind it
3. Sentries walk *behind* the battlements — legs occluded, heads and shoulders visible
4. Gate guards are fully visible, standing well inside their gates
5. Nothing flickers as the player walks along the wall

---

## Done when

The sort key accounts for height, so this class of bug cannot recur by placing a new tall
prop next to a short one.
