import assert from 'node:assert/strict'
import test from 'node:test'
import { eventChoice, newGame, runMission, type Game, type MissionRules } from '../src/game/mission'
import { completeMission, emptyProgress, isUnlocked, reputation } from '../src/game/progress'
import { cubeSatRules } from '../src/missions/cubesat'
import { missionRules } from '../src/missions/rules'

missionRules['budget-cut-test'] = {
  ...cubeSatRules,
  id: 'budget-cut-test',
  events: [{
    id: 'budgetCut', title: 'returned', detail: 'returnedDetail',
    trigger: game => game.stage === 'design',
    choices: [
      { id: 'accept', label: 'remedyBasic', detail: 'returnedDetail', apply: game => ({ ...game, credits: game.credits - 30 }) },
      { id: 'extend', label: 'remedyStagger', detail: 'returnedDetail', apply: game => ({ ...game, deadline: game.deadline + 2 }) },
    ],
  }],
} satisfies MissionRules

function work(game: Game, count: number) {
  for (let week = 0; week < count; week += 1) game = runMission(game, { type: 'work' })
  return game
}

test('a triggered event blocks other actions until a choice is made', () => {
  let game = work(newGame('budget-cut-test'), 1)
  assert.equal(game.event, 'budgetCut')
  assert.equal(runMission(game, { type: 'work' }), game)
  assert.equal(runMission(game, { type: 'choose', choice: 'missing' }), game)
  game = runMission(game, { type: 'choose', choice: 'accept' })
  assert.equal(game.event, null)
  assert.equal(game.credits, 100 - 6 - 30)
  assert.equal(eventChoice(game, 'budgetCut'), 'accept')
  assert.equal(game.log.at(-1)?.label, 'remedyBasic')
  assert.equal(game.log.at(-1)?.cost, 30)
  game = work(game, 1)
  assert.equal(game.stage, 'build')
  assert.equal(game.event, null)
})

test('events can move the deadline', () => {
  let game = runMission(work(newGame('budget-cut-test'), 1), { type: 'choose', choice: 'extend' })
  assert.equal(game.deadline, 8)
  game = work(game, 3)
  assert.equal(game.stage, 'review')
})

test('completing the minimum goal unlocks the next mission and adds reputation once', () => {
  assert.equal(isUnlocked(emptyProgress, 'cubesat'), true)
  assert.equal(isUnlocked(emptyProgress, 'orbital-launch'), false)
  let game = runMission(work(newGame('cubesat'), 4), { type: 'review' })
  game = runMission(game, { type: 'fly', choice: 'priority' })
  assert.equal(game.flight?.delivered, true)
  const progress = completeMission(emptyProgress, game)
  assert.equal(isUnlocked(progress, 'orbital-launch'), true)
  assert.equal(isUnlocked(progress, 'lunar-mission'), false)
  assert.equal(reputation(progress), 1)
  assert.equal(completeMission(progress, game), progress)
})

test('a stopped mission is recorded without unlocking', () => {
  const game = runMission(newGame('cubesat'), { type: 'cancel' })
  const progress = completeMission(emptyProgress, game)
  assert.equal(isUnlocked(progress, 'orbital-launch'), false)
  assert.equal(reputation(progress), 0)
})
