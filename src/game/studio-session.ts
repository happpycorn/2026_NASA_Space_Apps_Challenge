import { affordable, currentFlightSegment, flightContext, pendingReview, rulesFor, runMission, taskOptions } from './mission'
import type { Action, Game, Stage } from './types'

export type StudioAction = Action
  | { type: 'assignStudio'; task: string; turn: number; at: number; review?: boolean }
  | { type: 'settleStudio'; work: NonNullable<Game['studioWork']> }
  | { type: 'launchStudio'; at: number; turn: number }
  | { type: 'finishStudioLaunch'; startedAt: number }
  | { type: 'startStudioTutorial' }
  | { type: 'studioTeach'; stage: Stage }

export const studioLaunchDuration = 5500
export const studioTutorialStages = ['feasibility', 'design', 'build', 'integration', 'review'] as const
export const isTutorialStage = (stage: unknown): stage is typeof studioTutorialStages[number] => studioTutorialStages.some(id => id === stage)

export function usesStudio({ missionId, commission }: Pick<Game, 'missionId' | 'commission'>) {
  return Boolean(commission || missionId === 'orbital-launch' || missionId === 'lunar-mission')
}

const longerWork = new Set(['build', 'buildStage', 'buildFlight', 'integrate'])
const workDuration = (task: string) => longerWork.has(task.split(':').at(-1)!) ? 6000 : 4000
function launchSegment(game: Game) {
  const segment = currentFlightSegment(game)
  return (game.missionId === 'orbital-launch' && segment?.id === 'ascent')
    || (game.missionId === 'lunar-mission' && segment?.id === 'launch') ? segment : undefined
}

export function studioReadyToLaunch(game: Game) {
  if (game.stage === 'flight' && game.commission && game.studioAwaitLaunch && !game.flightProgress) return true
  const segment = launchSegment(game)
  if (!segment) return false
  return (segment.choices?.(flightContext(game)) ?? []).length === 0
}

function legacyCountdown(game: Game) {
  const progress = flightContext(game).progress
  return { ...game, flightProgress: { ...progress, state: { ...progress.state, legacyLaunchOrder: true } } }
}

function taskContext(game: Game, review?: boolean) {
  if (!review) return game
  if (!game.commission || game.stage !== 'review' || game.returned || !pendingReview(game)?.issues.length) return null
  return runMission(game, { type: 'review', turn: game.log.length })
}

export function runStudioSession(game: Game, action: StudioAction): Game {
  if (action.type === 'settleStudio') {
    if (game.studioWork !== action.work) return game
    const { studioWork, ...ready } = game
    const context = taskContext(ready, studioWork.review)
    return context ? runMission(context, { type: 'task', task: studioWork.task, turn: context.log.length }) : ready
  }
  if (action.type === 'finishStudioLaunch') {
    const { studioLaunch, studioAwaitLaunch: _awaiting, ...ready } = game
    if (studioLaunch?.startedAt !== action.startedAt) return game
    const flight = studioLaunch.choice !== undefined && ready.missionId === 'lunar-mission' ? legacyCountdown(ready) : ready
    const segment = launchSegment(flight)
    return segment
      ? runMission(flight, { type: 'segment', segment: segment.id, choice: studioLaunch.choice ?? null, turn: flight.flightProgress?.turn ?? 0 })
      : ready
  }
  if (game.studioWork || game.studioLaunch) return game
  if (action.type === 'launchStudio') {
    if (!Number.isFinite(action.at) || action.turn !== (game.flightProgress?.turn ?? 0) || !studioReadyToLaunch(game)) return game
    return { ...game, studioLaunch: { startedAt: action.at } }
  }
  if (action.type === 'startStudioTutorial') {
    if (!game.commission || !isTutorialStage(game.stage)) return game
    return { ...game, studioTutorial: studioTutorialStages.slice(0, studioTutorialStages.indexOf(game.stage)) }
  }
  if (action.type === 'studioTeach') {
    if (!game.commission || !game.studioTutorial || action.stage !== game.stage || !isTutorialStage(action.stage)
      || game.studioTutorial.includes(action.stage)) return game
    return { ...game, studioTutorial: [...game.studioTutorial, action.stage] }
  }
  if (action.type === 'assignStudio') {
    if (action.turn !== game.log.length || !Number.isFinite(action.at)) return game
    const context = taskContext(game, action.review)
    const work = context && taskOptions(context).find(task => task.id === action.task)
    if (!context || !work || !affordable(context, work.cost)) return game
    return { ...game, studioWork: { task: action.task, turn: action.turn, startedAt: action.at,
      endsAt: action.at + workDuration(action.task), ...(action.review && { review: true }) } }
  }
  if (action.type === 'segment' && studioReadyToLaunch(game)) return game
  const next = runMission(game, action)
  return action.type === 'review' && game.commission && game.stage === 'review' && next.stage === 'flight'
    ? { ...next, studioAwaitLaunch: true } : next
}

// An older save has no presentation state. A stale presentation can be dropped without losing the mission.
export function restoreStudioSession(game: Game) {
  const { studioWork, studioLaunch, studioTutorial, ...rest } = game
  const workValid = studioWork && studioWork.turn === game.log.length && !game.event && !game.pendingWork
    && game.stage !== 'flight' && game.stage !== 'results' && Object.hasOwn(rulesFor(game).tasks ?? {}, studioWork.task)
    && typeof studioWork.task === 'string' && Number.isFinite(studioWork.startedAt)
    && studioWork.endsAt - studioWork.startedAt === workDuration(studioWork.task)
  const legacy = studioLaunch?.choice !== undefined && game.missionId === 'lunar-mission' ? legacyCountdown(game) : null
  const legacySegment = legacy && launchSegment(legacy)
  const legacyChoice = legacy && legacySegment?.choices?.(flightContext(legacy))?.some(option => option.id === studioLaunch?.choice)
  const launchValid = studioLaunch && Number.isFinite(studioLaunch.startedAt) && (studioLaunch.choice === undefined
    ? studioReadyToLaunch(game) || game.commission && game.stage === 'flight' && !game.flightProgress : legacyChoice)
  return { ...rest, ...(workValid && { studioWork }), ...(launchValid && { studioLaunch }),
    ...(game.commission && Array.isArray(studioTutorial) && { studioTutorial: studioTutorial.filter(isTutorialStage) }) }
}
