// The guide of the "hyper noob" mode for Zork II: see guide.ts.
import type { World } from './world'
import type { GuideStep } from './guide-common'

/** Whether this guide is ready to be offered (it finishes the game alone). */
export const ZORK2_GUIDE = false

export function zork2Step(_w: World): GuideStep | null {
  return null
}
