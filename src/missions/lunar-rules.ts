import { orbitalLaunch } from './orbital-launch'
import { orbitalRecords } from './orbital-rules'
import { affordable, availableWeeks, currentEvidence, optionCost, pendingWorkId, stop } from '../game/mission'
import { defectBelief, topLevel, verifyDefect } from '../game/risk'
import type { Copy, Cost, CostItem, Design, Game, MissionEvent, MissionFile, MissionRules, Review } from '../game/types'
import { completed, evidenceFor, freezeDesign, optionGroup, reviseDesign, riskIssue, verificationCopy } from './chapter'
import {
  lunarAcceptance, lunarDevDeck, lunarFlightRisks, lunarItemId, lunarMass, lunarMaturity,
  lunarMission as mission, lunarRiskIds, lunarSeverity, lunarUntested, lunarVerified, type LunarDesign, type LunarRisk, type LunarStates,
} from './lunar-mission'
import { lunarSegments } from './lunar-flight'

type Task = NonNullable<MissionRules['tasks']>[string]
type Partner = 'funding' | 'tech'
type Contract = { kind: Partner; weeks: number; left: number; milestone: number; slots: number; ended: boolean; late: boolean }
type State = {
  contract: Contract | null; slots: number; extraKg: number; delay: number; secondPayload: boolean; interfaceDue: boolean
  governmentCold: boolean; grant: boolean; icd: 'reviewed' | 'open' | null; deckIndex: number
  storyVersion?: number; responseReserves?: Partial<Record<LunarRisk, number>>; vouchers?: Partial<Record<LunarRisk, number>>
}
const initial: State = {
  contract: null, slots: 0, extraKg: 0, delay: 0, secondPayload: false, interfaceDue: false,
  governmentCold: false, grant: false, icd: null, deckIndex: 0, storyVersion: 2,
}
export const lunarState = (game: Game) => game.missionState as State
export const lunarDesign = (game: Game) => game.design as LunarDesign
export const lunarStates = (game: Game): LunarStates => ({ ...lunarUntested(), ...game.risks })
function lunarRisksReady(game: Game) {
  return lunarRiskIds.every(id => {
    const risk = game.risks[id]
    return risk === undefined || Boolean(risk && Number.isInteger(risk.level) && risk.level >= 0 && risk.level <= topLevel
      && typeof risk.found === 'boolean' && typeof risk.fixed === 'boolean')
  })
}
const set = (game: Game, change: Partial<State>): Game => ({ ...game, missionState: { ...lunarState(game), ...change } })
const passedPdr = (game: Game) => game.log.some(entry => entry.review?.gate === 'PDR' && entry.review.passed)
export const lunarFlightRevised = (game: Game) => lunarState(game).storyVersion === 2
const active = (game: Game) => Boolean(lunarState(game).contract && !lunarState(game).contract?.ended)
const frozen = (game: Game) => game.stage === 'build' || game.stage === 'integration' || game.stage === 'review'
const massKnown = (game: Game) => completed(game, 'trade') || completed(game, 'prelim') || Boolean(currentEvidence(game))
export const lunarAllocation = (game: Game) => mission.launchAllocationKg + (game.records.includes(orbitalRecords.provenMargin) ? orbitalLaunch.lunarMarginKg : 0)
const hasOrbitalRecord = (game: Game, id: 'onTime' | 'verified') => game.records.includes(orbitalRecords[id]) || game.records.includes(id)
export const massBudget = (game: Game, measured = massKnown(game)) => lunarMass(lunarDesign(game), lunarState(game).extraKg, measured, lunarAllocation(game))

export function missionFile(item: { file: MissionFile['detail']['message']; history: readonly string[] }): MissionFile {
  const sources = mission.sources as Record<string, { source: string; url: string }>
  return { title: { message: 'lunarMissionFile' }, detail: { message: item.file },
    sources: item.history.map(id => sources[id]).filter(Boolean).map(({ source, url }) => ({ title: source, url })) }
}

function configure(game: Game, design: Design) {
  const before = lunarDesign(game)
  const after = design as LunarDesign
  const changed = lunarRiskIds.filter(id => lunarItemId(before, id) !== lunarItemId(after, id))
  const risks = Object.fromEntries(Object.entries(game.risks).filter(([id]) => !changed.includes(id as LunarRisk)))
  return { ...game, design, risks }
}

function redesign(game: Game, design: LunarDesign): Game {
  if (Object.keys(design).every(key => design[key as keyof LunarDesign] === game.design[key])) return game
  const next = configure(game, design)
  return frozen(game) ? reviseDesign(next, design) : { ...next, ...(game.stage === 'design' && { gate: 'PDR', returned: false }) }
}

function sign(game: Game, kind: Partner, late: boolean) {
  const terms = late ? mission.latePartnerships[kind] : mission.partnerships[kind]
  const earlyPayment = kind === 'funding' && !late && hasOrbitalRecord(game, 'onTime') ? mission.records.onTime.advanceShift : 0
  const extraSlot = kind === 'tech' && !late && hasOrbitalRecord(game, 'verified') ? mission.records.verified.supportSlots : 0
  return set({ ...game, credits: game.credits + terms.advance + earlyPayment }, {
    contract: { kind, left: terms.weeks, weeks: terms.weeks, milestone: terms.milestone - earlyPayment,
      slots: terms.supportSlots + extraSlot, ended: false, late },
  })
}

function verify(game: Game, id: LunarRisk) {
  const d = lunarDesign(game)
  const state = lunarStates(game)[id]
  const result = verifyDefect(game.seed, lunarItemId(d, id), lunarMaturity(d, id), state)
  return { ...game, risks: { ...game.risks, [id]: result } }
}

export function lunarResponseReserves(game: Game, waived: readonly string[] = lunarAcceptance(lunarDesign(game), lunarStates(game))) {
  const design = lunarDesign(game)
  return Object.fromEntries(waived.filter((id): id is LunarRisk => lunarRiskIds.includes(id as LunarRisk))
    .map(id => [id, mission.operatingReserve[lunarMaturity(design, id)]])) as Partial<Record<LunarRisk, number>>
}

const highestRisk = (game: Game) => {
  const design = lunarDesign(game)
  const states = lunarStates(game)
  return [...lunarFlightRisks].filter(id => !states[id].found && !states[id].fixed && states[id].level < topLevel)
    .sort((a, b) => defectBelief(lunarMaturity(design, b), states[b]) - defectBelief(lunarMaturity(design, a), states[a]))[0]
}

const costs: Record<string, CostItem> = { ...mission.costs, ...mission.remedies }
const tasks: Record<string, Task> = {}
function task(id: string, ready: (game: Game) => boolean, complete: Task['complete'], detail?: Task['detail']) {
  tasks[id] = { plan: game => ready(game) ? costs[id] : null, complete, detail }
}
function support(id: string, label: CostItem['label'], change: (cost: Cost) => Cost, ready = (_game: Game) => true) {
  const key = `support:${id}`
  costs[key] = { ...change(costs[id]), label }
  tasks[key] = {
    plan: game => {
      const cost = tasks[id].plan(game)
      return cost && lunarState(game).slots > 0 && ready(game) ? change(cost) : null
    },
    start: game => set(game, { slots: lunarState(game).slots - 1 }),
    complete: tasks[id].complete, detail: tasks[id].detail,
  }
}

const production = ['buildFlight', 'buildPayload', 'buildGround'] as const
const mainline = ['assess', 'prelim', 'detail', 'freeze', ...production, 'integrate'] as const
const requiredSupport = {
  buildFlight: mission.supportUses.buildFlight,
  integrate: mission.supportUses.integrate,
  freeze: mission.supportUses.mount,
}

function remainingLunarWork(game: Game) {
  const pending = pendingWorkId(game)?.split(':').at(-1)
  return mainline.filter(id => id !== pending && !completed(game, id))
}

export function lunarPlanCost(game: Game, design = game.design) {
  const state = lunarState(game)
  const jobs = remainingLunarWork(game).reduce((sum, id) => ({
    weeks: sum.weeks + costs[id].weeks + (id === 'buildFlight' ? state.delay : 0),
    credits: sum.credits + costs[id].credits + (id === 'freeze' ? optionCost(lunarRules, design) : 0),
  }), { weeks: Number(state.interfaceDue), credits: 0 })
  const retestDue = Boolean(game.evidence && !currentEvidence(game) && pendingWorkId(game) !== 'retest')
  return { weeks: jobs.weeks + (retestDue ? costs.retest.weeks : 0), credits: jobs.credits + (retestDue ? costs.retest.credits : 0) }
}

export function lunarBudgetForecast(game: Game, verification?: { credits: number; usesSupport: boolean }) {
  const plan = lunarPlanCost(game)
  const remaining = remainingLunarWork(game)
  const { contract, slots: earnedSlots } = lunarState(game)
  const slots = Math.max(0, earnedSlots - Number(verification?.usesSupport ?? false))
  const discounts = (Object.keys(requiredSupport) as (keyof typeof requiredSupport)[])
    .filter(id => remaining.includes(id) && (id !== 'freeze' || lunarDesign(game).mount === 'lightweight'))
    .map(id => requiredSupport[id])
    .sort((a, b) => b.creditsSaved - a.creditsSaved)
    .slice(0, slots)
  const savings = discounts.reduce((sum, use) => sum + use.creditsSaved, 0)
  const contractWeeks = contract && !contract.ended ? Math.max(0, contract.left - Number(pendingWorkId(game) === 'contract')) : 0
  const weeks = plan.weeks + contractWeeks - discounts.reduce((sum, use) => sum + use.weeksSaved, 0)
  const credits = plan.credits - savings
  const reserve = lunarFlightRevised(game) ? Object.values(lunarResponseReserves(game)).reduce((sum, amount) => sum + amount, 0) : 0
  const available = game.credits - (verification?.credits ?? 0)
  return { weeks, credits, savings, reserve, available, shortfall: Math.max(0, credits + reserve - available) }
}

task('assess', game => game.stage === 'feasibility', game => ({ ...game, stage: 'design', gate: 'PDR' }), () => ({ message: 'lunarMdrPass' }))
task('trade', game => !lunarFlightRevised(game) && !frozen(game) && !completed(game, 'prelim') && !completed(game, 'trade'), game => game)
task('prelim', game => game.stage === 'design' && !completed(game, 'prelim'), game => game)
task('detail', game => game.stage === 'design' && game.gate === 'CDR' && !completed(game, 'detail'), game => game)
tasks.freeze = {
  plan: game => game.stage === 'design' && game.gate === 'CDR' && completed(game, 'detail')
    ? { weeks: costs.freeze.weeks, credits: costs.freeze.credits + optionCost(lunarRules, game.design) } : null,
  complete: freezeDesign, detail: () => ({ message: 'lunarCdrPass' }),
}

for (const id of production) {
  task(id, game => game.stage === 'build' && !completed(game, id), game =>
    production.every(other => other === id || completed(game, other)) ? { ...game, stage: 'integration' } : game)
}
const flightPlan = tasks.buildFlight.plan
tasks.buildFlight.plan = game => {
  const cost = flightPlan(game)
  return cost && { ...cost, weeks: cost.weeks + lunarState(game).delay }
}

function integrate(game: Game): Game {
  const mass = massBudget(game, true)
  return { ...game, stage: 'review', returned: false, evidence: evidenceFor(game,
    [mass.margin >= mission.routes[lunarDesign(game).route].correctionKg, mass.margin >= mission.reserveKg], { ...mass, mount: mission.mounts[lunarDesign(game).mount].growthKg }) }
}

task('integrate', game => game.stage === 'integration' && !game.evidence && !lunarState(game).interfaceDue, integrate,
  (_, after) => ({ message: 'lunarInterfaceStory', values: { growth: after.evidence!.mount, margin: after.evidence!.margin } }))
task('retest', game => game.stage === 'integration' && Boolean(game.evidence) && !lunarState(game).interfaceDue, integrate)
task('secondInterface', game => lunarState(game).interfaceDue, game => set(game, { interfaceDue: false }))
task('wait', () => true, game => game)

task('contract', game => active(game) && Boolean(lunarState(game).contract?.left), game => {
  const state = lunarState(game)
  const contract = { ...state.contract!, left: state.contract!.left - 1 }
  return set({ ...game, credits: game.credits + (contract.left === 0 ? contract.milestone : 0) },
    { contract, slots: state.slots + (contract.left === 0 ? contract.slots : 0) })
})
for (const kind of ['funding', 'tech'] as const) {
  const id = `contract:${kind}`
  costs[id] = { ...mission.partnerships[kind], weeks: 0, credits: 0 }
  task(id, game => game.stage === 'design' && game.gate === 'PDR' && game.events.includes('offers:decline') && !passedPdr(game) && !lunarState(game).contract,
    game => sign(game, kind, false))
}

for (const id of ['buildFlight', 'integrate', 'freeze'] as const) {
  const { label, weeksSaved, creditsSaved } = requiredSupport[id]
  support(id, label, cost => ({ weeks: cost.weeks - weeksSaved, credits: cost.credits - creditsSaved }),
    game => id !== 'freeze' || lunarDesign(game).mount === 'lightweight')
}

function verificationReady(game: Game, id: LunarRisk) {
  const state = lunarStates(game)[id]
  const needs = ['assess', mission.risks[id].unitNeeds, 'integrate'][state.level]
  return Boolean(needs && !state.found && !state.fixed && completed(game, needs)
    && (state.level < 2 || currentEvidence(game)))
}

function eventVerification(game: Game, id: LunarRisk) {
  if (verificationReady(game, id)) return verify(game, id)
  if (lunarStates(game)[id].level === topLevel || lunarStates(game)[id].found || lunarStates(game)[id].fixed) return game
  const vouchers = lunarState(game).vouchers ?? {}
  return set(game, { vouchers: { ...vouchers, [id]: (vouchers[id] ?? 0) + 1 } })
}

for (const id of lunarRiskIds) {
  const item = mission.risks[id]
  item.steps.forEach((step, index) => {
    const ready = (game: Game) => verificationReady(game, id) && lunarStates(game)[id].level === index
    task(step, ready, game => verify(game, id), (before, after) => verificationCopy(lunarStates(after)[id], item.found, {
      label: item.label,
      before: defectBelief(lunarMaturity(lunarDesign(before), id), lunarStates(before)[id]),
      after: defectBelief(lunarMaturity(lunarDesign(after), id), lunarStates(after)[id]),
    }))
    tasks[step].plan = game => ready(game)
      ? { ...costs[step], credits: (lunarState(game).vouchers?.[id] ?? 0) > 0 ? 0 : costs[step].credits }
      : null
    tasks[step].start = game => {
      const vouchers = lunarState(game).vouchers
      return vouchers?.[id] ? set(game, { vouchers: { ...vouchers, [id]: vouchers[id] - 1 } }) : game
    }
    support(step, costs[step].label, cost => ({ ...cost, credits: 0 }), game => !lunarState(game).vouchers?.[id])
  })
  const fix = `fix:${id}`
  costs[fix] = mission.fix
  task(fix, game => {
    const retest = currentEvidence(game) ? costs.retest : { weeks: 0, credits: 0 }
    return lunarStates(game)[id].found && !lunarStates(game)[id].fixed
      && affordable(game, { weeks: costs[fix].weeks + retest.weeks, credits: costs[fix].credits + retest.credits })
  },
    game => {
      const next = { ...game, risks: { ...game.risks, [id]: { ...lunarStates(game)[id], fixed: true } } }
      return currentEvidence(game) ? reviseDesign(next, game.design) : next
    }, () => ({ message: 'lunarRiskRestored' }))
}

const remedies = {
  mount: (d: LunarDesign) => d.mount === 'standard' ? { ...d, mount: 'lightweight' as const } : null,
  partnerMount: (d: LunarDesign) => d.mount === 'standard' ? { ...d, mount: 'lightweight' as const } : null,
  dropKit: (d: LunarDesign) => d.power === 'extended' ? { ...d, power: 'dayOnly' as const } : null,
  reroute: (d: LunarDesign) => d.route === 'direct' ? { ...d, route: 'lowEnergy' as const } : null,
  basicPayload: (d: LunarDesign) => d.payload === 'advanced' ? { ...d, payload: 'basic' as const } : null,
  addLidar: (d: LunarDesign) => d.sensor === 'single' ? { ...d, sensor: 'redundant' as const } : null,
}
export function lunarCorrection(game: Game, id: string) {
  if (!frozen(game) || !Object.hasOwn(remedies, id) || (id === 'partnerMount' && lunarState(game).slots <= 0)) return null
  const design = remedies[id as keyof typeof remedies](lunarDesign(game))
  if (!design) return null
  const cost = costs[id]
  const retest = game.evidence ? costs.retest : { weeks: 0, credits: 0 }
  return { design, cost, retest, required: {
    weeks: cost.weeks + retest.weeks + (id === 'reroute' ? mission.routes.lowEnergy.leadWeeks : 0),
    credits: cost.credits + retest.credits,
  } }
}
for (const [id, remedy] of Object.entries(remedies)) {
  task(id, game => {
    const correction = lunarCorrection(game, id)
    return Boolean(correction && affordable(game, correction.required))
  }, game => redesign(id === 'partnerMount' ? set(game, { slots: lunarState(game).slots - 1 }) : game, remedy(lunarDesign(game))!))
}

type DevCard = typeof mission.devCards[number] | typeof mission.storyEvents[number]
type DevId = DevCard['id']
function cardReady(game: Game, id: DevId) {
  const state = lunarState(game)
  if (id === 'Camera' || id === 'Review') return active(game) && state.contract?.left === 0 &&
    (id === 'Camera' ? state.contract.kind === 'funding' : state.contract.kind === 'tech')
  if (id === 'SecondOffer') return game.week >= mission.secondOfferWeek && passedPdr(game) && !active(game)
  const slot = (mission.drawWeeks as readonly number[]).indexOf(game.week)
  if (slot < 0 || game.log.some(entry => entry.week === game.week && mission.devCards.some(card => card.id === entry.event))) return false
  const deck = lunarDevDeck(game.seed)
  if (slot === deck.pullInSlot) return id === 'PullIn'
  return deck.order.slice(state.deckIndex).find(candidate => eligibleCard(game, candidate)) === id
}

function eligibleCard(game: Game, id: DevId) {
  const state = lunarState(game)
  switch (id) {
    case 'PartnerExit': return active(game) && Boolean(state.contract?.left)
    case 'CostReview': return game.credits < lunarPlanCost(game).credits
    case 'SecondPayload': return Boolean(state.contract && !state.contract.ended && !state.governmentCold && !state.secondPayload && !game.evidence && pendingWorkId(game)?.split(':').at(-1) !== 'integrate')
    case 'SupplierDelay': return !completed(game, 'buildFlight')
    case 'IcdMismatch': return !game.evidence
    default: return true
  }
}

function chooseCard(game: Game, id: DevId, choice: string, effect: DevCard['choices'][number]['effect']): Game {
  const state = lunarState(game)
  let next = { ...game, credits: game.credits + (effect.credits ?? 0), deadline: game.deadline + (effect.deadline ?? 0) }
  if (id !== 'PullIn' && id !== 'Camera' && id !== 'Review' && id !== 'SecondOffer') {
    const index = lunarDevDeck(game.seed).order.indexOf(id)
    next = set(next, { deckIndex: index + 1 })
  }
  if (effect.massKg) {
    next = set(next, { extraKg: state.extraKg + effect.massKg })
    if (currentEvidence(game)) next = reviseDesign(next, next.design)
  }
  if (effect.slots) next = set(next, { slots: state.slots + effect.slots })
  if (effect.weeks && id !== 'SupplierDelay') {
    if (next.pendingWork) {
      const work = next.pendingWork
      next = { ...next, pendingWork: { ...work, remaining: work.remaining + effect.weeks, cost: { ...work.cost, weeks: work.cost.weeks + effect.weeks } } }
    } else {
      next = { ...next, week: next.week + effect.weeks }
    }
  }
  if (id === 'PartnerExit') {
    const contract = state.contract!
    next = set(next, { contract: { ...contract, ended: true } })
    if (pendingWorkId(next) === 'contract') {
      const { pendingWork, ...rest } = next
      next = { ...rest, log: [...rest.log, { id: 'contract', week: next.week, cost: 0, design: next.design, incomplete: true }] }
    }
    if (choice === 'Switch') return sign(next, contract.kind === 'funding' ? 'tech' : 'funding', true)
    if (choice === 'Negotiate') return set({ ...next, credits: next.credits + (contract.kind === 'funding' ? 10 : 0) },
      { slots: state.slots + (contract.kind === 'tech' ? 1 : 0) })
  }
  if (id === 'CostReview') {
    if (choice === 'Stop') return stop(next, 'cancelled')
    if (choice === 'Grant') return set(next, { grant: true })
    const d = lunarDesign(game)
    const paid = frozen(game) || pendingWorkId(game)?.split(':').at(-1) === 'freeze'
    const refund = paid ? (mission.payloads[d.payload].cost - mission.payloads.basic.cost + mission.powers[d.power].cost) / 2 : 0
    return redesign({ ...next, credits: next.credits + refund }, { ...d, payload: 'basic', power: 'dayOnly' })
  }
  if (id === 'SecondOffer') {
    if (choice === 'Funding' || choice === 'Tech') return sign(next, choice === 'Funding' ? 'funding' : 'tech', true)
    if (choice === 'Government') return set(next, { secondPayload: true, interfaceDue: true })
  }
  if (id === 'SecondPayload' && choice !== 'Decline') return set(next, { secondPayload: true, interfaceDue: choice === 'Accept' })
  if (id === 'PullIn' && choice === 'Refuse') return set(next, { governmentCold: true })
  if (id === 'SupplierDelay' && choice === 'Wait') {
    const work = next.pendingWork
    return work && pendingWorkId(next)?.split(':').at(-1) === 'buildFlight'
      ? { ...next, pendingWork: { ...work, remaining: work.remaining + 1, cost: { ...work.cost, weeks: work.cost.weeks + 1 } } }
      : set(next, { delay: state.delay + 1 })
  }
  if (id === 'PartsAlert' && choice !== 'Fly') return eventVerification(next, 'thrusters')
  if (id === 'IcdMismatch') return choice === 'Review' ? set(eventVerification(next, 'software'), { icd: 'reviewed' }) : set(next, { icd: 'open' })
  if (id === 'Review' && choice === 'UseSlot') return eventVerification(next, highestRisk(game))
  return next
}

function toEvent(card: DevCard): MissionEvent {
  return {
    id: card.id, title: card.title, detail: card.detail, file: missionFile(card), quote: card.quote,
    trigger: game => cardReady(game, card.id),
    values: game => ({ week: game.week }),
    subject: game => card.id === 'Review' ? mission.risks[highestRisk(game) ?? 'software'].label : undefined,
    choices: card.choices.map(({ id, label, detail, result, effect }) => ({
      id, label, detail: card.id === 'Camera' && id === 'Mount' ? 'lunarCameraMountCost' : detail,
      result: (game, before) => {
        const risk = card.id === 'PartsAlert' && id !== 'Fly' ? 'thrusters'
          : card.id === 'IcdMismatch' && id === 'Review' ? 'software'
          : card.id === 'Review' && id === 'UseSlot' ? highestRisk(before) : undefined
        if (risk && (lunarState(game).vouchers?.[risk] ?? 0) > (lunarState(before).vouchers?.[risk] ?? 0)) {
          return { message: 'lunarVerificationVoucher', labels: { item: mission.risks[risk].label } }
        }
        return { message: result, values: { week: game.deadline, kg: effect.massKg ?? 0 } }
      },
      values: game => ({
        // Skipping the interface review makes a later software uplink cost more, which is what this card warns about.
        credits: card.id === 'IcdMismatch' && id === 'Skip' ? mission.uplinkOpenExtra
          : Math.abs(effect.credits ?? (card.id === 'PartnerExit' ? 10 : card.id === 'SecondOffer' && id === 'Funding' ? mission.latePartnerships.funding.advance : 0)),
        retestWeeks: currentEvidence(game) ? costs.retest.weeks : 0, retestCredits: currentEvidence(game) ? costs.retest.credits : 0,
        kg: effect.massKg ?? 0, weeks: Math.abs(effect.weeks ?? effect.deadline ?? (card.id === 'SecondOffer' ? 2 : 0)),
        count: 1, week: game.deadline + (effect.deadline ?? 0), slots: lunarState(game).slots,
      }),
      available: game => {
        const state = lunarState(game)
        const costCut = card.id === 'CostReview' && id === 'Cut'
        const design = lunarDesign(game)
        const spentKit = lunarStates(game).thrusters
        if (card.id === 'CostReview' && id === 'Stop') {
          const grantFits = game.credits + (mission.devCards.find(card => card.id === 'CostReview')!.choices.find(choice => choice.id === 'Grant')!.effect.credits ?? 0)
            >= lunarPlanCost(game).credits
          const reduced = { ...design, payload: 'basic', power: 'dayOnly' }
          const refund = (frozen(game) || pendingWorkId(game) === 'freeze')
            ? (mission.payloads[design.payload].cost - mission.payloads.basic.cost + mission.powers[design.power].cost) / 2 : 0
          return !grantFits && game.credits + refund < lunarPlanCost(game, reduced).credits
        }
        if (card.id === 'PartsAlert' && id !== 'Fly' && (spentKit.fixed || spentKit.found || spentKit.level >= topLevel)) return false
        if (card.id === 'Camera' && id === 'Decline') return false
        if (card.id === 'Camera' && id === 'Mount' && currentEvidence(game)
          && (availableWeeks(game) < costs.retest.weeks || game.credits + (effect.credits ?? 0) < costs.retest.credits)) return false
        return (!costCut || design.payload !== 'basic' || design.power !== 'dayOnly') && game.credits + (effect.credits ?? 0) >= 0 && state.slots + (effect.slots ?? 0) >= 0
          && (card.id !== 'SecondOffer' || id !== 'Government' || (!state.governmentCold && !state.secondPayload && !game.evidence && pendingWorkId(game)?.split(':').at(-1) !== 'integrate'))
          && (card.id !== 'Review' || id !== 'UseSlot' || Boolean(highestRisk(game)))
          && (!effect.weeks || card.id === 'SupplierDelay' || availableWeeks(game) >= effect.weeks + (game.pendingWork?.remaining ?? 0))
      },
      apply: game => chooseCard(game, card.id, id, effect),
    })),
  }
}

// The margin PDR judges. The mount can still be changed after PDR, so the review assumes the lightest one.
export function lunarPdrMargin(game: Game) {
  return lunarFlightRevised(game)
    ? lunarMass({ ...lunarDesign(game), mount: 'lightweight' }, lunarState(game).extraKg, true, lunarAllocation(game)).margin
    : massBudget(game).margin
}

// The margin line on the workbench: the current margin, whether the mount interface is counted in it, and the
// threshold of the next review that looks at it.
export function lunarMarginCopy(game: Game): { blocked: boolean; parts: Copy[] } {
  const mass = massBudget(game)
  const reserve = mission.reserveKg
  const parts: Copy[] = [
    { message: 'lunarPreview', values: { margin: mass.margin, dry: mass.dry } },
    massKnown(game) ? { message: 'lunarPreviewMountCounted', values: { mount: mission.mounts[lunarDesign(game).mount].growthKg } }
      : { message: 'lunarPreviewMountOpen' },
  ]
  if (game.stage === 'design' && game.gate === 'PDR') {
    const light = lunarPdrMargin(game)
    parts.push(light === mass.margin ? { message: 'lunarPreviewPdr', values: { reserve } }
      : { message: 'lunarPreviewPdrLight', values: { light, reserve } })
    return { blocked: light < reserve, parts }
  }
  if (game.stage !== 'flight' && game.stage !== 'results') parts.push({ message: 'lunarPreviewFrr',
    values: { reserve, correction: mission.routes[lunarDesign(game).route].correctionKg } })
  return { blocked: mass.margin < reserve, parts }
}

function pdr(game: Game): Review | null {
  if (!completed(game, 'prelim')) return null
  const margin = lunarPdrMargin(game)
  const current = massBudget(game).margin
  const values = { margin, count: margin, current, threshold: mission.reserveKg }
  const returned: Copy = { message: margin === current ? 'lunarPropellantPdr' : 'lunarPropellantPdrLight', values }
  return { issues: margin >= mission.reserveKg ? [] : [{ detail: returned }],
    approve: { message: margin === current ? 'lunarPdrPass' : 'lunarPdrPassLight', values }, return: returned }
}

function frr(game: Game): Review {
  const state = lunarState(game)
  const d = lunarDesign(game)
  const risks = lunarStates(game)
  const margin = massBudget(game, true).margin
  const correction = mission.routes[d.route].correctionKg
  const issues: Review['issues'][number][] = []
  if (!currentEvidence(game)) issues.push({ detail: { message: 'lunarFrrReturnEvidence' } })
  if (margin < 0) issues.push({ detail: { message: 'lunarFrrReturnMass', values: { count: -margin } } })
  else if (margin < correction) issues.push({ detail: { message: 'lunarFrrReturnCorrection', values: { margin, need: correction } } })
  else if (margin < mission.reserveKg) {
    const waiver = { id: 'reserve', label: mission.waivers.reserve.label,
      detail: { message: mission.waivers.reserve.description, values: { margin, need: mission.reserveKg } } }
    issues.push({ detail: waiver.detail, waiver })
  }
  if (active(game) && state.contract!.left > 0) issues.push({ detail: { message: 'lunarFrrReturnContract', values: { count: state.contract!.left } } })
  if (state.interfaceDue) issues.push({ detail: { message: 'lunarInterfacePending' } })
  if (state.grant && !lunarVerified(risks.descent)) issues.push({ detail: { message: 'lunarGrantCondition' } })
  const accepted = lunarAcceptance(d, risks)
  const reserves = lunarFlightRevised(game) ? lunarResponseReserves(game, accepted) : {}
  const reserveTotal = Object.values(reserves).reduce((total, item) => total + item, 0)
  issues.push(...accepted.map(id => {
    const issue = riskIssue(id, mission.risks[id].label, defectBelief(lunarMaturity(d, id), risks[id]), lunarSeverity(d, id))
    if (reserves[id] && issue.waiver) issue.waiver.detail = {
      message: 'lunarRiskReserveDetail',
      values: { percent: Math.round(defectBelief(lunarMaturity(d, id), risks[id]) * 100), credits: reserves[id] },
      labels: { severity: lunarSeverity(d, id) === 'fatal' ? 'riskSeverityFatal' : 'riskSeverityDegraded' },
    }
    return issue
  }))
  if (reserveTotal > game.credits) issues.push({ detail: { message: 'lunarRiskReserveShort', values: { cost: reserveTotal, available: game.credits } } })
  return { issues, approve: reserveTotal ? { message: 'lunarReviewReserveReady', values: { cost: reserveTotal } } : { message: 'chapterFrrApproved' },
    return: { message: 'lunarFrrReturn' } }

}

export function lunarDiagnosticRecords(game: Game) {
  if (!game.flight?.engineering) return []
  return (game.flight.failures as LunarRisk[]).filter(id => lunarRiskIds.includes(id))
    .map(id => `lunar:diagnostic:${game.seed}:${id}`)
}

export const lunarRules: MissionRules = {
  id: mission.id, title: mission.title, brief: mission.brief, dialogue: 'lunarBriefDialogue',
  deadline: mission.deadline, budget: mission.budget + mission.operatingAdvance, playMinutes: mission.playMinutes, initialDesign: mission.initialDesign,
  groups: {
    payload: optionGroup('lunarPayload', mission.payloads, option => ({ mass: option.massKg, windows: option.collectWindows, batches: option.maxBatches })),
    sensor: optionGroup('lunarSensor', mission.sensors, option => ({ mass: option.massKg, tilted: mission.tiltedWindows })),
    power: optionGroup('lunarPower', mission.powers, option => ({ mass: option.massKg, windows: option.nightWindows || mission.daylightWindows })),
    route: optionGroup('lunarRoute', mission.routes, option => ({ propellant: option.propellantKg, min: option.correctionKg, max: option.correctionKg, weeks: option.leadWeeks })),
    mount: optionGroup('lunarMount', mission.mounts, option => ({ min: option.growthKg, max: option.growthKg, slots: option.supportSlots })),
  },
  costs, tasks, configure,
  reopenPdr: (game, design) => Object.keys(design).some(key => key !== 'mount' && design[key] !== game.design[key]),
  configurable: (game, group) => group === 'mount' ? game.gate === 'CDR' && !completed(game, 'detail')
    : game.gate !== 'CDR',
  initialize: game => {
    const prefix = `lunar:diagnostic:${game.seed}:`
    const vouchers = Object.fromEntries(lunarRiskIds.filter(id => game.records.includes(prefix + id)).map(id => [id, 1]))
    return { ...game, missionState: { ...initial, vouchers } }
  },
  validSave: game => {
    const state = lunarState(game)
    const decisions = game.flightProgress?.state.decisions
    return Boolean(state && Number.isInteger(state.deckIndex) && typeof state.slots === 'number' && typeof state.extraKg === 'number'
      && (decisions === undefined || (Array.isArray(decisions) && decisions.every(item => typeof item === 'string'))) && lunarRisksReady(game))
  },
  effectiveDeadline: game => game.deadline - mission.routes[lunarDesign(game).route].leadWeeks,
  stageDetails: { feasibility: 'lunarFeasibilityDetail', design: 'lunarDesignDetail', build: 'lunarBuildDetail',
    integration: 'lunarIntegrationDetail', review: 'lunarReviewDetail', flight: 'lunarFlightDetail' },
  outcomes: { stopped: mission.outcomes.stopped.label, extra: mission.outcomes.extra.label, success: mission.outcomes.success.label, partial: mission.outcomes.noData.label },
  reputation: { minimum: 1, stretch: 1 },
  events: [
    { id: 'offers', title: 'lunarOfferTitle', detail: 'lunarOfferIntro', trigger: game => game.week === 0,
      choices: (['funding', 'tech', 'decline'] as const).map(id => ({
        id, label: mission.partnerships[id].label, detail: mission.partnerships[id].description,
        values: game => {
          const { credits, reserve } = lunarBudgetForecast(game)
          return {
            weeks: mission.partnerships[id].weeks, budget: game.credits, cost: credits, reserve,
            advance: mission.partnerships[id].advance + (id === 'funding' && hasOrbitalRecord(game, 'onTime') ? 10 : 0),
            milestone: mission.partnerships[id].milestone - (id === 'funding' && hasOrbitalRecord(game, 'onTime') ? 10 : 0),
            slots: mission.partnerships[id].supportSlots + (id === 'tech' && hasOrbitalRecord(game, 'verified') ? 1 : 0),
          }
        },
        apply: game => id === 'decline' ? game : sign(game, id, false),
      })) },
    ...mission.devCards.map(toEvent), ...mission.storyEvents.map(toEvent),
    ...lunarRiskIds.map((id): MissionEvent => ({
      id: `found:${id}`, title: mission.risks[id].label, detail: mission.risks[id].found, file: missionFile(mission.risks[id]),
      trigger: (game: Game) => lunarStates(game)[id].found && !lunarStates(game)[id].fixed,
      choices: [{ id: 'continue', label: 'lunarEventAcknowledge', detail: 'lunarFoundOptions', apply: (game: Game) => game }],
    })),
  ],
  reviews: { PDR: pdr, FRR: frr },
  onReviewApproved: (game, review) => review.gate === 'FRR' && lunarFlightRevised(game)
    ? set(game, { responseReserves: lunarResponseReserves(game, review.waivers.map(waiver => waiver.id.replace(/^risk:/, ''))) })
    : game,
  stopReason: game => {
    if (game.stage === 'review' && !game.returned && currentEvidence(game)) return null
    if (availableWeeks(game) === 0 && !(game.stage === 'design' && game.gate === 'PDR' && !game.returned && completed(game, 'prelim'))) return 'deadline'
    if (!frozen(game) || game.stage === 'review') return null
    if (!game.events.some(event => event.startsWith('SecondOffer:')) && game.week < mission.secondOfferWeek && !active(game)) return null
    if (game.week < mission.drawWeeks[mission.drawWeeks.length - 1] && !game.evidence) return null
    const required = Object.entries(tasks).filter(([id]) => mainline.some(work => id === work || id === `support:${work}`) || id === 'secondInterface' || id === 'retest')
      .map(([, task]) => task.plan(game)).filter((cost): cost is Cost => cost !== null)
    if (required.length && required.every(cost => cost.credits > game.credits)) return 'funds'
    return null
  },
  segmentedFlight: lunarSegments,
  records: game => [
    ...(game.flight?.delivered && game.flight.credits >= mission.returnedReserveForEfficiency ? ['lunar:returnedReserve'] : []),
    ...lunarDiagnosticRecords(game),
  ],
}
