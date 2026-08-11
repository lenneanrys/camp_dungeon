# Day 1 — Character and Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A jungle-explorer character you can drive around a phone screen with a floating
joystick, punch with an animated fist, and roll with a smooth speed burst — plus a magic
button that exists in code but is not shown yet.

**Architecture:** Pure logic lives in `src/sim/` and `src/input/` with zero DOM and zero
canvas access, so every rule below is unit-testable and the same code can later run on the
server and on the badge. `src/render/` is the only place that touches a canvas. The
character costume is *data* — an ordered list of coloured boxes with group tags — so
customising the explorer later means editing a table, not rewriting a renderer.

**Tech Stack:** TypeScript, Vite (dev server + phone testing over LAN), Vitest (tests),
Canvas 2D (rendering). No game engine.

**Note on commits:** This project is deliberately not a git repo yet. Every "Checkpoint"
below is where a commit *would* go. Run `git init` whenever you want and they become real.

---

## Conventions

**World units.** 1 unit = 1 tile = 32 screen pixels at base zoom. Player walk speed is
`4.5` units/second.

**Model units.** The character model uses Minecraft proportions: head `8×8×8`,
torso `8×12×4`, each arm and leg `4×12×4`. 1 model unit = 1/16 world unit.

**Fixed timestep.** The sim always advances in fixed `1/60` second steps. Render
interpolates between them. Never pass a variable `dt` into `sim/`.

**Test command:** `npx vitest run <path>` for one file, `npx vitest` to watch.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

**Step 1: Initialise**

```bash
cd /Users/lenne/camp-dungeon
npm init -y
npm install -D typescript vite vitest
```

**Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: true, port: 5173 },
  test: { environment: 'node' },
})
```

`host: true` is what lets your phone reach the dev server over wifi.

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <title>Camp Dungeon</title>
    <style>
      html, body { margin: 0; height: 100%; background: #14100c; overscroll-behavior: none; }
      canvas { display: block; width: 100%; height: 100%; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`touch-action: none` and `user-scalable=no` are not optional — without them the browser
steals your drags for scrolling and pinch-zoom, and the joystick will feel broken.

**Step 5: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 6: Verify**

Run: `npm run dev`
Expected: server starts and prints a Network URL like `http://192.168.0.123:5173/`.
Open that on your phone — you should get a dark empty page.

**Checkpoint:** scaffold works, phone can reach it.

---

## Task 1: Vector math

**Files:**
- Create: `src/sim/vec2.ts`
- Test: `src/sim/vec2.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { length, normalize, clampLength, scale } from './vec2'

describe('vec2', () => {
  it('measures length', () => {
    expect(length({ x: 3, y: 4 })).toBe(5)
  })

  it('normalizes to unit length', () => {
    const n = normalize({ x: 0, y: 9 })
    expect(n.x).toBeCloseTo(0)
    expect(n.y).toBeCloseTo(1)
  })

  it('normalizing a zero vector returns zero, not NaN', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('clampLength caps long vectors but leaves short ones alone', () => {
    expect(length(clampLength({ x: 10, y: 0 }, 4))).toBeCloseTo(4)
    expect(clampLength({ x: 1, y: 0 }, 4)).toEqual({ x: 1, y: 0 })
  })

  it('scales', () => {
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 })
  })
})
```

The zero-vector test matters: a joystick released at exactly its origin divides by zero,
and `NaN` positions silently teleport the player into nowhere.

**Step 2: Run to verify it fails**

Run: `npx vitest run src/sim/vec2.test.ts`
Expected: FAIL — cannot find module `./vec2`.

**Step 3: Minimal implementation**

```ts
export interface Vec2 { x: number; y: number }

export const length = (v: Vec2): number => Math.hypot(v.x, v.y)

export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k })

export function normalize(v: Vec2): Vec2 {
  const len = length(v)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

export function clampLength(v: Vec2, max: number): Vec2 {
  const len = length(v)
  return len <= max ? v : scale(v, max / len)
}
```

**Step 4: Run to verify it passes**

Run: `npx vitest run src/sim/vec2.test.ts` — Expected: 5 passing.

**Checkpoint:** `feat: add vec2 math`

---

## Task 2: Floating joystick

The stick has no fixed position. Wherever the left thumb lands becomes the centre. Drag
away from that point to steer. This is the single biggest feel win in mobile action games —
fixed sticks force players to look at their thumb.

**Files:**
- Create: `src/input/joystick.ts`
- Test: `src/input/joystick.test.ts`

**Behaviour being specified:**
- `press(x, y)` sets the origin and captures a touch id.
- `move(x, y)` produces a direction and a magnitude in `0..1`.
- Magnitude is the drag distance divided by `RADIUS` (48px), capped at 1.
- Drags under `DEADZONE` (8px) produce zero, so a resting thumb does not creep.
- `release()` zeroes everything.
- If the drag exceeds the radius, the origin *follows* the thumb, so the stick never feels
  stuck when you drag a long way.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Joystick, JOYSTICK_RADIUS, JOYSTICK_DEADZONE } from './joystick'

describe('Joystick', () => {
  it('is neutral before any touch', () => {
    const j = new Joystick()
    expect(j.magnitude).toBe(0)
    expect(j.direction).toEqual({ x: 0, y: 0 })
    expect(j.active).toBe(false)
  })

  it('becomes active on press and reports the origin', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    expect(j.active).toBe(true)
    expect(j.origin).toEqual({ x: 100, y: 200 })
    expect(j.magnitude).toBe(0)
  })

  it('ignores drags inside the deadzone', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_DEADZONE - 1, 200, 1)
    expect(j.magnitude).toBe(0)
  })

  it('reports direction and partial magnitude', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_RADIUS / 2, 200, 1)
    expect(j.direction.x).toBeCloseTo(1)
    expect(j.direction.y).toBeCloseTo(0)
    expect(j.magnitude).toBeGreaterThan(0.4)
    expect(j.magnitude).toBeLessThan(0.6)
  })

  it('caps magnitude at 1 and drags the origin along', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_RADIUS * 3, 200, 1)
    expect(j.magnitude).toBe(1)
    expect(j.origin.x).toBeCloseTo(100 + JOYSTICK_RADIUS * 2)
  })

  it('ignores events from a different touch id', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(300, 200, 7)
    expect(j.magnitude).toBe(0)
  })

  it('resets on release', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(180, 200, 1)
    j.release(1)
    expect(j.active).toBe(false)
    expect(j.magnitude).toBe(0)
  })
})
```

The touch-id test is what stops the joystick from lurching sideways when the right thumb
taps attack. Multi-touch bugs are the number one reason mobile games feel wrong.

**Step 2: Run to verify it fails**

Run: `npx vitest run src/input/joystick.test.ts` — Expected: FAIL, module not found.

**Step 3: Minimal implementation**

```ts
import { Vec2, normalize, length } from '../sim/vec2'

export const JOYSTICK_RADIUS = 48
export const JOYSTICK_DEADZONE = 8

export class Joystick {
  active = false
  origin: Vec2 = { x: 0, y: 0 }
  knob: Vec2 = { x: 0, y: 0 }
  direction: Vec2 = { x: 0, y: 0 }
  magnitude = 0
  private touchId: number | null = null

  press(x: number, y: number, id: number): void {
    this.active = true
    this.touchId = id
    this.origin = { x, y }
    this.knob = { x, y }
    this.direction = { x: 0, y: 0 }
    this.magnitude = 0
  }

  move(x: number, y: number, id: number): void {
    if (!this.active || id !== this.touchId) return
    const delta = { x: x - this.origin.x, y: y - this.origin.y }
    const dist = length(delta)

    if (dist < JOYSTICK_DEADZONE) {
      this.direction = { x: 0, y: 0 }
      this.magnitude = 0
      this.knob = { x, y }
      return
    }

    this.direction = normalize(delta)

    if (dist > JOYSTICK_RADIUS) {
      // Let the origin trail the thumb so long drags never feel stuck.
      this.origin = {
        x: x - this.direction.x * JOYSTICK_RADIUS,
        y: y - this.direction.y * JOYSTICK_RADIUS,
      }
      this.magnitude = 1
    } else {
      this.magnitude = dist / JOYSTICK_RADIUS
    }
    this.knob = { x, y }
  }

  release(id: number): void {
    if (id !== this.touchId) return
    this.active = false
    this.touchId = null
    this.direction = { x: 0, y: 0 }
    this.magnitude = 0
  }
}
```

**Step 4: Run to verify it passes** — Expected: 7 passing.

**Checkpoint:** `feat: add floating joystick`

---

## Task 3: Touch buttons and multi-touch routing

**Files:**
- Create: `src/input/button.ts`, `src/input/touchRouter.ts`
- Test: `src/input/button.test.ts`, `src/input/touchRouter.test.ts`

**Behaviour:**
- A button is a circle with a radius and a hit-test.
- `justPressed` is true for exactly one sim tick, then clears. This is what makes "tap to
  attack" fire once instead of every frame you hold.
- A hidden button never registers a press. (This is how the magic button exists without
  being usable yet.)
- The router decides: touches starting on the left half drive the joystick, touches
  starting on a button drive that button. Where a touch *starts* owns it for its whole
  life — sliding your thumb off a button does not hand it to the joystick.

**Step 1: Write the failing tests**

`src/input/button.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TouchButton } from './button'

describe('TouchButton', () => {
  it('hit-tests within its radius', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    expect(b.contains(120, 100)).toBe(true)
    expect(b.contains(180, 100)).toBe(false)
  })

  it('a hidden button cannot be hit', () => {
    const b = new TouchButton('magic', 100, 100, 40)
    b.visible = false
    expect(b.contains(100, 100)).toBe(false)
  })

  it('justPressed lasts exactly one tick', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    expect(b.justPressed).toBe(true)
    expect(b.held).toBe(true)
    b.endTick()
    expect(b.justPressed).toBe(false)
    expect(b.held).toBe(true)
  })

  it('release clears held', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    b.release(1)
    expect(b.held).toBe(false)
  })

  it('ignores release from a different touch id', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    b.release(9)
    expect(b.held).toBe(true)
  })
})
```

`src/input/touchRouter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TouchRouter } from './touchRouter'

const SCREEN = { width: 800, height: 400 }

describe('TouchRouter', () => {
  it('sends a left-half touch to the joystick', () => {
    const r = new TouchRouter(SCREEN.width, SCREEN.height)
    r.onDown(120, 300, 1)
    expect(r.joystick.active).toBe(true)
  })

  it('sends a touch on the attack button to that button', () => {
    const r = new TouchRouter(SCREEN.width, SCREEN.height)
    const attack = r.buttons.find(b => b.id === 'attack')!
    r.onDown(attack.x, attack.y, 1)
    expect(attack.justPressed).toBe(true)
    expect(r.joystick.active).toBe(false)
  })

  it('does not route to the hidden magic button', () => {
    const r = new TouchRouter(SCREEN.width, SCREEN.height)
    const magic = r.buttons.find(b => b.id === 'magic')!
    expect(magic.visible).toBe(false)
    r.onDown(magic.x, magic.y, 1)
    expect(magic.justPressed).toBe(false)
  })

  it('a touch that starts on a button keeps it while sliding away', () => {
    const r = new TouchRouter(SCREEN.width, SCREEN.height)
    const attack = r.buttons.find(b => b.id === 'attack')!
    r.onDown(attack.x, attack.y, 1)
    r.onMove(100, 300, 1)
    expect(r.joystick.active).toBe(false)
    expect(attack.held).toBe(true)
  })

  it('handles both thumbs at once', () => {
    const r = new TouchRouter(SCREEN.width, SCREEN.height)
    const attack = r.buttons.find(b => b.id === 'attack')!
    r.onDown(120, 300, 1)
    r.onDown(attack.x, attack.y, 2)
    r.onMove(200, 300, 1)
    expect(r.joystick.magnitude).toBeGreaterThan(0)
    expect(attack.held).toBe(true)
  })
})
```

**Step 2: Run both to verify they fail.**

**Step 3: Implementations**

`src/input/button.ts`:

```ts
export type ButtonId = 'attack' | 'roll' | 'magic'

export class TouchButton {
  visible = true
  held = false
  justPressed = false
  private touchId: number | null = null

  constructor(
    readonly id: ButtonId,
    public x: number,
    public y: number,
    public radius: number,
  ) {}

  contains(px: number, py: number): boolean {
    if (!this.visible) return false
    return Math.hypot(px - this.x, py - this.y) <= this.radius
  }

  press(id: number): void {
    if (!this.visible) return
    this.touchId = id
    this.held = true
    this.justPressed = true
  }

  release(id: number): void {
    if (id !== this.touchId) return
    this.touchId = null
    this.held = false
  }

  /** Call once at the end of every sim tick. */
  endTick(): void {
    this.justPressed = false
  }
}
```

`src/input/touchRouter.ts`:

```ts
import { Joystick } from './joystick'
import { TouchButton, ButtonId } from './button'

type Owner = { kind: 'joystick' } | { kind: 'button'; button: TouchButton }

export class TouchRouter {
  readonly joystick = new Joystick()
  readonly buttons: TouchButton[]
  private owners = new Map<number, Owner>()

  constructor(width: number, height: number) {
    // Right-thumb cluster, laid out from the bottom-right corner.
    const r = 44
    const margin = 28
    this.buttons = [
      new TouchButton('attack', width - margin - r, height - margin - r, r),
      new TouchButton('roll', width - margin - r * 3.2, height - margin - r * 0.6, r * 0.85),
      new TouchButton('magic', width - margin - r * 1.4, height - margin - r * 3.1, r * 0.85),
    ]
    // No magic items exist yet, so the button is built but not shown.
    this.buttons.find(b => b.id === 'magic')!.visible = false
  }

  onDown(x: number, y: number, id: number): void {
    const hit = this.buttons.find(b => b.contains(x, y))
    if (hit) {
      hit.press(id)
      this.owners.set(id, { kind: 'button', button: hit })
      return
    }
    if (x < this.halfWidth) {
      this.joystick.press(x, y, id)
      this.owners.set(id, { kind: 'joystick' })
    }
  }

  onMove(x: number, y: number, id: number): void {
    const owner = this.owners.get(id)
    if (owner?.kind === 'joystick') this.joystick.move(x, y, id)
    // Buttons deliberately ignore movement: sliding off does not release.
  }

  onUp(id: number): void {
    const owner = this.owners.get(id)
    if (owner?.kind === 'joystick') this.joystick.release(id)
    if (owner?.kind === 'button') owner.button.release(id)
    this.owners.delete(id)
  }

  endTick(): void {
    for (const b of this.buttons) b.endTick()
  }

  button(id: ButtonId): TouchButton {
    return this.buttons.find(b => b.id === id)!
  }

  private halfWidth = 0
  resize(width: number, height: number): void {
    this.halfWidth = width / 2
    const r = 44
    const margin = 28
    this.button('attack').x = width - margin - r
    this.button('attack').y = height - margin - r
    this.button('roll').x = width - margin - r * 3.2
    this.button('roll').y = height - margin - r * 0.6
    this.button('magic').x = width - margin - r * 1.4
    this.button('magic').y = height - margin - r * 3.1
  }
}
```

Note: call `resize(width, height)` in the constructor too so `halfWidth` is set. Fold that
in when implementing.

**Step 4: Run both test files — Expected: 10 passing.**

**Checkpoint:** `feat: add touch buttons and multi-touch routing`

---

## Task 4: Player movement

**Files:**
- Create: `src/sim/constants.ts`, `src/sim/player.ts`
- Test: `src/sim/player.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Player } from './player'
import { WALK_SPEED, TICK } from './constants'

const noInput = { move: { x: 0, y: 0 }, moveMagnitude: 0, attack: false, roll: false, magic: false }

describe('Player movement', () => {
  it('starts still', () => {
    const p = new Player()
    p.tick(noInput)
    expect(p.pos).toEqual({ x: 0, y: 0 })
  })

  it('walks at WALK_SPEED with the stick fully pushed', () => {
    const p = new Player()
    p.tick({ ...noInput, move: { x: 1, y: 0 }, moveMagnitude: 1 })
    expect(p.pos.x).toBeCloseTo(WALK_SPEED * TICK)
  })

  it('walks slower with a partly pushed stick', () => {
    const p = new Player()
    p.tick({ ...noInput, move: { x: 1, y: 0 }, moveMagnitude: 0.5 })
    expect(p.pos.x).toBeCloseTo(WALK_SPEED * 0.5 * TICK)
  })

  it('faces the direction it moves', () => {
    const p = new Player()
    p.tick({ ...noInput, move: { x: 0, y: 1 }, moveMagnitude: 1 })
    expect(p.facing.y).toBeCloseTo(1)
  })

  it('keeps facing the last direction after the stick is released', () => {
    const p = new Player()
    p.tick({ ...noInput, move: { x: -1, y: 0 }, moveMagnitude: 1 })
    p.tick(noInput)
    expect(p.facing.x).toBeCloseTo(-1)
  })
})
```

**Step 2: Run to verify it fails.**

**Step 3: Implementation**

`src/sim/constants.ts`:

```ts
export const TICK = 1 / 60

export const WALK_SPEED = 4.5          // world units per second

export const ROLL_DURATION = 0.35      // seconds of the burst itself
export const ROLL_SPEED_MULT = 2.6     // peak multiplier at the start of the roll
export const ROLL_TAIL_DURATION = 0.25 // lingering "a bit faster for a while"
export const ROLL_TAIL_MULT = 1.35
export const ROLL_COOLDOWN = 3.0       // measured from the start of the roll

export const ATTACK_DURATIONS = [0.28, 0.26, 0.42] // three-hit combo
export const ATTACK_COMBO_WINDOW = 0.5             // seconds after a swing to chain
export const ATTACK_MOVE_MULT = 0.35               // you slow down mid-swing
```

`src/sim/player.ts`:

```ts
import { Vec2, normalize, scale } from './vec2'
import { WALK_SPEED, TICK } from './constants'

export interface PlayerInput {
  move: Vec2
  moveMagnitude: number
  attack: boolean
  roll: boolean
  magic: boolean
}

export class Player {
  pos: Vec2 = { x: 0, y: 0 }
  facing: Vec2 = { x: 0, y: 1 }

  tick(input: PlayerInput): void {
    const speed = WALK_SPEED * input.moveMagnitude
    if (input.moveMagnitude > 0) {
      const dir = normalize(input.move)
      this.facing = dir
      const step = scale(dir, speed * TICK)
      this.pos = { x: this.pos.x + step.x, y: this.pos.y + step.y }
    }
  }
}
```

**Step 4: Run to verify it passes — Expected: 5 passing.**

**Checkpoint:** `feat: add player movement`

---

## Task 5: Roll

You asked for the roll to feel smooth and to keep a bit of extra speed afterwards. That is
what `ROLL_TAIL_*` is for: a `0.35s` burst that eases *down* from 2.6× to 1×, followed by a
`0.25s` tail at 1.35×. Easing down rather than up is what makes it read as a launch rather
than a slide.

**Files:**
- Modify: `src/sim/player.ts`
- Test: `src/sim/player.roll.test.ts`

**Behaviour:**
- Roll locks its direction at the moment you press. Steering mid-roll is what makes dodges
  feel weightless.
- If the stick is neutral, you roll the way you are facing.
- Cooldown is 3s measured from the *start*, so the usable gap is ~2.65s.
- You cannot roll while rolling, and you cannot attack while rolling.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Player } from './player'
import {
  TICK, WALK_SPEED, ROLL_DURATION, ROLL_SPEED_MULT,
  ROLL_TAIL_DURATION, ROLL_COOLDOWN,
} from './constants'

const idle = { move: { x: 0, y: 0 }, moveMagnitude: 0, attack: false, roll: false, magic: false }
const rollPress = { ...idle, roll: true }
const runRight = { ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 }

function advance(p: Player, seconds: number, input = idle) {
  for (let i = 0; i < Math.round(seconds / TICK); i++) p.tick(input)
}

describe('Player roll', () => {
  it('enters the rolling state on press', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    expect(p.state).toBe('rolling')
  })

  it('moves faster than a walk during the roll', () => {
    const walker = new Player()
    advance(walker, ROLL_DURATION, runRight)

    const roller = new Player()
    roller.tick({ ...runRight, roll: true })
    advance(roller, ROLL_DURATION - TICK, runRight)

    expect(roller.pos.x).toBeGreaterThan(walker.pos.x * 1.5)
  })

  it('starts at peak speed and eases down', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    const firstStep = p.pos.x
    expect(firstStep).toBeCloseTo(WALK_SPEED * ROLL_SPEED_MULT * TICK, 3)

    advance(p, ROLL_DURATION * 0.8, runRight)
    const before = p.pos.x
    p.tick(runRight)
    const lastStep = p.pos.x - before
    expect(lastStep).toBeLessThan(firstStep)
  })

  it('locks direction — steering mid-roll does nothing', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION, { ...idle, move: { x: 0, y: 1 }, moveMagnitude: 1 })
    expect(Math.abs(p.pos.y)).toBeLessThan(0.001)
    expect(p.pos.x).toBeGreaterThan(0)
  })

  it('rolls the way it faces when the stick is neutral', () => {
    const p = new Player()
    p.tick({ ...idle, move: { x: -1, y: 0 }, moveMagnitude: 1 })
    p.tick(rollPress)
    advance(p, ROLL_DURATION)
    expect(p.pos.x).toBeLessThan(0)
  })

  it('returns to idle and keeps a faster tail', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION)
    expect(p.state).toBe('idle')

    const before = p.pos.x
    p.tick(runRight)
    expect(p.pos.x - before).toBeGreaterThan(WALK_SPEED * TICK)
  })

  it('the tail expires', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION + ROLL_TAIL_DURATION)
    const before = p.pos.x
    p.tick(runRight)
    expect(p.pos.x - before).toBeCloseTo(WALK_SPEED * TICK, 4)
  })

  it('cannot roll again until the cooldown expires', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    advance(p, ROLL_DURATION + 0.1)
    p.tick(rollPress)
    expect(p.state).not.toBe('rolling')

    advance(p, ROLL_COOLDOWN)
    p.tick(rollPress)
    expect(p.state).toBe('rolling')
  })
})
```

**Step 2: Run to verify it fails.**

**Step 3: Implementation — replace `src/sim/player.ts`**

```ts
import { Vec2, normalize, scale } from './vec2'
import {
  TICK, WALK_SPEED,
  ROLL_DURATION, ROLL_SPEED_MULT, ROLL_TAIL_DURATION, ROLL_TAIL_MULT, ROLL_COOLDOWN,
} from './constants'

export type PlayerState = 'idle' | 'rolling' | 'attacking'

export interface PlayerInput {
  move: Vec2
  moveMagnitude: number
  attack: boolean
  roll: boolean
  magic: boolean
}

export class Player {
  pos: Vec2 = { x: 0, y: 0 }
  facing: Vec2 = { x: 0, y: 1 }
  state: PlayerState = 'idle'

  rollTimer = 0        // counts down through the roll
  rollCooldown = 0     // counts down from ROLL_COOLDOWN
  rollTail = 0         // lingering speed after the roll
  private rollDir: Vec2 = { x: 0, y: 1 }

  get canRoll(): boolean {
    return this.state === 'idle' && this.rollCooldown <= 0
  }

  tick(input: PlayerInput): void {
    if (input.moveMagnitude > 0) this.facing = normalize(input.move)

    if (input.roll && this.canRoll) this.startRoll(input)

    if (this.state === 'rolling') this.tickRoll()
    else this.tickWalk(input)

    this.rollCooldown = Math.max(0, this.rollCooldown - TICK)
    this.rollTail = Math.max(0, this.rollTail - TICK)
  }

  private startRoll(input: PlayerInput): void {
    this.state = 'rolling'
    this.rollTimer = ROLL_DURATION
    this.rollCooldown = ROLL_COOLDOWN
    this.rollDir = input.moveMagnitude > 0 ? normalize(input.move) : this.facing
    this.facing = this.rollDir
  }

  private tickRoll(): void {
    // Ease from ROLL_SPEED_MULT down to 1 across the roll: a launch, not a slide.
    const progress = 1 - this.rollTimer / ROLL_DURATION
    const mult = ROLL_SPEED_MULT + (1 - ROLL_SPEED_MULT) * progress
    this.move(this.rollDir, WALK_SPEED * mult)

    this.rollTimer -= TICK
    if (this.rollTimer <= 0) {
      this.state = 'idle'
      this.rollTimer = 0
      this.rollTail = ROLL_TAIL_DURATION
    }
  }

  private tickWalk(input: PlayerInput): void {
    if (input.moveMagnitude <= 0) return
    const mult = this.rollTail > 0 ? ROLL_TAIL_MULT : 1
    this.move(normalize(input.move), WALK_SPEED * input.moveMagnitude * mult)
  }

  private move(dir: Vec2, speed: number): void {
    const step = scale(dir, speed * TICK)
    this.pos = { x: this.pos.x + step.x, y: this.pos.y + step.y }
  }
}
```

**Step 4: Run both player test files — Expected: all passing.**

**Checkpoint:** `feat: add roll with eased burst and speed tail`

---

## Task 6: Attack

Fists for now, three-hit combo, third swing heavier and slower. No damage yet — there is
nothing to hit. This task is about the *state machine and timing*, which is what the
animation and later the hitboxes hang off.

**Files:**
- Modify: `src/sim/player.ts`
- Test: `src/sim/player.attack.test.ts`

**Behaviour:**
- Tapping attack starts swing 1. Tapping again during the combo window chains to swing 2,
  then 3, then back to 1.
- Letting the window lapse resets the combo.
- You move at `ATTACK_MOVE_MULT` while swinging — slowed, not rooted. Rooting feels awful
  on a touchscreen.
- You cannot attack while rolling. Rolling cancels an attack (this is the escape hatch that
  makes the combat feel responsive rather than committal).

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Player } from './player'
import { TICK, WALK_SPEED, ATTACK_DURATIONS, ATTACK_COMBO_WINDOW, ATTACK_MOVE_MULT } from './constants'

const idle = { move: { x: 0, y: 0 }, moveMagnitude: 0, attack: false, roll: false, magic: false }
const runRight = { ...idle, move: { x: 1, y: 0 }, moveMagnitude: 1 }
const swing = { ...idle, attack: true }

function advance(p: Player, seconds: number, input = idle) {
  for (let i = 0; i < Math.round(seconds / TICK); i++) p.tick(input)
}

describe('Player attack', () => {
  it('enters the attacking state and starts at combo step 0', () => {
    const p = new Player()
    p.tick(swing)
    expect(p.state).toBe('attacking')
    expect(p.comboStep).toBe(0)
  })

  it('finishes a swing and returns to idle', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, ATTACK_DURATIONS[0]!)
    expect(p.state).toBe('idle')
  })

  it('chains to the next combo step inside the window', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, ATTACK_DURATIONS[0]!)
    p.tick(swing)
    expect(p.comboStep).toBe(1)
  })

  it('wraps back to step 0 after the third swing', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, ATTACK_DURATIONS[0]!)
    p.tick(swing)
    advance(p, ATTACK_DURATIONS[1]!)
    p.tick(swing)
    expect(p.comboStep).toBe(2)
    advance(p, ATTACK_DURATIONS[2]!)
    p.tick(swing)
    expect(p.comboStep).toBe(0)
  })

  it('resets the combo once the window lapses', () => {
    const p = new Player()
    p.tick(swing)
    advance(p, ATTACK_DURATIONS[0]! + ATTACK_COMBO_WINDOW + 0.05)
    p.tick(swing)
    expect(p.comboStep).toBe(0)
  })

  it('moves slowly while swinging instead of being rooted', () => {
    const p = new Player()
    p.tick({ ...runRight, attack: true })
    const before = p.pos.x
    p.tick(runRight)
    const step = p.pos.x - before
    expect(step).toBeGreaterThan(0)
    expect(step).toBeCloseTo(WALK_SPEED * ATTACK_MOVE_MULT * TICK, 4)
  })

  it('cannot attack while rolling', () => {
    const p = new Player()
    p.tick({ ...runRight, roll: true })
    p.tick(swing)
    expect(p.state).toBe('rolling')
  })

  it('rolling cancels an attack', () => {
    const p = new Player()
    p.tick(swing)
    p.tick({ ...idle, roll: true })
    expect(p.state).toBe('rolling')
  })

  it('exposes swing progress 0..1 for the animation', () => {
    const p = new Player()
    p.tick(swing)
    expect(p.attackProgress).toBeGreaterThanOrEqual(0)
    advance(p, ATTACK_DURATIONS[0]! * 0.5)
    expect(p.attackProgress).toBeGreaterThan(0.4)
    expect(p.attackProgress).toBeLessThan(0.7)
  })
})
```

`attackProgress` is the hook the renderer uses to swing the arm — the animation reads it
rather than keeping its own clock, so visuals can never drift out of sync with the sim.

**Step 2: Run to verify it fails.**

**Step 3: Implementation — add to `Player`**

```ts
// fields
comboStep = 0
attackTimer = 0
private comboWindow = 0

get attackProgress(): number {
  if (this.state !== 'attacking') return 0
  const total = ATTACK_DURATIONS[this.comboStep] ?? ATTACK_DURATIONS[0]!
  return 1 - this.attackTimer / total
}

// in tick(), after the roll check and before the state dispatch:
if (input.attack && this.state === 'idle') this.startAttack()

// state dispatch becomes:
if (this.state === 'rolling') this.tickRoll()
else if (this.state === 'attacking') this.tickAttack(input)
else this.tickWalk(input)

this.comboWindow = Math.max(0, this.comboWindow - TICK)

private startAttack(): void {
  if (this.comboWindow <= 0) this.comboStep = 0
  this.state = 'attacking'
  this.attackTimer = ATTACK_DURATIONS[this.comboStep] ?? ATTACK_DURATIONS[0]!
}

private tickAttack(input: PlayerInput): void {
  if (input.moveMagnitude > 0) {
    this.move(normalize(input.move), WALK_SPEED * input.moveMagnitude * ATTACK_MOVE_MULT)
  }
  this.attackTimer -= TICK
  if (this.attackTimer <= 0) {
    this.state = 'idle'
    this.attackTimer = 0
    this.comboStep = (this.comboStep + 1) % ATTACK_DURATIONS.length
    this.comboWindow = ATTACK_COMBO_WINDOW
  }
}
```

`startRoll` must also clear `attackTimer` and set `state` so a roll cancels a swing.

**Step 4: Run all three player test files — Expected: all passing.**

**Checkpoint:** `feat: add three-hit fist combo`

---

## Task 7: Magic button (built, not shown)

**Files:**
- Modify: `src/sim/player.ts`
- Test: `src/sim/player.magic.test.ts`

The button and the plumbing exist so that adding the first magic item on Day 3 is a
one-line change. It is invisible and inert until then.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Player } from './player'
import { TouchRouter } from '../input/touchRouter'

const idle = { move: { x: 0, y: 0 }, moveMagnitude: 0, attack: false, roll: false, magic: false }

describe('Magic', () => {
  it('does nothing without a magic item equipped', () => {
    const p = new Player()
    p.tick({ ...idle, magic: true })
    expect(p.state).toBe('idle')
    expect(p.magicUses).toBe(0)
  })

  it('the magic button is hidden while no magic item is equipped', () => {
    const r = new TouchRouter(800, 400)
    expect(r.button('magic').visible).toBe(false)
  })

  it('the button appears once a magic item exists', () => {
    const r = new TouchRouter(800, 400)
    r.setMagicAvailable(true)
    expect(r.button('magic').visible).toBe(true)
  })
})
```

**Step 2: Run to verify it fails.**

**Step 3: Implementation**

In `Player`: add `magicUses = 0` and `hasMagicItem = false`. In `tick`:

```ts
if (input.magic && this.hasMagicItem && this.state === 'idle') {
  this.magicUses++
  // Day 3: trigger the equipped magic item here.
}
```

In `TouchRouter`:

```ts
setMagicAvailable(available: boolean): void {
  this.button('magic').visible = available
}
```

**Step 4: Run to verify it passes — Expected: 3 passing.**

**Checkpoint:** `feat: stub magic button behind an availability flag`

---

## Task 8: The jungle explorer costume

The costume is **data**: an ordered list of coloured boxes tagged with a body group. No
canvas involved, so it is fully testable, and recolouring or adding gear later is editing a
table.

Minecraft proportions in model units: head `8×8×8`, torso `8×12×4`, arm `4×12×4`,
leg `4×12×4`.

**Files:**
- Create: `src/render/costume.ts`
- Test: `src/render/costume.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { jungleExplorer, buildModel, BodyGroup } from './costume'

describe('costume', () => {
  it('builds every body group', () => {
    const boxes = buildModel(jungleExplorer)
    const groups = new Set(boxes.map(b => b.group))
    const expected: BodyGroup[] = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']
    for (const g of expected) expect(groups.has(g)).toBe(true)
  })

  it('uses Minecraft head proportions', () => {
    const head = buildModel(jungleExplorer).find(b => b.group === 'head' && b.id === 'head')!
    expect(head.size).toEqual({ w: 8, h: 8, d: 8 })
  })

  it('gives the explorer a vest over the torso', () => {
    const boxes = buildModel(jungleExplorer)
    expect(boxes.some(b => b.id === 'vest')).toBe(true)
  })

  it('the vest is drawn after the torso so it sits on top', () => {
    const boxes = buildModel(jungleExplorer)
    expect(boxes.findIndex(b => b.id === 'vest'))
      .toBeGreaterThan(boxes.findIndex(b => b.id === 'torso'))
  })

  it('has a face on the head', () => {
    const boxes = buildModel(jungleExplorer)
    expect(boxes.some(b => b.id === 'eyeL')).toBe(true)
    expect(boxes.some(b => b.id === 'eyeR')).toBe(true)
  })

  it('is recolourable without touching the geometry', () => {
    const custom = { ...jungleExplorer, colors: { ...jungleExplorer.colors, vest: '#ff0000' } }
    const vest = buildModel(custom).find(b => b.id === 'vest')!
    expect(vest.color).toBe('#ff0000')
    expect(vest.size).toEqual(buildModel(jungleExplorer).find(b => b.id === 'vest')!.size)
  })

  it('legs are mirrored around the centre line', () => {
    const boxes = buildModel(jungleExplorer)
    const l = boxes.find(b => b.id === 'legL')!
    const r = boxes.find(b => b.id === 'legR')!
    expect(l.pos.x).toBeCloseTo(-r.pos.x)
    expect(l.pos.y).toBeCloseTo(r.pos.y)
  })
})
```

The recolour test is the one that protects your "customise later" requirement — it fails
loudly if someone hard-codes a colour into the geometry.

**Step 2: Run to verify it fails.**

**Step 3: Implementation**

```ts
export type BodyGroup = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR'

export interface Box {
  id: string
  group: BodyGroup
  pos: { x: number; y: number; z: number }   // centre, model units, y is up
  size: { w: number; h: number; d: number }
  color: string
}

export interface Costume {
  colors: Record<string, string>
}

export const jungleExplorer: Costume = {
  colors: {
    skin: '#c68642',
    hair: '#3b2a1a',
    shirt: '#d9cba3',   // dirty linen
    vest: '#4e6b3f',    // olive
    pants: '#8b7b4e',   // khaki
    boots: '#5a3d24',
    hat: '#c2a878',
    eye: '#241a12',
  },
}

export function buildModel(c: Costume): Box[] {
  const col = c.colors
  return [
    // legs first: they sit behind and below everything
    { id: 'legL', group: 'legL', pos: { x: -2, y: 6, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col.pants! },
    { id: 'legR', group: 'legR', pos: { x: 2, y: 6, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col.pants! },
    { id: 'bootL', group: 'legL', pos: { x: -2, y: 1, z: 0 }, size: { w: 4.4, h: 3, d: 4.4 }, color: col.boots! },
    { id: 'bootR', group: 'legR', pos: { x: 2, y: 1, z: 0 }, size: { w: 4.4, h: 3, d: 4.4 }, color: col.boots! },

    { id: 'torso', group: 'torso', pos: { x: 0, y: 18, z: 0 }, size: { w: 8, h: 12, d: 4 }, color: col.shirt! },
    { id: 'vest', group: 'torso', pos: { x: 0, y: 18, z: 0 }, size: { w: 8.6, h: 10, d: 4.6 }, color: col.vest! },

    { id: 'armL', group: 'armL', pos: { x: -6, y: 18, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col.skin! },
    { id: 'armR', group: 'armR', pos: { x: 6, y: 18, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col.skin! },

    { id: 'head', group: 'head', pos: { x: 0, y: 28, z: 0 }, size: { w: 8, h: 8, d: 8 }, color: col.skin! },
    { id: 'hair', group: 'head', pos: { x: 0, y: 31, z: -0.5 }, size: { w: 8.4, h: 3, d: 8.4 }, color: col.hair! },
    { id: 'hat', group: 'head', pos: { x: 0, y: 32.5, z: 0 }, size: { w: 12, h: 1.5, d: 12 }, color: col.hat! },
    { id: 'hatTop', group: 'head', pos: { x: 0, y: 34, z: 0 }, size: { w: 8.4, h: 3, d: 8.4 }, color: col.hat! },

    { id: 'eyeL', group: 'head', pos: { x: -2, y: 28.5, z: 4.1 }, size: { w: 1.5, h: 1.5, d: 0.2 }, color: col.eye! },
    { id: 'eyeR', group: 'head', pos: { x: 2, y: 28.5, z: 4.1 }, size: { w: 1.5, h: 1.5, d: 0.2 }, color: col.eye! },
  ]
}
```

Note the vest is slightly *larger* than the torso (`8.6` vs `8`) so it renders as a layer on
top rather than z-fighting with the shirt. Same trick for hair over the head.

**Step 4: Run to verify it passes — Expected: 7 passing.**

**Checkpoint:** `feat: add jungle explorer costume as data`

---

## Task 9: Renderer and animation

This is the first task with real canvas work, so the tests cover only the *maths* — the
projection and the animation curves. Whether it looks good is judged with your eyes on your
phone, not with an assertion.

**Files:**
- Create: `src/render/project.ts`, `src/render/animate.ts`, `src/render/drawCharacter.ts`
- Test: `src/render/project.test.ts`, `src/render/animate.test.ts`

**Projection.** A fixed axonometric camera, the Minecraft Dungeons three-quarter view:

```ts
export const SCALE = 2          // screen px per model unit
export const Y_SQUASH = 0.85    // vertical foreshortening
export const Z_SHIFT = 0.5      // how much depth pushes down-screen

export function project(x: number, y: number, z: number) {
  return { sx: x * SCALE, sy: (-y * Y_SQUASH + z * Z_SHIFT) * SCALE }
}

/** Painter's algorithm: bigger sorts later, so it draws in front. */
export const depthKey = (b: { pos: { y: number; z: number } }) => b.pos.z * 100 - b.pos.y
```

**Animation.** Pure functions from sim state to per-group rotations, so nothing keeps its
own clock:

```ts
/** Legs and arms counter-swing while walking. */
export function walkSwing(distanceTravelled: number): number {
  return Math.sin(distanceTravelled * 3.2) * 0.7
}

/** Fist punch: fast out, slow back. `progress` is Player.attackProgress. */
export function punchExtend(progress: number): number {
  return progress < 0.35
    ? progress / 0.35                       // snap out
    : 1 - (progress - 0.35) / 0.65          // ease back
}

/** Full forward tumble across the roll. */
export function rollSpin(progress: number): number {
  return progress * Math.PI * 2
}
```

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { punchExtend, rollSpin, walkSwing } from './animate'

describe('animation curves', () => {
  it('punch starts retracted, peaks early, and returns', () => {
    expect(punchExtend(0)).toBeCloseTo(0)
    expect(punchExtend(0.35)).toBeCloseTo(1)
    expect(punchExtend(1)).toBeCloseTo(0)
  })

  it('punch extends faster than it retracts', () => {
    expect(punchExtend(0.2)).toBeGreaterThan(punchExtend(0.8))
  })

  it('roll is exactly one full turn', () => {
    expect(rollSpin(0)).toBeCloseTo(0)
    expect(rollSpin(1)).toBeCloseTo(Math.PI * 2)
  })

  it('walk swing oscillates around zero', () => {
    expect(walkSwing(0)).toBeCloseTo(0)
    expect(Math.abs(walkSwing(5))).toBeLessThanOrEqual(0.7)
  })
})
```

Plus a projection test asserting that higher `y` maps to smaller `sy` (up the screen) and
that `depthKey` orders a nearer box after a farther one.

**Step 2–4:** fail, implement, pass.

**Step 5: Draw**

`drawCharacter.ts` takes the box list, applies the per-group rotation from `animate`, sorts
by `depthKey`, and for each box fills three faces: top (colour lightened ~18%), front
(base colour), side (darkened ~22%). That flat three-tone shading is what sells the blocky
look with no lighting maths.

**Checkpoint:** `feat: render animated box character`

---

## Task 10: Wire it up

**Files:**
- Modify: `src/main.ts`

**The loop.** Fixed-timestep accumulator — this is what keeps the sim identical on every
device regardless of frame rate, and it is a hard requirement for the Day 2 netcode:

```ts
let acc = 0
let last = performance.now()

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)   // clamp: never spiral after a tab switch
  last = now

  while (acc >= TICK) {
    player.tick(readInput(router))
    router.endTick()
    acc -= TICK
  }

  draw(ctx, player, acc / TICK)   // pass the leftover for interpolation
  requestAnimationFrame(frame)
}
```

Wire canvas `pointerdown`/`pointermove`/`pointerup`/`pointercancel` into
`router.onDown/onMove/onUp`, using `event.pointerId` as the touch id and
`getBoundingClientRect` to convert to canvas coordinates. Handle `pointercancel` — iOS
fires it constantly and a dropped cancel leaves a phantom thumb stuck on the joystick.

Set the canvas backing store to `devicePixelRatio` so it is not blurry on a phone.

**Step: Verify on the phone**

```bash
npm run dev
```

Open `http://192.168.0.123:5173` on your phone, landscape.

Check by hand:
1. Left thumb anywhere on the left half → stick appears there, character walks.
2. Character faces the way it walks; arms and legs swing.
3. Attack button → fist punches out and back. Tap three times fast → three swings.
4. Roll → clear forward burst, tumble, and you keep a little speed afterwards.
5. No magic button visible.
6. Both thumbs at once → walking and punching together, no lurching.
7. Nothing scrolls, zooms, or text-selects.

**Checkpoint:** `feat: playable character on phone`

---

## Day 1 done when

You can drive the jungle explorer around your phone screen with two thumbs and it feels
good to move. That is the whole bar. If the roll does not feel right, tune
`ROLL_SPEED_MULT`, `ROLL_DURATION` and `ROLL_TAIL_MULT` — they are all in one file
specifically so you can sit on your phone and fiddle.

**Not in Day 1:** enemies, damage, hitboxes, health, loot, the world. Those are Day 3.
