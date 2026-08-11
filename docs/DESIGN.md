# Camp Dungeon — Design

**Status:** draft for review. Edit anything here before Day 1 starts.
**Written:** 2026-08-10
**Budget:** 3 days of coding.

---

## 1. What this is

A Minecraft Dungeons–style top-down action game for touchscreens, played in a phone
browser at camp. Solo dungeon runs for loot and levels, plus 1v1 and 2v2 arena fights
against other people at the camp.

Later it ports to the 2026 BadgeHub badge (which is touchscreen), but **the phone version
is the deliverable**. The badge is a follow-up.

### Design pillars

1. **A run is short.** 4–6 minutes. "One more" must always be true.
2. **Combat feel beats content.** In 3 days we cannot out-content Minecraft Dungeons.
   We can make hitting things feel better than it has any right to.
3. **The hook is other people.** Progression is retention; the arena is the hook.
4. **Your build is visible.** You can see what someone is running by looking at them.

---

## 2. Controls

Landscape, two thumbs.

- **Left thumb:** floating virtual stick. Appears wherever you first press, so you never
  hunt for it. Move only.
- **Right thumb:** three buttons — **attack**, **roll**, **ability**.
- **Attack auto-targets the nearest enemy.** Non-negotiable. Precise aiming on glass feels
  awful and would sink the whole game.

---

## 3. Progression

### Gear

Four slots: **weapon, armour, accessory, magic item.**

Each item has **3 enchantment slots**. Each slot offers a random choice of 3 enchantments;
you pick one and spend enchant points to raise it **Tier 1 → 2 → 3**.

- Tier costs **1 / 2 / 3** points → 6 points to max one slot.
- 4 items × 3 slots × 6 = **72 points to max everything.**
- Camp level cap is ~**40**, so **you cannot max out.** Build choice is permanent and real.
- **Salvaging refunds all points invested.** Experimenting is never punished — this is what
  keeps people fiddling with builds between runs.

### XP and levels

- XP from killing mobs. Level N requires roughly `100 × N` XP.
- **1 enchant point per level.**

### Power level

`power = mean(power of your 4 equipped items)`

Power does nothing on its own — exactly as in Minecraft Dungeons, it is a yardstick.
We use it for dungeon difficulty and for Gauntlet matchmaking.

### Damage

```
damage = weaponBase × (1 + power / 50) × enchantMultipliers
```

- Attack is a **3-hit combo**, third hit heavier.
- **Roll:** 0.4s, **3 second cooldown**, **no invincibility frames by default.**
  I-frames are granted by an *enchantment*. This single choice creates a real build
  decision instead of a free defensive button.

### Enchantment pool (target 12–15)

Enough for genuine build identity, few enough to balance in 3 days. Starting list:

| Enchantment | Effect |
|---|---|
| Chain Lightning | Hits arc to nearby enemies |
| Life Steal | Heal a % of damage dealt |
| Shockwave | Roll ends in an AoE burst |
| Phantom Step | Roll grants i-frames |
| Poison Trail | Leave damaging ground behind you |
| Committed | Third combo hit deals bonus damage |
| Acrobat | Reduced roll cooldown |
| Thorns | Reflect a % of damage taken |
| Frenzy | Attack speed rises as HP falls |
| Guardian | Flat damage reduction |
| Ricochet | Attacks bounce to a second target |
| Echo | Small chance to repeat an attack |

---

## 4. Arena

Small symmetric room. **Best of 3 rounds, ~45 seconds each.** Server-authoritative, so
nobody can cheat. 1v1 and 2v2 use the same code with N = 2 or N = 4.

### Mode A — Proving Grounds (fair)

Both players draft from a **maxed preset armoury**. Gear is not kept. Pure skill.
No meaningful reward.

This is the safe entry point: new players and spectators can jump straight in without
risking anything, and it settles "who's actually better" arguments.

### Mode B — Gauntlet (stakes)

You bring your **real gear, real stats, no balancing.** Big reward, big loss.

**The stake is a symmetric enchant-point wager.** Both players ante the same number of
points; the winner takes the pot.

- The ante is **auto-capped to whatever the poorer player can afford.**
- The loser **keeps all their gear** — they just have to re-spec.

**Why it works this way:** unrestricted high-stakes fights die of a death spiral. The
strongest player farms everyone, newcomers lose their stuff in their first match, and by
day 2 of camp nobody queues except the top three. Capping the ante at what the weaker side
can pay kills that for free, with no matchmaking work. The loss still stings — losing
20 points is an evening of re-specing — but it is always recoverable in a run or two, so
people keep queueing.

---

## 5. Art — parametric box models

No image files. A character is a **list of coloured boxes** (head, torso, arms, legs)
drawn in fake-3D with a fixed light direction and a painter's-algorithm sort.

**Equipping gear appends boxes:** a helmet box on the head, a blade in the hand, a cape on
the back. Enchantments add glow and particle modifiers.

This gets the blocky Minecraft silhouette with zero assets, and it means **your character
visibly becomes your build** — which in a loot game is half the addiction. It also scales
down cleanly to the badge screen later.

---

## 6. Dungeon generation

Copied from how Minecraft Dungeons actually does it: **room by room from a pool of
authored rooms**, not block-by-block noise.

- ~12 hand-authored room templates.
- Fixed **landmark rooms** as anchors: start, mid-shrine, boss.
- A run is 6–8 rooms.

Landmarks give the run a shape and let players feel progress. Pure noise generation feels
like mush.

---

## 7. Technical architecture

**Client:** TypeScript + Vite + Canvas 2D. No game engine — at this size the overhead
costs more than it saves, and rolling it ourselves keeps the code portable to the badge.

```
sim/      pure logic — entities, combat, damage, enchantments,
          dungeon generation. Zero DOM, zero canvas, fixed timestep.
render/   canvas drawing, box models, particles, screenshake
input/    touch controls
net/      websocket client
server/   node + ws + sqlite
```

**`sim/` being pure is the most important decision in this document.** It buys two things
at once: the server runs the *exact same simulation* as the client (which is what makes
cheat-proof PvP possible at all), and the badge port becomes a renderer swap instead of a
rewrite.

**Netcode:** server-authoritative, 30Hz tick. Clients send **intents** (stick vector,
button presses), never positions. Server simulates and broadcasts snapshots at 20Hz.
Clients interpolate, and locally predict only their own movement.
No rollback, no lockstep — those eat weeks.

**Accounts:** no signup. First launch generates a token into localStorage and asks for a
display name. SQLite on the server holds gear, XP, and enchant points.

**Deploy:** Fly.io free tier, EU region. One small VM serves both the static client and
the WebSocket, so there is no CORS to fight. Players join by QR code.

**Phone testing during development:** `vite --host`, phone on the same wifi, open the
Mac's LAN address in mobile Safari/Chrome.

---

## 8. The 3 days

### Day 1 — Feel

Sim core with fixed timestep, touch controls, box renderer, one arena room, one enemy
type. Attack, roll, hitstop, screenshake, hit flash, damage numbers.

> **Gate:** if hitting a skeleton isn't satisfying by the end of Day 1, stop and fix it.
> Nothing downstream matters.

### Day 2 — Netcode

Server, accounts, WebSocket, 1v1 Proving Grounds working end-to-end **between two real
phones**. Then 2v2 (same code, N=4).

> **Deploy to Fly.io on Day 2, not Day 3.** Deploy surprises are the classic Day 3 killer.

### Day 3 — Progression

Dungeon generation from the room pool, mob variety, loot drops, the enchantment screen,
XP and levels, the Gauntlet wager. Audio and final polish in the last hours.

### Cut-line

If you fall behind, drop in this order:

1. 2v2
2. Gauntlet wager
3. Room variety
4. Enchantment count

**Never cut:** combat feel, 1v1.

---

## 9. Open questions

- Mob roster for Day 3 — how many types, and which?
- Does the dungeon have a difficulty selector, or does it scale off power level?
- Is there a spectator view for arena fights? (Would be a big deal at a camp, but it is
  not in the 3-day budget.)
