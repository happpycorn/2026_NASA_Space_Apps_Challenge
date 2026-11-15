import type { Cost, Game, MissionRules, TimedJob } from './types'
import { getMissionRules, missionRules } from '../missions/rules'
import { restoreCommissionDesign } from '../missions/cubesat-commission'
import { isTutorialStage, restoreStudioSession } from './studio-session'

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

function validCost(cost: Cost | undefined) {
  return cost && Number.isInteger(cost.weeks) && cost.weeks >= 0
    && Number.isInteger(cost.credits) && cost.credits >= 0
}

function jobInRules(job: TimedJob, mission: MissionRules) {
  switch (job.type) {
    case 'task': return Object.hasOwn(mission.tasks ?? {}, job.task) && Object.hasOwn(mission.costs, job.task)
    case 'work': return ['assess', 'freeze', 'build', 'integrate'].includes(job.work) && Object.hasOwn(mission.costs, job.work)
    case 'verify':
    case 'fix': return Boolean(mission.risks && Object.hasOwn(mission.costs, job.work))
    case 'repair': return Object.hasOwn(mission.costs, job.remedy)
    case 'analyze':
    case 'wait': return Object.hasOwn(mission.costs, job.type)
    default: return false
  }
}

function validContinuation(game: Game, mission: MissionRules) {
  const { pendingWork, flightProgress, missionState } = game
  if (missionState !== undefined && (!missionState || typeof missionState !== 'object' || Array.isArray(missionState))) return false
  if (pendingWork !== undefined && (!pendingWork || !game.event || game.stage === 'flight' || game.stage === 'results'
    || !pendingWork.job || !jobInRules(pendingWork.job, mission) || !validCost(pendingWork.cost)
    || !Number.isInteger(pendingWork.remaining) || pendingWork.remaining < 0 || pendingWork.remaining > pendingWork.cost.weeks)) return false
  if (flightProgress === undefined) return true
  const segments = mission.segmentedFlight?.segments
  return Boolean(game.stage === 'flight' && !game.contact && segments && flightProgress
    && flightProgress.state && typeof flightProgress.state === 'object' && !Array.isArray(flightProgress.state)
    && Array.isArray(flightProgress.steps)
    && (flightProgress.turn === undefined || (Number.isInteger(flightProgress.turn) && flightProgress.turn >= flightProgress.steps.length))
    && (flightProgress.updates === undefined || Array.isArray(flightProgress.updates))
    && flightProgress.steps.length < segments.length
    && flightProgress.steps.every((step, index) => step?.id === segments[index].id && (step.choice === null || typeof step.choice === 'string')))
}

export function readGame(): Game | null {
  const raw = readLocal(key)
  if (!raw) return null
  try {
    const parsed: Game | null = JSON.parse(raw)
    if (!parsed) return null
    const mission = Object.hasOwn(missionRules, parsed.missionId) ? getMissionRules(parsed) : undefined
    // Saves from before a design group existed take that group's initial option.
    const fill = <T extends { design: Game['design'] } | null>(item: T) =>
      item && typeof item === 'object' && item.design && typeof item.design === 'object' ? { ...item, design: { ...mission!.initialDesign, ...item.design } } : item
    const game: Game = mission && parsed.design && typeof parsed.design === 'object'
      ? { ...parsed, design: { ...mission.initialDesign, ...parsed.design }, evidence: fill(parsed.evidence), analysis: fill(parsed.analysis) } : parsed
    if (!mission || !stages.includes(game.stage) || !Array.isArray(game.log) || !Array.isArray(game.events) || !Array.isArray(game.records)
      || !Number.isInteger(game.deadline) || !Number.isInteger(game.week) || game.week < 0
      || !Number.isInteger(game.credits) || game.credits < 0
      // Saves from before seeded risk have no seed. They are dropped so the lobby offers a new mission.
      || !Number.isInteger(game.seed) || game.seed < 0 || game.seed > 0xffffffff || typeof game.risks !== 'object' || game.risks === null
      || !Array.isArray(game.accepted) || !Array.isArray(game.outcomes)
      || (game.event !== null && !mission.events?.some(event => event.id === game.event))
      || !validContinuation(game, mission) || mission.validSave?.(game) === false
      || !Object.entries(mission.groups).every(([group, { options }]) => Object.hasOwn(options, game.design?.[group]))) return null
    return restoreStudioSession(game.commission ? restoreCommissionDesign(game) : game)
  } catch {
    return null
  }
}

export function writeGame(game: Game) {
  return writeLocal(key, JSON.stringify(game))
}

const tutorialKey = 'space-mission.tutorial.v1.cubesat'

export function readStudioTutorial(): Game['studioTutorial'] {
  try {
    const value: unknown = JSON.parse(readLocal(tutorialKey) ?? 'null')
    return Array.isArray(value) ? [...new Set(value.filter(isTutorialStage))] : undefined
  } catch {
    return undefined
  }
}

export function rememberStudioTutorial(game: Game) {
  if (!game.commission || !game.studioTutorial?.length) return
  const existing = readStudioTutorial() ?? []
  const combined = [...new Set([...existing, ...game.studioTutorial])]
  if (combined.length !== existing.length) writeLocal(tutorialKey, JSON.stringify(combined))
}
