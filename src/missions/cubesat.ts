import type { BenchLead, Design, Game, MissionRules, TestFocus } from '../game/types'

export const cubeSat = {
  id: 'cubesat',
  title: 'cubesat',
  brief: 'briefStory',
  deadline: 6,
  budget: 100,
  dollarsPerCredit: 10_000,
  playMinutes: '3–5',
  initialDesign: { payload: 'basic', supply: 'standard', schedule: 'overlap', radio: 'compliant' },
  reviewDesign: { payload: 'advanced', supply: 'standard', schedule: 'overlap', radio: 'compliant' },
  minimumBatches: 2,
  stretchBatches: 4,
  missionOrbits: 1,
  diagnosticBatches: 4,
  busWatts: 2,
  downlinkWatts: 4,
  groundCapacity: 5,
  payloads: {
    basic: { label: 'payloadBasic', description: 'payloadBasicDetail', watts: 3, batches: 2, cost: 14 },
    advanced: { label: 'payloadAdvanced', description: 'payloadAdvancedDetail', watts: 7, batches: 5, cost: 21 },
  },
  supplies: {
    standard: { label: 'powerStandard', description: 'powerStandardDetail', watts: 10, cost: 12 },
    reinforced: { label: 'powerReinforced', description: 'powerReinforcedDetail', watts: 14, cost: 22 },
  },
  schedules: {
    overlap: { label: 'scheduleOverlap', description: 'scheduleOverlapDetail', batchLoss: 0, params: { count: 0 } },
    stagger: { label: 'scheduleStagger', description: 'scheduleStaggerDetail', batchLoss: 2, params: { count: 2 } },
  },
  radios: {
    compliant: { label: 'radioCompliant', description: 'radioCompliantDetail', firstTxMinutes: 32, groundCapacity: 4, params: { minutes: 32, capacity: 4 } },
    early: { label: 'radioEarly', description: 'radioEarlyDetail', firstTxMinutes: 20, groundCapacity: 5, params: { minutes: 20, capacity: 5 } },
  },
  ditl: {
    separationMinutes: 0,
    deployMinutes: 15,
    minQuietMinutes: 30,
    source: 'NASA CubeSat 101 §6.9.1',
    url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=68',
  },
  costs: {
    assess: { weeks: 1, credits: 6, label: 'assess' },
    analyze: { weeks: 1, credits: 5, label: 'analyze' },
    freeze: { weeks: 1, credits: 6, label: 'freeze' },
    build: { weeks: 1, credits: 9, label: 'buildWork' },
    integrate: { weeks: 1, credits: 8, label: 'integrate' },
    wait: { weeks: 1, credits: 0, label: 'wait' },
    stagger: { weeks: 1, credits: 6, label: 'remedyStagger' },
    basic: { weeks: 1, credits: 10, label: 'remedyBasic' },
    reinforced: { weeks: 1, credits: 16, label: 'remedyReinforced' },
    compliant: { weeks: 1, credits: 5, label: 'remedyCompliant' },
  },
} as const

export const departments = ['science', 'power', 'comms'] as const
export type Department = typeof departments[number]
export const proposals = {
  science: { options: ['stagger', 'basic'], fallback: 'stagger', brief: 'scienceBrief' },
  power: { options: ['stagger', 'reinforced'], fallback: 'reinforced', brief: 'powerBrief' },
  comms: { options: ['stagger', 'reinforced'], fallback: 'stagger', brief: 'commsBrief' },
} as const satisfies Record<Department, { options: readonly string[]; fallback: string; brief: string }>

export type CubeSatDesign = {
  payload: keyof typeof cubeSat.payloads
  supply: keyof typeof cubeSat.supplies
  schedule: keyof typeof cubeSat.schedules
  radio: keyof typeof cubeSat.radios
}

export const initialDesign: CubeSatDesign = cubeSat.initialDesign
export const reviewDesign: CubeSatDesign = cubeSat.reviewDesign
export const remedies = ['stagger', 'basic', 'reinforced', 'compliant'] as const
export type Remedy = typeof remedies[number]
export const multiplayerRemedies = ['stagger', 'basic', 'reinforced'] as const
export type MultiplayerRemedy = typeof multiplayerRemedies[number]
export const flightChoices = ['priority', 'extra', 'diagnostics'] as const
export type FlightChoice = typeof flightChoices[number]

export function powerTimeline(design: CubeSatDesign) {
  const bus = cubeSat.busWatts
  const imaging = bus + cubeSat.payloads[design.payload].watts
  const downlink = bus + cubeSat.downlinkWatts
  return design.schedule === 'overlap'
    ? [{ id: 'imaging', watts: imaging }, { id: 'overlap', watts: imaging + cubeSat.downlinkWatts }] as const
    : [{ id: 'imaging', watts: imaging }, { id: 'handoff', watts: bus }, { id: 'downlink', watts: downlink }] as const
}

const assemblyOrder = ['science', 'power', 'comms'] as const

export function benchSequence(lead: BenchLead = 'science') {
  return lead === 'power' ? ['power', 'science', 'comms'] as const : assemblyOrder
}

export function scopeSegment(timeline: ReturnType<typeof powerTimeline>, focus: TestFocus = 'downlink') {
  return focus === 'imaging' ? timeline[0] : timeline[timeline.length - 1]
}

export function forecast(design: CubeSatDesign) {
  const payload = cubeSat.payloads[design.payload]
  const supply = cubeSat.supplies[design.supply]
  const schedule = cubeSat.schedules[design.schedule]
  const radio = cubeSat.radios[design.radio]
  const peak = Math.max(...powerTimeline(design).map(segment => segment.watts))
  const capacity = Math.min(cubeSat.groundCapacity, radio.groundCapacity)
  return {
    payloadWatts: payload.watts, peak, available: supply.watts, deficit: Math.max(0, peak - supply.watts),
    contactCapacity: capacity,
    batches: Math.max(0, Math.min(payload.batches - schedule.batchLoss, capacity)),
  }
}

export function testDesign(design: CubeSatDesign) {
  const designForecast = forecast(design)
  const firstTx = cubeSat.radios[design.radio].firstTxMinutes
  const ditl = {
    separation: cubeSat.ditl.separationMinutes,
    deploy: cubeSat.ditl.deployMinutes,
    firstTx,
    elapsed: firstTx - cubeSat.ditl.separationMinutes,
    threshold: cubeSat.ditl.minQuietMinutes,
  }
  const testedBatches = designForecast.deficit ? 0 : designForecast.batches
  const powerPass = designForecast.deficit === 0
  const ditlPass = ditl.elapsed >= ditl.threshold
  const dataPass = testedBatches >= cubeSat.minimumBatches
  return { design, ...designForecast, ditl, testedBatches, powerPass, ditlPass, dataPass, checks: [powerPass, dataPass, ditlPass] }
}

export type CubeSatEvidence = ReturnType<typeof testDesign> & { week?: number; revision?: number }

export function applyRemedy(design: CubeSatDesign, remedy: Remedy): CubeSatDesign {
  switch (remedy) {
    case 'stagger': return { ...design, schedule: 'stagger' }
    case 'basic': return { ...design, payload: 'basic', schedule: 'overlap' }
    case 'reinforced': return { ...design, supply: 'reinforced', schedule: 'overlap' }
    case 'compliant': return { ...design, radio: 'compliant' }
  }
}

export function repairOptions(design: CubeSatDesign) {
  const estimate = testDesign(design)
  return remedies.filter(remedy => {
    if (remedy === 'compliant') return !estimate.ditlPass
    const changed = testDesign(applyRemedy(design, remedy))
    return (changed.deficit < estimate.deficit && changed.dataPass)
      || (!estimate.dataPass && changed.dataPass && changed.powerPass)
  })
}

export function resolveTeamReview(remedy: MultiplayerRemedy) {
  const correction = cubeSat.costs[remedy]
  const retest = cubeSat.costs.integrate
  return {
    evidence: testDesign(applyRemedy(reviewDesign, remedy)),
    weeks: correction.weeks + retest.weeks,
    credits: correction.credits + retest.credits,
  }
}

export type CubeSatGame = Game & { design: CubeSatDesign }

export function planContact(evidence: Pick<CubeSatEvidence, 'design' | 'contactCapacity' | 'batches'>, choice: string) {
  const capacity = evidence.contactCapacity ?? forecast(evidence.design).contactCapacity
  const diagnostics = choice === 'diagnostics' ? Math.min(capacity, cubeSat.diagnosticBatches) : 0
  const requested = choice === 'priority' ? cubeSat.minimumBatches : evidence.batches
  return { batches: Math.min(requested, evidence.batches, capacity - diagnostics), diagnostics }
}

function finishContact(evidence: CubeSatEvidence, choice: string, accepted?: number) {
  const { batches: received, diagnostics } = planContact(evidence, choice)
  const batches = accepted ?? received
  return {
    choice, batches, diagnostics, archived: received - batches, firstTx: evidence.ditl.firstTx,
    delivered: batches >= cubeSat.minimumBatches, stretch: batches >= cubeSat.stretchBatches,
  }
}

export const cubeSatRules: MissionRules = {
  id: cubeSat.id,
  title: cubeSat.title,
  brief: cubeSat.brief,
  dialogue: 'briefDialogue',
  deadline: cubeSat.deadline,
  budget: cubeSat.budget,
  playMinutes: cubeSat.playMinutes,
  groups: {
    payload: { legend: 'payload', options: cubeSat.payloads },
    supply: { legend: 'supply', options: cubeSat.supplies },
    schedule: { legend: 'schedule', options: cubeSat.schedules },
    radio: { legend: 'radio', options: cubeSat.radios },
  },
  initialDesign: cubeSat.initialDesign,
  costs: cubeSat.costs,
  remedies,
  stageDetails: {
    feasibility: 'feasibilityDetail', design: 'designDetail', build: 'buildDetail',
    integration: 'integrationDetail', review: 'reviewDetail', flight: 'flightDetail',
  },
  outcomes: { stopped: 'outcomeStopped', extra: 'outcomeExtra', success: 'outcomeSuccess', partial: 'outcomePartial' },
  reputation: { minimum: 1, stretch: 1 },
  flightChoices,
  configurationSteps: { feasibility: ['payload', 'supply'], design: ['schedule', 'radio'] },
  labSteps: (game, kind) => kind === 'assembly' ? benchSequence(game.benchLead).length : powerTimeline(game.design as CubeSatDesign).length,
  contact: {
    plan: (evidence, choice) => planContact(evidence as CubeSatEvidence, choice),
    finish: (evidence, choice, accepted) => finishContact(evidence as CubeSatEvidence, choice, accepted),
  },
  forecast: design => forecast(design as CubeSatDesign),
  forecastClear: result => !result.deficit,
  test: design => testDesign(design as CubeSatDesign),
  applyRemedy: (design, remedy) => applyRemedy(design as CubeSatDesign, remedy as Remedy),
  repairOptions: (design: Design) => repairOptions(design as CubeSatDesign),
  fly: (evidence, choice) => finishContact(evidence as CubeSatEvidence, choice),
}
