import assert from 'node:assert/strict'
import test from 'node:test'
import { en } from '../src/i18n/en'
import { zhTW } from '../src/i18n/zh-TW'
import { orbitalLaunch as mission, orbitalProposals } from '../src/missions/orbital-launch'

// Route checks for docs/story/orbital-launch.md. The orbital chapter is not wired into src/game/mission.ts yet,
// so this file replays each documented route against the mission data with the rules written in that document.

type Design = {
  stage: keyof typeof mission.stages
  telemetry: keyof typeof mission.telemetry
  adapter: keyof typeof mission.adapters
  ground: keyof typeof mission.grounds
}
type WorkId = keyof typeof mission.costs
type Remedy = keyof typeof mission.remedies
type Plan = keyof typeof mission.passPlans
type Step =
  | { design: Partial<Design> }
  | { work: WorkId; lab?: boolean }
  | { remedy: Remedy }
  | { review: true }
  | { fly: Plan }

function performance(design: Design) {
  const stage = mission.stages[design.stage]
  const carried = mission.testPayloadKg + mission.telemetry[design.telemetry].massKg + mission.adapters[design.adapter].massKg
  return { carried, analysis: stage.capacityKg - carried, tested: stage.capacityKg - stage.shortfallKg - carried }
}

function play(steps: readonly Step[], labSlot = false) {
  let design: Design = { ...mission.initialDesign }
  let week = 0
  let budget: number = mission.budget
  let spent = 0
  let frozen = false
  let integrated = false
  let hotfire = false
  let rehearsed = false
  let lab = labSlot
  let approvedWeek = 0
  let outcome: keyof typeof mission.outcomes | undefined
  let stop = ''
  let confirmation = 0
  let diagnostics = 0
  let marginProven = false
  const done = new Set<WorkId>()
  const ledger: string[] = []

  function spend(label: string, weeks: number, cost: number) {
    if (cost > budget - spent) { outcome = 'stopped'; stop = 'funds'; ledger.push(`${label}: needs ${cost}, has ${budget - spent}`); return false }
    spent += cost
    const start = week + 1
    for (let index = 0; index < weeks; index += 1) {
      week += 1
      if (week === mission.events.budgetCut.afterWeek) budget += mission.events.budgetCut.budgetChange
    }
    ledger.push(`W${weeks > 1 ? `${start}–${week}` : week} ${label} −${cost} → ${budget - spent}`)
    return true
  }

  for (const step of steps) {
    if (outcome) break
    if ('design' in step) {
      assert.equal(frozen, false, 'design choices are free only before CDR')
      design = { ...design, ...step.design }
    } else if ('work' in step) {
      const { weeks, credits } = mission.costs[step.work]
      let cost: number = credits
      if (step.lab) {
        assert.ok(lab && week < mission.labSlot.expiresWeek && (step.work === 'integrate' || step.work === 'rehearse'), 'lab session available')
        cost -= mission.labSlot.uses[step.work as 'integrate' | 'rehearse'].creditsSaved
        lab = false
      }
      if (step.work === 'prelim') assert.ok(performance(design).analysis >= 0, 'PDR needs margin by analysis')
      if (step.work === 'freeze') cost += mission.stages[design.stage].cost + mission.telemetry[design.telemetry].cost
        + mission.adapters[design.adapter].cost + mission.grounds[design.ground].cost
      if (!spend(step.work, weeks, cost)) break
      done.add(step.work)
      if (step.work === 'freeze') frozen = true
      if (step.work === 'integrate' || step.work === 'retest') integrated = true
      if (step.work === 'hotfire') hotfire = true
      if (step.work === 'rehearse') rehearsed = true
    } else if ('remedy' in step) {
      const { weeks, credits } = mission.remedies[step.remedy]
      if (!spend(step.remedy, weeks, credits)) break
      if (step.remedy === 'adapter') design = { ...design, adapter: 'lightweight' }
      if (step.remedy === 'dropDiagnostics') design = { ...design, telemetry: 'basic' }
      if (step.remedy === 'dualStation') { design = { ...design, ground: 'dual' }; rehearsed = false }
      if (done.has('integrate')) integrated = false
    } else if ('review' in step) {
      if (week > mission.deadline) { outcome = 'stopped'; stop = 'deadline'; break }
      const { analysis, tested } = performance(design)
      assert.ok(mission.gates.FRR.work.every((work) => done.has(work)), 'FRR work complete')
      assert.ok(integrated, 'integration evidence is current')
      assert.ok((hotfire ? tested : analysis) >= 0, 'margin on the best evidence')
      assert.ok(mission.grounds[design.ground].capacity >= mission.confirmationUnits, 'pass carries the confirmation data')
      approvedWeek = week
    } else {
      assert.ok(approvedWeek, 'FRR approved before flight')
      const { tested } = performance(design)
      if (tested < 0) { outcome = 'incomplete'; stop = 'ascent'; break }
      marginProven = hotfire && tested >= mission.marginStretchKg
      const ground = mission.grounds[design.ground]
      const capacity = rehearsed ? ground.rehearsedCapacity : ground.capacity
      const available = mission.telemetry[design.telemetry].diagnosticUnits
      if (mission.passPlans[step.fly].diagnosticsFirst) {
        diagnostics = Math.min(available, capacity)
        confirmation = Math.min(mission.confirmationUnits, capacity - diagnostics)
      } else {
        confirmation = Math.min(mission.confirmationUnits, capacity)
        diagnostics = Math.min(available, capacity - confirmation)
      }
      if (confirmation < mission.confirmationUnits) { outcome = 'incomplete'; stop = 'pass' }
      else outcome = marginProven || (available > 0 && diagnostics === available) ? 'extra' : 'success'
    }
  }
  const records = {
    onTime: (outcome === 'extra' || outcome === 'success') && approvedWeek <= mission.onTimeWeek,
    verified: (outcome === 'extra' || outcome === 'success') && hotfire && rehearsed,
  }
  if (process.env.ORBITAL_ROUTES) console.log(ledger.join('\n'), '\n', { week, spent, left: budget - spent, outcome, stop, confirmation, diagnostics, marginProven, records, ...performance(design) }, '\n')
  return { week, spent, left: budget - spent, outcome, stop, confirmation, diagnostics, marginProven, ...records, tested: performance(design).tested }
}

const work = (...ids: WorkId[]): Step[] => ids.map((id) => ({ work: id }))
const baseline = work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'hotfire', 'integrate', 'rehearse')

test('every orbital text key exists in both dictionaries', () => {
  const keys = new Set<string>()
  const collect = (value: unknown, key = '') => {
    if (typeof value === 'string' && ['title', 'brief', 'label', 'description', 'carried', 'pass', 'requires'].includes(key)) keys.add(value)
    else if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) collect(child, name)
  }
  collect(mission)
  collect(orbitalProposals)
  assert.ok(keys.size > 60)
  for (const key of keys) {
    assert.ok(key in en, `en is missing ${key}`)
    assert.ok(key in zhTW, `zh-TW is missing ${key}`)
  }
})

test('all baseline options with both tests deliver the demonstration and both track records', () => {
  const result = play([...baseline, { review: true }, { fly: 'confirmFirst' }])
  assert.deepEqual(result, { week: 9, spent: 136, left: 40, outcome: 'success', stop: '', confirmation: 2, diagnostics: 0, marginProven: false, onTime: true, verified: true, tested: 9 })
})

test('the lightweight stage proves the lift margin after the cut', () => {
  const result = play([...work('assess', 'trade'), { design: { stage: 'highMargin' } }, ...baseline.slice(1), { review: true }, { fly: 'confirmFirst' }])
  assert.deepEqual(result, { week: 10, spent: 167, left: 9, outcome: 'extra', stop: '', confirmation: 2, diagnostics: 0, marginProven: true, onTime: true, verified: true, tested: 26 })
})

test('the diagnostics package with two rehearsed stations returns the extra data after the cut', () => {
  const steps: Step[] = [...work('assess', 'trade'), { design: { telemetry: 'diagnostics', adapter: 'lightweight', ground: 'dual' } }, ...baseline.slice(1), { review: true }]
  assert.deepEqual(play([...steps, { fly: 'confirmFirst' }]),
    { week: 10, spent: 175, left: 1, outcome: 'extra', stop: '', confirmation: 2, diagnostics: 3, marginProven: false, onTime: true, verified: true, tested: 3 })
  const lab = play([
    { design: { telemetry: 'diagnostics', adapter: 'lightweight', ground: 'dual' } }, ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics'),
    { work: 'rehearse', lab: true }, ...work('hotfire', 'integrate'), { review: true }, { fly: 'diagnosticsFirst' },
  ], true)
  assert.deepEqual(lab, { week: 9, spent: 162, left: 14, outcome: 'extra', stop: '', confirmation: 2, diagnostics: 3, marginProven: false, onTime: true, verified: true, tested: 3 })
})

test('keeping both upgrades and cutting every test wastes them', () => {
  const result = play([
    { design: { stage: 'highMargin', telemetry: 'diagnostics', ground: 'dual' } },
    ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'integrate'), { review: true }, { fly: 'confirmFirst' },
  ])
  assert.deepEqual(result, { week: 7, spent: 166, left: 10, outcome: 'success', stop: '', confirmation: 2, diagnostics: 2, marginProven: false, onTime: true, verified: false, tested: 14 })
})

test('flying the diagnostics package on analysis alone falls short of orbit', () => {
  const result = play([
    { design: { telemetry: 'diagnostics', ground: 'dual' } },
    ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'integrate', 'rehearse'), { review: true }, { fly: 'confirmFirst' },
  ])
  assert.deepEqual(result, { week: 8, spent: 148, left: 28, outcome: 'incomplete', stop: 'ascent', confirmation: 0, diagnostics: 0, marginProven: false, onTime: false, verified: false, tested: -3 })
})

test('the hot-fire result sends an overweight stack back for a lighter adapter', () => {
  const result = play([
    { design: { telemetry: 'diagnostics', ground: 'dual' } },
    ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'hotfire'), { remedy: 'adapter' }, ...work('integrate', 'rehearse'),
    { review: true }, { fly: 'confirmFirst' },
  ])
  assert.deepEqual(result, { week: 10, spent: 170, left: 6, outcome: 'extra', stop: '', confirmation: 2, diagnostics: 3, marginProven: false, onTime: true, verified: true, tested: 3 })
})

test('sending diagnostics first through an unrehearsed handover loses the confirmation data', () => {
  const result = play([
    { design: { telemetry: 'diagnostics', adapter: 'lightweight', ground: 'dual' } },
    ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'hotfire', 'integrate'), { review: true }, { fly: 'diagnosticsFirst' },
  ])
  assert.deepEqual(result, { week: 8, spent: 162, left: 14, outcome: 'incomplete', stop: 'pass', confirmation: 1, diagnostics: 3, marginProven: false, onTime: false, verified: false, tested: 3 })
})

test('keeping every upgrade and every test runs out of budget before integration', () => {
  const result = play([
    { design: { stage: 'highMargin', telemetry: 'diagnostics', adapter: 'lightweight', ground: 'dual' } },
    ...work('assess', 'prelim', 'freeze', 'buildStage', 'buildAvionics', 'hotfire', 'integrate'),
  ])
  assert.deepEqual(result, { week: 7, spent: 176, left: 0, outcome: 'stopped', stop: 'funds', confirmation: 0, diagnostics: 0, marginProven: false, onTime: false, verified: false, tested: 20 })
})
