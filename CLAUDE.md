# Camp Dungeon

A Minecraft Dungeons–style touch action game for phone browsers, built for Fri3d Camp.
Prototyped on a phone because it has a touchscreen; the Fri3d 2026 badge is a possible
later target (see "Badge" below).

## Read these first

- **`docs/HOW-IT-WORKS.md`** — architecture, the renderer, and the bugs that shaped it.
  Start here.
- **`docs/DESIGN.md`** — the game design: gear, enchantments, arena modes, the wager.
- **`docs/plans/`** — implementation plans in order, including the renderer rewrite.

## Running it

```bash
npm run dev        # dev server; use the printed Network URL on a phone
npm test           # 495 tests
npm run typecheck
```

The phone URL uses the Mac's LAN IP, which changes on DHCP renewal. Get the current one
with `ipconfig getifaddr en0`.

## Conventions that matter

- **`src/sim/` has no DOM and no rendering.** Pure logic, fixed 60Hz timestep. This is what
  would let the simulation run on a server for PvP.
- **Animation sets joint angles only.** Never reposition a part. This is why limbs cannot
  detach from their joints.
- **Zero runtime dependencies.** No game engine, no 3D library, no physics engine, no image
  files. Keep it that way unless there's a strong reason.
- **Test-first.** Every test should go red before the code exists. The valuable tests are
  invariants that make a whole class of bug impossible, not getters.
- **Props must stay small and must not interpenetrate** — the scene sorts per object, so a
  long fence is many short props, not one long one.

## The thing that has caused the most bugs

Depth sorting. The camera looks down at 45°, so **height and depth contribute equally**:
`depth = (y + z) × sin(45°)`.

- Props sort by their geometry's **centroid**, not their base.
- Characters sort by their **centre of mass**, so they use the same model as props.
- Shadows sort by their **ground depth**, height bias stripped out — a shadow is a flat
  decal lying on the floor.

When a rendering bug appears, ask whether the sort key is answering the right question
before adjusting any geometry.

## Where things live

| File | Decides |
|---|---|
| `src/sim/constants.ts` | Walk speed, roll distance and cooldown, punch timings |
| `src/render3d/pose.ts` | What the walk, punch and roll look like |
| `src/render3d/camera.ts` | Camera angle and zoom |
| `src/world/palette.ts` | Every colour in the village |
| `src/world/village.ts` | Where every building, NPC and dummy stands |
| `src/world/fortifications.ts` | Wall, towers, gates |
| `src/world/guard.ts` | Patrol routes and the garrison |

## Built so far

Floating joystick, three-hit fist combo, tuck-and-roll dodge. A walled village: four shops
and four homes you can walk into, a market, a plaza signpost, a training yard. Curtain wall
with twelve towers, four gatehouses, a garrison of twenty. Straw dummies with damage
numbers and hitstop.

## Not built

No enemies, no health, no death, no loot, no progression, no multiplayer. The magic button
is wired up and hidden, waiting for the first magic item.

The arena (1v1 / 2v2) was the original hook and does not exist. `sim/` is kept pure so a
server could run it.

## Badge

Fri3d 2026 badge: ESP32-S3 @ 240MHz, 8MB PSRAM, 2" capacitive touchscreen, running
MicroPythonOS with apps in MicroPython on LVGL.

**This codebase does not port.** It is TypeScript in a browser canvas; the badge has
neither. A badge version would be a rewrite in MicroPython reusing the *design* and the
tuned numbers, not the code — and it would need a far simpler renderer, since this one
transforms ~500 corners per frame.

An MCP server for the badge is configured for this project as `fri3d-badge`.
