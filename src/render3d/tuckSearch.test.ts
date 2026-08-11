import { describe, it } from 'vitest'
import { buildParts, jungleExplorer } from './model'
import { posedCentres, bodyCentre, buildScene } from './scene'
import type { Pose } from './scene'
import { length, sub } from './vec3'

/**
 * Not an assertion — a search. Finds the tuck angles that actually close the
 * body into a ball, rather than guessing and re-running the suite.
 * Skipped by default; unskip and read the output when retuning the roll.
 */

const PARTS = buildParts(jungleExplorer)

const makePose = (hip: number, shoulder: number, torso: number, head: number): Pose => ({
  root: { x: 0, y: 0, z: 0 },
  torso: { x: torso, y: 0, z: 0 },
  head: { x: head, y: 0, z: 0 },
  armL: { x: shoulder, y: 0, z: 0 },
  armR: { x: shoulder, y: 0, z: 0 },
  legL: { x: hip, y: 0, z: 0 },
  legR: { x: hip, y: 0, z: 0 },
})

function metrics(pose: Pose) {
  const centres = posedCentres(PARTS, pose)
  const centre = bodyCentre(PARTS, pose)
  const radius = Math.max(...[...centres.values()].map((p) => length(sub(p, centre))))
  const handToShin = length(sub(centres.get('armL')!, centres.get('legL')!))
  const ys = buildScene(PARTS, pose).flatMap((f) => f.points.map((p) => p.sy))
  return { radius, handToShin, height: Math.max(...ys) - Math.min(...ys) }
}

describe.skip("tuck search", () => {
  it('finds the tightest ball', async () => {
    const standing = metrics(makePose(0, 0, 0, 0))
    let best: { score: number; label: string } | null = null

    for (let hip = -2.6; hip <= -1.2; hip += 0.2) {
      for (let shoulder = -2.6; shoulder <= -0.2; shoulder += 0.2) {
        for (let torso = 0.6; torso <= 2.4; torso += 0.2) {
          for (let head = 0.2; head <= 1.6; head += 0.2) {
            const m = metrics(makePose(hip, shoulder, torso, head))
            // Prefer a tight ball, hands near the shins, low silhouette.
            const score = m.radius + m.handToShin * 0.6 + (m.height / standing.height) * 12
            if (!best || score < best.score) {
              best = {
                score,
                label:
                  `hip=${hip.toFixed(1)} shoulder=${shoulder.toFixed(1)} ` +
                  `torso=${torso.toFixed(1)} head=${head.toFixed(1)} | ` +
                  `radius=${m.radius.toFixed(1)} hand-shin=${m.handToShin.toFixed(1)} ` +
                  `height=${(m.height / standing.height).toFixed(2)} of standing`,
              }
            }
          }
        }
      }
    }
    // Written to a file because vitest swallows console output here.
    const fs = await import('node:fs')
    fs.writeFileSync(
      '/tmp/tuck-search.txt',
      `standing height ${standing.height.toFixed(1)}\nBEST ${best?.label}\n`,
    )
  })
})
