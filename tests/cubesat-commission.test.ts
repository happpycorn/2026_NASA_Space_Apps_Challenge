import assert from 'node:assert/strict'
import { test } from 'node:test'
import { currentEvidence, newGame, runMission, taskOptions } from '../src/game/mission'
import { completeMission, emptyProgress, isUnlocked, reputation } from '../src/game/progress'
import type { Game } from '../src/game/types'
import { commissionPlan, commissionRepairs, commissionRules } from '../src/missions/cubesat-commission'

function task(game: Game, id: string) {
  assert.ok(taskOptions(game).some(task => task.id === id), id)
  return runMission(game, { type: 'task', task: id, turn: game.log.length })
}

function start(seed: number, launch = 'iss', capability = 'baseline', commission: Game['commission'] = 'river') {
  const game = newGame('cubesat', [], seed, commission)
  return task(runMission(game, { type: 'configure', design: { launch, capability } }), 'assess')
}

function integrate(game: Game) {
  return task(task(task(game, 'freeze'), 'build'), 'integrate')
}

function fly(game: Game) {
  const approved = runMission(game, { type: 'review', turn: game.log.length })
  assert.equal(approved.stage, 'flight')
  return runMission(approved, { type: 'segment', segment: 'commission-pass', choice: null, turn: 0 })
}

test('the commissions use different instruments and acceptance thresholds', () => {
  const river = start(1)
  const bay = start(1, 'iss', 'baseline', 'bay')
  assert.equal(commissionPlan(river).required, 2)
  assert.equal(commissionPlan(bay).required, 3)
  assert.equal(commissionPlan(bay).peak, commissionPlan(river).peak + 1)
  for (const game of [river, bay]) {
    const result = fly(integrate(game))
    assert.equal(result.flight?.batches, commissionPlan(game).required)
    assert.equal(result.flight?.archived, result.flight?.batches)
    assert.ok(isUnlocked(completeMission(emptyProgress, result), 'orbital-launch'))
    assert.deepEqual(commissionRules.records?.(result), [])
  }
})

test('the early test finds an interface defect and only the correction clears it', () => {
  const screened = task(start(6, 'iss', 'sensor'), 'screen')
  assert.equal(screened.log.at(-1)?.detail?.message, 'commissionScreenFound')
  assert.ok(!taskOptions(screened).some(task => task.id === 'freeze'))
  const corrected = task(screened, 'correctEarly')
  assert.equal(corrected.week, screened.week)
  assert.equal(screened.credits - corrected.credits, 6)
  const flight = fly(integrate(corrected))
  assert.equal(flight.week, 6)
  assert.equal(flight.flightProgress?.steps[0].id, 'commission-pass')
  const result = runMission(flight, { type: 'segment', segment: 'commission-extra', choice: 'north', turn: 1 })
  assert.equal(result.flight?.batches, 3)
  assert.equal(result.flight?.archived, 3)
  assert.equal(result.flight?.stretch, true)
  assert.deepEqual(commissionRules.records?.(result), ['cubesat:partnerVerified'])
})

test('an auxiliary exposure can save the basic delivery and consume the extra opportunity', () => {
  const result = fly(integrate(start(4, 'iss', 'sensor')))
  assert.equal(result.flight?.assisted, true)
  assert.equal(result.flight?.delivered, true)
  assert.equal(result.flight?.stretch, false)
  const noAux = fly(integrate(start(4)))
  assert.equal(noAux.flight?.batches, 1)
  assert.equal(noAux.flight?.delivered, false)
})

test('a short pass can use all slots for the minimum and suppress the follow-up choice', () => {
  const result = fly(integrate(start(9, 'iss', 'pointing', 'bay')))
  assert.equal(result.flight?.capacity, 3)
  assert.equal(result.flight?.delivered, true)
  assert.equal(result.flight?.stretch, false)
})

test('a successful tidal inlet observation earns its own report while both routes fulfill the commission', () => {
  const flight = fly(integrate(start(5, 'iss', 'pointing', 'bay')))
  const finish = (choice: string) => runMission(flight, { type: 'segment', segment: 'commission-extra', choice, turn: 1 })
  const pier = finish('north')
  const inlet = finish('south')
  for (const result of [pier, inlet]) {
    assert.equal(result.flight?.delivered, true)
    assert.equal(result.flight?.stretch, true)
    assert.equal(result.flight?.batches, 4)
    assert.equal(reputation(completeMission(emptyProgress, result)), 2)
  }
  assert.deepEqual(commissionRules.records?.(pier), [])
  assert.deepEqual(commissionRules.records?.(inlet), ['cubesat:inletSurvey'])
})

test('a one-week fallback leaves time for a real retest, with no release on old evidence', () => {
  const failed = integrate(start(6, 'rideshare', 'sensor'))
  const returned = runMission(failed, { type: 'review' })
  assert.equal(returned.week, 5)
  assert.deepEqual(commissionRepairs(returned).map(({ id, weeks, credits, fits }) => [id, weeks, credits, fits]),
    [['correctLate', 2, 17, false], ['strip', 1, 12, true]])
  const stripped = task(returned, 'strip')
  assert.equal(currentEvidence(stripped), null)
  assert.equal(runMission(stripped, { type: 'review' }), stripped)
  const retested = task(stripped, 'retest')
  assert.equal(retested.week, 6)
  assert.equal(stripped.credits - retested.credits, 8)
  assert.equal(fly(retested).flight?.delivered, true)
})

test('overcommitment can miss handover after the formal test, even though required work fit', () => {
  const game = start(6, 'rideshare', 'combined')
  assert.equal(commissionPlan(game).spareWeeks, 0)
  assert.ok(!taskOptions(game).some(task => task.id === 'screen'))
  const failed = integrate(game)
  const result = runMission(failed, { type: 'review' })
  assert.equal(result.week, 6)
  assert.equal(result.stop, 'deadline')
  assert.equal(result.flight, null)
})
