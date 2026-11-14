import type { Message } from '../i18n/en'
import type { MissionRules } from '../game/types'
import { cubeSatRules } from './cubesat'

export const missionRules: Record<string, MissionRules> = {
  [cubeSatRules.id]: cubeSatRules,
}

export const missionCatalog: readonly { id: string; title: Message; deadline: number }[] = [
  { id: 'cubesat', title: 'cubesat', deadline: 6 },
  { id: 'orbital-launch', title: 'orbital', deadline: 12 },
  { id: 'lunar-mission', title: 'lunar', deadline: 20 },
]
