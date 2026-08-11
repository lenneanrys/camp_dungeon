import type { TouchRouter } from '../input/touchRouter'
import type { Player } from '../sim/player'
import { JOYSTICK_RADIUS } from '../input/joystick'
import { ROLL_COOLDOWN } from '../sim/constants'
import { iconPath, iconScale, ICON_VIEWBOX } from './icons'

/** Resting position of the stick's home ring, from the bottom-left corner. */
const HOME_X = 96
const HOME_Y = 96

function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: 'attack' | 'roll' | 'magic',
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  const s = iconScale(size)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.translate(-ICON_VIEWBOX / 2, -ICON_VIEWBOX / 2)
  ctx.fillStyle = `rgba(255,255,255,${alpha})`
  ctx.fill(iconPath(id))
  ctx.restore()
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  router: TouchRouter,
  player: Player,
): void {
  const j = router.joystick

  // The stick is drawn wherever the thumb is, but there is always SOMETHING on
  // screen — a dim home ring — so it is never invisible. Everything gets a dark
  // outline underneath, because thin white on bright green disappears.
  const cx = j.active ? j.origin.x : HOME_X
  const cy = j.active ? j.origin.y : router.screenHeight - HOME_Y
  const alpha = j.active ? 1 : 0.35

  ctx.lineWidth = 5
  ctx.strokeStyle = `rgba(0,0,0,${0.35 * alpha})`
  ctx.beginPath()
  ctx.arc(cx, cy, JOYSTICK_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 2.5
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`
  ctx.beginPath()
  ctx.arc(cx, cy, JOYSTICK_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

  const knobX = cx + j.direction.x * JOYSTICK_RADIUS * j.magnitude
  const knobY = cy + j.direction.y * JOYSTICK_RADIUS * j.magnitude
  ctx.fillStyle = `rgba(0,0,0,${0.3 * alpha})`
  ctx.beginPath()
  ctx.arc(knobX, knobY, 21, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${0.8 * alpha})`
  ctx.beginPath()
  ctx.arc(knobX, knobY, 18, 0, Math.PI * 2)
  ctx.fill()

  for (const b of router.buttons) {
    if (!b.visible) continue

    const ready = b.id !== 'roll' || player.rollCooldown <= 0
    const bg = b.held ? 0.3 : ready ? 0.14 : 0.06

    ctx.fillStyle = `rgba(255,255,255,${bg})`
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.fill()

    // The roll ring fills as it recharges, so the cooldown is readable at a
    // glance without a number.
    if (b.id === 'roll' && player.rollCooldown > 0) {
      const done = 1 - player.rollCooldown / ROLL_COOLDOWN
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius - 2, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2)
      ctx.stroke()
    }

    ctx.strokeStyle = `rgba(255,255,255,${ready ? 0.45 : 0.18})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.stroke()

    drawIcon(ctx, b.id, b.x, b.y, b.radius * 1.15, ready ? 0.92 : 0.32)
  }
}
