import { Joystick } from './joystick'
import { TouchButton } from './button'
import type { ButtonId } from './button'

type Owner = { kind: 'joystick' } | { kind: 'button'; button: TouchButton }

/**
 * Decides which control a touch belongs to. Ownership is decided where a touch
 * *starts* and never changes, so sliding a thumb off a button doesn't hand it
 * to the joystick.
 */
export class TouchRouter {
  readonly joystick = new Joystick()
  readonly buttons: TouchButton[]
  private owners = new Map<number, Owner>()
  private halfWidth = 0
  screenWidth = 0
  screenHeight = 0

  constructor(width: number, height: number) {
    const r = 44
    this.buttons = [
      new TouchButton('attack', 0, 0, r),
      new TouchButton('roll', 0, 0, r * 0.85),
      new TouchButton('magic', 0, 0, r * 0.85),
    ]
    // No magic items exist yet, so the button is built but not shown.
    this.button('magic').visible = false
    this.resize(width, height)
  }

  resize(width: number, height: number): void {
    this.halfWidth = width / 2
    this.screenWidth = width
    this.screenHeight = height
    const r = 44
    const margin = 28

    const attack = this.button('attack')
    attack.radius = r
    attack.x = width - margin - r
    attack.y = height - margin - r

    const roll = this.button('roll')
    roll.radius = r * 0.85
    roll.x = width - margin - r * 3.2
    roll.y = height - margin - r * 0.9

    const magic = this.button('magic')
    magic.radius = r * 0.85
    magic.x = width - margin - r * 1.4
    magic.y = height - margin - r * 3.1
  }

  onDown(x: number, y: number, id: number): void {
    const hit = this.buttons.find((b) => b.contains(x, y))
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

  setMagicAvailable(available: boolean): void {
    this.button('magic').visible = available
  }

  button(id: ButtonId): TouchButton {
    const found = this.buttons.find((b) => b.id === id)
    if (!found) throw new Error(`unknown button: ${id}`)
    return found
  }
}
