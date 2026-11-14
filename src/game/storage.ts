import type { Game } from './types'
import { missionRules } from '../missions/rules'

const key = 'space-mission.single.v2'
const stages = ['feasibility', 'design', 'build', 'integration', 'review', 'flight', 'results']

export function readLocal(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function readGame(): Game | null {
  const raw = readLocal(key)
  if (!raw) return null
  try {
    const game: Game | null = JSON.parse(raw)
    if (!game) return null
    const mission = missionRules[game.missionId]
    if (!mission || !stages.includes(game.stage) || !Array.isArray(game.log) || !Array.isArray(game.events) || !Array.isArray(game.records)
      || !Number.isInteger(game.deadline) || !Number.isInteger(game.week) || game.week < 0
      || !Number.isInteger(game.credits) || game.credits < 0
      || (game.event !== null && !mission.events?.some(event => event.id === game.event))
      || !Object.entries(mission.groups).every(([group, { options }]) => Object.hasOwn(options, game.design?.[group]))) return null
    return game
  } catch {
    return null
  }
}

export function writeGame(game: Game) {
  return writeLocal(key, JSON.stringify(game))
}
