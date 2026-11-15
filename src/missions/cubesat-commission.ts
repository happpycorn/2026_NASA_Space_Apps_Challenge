import type { Copy, Cost, CostItem, Design, FlightContext, Game, MissionRules } from '../game/types'
import { currentEvidence, optionCost } from '../game/mission'
import { hasDefect, itemRandom } from '../game/risk'
import { completed, evidenceFor, freezeDesign, reviseDesign } from './chapter'
import { cubeSat } from './cubesat'

export const commissions = {
  river: { name: 'commissionRiver', brief: 'commissionRiverBrief', instrument: 'commissionOptical',
    auxiliary: 'commissionInfrared', delivered: 'commissionRiverDelivered', north: 'commissionRiverNorth', south: 'commissionRiverSouth',
    northImpact: 'commissionRiverNorthImpact', southImpact: 'commissionRiverSouthImpact', southReward: 'commissionRiverSouthReward',
    southRecord: 'cubesat:bridgeAdvisory', required: 2, watts: 3, kg: 0.4, cost: 14 },
  bay: { name: 'commissionBay', brief: 'commissionBayBrief', instrument: 'commissionThermal',
    auxiliary: 'commissionVisible', delivered: 'commissionBayDelivered', north: 'commissionBayNorth', south: 'commissionBaySouth',
    northImpact: 'commissionBayNorthImpact', southImpact: 'commissionBaySouthImpact', southReward: 'commissionBaySouthReward',
    southRecord: 'cubesat:inletSurvey', required: 3, watts: 4, kg: 0.5, cost: 17 },
} as const

export type CommissionId = keyof typeof commissions
export const commissionFor = (game: Pick<Game, 'commission'>) => commissions[game.commission ?? 'river']

const launches = {
  iss: { label: cubeSat.launches.iss.label, description: 'commissionIssDetail', cost: 10, limit: 4, capacity: 4, lead: 0 },
  rideshare: { label: cubeSat.launches.rideshare.label, description: 'commissionRideshareDetail', cost: 16, limit: 6, capacity: 5, lead: 1 },
} as const

const capabilities = {
  baseline: { label: 'commissionBaseline', description: 'commissionBaselineDetail', cost: 0, buildWeeks: 0, backup: false, pointing: false },
  pointing: { label: 'commissionPointing', description: 'commissionPointingDetail', cost: 8, buildWeeks: 0, backup: false, pointing: true },
  sensor: { label: 'commissionSensor', description: 'commissionSensorDetail', cost: 13, buildWeeks: 1, backup: true, pointing: false },
  combined: { label: 'commissionCombined', description: 'commissionCombinedDetail', cost: 21, buildWeeks: 2, backup: true, pointing: true },
} as const

const costs = {
  assess: cubeSat.costs.assess, freeze: cubeSat.costs.freeze, build: cubeSat.costs.build, integrate: cubeSat.costs.integrate,
  screen: { label: 'commissionScreen', weeks: 1, credits: 5 },
  correctEarly: { label: 'commissionCorrectEarly', weeks: 0, credits: 6 },
  correctLate: { label: 'commissionCorrectLate', weeks: 1, credits: 9 },
  strip: { label: 'commissionStrip', weeks: 0, credits: 4 },
  retest: { label: 'retest', weeks: 1, credits: 8 },
} satisfies Record<string, CostItem>

const mainline = ['assess', 'freeze', 'build', 'integrate'] as const
const extraObstructionChance = 0.35
export const capabilityFor = (design: Design) => capabilities[design.capability as keyof typeof capabilities]
const launchFor = (design: Design) => launches[design.launch as keyof typeof launches]
const effectiveDeadline = (game: Game, design = game.design) => game.deadline - launchFor(design).lead
const corrected = (game: Game) => completed(game, 'correctEarly') || completed(game, 'correctLate')
const interfaceFault = (game: Game) => hasDefect(game.seed, 'cubesat:auxiliary:interface', 'new') && !corrected(game)
const screened = (game: Game) => completed(game, 'screen')
const openFinding = (game: Game) => game.log.find(entry => entry.id === 'screen')?.detail?.message === 'commissionScreenFound' && !corrected(game)

export function commissionForecast(game: Game, design = game.design) {
  const launch = launchFor(design)
  const capability = capabilityFor(design)
  const client = commissionFor(game)
  const mass = Math.round((cubeSat.busKg + 0.5 + client.kg + (capability.backup ? 0.5 : 0) + (capability.pointing ? 0.2 : 0)) * 10) / 10
  // The auxiliary exposure is scheduled outside a transmit slot.
  const peak = cubeSat.busWatts + Math.max(client.watts + cubeSat.downlinkWatts, capability.backup ? 6 : 0)
  return { mass, massLimit: launch.limit, peak, available: 10, required: client.required, capacity: launch.capacity, deadline: effectiveDeadline(game, design) }
}

export function commissionLimits(plan: ReturnType<typeof commissionForecast>): Copy[] {
  const issues: Copy[] = []
  if (plan.mass > plan.massLimit) issues.push({ message: 'massFinding', values: { mass: plan.mass, limit: plan.massLimit } })
  if (plan.peak > plan.available) issues.push({ message: 'commissionPowerBlock', values: { peak: plan.peak, available: plan.available } })
  return issues
}

export function commissionCanConfigure(game: Game) {
  return game.stage !== 'design' || !screened(game) || commissionLimits(commissionForecast(game)).length > 0
}

export function restoreCommissionDesign(game: Game): Game {
  if (game.missionId !== cubeSat.id || !['build', 'integration', 'review'].includes(game.stage) || !screened(game)
    || commissionLimits(commissionForecast(game)).length === 0) return game
  const freeze = game.log.findIndex(entry => entry.id === 'freeze' && !entry.incomplete)
  if (freeze < 1) return game
  // Older versions let a screened design pass CDR over the deployer limit.
  const log = game.log.slice(0, freeze)
  const refunded = game.log.slice(freeze).reduce((total, entry) => total + entry.cost, 0)
  const { studioWork: _invalidWork, ...design } = game
  return { ...design, log, stage: 'design', gate: 'PDR', returned: false, evidence: null,
    week: log.at(-1)!.week, credits: game.credits + refunded }
}

function mainCost(game: Game, id: typeof mainline[number], design = game.design): Cost {
  const cost = costs[id]
  const client = commissionFor(game)
  if (id === 'freeze') return { ...cost, credits: cost.credits + optionCost(commissionRules, design) + client.cost }
  if (id === 'build') return { ...cost, weeks: cost.weeks + capabilityFor(design).buildWeeks }
  return cost
}

export function commissionPlan(game: Game, design = game.design) {
  const forecast = commissionForecast(game, design)
  const work = mainline.filter(id => !completed(game, id)).reduce((total, id) => {
    const cost = mainCost(game, id, design)
    return { weeks: total.weeks + cost.weeks, credits: total.credits + cost.credits }
  }, { weeks: 0, credits: 0 })
  const deliveryHigh = Math.min(forecast.required, forecast.capacity)
  const deliveryLow = Math.min(deliveryHigh, forecast.required - Number(!capabilityFor(design).backup), forecast.capacity - 1)
  return { ...forecast, deliveryLow, deliveryHigh, weeks: work.weeks, credits: work.credits, spareWeeks: forecast.deadline - game.week - work.weeks,
    spareCredits: game.credits - work.credits }
}

export function commissionRepairs(game: Game) {
  const late = game.stage === 'review'
  const retest = late ? costs.retest : { weeks: 0, credits: 0 }
  const fallback = { ...game.design, capability: 'baseline' }
  const fallbackPlan = commissionPlan(game, fallback)
  const current = commissionPlan(game)
  const currentFits = commissionLimits(current).length === 0
  const fix = late ? 'correctLate' : 'correctEarly'
  return [
    { id: fix, cost: costs[fix], weeks: costs[fix].weeks + retest.weeks, credits: costs[fix].credits + retest.credits,
      eligible: currentFits && (late ? game.evidence?.auxPass === false : openFinding(game)),
      fits: current.spareWeeks >= costs[fix].weeks + retest.weeks && current.spareCredits >= costs[fix].credits + retest.credits },
    { id: 'strip' as const, cost: costs.strip, weeks: retest.weeks, credits: costs.strip.credits + retest.credits,
      eligible: capabilityFor(game.design).backup && commissionLimits(fallbackPlan).length === 0
        && (late ? !currentFits || game.evidence?.auxPass === false : openFinding(game)),
      fits: fallbackPlan.spareWeeks >= retest.weeks && fallbackPlan.spareCredits >= costs.strip.credits + retest.credits },
  ].filter(item => item.eligible)
}

function integrate(game: Game): Game {
  const plan = commissionForecast(game)
  const capability = capabilityFor(game.design)
  const auxPass = !capability.backup || !interfaceFault(game)
  const ditl = { separation: cubeSat.ditl.separationMinutes, deploy: 30,
    firstTx: cubeSat.radios.compliant.firstTxMinutes, threshold: cubeSat.ditl.minQuietMinutes }
  const checks = [plan.mass <= plan.massLimit, plan.peak <= plan.available, auxPass,
    plan.capacity >= plan.required, ditl.firstTx - ditl.separation >= ditl.threshold]
  return { ...game, stage: 'review', returned: false, evidence: evidenceFor(game, checks, {
    ...plan, auxPass, capability: game.design.capability, ditl,
  }) }
}

function operation({ game }: FlightContext) {
  const client = commissionFor(game)
  const capability = capabilityFor(game.design)
  const capacity = launchFor(game.design).capacity - Number(itemRandom(game.seed, 'cubesat:pass:duration') < 0.22)
  const obstructed = itemRandom(game.seed, `cubesat:${game.commission}:obstruction`) < 0.20
  const assisted = obstructed && capability.backup
  const batches = Math.min(capacity, client.required - Number(obstructed && !assisted))
  const opportunities = Number(capability.pointing) + Number(capability.backup && !assisted)
  return { capacity, batches, assisted, obstructed, opportunities }
}

export const commissionRules: MissionRules = {
  id: cubeSat.id, title: cubeSat.title, brief: 'commissionIntro', dialogue: 'commissionIntro', deadline: 7, budget: cubeSat.budget,
  playMinutes: cubeSat.playMinutes, initialDesign: { launch: 'iss', capability: 'baseline' }, effectiveDeadline,
  groups: {
    launch: { legend: 'launch', options: Object.fromEntries(Object.entries(launches).map(([id, option]) => [id, { ...option,
      params: { limit: option.limit, capacity: option.capacity, week: 7 - option.lead } }])) },
    capability: { legend: 'commissionCapability', options: Object.fromEntries(Object.entries(capabilities).map(([id, option]) => [id, { ...option,
      params: { weeks: option.buildWeeks } }])) },
  },
  costs,
  tasks: {
    assess: { plan: game => game.stage === 'feasibility' && !commissionLimits(commissionForecast(game)).length ? costs.assess : null,
      complete: game => ({ ...game, stage: 'design', gate: 'PDR' }) },
    screen: { plan: game => {
      if (game.stage !== 'design' || screened(game) || !capabilityFor(game.design).backup) return null
      const plan = commissionPlan(game)
      return !commissionLimits(plan).length && plan.spareWeeks >= costs.screen.weeks && plan.spareCredits >= costs.screen.credits ? costs.screen : null
    }, complete: game => game, detail: game => ({ message: interfaceFault(game) ? 'commissionScreenFound' : 'commissionScreenClear' }) },
    correctEarly: { plan: game => game.stage === 'design' && commissionRepairs(game).some(item => item.id === 'correctEarly' && item.fits) ? costs.correctEarly : null,
      complete: game => game, detail: () => ({ message: 'commissionEarlyCorrected' }) },
    freeze: { plan: game => {
      if (game.stage !== 'design' || (capabilityFor(game.design).backup && openFinding(game))) return null
      const plan = commissionPlan(game)
      return !commissionLimits(plan).length && plan.spareCredits >= 0 && plan.spareWeeks >= 0 ? mainCost(game, 'freeze') : null
    }, complete: freezeDesign },
    build: { plan: game => game.stage === 'build' ? mainCost(game, 'build') : null, complete: game => ({ ...game, stage: 'integration' }) },
    integrate: { plan: game => game.stage === 'integration' && !game.evidence ? costs.integrate : null, complete: integrate },
    correctLate: { plan: game => game.returned && commissionRepairs(game).some(item => item.id === 'correctLate' && item.fits) ? costs.correctLate : null,
      complete: game => reviseDesign(game, game.design), detail: () => ({ message: 'commissionLateCorrected' }) },
    strip: { plan: game => (game.stage === 'design' || game.returned) && commissionRepairs(game).some(item => item.id === 'strip' && item.fits) ? costs.strip : null,
      complete: game => game.stage === 'design' ? { ...game, design: { ...game.design, capability: 'baseline' } }
        : reviseDesign(game, { ...game.design, capability: 'baseline' }), detail: () => ({ message: 'commissionStripped' }) },
    retest: { plan: game => game.stage === 'integration' && game.evidence ? costs.retest : null, complete: integrate },
  },
  configure: (game, design) => commissionCanConfigure(game) ? { ...game, design } : game,
  stageDetails: { feasibility: 'commissionIntro', design: 'commissionDesign', build: 'buildDetail', integration: 'integrationDetail',
    review: 'reviewDetail', flight: 'commissionFirstPass' },
  outcomes: { stopped: 'outcomeStopped', extra: 'outcomeExtra', success: 'outcomeSuccess', partial: 'outcomePartial' },
  reputation: { minimum: 1, stretch: 1 },
  reviews: {
    FRR: (_, evidence) => {
      const issues: { detail: Copy }[] = []
      if (!evidence) issues.push({ detail: { message: 'evidenceRetestWhy' } })
      if (evidence && !evidence.checks[0]) issues.push({ detail: { message: 'massFinding', values: { mass: evidence.mass, limit: evidence.massLimit } } })
      if (evidence && !evidence.checks[1]) issues.push({ detail: { message: 'commissionPowerBlock', values: { peak: evidence.peak, available: evidence.available } } })
      if (evidence?.auxPass === false) issues.push({ detail: { message: 'commissionInterfaceFailed' } })
      if (evidence && [3, 4].some(index => !evidence.checks[index])) issues.push({ detail: { message: 'commissionReleaseBlocked' } })
      return { issues, approve: { message: 'chapterFrrApproved' }, return: { message: 'commissionReleaseBlocked' } }
    },
  },
  stopReason: game => {
    if (game.stage !== 'review' || !game.returned) return null
    const repairs = commissionRepairs(game)
    if (repairs.some(item => item.fits)) return null
    return repairs.some(item => item.credits <= game.credits) ? 'deadline' : 'funds'
  },
  validSave: game => Boolean(game.commission && Object.hasOwn(commissions, game.commission)),
  records: game => {
    if (!game.flight?.delivered) return []
    const records: string[] = []
    if (currentEvidence(game)?.checks.every(Boolean) && capabilityFor(game.design).backup) records.push('cubesat:partnerVerified')
    if (game.flight.extra === 'south') records.push(commissionFor(game).southRecord)
    return records
  },
  segmentedFlight: {
    segments: [
      {
        id: 'commission-pass', title: 'groundPassLabel', action: 'runFlight', brief: () => ({ message: 'commissionFirstPass' }),
        resolve: context => {
          const state = operation(context)
          const client = commissionFor(context.game)
          const ready = state.batches >= client.required && state.capacity > state.batches && state.opportunities > 0
          return { state, end: !ready, report: { message: state.assisted ? 'commissionSubstituted' : 'commissionGroundReceipt', values: { batches: state.batches, capacity: state.capacity } } }
        },
      },
      {
        id: 'commission-extra', title: 'commissionExtraTitle', action: 'commissionExtraAction',
        brief: ({ progress }) => ({ message: 'commissionExtraRoom', values: { batches: Number(progress.state.batches),
          slots: Number(progress.state.capacity) - Number(progress.state.batches) } }),
        choices: ({ game }) => [
          { id: 'north', label: commissionFor(game).north, detail: { message: 'commissionNorthRisk' } },
          { id: 'south', label: commissionFor(game).south,
            detail: { message: 'commissionSouthRisk', values: { chance: extraObstructionChance * 100 } },
            consequence: { message: commissionFor(game).southReward } },
        ],
        resolve: ({ game, progress }, choice) => {
          const success = choice === 'north' || itemRandom(game.seed, `cubesat:${game.commission}:extra`) >= extraObstructionChance
          return { state: { ...progress.state, extra: success ? choice : null },
            report: { message: success ? choice === 'north' ? commissionFor(game).northImpact : commissionFor(game).southImpact : 'commissionExtraObstructed' } }
        },
      },
    ],
    finish: ({ game, progress }) => {
      const { batches, extra, assisted, capacity, obstructed } = progress.state
      return { choice: String(extra ?? 'primary'), delivered: Number(batches) >= commissionFor(game).required, stretch: Boolean(extra),
        batches: Number(batches) + Number(Boolean(extra)), primary: batches, extra, assisted, capacity, obstructed,
        archived: Number(batches) + Number(Boolean(extra)) }
    },
  },
}
