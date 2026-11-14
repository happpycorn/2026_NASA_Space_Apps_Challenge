import { missionCatalog, missionRules } from '../missions/rules'
import { readLocal, writeLocal } from './storage'
import type { Game } from './types'

export type MissionRecord = { minimum: boolean; stretch: boolean; records: string[] }
export type Progress = { missions: Record<string, MissionRecord> }

const key = 'space-mission.progress.v1'
export const emptyProgress: Progress = { missions: {} }

export function readProgress(): Progress {
  try {
    const progress = JSON.parse(readLocal(key) ?? 'null') as Progress | null
    if (!progress || typeof progress.missions !== 'object' || progress.missions === null) return emptyProgress
    const missions = Object.fromEntries(Object.entries(progress.missions).filter(([id, item]) => Object.hasOwn(missionRules, id)
      && typeof item.minimum === 'boolean' && typeof item.stretch === 'boolean' && Array.isArray(item.records)))
    return { missions }
  } catch {
    return emptyProgress
  }
}

export function writeProgress(progress: Progress) {
  return writeLocal(key, JSON.stringify(progress))
}

export function completeMission(progress: Progress, game: Game): Progress {
  const mission = missionRules[game.missionId]
  if (game.stage !== 'results' || !mission) return progress
  const previous = progress.missions[game.missionId]
  const minimum = Boolean(previous?.minimum || game.flight?.delivered)
  const stretch = Boolean(previous?.stretch || game.flight?.stretch)
  const records = [...new Set([...(previous?.records ?? []), ...(mission.records?.(game) ?? [])])]
  if (previous && previous.minimum === minimum && previous.stretch === stretch && previous.records.length === records.length) return progress
  return { missions: { ...progress.missions, [game.missionId]: { minimum, stretch, records } } }
}

export function reputation(progress: Progress) {
  return Object.entries(progress.missions).reduce((total, [id, item]) => {
    const points = missionRules[id]?.reputation
    return total + (points && item.minimum ? points.minimum : 0) + (points && item.stretch ? points.stretch : 0)
  }, 0)
}

export function isUnlocked(progress: Progress, missionId: string) {
  const index = missionCatalog.findIndex(item => item.id === missionId)
  return index === 0 || (index > 0 && Boolean(progress.missions[missionCatalog[index - 1].id]?.minimum))
}

export function nextMission(missionId: string) {
  const index = missionCatalog.findIndex(item => item.id === missionId)
  return index >= 0 ? missionCatalog[index + 1] ?? null : null
}

export function carriedRecords(progress: Progress) {
  return [...new Set(Object.values(progress.missions).flatMap(item => item.records))]
}
