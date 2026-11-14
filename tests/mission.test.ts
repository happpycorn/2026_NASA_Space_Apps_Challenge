import assert from 'node:assert/strict'
import test from 'node:test'
import { newGame, runMission, type Game } from '../src/game/mission'
import { initialDesign, resolveTeamReview, testDesign } from '../src/missions/cubesat'

function work(game: Game, count: number) {
  for (let week = 0; week < count; week += 1) game = runMission(game, { type: 'work' })
  return game
}

test('power and data checks respond to all four hardware combinations', () => {
  assert.equal(testDesign(initialDesign).peak, 9)
  assert.equal(testDesign({ ...initialDesign, supply: 'reinforced' }).available, 14)
  const advanced = { ...initialDesign, payload: 'advanced' } as const
  assert.equal(testDesign(advanced).deficit, 3)
  assert.equal(testDesign({ ...advanced, supply: 'reinforced' }).powerPass, true)
  assert.equal(testDesign({ ...advanced, schedule: 'stagger' }).batches, 3)
})

test('optional early analysis records its configuration and leaves a week in reserve', () => {
  let game = newGame('cubesat')
  game = runMission(game, { type: 'configure', design: { ...game.design, payload: 'advanced' } })
  game = runMission(game, { type: 'analyze' })
  assert.equal(game.analysis?.forecast.deficit, 3)
  game = runMission(game, { type: 'configure', design: { ...game.design, schedule: 'stagger' } })
  game = runMission(work(game, 4), { type: 'review' })
  assert.equal(game.stage, 'flight')
  assert.equal(game.week, 5)
  assert.equal(game.log[0].design.schedule, 'overlap')
})

test('DITL-only correction invalidates evidence and costs another integration test', () => {
  let game = newGame('cubesat')
  game = runMission(game, { type: 'configure', design: { ...game.design, radio: 'early' } })
  game = runMission(work(game, 4), { type: 'review' })
  assert.equal(game.evidence?.ditl.firstTx, 20)
  assert.equal(game.returned, true)
  game = runMission(game, { type: 'repair', remedy: 'compliant' })
  assert.equal(game.stage, 'integration')
  assert.equal(runMission(game, { type: 'review' }), game)
  game = runMission(work(game, 1), { type: 'review' })
  assert.equal(game.week, 6)
  assert.equal(game.evidence?.ditl.firstTx, 32)
  assert.equal(game.stage, 'flight')
})

test('team corrections use the same test, power tradeoffs and costs', () => {
  const stagger = resolveTeamReview('stagger')
  const upgraded = resolveTeamReview('reinforced')
  assert.equal(stagger.weeks, 2)
  assert.equal(stagger.credits, 14)
  assert.equal(stagger.evidence.batches, 3)
  assert.equal(upgraded.evidence.batches, 4)
  assert.equal(upgraded.credits, 24)
})

test('integration playback consumes one test and one return even with stale advance actions', () => {
  let game = newGame()
  game = runMission(game, { type: 'configure', design: { ...initialDesign, payload: 'advanced' } })
  game = work(game, 3)
  game = runMission(game, { type: 'runLab', testFocus: 'imaging' })
  assert.ok(game.playback)
  const first = game.playback
  const second = runMission(game, { type: 'advanceLab', playback: first })
  assert.equal(runMission(second, { type: 'advanceLab', playback: first, skip: true }), second)
  assert.equal(runMission(second, { type: 'runLab' }), second)
  const returned = runMission(second, { type: 'advanceLab', playback: second.playback!, skip: true })
  assert.equal(returned.returned, true)
  assert.equal(returned.week, 4)
  assert.equal(returned.credits, 38)
  assert.deepEqual(returned.log.slice(-2).map(entry => entry.id), ['integrate', 'return'])
})

test('ground delivery counts accepted batches and ignores unchecked or repeated batch actions', () => {
  let game = newGame()
  game = runMission(game, { type: 'configure', design: { ...initialDesign, payload: 'advanced', supply: 'reinforced' } })
  const approved = runMission(work(game, 4), { type: 'review' })
  assert.equal(approved.stage, 'flight')
  assert.equal(runMission(approved, { type: 'checkBatch', batch: 0, deliver: true }), approved)
  game = runMission(approved, { type: 'startContact', choice: 'extra' })
  assert.equal(runMission(game, { type: 'checkBatch', batch: 1, deliver: true }), game)
  game = runMission(game, { type: 'checkBatch', batch: 0, deliver: false })
  assert.equal(runMission(game, { type: 'checkBatch', batch: 0, deliver: true }), game)
  for (let batch = 1; batch <= 3; batch += 1) game = runMission(game, { type: 'checkBatch', batch, deliver: true })
  assert.equal(game.stage, 'results')
  assert.equal(game.flight?.batches, 3)
  assert.equal(game.flight?.archived, 1)
  assert.equal(game.flight?.stretch, false)
  assert.equal(game.log.filter(entry => entry.id === 'operate').length, 1)
  assert.equal(game.credits, approved.credits)
  assert.equal(game.week, approved.week)
})
