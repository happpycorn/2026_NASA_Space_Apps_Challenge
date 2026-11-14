import { missionCatalog, missionRules } from '../missions/rules'
import type { Action, Cost, Design, Evidence, FlightResult, Game, MissionRules, Stop, TestResult, Work } from './types'

export type * from './types'

export function rulesFor(game: Pick<Game, 'missionId'>): MissionRules {
  return missionRules[game.missionId]
}

export function passes(evidence: Pick<TestResult, 'checks'>) {
  return evidence.checks.every(Boolean)
}

const stageWork = { feasibility: 'assess', design: 'freeze', build: 'build', integration: 'integrate' } as const
const workOrder: Work[] = Object.values(stageWork)

export function newGame(missionId: string = missionCatalog[0].id, records: string[] = []): Game {
  const mission = missionRules[missionId]
  return {
    missionId, stage: 'feasibility', week: 0, deadline: mission.deadline, credits: mission.budget, design: mission.initialDesign,
    revision: 0, gate: 'MDR', analysis: null, evidence: null, flight: null, stop: null, returned: false,
    event: null, events: [], records, log: [],
  }
}

export function availableWeeks(game: Game) {
  return game.deadline - game.week
}

export function affordable(game: Game, cost: Cost) {
  return availableWeeks(game) >= cost.weeks && game.credits >= cost.credits
}

function optionCost(mission: MissionRules, design: Design) {
  return Object.entries(mission.groups).reduce((total, [key, group]) => total + (group.options[design[key]]?.cost ?? 0), 0)
}

function cheapestFreeze(mission: MissionRules) {
  return Object.values(mission.groups).reduce(
    (total, group) => total + Math.min(...Object.values(group.options).map(option => option.cost ?? 0)), mission.costs.freeze.credits)
}

export function workCost(game: Game, work: Work): Cost {
  const mission = rulesFor(game)
  const cost = mission.costs[work]
  if (work !== 'freeze') return cost
  return { ...cost, credits: cost.credits + optionCost(mission, game.design) }
}

export function currentWork(game: Game) {
  return game.stage in stageWork ? stageWork[game.stage as keyof typeof stageWork] : null
}

export function baselineRemainingCost(game: Game) {
  const work = currentWork(game)
  if (!work) return 0
  return workOrder.slice(workOrder.indexOf(work)).reduce((total, task) => total + workCost(game, task).credits, 0)
}

export function canConfigure(game: Game) {
  return game.stage === 'feasibility' || game.stage === 'design'
}

export function sameDesign(a: Design, b: Design) {
  return Object.keys({ ...a, ...b }).every(key => a[key] === b[key])
}

export function currentEvidence(game: Game) {
  return game.evidence?.revision === game.revision ? game.evidence : null
}

export function repairOptions(game: Game) {
  return rulesFor(game).repairOptions(game.design)
}

export function pendingEvent(game: Game) {
  return game.event ? rulesFor(game).events?.find(event => event.id === game.event) ?? null : null
}

export function eventChoice(game: Game, eventId: string) {
  return game.events.find(entry => entry.startsWith(`${eventId}:`))?.slice(eventId.length + 1) ?? null
}

function record(game: Game, id: string, cost = 0, report?: Evidence, label?: Game['log'][number]['label']): Game {
  return {
    ...game,
    log: [...game.log, { id, week: game.week, cost, design: game.design, ...(report ? { report } : {}), ...(label ? { label } : {}) }],
  }
}

function spend(game: Game, work: string, cost: Cost = rulesFor(game).costs[work]): Game {
  return record({ ...game, week: game.week + cost.weeks, credits: game.credits - cost.credits }, work, cost.credits)
}

function stop(game: Game, reason: Stop): Game {
  return { ...game, stage: 'results', stop: reason, event: null }
}

function checkResources(game: Game): Game {
  if (game.stage === 'review' || game.stage === 'flight' || game.stage === 'results') return game
  if (availableWeeks(game) <= 0) return stop(game, 'deadline')
  const work = currentWork(game)
  if (work && game.stage !== 'design' && game.credits < workCost(game, work).credits) return stop(game, 'funds')
  if (game.stage === 'design' && game.credits < cheapestFreeze(rulesFor(game))) return stop(game, 'funds')
  return game
}

function triggerEvent(game: Game): Game {
  if (game.event || game.stage === 'flight' || game.stage === 'results') return game
  const event = rulesFor(game).events?.find(item => eventChoice(game, item.id) === null && item.trigger(game))
  return event ? { ...game, event: event.id } : game
}

function advance(game: Game) {
  return triggerEvent(checkResources(game))
}

function doWork(game: Game): Game {
  const work = currentWork(game)
  if (!work || !affordable(game, workCost(game, work))) return game
  const next = spend(game, work, workCost(game, work))
  switch (work) {
    case 'assess': return advance({ ...next, stage: 'design', gate: 'PDR' })
    case 'freeze': return advance({ ...next, stage: 'build', gate: 'CDR' })
    case 'build': return advance({ ...next, stage: 'integration' })
    case 'integrate': {
      const evidence = { ...rulesFor(game).test(game.design), week: next.week, revision: next.revision }
      return triggerEvent({
        ...next, stage: 'review', evidence, returned: false,
        log: [...next.log.slice(0, -1), { ...next.log[next.log.length - 1], report: evidence }],
      })
    }
  }
}

function finishContact(game: Game, flight: FlightResult): Game {
  const { contact: _finished, ...next } = game
  return record({ ...next, stage: 'results', flight }, 'operate')
}

export function runMission(game: Game, action: Action): Game {
  const mission = rulesFor(game)
  if (game.playback) {
    if (action.type !== 'advanceLab' || action.playback !== game.playback) return game
    const { kind, step } = game.playback
    const length = mission.labSteps?.(game, kind) ?? 0
    if (!action.skip && step + 1 < length) return { ...game, playback: { kind, step: step + 1 } }
    const { playback: _completed, ...next } = game
    const evidence = currentEvidence(next)
    return kind === 'integration' && evidence && !passes(evidence) ? runMission(next, { type: 'review' }) : next
  }
  if (game.stage === 'results') return game
  if (game.event && action.type !== 'choose') return game
  switch (action.type) {
    case 'choose': {
      const event = pendingEvent(game)
      const choice = event?.choices.find(item => item.id === action.choice)
      if (!event || !choice) return game
      const applied = choice.apply(game)
      const resolved = { ...applied, event: null, events: [...game.events, `${event.id}:${choice.id}`] }
      return advance(record(resolved, 'event', Math.max(0, game.credits - applied.credits), undefined, choice.label))
    }
    case 'configure':
      if (!canConfigure(game) || sameDesign(game.design, action.design)
        || !Object.entries(mission.groups).every(([key, group]) => Object.hasOwn(group.options, action.design[key]))) return game
      return { ...game, design: action.design }
    case 'configStep':
      return mission.configurationSteps?.[game.stage]?.includes(action.step) ? { ...game, configStep: action.step } : game
    case 'work':
      return doWork(game)
    case 'runLab': {
      if (!mission.labSteps || (game.stage !== 'build' && game.stage !== 'integration')) return game
      const next = doWork(game)
      if (next === game) return game
      return game.stage === 'build'
        ? { ...next, benchLead: action.benchLead, playback: { kind: 'assembly', step: 0 } }
        : { ...next, testFocus: action.testFocus, playback: { kind: 'integration', step: 0 } }
    }
    case 'advanceLab':
      return game
    case 'analyze': {
      if (!canConfigure(game) || (game.analysis && sameDesign(game.analysis.design, game.design))
        || !affordable(game, mission.costs.analyze)) return game
      const result = mission.forecast(game.design)
      const next = spend(game, 'analyze')
      const id = mission.forecastClear(result) ? 'analysisClear' : 'analysisConflict'
      return advance({
        ...next, analysis: { design: game.design, forecast: result },
        log: [...next.log.slice(0, -1), { ...next.log[next.log.length - 1], id }],
      })
    }
    case 'review': {
      const evidence = currentEvidence(game)
      if (game.stage !== 'review' || !evidence || game.returned) return game
      if (passes(evidence)) return record({ ...game, stage: 'flight', gate: 'FRR' }, 'approve', 0, evidence)
      const returned = record({ ...game, returned: true }, 'return', 0, evidence)
      if (!availableWeeks(game)) return stop(returned, 'deadline')
      if (game.credits < mission.costs.integrate.credits) return stop(returned, 'funds')
      return returned
    }
    case 'repair': {
      const cost = mission.costs[action.remedy]
      if (game.stage !== 'review' || !game.returned || !repairOptions(game).includes(action.remedy) || !affordable(game, cost)) return game
      const design = mission.applyRemedy(game.design, action.remedy)
      const next = spend({ ...game, design, revision: game.revision + 1 }, action.remedy)
      return advance({ ...next, stage: 'integration', returned: false })
    }
    case 'wait':
      if (game.stage === 'flight' || (game.stage === 'review' && !game.returned)
        || !affordable(game, mission.costs.wait)) return game
      return game.stage === 'review' && availableWeeks(game) === 1
        ? stop(spend(game, 'wait'), 'deadline')
        : advance(spend(game, 'wait'))
    case 'cancel':
      return game.stage === 'flight' ? game : stop(game, 'cancelled')
    case 'fly':
    case 'startContact': {
      const evidence = currentEvidence(game)
      if (game.stage !== 'flight' || game.contact || !evidence || !passes(evidence) || !mission.flightChoices.includes(action.choice)) return game
      if (action.type === 'fly') return record({ ...game, stage: 'results', flight: mission.fly(evidence, action.choice) }, 'operate')
      if (!mission.contact) return game
      const { batches, diagnostics } = mission.contact.plan(evidence, action.choice)
      if (!batches && !diagnostics) return finishContact(game, mission.contact.finish(evidence, action.choice, 0))
      return { ...game, contact: { choice: action.choice, next: 0, accepted: 0, diagnosticsPending: diagnostics > 0 } }
    }
    case 'checkDiagnostics': {
      const { contact } = game
      const evidence = currentEvidence(game)
      if (game.stage !== 'flight' || !evidence || !contact?.diagnosticsPending || !mission.contact) return game
      return mission.contact.plan(evidence, contact.choice).batches
        ? { ...game, contact: { ...contact, diagnosticsPending: false } }
        : finishContact(game, mission.contact.finish(evidence, contact.choice, 0))
    }
    case 'checkBatch': {
      const { contact } = game
      const evidence = currentEvidence(game)
      if (game.stage !== 'flight' || !evidence || !contact || contact.diagnosticsPending
        || action.batch !== contact.next || !mission.contact) return game
      const { batches } = mission.contact.plan(evidence, contact.choice)
      const accepted = contact.accepted + Number(action.deliver)
      const next = contact.next + 1
      return next === batches
        ? finishContact(game, mission.contact.finish(evidence, contact.choice, accepted))
        : { ...game, contact: { ...contact, next, accepted } }
    }
  }
}
