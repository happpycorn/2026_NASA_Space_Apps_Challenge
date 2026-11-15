import { affordable, availableWeeks, currentEvidence, optionCost, pendingWorkId } from '../game/mission'
import type { Copy, CostItem, Design, Game, MissionRules } from '../game/types'
import { percent, topLevel, untested } from '../game/risk'
import {
  approvedWeek, completed, evidenceFor, freezeDesign, optionGroup, reviseDesign, riskIssue, verificationCopy,
} from './chapter'
import {
  flyOrbital, orbitalAcceptance, orbitalBestMargin, orbitalCarried, orbitalDegradedCapacity, orbitalLaunch as mission, orbitalRiskIds, orbitalRisks,
  orbitalUnknown, sameOrbitalLink, verifyOrbitalLink, type OrbitalDesign, type OrbitalKnowledge, type OrbitalPlan,
} from './orbital-launch'

type State = OrbitalKnowledge & { lab: boolean; liftLevels?: Partial<Record<OrbitalDesign['stage'], number>>; cutModel?: string }
export const orbitalRecords = { onTime: 'orbital:onTime', verified: 'orbital:verified', provenMargin: 'orbital:provenMargin' } as const
type Task = NonNullable<MissionRules['tasks']>[string]
type Remedy = keyof typeof mission.remedies
export const orbitalState = (game: Game) => game.missionState as State
const designOf = (game: Game) => game.design as OrbitalDesign
const seed = (game: Game) => game.seed ?? 0
const set = (game: Game, change: Partial<State>): Game => ({ ...game, missionState: { ...orbitalState(game), ...change } })
const margin = (game: Game) => orbitalBestMargin(seed(game), designOf(game), orbitalState(game))

const costs: Record<string, CostItem> = { ...mission.costs, ...mission.remedies, fixLink: mission.fixes.link }
const tasks: Record<string, Task> = {}

function task(id: string, ready: (game: Game) => boolean, complete: Task['complete'], detail?: Task['detail']) {
  tasks[id] = { plan: game => ready(game) ? costs[id] : null, complete, detail }
}

function configure(game: Game, design: Design) {
  const before = designOf(game)
  const after = design as OrbitalDesign
  const known = orbitalState(game)
  const liftLevels = { ...known.liftLevels, [before.stage]: known.lift }
  const link = !sameOrbitalLink(before, after)
    ? before.telemetry === after.telemetry && known.link.found && !known.link.fixed ? known.link : untested
    : known.link
  return set({ ...game, design }, {
    lift: liftLevels[after.stage] ?? 0, liftLevels, link,
    ...(!sameOrbitalLink(before, after) && { handover: false }),
  })
}

const pdr = (game: Game): Copy => margin(game) < 0
  ? { message: 'orbitalPdrReturn', values: { count: -margin(game) } }
  : { message: 'orbitalPdrPass', values: { count: margin(game) } }

task('assess', game => game.stage === 'feasibility', game => ({ ...game, stage: 'design', gate: 'PDR' }), () => ({ message: 'orbitalMdrPass' }))
task('prelim', game => game.stage === 'design' && !completed(game, 'prelim'), game => game)
const production = mission.gates.FRR.work.filter(id => id !== 'integrate')
const mainline = ['assess', 'prelim', 'freeze', ...production]

export function orbitalPlan(game: Game, design: Design = game.design, after?: { id: string; weeks: number }) {
  const pending = pendingWorkId(game)?.replace(/^lab:/, '')
  const next = after?.id.replace(/^lab:/, '')
  const unpaid = (id: string) => id !== pending && id !== next
  const remaining = mainline.filter(id => unpaid(id) && !completed(game, id))
  const integration = game.evidence ? 'retest' : 'integrate'
  const needsIntegration = unpaid(integration) && (game.evidence ? !currentEvidence(game) : !completed(game, integration))
  const week = game.week + (game.pendingWork?.remaining ?? 0) + (after?.weeks ?? 0)
  const state = orbitalState(game)
  const lab = { integrate: null as number | null, rehearse: null as number | null }
  if (state.lab && !after?.id.startsWith('lab:')) {
    if (needsIntegration && integration === 'integrate') {
      lab.integrate = week + remaining.reduce((total, id) => total + costs[id].weeks, 0)
    }
    const link = state.link
    if (!link.found && !link.fixed && link.level < topLevel && unpaid('rehearse')) {
      const prerequisites = remaining.filter(id => id !== 'buildStage')
        .concat(mission.risks.link.steps.slice(link.level, -1).filter(unpaid))
      lab.rehearse = week + prerequisites.reduce((total, id) => total + costs[id].weeks, 0)
    }
  }
  const savings = lab.integrate !== null && lab.integrate < mission.labSlot.expiresWeek ? mission.labSlot.uses.integrate.creditsSaved : 0
  const credits = remaining.reduce((total, id) => total + costs[id].credits + (id === 'freeze' ? optionCost(orbitalRules, design) : 0), 0)
    + (needsIntegration ? costs[integration].credits : 0) - savings
  return { credits, lab }
}

export function orbitalPlanCost(game: Game, design: Design = game.design) {
  return orbitalPlan(game, design).credits
}

tasks.freeze = {
  plan: game => game.stage === 'design' && game.gate === 'CDR' && game.credits >= orbitalPlanCost(game) ? {
    ...costs.freeze, credits: costs.freeze.credits + optionCost(orbitalRules, game.design),
  } : null,
  complete: freezeDesign, detail: () => ({ message: 'orbitalCdrPass' }),
}

for (const id of production) task(id, game => game.stage === 'build' && !completed(game, id), game =>
  production.every(other => other === id || completed(game, other)) ? { ...game, stage: 'integration' } : game)

function integrate(game: Game): Game {
  const d = designOf(game)
  return { ...game, stage: 'review', returned: false, evidence: evidenceFor(game,
    [margin(game) >= 0, mission.grounds[d.ground].capacity >= mission.confirmationUnits], { carried: orbitalCarried(d) }) }
}

task('integrate', game => game.stage === 'integration' && !game.evidence, integrate)
task('retest', game => game.stage === 'integration' && Boolean(game.evidence), integrate)
task('wait', () => true, game => game)

for (const risk of orbitalRiskIds) {
  mission.risks[risk].steps.forEach((id, index) => {
    const needs = (mission.requires as Partial<Record<string, string>>)[id]
    task(id, game => {
      const known = orbitalState(game)
      return completed(game, 'assess') && (!needs || completed(game, needs)) &&
        (risk === 'lift' ? known.lift === index : known.link.level === index && !known.link.found && !known.link.fixed)
    }, game => risk === 'lift' ? set(game, {
      lift: index + 1,
      liftLevels: index === 0 ? { standard: Math.max(1, orbitalState(game).liftLevels?.standard ?? 0),
        highMargin: Math.max(1, orbitalState(game).liftLevels?.highMargin ?? 0) } : orbitalState(game).liftLevels,
    }) : set(game, { link: verifyOrbitalLink(seed(game), designOf(game), orbitalState(game).link),
      ...(index >= 1 && { handover: true }) }),
    (before, after) => {
      if (risk === 'link') return verificationCopy(orbitalState(after).link, 'riskTestFound', {
        label: mission.risks.link.label,
        before: orbitalRisks(seed(before), designOf(before), orbitalState(before)).link.risk,
        after: orbitalRisks(seed(after), designOf(after), orbitalState(after)).link.risk,
      })
      const { known } = orbitalRisks(seed(after), designOf(after), orbitalState(after)).lift
      const start = mission.stages[designOf(after).stage].shortfallKg
      return { message: index + 1 === topLevel ? 'orbitalLiftRevealed' : 'orbitalLiftRange',
        values: { ...known, value: known.min, from: start.min, to: start.max } }
    })
  })
}

task('fixLink', game => orbitalState(game).link.found && !orbitalState(game).link.fixed,
  game => set(game, { link: { ...orbitalState(game).link, fixed: true } }), () => ({ message: 'riskFixed' }))

costs.handover = { ...costs.stationTest, label: 'orbitalHandover' }
task('handover', game => designOf(game).ground === 'dual' && orbitalState(game).link.found && orbitalState(game).handover !== true
  && completed(game, 'freeze'), game => set(game, { handover: true }), () => ({ message: 'orbitalHandoverDone' }))

const remedies: Record<Remedy, (design: OrbitalDesign) => OrbitalDesign | null> = {
  retarget: design => design.orbit === 'sso' ? { ...design, orbit: 'low' } : null,
  adapter: design => design.adapter === 'standard' ? { ...design, adapter: 'lightweight' } : null,
  dropDiagnostics: design => design.telemetry === 'diagnostics' ? { ...design, telemetry: 'basic' } : null,
  dualStation: design => design.ground === 'single' ? { ...design, ground: 'dual' } : null,
}
export function orbitalCorrection(game: Game, id: string) {
  const open = ['build', 'integration', 'review'].includes(game.stage) || (id === 'retarget' && game.stage === 'design')
  if (!open || !Object.hasOwn(remedies, id)) return null
  const design = remedies[id as Remedy](designOf(game))
  if (!design) return null
  const cost = costs[id]
  const retest = game.evidence && id !== 'dualStation' && id !== 'retarget' ? costs.retest : { credits: 0, weeks: 0 }
  return { design, cost, retest, required: { credits: cost.credits + retest.credits, weeks: cost.weeks + retest.weeks } }
}
for (const [id, remedy] of Object.entries(remedies)) {
  task(id, game => {
    const correction = orbitalCorrection(game, id)
    return Boolean(correction && affordable(game, correction.required))
  }, game => {
    const design = remedy(designOf(game))!
    const next = configure(game, design)
    // A booking or target change leaves the already tested hardware interface intact.
    if (id === 'dualStation' || id === 'retarget') return {
      ...next, ...(currentEvidence(game) && { evidence: { ...game.evidence!, design } }),
      ...(game.stage === 'design' && { gate: 'PDR' as const }), returned: false,
      ...(id === 'retarget' && game.log.some(entry => entry.detail?.message === 'orbitalCdrPassBonus')
        && { credits: Math.max(0, game.credits - mission.orbits.sso.bonus) }),
    }
    return reviseDesign(next, design)
  }, id === 'retarget' ? () => ({ message: 'orbitalRetargeted' }) : undefined)
}

for (const id of ['integrate', 'rehearse'] as const) {
  const labId = `lab:${id}`
  costs[labId] = { ...costs[id], credits: costs[id].credits - mission.labSlot.uses[id].creditsSaved }
  tasks[labId] = {
    plan: game => orbitalState(game).lab && game.week < mission.labSlot.expiresWeek && tasks[id].plan(game) ? costs[labId] : null,
    start: game => set(game, { lab: false }),
    complete: tasks[id].complete,
    detail: tasks[id].detail,
  }
}

function result(game: Game, choice: OrbitalPlan) {
  return flyOrbital(seed(game), designOf(game), orbitalState(game), choice)
}

const cut = mission.events.budgetCut.budgetChange
const cutPlans = [
  { id: 'preserveLift', label: 'orbitalCutLift', change: { telemetry: 'basic' }, when: (d: OrbitalDesign) => d.telemetry === 'diagnostics' && d.stage === 'highMargin' },
  { id: 'preserveData', label: 'orbitalCutData', change: { stage: 'standard' }, when: (d: OrbitalDesign) => d.stage === 'highMargin' && d.telemetry === 'diagnostics' },
  { id: 'baseline', label: 'orbitalCutBaseline', change: { telemetry: 'basic', stage: 'standard', ground: 'single' },
    when: (d: OrbitalDesign) => d.stage !== 'standard' || d.telemetry !== 'basic' || d.ground !== 'single' },
  { id: 'acknowledge', label: 'orbitalEventAcknowledge', change: {}, when: () => true },
] as const

export const orbitalRules: MissionRules = {
  id: mission.id, title: mission.title, brief: mission.brief, deadline: mission.deadline, budget: mission.budget,
  playMinutes: mission.playMinutes, initialDesign: mission.initialDesign,
  dialogue: 'orbitalBriefDialogue',
  groups: {
    orbit: optionGroup('orbitalOrbit', mission.orbits, option => ({
      altitude: option.altitudeKm, inclination: option.inclination, loss: option.capacityLossKg, bonus: option.bonus,
    })),
    stage: optionGroup('orbitalStage', mission.stages, option => ({ capacity: option.capacityKg, ...option.shortfallKg })),
    telemetry: optionGroup('orbitalTelemetry', mission.telemetry, option => ({ mass: option.massKg, units: option.diagnosticUnits })),
    adapter: optionGroup('orbitalAdapter', mission.adapters, option => ({ mass: option.massKg })),
    ground: optionGroup('orbitalGroundPlan', mission.grounds, option => ({ capacity: option.capacity, degraded: option.degradedCapacity })),
  },
  costs, tasks, configure,
  configurable: (game, group) => group === 'orbit' ? game.stage === 'feasibility'
    : (group === 'stage' || group === 'ground') ? game.gate !== 'CDR' : true,
  initialize: game => ({ ...game, missionState: { ...orbitalUnknown, lab: false, cutModel: 'pdr' } }),
  validSave: game => {
    const state = orbitalState(game)
    return Boolean(state && Number.isInteger(state.lift) && state.lift >= 0 && state.lift <= topLevel && state.link &&
      Number.isInteger(state.link.level) && state.link.level >= 0 && state.link.level <= topLevel && typeof state.lab === 'boolean')
  },
  stageDetails: {
    feasibility: 'orbitalFeasibilityDetail', design: 'orbitalDesignDetail', build: 'orbitalBuildDetail',
    integration: 'orbitalIntegrationDetail', review: 'orbitalReviewDetail', flight: 'orbitalFlightDetail',
  },
  outcomes: { stopped: mission.outcomes.stopped.label, extra: mission.outcomes.extra.label, success: mission.outcomes.success.label, partial: mission.outcomes.incomplete.label },
  reputation: { minimum: 1, stretch: 1 },
  events: [
    { id: 'foundLink', title: 'orbitalRiskLink', detail: 'riskTestFound',
      trigger: game => orbitalState(game).link.found && !orbitalState(game).link.fixed,
      choices: [{ id: 'continue', label: 'orbitalEventAcknowledge', detail: 'orbitalFoundOptions', apply: game => game }] },
    { id: 'lab', title: 'orbitalLabSlot', detail: 'orbitalLabSlotDetail', values: () => ({ week: mission.labSlot.expiresWeek, integrate: mission.labSlot.uses.integrate.creditsSaved, rehearse: mission.labSlot.uses.rehearse.creditsSaved }),
      trigger: game => game.week === 0 && game.records.includes('cubesat:partnerVerified'),
      choices: [
        { id: 'accept', label: 'orbitalLabSlot', detail: 'orbitalLabSlotDialogue', apply: game => set(game, { lab: true }) },
      ] },
    { id: 'budgetCut', title: 'orbitalEventCutTitle', detail: 'orbitalBudgetUpdate', reducesFunding: true, quote: 'orbitalEventCutDialogue',
      values: game => ({ before: game.credits, after: Math.max(0, game.credits + cut) }),
      trigger: game => orbitalState(game).cutModel ? completed(game, 'prelim') && game.gate === 'CDR'
        : game.week >= mission.events.budgetCut.afterWeek,
      choices: cutPlans.map(plan => ({
        id: plan.id, label: plan.label, detail: 'orbitalCutPlan',
        available: game => plan.when(designOf(game)),
        values: game => {
          const design = { ...game.design, ...plan.change }
          return { cost: orbitalPlanCost(game, design), budget: Math.max(0, game.credits + cut),
            margin: margin(configure(game, design)) }
        },
        apply: game => {
          const next = { ...game, credits: game.credits + cut }
          if (plan.id === 'acknowledge') return next
          const changed = configure(next, { ...game.design, ...plan.change })
          return { ...changed, gate: 'PDR', returned: false }
        },
      })) },

  ],
  reviews: {
    PDR: game => {
      if (!completed(game, 'prelim')) return null
      const knowledge = orbitalState(game)
      const d = designOf(game)
      const risks = orbitalRisks(seed(game), d, knowledge)
      // An unanalysed item needs a signature only while it can still fail. Lift that clears the whole range needs none.
      const unchecked: { id: string; label: typeof mission.risks.lift.label | typeof mission.risks.link.label; detail: Copy }[] = [
        ...(knowledge.lift || risks.lift.risk === 0 ? [] : [{ id: 'analysis:lift', label: mission.risks.lift.label,
          detail: { message: 'orbitalAssumptionLift' as const, values: { percent: percent(risks.lift.risk) } } }]),
        ...(knowledge.link.level ? [] : [{ id: 'analysis:link', label: mission.risks.link.label,
          detail: { message: 'orbitalAssumptionLink' as const, values: { percent: percent(risks.link.risk),
            capacity: mission.grounds[d.ground].capacity, degraded: orbitalDegradedCapacity(d, knowledge) } } }]),
      ]
      const assumptions = unchecked.map(waiver => ({ detail: { message: waiver.label }, waiver }))
      return { issues: margin(game) < 0 ? [{ detail: pdr(game) }] : assumptions, approve: pdr(game), return: pdr(game) }
    },
    FRR: (game, evidence) => {
      const d = designOf(game)
      const risks = orbitalRisks(seed(game), d, orbitalState(game))
      const issues = orbitalAcceptance(seed(game), d, orbitalState(game)).filter(id => id !== 'lift' || margin(game) >= 0)
        .map(id => riskIssue(id, mission.risks[id].label, risks[id].risk, risks[id].severity))
      if (!evidence) issues.unshift({ detail: { message: 'orbitalFrrReturnEvidence' } })
      if (margin(game) < 0) issues.unshift({ detail: { message: 'orbitalFrrReturnMargin', values: { count: -margin(game) } } })
      const linkIssue = issues.find(issue => issue.waiver?.id === 'risk:link')
      if (linkIssue?.waiver && risks.link.found) linkIssue.waiver.detail = {
        message: 'orbitalKnownLink', values: { capacity: orbitalDegradedCapacity(d, orbitalState(game)), required: mission.confirmationUnits },
      }
      if (d.stage === 'highMargin' && risks.lift.level < topLevel && !issues.some(issue => issue.waiver?.id === 'risk:lift') && margin(game) >= 0) {
        const detail = { message: 'orbitalHotfireWaiver' as const, values: { percent: percent(risks.lift.risk) } }
        issues.push({ detail, waiver: { id: 'unfired', label: 'orbitalHotfire', detail } })
      }
      return { issues, approve: { message: 'chapterFrrApproved' }, return: { message: 'orbitalFrrReturn' } }
    },
  },
  stopReason: game => {
    if (game.stage === 'review' && !game.returned && currentEvidence(game)) return null
    if (game.stage === 'review' && game.returned && margin(game) < 0
      && !Object.keys(remedies).some(id => {
        const design = remedies[id as Remedy](designOf(game))
        return design && margin(configure(game, design)) >= 0 && tasks[id].plan(game)
      })) return 'margin'
    if (availableWeeks(game) === 0 && (game.stage !== 'design' || game.gate !== 'PDR' || game.returned || !completed(game, 'prelim'))) return 'deadline'
    if (game.stage === 'feasibility' && game.credits < costs.assess.credits) return 'funds'
    if (game.stage === 'design' && game.credits < (completed(game, 'prelim') ? costs.freeze.credits + optionCost(orbitalRules, mission.initialDesign) : costs.prelim.credits)) return 'funds'
    if (game.stage === 'build' && game.credits < production.filter(id => !completed(game, id)).reduce((total, id) => total + costs[id].credits, 0)) return 'funds'
    if (game.stage === 'integration' && game.credits < (game.evidence ? costs.retest.credits : orbitalState(game).lab && game.week < mission.labSlot.expiresWeek ? costs['lab:integrate'].credits : costs.integrate.credits)) return 'funds'
    return null
  },
  segmentedFlight: {
    segments: [
      {
        id: 'ascent', title: 'orbitalAscentTitle', brief: () => ({ message: 'orbitalAscentCarried' }),
        resolve: ({ game }) => {
          const flight = result(game, 'confirmFirst')
          const report: Copy = flight.stop === 'ascent'
            ? { message: 'orbitalAscentFail', values: { shortfall: flight.outcomes[0].value!, margin: flight.outcomes[0].limit! } }
            : { message: flight.marginProven ? 'orbitalAscentProven' : 'orbitalAscentPass',
              values: { margin: flight.marginKg, threshold: mission.marginStretchKg } }
          return { failed: flight.stop === 'ascent', report }
        },
      },
      {
        id: 'pass', title: 'orbitalPassTitle', brief: ({ game }) => {
          const flown = result(game, 'confirmFirst')
          return { message: flown.capacity < mission.grounds[designOf(game).ground].capacity ? 'orbitalPassDegraded' : 'orbitalPassActual', values: { count: flown.capacity } }
        },
        choices: ({ game }) => {
          const primary = result(game, 'confirmFirst')
          const diagnosis = result(game, 'diagnosticsFirst')
          const prepaid = game.log.some(entry => entry.detail?.message === 'orbitalCdrPassBonus')
          const funds = game.credits + (prepaid ? 0 : mission.orbits[designOf(game).orbit].bonus)
          if (primary.diagnostics === diagnosis.diagnostics || diagnosis.confirmation < mission.confirmationUnits
            || (diagnosis.late && funds < mission.lateDeliveryFee)) return []
          return (Object.keys(mission.passPlans) as OrbitalPlan[]).map(id => {
            const plan = result(game, id)
            return { id, label: mission.passPlans[id].label, detail: {
              message: plan.late ? 'orbitalPassOptionLate' : 'orbitalPassReceipt',
              values: { confirmation: plan.firstConfirmation, diagnostics: plan.diagnostics, fee: mission.lateDeliveryFee },
            } }
          })
        },
        resolve: ({ game }, choice) => {
          const { confirmation, diagnostics, late } = result(game, (choice ?? 'confirmFirst') as OrbitalPlan)
          return { report: { message: late ? 'orbitalPassLateReceipt' : 'orbitalPassReceipt', values: { confirmation, diagnostics } } }
        },
      },
    ],
    finish: ({ game, progress }) => {
      const choice = (progress.steps.at(-1)?.choice ?? 'confirmFirst') as OrbitalPlan
      const flight = result(game, choice)
      const delivered = flight.outcome !== 'incomplete'
      const prepaid = game.log.some(entry => entry.detail?.message === 'orbitalCdrPassBonus')
      const premium = delivered && !prepaid ? mission.orbits[designOf(game).orbit].bonus : 0
      const fee = flight.late ? mission.lateDeliveryFee : 0
      return { ...flight, choice, delivered, stretch: flight.outcome === 'extra', premium, fee, credits: game.credits + premium - fee }
    },
  },
  records: game => {
    if (!game.flight?.delivered) return []
    const knowledge = orbitalState(game)
    return [
      ...(!game.flight.late && (approvedWeek(game) ?? Infinity) <= mission.onTimeWeek ? [orbitalRecords.onTime] : []),
      ...(knowledge.lift > 0 && knowledge.link.level > 0 && knowledge.lift + knowledge.link.level >= mission.verifiedLevels ? [orbitalRecords.verified] : []),
      ...(game.flight.marginProven ? [orbitalRecords.provenMargin] : []),
    ]
  },
}
