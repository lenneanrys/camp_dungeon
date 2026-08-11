# How Camp Dungeon Is Built

A record of what this project is made of, how the pieces fit together, and — more
usefully — *why* several of them are the way they are. Most of the design decisions here
were paid for with bugs.

**Scale:** ~4,400 lines of source, ~3,700 lines of tests, 489 tests.

---

## 1. What it's built with

Almost nothing. That is deliberate.

| Tool | Version | What it does |
|---|---|---|
| **TypeScript** | 7 | The whole codebase. Strict mode, `noUncheckedIndexedAccess` on |
| **Vite** | 8 | Dev server with hot reload, and the production build |
| **Vitest** | 4 | Test runner |

**Runtime dependencies: none.** Not one. Everything the game does at runtime is written
here — the 3D renderer, the animation system, the physics, the world. `package.json` has an
empty `dependencies` block.

### What we deliberately did *not* use

- **No game engine** (Phaser, PixiJS, Three.js). At this size the setup and the API surface
  cost more than they save, and rolling it ourselves keeps the simulation portable — the
  same code can later run on a server for PvP, and on the 2026 BadgeHub badge.
- **No 3D library.** The renderer is ~700 lines of vector maths drawing polygons into a 2D
  canvas. See section 3.
- **No physics engine.** Collision is circle-versus-box push-out, about 40 lines.
- **No asset pipeline.** There are no image files at all. Every character, building and
  prop is built from coloured boxes in code.

### The one external asset

Three button icons from [game-icons.net](https://game-icons.net), licensed CC BY 3.0:
Punch and Magic Swirl by Lorc, Acrobatic by DarkZaitzev. Each is a single SVG path,
embedded as a string in `src/render3d/icons.ts` and drawn through `Path2D`, so the game
still ships zero image files. Attribution is in `CREDITS.md`.

---

## 2. How the code is laid out

```
src/
  sim/        Pure game logic. No DOM, no canvas, no rendering.
  render3d/   The software 3D renderer and the animation system.
  world/      The village: props, buildings, walls, NPCs, guards.
  input/      Touch handling.
  render/     The HUD (joystick, buttons, icons).
  main.ts     Wiring: the game loop, the camera, the draw order.
```

The important rule is that **`sim/` imports nothing from `render3d/` or the DOM**. It is
plain data and arithmetic. That buys two things: the simulation can run somewhere with no
screen (a server, for PvP), and every rule in it is testable without a browser.

| Folder | Source | Tests |
|---|---|---|
| `sim/` | 379 | 672 |
| `render3d/` | 695 | 957 |
| `world/` | 2,602 | 1,830 |
| `input/` | 204 | 243 |
| `render/` | 146 | 35 |
| `main.ts` | 333 | — |

---

## 3. The renderer

This is the heart of it, and it was rebuilt once from scratch.

### The first attempt, and why it failed

The original renderer drew each box as a **screen-aligned rectangle** and moved only its
centre. That is fast and simple, and it is fundamentally incapable of representing a 3D
rotation. Every visual bug traced back to it:

- the dodge roll looked wrong from every angle except due north–south
- a punching arm always looked vertical, because the arm box could not lie down
- legs detached from the body while walking, and boots slid up the shin
- layering needed an ever-growing pile of hacks — draw layers, depth anchors, clusters
- the character's face vanished when idle

Five symptoms, one cause. Patching them individually was throwing good time after bad.

### What replaced it

A real, if small, software 3D renderer, following the same architecture Minecraft itself
uses for entity models.

**The model** (`render3d/model.ts`) is a tree of `ModelPart`s. Each part has:

- a **pivot** — the joint it rotates about
- a **rotation** — pitch, yaw, roll
- a list of **cuboids** — boxes, positioned relative to the body
- an optional **parent** — so curling the torso carries the head and arms with it

Proportions follow Minecraft: head 8×8×8, torso 8×12×4, limbs 4×12×4.

**The pipeline** (`render3d/scene.ts`), per frame:

1. Transform the **8 corners** of every cuboid — the part's own rotation about its joint,
   then each ancestor's, then the whole-body rotation.
2. Build the **6 faces** of each cuboid, transforming their normals the same way.
3. **Backface cull**: drop any face whose normal points away from the camera.
4. **Shade** each surviving face by Lambert — `dot(normal, light)` — against a fixed key
   light. This is most of what makes a rotation readable: a limb changes tone as it turns.
5. **Sort** every face in the scene back to front by centroid depth, and fill them as
   polygons.

Sorting individual *faces* rather than whole boxes is what let all the layering machinery
be deleted. Correct geometry sorts itself.

**The camera** (`render3d/camera.ts`) is a genuine orthographic projection, elevated 45°:

```
sx = x
sy = -y·cos(45°) + z·sin(45°)
depth = y·sin(45°) + z·cos(45°)
```

The previous version used two hand-tuned squash factors that no real camera could produce,
which is why "forward" never looked consistent between the ground and the character. The
ground is drawn through this same camera.

Note what the depth formula says: **height and depth contribute equally.** That fact caused
a whole family of bugs later — see section 6.

The camera has elevation but **no yaw**, which keeps left and right perfectly symmetric for
gameplay. The cost is that a straight-on cube shows two faces rather than three.

### Two things worth knowing

**Decals.** A cuboid marked `decal: true` emits only its front face. The eyes were solid
boxes standing proud of the head, so turning around presented their *back* face to the
camera — a face painted on the back of his head. A single-faced decal cannot do that.

**Winding.** Face corners are wound counter-clockwise seen from outside, so a cross product
of consecutive edges agrees with the stored normal. Getting this backwards inverts every
normal and renders the character inside-out. There is a test for it.

---

## 4. Animation

Animation sets **joint angles and nothing else**. No part is ever repositioned.

That single constraint is why limbs cannot detach from their joints, why boots cannot climb
the shin, and why the roll works in every direction. `render3d/pose.ts` is a pure function
from player state to a table of rotations.

**A sign convention that matters:** arms and legs hang *below* their joint, so a negative
pitch swings them forward. The torso and head sit *above* theirs, so forward is positive.
Using one sign for everything makes the character tuck backwards, which is exactly what
happened first time.

- **Walk** — legs rotate at the hip, arms counter-swing at 85%, hips sway at double the
  stride rate, the body bobs and leans into the direction of travel.
- **Punch** — the arm rotates −90° at the shoulder, from hanging to horizontal. Reach comes
  from the shoulder, not the elbow: the torso *twists* so the punching shoulder drives
  forward, exactly as a real jab does. That took the fist from 10 units of reach to 16.
- **Roll** — a tuck-and-somersault. The tuck angles were found by **grid search**
  (`render3d/tuckSearch.test.ts`, skipped by default) rather than guessed, and the answer
  was counterintuitive: a *shallow* waist fold with a *deep* head tuck beats a deep waist
  fold, because folding the spine hard swings the head out horizontally instead of drawing
  it in. Ball radius went from 13.1 to 6.7 units.

---

## 5. The world

### Props and baking

Everything in the village — a barrel, a house wall, a tower — is a `Prop`: a bag of cuboids
at a world position, with an optional collider and shadow.

Static props never rotate, so their projected shape never changes. They are **baked once at
load**: culled, shaded and projected relative to their own origin. Per frame the renderer
does a single translate. That is what lets a whole walled town run on a phone.

Both `project` and `depthOf` are linear, which is what makes the baking valid at any world
position and any camera position.

For props that *do* need rotation — a signpost whose arms point in five different
directions — `bakeParts` runs the character renderer once at load with a fixed pose. Same
per-frame cost, arbitrary angles.

### Buildings you can walk into

There is no interior scene and no loading. **A house is four walls with a gap in the front
one.** You walk through the gap.

- Each wall is its own prop with its own collider — a single box collider would seal the
  door shut.
- Standing inside, exactly two pieces get out of the way: the roof, and the front wall
  between you and the camera.
- Furniture carries its collider *with* its geometry, so moving a bed moves what blocks
  you. A separate list of collider positions goes stale the moment anyone nudges anything.

### Collision

Circle-versus-box push-out, resolved to the **nearest edge**. Pushing away from the box
centre shoves anyone who gets deep enough out through the far side — the classic "walked
through a wall" bug. A test walks the player progressively deeper into a wall and asserts he
never pops out the other side.

### Occlusion

Scenery standing between you and the camera fades to 28%. Two rules, both learned the hard
way:

1. Coverage is tested against the prop's **real faces**, not a bounding box. A building's
   box is a tall rectangle that swallows anyone standing beside it.
2. **Only scenery fades.** The player, NPCs and dummies never turn translucent — that reads
   as a bug, not as depth.

### The wall

Built from short segments rather than four long ones, because the scene sorts per object
and a single wall running the length of the town could never interleave with a player
walking along it.

Segments are sized to fill the run between towers **exactly**. Stepping them at a fixed
pitch leaves a hole wherever a tower doesn't land on the grid — which produced a gap big
enough to walk out of beside every corner. A test walks the whole perimeter in 8-unit steps
asserting something blocks the way out at every point.

Battlements are a **separate prop** from the wall body. A sentry stands *inside* the wall's
volume — on the body, behind the merlons — and one object cannot be both in front of and
behind him.

---

## 6. The sort key, and the family of bugs it caused

Worth its own section, because it generated more bugs than anything else and the fix is one
idea.

`collectScene` sorts each object by its depth. Originally that meant `depthOf(its origin)` —
and every prop's origin sits on the floor at `y = 0`. But the camera looks down at 45°, so
**height and depth contribute equally**. A 90-unit tower and a 6-unit barrel standing on the
same spot sorted *identically*, and anything whose geometry lives high above its base sorted
far too early.

Symptoms, all the same bug:

- wall segments drawing over the towers they join
- sentries appearing to stand *on* the battlements instead of behind them
- house roofs drawing behind their own furniture

**The fix:** sort by the geometry's **centroid**, not its base.

Then two follow-on corrections, each from a case where the model wasn't applied uniformly:

- **Characters must use the same model.** Props sorted by their centroid while characters
  still sorted by their feet, which biased every wall in front of anyone standing before it.
  Characters now carry a centre-of-mass height.
- **Shadows must not.** A contact shadow is a flat decal lying on the floor. It sorts by its
  **ground depth**, with the height bias stripped out — otherwise a house's shadow, which
  belongs to the roof prop, gets painted across the house's own front wall.

The lesson, recorded because it was expensive: when a rendering bug appears, ask whether the
sort key is answering the right question, before adjusting geometry.

---

## 7. Testing

489 tests, run with `npm test`. Written test-first throughout — every test went red before
the code existed.

The useful ones aren't unit tests of getters. They're **invariants that make whole classes
of bug impossible**:

| Test | The bug it prevents |
|---|---|
| A limb's distance from its joint never changes | Legs sliding instead of swinging |
| No two colliders overlap | Getting wedged between two buildings |
| Flood-fill from spawn reaches every shop interior | A shop you cannot walk into |
| A punch lands exactly once per swing | A hitbox live for 12 ticks dealing 12 hits |
| Eyes emit no geometry at all when facing away | A face on the back of his head |
| The perimeter is blocked at every 8-unit step | A hole in the wall |
| A tower sorts after the wall it joins | Walls drawing over towers |

Several were written *after* a bug reached the screen, which is the honest reason this list
exists.

A few tests are deliberately not assertions at all: `tuckSearch.test.ts` is a grid search
that finds the best roll pose and writes the answer to a file. It's skipped by default.

---

## 8. What is not built yet

Being straight about the gaps:

- **No enemies.** There are straw dummies that take damage, and nothing that fights back.
- **No health, no death, no loot.**
- **No progression.** The four gear slots, the twelve enchantment slots, XP and enchant
  points are designed in `docs/DESIGN.md` and not implemented.
- **No multiplayer.** The 1v1 and 2v2 arena was the original hook. The simulation is
  deliberately pure so a server can run it, but no server exists.
- **The magic button** is wired up and hidden, waiting for the first magic item.

---

## 9. Where things live

| File | What it decides |
|---|---|
| `src/sim/constants.ts` | Walk speed, roll distance and cooldown, punch timings |
| `src/render3d/pose.ts` | What the walk, punch and roll look like |
| `src/render3d/camera.ts` | Camera angle and zoom |
| `src/world/palette.ts` | Every colour in the village |
| `src/world/village.ts` | Where every building, NPC and dummy stands |
| `src/world/fortifications.ts` | The wall, towers and gates |
| `src/world/guard.ts` | Patrol routes and the garrison |

All of it hot-reloads. Change a number, glance at the phone, change it again.

---

## 10. Related documents

- `docs/DESIGN.md` — the game design: progression, arena modes, the wager
- `docs/plans/` — the implementation plans, in order, including the renderer rewrite
- `CREDITS.md` — icon attribution
